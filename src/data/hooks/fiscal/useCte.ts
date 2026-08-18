import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { FiscalFilters, PaginatedResponse, DocumentoFiscal } from './types'

export function useCte() {
  function useListar(params?: FiscalFilters) {
    return useQuery<PaginatedResponse<DocumentoFiscal>>({
      queryKey: ['fiscal', 'cte', params],
      queryFn: async () => {
        const { data } = await api.get('/fiscal/cte', { params })
        return data
      },
      staleTime: 1000 * 60 * 2,
    })
  }

  function useDetalhe(id: string | null) {
    return useQuery({
      queryKey: ['fiscal', 'cte', id],
      queryFn: async () => {
        const { data } = await api.get(`/fiscal/cte/${id}`)
        return data
      },
      enabled: !!id,
    })
  }

  function useEmitir() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async (payload: any) => {
        const { data } = await api.post('/fiscal/cte/gravar', payload)
        return data
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal', 'cte'] }),
    })
  }

  function useGravar() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async (payload: any) => {
        const { data } = await api.post('/fiscal/cte/gravar', payload)
        return data
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal', 'cte'] }),
    })
  }

  function useAtualizar() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async ({ id, payload }: { id: string; payload: any }) => {
        const { data } = await api.put(`/fiscal/cte/${id}`, payload)
        return data
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal', 'cte'] }),
    })
  }

  function useTransmitir() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async (id: string) => {
        const { data } = await api.post(`/fiscal/cte/${id}/transmitir`)
        return data
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal', 'cte'] }),
    })
  }

  function useCancelar() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async ({ id, justificativa }: { id: string; justificativa: string }) => {
        const { data } = await api.post(`/fiscal/cte/${id}/cancelar`, { justificativa })
        return data
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal', 'cte'] }),
    })
  }

  function useCartaCorrecao() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async ({ id, textoCorrecao, grupoAlterado, campoAlterado }: {
        id: string; textoCorrecao: string; grupoAlterado?: string; campoAlterado?: string
      }) => {
        const { data } = await api.post(`/fiscal/cte/${id}/carta-correcao`, {
          textoCorrecao, grupoAlterado, campoAlterado,
        })
        return data
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal', 'cte'] }),
    })
  }

  function useInutilizar() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async (payload: {
        serie: number; numeroInicial: number; numeroFinal: number; justificativa: string
      }) => {
        const { data } = await api.post('/fiscal/cte/inutilizar', payload)
        return data
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal', 'cte'] }),
    })
  }

  function useDuplicar() {
    return useMutation({
      mutationFn: async (id: string) => {
        const { data } = await api.post(`/fiscal/cte/${id}/duplicar`)
        return data
      },
    })
  }

  function useEnviarEmail() {
    return useMutation({
      mutationFn: async ({ id, emails, incluirPdf, incluirXml }: {
        id: string; emails: string[]; incluirPdf?: boolean; incluirXml?: boolean
      }) => {
        const { data } = await api.post(`/fiscal/cte/${id}/enviar-email`, { emails, incluirPdf, incluirXml })
        return data
      },
    })
  }

  function useTransmitirLote() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async (ids: string[]) => {
        const { data } = await api.post('/fiscal/cte/transmitir-lote', { ids })
        return data
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal', 'cte'] }),
    })
  }

  function useEnviarEmailLote() {
    return useMutation({
      mutationFn: async ({ ids, emails, incluirPdf, incluirXml }: {
        ids: string[]; emails: string[]; incluirPdf?: boolean; incluirXml?: boolean
      }) => {
        const { data } = await api.post('/fiscal/cte/enviar-email-lote', { ids, emails, incluirPdf, incluirXml })
        return data
      },
    })
  }

  function useCancelarLote() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async ({ ids, justificativa }: { ids: string[]; justificativa: string }) => {
        const { data } = await api.post('/fiscal/cte/cancelar-lote', { ids, justificativa })
        return data
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal', 'cte'] }),
    })
  }

  function useListarCores() {
    return useQuery({
      queryKey: ['fiscal', 'cte', 'cores'],
      queryFn: async () => {
        const { data } = await api.get('/fiscal/cte/cores')
        return data as Array<{ id: string; codigo: string; descricao: string }>
      },
      staleTime: 1000 * 60 * 30,
    })
  }

  function useCriarCor() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async (payload: { codigo: string; descricao: string }) => {
        const { data } = await api.post('/fiscal/cte/cores', payload)
        return data
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal', 'cte', 'cores'] }),
    })
  }

  function useSeedCores() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async () => {
        const { data } = await api.post('/fiscal/cte/cores/seed')
        return data
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal', 'cte', 'cores'] }),
    })
  }

  function useDefaults() {
    return useQuery({
      queryKey: ['fiscal', 'cte', 'defaults'],
      queryFn: async () => {
        const { data } = await api.get('/fiscal/cte/defaults')
        return data as {
          rntrc: string
          serie: number
          ambiente: number
          ufEmitente: string
          naturezaOp: string
          modal: string
          cstIcms: string
          aliqIcms: number
          seguradora: string
          apolice: string
        }
      },
      staleTime: 1000 * 60 * 10,
    })
  }

  function useSalvarDefaults() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async (payload: Record<string, any>) => {
        const { data } = await api.put('/fiscal/cte/defaults', payload)
        return data
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal', 'cte', 'defaults'] }),
    })
  }

  async function buscarParticipante(cpfCnpj: string) {
    const { data } = await api.get(`/fiscal/cte/buscar-participante/${cpfCnpj.replace(/\D/g, '')}`)
    return data
  }

  function baixarDacte(id: string) {
    return api.get(`/fiscal/cte/${id}/dacte`, { responseType: 'blob' })
  }

  function baixarXml(id: string) {
    return api.get(`/fiscal/cte/${id}/xml`, { responseType: 'blob' })
  }

  return {
    useListar,
    useDetalhe,
    useEmitir,
    useGravar,
    useAtualizar,
    useTransmitir,
    useCancelar,
    useCartaCorrecao,
    useInutilizar,
    useDuplicar,
    useEnviarEmail,
    useTransmitirLote,
    useEnviarEmailLote,
    useCancelarLote,
    useListarCores,
    useCriarCor,
    useSeedCores,
    useDefaults,
    useSalvarDefaults,
    buscarParticipante,
    baixarDacte,
    baixarXml,
  }
}
