import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { AxiosError } from 'axios'
import { api } from '@/lib/api'
import {
  GEO_KEYS,
  GeocodificacaoResult,
  OtimizacaoResult,
  SalvarSequenciaRequest,
  BatchGeoResult,
  DistanciaResult,
  SugestaoRota,
  CoberturaRota,
  CoberturaConsolidada,
  ResumoGeoClientes,
} from '@/data/types/geo'

// ===== Error Handling =====

function handleGeoError(error: AxiosError<{ message?: string }>) {
  const status = error.response?.status
  const message = error.response?.data?.message

  if (status === 503) {
    notifications.show({
      title: 'Serviço Indisponível',
      message: 'Serviço de geocodificação temporariamente indisponível. Tente novamente mais tarde.',
      color: 'orange',
    })
  } else {
    notifications.show({
      title: 'Erro',
      message: message || 'Ocorreu um erro inesperado.',
      color: 'red',
    })
  }
}

// ===== Mutation Hooks =====

export function useGeocodificarCliente() {
  const qc = useQueryClient()
  return useMutation<GeocodificacaoResult, AxiosError<{ message?: string }>, string>({
    mutationFn: async (clienteId: string) => {
      const { data } = await api.post(`/geo/clientes/${clienteId}/geocodificar`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [GEO_KEYS.clientes] })
    },
    onError: handleGeoError,
  })
}

export function useGeocodificarEmpresa() {
  const qc = useQueryClient()
  return useMutation<GeocodificacaoResult, AxiosError<{ message?: string }>>({
    mutationFn: async () => {
      const { data } = await api.post('/geo/empresa/geocodificar')
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [GEO_KEYS.empresa] })
    },
    onError: handleGeoError,
  })
}

export function useGeocodificarBatch() {
  const qc = useQueryClient()
  return useMutation<BatchGeoResult, AxiosError<{ message?: string }>, string[]>({
    mutationFn: async (clienteIds: string[]) => {
      const { data } = await api.post('/geo/clientes/geocodificar-batch', { clienteIds })
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [GEO_KEYS.clientes] })
      qc.invalidateQueries({ queryKey: GEO_KEYS.resumoGeo })
    },
    onError: handleGeoError,
  })
}

export function useOtimizarRota() {
  return useMutation<OtimizacaoResult, AxiosError<{ message?: string }>, string>({
    mutationFn: async (mapaId: string) => {
      const { data } = await api.post(`/geo/mapas/${mapaId}/otimizar`)
      return data
    },
    onError: (error) => {
      const status = error.response?.status
      const message = error.response?.data?.message

      if (status === 422 && message?.includes('empresa')) {
        notifications.show({
          title: 'Empresa sem Coordenadas',
          message: 'A empresa não possui coordenadas cadastradas. Acesse Configurador → Empresa para geocodificar o endereço.',
          color: 'red',
        })
      } else {
        handleGeoError(error)
      }
    },
  })
}

export function useSalvarSequencia() {
  const qc = useQueryClient()
  return useMutation<void, AxiosError<{ message?: string }>, { mapaId: string; sequencia: SalvarSequenciaRequest['sequencia'] }>({
    mutationFn: async ({ mapaId, sequencia }) => {
      await api.post(`/geo/mapas/${mapaId}/salvar-sequencia`, { sequencia })
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [GEO_KEYS.mapas] })
    },
    onError: handleGeoError,
  })
}

// ===== Query Hooks =====

export function useDistanciaCliente(clienteId: string | null | undefined) {
  return useQuery<DistanciaResult>({
    queryKey: clienteId ? GEO_KEYS.distancia(clienteId) : ['geo-distancia'],
    queryFn: async () => {
      const { data } = await api.get(`/geo/distancia/cliente/${clienteId}`)
      return data
    },
    enabled: !!clienteId,
    staleTime: 1000 * 60 * 5,
  })
}

export function useSugestaoRota(clienteId: string | null | undefined, enabled = true) {
  return useQuery<SugestaoRota[]>({
    queryKey: clienteId ? GEO_KEYS.sugestaoRota(clienteId) : ['geo-sugestao-rota'],
    queryFn: async () => {
      const { data } = await api.get(`/geo/clientes/${clienteId}/sugestao-rota`)
      return data
    },
    enabled: !!clienteId && enabled,
    staleTime: 1000 * 60 * 5,
  })
}

export function useCoberturaRota(rotaId: string | null | undefined, enabled = true) {
  return useQuery<CoberturaRota>({
    queryKey: rotaId ? GEO_KEYS.coberturaRota(rotaId) : ['geo-cobertura'],
    queryFn: async () => {
      const { data } = await api.get(`/geo/rotas/${rotaId}/cobertura`)
      return data
    },
    enabled: !!rotaId && enabled,
    staleTime: 1000 * 60 * 5,
  })
}

export function useCoberturaConsolidada(enabled = true) {
  return useQuery<CoberturaConsolidada>({
    queryKey: GEO_KEYS.coberturaConsolidada,
    queryFn: async () => {
      const { data } = await api.get('/geo/rotas/cobertura-consolidada')
      return data
    },
    enabled,
    staleTime: 1000 * 60 * 5,
  })
}

export function useResumoGeoClientes() {
  return useQuery<ResumoGeoClientes>({
    queryKey: GEO_KEYS.resumoGeo,
    queryFn: async () => {
      const { data } = await api.get('/geo/clientes/resumo')
      return data
    },
    staleTime: 1000 * 60 * 2,
  })
}
