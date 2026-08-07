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
        // Extrair CNPJ do nome do arquivo se possível (padrão: "EMPRESA LTDA_CNPJ.pfx")
        const cnpjMatch = file.name.match(/(\d{14})/)
        if (cnpjMatch) formData.append('cnpj', cnpjMatch[1])
        const { data } = await api.post('/fiscal/certificados', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        })
        return data
      },
      onSuccess: () => qc.invalidateQueries({ queryKey: ['fiscal-certificados'] }),
    })
  }

  return { useUpload }
}
