import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface Transportadora {
  id: string
  razaoSocial: string
  cnpj?: string
}

export function useTransportadoras() {
  return useQuery<{ data: Transportadora[] }>({
    queryKey: ['transportadoras-select'],
    queryFn: async () => {
      const { data } = await api.get('/transportadoras', { params: { limit: 100 } })
      return data
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  })
}
