import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { portalRepApi } from './portal-rep-api'
import type {
  ClienteCarteira,
  CriarClientePayload,
  EditarClientePayload,
  SolicitarAlteracaoFiscalPayload,
} from './types'

const QUERY_KEY = 'portal-rep-clientes'

export function usePortalRepClientes() {
  return useQuery<ClienteCarteira[]>({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data } = await portalRepApi.get('/clientes')
      return data
    },
  })
}

export function useCriarCliente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CriarClientePayload) => {
      const { data } = await portalRepApi.post('/clientes', body)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] })
    },
  })
}

export function useEditarCliente() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: EditarClientePayload & { id: string }) => {
      const { data } = await portalRepApi.put(`/clientes/${id}`, body)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] })
    },
  })
}

export function useSolicitarAlteracaoFiscal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: SolicitarAlteracaoFiscalPayload & { id: string }) => {
      const { data } = await portalRepApi.put(`/clientes/${id}/campos-fiscais`, body)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] })
    },
  })
}
