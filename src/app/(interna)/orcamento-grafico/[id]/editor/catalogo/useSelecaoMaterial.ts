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
  aplicarPendentes: (itemId: string) => Promise<{ aplicadas: number; falhas: number; linhas: MaterialAcabamentoItem[] | null }>
  zerarSujo: () => void
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

  const gravar = (id: string, e: SelecaoPendente) =>
    selecaoMaterialApi.salvar({
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
    })

  const escolher = useCallback(
    async (escolha: SelecaoPendente): Promise<boolean> => {
      const chave = chaveSelecao(escolha.acabamentoId, escolha.planoId)
      if (!itemId) {
        const restantes = (formRef.current._selecoesPendentes ?? []).filter(
          (p) => chaveSelecao(p.acabamentoId, p.planoId) !== chave,
        )
        updateForm({ _selecoesPendentes: [...restantes, { ...escolha, remover: false }] })
        limparErro(chave)
        return true
      }
      marcarOcupado(chave, true)
      try {
        await gravar(itemId, escolha)
        await sincronizar(itemId)
        limparErro(chave)
        if (!itemPuxado) setSujo(true)
        return true
      } catch (err) {
        // Mantém a seleção anterior intacta; só registra o erro (422 traz os permitidos).
        setErros((prev) => ({ ...prev, [chave]: erroDaSelecao(err, mensagemErroApi(err, 'Não foi possível gravar a escolha de material.')) }))
        return false
      } finally {
        marcarOcupado(chave, false)
      }
    },
    [itemId, itemPuxado, sincronizar, updateForm],
  )

  const limpar = useCallback(
    async (acabamentoId: string, planoId?: string | null): Promise<void> => {
      const chave = chaveSelecao(acabamentoId, planoId)
      limparErro(chave)
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
    [itemId, itemPuxado, sincronizar, updateForm],
  )

  const aplicarPendentes = useCallback(
    async (id: string) => {
      const lista = formRef.current._selecoesPendentes ?? []
      let aplicadas = 0
      let falhas = 0
      for (const p of lista) {
        try {
          if (p.remover) await selecaoMaterialApi.remover(id, p.acabamentoId, p.planoId)
          else await gravar(id, p)
          aplicadas += 1
        } catch {
          falhas += 1
        }
      }
      if (aplicadas === 0) return { aplicadas, falhas, linhas: null }
      try {
        const linhas = await sincronizar(id)
        updateForm({ _selecoesPendentes: [] })
        return { aplicadas, falhas, linhas }
      } catch {
        return { aplicadas, falhas: falhas + 1, linhas: null }
      }
    },
    [sincronizar, updateForm],
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
    zerarSujo,
  }
}
