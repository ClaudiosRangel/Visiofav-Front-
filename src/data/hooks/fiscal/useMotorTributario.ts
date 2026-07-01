import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { SimulacaoMotorPayload, SimulacaoMotorResponse } from './types'

export function useMotorTributario() {
  function useSimular() {
    return useMutation<SimulacaoMotorResponse, Error, SimulacaoMotorPayload>({
      mutationFn: async (payload) => {
        const { data } = await api.post('/fiscal/motor-tributario/simular', payload)
        return data
      },
    })
  }

  return { useSimular }
}
