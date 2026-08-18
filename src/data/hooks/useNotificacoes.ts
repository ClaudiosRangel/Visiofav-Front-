import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Notificacao {
  id: string
  notificacaoId: string
  tipo: 'ALERTA' | 'INFORMACAO' | 'NOVIDADE' | 'RECADO' | 'DUVIDA'
  titulo: string
  mensagem: string
  preview: string
  remetente: string
  remetenteId: string
  lida: boolean
  lidaEm: string | null
  criadoEm: string
}

export interface NotificacoesResponse {
  data: Notificacao[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface NotificacoesParams {
  page?: number
  limit?: number
  tipo?: string
  lida?: 'true' | 'false'
}

export function useNotificacoes() {
  const qc = useQueryClient()

  function useContagem() {
    return useQuery<{ naoLidas: number }>({
      queryKey: ['notificacoes', 'contagem'],
      queryFn: async () => {
        const { data } = await api.get('/notificacoes/contagem')
        return data
      },
      refetchInterval: 30_000, // 30 segundos
      staleTime: 10_000,
    })
  }

  function useListar(params?: NotificacoesParams) {
    return useQuery<NotificacoesResponse>({
      queryKey: ['notificacoes', params],
      queryFn: async () => {
        const { data } = await api.get('/notificacoes', { params })
        return data
      },
      staleTime: 1000 * 30,
    })
  }

  function useMarcarLida() {
    return useMutation({
      mutationFn: async (id: string) => {
        const { data } = await api.patch(`/notificacoes/${id}/ler`)
        return data
      },
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['notificacoes'] })
      },
    })
  }

  function useMarcarTodasLidas() {
    return useMutation({
      mutationFn: async () => {
        const { data } = await api.patch('/notificacoes/ler-todas')
        return data
      },
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['notificacoes'] })
      },
    })
  }

  function useEnviar() {
    return useMutation({
      mutationFn: async (payload: {
        tipo: 'RECADO' | 'INFORMACAO' | 'DUVIDA'
        titulo: string
        mensagem: string
        destinatarioIds: string[]
      }) => {
        const { data } = await api.post('/notificacoes', payload)
        return data
      },
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['notificacoes'] })
      },
    })
  }

  function useEnviarAdmin() {
    return useMutation({
      mutationFn: async (payload: {
        tipo: 'ALERTA' | 'INFORMACAO' | 'NOVIDADE' | 'RECADO'
        titulo: string
        mensagem: string
        empresaIds?: string[]
        paraTodasEmpresas?: boolean
      }) => {
        const { data } = await api.post('/notificacoes/admin', payload)
        return data
      },
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: ['notificacoes'] })
      },
    })
  }

  return {
    useContagem,
    useListar,
    useMarcarLida,
    useMarcarTodasLidas,
    useEnviar,
    useEnviarAdmin,
  }
}
