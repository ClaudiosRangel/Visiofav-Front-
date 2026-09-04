'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'

import { financeiroVizorApi } from '@/hooks/financeiro-vizor/useFinanceiroVizorApi'
import { EMPRESAS_FINANCEIRO_QUERY_KEY } from '@/hooks/financeiro-vizor/useEmpresasFinanceiro'
import { traduzirErroApi } from '@/lib/financeiro-vizor/erros'
import type {
  EmpresaStatusView,
  StatusEmpresaResultado,
} from '@/lib/financeiro-vizor/types'

/**
 * Mutations de status da empresa no painel Financeiro Vizor: reativar e inativar.
 *
 * As duas ações são sempre explícitas do SUPER_ADMIN (Req 5). Cada mutation:
 *
 * - No sucesso, atualiza o `statusFinanceiro` exibido conforme a resposta da API
 *   (`StatusEmpresaResultado`): grava o novo status diretamente no cache da
 *   listagem (`['financeiro-vizor', 'empresas']`) via `setQueryData` para refletir
 *   de imediato, e invalida tanto a listagem quanto o detalhe da empresa
 *   (`['financeiro-vizor', 'empresa', id]`) para reconsultar a fonte de verdade.
 *   Mostra uma notificação verde. (Req 5.2, 5.4)
 * - No erro, exibe a mensagem amigável de `traduzirErroApi` numa notificação
 *   vermelha e NÃO altera nenhum estado exibido — o `statusFinanceiro` anterior é
 *   preservado (não há mutação otimista; só escrevemos no cache no sucesso).
 *   (Req 5.7)
 *
 * Cada mutation expõe seu próprio `isPending`, usado pelo componente para
 * desabilitar o botão de confirmação enquanto a requisição está em andamento
 * (Req 5.6).
 *
 * IMPORTANTE (Req 5.5): a reativação é uma ação independente. Estas mutations
 * NÃO são invocadas por nenhuma outra ação (em particular, a baixa de fatura em
 * `useFaturaMutations` não chama `reativar`) — dar baixa não reativa a empresa
 * automaticamente.
 *
 * _Requirements: 5.2, 5.4, 5.5, 5.6, 5.7, 8.9._
 */
export function useStatusMutations(empresaId: string) {
  const queryClient = useQueryClient()

  /**
   * Atualiza o `statusFinanceiro` da empresa no cache da listagem (se presente)
   * e invalida listagem + detalhe para reconsultar a API. Chamado somente no
   * sucesso, de modo que um erro nunca altera o status exibido.
   */
  const aplicarResultado = (resultado: StatusEmpresaResultado) => {
    queryClient.setQueryData<EmpresaStatusView[]>(
      EMPRESAS_FINANCEIRO_QUERY_KEY,
      (atual) =>
        atual?.map((empresa) =>
          empresa.empresaId === resultado.empresaId
            ? { ...empresa, statusFinanceiro: resultado.statusFinanceiro }
            : empresa,
        ),
    )
    queryClient.invalidateQueries({ queryKey: EMPRESAS_FINANCEIRO_QUERY_KEY })
    queryClient.invalidateQueries({
      queryKey: ['financeiro-vizor', 'empresa', empresaId],
    })
  }

  const reativar = useMutation<StatusEmpresaResultado, unknown, void>({
    mutationFn: () => financeiroVizorApi.reativar(empresaId),
    onSuccess: (resultado) => {
      aplicarResultado(resultado)
      notifications.show({
        title: 'Empresa reativada',
        message: 'A empresa foi reativada e voltou ao status ATIVO.',
        color: 'green',
      })
    },
    onError: (error) => {
      notifications.show({
        title: 'Erro',
        message: traduzirErroApi(error),
        color: 'red',
      })
    },
  })

  const inativar = useMutation<StatusEmpresaResultado, unknown, void>({
    mutationFn: () => financeiroVizorApi.inativar(empresaId),
    onSuccess: (resultado) => {
      aplicarResultado(resultado)
      notifications.show({
        title: 'Empresa inativada',
        message: 'A empresa foi inativada e teve o acesso aos módulos impedido.',
        color: 'green',
      })
    },
    onError: (error) => {
      notifications.show({
        title: 'Erro',
        message: traduzirErroApi(error),
        color: 'red',
      })
    },
  })

  return { reativar, inativar }
}
