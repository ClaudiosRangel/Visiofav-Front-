import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useCrudGenerico } from './useCrudGenerico'

// ===== Interfaces =====

export interface ComponenteFormato {
  tipo: 'RUA' | 'PREDIO' | 'NIVEL' | 'APARTAMENTO'
  ativo: boolean
  digitos: number
  separador: string
}

export interface SegmentoFormato {
  campoFisico: string
  ativo: boolean
  digitos: number
  separador?: string
  ordem?: number
}

export interface FormatoEndereco {
  id: string
  nome: string
  componentes?: ComponenteFormato[]
  segmentos?: SegmentoFormato[]
  status?: boolean
}

export interface FormatoResolvidoResponse {
  id: string
  nome: string
  segmentos: SegmentoFormato[]
  /** @deprecated backend retorna segmentos, não componentes */
  componentes?: ComponenteFormato[]
}

export interface FaixaSegmento {
  campoFisico: string
  inicio: number
  fim: number
}

export interface GerarEnderecosInput {
  formatoEnderecoId?: string
  depositoId: string
  centroDistribuicaoId: string
  zonaId?: string
  estruturaId?: string
  codigoDeposito: string
  codigoZona: string
  tipo: string
  nivelPicking?: number
  ruaInicio?: number
  ruaFim?: number
  predioInicio?: number
  predioFim?: number
  nivelInicio?: number
  nivelFim?: number
  aptoInicio?: number
  aptoFim?: number
  faixas?: FaixaSegmento[]
}

// ===== CRUD via useCrudGenerico =====

export const formatoEnderecoCrud = useCrudGenerico<FormatoEndereco>(
  '/formato-endereco',
  'formato-endereco'
)

// ===== Hooks Específicos =====

const KEYS = {
  resolver: 'formato-endereco-resolver',
}

/** GET /formato-endereco/resolver?depositoId=&zonaId= */
export function useResolverFormato(depositoId: string | null, zonaId?: string | null) {
  return useQuery<FormatoResolvidoResponse | null>({
    queryKey: [KEYS.resolver, depositoId, zonaId],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (depositoId) params.depositoId = depositoId
      if (zonaId) params.zonaId = zonaId
      const { data } = await api.get('/formato-endereco/resolver', { params })
      return data
    },
    enabled: !!depositoId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    retry: false,
  })
}

/** POST /formato-endereco/gerar */
export function useGerarComFormato() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: GerarEnderecosInput) => {
      const { data } = await api.post('/formato-endereco/gerar', body)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['enderecos'] })
    },
  })
}
