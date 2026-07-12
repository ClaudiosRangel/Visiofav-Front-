import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface NcmListItem {
  codigo: string
  descricao: string
}

interface NcmListResponse {
  data: NcmListItem[]
  total: number
}

/**
 * Busca NCMs cadastrados para uso em combobox de seleção (ex.: campo NCM da
 * tela Motor Tributário). Diferente de CFOP/CST/CSOSN — o cadastro de NCM
 * tem mais de 10 mil códigos, então carregar tudo de uma vez não é viável;
 * a busca é feita no servidor conforme o usuário digita (`search`), com o
 * mesmo endpoint paginado usado pela tela de cadastro de NCM.
 */
export function useNcmOptions(search: string) {
  const { data, isLoading } = useQuery<NcmListResponse>({
    queryKey: ['fiscal-ncm-options', search],
    queryFn: async () => {
      const { data } = await api.get<NcmListResponse>('/fiscal/cadastros/ncm', {
        params: { q: search || undefined, page: 1, pageSize: 30 },
      })
      return data
    },
    staleTime: 1000 * 60 * 5,
  })

  const options = (data?.data || []).map((n) => ({
    value: n.codigo,
    label: `${n.codigo} - ${n.descricao}`,
  }))

  return { options, isLoading }
}
