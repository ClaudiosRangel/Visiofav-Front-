'use client'

/**
 * useSugestoesProduto — aplica as sugestões da Fase 3 ao escolher o Produto Gráfico
 * em um item NOVO (spec orcamento-grafico-fase3-produto-embalagem, Req 3 e 4).
 *
 * - Busca o produto (tipoEmbalagemId), o tipo de embalagem vinculado e os papéis (PAPEL)
 *   do suporte e aplica `aplicarSugestoes` (funções puras de `sugestoes.ts`), que usa o
 *   mesmo efeito da escolha manual do tipo (`aplicarTipoEmbalagem`).
 * - Só roda uma vez por produto escolhido, só em item novo e só preenche campos vazios.
 * - `origemTipoEmbalagem` fica em estado local (nunca entra no payload).
 * - Falha de catálogo, de produto ou de preços vira aviso e deixa vazios os campos dependentes.
 */

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react'

import { api } from '@/lib/api'
import { produtosApi } from '../../cadastros/_shared/cadastros-graficos.api'
import type { WizardFormData } from '../../novo/page'
import type { CatalogoDoItem } from './catalogo/catalogo.types'
import {
  aplicarSugestoes,
  type EntradaSugestoes,
  type MotivoAvisoPreco,
  type PapelComPreco,
} from './sugestoes'
import { buscarPapeisComPreco } from './sugestoes-api'

export interface AvisosSugestao {
  /** O tipo de embalagem do produto está inativo (não foi preenchido). */
  tipoInativo: boolean
  /** Motivo de o preço por kg não ter sido sugerido (sem papel ou mais de um). */
  preco: MotivoAvisoPreco | null
  /** Mensagens de falha de consulta (catálogo, produto, tipo ou preços). */
  falhas: string[]
}

const AVISOS_VAZIOS: AvisosSugestao = { tipoInativo: false, preco: null, falhas: [] }

export interface UseSugestoesProdutoResultado {
  /** `'PRODUTO'` enquanto o tipo no formulário ainda é o sugerido pelo produto. */
  origemTipoEmbalagem: 'PRODUTO' | null
  avisos: AvisosSugestao
}

interface Params {
  produtoGraficoId: string | null | undefined
  catalogo: CatalogoDoItem | null
  catalogoCarregando: boolean
  catalogoErro: string | null
  /** Item sendo editado; `null`/ausente = item novo. */
  item?: { id?: string | null; calculoGraficoOrigemId?: string | null } | null
  formData: WizardFormData
  setFormData: Dispatch<SetStateAction<WizardFormData>>
}

function vazio(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '')
}

function numeroPositivoOuNulo(v: unknown): number | null {
  if (vazio(v)) return null
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : null
}

export function useSugestoesProduto({
  produtoGraficoId,
  catalogo,
  catalogoCarregando,
  catalogoErro,
  item,
  formData,
  setFormData,
}: Params): UseSugestoesProdutoResultado {
  const [tipoSugeridoId, setTipoSugeridoId] = useState<string | null>(null)
  const [avisos, setAvisos] = useState<AvisosSugestao>(AVISOS_VAZIOS)

  const formRef = useRef(formData)
  formRef.current = formData
  const feitoRef = useRef<string | null>(null)
  const tokenRef = useRef(0)
  const viuCarregandoRef = useRef(false)

  const itemNovo = !item
  const itemPuxado = !!item?.calculoGraficoOrigemId
  const itemSalvo = !!item?.id

  useEffect(() => {
    if (!produtoGraficoId) {
      tokenRef.current += 1
      feitoRef.current = null
      viuCarregandoRef.current = false
      setTipoSugeridoId(null)
      setAvisos(AVISOS_VAZIOS)
      return
    }
    if (feitoRef.current === produtoGraficoId) return
    if (catalogoCarregando) {
      viuCarregandoRef.current = true
      return
    }

    const catalogoDoProduto =
      catalogo && catalogo.produto.produto.id === produtoGraficoId ? catalogo : null
    const falhouCatalogo = !catalogoDoProduto && !!catalogoErro && viuCarregandoRef.current
    if (!catalogoDoProduto && !falhouCatalogo) return

    feitoRef.current = produtoGraficoId
    viuCarregandoRef.current = false
    const token = ++tokenRef.current
    setTipoSugeridoId(null)
    setAvisos(AVISOS_VAZIOS)

    // Item puxado, item salvo ou item que não é novo nunca recebe sugestão.
    if (!itemNovo || itemPuxado || itemSalvo) return

    ;(async () => {
      const falhas: string[] = []
      if (falhouCatalogo) {
        falhas.push(
          'Não foi possível carregar o catálogo do produto. Suporte, gramatura e preço por kg não foram sugeridos.',
        )
      }

      // 1) Vínculo do produto com o tipo de embalagem.
      let vinculo: { id: string; ativo: boolean } | null = null
      let tipoDoVinculo: { id: string } | null = null
      if (vazio(formRef.current.tipoEmbalagemId)) {
        let tipoId: string | null = null
        try {
          const produto = await produtosApi.obter(produtoGraficoId)
          tipoId = produto.tipoEmbalagemId ?? null
        } catch {
          falhas.push('Não foi possível consultar o tipo de embalagem do produto.')
        }
        if (tipoId) {
          try {
            const { data } = await api.get('/orcamento-grafico/tipos-embalagem', {
              params: { status: 'true', limit: 100 },
            })
            const lista: Array<{ id: string }> = Array.isArray(data) ? data : data?.data ?? []
            const achado = lista.find((t) => t.id === tipoId) ?? null
            vinculo = { id: tipoId, ativo: !!achado }
            tipoDoVinculo = achado
          } catch {
            falhas.push('Não foi possível consultar o tipo de embalagem do produto.')
          }
        }
      }

      // 2) Papéis com preço do suporte (só com catálogo carregado e preço ainda vazio).
      const tipoPlano = catalogoDoProduto?.planoFixo?.plano ?? null
      const planoFixo = tipoPlano
        ? {
            suportePadraoId: tipoPlano.suportePadraoId ?? null,
            gramaturaPadrao: numeroPositivoOuNulo(tipoPlano.gramaturaPadrao),
          }
        : null
      let papeis: PapelComPreco[] = []
      const suporteBusca = formRef.current.suporteId || planoFixo?.suportePadraoId || null
      if (catalogoDoProduto && suporteBusca && numeroPositivoOuNulo(formRef.current.precoKg) === null) {
        try {
          // Gramatura (se já conhecida) filtra no servidor; pagina até o fim, sem truncar.
          const gramaturaBusca =
            numeroPositivoOuNulo(formRef.current.gramatura) ?? planoFixo?.gramaturaPadrao ?? null
          papeis = await buscarPapeisComPreco({ suporteId: suporteBusca, gramatura: gramaturaBusca })
        } catch {
          falhas.push('Não foi possível consultar o preço do papel. Informe o preço por kg.')
        }
      }

      if (tokenRef.current !== token) return

      const entrada: EntradaSugestoes<{ id: string }> = {
        flags: { itemNovo, itemPuxado, itemSalvo },
        produtoEscolhidoId: produtoGraficoId,
        vinculo,
        tipoDoVinculo,
        planoFixo,
        papeis,
      }
      const resultado = aplicarSugestoes(formRef.current, entrada)
      setFormData((prev) => aplicarSugestoes(prev, entrada).form)
      setTipoSugeridoId(resultado.tipoSugerido && vinculo ? vinculo.id : null)
      setAvisos({
        tipoInativo: resultado.avisoTipoInativo,
        // Falha na consulta de preços já tem aviso próprio; evita "preço não encontrado" enganoso.
        preco: falhas.some((f) => f.includes('preço do papel')) ? null : resultado.avisoPreco,
        falhas,
      })
    })()
  }, [
    produtoGraficoId, catalogo, catalogoCarregando, catalogoErro,
    itemNovo, itemPuxado, itemSalvo, setFormData,
  ])

  // Trocar ou limpar o campo manualmente remove o texto "sugerido pelo produto".
  useEffect(() => {
    if (tipoSugeridoId && formData.tipoEmbalagemId !== tipoSugeridoId) setTipoSugeridoId(null)
  }, [tipoSugeridoId, formData.tipoEmbalagemId])

  return {
    origemTipoEmbalagem: tipoSugeridoId && formData.tipoEmbalagemId === tipoSugeridoId ? 'PRODUTO' : null,
    avisos,
  }
}
