import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface Deposito {
  id: string
  codigo: number
  descricao: string
  status: boolean
  centroDistribuicaoId: string
  centroDistribuicao?: { descricao: string }
  logradouro?: string
  numero?: string
  cidade?: string
  uf?: string
  cep?: string
  telefone1?: string
  telefone2?: string
}

interface ListResponse { data: Deposito[]; total: number; page: number; limit: number; totalPages: number }

const KEY = 'depositos'

export function useDepositos(params?: { page?: number; limit?: number; search?: string; centroDistribuicaoId?: string }) {
  return useQuery<ListResponse>({
    queryKey: [KEY, params],
    queryFn: async () => { const { data } = await api.get('/depositos', { params }); return data },
    staleTime: 1000 * 60 * 5, refetchOnWindowFocus: false,
  })
}

export function useCriarDeposito() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: Partial<Deposito>) => { const { data } = await api.post('/depositos', body); return data },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useAtualizarDeposito() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<Deposito> & { id: string }) => { const { data } = await api.put(`/depositos/${id}`, body); return data },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useExcluirDeposito() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/depositos/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}
