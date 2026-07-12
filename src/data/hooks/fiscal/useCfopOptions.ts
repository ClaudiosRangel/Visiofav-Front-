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
 * Busca os CFOPs cadastrados, opcionalmente filtrados por tipo (ENTRADA/SAIDA),
 * para uso em comboboxes de seleção (ex.: CFOP Entrada/Saída da tela de
 * Natureza de Operação, ou o campo único de CFOP do Motor Tributário, que
 * aceita qualquer CFOP independente da direção). Retorna as opções já no
 * formato esperado pelo Select do Mantine (`{ value, label }`), com o código
 * e a descrição no label para facilitar a busca (`searchable`).
 */
/** Limite máximo de `pageSize` aceito por GET /fiscal/cadastros/cfop. */
const PAGE_SIZE = 100

export function useCfopOptions(tipo?: 'ENTRADA' | 'SAIDA') {
  const { data, isLoading } = useQuery<CfopListItem[]>({
    queryKey: ['fiscal-cfop-options', tipo ?? 'TODOS'],
    queryFn: async () => {
      // A API pagina em blocos de no máximo 100 registros. Como cada tipo
      // (ENTRADA/SAIDA) tem mais de 250 CFOPs cadastrados — e a listagem é
      // ordenada por código (1xxx/2xxx/3xxx para entrada, 5xxx/6xxx/7xxx
      // para saída) — buscar só a primeira página deixava de fora os
      // âmbitos INTERESTADUAL (2xxx/6xxx) e EXTERIOR (3xxx/7xxx) por
      // completo, já que a página 1 só contém código iniciados por 1/5.
      // Por isso é necessário percorrer todas as páginas até esgotá-las.
      const params: Record<string, unknown> = { page: 1, pageSize: PAGE_SIZE }
      if (tipo) params.tipo = tipo

      const primeira = await api.get<CfopListResponse>('/fiscal/cadastros/cfop', { params })

      const todos = [...primeira.data.data]
      const totalPages = primeira.data.totalPages ?? 1

      for (let page = 2; page <= totalPages; page++) {
        const resp = await api.get<CfopListResponse>('/fiscal/cadastros/cfop', {
          params: { ...params, page },
        })
        todos.push(...resp.data.data)
      }

      return todos
    },
    staleTime: 1000 * 60 * 5,
  })

  const options = (data || []).map((c) => ({
    value: c.codigo,
    label: `${c.codigo} - ${c.descricao}`,
  }))

  return { options, isLoading }
}
