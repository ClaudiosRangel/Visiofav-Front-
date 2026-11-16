'use client'

/**
 * useSelecaoMaterial — fluxo de seleção de material por atividade no editor
 * (Fase 2, tarefas 4.6 e 4.7).
 *
 * - Item salvo: PUT imediato em /cadastros/selecao-material; desmarcar atividade ou
 *   limpar o material chama o DELETE. Depois de cada chamada relê as seleções do item
 *   e reflete as linhas `SELECAO` em `materiaisAcabamento` (nada recalcula aqui).
 * - Item novo: guarda a escolha em `_selecoesPendentes`; `aplicarPendentes` grava tudo
 *   com o id devolvido pelo primeiro salvamento.
 * - Erro 422: guarda a lista de materiais permitidos e NÃO altera a seleção anterior.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { mensagemErroApi, selecaoMaterialApi } from '../../../cadastros/_shared/cadastros-graficos.api'
import type { SelecaoMaterial } from '../../../cadastros/_shared/cadastros-graficos.types'
import type { MaterialAcabamentoItem, WizardFormData } from '../../../novo/page'
import type { CatalogoDoItem, SelecaoPendente } from './catalogo.types'
import {
  chaveSelecao,
  erroDaSelecao,
  mesclarLinhasSelecao,
  selecoesParaLinhas,
  type ErroSelecaoMaterial,
} from './catalogo-puro'
import {
  executarPasse,
  resumirPasse,
  TIMEOUT_PASSE_PADRAO_MS,
  type EstadoSelecao,
  type FalhaSelecao,
  type ResultadoPasse,
} from './passe-selecao-puro'

export interface ControleSelecao {
  /** Seleções já gravadas do item (vazio em item novo). */
  selecoes: SelecaoMaterial[]
  /** Escolhas feitas antes do primeiro salvamento. */
  pendentes: SelecaoPendente[]
  itemSalvo: boolean
  /** Item puxado do acervo: a seleção é só informativa (não altera o preço). */
  itemPuxado: boolean
  /** Atividades com gravação em andamento (chave = `chaveSelecao`). */
  ocupados: Record<string, boolean>
  /** Último erro por atividade (chave = `chaveSelecao`). */
  erros: Record<string, ErroSelecaoMaterial>
  /** Há escolhas gravadas que ainda não entraram no preço do item. */
  sujo: boolean
  escolher: (escolha: SelecaoPendente) => Promise<boolean>
  limpar: (acabamentoId: string, planoId?: string | null) => Promise<void>
  /** Grava pendentes e remoções com o id do item recém-salvo. Devolve as linhas mescladas quando algo mudou. */
  aplicarPendentes: (itemId: string, opcoes?: OpcoesAplicarPendentes) => Promise<ResultadoAplicarPendentes>
  /** Reenvia só as seleções `NAO_GRAVADA` (Req 10.5). */
  tentarNovamente: (itemId: string, opcoes?: Pick<OpcoesAplicarPendentes, 'timeoutMs'>) => Promise<ResultadoAplicarPendentes>
  /** Falhas atuais do passe (atividade + mensagem), uma por chave. */
  falhasPasse: FalhaSelecao[]
  /** Estado por chave (`PENDENTE`, `GRAVADA`, `NAO_GRAVADA`). */
  estadoDe: (chave: string) => EstadoSelecao | null
  /** Quantidade de seleções marcadas como não gravadas. */
  totalNaoGravadas: number
  /** Descarta a marcação de falha de uma chave (usado ao trocar/remover a escolha). */
  descartarFalha: (chave: string) => void
  zerarSujo: () => void
}

export interface OpcoesAplicarPendentes {
  /** Prazo por gravação; padrão 30 s. */
  timeoutMs?: number
  /** Restringe o passe a estas chaves (retentativa). */
  apenasChaves?: string[]
}

export interface ResultadoAplicarPendentes {
  aplicadas: number
  /** Total de falhas (inclui falha de releitura). Compatível com o formato anterior. */
  falhas: number
  linhas: MaterialAcabamentoItem[] | null
  /** Detalhe por chave do passe executado agora. */
  resultado: ResultadoPasse
  /** `true` quando nenhuma seleção do item segue não gravada. */
  podeRecalcular: boolean
}

interface Opcoes {
  itemId: string | null
  itemPuxado: boolean
  formData: WizardFormData
  updateForm: (partial: Partial<WizardFormData>) => void
  catalogo: CatalogoDoItem | null
}

export function useSelecaoMaterial({ itemId, itemPuxado, formData, updateForm, catalogo }: Opcoes): ControleSelecao {
  const [selecoes, setSelecoes] = useState<SelecaoMaterial[]>([])
  const [ocupados, setOcupados] = useState<Record<string, boolean>>({})
  const [erros, setErros] = useState<Record<string, ErroSelecaoMaterial>>({})
  const [sujo, setSujo] = useState(false)
  const [passe, setPasse] = useState<ResultadoPasse>({ gravadas: [], falhas: [] })
  const passeRef = useRef(passe)
  passeRef.current = passe

  /** Aplica uma mudança no estado consolidado do passe (ref atualizada na hora). */
  const atualizarPasse = useCallback((fn: (atual: ResultadoPasse) => ResultadoPasse) => {
    const novo = fn(passeRef.current)
    passeRef.current = novo
    setPasse(novo)
  }, [])

  /** Incorpora o resultado de um passe: o mais recente de cada chave prevalece. */
  const incorporarResultado = useCallback(
    (r: ResultadoPasse) =>
      atualizarPasse((atual) => {
        const resumo = resumirPasse([atual, r])
        return {
          gravadas: Object.entries(resumo.estados)
            .filter(([, e]) => e === 'GRAVADA')
            .map(([chave]) => ({ chave })),
          falhas: resumo.falhas,
        }
      }),
    [atualizarPasse],
  )

  const esquecerChave = useCallback(
    (chave: string) =>
      atualizarPasse((atual) => ({
        gravadas: atual.gravadas.filter((g) => g.chave !== chave),
        falhas: atual.falhas.filter((f) => f.chave !== chave),
      })),
    [atualizarPasse],
  )

  const formRef = useRef(formData)
  formRef.current = formData
  const selecoesRef = useRef(selecoes)
  selecoesRef.current = selecoes

  const pendentes = formData._selecoesPendentes ?? []

  const nomesMateriais = useMemo(() => {
    const mapa = new Map<string, string>()
    const planos = [catalogo?.planoFixo, ...Object.values(catalogo?.porTipoPlano ?? {})]
    for (const plano of planos) {
      for (const atividade of plano?.atividades ?? []) {
        for (const m of atividade.materiais ?? []) mapa.set(m.id, m.nome)
      }
    }
    return mapa
  }, [catalogo])

  const nomesAtividades = useMemo(() => {
    const mapa = new Map<string, string>()
    const adicionar = (lista?: Array<{ id: string; nome: string }>) => {
      for (const a of lista ?? []) mapa.set(a.id, a.nome)
    }
    adicionar(catalogo?.produto?.atividades)
    adicionar(catalogo?.produto?.acondicionamento)
    adicionar(catalogo?.planoFixo?.atividades)
    for (const plano of Object.values(catalogo?.porTipoPlano ?? {})) adicionar(plano?.atividades)
    return mapa
  }, [catalogo])

  useEffect(() => {
    let cancelado = false
    setErros({})
    setSujo(false)
    if (!itemId) {
      setSelecoes([])
      return
    }
    selecaoMaterialApi
      .listar(itemId)
      .then((lista) => {
        if (!cancelado) setSelecoes(Array.isArray(lista) ? lista : [])
      })
      .catch(() => {
        if (!cancelado) setSelecoes([])
      })
    return () => {
      cancelado = true
    }
  }, [itemId])

  const marcarOcupado = (chave: string, valor: boolean) =>
    setOcupados((prev) => ({ ...prev, [chave]: valor }))

  const limparErro = (chave: string) =>
    setErros((prev) => {
      if (!(chave in prev)) return prev
      const { [chave]: _descartado, ...resto } = prev
      return resto
    })

  /** Relê as seleções do item e reflete as linhas SELECAO no formulário. */
  const sincronizar = useCallback(
    async (id: string): Promise<MaterialAcabamentoItem[]> => {
      const lista = await selecaoMaterialApi.listar(id)
      const gravadas = Array.isArray(lista) ? lista : []
      setSelecoes(gravadas)
      const atuais = formRef.current.materiaisAcabamento ?? []
      const linhas = mesclarLinhasSelecao(
        atuais,
        selecoesParaLinhas(gravadas, atuais, (materialId) => nomesMateriais.get(materialId)),
      )
      updateForm({ materiaisAcabamento: linhas })
      return linhas
    },
    [nomesMateriais, updateForm],
  )

  const gravar = (id: string, e: SelecaoPendente, signal?: AbortSignal) =>
    selecaoMaterialApi.salvar(
      {
        itemId: id,
        planoId: e.planoId ?? null,
        acabamentoId: e.acabamentoId,
        materialId: e.materialId,
        restricaoId: e.restricaoId ?? null,
        tipoParam: e.tipoParam,
        param1: e.param1 ?? null,
        param2: e.param2 ?? null,
        gramaturaKgM2: e.gramaturaKgM2 ?? null,
        pecasPorCaixa: e.pecasPorCaixa ?? null,
      },
      signal,
    )

  const escolher = useCallback(
    async (escolha: SelecaoPendente): Promise<boolean> => {
      const chave = chaveSelecao(escolha.acabamentoId, escolha.planoId)
      if (!itemId) {
        const restantes = (formRef.current._selecoesPendentes ?? []).filter(
          (p) => chaveSelecao(p.acabamentoId, p.planoId) !== chave,
        )
        updateForm({ _selecoesPendentes: [...restantes, { ...escolha, remover: false }] })
        limparErro(chave)
        esquecerChave(chave) // escolha trocada volta a PENDENTE
        return true
      }
      marcarOcupado(chave, true)
      try {
        await gravar(itemId, escolha)
        // Escolha antes não gravada (item já criado): sai da lista de pendentes e das falhas.
        const pend = formRef.current._selecoesPendentes ?? []
        const semChave = pend.filter((p) => chaveSelecao(p.acabamentoId, p.planoId) !== chave)
        if (semChave.length !== pend.length) updateForm({ _selecoesPendentes: semChave })
        esquecerChave(chave)
        await sincronizar(itemId)
        limparErro(chave)
        if (!itemPuxado) setSujo(true)
        return true
      } catch (err) {
        // Mantém a seleção anterior intacta; só registra o erro (422 traz os permitidos).
        const erro = erroDaSelecao(err, mensagemErroApi(err, 'Não foi possível gravar a escolha de material.'))
        setErros((prev) => ({ ...prev, [chave]: erro }))
        if (passeRef.current.falhas.some((f) => f.chave === chave)) {
          atualizarPasse((atual) => ({
            ...atual,
            falhas: atual.falhas.map((f) => (f.chave === chave ? { ...f, mensagem: erro.mensagem } : f)),
          }))
        }
        return false
      } finally {
        marcarOcupado(chave, false)
      }
    },
    [itemId, itemPuxado, sincronizar, updateForm, esquecerChave, atualizarPasse],
  )

  const limpar = useCallback(
    async (acabamentoId: string, planoId?: string | null): Promise<void> => {
      const chave = chaveSelecao(acabamentoId, planoId)
      limparErro(chave)
      // Remover a escolha encerra a marcação "não gravada" dela.
      if (passeRef.current.falhas.some((f) => f.chave === chave)) {
        atualizarPasse((atual) => ({ ...atual, falhas: atual.falhas.filter((f) => f.chave !== chave) }))
      }
      const restantes = (formRef.current._selecoesPendentes ?? []).filter(
        (p) => chaveSelecao(p.acabamentoId, p.planoId) !== chave,
      )
      if (restantes.length !== (formRef.current._selecoesPendentes ?? []).length) {
        updateForm({ _selecoesPendentes: restantes })
      }
      if (!itemId) return
      const gravada = selecoesRef.current.some(
        (s) => chaveSelecao(s.acabamentoId, s.planoId) === chave,
      )
      if (!gravada) return
      marcarOcupado(chave, true)
      try {
        await selecaoMaterialApi.remover(itemId, acabamentoId, planoId)
        await sincronizar(itemId)
        if (!itemPuxado) setSujo(true)
      } catch (err) {
        setErros((prev) => ({ ...prev, [chave]: erroDaSelecao(err, mensagemErroApi(err, 'Não foi possível remover a escolha de material.')) }))
      } finally {
        marcarOcupado(chave, false)
      }
    },
    [itemId, itemPuxado, sincronizar, updateForm, atualizarPasse],
  )

  const aplicarPendentes = useCallback(
    async (id: string, opcoes: OpcoesAplicarPendentes = {}): Promise<ResultadoAplicarPendentes> => {
      const todas = formRef.current._selecoesPendentes ?? []
      const permitidas = opcoes.apenasChaves ? new Set(opcoes.apenasChaves) : null
      const lista = todas.filter((p) => !permitidas || permitidas.has(chaveSelecao(p.acabamentoId, p.planoId)))

      const resultado = await executarPasse(
        lista.map((p) => ({
          chave: chaveSelecao(p.acabamentoId, p.planoId),
          atividadeNome: nomesAtividades.get(p.acabamentoId) ?? 'Atividade sem nome',
          executar: (signal: AbortSignal) =>
            p.remover ? selecaoMaterialApi.remover(id, p.acabamentoId, p.planoId, signal) : gravar(id, p, signal),
        })),
        {
          timeoutMs: opcoes.timeoutMs ?? TIMEOUT_PASSE_PADRAO_MS,
          mensagemDoErro: (err) => mensagemErroApi(err, 'Não foi possível gravar a escolha de material.'),
        },
      )
      incorporarResultado(resultado)

      const aplicadas = resultado.gravadas.length
      let falhas = resultado.falhas.length
      let linhas: MaterialAcabamentoItem[] | null = null
      if (aplicadas > 0) {
        // Mantém no formulário só o que não foi gravado (a retentativa reenvia só isso).
        const naoGravadas = new Set(resultado.falhas.map((f) => f.chave))
        updateForm({
          _selecoesPendentes: todas.filter((p) => naoGravadas.has(chaveSelecao(p.acabamentoId, p.planoId)) || (permitidas && !permitidas.has(chaveSelecao(p.acabamentoId, p.planoId)))),
        })
        try {
          linhas = await sincronizar(id)
        } catch {
          falhas += 1
        }
      }
      return {
        aplicadas,
        falhas,
        linhas,
        resultado,
        podeRecalcular: passeRef.current.falhas.length === 0,
      }
    },
    [sincronizar, updateForm, nomesAtividades, incorporarResultado],
  )

  const tentarNovamente = useCallback(
    (id: string, opcoes?: Pick<OpcoesAplicarPendentes, 'timeoutMs'>) =>
      aplicarPendentes(id, {
        timeoutMs: opcoes?.timeoutMs,
        apenasChaves: passeRef.current.falhas.map((f) => f.chave),
      }),
    [aplicarPendentes],
  )

  const estadoDe = useCallback(
    (chave: string): EstadoSelecao | null => {
      if (passe.falhas.some((f) => f.chave === chave)) return 'NAO_GRAVADA'
      if (passe.gravadas.some((g) => g.chave === chave)) return 'GRAVADA'
      if (pendentes.some((p) => chaveSelecao(p.acabamentoId, p.planoId) === chave)) return 'PENDENTE'
      return null
    },
    [passe, pendentes],
  )

  const descartarFalha = useCallback(
    (chave: string) => atualizarPasse((atual) => ({ ...atual, falhas: atual.falhas.filter((f) => f.chave !== chave) })),
    [atualizarPasse],
  )

  const zerarSujo = useCallback(() => setSujo(false), [])

  return {
    selecoes,
    pendentes,
    itemSalvo: !!itemId,
    itemPuxado,
    ocupados,
    erros,
    sujo,
    escolher,
    limpar,
    aplicarPendentes,
    tentarNovamente,
    falhasPasse: passe.falhas,
    estadoDe,
    totalNaoGravadas: passe.falhas.length,
    descartarFalha,
    zerarSujo,
  }
}
