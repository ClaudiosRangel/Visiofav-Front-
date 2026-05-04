import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface OrdemServico {
  id: string
  numero: number
  tipo: string
  tipoOperacao: string
  tipoMovimento?: string
  status: string
  data: string
  hora: string
  numDocumento?: string
  observacao?: string
  centroDistribuicaoId: string
  movimentos?: Array<Record<string, unknown>>
  osFuncionarios?: Array<Record<string, unknown>>
  logsOs?: Array<Record<string, unknown>>
}

interface ListResponse { data: OrdemServico[]; total: number; page: number; limit: number; totalPages: number }

const KEY = 'ordens-servico'

export function useOrdensServico(params?: { page?: number; limit?: number; centroDistribuicaoId?: string; status?: string; tipo?: string }) {
  return useQuery<ListResponse>({
    queryKey: [KEY, params],
    queryFn: async () => { const { data } = await api.get('/ordens-servico', { params }); return data },
    staleTime: 1000 * 60, refetchOnWindowFocus: false,
  })
}

export function useOrdemServicoById(id: string | null) {
  return useQuery<OrdemServico>({
    queryKey: [KEY, id],
    queryFn: async () => { const { data } = await api.get(`/ordens-servico/${id}`); return data },
    enabled: !!id,
  })
}

export function useCriarOrdemServico() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: Partial<OrdemServico>) => { const { data } = await api.post('/ordens-servico', body); return data },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useAlterarStatusOS() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => { const { data } = await api.patch(`/ordens-servico/${id}/status`, { status }); return data },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}
