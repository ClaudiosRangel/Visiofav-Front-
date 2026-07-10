import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface NotaEntrada {
  id: string; numero: number; serie?: string; fornecedor?: string; fornecedorDoc?: string
  transportadora?: string; transportadoraUf?: string | null; transportadoraRntc?: string | null
  dataEmissao?: string; dataEntrada?: string; tipo: string; status: string
  itens?: Array<Record<string, unknown>>; conferencias?: Array<Record<string, unknown>>
}

interface ListResponse { data: NotaEntrada[]; total: number; page: number; limit: number; totalPages: number }

const KEY = 'notas-entrada'

export function useNotasEntrada(params?: Record<string, unknown>) {
  return useQuery<ListResponse>({ queryKey: [KEY, params], queryFn: async () => { const { data } = await api.get('/notas-entrada', { params }); return data }, staleTime: 1000 * 60, refetchOnWindowFocus: false })
}

export function useNotaEntradaById(id: string | null) {
  return useQuery<NotaEntrada>({ queryKey: [KEY, id], queryFn: async () => { const { data } = await api.get(`/notas-entrada/${id}`); return data }, enabled: !!id })
}

export function useCriarNotaEntrada() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: async (body: Record<string, unknown>) => { const { data } = await api.post('/notas-entrada', body); return data }, onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }) })
}

export function useAlterarStatusNota() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: async ({ id, status }: { id: string; status: string }) => { const { data } = await api.patch(`/notas-entrada/${id}/status`, { status }); return data }, onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }) })
}

export function useExcluirNotaEntrada() {
  const qc = useQueryClient()
  return useMutation({ mutationFn: async (id: string) => { await api.delete(`/notas-entrada/${id}`) }, onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }) })
}
