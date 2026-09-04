'use client'

import { useQuery } from '@tanstack/react-query'
import { financeiroVizorApi } from './useFinanceiroVizorApi'
import type { EmpresaStatusView } from '@/lib/financeiro-vizor/types'

/** Chave de cache estável da listagem de empresas do painel Financeiro Vizor. */
export const EMPRESAS_FINANCEIRO_QUERY_KEY = ['financeiro-vizor', 'empresas'] as const

/**
 * Busca a listagem de empresas com seu status financeiro (`GET /financeiro-vizor/empresas`)
 * via react-query, alimentando a tela de listagem do painel (Requirements 2.1).
 *
 * Retorna diretamente o resultado de `useQuery` (o consumidor usa `data`, `isLoading`,
 * `isError`, etc.), seguindo o mesmo padrão dos demais hooks de query do projeto. O
 * `queryFn` delega à camada de acesso (`financeiroVizorApi.listarEmpresas`), que já
 * desembrulha `response.data` e injeta o Authorization pelo interceptor do `@/lib/api`.
 */
export function useEmpresasFinanceiro() {
  return useQuery<EmpresaStatusView[]>({
    queryKey: EMPRESAS_FINANCEIRO_QUERY_KEY,
    queryFn: () => financeiroVizorApi.listarEmpresas(),
  })
}
