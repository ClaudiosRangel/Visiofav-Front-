/**
 * Formatação pt-BR do Fechamento (funções puras, só exibição).
 * - Valor Unitário: 5 casas decimais.
 * - Margem e C.Marg.: 2 casas decimais, com "%".
 * - Valor Total: R$ com 2 casas.
 * Reaproveita o que já existe em `formatadores.ts` para Margem/C.Marg./Valor Total.
 */

import { formatarMoeda, formatarPercentual2 } from './formatadores'

export { formatarMoeda as formatarValorTotal, formatarPercentual2 as formatarMargem, formatarPercentual2 as formatarCMarg }

const SEM_VALOR = '—'

const nfUnitario = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 5, maximumFractionDigits: 5 })

/** 3,77101 (5 casas, sem símbolo de moeda). */
export function formatarValorUnitario(n: number | null | undefined): string {
  return n == null || !Number.isFinite(n) ? SEM_VALOR : nfUnitario.format(n)
}
