'use client'

import { useQuery } from '@tanstack/react-query'

import { financeiroVizorApi } from '@/hooks/financeiro-vizor/useFinanceiroVizorApi'
import type { DetalheCobranca } from '@/lib/financeiro-vizor/types'

/**
 * Query do detalhe de cobrança de uma empresa no painel Financeiro Vizor.
 *
 * Busca `GET /financeiro-vizor/empresas/:id` (via `financeiroVizorApi.obterDetalhe`),
 * retornando o contrato, os 6 preços por módulo, os totais, os dias em atraso e a
 * lista de faturas (`DetalheCobranca`, que já inclui `faturas`). O react-query
 * cuida do cache; as mutations do módulo (contrato, faturas, status) invalidam
 * esta mesma `queryKey` no sucesso para refletir o estado atualizado.
 *
 * A query só dispara quando há `id` (`enabled: !!id`), evitando uma chamada
 * inútil antes de o parâmetro de rota estar disponível.
 *
 * _Requirements: 3.1 (contrato/preços), 4.1 (totais, dias em atraso e faturas)._
 */
export function useDetalheEmpresa(id: string) {
  return useQuery<DetalheCobranca>({
    queryKey: ['financeiro-vizor', 'empresa', id],
    queryFn: () => financeiroVizorApi.obterDetalhe(id),
    enabled: !!id,
  })
}
