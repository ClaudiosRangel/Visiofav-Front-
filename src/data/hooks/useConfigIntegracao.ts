import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface ConfigIntegracao {
  integracaoAtiva: boolean
  sistemaExterno: string | null
}

const KEY = 'config-integracao'

export function useConfigIntegracao() {
  return useQuery<ConfigIntegracao>({
    queryKey: [KEY],
    queryFn: async () => {
      try {
        const { data } = await api.get('/config-integracao')
        return data?.data ?? data
      } catch (err: any) {
        if (err?.response?.status === 404) {
          return { integracaoAtiva: false, sistemaExterno: null }
        }
        throw err
      }
    },
    staleTime: 1000 * 60 * 5,
  })
}

export function useSalvarConfigIntegracao() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: ConfigIntegracao) => {
      const { data } = await api.post('/config-integracao', body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}
