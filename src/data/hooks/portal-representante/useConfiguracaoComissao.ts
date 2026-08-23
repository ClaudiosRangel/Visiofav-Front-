import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { ConfiguracaoComissao, AlterarComissaoPayload } from './types'

const QUERY_KEY = 'portal-rep-config-comissao'

export function useConfiguracaoComissao() {
  return useQuery<ConfiguracaoComissao>({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data } = await api.get('/portal-rep/admin/configuracao-comissao')
      return data
    },
  })
}

export function useAlterarConfiguracaoComissao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: AlterarComissaoPayload) => {
      const { data } = await api.put('/portal-rep/admin/configuracao-comissao', body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [QUERY_KEY] }),
  })
}
