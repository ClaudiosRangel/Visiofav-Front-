'use client'

/**
 * Error Boundary da rota de detalhe do orçamento gráfico.
 *
 * Em vez de a tela ficar BRANCA (exceção de cliente não capturada), este
 * boundary mostra a mensagem/stack do erro de forma legível, para diagnóstico.
 * O botão "Tentar novamente" tenta re-renderizar a rota (reset do Next).
 *
 * Next.js App Router: um arquivo `error.tsx` numa pasta de rota captura
 * exceções lançadas durante o render dos componentes daquela rota.
 */

import { useEffect } from 'react'
import { Stack, Alert, Button, Group, Code, Text, ScrollArea } from '@mantine/core'
import { IconAlertTriangle, IconRefresh, IconArrowLeft } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'

export default function OrcamentoDetalheError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    // Loga no console do navegador para inspeção adicional.
    console.error('[orcamento-grafico/[id]] erro de render:', error)
  }, [error])

  return (
    <Stack gap="md" p="md">
      <Alert
        icon={<IconAlertTriangle size={18} />}
        color="red"
        title="Erro ao exibir o orçamento"
      >
        <Stack gap="xs">
          <Text size="sm">
            Ocorreu um erro ao renderizar esta tela. A mensagem técnica abaixo
            ajuda a identificar a causa:
          </Text>
          <ScrollArea.Autosize mah={300}>
            <Code block style={{ whiteSpace: 'pre-wrap' }}>
              {error?.message || 'Erro desconhecido'}
              {error?.digest ? `\n\ndigest: ${error.digest}` : ''}
              {error?.stack ? `\n\n${error.stack}` : ''}
            </Code>
          </ScrollArea.Autosize>
        </Stack>
      </Alert>

      <Group>
        <Button leftSection={<IconRefresh size={16} />} onClick={() => reset()}>
          Tentar novamente
        </Button>
        <Button
          variant="light"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => router.push('/orcamento-grafico')}
        >
          Voltar à lista
        </Button>
      </Group>
    </Stack>
  )
}
