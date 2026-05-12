import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// ===== Interfaces =====

export interface OcupacaoEndereco {
  id: string
  enderecoCompleto: string
  rua: string
  predio: string
  nivel: string
  apartamento: string
  status: 'VAZIO' | 'PARCIAL' | 'CHEIO' | 'BLOQUEADO'
  areaArmazenagem?: 'PICKING' | 'PULMAO'
  percentualOcupacao: number
  capacidadePalete: number
  saldoAtual: number
  produto?: {
    id: string
    nome: string
    quantidade: number
    lote?: string
  }
}

export interface OcupacaoResponse {
  enderecos: OcupacaoEndereco[]
}

export interface Alocacao {
  enderecoId: string
  enderecoCompleto: string
  rua: string
  predio: string
  nivel: string
  apartamento: string
  quantidadeAlocada: number
}

export interface DistribuicaoResult {
  alocacoes: Alocacao[]
  quantidadeTotal: number
  quantidadeAlocada: number
  quantidadeRestante: number
  completa: boolean
}

export interface DistribuirInput {
  produtoId: string
  quantidade: number
  lote?: string
  validade?: string
  skuId?: string
}

export interface ConfirmarInput {
  produtoId: string
  alocacoes: Array<{
    enderecoId: string
    enderecoCompleto: string
    quantidadeAlocada: number
  }>
  lote?: string
  validade?: string
}

export interface ConfirmarResponse {
  message: string
  alocacoesConfirmadas: number
  quantidadeTotal: number
}

// ===== Query Keys =====

const KEYS = {
  ocupacao: 'enderecamento-inteligente-ocupacao',
  distribuicao: 'enderecamento-inteligente-distribuicao',
}

// ===== Hooks =====

/** GET /enderecamento-inteligente/ocupacao?depositoId=xxx */
export function useOcupacaoArmazem(depositoId: string | null) {
  return useQuery<OcupacaoResponse>({
    queryKey: [KEYS.ocupacao, depositoId],
    queryFn: async () => {
      const { data } = await api.get('/enderecamento-inteligente/ocupacao', {
        params: { depositoId },
      })
      return data
    },
    enabled: !!depositoId,
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  })
}

/** POST /enderecamento-inteligente/distribuir */
export function useDistribuicaoInteligente() {
  return useMutation<DistribuicaoResult, Error, DistribuirInput>({
    mutationFn: async (body) => {
      const { data } = await api.post('/enderecamento-inteligente/distribuir', body)
      return data
    },
  })
}

/** POST /enderecamento-inteligente/confirmar */
export function useConfirmarDistribuicao() {
  const qc = useQueryClient()
  return useMutation<ConfirmarResponse, Error, ConfirmarInput>({
    mutationFn: async (body) => {
      const { data } = await api.post('/enderecamento-inteligente/confirmar', body)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEYS.ocupacao] })
    },
  })
}
