/**
 * Camada de acesso à API do Financeiro Operacional (Bloco F1).
 *
 * Usa a instância Axios do projeto (`@/lib/api`), que injeta o Authorization
 * do authStorage e trata 401/refresh. Prefixo `/financeiro` sobre
 * `NEXT_PUBLIC_API_URL`. Todos os endpoints exigem o módulo FINANCEIRO.
 */
import { api } from '@/lib/api'

const BASE = '/financeiro'

export interface ContaFinanceira {
  id: string
  tipo: 'CAIXA' | 'BANCO' | 'APLICACAO'
  nome: string
  banco?: string | null
  agencia?: string | null
  conta?: string | null
  saldoInicial: string | number
  saldoAtual: number
  status: boolean
}

export interface CategoriaFinanceira {
  id: string
  tipo: 'RECEITA' | 'DESPESA'
  codigo: string
  nome: string
  paiId?: string | null
  status: boolean
}

export interface CentroCusto {
  id: string
  codigo: string
  nome: string
  status: boolean
}

export interface BucketFluxo {
  inicio: string
  fim: string
  saldoInicial: number
  entradas: number
  saidas: number
  saldoFinal: number
}

export type ResumoAging = Record<'A_VENCER' | 'D1_30' | 'D31_60' | 'D61_90' | 'D90_MAIS', number>

export interface LinhaDre {
  categoriaId: string | null
  tipo: 'RECEITA' | 'DESPESA'
  total: number
}

export const financeiroApi = {
  // Contas
  listarContas: () => api.get<ContaFinanceira[]>(`${BASE}/contas`).then((r) => r.data),
  criarConta: (input: Partial<ContaFinanceira>) => api.post(`${BASE}/contas`, input).then((r) => r.data),
  inativarConta: (id: string) => api.patch(`${BASE}/contas/${id}/inativar`).then((r) => r.data),
  excluirConta: (id: string) => api.delete(`${BASE}/contas/${id}`).then((r) => r.data),
  transferir: (input: { contaOrigemId: string; contaDestinoId: string; valor: number; data: string; descricao?: string }) =>
    api.post(`${BASE}/contas/transferir`, input).then((r) => r.data),

  // Categorias
  listarCategorias: () => api.get<CategoriaFinanceira[]>(`${BASE}/categorias`).then((r) => r.data),
  criarCategoria: (input: { tipo: string; codigo: string; nome: string; paiId?: string }) =>
    api.post(`${BASE}/categorias`, input).then((r) => r.data),

  // Centros de custo
  listarCentrosCusto: () => api.get<CentroCusto[]>(`${BASE}/centros-custo`).then((r) => r.data),
  criarCentroCusto: (input: { codigo: string; nome: string }) => api.post(`${BASE}/centros-custo`, input).then((r) => r.data),

  // Lançamentos
  listarLancamentos: (contaFinanceiraId?: string) =>
    api.get(`${BASE}/lancamentos`, { params: contaFinanceiraId ? { contaFinanceiraId } : {} }).then((r) => r.data),
  criarLancamento: (input: any) => api.post(`${BASE}/lancamentos`, input).then((r) => r.data),
  estornarLancamento: (id: string) => api.patch(`${BASE}/lancamentos/${id}/estornar`).then((r) => r.data),

  // Conciliação
  importarOfx: (contaFinanceiraId: string, conteudo: string) =>
    api.post(`${BASE}/conciliacao/importar-ofx`, { contaFinanceiraId, conteudo }).then((r) => r.data),
  sugestoesConciliacao: (contaFinanceiraId: string) =>
    api.get(`${BASE}/conciliacao/sugestoes`, { params: { contaFinanceiraId } }).then((r) => r.data),
  conciliar: (linhaId: string, tituloId: string, tipo: 'RECEBER' | 'PAGAR') =>
    api.post(`${BASE}/conciliacao/conciliar`, { linhaId, tituloId, tipo }).then((r) => r.data),
  desfazerConciliacao: (id: string) => api.post(`${BASE}/conciliacao/${id}/desfazer`).then((r) => r.data),

  // Fechamento
  listarFechamentos: () => api.get(`${BASE}/fechamentos`).then((r) => r.data),
  fecharPeriodo: (competencia: string) => api.post(`${BASE}/fechamentos/fechar`, { competencia }).then((r) => r.data),
  reabrirPeriodo: (competencia: string, motivo: string) =>
    api.post(`${BASE}/fechamentos/reabrir`, { competencia, motivo }).then((r) => r.data),

  // Relatórios
  fluxoCaixa: (params: { de: string; ate: string; granularidade?: string; contaFinanceiraId?: string }) =>
    api.get<BucketFluxo[]>(`${BASE}/fluxo-caixa`, { params }).then((r) => r.data),
  aging: () => api.get<ResumoAging>(`${BASE}/aging`).then((r) => r.data),
  dre: (params: { de: string; ate: string }) => api.get<LinhaDre[]>(`${BASE}/dre`, { params }).then((r) => r.data),
}

export function formatarBRL(v: number): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
