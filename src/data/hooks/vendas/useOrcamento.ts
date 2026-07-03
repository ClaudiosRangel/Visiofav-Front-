import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Orcamento {
  id: string
  numero: number
  clienteId: string
  vendedorId?: string
  tabelaPrecoId?: string
  condicaoPagId?: string
  valorTotal: number
  status: 'ABERTO' | 'ENVIADO' | 'APROVADO' | 'REPROVADO' | 'CONVERTIDO' | 'EXPIRADO'
  validadeAte: string
  observacao?: string
  observacaoInterna?: string
  contatoNome?: string
  contatoEmail?: string
  contatoTelefone?: string
  tipoDesconto?: string
  descontoGeral?: number
  motivoReprovacao?: string
  pedidoVendaGeradoId?: string
  criadoEm: string
  cliente?: { id: string; razaoSocial: string; nomeFantasia?: string }
  vendedor?: { id: string; nome: string }
  tabelaPreco?: { id: string; nome: string }
  itens?: ItemOrcamento[]
  _count?: { itens: number }
}

export interface ItemOrcamento {
  id: string
  produtoId: string
  quantidade: number
  unidade: string
  precoUnitario: number
  desconto: number
  valorTotal: number
  observacao?: string
  produto?: { id: string; nome: string; codigo: string; unidade: string }
}

export function useOrcamentos(params: { status?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['orcamentos', params],
    queryFn: async () => {
      const { data } = await api.get('/orcamentos', { params })
      return data as { data: Orcamento[]; total: number; page: number; limit: number }
    },
  })
}

export function useOrcamento(id: string) {
  return useQuery({
    queryKey: ['orcamentos', id],
    queryFn: async () => {
      const { data } = await api.get(`/orcamentos/${id}`)
      return data as Orcamento
    },
    enabled: !!id,
  })
}

export function useCriarOrcamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: any) => {
      const { data } = await api.post('/orcamentos', body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orcamentos'] }),
  })
}

export function useEditarOrcamento(id: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: any) => {
      const { data } = await api.put(`/orcamentos/${id}`, body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orcamentos'] }),
  })
}

export function useEnviarOrcamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/orcamentos/${id}/enviar`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orcamentos'] }),
  })
}

export function useAprovarOrcamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/orcamentos/${id}/aprovar`)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orcamentos'] }),
  })
}

export function useReprovarOrcamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { data } = await api.patch(`/orcamentos/${id}/reprovar`, { motivo })
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['orcamentos'] }),
  })
}

export function useConverterOrcamento() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/orcamentos/${id}/converter`)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orcamentos'] })
      qc.invalidateQueries({ queryKey: ['pedidos-venda'] })
    },
  })
}
