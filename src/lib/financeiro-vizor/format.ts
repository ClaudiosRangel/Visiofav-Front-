/**
 * Funções puras de formatação para exibição no painel Financeiro Vizor.
 *
 * São determinísticas e sem I/O — cobertas por testes property-based
 * (Correctness Properties do design, ex.: Property 9 para `formatarBRL`).
 */

/** Formatter reutilizável para não recriar `Intl.NumberFormat` a cada chamada. */
const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Formata um valor numérico como moeda em reais (pt-BR), sempre com duas casas
 * decimais. Ex.: `1234.5` → `"R$ 1.234,50"`.
 */
export function formatarBRL(valor: number): string {
  const numero = Number.isFinite(valor) ? valor : 0
  return BRL.format(numero)
}

/**
 * Converte uma competência no formato "YYYY-MM" para "MM/YYYY".
 * Ex.: `"2026-03"` → `"03/2026"`. Se a entrada não estiver no formato
 * esperado, é devolvida sem alteração (fail-safe para exibição).
 */
export function formatarCompetencia(competencia: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(competencia)
  if (!match) return competencia
  const [, ano, mes] = match
  return `${mes}/${ano}`
}

/**
 * Formata uma data ISO (ex.: "2026-03-15" ou "2026-03-15T00:00:00.000Z") como
 * "DD/MM/YYYY". Usa os componentes UTC da data para evitar deslocamento de dia
 * por fuso horário. Se a data for inválida, devolve a string original.
 */
export function formatarData(iso: string): string {
  if (!iso) return iso
  const data = new Date(iso)
  if (Number.isNaN(data.getTime())) return iso
  const dia = String(data.getUTCDate()).padStart(2, '0')
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0')
  const ano = data.getUTCFullYear()
  return `${dia}/${mes}/${ano}`
}
