import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface Doca { id: string; codigo: number; descricao: string; tipo: string; estado: string; comprimentoMax?: number; status: boolean; centroDistribuicaoId: string; depositoId: string; deposito?: { descricao: string } }
interface ListResponse { data: Doca[]; total: number; page: number; limit: number; totalPages: number }
const KEY = 'docas'

export function useDocas(params?: Record<string, unknown>) {
  return useQuery<ListResponse>({ queryKey: [KEY, params], queryFn: async () => { const { data } = await api.get('/docas', { params }); return data }, staleTime: 1000 * 60 * 5, refetchOnWindowFocus: false })
}
export function useCriarDoca() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: async (body: Partial<Doca>) => { const { data } = await api.post('/docas', body); return data }, onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }) })
}
export function useAtualizarDoca() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: async ({ id, ...body }: Partial<Doca> & { id: string }) => { const { data } = await api.put(`/docas/${id}`, body); return data }, onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }) })
}
export function useExcluirDoca() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: async (id: string) => { await api.delete(`/docas/${id}`) }, onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }) })
}
