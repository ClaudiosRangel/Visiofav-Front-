import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// ── Tipos ──────────────────────────────────────────────────────────────────
export interface ConfiguracaoProspeccao {
  id: string
  nome: string
  descricao?: string | null
  cnaes: string // CSV
  uf?: string | null
  cidade?: string | null
  portes?: string | null // CSV
  situacao: string
  status: boolean
  criadoEm: string
  _count?: { prospects: number }
}

export type StatusFunil = 'NOVO' | 'EM_CONTATO' | 'QUALIFICADO' | 'DESCARTADO' | 'CONVERTIDO'

export interface Prospect {
  id: string
  cnpj: string
  razaoSocial: string
  nomeFantasia?: string | null
  cnaePrincipal?: string | null
  cnaeDescricao?: string | null
  situacao?: string | null
  porte?: string | null
  cidade?: string | null
  uf?: string | null
  telefone?: string | null
  email?: string | null
  statusFunil: StatusFunil
  observacoes?: string | null
  clienteId?: string | null
}

export interface ExecucaoProspeccao {
  id: string
  status: string
  totalEncontrado: number
  totalNovo: number
  erro?: string | null
  criadoEm: string
  finalizadoEm?: string | null
  configuracao?: { nome: string }
}

interface ListResp<T> { data: T[]; total: number }

const CFG_KEY = 'prospeccao-configuracoes'
const PROS_KEY = 'prospeccao-prospects'
const EXEC_KEY = 'prospeccao-execucoes'

// ── Configurações ────────────────────────────────────────────────────────────
export function useConfiguracoesProspeccao(params?: { busca?: string; page?: number; limit?: number }) {
  return useQuery<ListResp<ConfiguracaoProspeccao>>({
    queryKey: [CFG_KEY, params],
    queryFn: async () => { const { data } = await api.get('/prospeccao/configuracoes', { params }); return data },
    staleTime: 1000 * 60, refetchOnWindowFocus: false,
  })
}

interface ConfigInput {
  nome: string
  descricao?: string | null
  cnaes: string[]
  uf?: string | null
  cidade?: string | null
  portes?: string[]
  situacao?: string
}

export function useCriarConfiguracao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: ConfigInput) => { const { data } = await api.post('/prospeccao/configuracoes', body); return data },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CFG_KEY] }),
  })
}

export function useAtualizarConfiguracao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<ConfigInput> & { id: string }) => {
      const { data } = await api.put(`/prospeccao/configuracoes/${id}`, body); return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CFG_KEY] }),
  })
}

export function useExcluirConfiguracao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/prospeccao/configuracoes/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: [CFG_KEY] }),
  })
}

// ── Buscar (disparar prospecção) ──────────────────────────────────────────────
export interface ResultadoBusca {
  totalEncontrado: number
  totalNovo: number
  avisos: string[]
}

export function useDispararBusca() {
  const qc = useQueryClient()
  return useMutation<ResultadoBusca, unknown, string>({
    mutationFn: async (configId: string) => { const { data } = await api.post(`/prospeccao/configuracoes/${configId}/buscar`); return data },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PROS_KEY] })
      qc.invalidateQueries({ queryKey: [EXEC_KEY] })
      qc.invalidateQueries({ queryKey: [CFG_KEY] })
    },
  })
}

// ── Prospects ────────────────────────────────────────────────────────────────
export function useProspects(params?: { busca?: string; statusFunil?: string; configuracaoId?: string; page?: number; limit?: number }) {
  return useQuery<ListResp<Prospect>>({
    queryKey: [PROS_KEY, params],
    queryFn: async () => { const { data } = await api.get('/prospeccao/prospects', { params }); return data },
    refetchOnWindowFocus: false,
  })
}

export function useAtualizarProspect() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: { id: string; statusFunil?: StatusFunil; observacoes?: string | null }) => {
      const { data } = await api.patch(`/prospeccao/prospects/${id}`, body); return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [PROS_KEY] }),
  })
}

export function useExcluirProspect() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { await api.delete(`/prospeccao/prospects/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: [PROS_KEY] }),
  })
}

export function useEnriquecerProspect() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { const { data } = await api.post(`/prospeccao/prospects/${id}/enriquecer`); return data },
    onSuccess: () => qc.invalidateQueries({ queryKey: [PROS_KEY] }),
  })
}

export function useConverterProspect() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => { const { data } = await api.post(`/prospeccao/prospects/${id}/converter`); return data },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [PROS_KEY] })
      qc.invalidateQueries({ queryKey: ['clientes'] })
    },
  })
}

// ── Execuções ──────────────────────────────────────────────────────────────
export function useExecucoesProspeccao() {
  return useQuery<ExecucaoProspeccao[]>({
    queryKey: [EXEC_KEY],
    queryFn: async () => { const { data } = await api.get('/prospeccao/execucoes'); return data },
    refetchOnWindowFocus: false,
  })
}
