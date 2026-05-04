import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface Veiculo { id: string; codigo: number; descricao: string; placa: string; marca?: string; modelo?: string; ano?: number; status: boolean; tipoCarroceriaId?: string; tipoCarroceria?: { descricao: string } }
interface ListResponse { data: Veiculo[]; total: number; page: number; limit: number; totalPages: number }
const KEY = 'veiculos'

export function useVeiculos(params?: Record<string, unknown>) {
  return useQuery<ListResponse>({ queryKey: [KEY, params], queryFn: async () => { const { data } = await api.get('/veiculos', { params }); return data }, staleTime: 1000 * 60 * 5, refetchOnWindowFocus: false })
}
export function useCriarVeiculo() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: async (body: Partial<Veiculo>) => { const { data } = await api.post('/veiculos', body); return data }, onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }) })
}
export function useAtualizarVeiculo() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: async ({ id, ...body }: Partial<Veiculo> & { id: string }) => { const { data } = await api.put(`/veiculos/${id}`, body); return data }, onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }) })
}
export function useExcluirVeiculo() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: async (id: string) => { await api.delete(`/veiculos/${id}`) }, onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }) })
}
