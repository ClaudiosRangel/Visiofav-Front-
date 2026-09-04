'use client'

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'

import { financeiroVizorApi } from '@/hooks/financeiro-vizor/useFinanceiroVizorApi'
import { traduzirErroApi } from '@/lib/financeiro-vizor/erros'
import type {
  FaturaView,
  GerarVencimentosInput,
  GerarVencimentosResultado,
} from '@/lib/financeiro-vizor/types'

/**
 * Mutations das faturas de uma empresa no painel Financeiro Vizor.
 *
 * Reúne as três ações que agem sobre as faturas/vencimentos de uma empresa:
 * baixa, cancelamento e geração de vencimentos em lote. Cada mutation:
 *
 * - No sucesso, invalida a query do detalhe (`['financeiro-vizor', 'empresa', id]`)
 *   para que a lista de faturas exibida reflita o estado atualizado, e mostra
 *   uma notificação verde. A geração de vencimentos detalha o resultado
 *   (`criadas`/`ignoradas`) na mensagem. (Req 4.7, 4.9, 4.11)
 * - No erro, exibe a mensagem amigável de `traduzirErroApi` numa notificação
 *   vermelha, sem alterar o estado exibido. (Req 8.9)
 *
 * Cada mutation expõe seu próprio `isPending`, permitindo desabilitar
 * exatamente o botão que disparou a ação enquanto ela está em andamento — a
 * baixa de uma fatura não desabilita o botão de cancelar de outra, etc.
 * (Req 4.13)
 *
 * _Requirements: 4.7, 4.9, 4.11, 4.13, 8.9._
 */
export function useFaturaMutations(empresaId: string) {
  const queryClient = useQueryClient()

  const invalidarDetalhe = () =>
    queryClient.invalidateQueries({
      queryKey: ['financeiro-vizor', 'empresa', empresaId],
    })

  const darBaixa = useMutation<FaturaView, unknown, { faturaId: string }>({
    mutationFn: ({ faturaId }) => financeiroVizorApi.darBaixa(empresaId, faturaId),
    onSuccess: () => {
      invalidarDetalhe()
      notifications.show({
        title: 'Sucesso',
        message: 'Fatura baixada com sucesso.',
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

  const cancelarFatura = useMutation<FaturaView, unknown, { faturaId: string }>({
    mutationFn: ({ faturaId }) =>
      financeiroVizorApi.cancelarFatura(empresaId, faturaId),
    onSuccess: () => {
      invalidarDetalhe()
      notifications.show({
        title: 'Sucesso',
        message: 'Fatura cancelada com sucesso.',
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

  const gerarVencimentos = useMutation<
    GerarVencimentosResultado,
    unknown,
    GerarVencimentosInput
  >({
    mutationFn: (input) => financeiroVizorApi.gerarVencimentos(empresaId, input),
    onSuccess: (resultado) => {
      invalidarDetalhe()
      const partes = [
        `${resultado.criadas} fatura(s) criada(s).`,
      ]
      if (resultado.ignoradas.length > 0) {
        partes.push(
          `Ignorada(s) (já existentes): ${resultado.ignoradas.join(', ')}.`,
        )
      }
      notifications.show({
        title: 'Vencimentos gerados',
        message: partes.join(' '),
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

  return { darBaixa, cancelarFatura, gerarVencimentos }
}
