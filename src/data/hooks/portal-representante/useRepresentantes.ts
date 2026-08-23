import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type {
  Representante,
  VendedorDisponivel,
  CriarRepresentantePayload,
  CriarRepresentanteResponse,
  EditarRepresentantePayload,
  ResetarSenhaResponse,
} from './types'

const QUERY_KEY = 'portal-rep-representantes'
const VENDEDORES_QUERY_KEY = 'portal-rep-vendedores-disponiveis'

export function useRepresentantes() {
  return useQuery<Representante[]>({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data } = await api.get('/portal-rep/admin/representantes')
      return data
    },
  })
}

export function useVendedoresDisponiveis() {
  return useQuery<VendedorDisponivel[]>({
    queryKey: [VENDEDORES_QUERY_KEY],
    queryFn: async () => {
      const { data } = await api.get('/portal-rep/admin/representantes', {
        params: { 'vendedores-disponiveis': true },
      })
      return data
    },
  })
}

export function useCriarRepresentante() {
  const qc = useQueryClient()
  return useMutation<CriarRepresentanteResponse, Error, CriarRepresentantePayload>({
    mutationFn: async (body) => {
      const { data } = await api.post('/portal-rep/admin/representantes', body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}

export function useEditarRepresentante() {
  const qc = useQueryClient()
  return useMutation<void, Error, { id: string; data: EditarRepresentantePayload }>({
    mutationFn: async ({ id, data: body }) => {
      await api.put(`/portal-rep/admin/representantes/${id}`, body)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}

export function useInativarRepresentante() {
  const qc = useQueryClient()
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      await api.put(`/portal-rep/admin/representantes/${id}/inativar`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}

export function useResetarSenha() {
  const qc = useQueryClient()
  return useMutation<ResetarSenhaResponse, Error, string>({
    mutationFn: async (id) => {
      const { data } = await api.put(`/portal-rep/admin/representantes/${id}/resetar-senha`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}
