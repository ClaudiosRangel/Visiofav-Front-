import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { PaginatedResponse, FiscalFilters } from './types'

// === Tipos Importação XML ===

export interface ImportacaoXml {
  id: string
  chaveAcesso: string
  fornecedor: string
  valor: number
  data: string
  status: 'IMPORTADO' | 'PROCESSADO' | 'ERRO'
}

// === Hook useImportacaoXml ===

export function useImportacaoXml() {
  function useListar(params?: FiscalFilters) {
    return useQuery<PaginatedResponse<ImportacaoXml>>({
      queryKey: ['fiscal', 'importacao-xml', params],
      queryFn: async () => {
        const { data } = await api.get('/fiscal/importacao', { params })
        return data
      },
    })
  }

  function useUpload() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async (files: File[]) => {
        const formData = new FormData()
        files.forEach((f) => formData.append('arquivos', f))
        const { data } = await api.post('/fiscal/importacao/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        return data
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal', 'importacao-xml'] }),
    })
  }

  function useGerarEntrada() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async (id: string) => {
        const { data } = await api.post(`/fiscal/importacao/${id}/gerar-entrada`)
        return data
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal', 'importacao-xml'] }),
    })
  }

  return { useListar, useUpload, useGerarEntrada }
}
