/**
 * reaplicar-layout — funções PURAS para a troca do Produto Gráfico no item (R7.8).
 *
 * Convenção do formulário: cada campo do layout (`CampoFormato`/`CampoPlanoUnico`)
 * é uma chave do objeto `form`. Dimensões simples são valores escalares; os formatos
 * compostos (`formatoFinal`, `formatoFechado`, `formatoAberto`) são `{ largura, altura }`.
 * Chaves fora desse vocabulário (descrição, tributação, tiragens...) nunca são tocadas.
 *
 * Decisão: os campos que ficam ocultos PERMANECEM no `form` (o usuário pode voltar ao
 * produto anterior sem perder o que digitou), mas são listados em `ocultos` e
 * `camposParaGravar` os descarta antes de montar o payload.
 */

import type { CampoFormato, CampoPlanoUnico, LayoutItem } from './resolver-layout-item'

export type CampoLayout = CampoFormato | CampoPlanoUnico

/** Todos os campos que o layout controla (vocabulário), em ordem canônica. */
export const CAMPOS_FORMATO_CONHECIDOS: readonly CampoFormato[] = [
  'comprimento',
  'largura',
  'altura',
  'abaCola',
  'abaFechamento',
  'alturaTampa',
  'formatoFinal',
  'formatoFechado',
  'formatoAberto',
  'numeroSanfonas',
  'aba',
  'numeroPaginas',
]

export const CAMPOS_PLANO_UNICO_CONHECIDOS: readonly CampoPlanoUnico[] = [
  'cores',
  'processoImpressao',
  'coberturaTinta',
  'fabricante',
  'suporte',
  'fornecido',
  'microondulado',
  'fibra',
  'montagem',
  'formatoCorte',
  'ajusteCorteMicro',
]

const CAMPOS_CONHECIDOS: readonly CampoLayout[] = [...CAMPOS_FORMATO_CONHECIDOS, ...CAMPOS_PLANO_UNICO_CONHECIDOS]

/** Formatos compostos que recebem o formato padrão do cadastro, na ordem de preferência. */
const CAMPOS_COM_FORMATO_PADRAO: readonly CampoFormato[] = ['formatoFinal', 'formatoFechado']

export type FormLayout = Record<string, unknown>

export interface ResultadoReaplicar<F extends FormLayout> {
  form: F
  /** Campos do vocabulário do layout que estão ocultos e ainda guardam valor. */
  ocultos: CampoLayout[]
}

function camposVisiveis(layout: LayoutItem): ReadonlySet<CampoLayout> {
  return new Set<CampoLayout>([...layout.formato.campos, ...layout.planoUnico.campos])
}

function escalarVazio(v: unknown): boolean {
  if (v === undefined || v === null) return true
  if (typeof v === 'string') return v.trim() === '' || Number(v.replace(',', '.')) === 0
  if (typeof v === 'number') return v === 0 || Number.isNaN(v)
  return false
}

/** Vazio = ausente, string vazia, 0, ou composto `{ largura, altura }` sem nenhuma dimensão. */
export function campoVazio(v: unknown): boolean {
  if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>
    return escalarVazio(o.largura) && escalarVazio(o.altura)
  }
  if (Array.isArray(v)) return v.length === 0
  if (typeof v === 'boolean') return false
  return escalarVazio(v)
}

function listarOcultos(form: FormLayout, layout: LayoutItem): CampoLayout[] {
  const visiveis = camposVisiveis(layout)
  return CAMPOS_CONHECIDOS.filter(
    (c) => !visiveis.has(c) && Object.prototype.hasOwnProperty.call(form, c) && !campoVazio(form[c]),
  )
}

/**
 * Troca de produto (R7.8): mantém os valores dos campos que continuam visíveis
 * (nunca sobrescreve), preenche o formato padrão do novo produto SOMENTE no campo de
 * formato composto vazio (Formato Final; na falta dele, Formato Fechado) e devolve
 * os campos que ficaram ocultos com valor. Não altera o `form` recebido.
 */
export function reaplicarLayoutAoTrocarProduto<F extends FormLayout>(
  form: F,
  layoutNovo: LayoutItem,
): ResultadoReaplicar<F> {
  const proximo: FormLayout = { ...form }
  const padrao = layoutNovo.formato.padrao
  if (padrao) {
    const alvo = CAMPOS_COM_FORMATO_PADRAO.find((c) => layoutNovo.formato.campos.includes(c))
    if (alvo && campoVazio(proximo[alvo])) {
      proximo[alvo] = { largura: padrao.largura, altura: padrao.altura }
    }
  }
  return { form: proximo as F, ocultos: listarOcultos(proximo, layoutNovo) }
}

/**
 * Descarta do form os campos do vocabulário que o layout oculta. Usar antes de montar
 * o payload de gravação. Chaves fora do vocabulário passam intactas.
 */
export function camposParaGravar<F extends FormLayout>(form: F, layout: LayoutItem): Partial<F> {
  const visiveis = camposVisiveis(layout)
  const conhecidos = new Set<string>(CAMPOS_CONHECIDOS)
  const saida: FormLayout = {}
  for (const [chave, valor] of Object.entries(form)) {
    if (conhecidos.has(chave) && !visiveis.has(chave as CampoLayout)) continue
    saida[chave] = valor
  }
  return saida as Partial<F>
}
