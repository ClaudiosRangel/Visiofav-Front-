'use client'

/**
 * Aviso global "Aguarde, atualizando versão…" exibido enquanto o backend está
 * sendo publicado. Some sozinho quando o backend volta (ver lib/backend-status.ts).
 * Montado nos providers de cada grupo de rotas (ERP e Portal do Representante).
 */
import { useEffect, useState, useSyncExternalStore } from 'react'
import { Button, Loader, Paper, Stack, Text, Title } from '@mantine/core'
import {
  assinarEstadoBackend,
  lerEstadoBackend,
  lerEstadoBackendServidor,
  segundosDesdeIndisponivel,
} from '@/lib/backend-status'

export default function BackendAtualizandoAviso() {
  const estado = useSyncExternalStore(assinarEstadoBackend, lerEstadoBackend, lerEstadoBackendServidor)
  const [segundos, setSegundos] = useState(0)

  useEffect(() => {
    if (estado === 'ok') { setSegundos(0); return }
    const id = setInterval(() => setSegundos(segundosDesdeIndisponivel()), 1000)
    return () => clearInterval(id)
  }, [estado])

  if (estado === 'ok') return null

  const demorando = estado === 'demorando'
  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      aria-label="Atualizando versão"
      style={{
        position: 'fixed', inset: 0, zIndex: 10000,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)',
        padding: 16,
      }}
    >
      <Paper withBorder shadow="lg" radius="md" p="xl" maw={420} w="100%">
        <Stack align="center" gap="sm">
          <Loader size="lg" />
          <Title order={3} ta="center">Aguarde, atualizando versão…</Title>
          <Text ta="center" c="dimmed" size="sm">
            O sistema está sendo atualizado e volta em instantes. Não feche esta janela:
            assim que terminar, você continua de onde parou.
          </Text>
          {segundos > 0 && (
            <Text size="xs" c="dimmed">Aguardando há {segundos}s</Text>
          )}
          {demorando && (
            <>
              <Text ta="center" size="sm" c="orange">
                Está demorando mais que o normal. Se continuar assim, recarregue a página.
              </Text>
              <Button variant="light" onClick={() => window.location.reload()}>Recarregar página</Button>
            </>
          )}
        </Stack>
      </Paper>
    </div>
  )
}
