import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DeparaFornecedor {
  id: string
  empresaId: string
  fornecedorId: string
  codigoProdutoFornecedor: string
  descricaoFornecedor?: string | null
  produtoId: string
  skuId?: string | null
  unidadeFornecedor: string
  fatorConversao: number
  cEAN?: string | null
  cEANTrib?: string | null
  status: boolean
  criadoEm: string
  atualizadoEm: string
  fornecedor?: { id: string; razaoSocial: string; cnpj: string }
  produto?: { id: string; codigo: string; nome: string; unidade: string }
}

export interface DeparaFiltros {
  page?: number
  limit?: number
  fornecedorId?: string
  produtoId?: string
  codigoProdutoFornecedor?: string
  status?: string
  busca?: string
}

export interface DeparaCreatePayload {
  fornecedorId: string
  codigoProdutoFornecedor: string
  descricaoFornecedor?: string
  produtoId: string
  skuId?: string | null
  unidadeFornecedor: string
  fatorConversao: number
  cEAN?: string | null
  cEANTrib?: string | null
}

export interface DeparaUpdatePayload {
  id: string
  produtoId?: string
  skuId?: string | null
  fatorConversao?: number
  unidadeFornecedor?: string
  descricaoFornecedor?: string | null
  cEAN?: string | null
  cEANTrib?: string | null
  status?: boolean
}

export interface ImportarXmlDeparaResponse {
  nota: {
    numero: string
    serie: string
    dataEmissao: string
    fornecedor: string
    fornecedorDoc: string
    fornecedorId: string
    transportadora?: string
    tipo: string
  }
  resolvidos: Array<{
    xmlItem: {
      codigoProdutoFornecedor: string
      descricao: string
      unidade: string
      quantidade: number
      valorUnitario: number
      valorTotal: number
      ncm: string
      cEAN: string | null
      cEANTrib: string | null
      uTrib: string | null
      qTrib: number | null
    }
    produtoId: string
    produtoNome: string
    skuId: string | null
    fatorConversao: number
    quantidadeOriginal: number
    quantidadeConvertida: number
    unidadeInterna: string
    resolvidoPor: 'DEPARA' | 'EAN_TRIB' | 'EAN'
  }>
  pendentes: Array<{
    xmlItem: {
      codigoProdutoFornecedor: string
      descricao: string
      unidade: string
      quantidade: number
      valorUnitario: number
      valorTotal: number
      ncm: string
      cEAN: string | null
      cEANTrib: string | null
      uTrib: string | null
      qTrib: number | null
    }
    sugestoes: Array<{ produtoId: string; nome: string; cEAN: string | null }>
  }>
  totalItens: number
  totalResolvidos: number
  totalPendentes: number
}

export interface CriarProdutoDeparaPayload {
  codigo: string
  nome: string
  unidade?: string
  ncm?: string
  cEAN?: string | null
  fornecedorId: string
  codigoProdutoFornecedor: string
  descricaoFornecedor?: string
  unidadeFornecedor: string
  fatorConversao: number
  cEANTrib?: string | null
}

// ─── Query Key ───────────────────────────────────────────────────────────────

const KEY = 'depara-fornecedor'

// ─── Hooks ───────────────────────────────────────────────────────────────────

/** Lista paginada de De-Para com filtros */
export function useDepara(filtros?: DeparaFiltros) {
  return useQuery<{ data: DeparaFornecedor[]; total: number }>({
    queryKey: [KEY, filtros],
    queryFn: async () => {
      const { data } = await api.get('/depara-fornecedor', { params: filtros })
      return data
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  })
}

/** Criar novo mapeamento De-Para */
export function useDeparaCreate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: DeparaCreatePayload) => {
      const { data } = await api.post('/depara-fornecedor', body)
      return data as DeparaFornecedor
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

/** Atualizar mapeamento De-Para existente */
export function useDeparaUpdate() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: DeparaUpdatePayload) => {
      const { data } = await api.put(`/depara-fornecedor/${id}`, body)
      return data as DeparaFornecedor
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

/** Excluir mapeamento De-Para */
export function useDeparaDelete() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/depara-fornecedor/${id}`)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

/** Upload XML e resolução com De-Para */
export function useImportarXmlDepara() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post('/notas-entrada/importar-xml-depara', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data as ImportarXmlDeparaResponse
    },
  })
}

/** Criar Produto + SKU + De-Para em transação */
export function useCriarProdutoDepara() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: CriarProdutoDeparaPayload) => {
      const { data } = await api.post('/notas-entrada/criar-produto-depara', body)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEY] })
      qc.invalidateQueries({ queryKey: ['produtos'] })
    },
  })
}
