import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

interface AIResponse {
  resposta: string
  acao?: {
    tipo: 'NAVEGAR' | 'EXECUTAR' | 'MOSTRAR_DADOS'
    rota?: string
    params?: Record<string, any>
    resultado?: any
  }
  sugestoes?: string[]
}

export function useVizorChat() {
  return useMutation({
    mutationFn: async ({ mensagem, historico }: { mensagem: string; historico?: ChatMessage[] }) => {
      const { data } = await api.post('/ai/chat', { mensagem, historico })
      return data as AIResponse
    },
  })
}

export function useSugestoesAI(pagina?: string) {
  return useMutation({
    mutationFn: async () => {
      const { data } = await api.get('/ai/sugestoes', { params: { pagina } })
      return data as { sugestoes: string[] }
    },
  })
}

export function useVizorUpload() {
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await api.post('/ai/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      return data as AIResponse
    },
  })
}

export type { ChatMessage, AIResponse }
