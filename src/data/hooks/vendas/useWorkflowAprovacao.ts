import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface RegraAprovacao {
  id: string
  nome: string
  condicao: string
  aprovadores: string[]
  ativo: boolean
  criadoEm: string
}

export interface SolicitacaoAprovacao {
  id: string
  tipo: string
  referenciaId: string
  status: 'PENDENTE' | 'APROVADA' | 'REJEITADA'
  solicitante: string
  criadoEm: string
}

export function useRegrasAprovacao(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['workflow-aprovacao-regras', params],
    queryFn: async () => {
      const { data } = await api.get('/workflow-aprovacao', { params })
      return data as { data: RegraAprovacao[]; total: number; page: number; limit: number }
    },
  })
}

export function useCriarRegraAprovacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: any) => {
      const { data } = await api.post('/workflow-aprovacao', body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflow-aprovacao-regras'] }),
  })
}

export function useEditarRegraAprovacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: any) => {
      const { data } = await api.put(`/workflow-aprovacao/${id}`, body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflow-aprovacao-regras'] }),
  })
}

export function useSolicitacoesAprovacao(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['workflow-aprovacao-solicitacoes', params],
    queryFn: async () => {
      const { data } = await api.get('/workflow-aprovacao/solicitacoes', { params })
      return data as { data: SolicitacaoAprovacao[]; total: number; page: number; limit: number }
    },
  })
}

export function useAprovarSolicitacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/workflow-aprovacao/solicitacoes/${id}`, { acao: 'APROVAR' })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflow-aprovacao-solicitacoes'] }),
  })
}

export function useRejeitarSolicitacao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo?: string }) => {
      const { data } = await api.patch(`/workflow-aprovacao/solicitacoes/${id}`, { acao: 'REJEITAR', motivo })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['workflow-aprovacao-solicitacoes'] }),
  })
}
