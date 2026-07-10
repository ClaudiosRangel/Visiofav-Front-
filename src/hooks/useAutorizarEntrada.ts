'use client'

import { useState, useCallback } from 'react'
import { useMutation } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'

export type AcaoAutorizarEntrada =
  | 'ABRIR_MODAL_CREDENCIAIS'
  | 'ERRO_CREDENCIAIS_INVALIDAS'
  | 'SUCESSO'
  | 'ERRO_GENERICO'

/**
 * Requirements 10.2, 10.4, 10.5, 11.1 — decisão pura da ação a tomar a partir do
 * status HTTP retornado por POST /portaria/autorizar-entrada/:id e de se a
 * tentativa já incluía credenciais de Supervisor no corpo.
 *
 * - status 2xx                                 → SUCESSO
 * - status 422                                 → ABRIR_MODAL_CREDENCIAIS (sempre, independente de já ter credenciais)
 * - status 401 E a tentativa tinha credenciais → ERRO_CREDENCIAIS_INVALIDAS (mantém modal aberto)
 * - qualquer outro status                       → ERRO_GENERICO
 */
export function decidirAcaoAutorizarEntrada(status: number, tinhaCredenciais: boolean): AcaoAutorizarEntrada {
  if (status >= 200 && status < 300) return 'SUCESSO'
  if (status === 422) return 'ABRIR_MODAL_CREDENCIAIS'
  if (status === 401 && tinhaCredenciais) return 'ERRO_CREDENCIAIS_INVALIDAS'
  return 'ERRO_GENERICO'
}

interface UseAutorizarEntradaOptions {
  onInvalidateQueries?: () => void
}

/**
 * Hook reutilizado por ambos os call-sites da Tela_Portaria (ação rápida na
 * tabela de agendamentos e botão do resultado de busca por placa) — garante
 * tratamento idêntico de 422/401 em ambos (Requirement 11.2).
 */
export function useAutorizarEntrada(options?: UseAutorizarEntradaOptions) {
  const [modalAberto, setModalAberto] = useState(false)
  const [agendamentoIdPendente, setAgendamentoIdPendente] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: async (params: { agId: string; credenciais?: { usuario: string; senha: string } }) => {
      const { data } = await api.post(`/portaria/autorizar-entrada/${params.agId}`, params.credenciais ?? {})
      return data
    },
  })

  const autorizar = useCallback((agId: string) => {
    mutation.mutate({ agId }, {
      onSuccess: () => {
        setModalAberto(false)
        options?.onInvalidateQueries?.()
        notifications.show({ title: '✅ Entrada autorizada', message: 'Veículo encaminhado para a doca', color: 'green' })
      },
      onError: (err: any) => {
        const status = err?.response?.status ?? 0
        const acao = decidirAcaoAutorizarEntrada(status, false)
        if (acao === 'ABRIR_MODAL_CREDENCIAIS') {
          setAgendamentoIdPendente(agId)
          setModalAberto(true)
          notifications.show({
            title: 'Autorização necessária',
            message: err?.response?.data?.message || 'Credenciais de Supervisor exigidas',
            color: 'orange',
          })
        } else {
          notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' })
        }
      },
    })
  }, [mutation, options])

  const confirmarComCredenciais = useCallback(async (credenciais: { usuario: string; senha: string }) => {
    if (!agendamentoIdPendente) return
    try {
      await mutation.mutateAsync({ agId: agendamentoIdPendente, credenciais })
      setModalAberto(false)
      options?.onInvalidateQueries?.()
      notifications.show({ title: '✅ Entrada autorizada', message: 'Veículo encaminhado para a doca', color: 'green' })
    } catch (err: any) {
      const status = err?.response?.status ?? 0
      const acao = decidirAcaoAutorizarEntrada(status, true)
      if (acao === 'ERRO_CREDENCIAIS_INVALIDAS') {
        // Propaga para o ModalSenhaSupervisor exibir o erro inline e permitir nova tentativa (Requirement 10.4)
        throw err
      }
      // Requirement 11.1 — outro status: fecha o modal e usa a notificação de erro padrão, sem reabrir o modal
      setModalAberto(false)
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' })
    }
  }, [agendamentoIdPendente, mutation, options])

  const fecharModal = useCallback(() => {
    // Requirement 10.7 — cancelar não reenvia nada; agendamento permanece no status anterior
    setModalAberto(false)
  }, [])

  return {
    autorizar,
    confirmarComCredenciais,
    modalAberto,
    fecharModal,
    isPending: mutation.isPending,
  }
}
