/**
 * Financeiro Operacional F1 (frontend) — funções puras de formatação.
 * Sem I/O, testáveis isoladamente.
 */

export function formatarBRL(v: number): string {
  if (!Number.isFinite(v)) return 'R$ 0,00'
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

/** "2026-06" → "06/2026". Retorna a entrada se não casar o formato. */
export function formatarCompetencia(competencia: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(competencia)
  if (!m) return competencia
  return `${m[2]}/${m[1]}`
}

/** Data ISO → "dd/mm/aaaa" (usa UTC para estabilidade). */
export function formatarData(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const dia = String(d.getUTCDate()).padStart(2, '0')
  const mes = String(d.getUTCMonth() + 1).padStart(2, '0')
  return `${dia}/${mes}/${d.getUTCFullYear()}`
}

export const AGING_LABELS: Record<string, string> = {
  A_VENCER: 'A vencer',
  D1_30: '1–30 dias',
  D31_60: '31–60 dias',
  D61_90: '61–90 dias',
  D90_MAIS: '90+ dias',
}

export const TIPO_CONTA_LABELS: Record<string, string> = {
  CAIXA: 'Caixa',
  BANCO: 'Banco',
  APLICACAO: 'Aplicação',
}
