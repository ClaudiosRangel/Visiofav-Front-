import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface ListResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export function useCrudGenerico<T extends { id: string }>(endpoint: string, queryKey: string) {
  function useListar(params?: Record<string, unknown>) {
    return useQuery<ListResponse<T>>({
      queryKey: [queryKey, params],
      queryFn: async () => {
        const { data } = await api.get(endpoint, { params })
        return data
      },
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    })
  }

  function useCriar() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async (body: Partial<T>) => {
        const { data } = await api.post(endpoint, body)
        return data
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
    })
  }

  function useAtualizar() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async ({ id, ...body }: Partial<T> & { id: string }) => {
        const { data } = await api.put(`${endpoint}/${id}`, body)
        return data
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
    })
  }

  function useExcluir() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async (id: string) => {
        await api.delete(`${endpoint}/${id}`)
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: [queryKey] }),
    })
  }

  return { useListar, useCriar, useAtualizar, useExcluir }
}

// Instâncias prontas para cada cadastro
export const zonasCrud = useCrudGenerico('/zonas', 'zonas')
export const estruturasCrud = useCrudGenerico('/estruturas', 'estruturas')
export const formasArmazenagemCrud = useCrudGenerico('/formas-armazenagem', 'formas-armazenagem')
export const ambientesArmazenagemCrud = useCrudGenerico('/ambientes-armazenagem', 'ambientes-armazenagem')
export const classificacoesProdutoCrud = useCrudGenerico('/classificacoes-produto', 'classificacoes-produto')
export const funcoesCrud = useCrudGenerico('/funcoes', 'funcoes')
export const equipamentosCrud = useCrudGenerico('/equipamentos', 'equipamentos')
export const tiposCarroceriaCrud = useCrudGenerico('/tipos-carroceria', 'tipos-carroceria')
export const tiposCargaCrud = useCrudGenerico('/tipos-carga', 'tipos-carga')
export const fornecedoresCrud = useCrudGenerico('/fornecedores', 'fornecedores')
export const transportadorasCrud = useCrudGenerico('/transportadoras', 'transportadoras')
export const clientesCrud = useCrudGenerico('/clientes', 'clientes')
