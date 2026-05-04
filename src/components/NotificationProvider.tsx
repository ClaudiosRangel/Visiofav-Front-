'use client'

import { useEffect, useRef } from 'react'
import { notifications } from '@mantine/notifications'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333'

const eventoConfig: Record<string, { title: string; color: string; icon: string }> = {
  'veiculo.chegou': { title: '🚛 Veículo na Portaria', color: 'blue', icon: '🚛' },
  'conferencia.concluida': { title: '✅ Conferência Concluída', color: 'green', icon: '✅' },
  'enderecamento.concluido': { title: '📦 Endereçamento Concluído', color: 'teal', icon: '📦' },
  'os.criada': { title: '📋 Nova OS Criada', color: 'blue', icon: '📋' },
  'os.concluida': { title: '✅ OS Concluída', color: 'green', icon: '✅' },
  'estoque.baixo': { title: '⚠️ Estoque Baixo', color: 'orange', icon: '⚠️' },
  'onda.criada': { title: '🌊 Nova Onda de Separação', color: 'grape', icon: '🌊' },
  'carregamento.concluido': { title: '🚚 Carregamento Concluído', color: 'green', icon: '🚚' },
}

export default function NotificationProvider({ children }: { children: React.ReactNode }) {
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    // Conectar ao SSE
    try {
      const es = new EventSource(`${API_URL}/api/eventos`)
      eventSourceRef.current = es

      es.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.evento === 'heartbeat' || data.evento === 'conectado') return

          const config = eventoConfig[data.evento]
          if (config) {
            notifications.show({
              title: config.title,
              message: data.dados?.message || data.dados?.descricao || JSON.stringify(data.dados),
              color: config.color,
              autoClose: 8000,
            })
          }
        } catch {
          // Ignorar mensagens inválidas
        }
      }

      es.onerror = () => {
        // Reconectar após 5s
        es.close()
        setTimeout(() => {
          if (eventSourceRef.current === es) {
            eventSourceRef.current = null
          }
        }, 5000)
      }
    } catch {
      // SSE não disponível
    }

    return () => {
      eventSourceRef.current?.close()
      eventSourceRef.current = null
    }
  }, [])

  return <>{children}</>
}
