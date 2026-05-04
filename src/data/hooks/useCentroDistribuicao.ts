import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface CentroDistribuicao {
  id: string
  codigo: number
  descricao: string
  status: boolean
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  uf?: string
  cep?: string
  telefone?: string
}

interface ListResponse {
  data: CentroDistribuicao[]
  total: number
  page: number
  limit: number
  totalPages: number
}

const KEY = 'centros-distribuicao'

export function useCentrosDistribuicao(params?: { page?: number; limit?: number; search?: string }) {
  return useQuery<ListResponse>({
    queryKey: [KEY, params],
    queryFn: async () => {
      const { data } = await api.get('/centros-distribuicao', { params })
      return data
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  })
}

export function useCentroDistribuicaoById(id: string | null) {
  return useQuery<CentroDistribuicao>({
    queryKey: [KEY, id],
    queryFn: async () => {
      const { data } = await api.get(`/centros-distribuicao/${id}`)
      return data
    },
    enabled: !!id,
  })
}

export function useCriarCentroDistribuicao() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: Partial<CentroDistribuicao>) => {
      const { data } = await api.post('/centros-distribuicao', body)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useAtualizarCentroDistribuicao() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<CentroDistribuicao> & { id: string }) => {
      const { data } = await api.put(`/centros-distribuicao/${id}`, body)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useExcluirCentroDistribuicao() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/centros-distribuicao/${id}`)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [KEY] }),
  })
}
