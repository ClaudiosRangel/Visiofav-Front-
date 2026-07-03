import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Bonificacao {
  id: string
  nome: string
  produtoGatilho: string
  qtdMinima: number
  produtoBonus: string
  qtdBonus: number
  ativo: boolean
  criadoEm: string
}

export function useBonificacoes(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['bonificacoes', params],
    queryFn: async () => {
      const { data } = await api.get('/bonificacoes', { params })
      return data as { data: Bonificacao[]; total: number; page: number; limit: number }
    },
  })
}

export function useCriarBonificacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: any) => {
      const { data } = await api.post('/bonificacoes', body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bonificacoes'] }),
  })
}

export function useEditarBonificacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: any) => {
      const { data } = await api.put(`/bonificacoes/${id}`, body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bonificacoes'] }),
  })
}
