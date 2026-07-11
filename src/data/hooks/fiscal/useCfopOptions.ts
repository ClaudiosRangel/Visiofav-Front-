import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface CfopListItem {
  codigo: string
  descricao: string
  tipo: 'ENTRADA' | 'SAIDA'
}

interface CfopListResponse {
  data: CfopListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * Busca os CFOPs cadastrados filtrados por tipo (ENTRADA/SAIDA), para uso em
 * comboboxes de seleção (ex.: CFOP Entrada/Saída da tela de Natureza de
 * Operação). Retorna as opções já no formato esperado pelo Select do Mantine
 * (`{ value, label }`), com o código e a descrição no label para facilitar
 * a busca (`searchable`).
 */
export function useCfopOptions(tipo: 'ENTRADA' | 'SAIDA') {
  const { data, isLoading } = useQuery<CfopListResponse>({
    queryKey: ['fiscal-cfop-options', tipo],
    queryFn: async () => {
      const { data } = await api.get('/fiscal/cadastros/cfop', {
        params: { tipo, pageSize: 100 },
      })
      return data
    },
    staleTime: 1000 * 60 * 5,
  })

  const options = (data?.data || []).map((c) => ({
    value: c.codigo,
    label: `${c.codigo} - ${c.descricao}`,
  }))

  return { options, isLoading }
}
