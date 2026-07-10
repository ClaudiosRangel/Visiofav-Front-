/**
 * Requirement 2.2, 2.3, 2.5 — sempre reavaliada a partir do dado fresco da API (produtoCompleto).
 * Retorna `true` se e somente se o valor, após `trim()`, tem comprimento maior que zero.
 */
export function deveExibirAlertaEnriquecimentoSku(motivo: string | null | undefined): boolean {
  return !!motivo && motivo.trim().length > 0
}

export interface ItemPendenteXml {
  cProd: string
  xProd: string
  motivo: string
}

/**
 * Requirement 3.1, 3.2 — array vazio ou ausente (undefined/null) SHALL produzir false.
 */
export function deveExibirSecaoItensPendentes(itensPendentes: ItemPendenteXml[] | null | undefined): boolean {
  return Array.isArray(itensPendentes) && itensPendentes.length > 0
}
