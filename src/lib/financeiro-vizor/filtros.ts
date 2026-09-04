/**
 * Funções puras de filtragem da listagem de empresas do painel Financeiro Vizor.
 *
 * São determinísticas e sem I/O — a filtragem acontece no cliente sobre a lista
 * já carregada (`GET /empresas`). Cobertas por testes property-based
 * (Correctness Properties 6 e 7 do design).
 *
 * _Requirements: 2.6, 2.7, 2.8_
 */

import type { EmpresaStatusView, StatusFinanceiro } from './types'

/**
 * Opção de filtro por status: um valor específico de `StatusFinanceiro` ou a
 * pseudo-opção `'todos'` (não filtra por status).
 */
export type FiltroStatus = StatusFinanceiro | 'todos'

/** Critérios combinados de filtragem da listagem. */
export interface CriteriosFiltro {
  termo: string
  status: FiltroStatus
}

/**
 * Filtra empresas cujo `nome` contém `termo` como substring, ignorando
 * diferenças entre maiúsculas e minúsculas. Um termo vazio (ou só espaços)
 * retorna todas as empresas.
 *
 * _Requirements: 2.6_
 */
export function filtrarPorNome(
  empresas: EmpresaStatusView[],
  termo: string,
): EmpresaStatusView[] {
  const alvo = termo.trim().toLowerCase()
  if (alvo === '') return empresas
  return empresas.filter((empresa) => empresa.nome.toLowerCase().includes(alvo))
}

/**
 * Filtra empresas por `statusFinanceiro`. Quando `status` é `'todos'`, retorna
 * a lista inteira; caso contrário, retorna apenas as empresas cujo
 * `statusFinanceiro` é exatamente igual ao valor selecionado.
 *
 * _Requirements: 2.7, 2.8_
 */
export function filtrarPorStatus(
  empresas: EmpresaStatusView[],
  status: FiltroStatus,
): EmpresaStatusView[] {
  if (status === 'todos') return empresas
  return empresas.filter((empresa) => empresa.statusFinanceiro === status)
}

/**
 * Aplica os dois filtros em conjunto (nome + status), na mesma semântica das
 * funções individuais. Conveniência para a tela de listagem.
 *
 * _Requirements: 2.6, 2.7, 2.8_
 */
export function filtrarEmpresas(
  empresas: EmpresaStatusView[],
  criterios: CriteriosFiltro,
): EmpresaStatusView[] {
  return filtrarPorStatus(filtrarPorNome(empresas, criterios.termo), criterios.status)
}
