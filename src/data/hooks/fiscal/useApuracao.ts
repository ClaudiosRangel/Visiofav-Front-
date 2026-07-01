import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// === Tipos Apuração ===

export interface ApuracaoFiscal {
  id: string
  tipo: 'ICMS' | 'ICMS_ST' | 'PIS' | 'COFINS' | 'IPI'
  periodo: string
  totalDebitos: number
  totalCreditos: number
  saldoFinal: number
  valorRecolher: number
  fechado: boolean
}

// === Hook useApuracao ===

export function useApuracao() {
  function useConsultar(tipo: string, periodo: string) {
    return useQuery<ApuracaoFiscal>({
      queryKey: ['fiscal', 'apuracao', tipo, periodo],
      queryFn: async () => {
        const { data } = await api.get(`/fiscal/apuracao/${tipo}`, { params: { periodo } })
        return data
      },
      enabled: !!tipo && !!periodo,
    })
  }

  function useCalcular() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async ({ tipo, periodo }: { tipo: string; periodo: string }) => {
        const { data } = await api.post(`/fiscal/apuracao/${tipo}/calcular`, { periodo })
        return data
      },
      onSuccess: (_, vars) => {
        qc.invalidateQueries({ queryKey: ['fiscal', 'apuracao', vars.tipo, vars.periodo] })
      },
    })
  }

  return { useConsultar, useCalcular }
}
