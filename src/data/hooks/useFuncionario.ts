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

// ─── PIN do Checkout de Apontamento ─────────────────────────────────────────

interface FuncionarioPinStatus {
  id: string
  nome: string
  codigo: number
  matricula?: string
  pinAtivo: boolean
}

export function useFuncionariosPinStatus() {
  return useQuery<FuncionarioPinStatus[]>({
    queryKey: [KEY, 'pin-status'],
    queryFn: async () => { const { data } = await api.get('/checkout/admin/funcionarios/pin-status'); return data },
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  })
}

export function useDefinirPin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ funcionarioId, pin }: { funcionarioId: string; pin: string }) => {
      const { data } = await api.patch(`/checkout/admin/funcionarios/${funcionarioId}/pin`, { pin })
      return data
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [KEY] }); qc.invalidateQueries({ queryKey: [KEY, 'pin-status'] }) },
  })
}

export function useRemoverPin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (funcionarioId: string) => {
      const { data } = await api.delete(`/checkout/admin/funcionarios/${funcionarioId}/pin`)
      return data
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: [KEY] }); qc.invalidateQueries({ queryKey: [KEY, 'pin-status'] }) },
  })
}
