import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// === Hook useGnre ===

export function useGnre() {
  function usePagar() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async (id: string) => {
        const { data } = await api.post(`/fiscal/gnre/${id}/pagar`)
        return data
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal-gnre'] }),
    })
  }

  return { usePagar }
}
