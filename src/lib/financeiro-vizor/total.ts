/**
 * Cálculo puro do Total Mensal do contrato no painel Financeiro Vizor.
 *
 * Extraído do `ContratoForm` para ser determinístico e testável sem I/O nem
 * renderização — é a lógica coberta pela Correctness Property 1 do design
 * (o Total Mensal exibido é a soma exata dos preços do form e altera pela mesma
 * diferença ao mudar um preço).
 *
 * A soma é feita sobre os valores tal como estão no estado do formulário
 * (mapa `modulo -> preco`), sem qualquer transformação de negócio — a
 * autoridade final continua sendo o backend.
 */

import type { Modulo } from './types'
import { MODULOS } from './types'

/** Mapa de preço por módulo, tal como mantido no estado do `ContratoForm`. */
export type PrecosPorModulo = Record<Modulo, number>

/**
 * Soma os preços dos seis módulos, ignorando valores não finitos (tratados
 * como 0) para nunca propagar `NaN`/`Infinity` ao total exibido.
 *
 * Property 1 (Validates: Requirements 3.4).
 */
export function calcularTotalForm(precos: PrecosPorModulo): number {
  return MODULOS.reduce((total, modulo) => {
    const preco = precos[modulo]
    return total + (Number.isFinite(preco) ? preco : 0)
  }, 0)
}
