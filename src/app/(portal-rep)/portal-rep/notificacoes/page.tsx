'use client'

import { useCallback, useState } from 'react'
import { Button, Card, Group, Stack, Text, Title } from '@mantine/core'
import { IconBell, IconChecks } from '@tabler/icons-react'
import {
  usePortalRepNotificacoes,
  useMarcarLida,
  useMarcarTodasLidas,
} from '@/data/hooks/portal-rep-app/usePortalRepNotificacoes'
import type { Notificacao } from '@/data/hooks/portal-rep-app/types'
import { formatarDataHora } from '@/components/portal-rep/formatters'
import { PullToRefresh } from '@/components/portal-rep/PullToRefresh'
import { SkeletonCard } from '@/components/portal-rep/SkeletonCard'
import { EmptyState } from '@/components/portal-rep/EmptyState'

const PAGE_SIZE = 20

export default function NotificacoesPage() {
  const [page, setPage] = useState(1)

  const { data, isLoading, refetch } = usePortalRepNotificacoes({
    page,
    pageSize: PAGE_SIZE,
  })

  const marcarLida = useMarcarLida()
  const marcarTodasLidas = useMarcarTodasLidas()

  const notificacoes = data?.notificacoes ?? []
  const total = data?.total ?? 0
  const temMais = notificacoes.length < total && page * PAGE_SIZE < total

  // Acumula notificações de páginas anteriores para efeito de "Carregar mais"
  const [acumuladas, setAcumuladas] = useState<Notificacao[]>([])
  const todasNotificacoes = page === 1 ? notificacoes : [...acumuladas, ...notificacoes]

  const handleCarregarMais = useCallback(() => {
    // Acumula as atuais antes de carregar a próxima página
    setAcumuladas((prev) => [...prev, ...notificacoes])
    setPage((p) => p + 1)
  }, [notificacoes])

  const handleMarcarLida = useCallback(
    (notificacao: Notificacao) => {
      if (!notificacao.lida) {
        marcarLida.mutate(notificacao.id)
      }
    },
    [marcarLida],
  )

  const handleMarcarTodasLidas = useCallback(() => {
    marcarTodasLidas.mutate()
  }, [marcarTodasLidas])

  const handleRefresh = useCallback(async () => {
    setPage(1)
    setAcumuladas([])
    await refetch()
  }, [refetch])

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <Stack gap="md" p="md">
        <Group justify="space-between" align="center">
          <Title order={3}>Notificações</Title>
          <Button
            variant="subtle"
            color="green"
            size="compact-sm"
            leftSection={<IconChecks size={16} />}
            onClick={handleMarcarTodasLidas}
            loading={marcarTodasLidas.isPending}
          >
            Marcar todas como lidas
          </Button>
        </Group>

        {isLoading && page === 1 ? (
          <Stack gap="sm">
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
          </Stack>
        ) : todasNotificacoes.length === 0 ? (
          <EmptyState
            icon={IconBell}
            title="Nenhuma notificação"
            description="Você não possui notificações no momento."
          />
        ) : (
          <Stack gap="sm">
            {todasNotificacoes.map((notificacao) => (
              <Card
                key={notificacao.id}
                padding="sm"
                onClick={() => handleMarcarLida(notificacao)}
                style={{
                  cursor: notificacao.lida ? 'default' : 'pointer',
                  opacity: notificacao.lida ? 0.65 : 1,
                  backgroundColor: notificacao.lida ? undefined : 'var(--mantine-color-green-0)',
                  transition: 'opacity 0.2s ease, background-color 0.2s ease',
                }}
              >
                <Group justify="space-between" align="flex-start" wrap="nowrap">
                  <Stack gap={4} style={{ flex: 1, minWidth: 0 }}>
                    <Text fw={notificacao.lida ? 400 : 600} size="sm" lineClamp={1}>
                      {notificacao.titulo}
                    </Text>
                    <Text size="xs" c="dimmed" lineClamp={2}>
                      {notificacao.mensagem}
                    </Text>
                  </Stack>
                  <Stack gap={2} align="flex-end" style={{ flexShrink: 0 }}>
                    <Text size="xs" c="dimmed">
                      {formatarDataHora(notificacao.criadoEm)}
                    </Text>
                    {!notificacao.lida && (
                      <div
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          backgroundColor: 'var(--mantine-color-green-6)',
                        }}
                      />
                    )}
                  </Stack>
                </Group>
              </Card>
            ))}

            {temMais && (
              <Button
                variant="light"
                color="green"
                fullWidth
                onClick={handleCarregarMais}
                loading={isLoading && page > 1}
              >
                Carregar mais
              </Button>
            )}
          </Stack>
        )}
      </Stack>
    </PullToRefresh>
  )
}
