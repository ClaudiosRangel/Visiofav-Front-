import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface Produto {
  id: string
  codigo: number
  descricao: string
  codigoBarra?: string
  unidade: string
  validade?: number
  vidaUtilPerc?: number
  saldoMin?: number
  saldoMax?: number
  curvaAbc?: string
  status: boolean
  centroDistribuicaoId: string
  classificacaoProdutoId?: string
  skus?: Array<Record<string, unknown>>
  dadosLogisticos?: Record<string, unknown>
}

interface ListResponse { data: Produto[]; total: number; page: number; limit: number; totalPages: number }

const KEY = 'produtos'

export function useProdutos(params?: { page?: number; limit?: number; search?: string; centroDistribuicaoId?: string }) {
  return useQuery<ListResponse>({
    queryKey: [KEY, params],
    queryFn: async () => { const { data } = await api.get('/produtos', { params }); return data },
    staleTime: 1000 * 60 * 5, refetchOnWindowFocus: false,
  })
}

export function useProdutoById(id: string | null) {
  return useQuery<Produto>({
    queryKey: [KEY, id],
    queryFn: async () => { const { data } = await api.get(`/produtos/${id}`); return data },
    enabled: !!id,
  })
}

export function useCriarProduto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: Partial<Produto>) => { const { data } = await api.post('/produtos', body); return data },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useAtualizarProduto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<Produto> & { id: string }) => { const { data } = await api.put(`/produtos/${id}`, body); return data },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useExcluirProduto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/produtos/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}
