import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface CampanhaDesconto {
  id: string
  nome: string
  tipo: string
  valor: number
  codigoCupom?: string
  dataInicio: string
  dataFim: string
  ativo: boolean
  criadoEm: string
}

export function useCampanhasDesconto(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['campanhas-desconto', params],
    queryFn: async () => {
      const { data } = await api.get('/campanhas-desconto', { params })
      return data as { data: CampanhaDesconto[]; total: number; page: number; limit: number }
    },
  })
}

export function useCriarCampanhaDesconto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: any) => {
      const { data } = await api.post('/campanhas-desconto', body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campanhas-desconto'] }),
  })
}

export function useEditarCampanhaDesconto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: any) => {
      const { data } = await api.put(`/campanhas-desconto/${id}`, body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['campanhas-desconto'] }),
  })
}
