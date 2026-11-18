/**
 * Formatação pt-BR da Tela_Orcamento. Só exibição: nenhum valor é recalculado.
 */

const nfInteiro = new Intl.NumberFormat('pt-BR')
const nfMoeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const nfPercentual2 = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const nfPercentualLivre = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 })

const SEM_VALOR = '—'

export function formatarInteiro(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? SEM_VALOR : nfInteiro.format(n)
}

/** "6.000" ou "1.000 / 2.000 / 5.000"; lista vazia ⇒ "—". */
export function formatarTiragens(tiragens: readonly number[] | null | undefined): string {
  if (!tiragens || tiragens.length === 0) return SEM_VALOR
  return tiragens.map((t) => nfInteiro.format(t)).join(' / ')
}

/** R$ 1.234,56 */
export function formatarMoeda(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? SEM_VALOR : nfMoeda.format(n)
}

/** 12,50% (duas casas, para Margem e C.Marg.). */
export function formatarPercentual2(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? SEM_VALOR : `${nfPercentual2.format(n)}%`
}

/** Percentual como veio do back, sem forçar casas (comissões). */
export function formatarPercentualOriginal(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? SEM_VALOR : `${nfPercentualLivre.format(n)}%`
}

/** dd/mm/aaaa a partir de "aaaa-mm-dd..." (usa a parte da data, sem conversão de fuso). */
export function formatarData(valor: string | null | undefined): string {
  if (!valor) return SEM_VALOR
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(valor)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  const d = new Date(valor)
  if (Number.isNaN(d.getTime())) return SEM_VALOR
  return d.toLocaleDateString('pt-BR')
}

export function pluralizar(qtd: number, singular: string, plural: string): string {
  return qtd === 1 ? singular : plural
}
