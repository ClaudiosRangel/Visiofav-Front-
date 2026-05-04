import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface Endereco {
  id: string
  codigo: number
  enderecoCompleto: string
  tipo: string
  estado: string
  status: boolean
  deposito?: { descricao: string }
  zona?: { descricao: string }
  estrutura?: { descricao: string }
}

interface ListResponse { data: Endereco[]; total: number; page: number; limit: number; totalPages: number }

const KEY = 'enderecos'

export function useEnderecos(params?: { page?: number; limit?: number; search?: string; centroDistribuicaoId?: string; depositoId?: string; estado?: string }) {
  return useQuery<ListResponse>({
    queryKey: [KEY, params],
    queryFn: async () => { const { data } = await api.get('/enderecos', { params }); return data },
    staleTime: 1000 * 60 * 5, refetchOnWindowFocus: false,
  })
}

export function useCriarEndereco() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => { const { data } = await api.post('/enderecos', body); return data },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useGerarEnderecos() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: Record<string, unknown>) => { const { data } = await api.post('/enderecos/gerar', body); return data },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useExcluirEndereco() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/enderecos/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}
