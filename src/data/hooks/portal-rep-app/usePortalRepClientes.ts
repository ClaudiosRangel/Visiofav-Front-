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

// Dados retornados pela consulta de CNPJ (autopreenchimento do cadastro). B2.
export interface DadosCnpj {
  cpfCnpj: string
  razaoSocial: string
  nomeFantasia?: string | null
  logradouro?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cidade?: string | null
  uf?: string | null
  cep?: string | null
  telefone?: string | null
  email?: string | null
}

// Consulta um CNPJ na Receita (via backend → BrasilAPI/CNPJá Open) para
// autopreencher o cadastro de cliente novo no portal. Spec B2.
export function useConsultarCnpj() {
  return useMutation({
    mutationFn: async (cnpj: string): Promise<DadosCnpj> => {
      const soDigitos = cnpj.replace(/\D/g, '')
      const { data } = await portalRepApi.get(`/clientes/cnpj/${soDigitos}`)
      return data
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
