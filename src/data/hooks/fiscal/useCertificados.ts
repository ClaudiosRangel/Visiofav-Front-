import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

// === Hook useCertificados ===

export function useCertificados() {
  function useUpload() {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async ({ file, senha }: { file: File; senha: string }) => {
        const formData = new FormData()
        formData.append('arquivo', file)
        formData.append('senha', senha)
        const { data } = await api.post('/fiscal/certificados/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        return data
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal-certificados'] }),
    })
  }

  return { useUpload }
}
