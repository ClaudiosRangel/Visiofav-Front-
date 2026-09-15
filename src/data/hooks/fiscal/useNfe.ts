import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { FiscalFilters, PaginatedResponse, DocumentoFiscal, EmissaoNfePayload } from './types'

export function useNfe() {
  function useListar(params?: FiscalFilters) {
    return useQuery<PaginatedResponse<DocumentoFiscal>>({
      queryKey: ['fiscal', 'nfe', params],
      queryFn: async () => {
        const { data } = await api.get('/fiscal/nfe', { params })
        return data
      },
      staleTime: 1000 * 60 * 2,
    })
  }

  function useDetalhe(id: string) {
    return useQuery<DocumentoFiscal>({
      queryKey: ['fiscal', 'nfe', id],
      queryFn: async () => {
        const { data } = await api.get(`/fiscal/nfe/${id}`)
        return data
      },
      enabled: !!id,
    })
  }

  function useEmitir() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async (payload: EmissaoNfePayload) => {
        const { data } = await api.post('/fiscal/nfe/emitir', payload)
        return data
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal', 'nfe'] }),
    })
  }

  function useCancelar() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async ({ id, justificativa }: { id: string; justificativa: string }) => {
        const { data } = await api.post(`/fiscal/nfe/${id}/cancelar`, { justificativa })
        return data
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal', 'nfe'] }),
    })
  }

  function useCartaCorrecao() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async ({ id, textoCorrecao }: { id: string; textoCorrecao: string }) => {
        const { data } = await api.post(`/fiscal/nfe/${id}/cce`, { textoCorrecao })
        return data
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal', 'nfe'] }),
    })
  }

  // Reprocessa (retransmite) uma NF-e REJEITADA — reemite e reamarra financeiro/estoque
  function useRetransmitir() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async ({ id }: { id: string }) => {
        const { data } = await api.post(`/fiscal/nfe/${id}/retransmitir`)
        return data
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal', 'nfe'] }),
    })
  }

  return { useListar, useDetalhe, useEmitir, useCancelar, useCartaCorrecao, useRetransmitir }
}

/**
 * Abre a DANFE (PDF) em nova aba. O backend exige Authorization no header, então
 * baixamos via axios (que injeta o token) e abrimos como blob.
 */
export async function abrirDanfe(id: string) {
  const { data } = await api.get(`/fiscal/nfe/${id}/danfe`, { responseType: 'blob' })
  const url = URL.createObjectURL(data)
  window.open(url, '_blank')
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

/** Baixa o XML autorizado (nfeProc) da NF-e. */
export async function baixarXmlNfe(id: string, chaveAcesso?: string | null) {
  const { data } = await api.get(`/fiscal/nfe/${id}/xml`, { responseType: 'blob' })
  const url = URL.createObjectURL(data)
  const a = document.createElement('a')
  a.href = url
  a.download = `NFe-${chaveAcesso || id}.xml`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}
