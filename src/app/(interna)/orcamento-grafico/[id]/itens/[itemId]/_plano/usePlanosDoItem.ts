'use client'

/**
 * usePlanosDoItem — planos do item multi-plano + ações do Grid de Planos (R9.3 a R9.12).
 *
 * Rotas (back):
 *  - GET    /orcamento-grafico/:id/itens/:itemId/planos              → { planos }
 *  - POST   /orcamento-grafico/:id/itens/:itemId/planos              (body do plano + posicaoApos?)
 *  - DELETE /orcamento-grafico/:id/itens/:itemId/planos/:planoId
 *  - PATCH  /orcamento-grafico/:id/itens/:itemId/planos/reordenar    { ordem }
 *
 * Regras:
 *  - o estado da lista só muda depois da resposta de sucesso; em falha fica como estava, a ação
 *    continua disponível e `erroOperacao` traz "A operação não foi salva." + o detalhe do back;
 *  - 409 de limite: "Limite de 20 planos por item.";
 *  - cada ação empilha a sua inversa na pilha de Desfazer (memória da sessão, `pilha-store`):
 *    Incluir/Copiar → DELETE; Excluir → POST recriando (logo abaixo do plano anterior) e remapeia
 *    o id na pilha; Trocar/Reordenar → PATCH com a ordem anterior.
 *
 * Incluir abre a Tela_Plano (`incluir` só devolve a URL); quem cria o plano lá deve chamar
 * `registrarPlanoIncluido(itemId, planoId)` para que o Desfazer apague o plano criado.
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

import { api } from '@/lib/api'
import { gerarNomeCopia } from './nome-copia'
import { topo, type OperacaoInversa, type PilhaDesfazer } from './pilha-desfazer'
import { despacharPilha, lerPilha, ouvirPilha } from './pilha-store'
import { ID_PLANO_NOVO, type PlanoLeitura } from './plano.types'

export const LIMITE_PLANOS_ITEM = 20
export const MSG_NAO_SALVO = 'A operação não foi salva.'
export const MSG_LIMITE_PLANOS = 'Limite de 20 planos por item.'

export type DirecaoMover = 'cima' | 'baixo'

export interface PlanosDoItem {
  planos: PlanoLeitura[]
  carregando: boolean
  /** Erro ao carregar a lista. */
  erroCarga: string | null
  /** Erro da última ação (lista mantida como estava). */
  erroOperacao: string | null
  /** Há uma ação em andamento. */
  ocupado: boolean
  /** Item no limite de 20 planos. */
  noLimite: boolean
  podeDesfazer: boolean
  recarregar: () => Promise<void>
  /** URL da Tela_Plano para incluir (null quando o item já está no limite). */
  incluir: (posicaoApos?: string | null) => string | null
  copiar: (planoId: string) => Promise<boolean>
  excluir: (planoId: string) => Promise<boolean>
  mover: (planoId: string, direcao: DirecaoMover) => Promise<boolean>
  desfazer: () => Promise<boolean>
  limparErro: () => void
}

// ─── Funções puras (exportadas para teste) ──────────────────────────────────

function semNulos<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const saida: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(obj)) if (v !== null && v !== undefined) saida[k] = v
  return saida as Partial<T>
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Corpo do POST de plano a partir de um plano lido (cópia ou recriação). */
export function montarBodyPlano(plano: PlanoLeitura, nome: string, posicaoApos?: string | null): Record<string, unknown> {
  const body: Record<string, unknown> = {
    nome,
    tipoPlanoId: plano.tipoPlanoId,
    suporteId: plano.suporteId,
    suporteProducaoId: plano.suporteProducaoId,
    formatoLarguraMm: num(plano.formatoLarguraMm) ?? 0,
    formatoAlturaMm: num(plano.formatoAlturaMm) ?? 0,
    numCores: Math.trunc(num(plano.numCores) ?? 0),
    maquinaId: plano.maquinaId,
    especificacao: plano.especificacao ?? null,
  }
  const gramatura = num(plano.gramatura)
  if (gramatura !== null && gramatura > 0) body.gramatura = gramatura
  if (Array.isArray(plano.cores)) body.cores = plano.cores.map((c) => semNulos(c as unknown as Record<string, unknown>))
  if (Array.isArray(plano.acabamentosRicos)) body.acabamentosRicos = plano.acabamentosRicos.map((a) => semNulos(a))
  if (posicaoApos) body.posicaoApos = posicaoApos
  return body
}

/** Nova ordem dos ids com o plano trocado de lugar com o vizinho (null = não dá para mover). */
export function ordemMovida(ids: readonly string[], planoId: string, direcao: DirecaoMover): string[] | null {
  const i = ids.indexOf(planoId)
  const j = direcao === 'cima' ? i - 1 : i + 1
  if (i < 0 || j < 0 || j >= ids.length) return null
  const nova = [...ids]
  ;[nova[i], nova[j]] = [nova[j], nova[i]]
  return nova
}

/** Planos na ordem pedida (ids ausentes da lista são ignorados; os que sobram vão ao fim). */
export function ordenarPlanos(planos: readonly PlanoLeitura[], ordem: readonly string[]): PlanoLeitura[] {
  const porId = new Map(planos.map((p) => [p.id, p]))
  const saida: PlanoLeitura[] = []
  for (const id of ordem) {
    const p = porId.get(id)
    if (p) {
      saida.push(p)
      porId.delete(id)
    }
  }
  saida.push(...porId.values())
  return saida.map((p, i) => ({ ...p, sequencia: i + 1 }))
}

/** Mensagem da falha: limite de planos ou "A operação não foi salva." + detalhe do back. */
export function mensagemFalha(err: unknown): string {
  const e = err as { response?: { status?: number; data?: { message?: unknown } }; message?: unknown }
  const status = e?.response?.status
  const detalhe = typeof e?.response?.data?.message === 'string' ? e.response.data.message : null
  if (status === 409 && (!detalhe || /limite/i.test(detalhe))) return MSG_LIMITE_PLANOS
  return detalhe ? `${MSG_NAO_SALVO} ${detalhe}` : MSG_NAO_SALVO
}

/** Registra na pilha o plano criado pela Tela_Plano (o Desfazer o apaga). */
export function registrarPlanoIncluido(itemId: string, planoId: string): void {
  despacharPilha(itemId, { tipo: 'EMPILHAR', op: { tipo: 'EXCLUIR_PLANO', planoId } })
}

// ─── Hook ───────────────────────────────────────────────────────────────────

const PILHA_SEM_ITEM: PilhaDesfazer = { itens: [] }

export function usePlanosDoItem(orcamentoId: string, itemId: string | null): PlanosDoItem {
  const base = itemId ? `/orcamento-grafico/${orcamentoId}/itens/${itemId}/planos` : null

  const [planos, setPlanos] = useState<PlanoLeitura[]>([])
  const [carregando, setCarregando] = useState<boolean>(!!base)
  const [erroCarga, setErroCarga] = useState<string | null>(null)
  const [erroOperacao, setErroOperacao] = useState<string | null>(null)
  const [ocupado, setOcupado] = useState(false)

  const pilha = useSyncExternalStore(
    useCallback((f: () => void) => (itemId ? ouvirPilha(itemId, f) : () => {}), [itemId]),
    () => (itemId ? lerPilha(itemId) : PILHA_SEM_ITEM),
    () => PILHA_SEM_ITEM,
  )

  const buscar = useCallback(async (): Promise<PlanoLeitura[]> => {
    if (!base) return []
    const { data } = await api.get(base)
    const lista = (data as { planos?: unknown } | null)?.planos
    return Array.isArray(lista) ? (lista as PlanoLeitura[]) : []
  }, [base])

  const recarregar = useCallback(async () => {
    if (!base) {
      setPlanos([])
      setCarregando(false)
      return
    }
    setCarregando(true)
    try {
      setPlanos(await buscar())
      setErroCarga(null)
    } catch (err) {
      const e = err as { response?: { data?: { message?: unknown } } }
      const detalhe = typeof e?.response?.data?.message === 'string' ? e.response.data.message : null
      setErroCarga(detalhe ?? 'Não foi possível carregar os planos.')
    } finally {
      setCarregando(false)
    }
  }, [base, buscar])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  /** Roda uma ação; em falha mantém a lista e expõe a mensagem. */
  const executar = useCallback(async (acao: () => Promise<void>): Promise<boolean> => {
    setOcupado(true)
    try {
      await acao()
      setErroOperacao(null)
      return true
    } catch (err) {
      setErroOperacao(mensagemFalha(err))
      return false
    } finally {
      setOcupado(false)
    }
  }, [])

  /** Depois de uma gravação já confirmada: relê a lista; se a leitura falhar, usa o estado local. */
  const atualizarDepois = useCallback(
    async (local: () => PlanoLeitura[]) => {
      try {
        setPlanos(await buscar())
      } catch {
        setPlanos(local())
      }
    },
    [buscar],
  )

  const noLimite = planos.length >= LIMITE_PLANOS_ITEM

  const incluir = useCallback(
    (posicaoApos?: string | null): string | null => {
      if (!base) return null
      if (noLimite) {
        setErroOperacao(MSG_LIMITE_PLANOS)
        return null
      }
      // Rota da tela (Next), não da API.
      const tela = `/orcamento-grafico/${orcamentoId}/itens/${itemId}/planos/${ID_PLANO_NOVO}`
      return posicaoApos ? `${tela}?apos=${encodeURIComponent(posicaoApos)}` : tela
    },
    [base, orcamentoId, itemId, noLimite],
  )

  const copiar = useCallback(
    async (planoId: string): Promise<boolean> => {
      if (!base || !itemId) return false
      const original = planos.find((p) => p.id === planoId)
      if (!original) return false
      if (noLimite) {
        setErroOperacao(MSG_LIMITE_PLANOS)
        return false
      }
      return executar(async () => {
        const nome = gerarNomeCopia(original.nome, planos.map((p) => p.nome))
        const { data } = await api.post(base, montarBodyPlano(original, nome, planoId))
        const novo = data as PlanoLeitura
        despacharPilha(itemId, { tipo: 'EMPILHAR', op: { tipo: 'EXCLUIR_PLANO', planoId: novo.id } })
        await atualizarDepois(() => {
          const i = planos.findIndex((p) => p.id === planoId)
          const lista = [...planos]
          lista.splice(i + 1, 0, { ...original, ...novo, nome })
          return lista.map((p, k) => ({ ...p, sequencia: k + 1 }))
        })
      })
    },
    [base, itemId, planos, noLimite, executar, atualizarDepois],
  )

  const excluir = useCallback(
    async (planoId: string): Promise<boolean> => {
      if (!base || !itemId) return false
      const i = planos.findIndex((p) => p.id === planoId)
      if (i < 0) return false
      const plano = planos[i]
      return executar(async () => {
        await api.delete(`${base}/${planoId}`)
        despacharPilha(itemId, {
          tipo: 'EMPILHAR',
          op: { tipo: 'RECRIAR_PLANO', plano, posicaoApos: i > 0 ? planos[i - 1].id : null, ordem: planos.map((p) => p.id) },
        })
        setPlanos(planos.filter((p) => p.id !== planoId).map((p, k) => ({ ...p, sequencia: k + 1 })))
      })
    },
    [base, itemId, planos, executar],
  )

  const mover = useCallback(
    async (planoId: string, direcao: DirecaoMover): Promise<boolean> => {
      if (!base || !itemId) return false
      const anterior = planos.map((p) => p.id)
      const nova = ordemMovida(anterior, planoId, direcao)
      if (!nova) return false
      return executar(async () => {
        await api.patch(`${base}/reordenar`, { ordem: nova })
        despacharPilha(itemId, { tipo: 'EMPILHAR', op: { tipo: 'RESTAURAR_ORDEM', ordem: anterior } })
        setPlanos(ordenarPlanos(planos, nova))
      })
    },
    [base, itemId, planos, executar],
  )

  const desfazer = useCallback(async (): Promise<boolean> => {
    if (!base || !itemId) return false
    const op: OperacaoInversa | null = topo(lerPilha(itemId))
    if (!op) return false
    return executar(async () => {
      switch (op.tipo) {
        case 'EXCLUIR_PLANO': {
          await api.delete(`${base}/${op.planoId}`)
          despacharPilha(itemId, { tipo: 'DESEMPILHAR' })
          await atualizarDepois(() =>
            planos.filter((p) => p.id !== op.planoId).map((p, k) => ({ ...p, sequencia: k + 1 })),
          )
          return
        }
        case 'RESTAURAR_ORDEM': {
          const ordem = op.ordem.filter((id) => planos.some((p) => p.id === id))
          if (ordem.length === planos.length && ordem.length > 0) {
            await api.patch(`${base}/reordenar`, { ordem })
          }
          despacharPilha(itemId, { tipo: 'DESEMPILHAR' })
          setPlanos(ordenarPlanos(planos, ordem))
          return
        }
        case 'RECRIAR_PLANO': {
          const posicaoApos = op.posicaoApos && planos.some((p) => p.id === op.posicaoApos) ? op.posicaoApos : null
          const { data } = await api.post(base, montarBodyPlano(op.plano, op.plano.nome, posicaoApos))
          const novo = data as PlanoLeitura
          const antigo = op.plano.id
          despacharPilha(itemId, { tipo: 'DESEMPILHAR' })
          despacharPilha(itemId, { tipo: 'REMAPEAR', antigo, novo: novo.id })
          // Sem plano anterior, o POST põe o plano no fim: volta a ordem de antes da exclusão.
          const presentes = new Set([...planos.map((p) => p.id), novo.id])
          const ordem = op.ordem.map((id) => (id === antigo ? novo.id : id)).filter((id) => presentes.has(id))
          if (posicaoApos === null && ordem.length === presentes.size && ordem[ordem.length - 1] !== novo.id) {
            try {
              await api.patch(`${base}/reordenar`, { ordem })
            } catch {
              // O plano já foi recriado; a ordem fica como o back gravou.
            }
          }
          await atualizarDepois(() => ordenarPlanos([...planos, { ...op.plano, ...novo }], ordem))
          return
        }
      }
    })
  }, [base, itemId, planos, executar, atualizarDepois])

  const limparErro = useCallback(() => setErroOperacao(null), [])

  return {
    planos,
    carregando,
    erroCarga,
    erroOperacao,
    ocupado,
    noLimite,
    podeDesfazer: pilha.itens.length > 0,
    recarregar,
    incluir,
    copiar,
    excluir,
    mover,
    desfazer,
    limparErro,
  }
}
