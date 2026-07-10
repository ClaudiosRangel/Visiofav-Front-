/**
 * Requirement 1.3, 1.4, 1.6 — decisão é exclusivamente sobre o valor vindo da API.
 * Retorna `true` se e somente se o valor, após `trim()`, tem comprimento maior que zero.
 */
export function deveExibirAlertaDivergencia(divergenciaTransporte: string | null | undefined): boolean {
  return !!divergenciaTransporte && divergenciaTransporte.trim().length > 0
}

/**
 * Requirement 1.7, 1.8 — cada campo de transporte (`transportadoraUf`/`transportadoraRntc`)
 * é decidido de forma independente, com a mesma lógica de `deveExibirAlertaDivergencia`.
 */
export function deveExibirCampoTransporte(valor: string | null | undefined): boolean {
  return !!valor && valor.trim().length > 0
}
