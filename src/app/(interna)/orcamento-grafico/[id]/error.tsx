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

  // Em produção o React minifica os erros (ex.: "Minified React error #31")
  // e joga o detalhe (as chaves do objeto renderizado por engano) na query
  // string `?args[]=`. Decodificamos aqui para exibir uma mensagem legível na
  // própria tela, sem depender de abrir o console/link do react.dev.
  const detalheDecodificado = decodeReactMinifiedError(error?.message)

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
          {detalheDecodificado && (
            <Alert color="orange" variant="light" title="Detalhe decodificado">
              <Text size="sm">{detalheDecodificado}</Text>
            </Alert>
          )}
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

/**
 * Decodifica a mensagem de um erro React minificado em produção.
 *
 * O React de produção emite mensagens como:
 *   "Minified React error #31; visit https://react.dev/errors/31?args[]=object%20with%20keys%20%7Bnome%2C%20tipo%7D&args[]=..."
 *
 * O erro #31 ("Objects are not valid as a React child") inclui, no primeiro
 * `args[]`, a descrição do objeto renderizado por engano — tipicamente
 * "object with keys {campoA, campoB}". Extraímos e exibimos isso para apontar
 * direto o campo problemático, sem depender de abrir o console ou o link.
 */
function decodeReactMinifiedError(message?: string | null): string | null {
  if (!message) return null

  const numeroMatch = message.match(/Minified React error #(\d+)/)
  if (!numeroMatch) return null
  const numero = numeroMatch[1]

  // Coleta todos os args[] da query string e decodifica.
  const args: string[] = []
  const regex = /args\[\]=([^&\s]+)/g
  let m: RegExpExecArray | null
  while ((m = regex.exec(message)) !== null) {
    try {
      args.push(decodeURIComponent(m[1]))
    } catch {
      args.push(m[1])
    }
  }

  if (numero === '31') {
    const alvo = args[0] || 'um objeto'
    return `React #31 — "Objects are not valid as a React child". ` +
      `Um objeto está sendo renderizado como texto (encontrado: ${alvo}). ` +
      `Procure por esse objeto sendo exibido direto no JSX desta tela.`
  }

  if (args.length) {
    return `React #${numero} — detalhes: ${args.join(' | ')}`
  }
  return `React #${numero} (sem detalhes adicionais na mensagem minificada).`
}
