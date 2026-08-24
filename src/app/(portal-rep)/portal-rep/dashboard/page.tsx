'use client'

import { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Card, Text, Group, Stack, Title } from '@mantine/core'
import { usePortalRepDashboard } from '@/data/hooks/portal-rep-app/usePortalRepDashboard'
import { formatarMoeda } from '@/components/portal-rep/formatters'
import { SkeletonCard } from '@/components/portal-rep/SkeletonCard'
import { PullToRefresh } from '@/components/portal-rep/PullToRefresh'
import type { StatusPedido } from '@/data/hooks/portal-rep-app/types'

const STATUS_LABELS: Record<StatusPedido, string> = {
  ORCAMENTO: 'Orçamento',
  PV: 'PV',
  OP: 'OP',
  PRODUCAO: 'Produção',
  EXPEDICAO: 'Expedição',
  ENTREGUE: 'Entregue',
}

export default function DashboardPage() {
  const router = useRouter()
  const {
    orcamentosPendentes,
    pipelineSummary,
    comissaoMes,
    orcamentosQuery,
    pipelineQuery,
    comissaoQuery,
  } = usePortalRepDashboard()

  const handleRefresh = useCallback(async () => {
    await Promise.all([
      orcamentosQuery.refetch(),
      pipelineQuery.refetch(),
      comissaoQuery.refetch(),
    ])
  }, [orcamentosQuery, pipelineQuery, comissaoQuery])

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <Stack gap="md" p="md">
        <Title order={3}>Dashboard</Title>

        {/* Card: Orçamentos Pendentes */}
        {orcamentosQuery.isLoading ? (
          <SkeletonCard lines={2} />
        ) : (
          <Card
            className="portal-rep-touchable"
            style={{ cursor: 'pointer' }}
            onClick={() => router.push('/portal-rep/orcamentos')}
          >
            <Stack gap="xs">
              <Text size="sm" c="dimmed">
                Orçamentos Pendentes
              </Text>
              <Title order={2}>{orcamentosPendentes ?? 0}</Title>
            </Stack>
          </Card>
        )}

        {/* Card: Pipeline */}
        {pipelineQuery.isLoading ? (
          <SkeletonCard lines={4} />
        ) : (
          <Card
            className="portal-rep-touchable"
            style={{ cursor: 'pointer' }}
            onClick={() => router.push('/portal-rep/pipeline')}
          >
            <Stack gap="xs">
              <Text size="sm" c="dimmed">
                Pipeline
              </Text>
              {pipelineSummary && (
                <Group gap="md" wrap="wrap">
                  {(Object.entries(pipelineSummary) as [StatusPedido, number][]).map(
                    ([status, count]) => (
                      <Stack key={status} gap={0} align="center">
                        <Text fw={700} size="lg">
                          {count}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {STATUS_LABELS[status]}
                        </Text>
                      </Stack>
                    ),
                  )}
                </Group>
              )}
            </Stack>
          </Card>
        )}

        {/* Card: Comissão do Mês */}
        {comissaoQuery.isLoading ? (
          <SkeletonCard lines={3} />
        ) : (
          <Card
            className="portal-rep-touchable"
            style={{ cursor: 'pointer' }}
            onClick={() => router.push('/portal-rep/comissoes')}
          >
            <Stack gap="xs">
              <Text size="sm" c="dimmed">
                Comissão do Mês
              </Text>
              <Group gap="lg">
                <Stack gap={0}>
                  <Text size="xs" c="dimmed">
                    Projetada
                  </Text>
                  <Text fw={700} size="lg">
                    {formatarMoeda(comissaoMes?.projetada ?? 0)}
                  </Text>
                </Stack>
                <Stack gap={0}>
                  <Text size="xs" c="dimmed">
                    Realizada
                  </Text>
                  <Text fw={700} size="lg">
                    {formatarMoeda(comissaoMes?.realizada ?? 0)}
                  </Text>
                </Stack>
              </Group>
            </Stack>
          </Card>
        )}
      </Stack>
    </PullToRefresh>
  )
}
