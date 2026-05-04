import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface Funcionario { id: string; codigo: number; nome: string; matricula?: string; tipo: string; presente: boolean; status: boolean; centroDistribuicaoId: string }
interface ListResponse { data: Funcionario[]; total: number; page: number; limit: number; totalPages: number }

const KEY = 'funcionarios'

export function useFuncionarios(params?: Record<string, unknown>) {
  return useQuery<ListResponse>({ queryKey: [KEY, params], queryFn: async () => { const { data } = await api.get('/funcionarios', { params }); return data }, staleTime: 1000 * 60 * 5, refetchOnWindowFocus: false })
}

export function useCriarFuncionario() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: async (body: Partial<Funcionario>) => { const { data } = await api.post('/funcionarios', body); return data }, onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }) })
}

export function useAtualizarFuncionario() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: async ({ id, ...body }: Partial<Funcionario> & { id: string }) => { const { data } = await api.put(`/funcionarios/${id}`, body); return data }, onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }) })
}

export function useExcluirFuncionario() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: async (id: string) => { await api.delete(`/funcionarios/${id}`) }, onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }) })
}
