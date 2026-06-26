import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

export interface ConfigEmailFiscal {
  email: string
}

const KEY = 'config-email-fiscal'

export function useConfigEmailFiscal() {
  return useQuery<ConfigEmailFiscal | null>({
    queryKey: [KEY],
    queryFn: async () => {
      const { data } = await api.get('/config-email-fiscal')
      return data?.data ?? data ?? null
    },
    staleTime: 1000 * 60 * 5,
  })
}

export function useSalvarConfigEmailFiscal() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: ConfigEmailFiscal) => {
      const { data } = await api.post('/config-email-fiscal', body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [KEY] }),
  })
}
