import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface Sku {
  id: string
  sequencia: number
  descricao?: string
  codigoBarra?: string
  unidade: string
  qtdEmbalagem: number
  largura?: number
  altura?: number
  comprimento?: number
  volume?: number
  pesoLiquido?: number
  pesoBruto?: number
  pesoPalete?: number
  lastro?: number
  camada?: number
  tipoPalete?: string
  status: boolean
  produtoId: string
}

const KEY = 'skus'

export function useSkus(produtoId: string | null) {
  return useQuery<{ data: Sku[] }>({
    queryKey: [KEY, produtoId],
    queryFn: async () => {
      const { data } = await api.get('/skus', { params: { produtoId } })
      return data
    },
    enabled: !!produtoId,
    staleTime: 1000 * 60 * 5,
  })
}

export function useCriarSku() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: Partial<Sku> & { produtoId: string }) => {
      const { data } = await api.post('/skus', body)
      return data
    },
    onSuccess: (_data, variables) => qc.invalidateQueries({ queryKey: [KEY, variables.produtoId] }),
  })
}

export function useAtualizarSku() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, ...body }: Partial<Sku> & { id: string }) => {
      const { data } = await api.put(`/skus/${id}`, body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}

export function useExcluirSku() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, produtoId }: { id: string; produtoId: string }) => {
      await api.delete(`/skus/${id}`)
      return produtoId
    },
    onSuccess: (_data, variables) => qc.invalidateQueries({ queryKey: [KEY, variables.produtoId] }),
  })
}
