import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export type TipoMovimentacaoEstoque =
  | 'ENTRADA_COMPRA' | 'SAIDA_VENDA' | 'AJUSTE_MANUAL' | 'ENTRADA_ESTORNO_VENDA' | 'SAIDA_ESTORNO_COMPRA'

export interface MovimentacaoEstoque {
  id: string
  tipo: TipoMovimentacaoEstoque
  quantidade: number
  saldoAnterior: number
  saldoPosterior: number
  origemId: string | null
  criadoEm: string
}

export interface SaldoProduto { produtoId: string; empresaId: string; quantidade: number; reservado: number }

export const TIPO_LABELS: Record<TipoMovimentacaoEstoque, string> = {
  ENTRADA_COMPRA: 'Entrada por Compra',
  SAIDA_VENDA: 'Saída por Venda',
  AJUSTE_MANUAL: 'Ajuste Manual',
  ENTRADA_ESTORNO_VENDA: 'Entrada por Estorno de Venda',
  SAIDA_ESTORNO_COMPRA: 'Saída por Estorno de Compra',
}

/** Requirement 7.2 — tradução fechada; tipo desconhecido usa fallback sem lançar exceção.
 *  Usa hasOwnProperty para evitar que chaves herdadas de Object.prototype (ex.: "__proto__",
 *  "constructor", "toString") sejam resolvidas incorretamente em vez de cair no fallback. */
export function traduzirTipoMovimentacao(tipo: string): string {
  return Object.prototype.hasOwnProperty.call(TIPO_LABELS, tipo)
    ? TIPO_LABELS[tipo as TipoMovimentacaoEstoque]
    : tipo
}

/** Requirement 7.3 — inclui dataInicio/dataFim somente quando preenchidos, sem chaves extras. */
export function montarParametrosKardex(dataInicio: Date | null, dataFim: Date | null): Record<string, string> {
  const params: Record<string, string> = {}
  if (dataInicio) params.dataInicio = dataInicio.toISOString().split('T')[0]
  if (dataFim) params.dataFim = dataFim.toISOString().split('T')[0]
  return params
}

export function useKardexProduto(produtoId: string | null, filtros: { dataInicio: Date | null; dataFim: Date | null }) {
  const params = montarParametrosKardex(filtros.dataInicio, filtros.dataFim)
  return useQuery<MovimentacaoEstoque[]>({
    queryKey: ['kardex', produtoId, params],
    queryFn: async () => { const { data } = await api.get(`/estoque/kardex/${produtoId}`, { params }); return data },
    enabled: !!produtoId,
  })
}

export function useSaldoProduto(produtoId: string | null) {
  return useQuery<SaldoProduto>({
    queryKey: ['saldo-produto', produtoId],
    queryFn: async () => { const { data } = await api.get(`/estoque/saldo/${produtoId}`); return data },
    enabled: !!produtoId,
  })
}

/** Requirement 7.5 — estado vazio ocorre apenas quando a lista está vazia E não houve erro. */
export function deveExibirEstadoVazioKardex(lista: MovimentacaoEstoque[], ocorreuErro: boolean): boolean {
  return lista.length === 0 && !ocorreuErro
}

/** Requirement 7.6 — estado de falha é disparado sempre que a chamada falhar, independentemente do tamanho da lista;
 *  mutuamente exclusivo com deveExibirEstadoVazioKardex para a mesma combinação de entrada. */
export function deveExibirEstadoFalhaKardex(ocorreuErro: boolean): boolean {
  return ocorreuErro
}

/** Requirement 8.3 — falha no saldo nunca interrompe a exibição do histórico já carregado. */
export function deveManterHistoricoAoFalharSaldo(saldoTeveErro: boolean, historicoTemDados: boolean): boolean {
  return historicoTemDados // independente de saldoTeveErro — a exibição do histórico nunca depende do saldo
}
