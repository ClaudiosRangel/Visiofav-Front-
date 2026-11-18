/**
 * entrada-layout — monta a `EntradaLayoutItem` a partir do catálogo do Produto Gráfico.
 * Função PURA (sem React/rede). Só repassa atributos do cadastro: nunca nome nem código.
 */

import type { CatalogoProduto } from '../../cadastros/_shared/cadastros-graficos.types'
import type { EntradaLayoutItem } from './resolver-layout-item'

function numeroOuNulo(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Booleano tri-estado: só `true`/`false` valem; qualquer outro valor vira null (= cadastro não informa). */
function triEstado(v: unknown): boolean | null {
  return v === true ? true : v === false ? false : null
}

export function entradaLayoutDoCatalogo(catalogo: Pick<CatalogoProduto, 'produto' | 'planos'>): EntradaLayoutItem {
  const p = catalogo.produto
  return {
    produto: {
      modoFormato: p.modoFormato ?? null,
      formatoPadraoLargura: numeroOuNulo(p.formatoPadraoLargura),
      formatoPadraoAltura: numeroOuNulo(p.formatoPadraoAltura),
      exibeRestricoes: p.exibeRestricoes === true,
      exibeInformacoesComplementares: p.exibeInformacoesComplementares === true,
      semImpressao: p.semImpressao === true,
      possuiAlturaTampa: triEstado(p.possuiAlturaTampa),
    },
    tiposPlano: (catalogo.planos ?? []).map((t) => ({
      id: t.id,
      fixo: t.fixo === true,
      fibraDefault: t.fibraDefault ?? null,
      previsao: {
        capaExterna: triEstado(t.prevCapaExterna),
        microondulado: triEstado(t.prevMicroondulado),
        capaInterna: triEstado(t.prevCapaInterna),
        fibra: triEstado(t.prevFibra),
      },
    })),
  }
}

/**
 * Chave estável dos atributos que influenciam o layout. Dois produtos com a mesma chave
 * produzem o mesmo layout (usada para memoizar e manter a referência entre recargas).
 */
export function chaveDaEntradaLayout(entrada: EntradaLayoutItem): string {
  return JSON.stringify(entrada)
}
