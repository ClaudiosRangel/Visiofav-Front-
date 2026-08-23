import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { AprovacaoCliente } from './types'

const QUERY_KEY = 'portal-rep-aprovacoes'

export function useAprovacoesCliente() {
  return useQuery<AprovacaoCliente[]>({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data } = await api.get('/portal-rep/admin/aprovacoes-cliente')
      return data
    },
  })
}
