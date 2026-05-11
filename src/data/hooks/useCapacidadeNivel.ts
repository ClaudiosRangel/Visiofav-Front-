import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface CapacidadeNivel {
  id: string
  empresaId: string
  estruturaId: string
  codigoNivel: string
  pesoMaximo: number | null
  volumeMaximo: number | null
  paletesMaximo: number | null
  status: boolean
  criadoEm: string
  atualizadoEm: string
}

export interface OcupacaoNivel {
  codigoNivel: string
  pesoAtual: number
  pesoMaximo: number | null
  percentualPeso: number
  volumeAtual: number
  volumeMaximo: number | null
  percentualVolume: number
  paletesAtual: number
  paletesMaximo: number | null
  percentualPaletes: number
  alertLevel: 'NORMAL' | 'ALERTA' | 'CRITICO'
}

const KEY = 'capacidades-nivel'
const KEY_OCUPACAO = 'capacidades-nivel-ocupacao'

export function useCapacidadesNivel(estruturaId: string | null) {
  return useQuery<{ data: CapacidadeNivel[]; total: number }>({
    queryKey: [KEY, estruturaId],
    queryFn: async () => {
      const { data } = await api.get('/capacidades-nivel', { params: { estruturaId } })
      return data
    },
    enabled: !!estruturaId,
    staleTime: 1000 * 60 * 5,
  })
}

export function useOcupacaoNivel(estruturaId: string | null) {
  return useQuery<{ data: OcupacaoNivel[] }>({
    queryKey: [KEY_OCUPACAO, estruturaId],
    queryFn: async () => {
      const { data } = await api.get('/capacidades-nivel/ocupacao', { params: { estruturaId } })
      return data
    },
    enabled: !!estruturaId,
    staleTime: 1000 * 60 * 2,
  })
}

export function useCriarCapacidadeNivel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: { estruturaId: string; codigoNivel: string; pesoMaximo?: number | null; volumeMaximo?: number | null; paletesMaximo?: number | null; status?: boolean }) => {
      const { data } = await api.post('/capacidades-nivel', body)
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: [KEY, variables.estruturaId] })
      qc.invalidateQueries({ queryKey: [KEY_OCUPACAO, variables.estruturaId] })
    },
  })
}

export function useAtualizarCapacidadeNivel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, estruturaId, ...body }: { id: string; estruturaId: string; codigoNivel?: string; pesoMaximo?: number | null; volumeMaximo?: number | null; paletesMaximo?: number | null; status?: boolean }) => {
      const { data } = await api.put(`/capacidades-nivel/${id}`, body)
      return data
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: [KEY, variables.estruturaId] })
      qc.invalidateQueries({ queryKey: [KEY_OCUPACAO, variables.estruturaId] })
    },
  })
}

export function useExcluirCapacidadeNivel() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, estruturaId }: { id: string; estruturaId: string }) => {
      await api.delete(`/capacidades-nivel/${id}`)
      return estruturaId
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: [KEY, variables.estruturaId] })
      qc.invalidateQueries({ queryKey: [KEY_OCUPACAO, variables.estruturaId] })
    },
  })
}
