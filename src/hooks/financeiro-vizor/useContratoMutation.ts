'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'

import { financeiroVizorApi } from '@/hooks/financeiro-vizor/useFinanceiroVizorApi'
import { traduzirErroApi } from '@/lib/financeiro-vizor/erros'
import type { DetalheCobranca, SalvarContratoInput } from '@/lib/financeiro-vizor/types'

/**
 * Mutation de salvar (upsert) o contrato de cobrança de uma empresa no painel
 * Financeiro Vizor.
 *
 * Envia `PUT /financeiro-vizor/empresas/:id/contrato` via
 * `financeiroVizorApi.salvarContrato`. No sucesso:
 * - invalida a query do detalhe (`['financeiro-vizor', 'empresa', id]`) para a
 *   tela refletir o estado retornado pela API (totais, preços, etc.);
 * - exibe notificação verde de sucesso. (Req 3.5, 3.9, 8.9)
 *
 * No erro, exibe notificação vermelha com a mensagem amigável de
 * `traduzirErroApi` — os dados do formulário são preservados pelo componente
 * (o form não é resetado antes de um sucesso confirmado). (Req 3.10, 8.9)
 *
 * O componente `ContratoForm` desabilita o botão salvar enquanto `isPending`
 * (Req 3.9), lendo o estado exposto por esta mutation.
 *
 * _Requirements: 3.5, 3.9, 3.10, 8.9._
 */
export function useContratoMutation(empresaId: string) {
  const queryClient = useQueryClient()

  return useMutation<DetalheCobranca, unknown, SalvarContratoInput>({
    mutationFn: (input: SalvarContratoInput) =>
      financeiroVizorApi.salvarContrato(empresaId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['financeiro-vizor', 'empresa', empresaId],
      })
      notifications.show({
        title: 'Contrato salvo',
        message: 'O contrato foi salvo com sucesso.',
        color: 'green',
      })
    },
    onError: (error) => {
      notifications.show({
        title: 'Erro ao salvar contrato',
        message: traduzirErroApi(error),
        color: 'red',
      })
    },
  })
}
