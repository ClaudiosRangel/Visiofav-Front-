import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// ===== Interfaces =====

interface SugestaoResultado {
  sugestao: 'ENDERECO_FIXO' | 'CONSOLIDAR' | 'ENDERECO_LIVRE'
  enderecoId: string
  enderecoCompleto: string
  motivo: string
  rua: string | null
  predio: string | null
  nivel: string | null
  apto: string | null
}

interface SugestaoItem {
  itemId: string
  produtoId: string
  produtoCodigo: string
  produtoNome: string
  quantidade: number
  lote: string | null
  validade: string | null
  sugestao: SugestaoResultado | null
}

interface SugerirLoteResponse {
  sugestoes: SugestaoItem[]
}

interface ConfirmarLoteItem {
  itemNotaEntradaId: string
  produtoId: string
  enderecoId: string
  quantidade: number
  lote?: string
  validade?: string
}

interface ConfirmarLoteBody {
  notaEntradaId: string
  itens: ConfirmarLoteItem[]
}

interface ConfirmarLoteResponse {
  message: string
  itensEnderecados: number
  etiquetas: Array<{ itemId: string; enderecoCompleto: string; produtoNome: string }>
}

interface ProgressoItem {
  itemId: string
  item: number
  codigoProduto: string
  descricao: string
  quantidade: number
  lote: string | null
  validade: string | null
  enderecoDestino: string | null
  status: 'PENDENTE' | 'ENDERECADO'
}

interface ProgressoResponse {
  notaEntradaId: string
  totalItens: number
  itensEnderecados: number
  percentual: number
  itens: ProgressoItem[]
}

interface ValidarEnderecoResponse {
  valido: boolean
  endereco?: { id: string; enderecoCompleto: string; tipo: string; rua: string; predio: string; nivel: string }
  mensagem?: string
}

interface EtiquetaItem {
  enderecoCompleto: string
  produtoCodigo: string
  produtoNome: string
  quantidade: number
  lote?: string
  validade?: string
}

interface GerarEtiquetaBody {
  itens: EtiquetaItem[]
  quantidade: number
}

interface GerarEtiquetaZplBody extends GerarEtiquetaBody {
  larguraMm?: number
  alturaMm?: number
}

// ===== Query Keys =====

const KEYS = {
  sugerirLote: 'enderecamento-sugerir-lote',
  progresso: 'enderecamento-progresso',
}

// ===== Hooks =====

/** GET /enderecamento-wms/sugerir-lote?notaEntradaId=... */
export function useSugerirLote(notaEntradaId: string | null) {
  return useQuery<SugerirLoteResponse>({
    queryKey: [KEYS.sugerirLote, notaEntradaId],
    queryFn: async () => {
      const { data } = await api.get('/enderecamento-wms/sugerir-lote', {
        params: { notaEntradaId },
      })
      return data
    },
    enabled: !!notaEntradaId,
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  })
}

/** POST /enderecamento-wms/confirmar-lote */
export function useConfirmarLote() {
  const qc = useQueryClient()
  return useMutation<ConfirmarLoteResponse, Error, ConfirmarLoteBody>({
    mutationFn: async (body) => {
      const { data } = await api.post('/enderecamento-wms/confirmar-lote', body)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [KEYS.sugerirLote] })
      qc.invalidateQueries({ queryKey: [KEYS.progresso] })
      qc.invalidateQueries({ queryKey: ['conferencia-notas-conferidas'] })
      qc.invalidateQueries({ queryKey: ['enderecos-livres'] })
    },
  })
}

/** GET /enderecamento-wms/progresso/:notaEntradaId — polls every 5s when enabled */
export function useProgressoEnderecamento(notaEntradaId: string | null, enabled: boolean) {
  return useQuery<ProgressoResponse>({
    queryKey: [KEYS.progresso, notaEntradaId],
    queryFn: async () => {
      const { data } = await api.get(`/enderecamento-wms/progresso/${notaEntradaId}`)
      return data
    },
    enabled: !!notaEntradaId && enabled,
    refetchInterval: enabled ? 5000 : false,
    refetchOnWindowFocus: false,
  })
}

/** POST /enderecamento-wms/validar-endereco */
export function useValidarEndereco() {
  return useMutation<ValidarEnderecoResponse, Error, { enderecoId: string }>({
    mutationFn: async (body) => {
      const { data } = await api.post('/enderecamento-wms/validar-endereco', body)
      return data
    },
  })
}

/** POST /etiquetas/gerar-enderecamento — returns HTML */
export function useGerarEtiquetaEnderecamento() {
  return useMutation<string, Error, GerarEtiquetaBody>({
    mutationFn: async (body) => {
      const { data } = await api.post('/etiquetas/gerar-enderecamento', body, {
        responseType: 'text',
      })
      return data
    },
  })
}

/** POST /etiquetas/gerar-enderecamento-zpl — returns ZPL text */
export function useGerarEtiquetaEnderecamentoZpl() {
  return useMutation<string, Error, GerarEtiquetaZplBody>({
    mutationFn: async (body) => {
      const { data } = await api.post('/etiquetas/gerar-enderecamento-zpl', body, {
        responseType: 'text',
      })
      return data
    },
  })
}
