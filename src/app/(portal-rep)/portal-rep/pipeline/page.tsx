'use client'

import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'
import { DatePickerInput } from '@mantine/dates'
import { usePortalRepPipeline } from '@/data/hooks/portal-rep-app/usePortalRepPipeline'
import { formatarData } from '@/components/portal-rep/formatters'
import { PipelineTimeline } from '@/components/portal-rep/PipelineTimeline'
import { PullToRefresh } from '@/components/portal-rep/PullToRefresh'
import { SkeletonCard } from '@/components/portal-rep/SkeletonCard'
import { EmptyState } from '@/components/portal-rep/EmptyState'
import type { StatusPedido } from '@/data/hooks/portal-rep-app/types'

const STATUS_OPTIONS = [
  { value: 'ORCAMENTO', label: 'Orçamento' },
  { value: 'PV', label: 'PV' },
  { value: 'OP', label: 'OP' },
  { value: 'PRODUCAO', label: 'Produção' },
  { value: 'EXPEDICAO', label: 'Expedição' },
  { value: 'ENTREGUE', label: 'Entregue' },
]

export default function PipelinePage() {
  const router = useRouter()
  const [filtroStatus, setFiltroStatus] = useState<string | null>(null)
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroPeriodo, setFiltroPeriodo] = useState<[Date | null, Date | null]>([null, null])

  // Monta parâmetros para o hook baseado nos filtros
  const params = useMemo(() => {
    const p: Record<string, unknown> = {}
    if (filtroStatus) p.status = filtroStatus
    if (filtroCliente.trim()) p.cliente = filtroCliente.trim()
    if (filtroPeriodo[0]) p.dataInicio = filtroPeriodo[0].toISOString()
    if (filtroPeriodo[1]) p.dataFim = filtroPeriodo[1].toISOString()
    return Object.keys(p).length > 0 ? p : undefined
  }, [filtroStatus, filtroCliente, filtroPeriodo])

  const pipelineQuery = usePortalRepPipeline(params)

  const handleRefresh = useCallback(async () => {
    await pipelineQuery.refetch()
  }, [pipelineQuery])

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <Stack gap="md" p="md">
        <Title order={3}>Pipeline</Title>

        {/* Filtros */}
        <Stack gap="sm">
          <Group gap="sm" wrap="wrap">
            <TextInput
              placeholder="Filtrar por cliente"
              leftSection={<IconSearch size={16} />}
              value={filtroCliente}
              onChange={(e) => setFiltroCliente(e.currentTarget.value)}
              style={{ flex: 1, minWidth: 180 }}
            />
            <Select
              placeholder="Status"
              clearable
              value={filtroStatus}
              onChange={setFiltroStatus}
              data={STATUS_OPTIONS}
              style={{ minWidth: 140 }}
            />
          </Group>
          <DatePickerInput
            type="range"
            placeholder="Período"
            value={filtroPeriodo}
            onChange={setFiltroPeriodo}
            clearable
            locale="pt-BR"
            valueFormat="DD/MM/YYYY"
          />
        </Stack>

        {/* Lista de pedidos */}
        {pipelineQuery.isLoading ? (
          <Stack gap="sm">
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
            <SkeletonCard lines={3} />
          </Stack>
        ) : !pipelineQuery.data || pipelineQuery.data.length === 0 ? (
          <EmptyState
            title="Nenhum pedido encontrado"
            description="Não há pedidos no pipeline para os filtros selecionados."
          />
        ) : (
          <Stack gap="sm">
            {pipelineQuery.data.map((pedido) => (
              <Card
                key={pedido.id}
                className="portal-rep-touchable"
                style={{ cursor: 'pointer' }}
                onClick={() => router.push(`/portal-rep/pipeline/${pedido.id}`)}
                padding="sm"
              >
                <Stack gap="xs">
                  {/* Cabeçalho: número + cliente */}
                  <Group justify="space-between" wrap="nowrap">
                    <Text fw={600} size="sm" truncate>
                      Pedido #{pedido.numero}
                    </Text>
                    {pedido.dataEntregaPrevista && (
                      <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                        Entrega: {formatarData(pedido.dataEntregaPrevista)}
                      </Text>
                    )}
                  </Group>

                  <Text size="sm" c="dimmed" truncate>
                    {pedido.clienteNome}
                  </Text>

                  {/* Timeline compacta */}
                  <PipelineTimeline statusAtual={pedido.statusAtual} compacto />
                </Stack>
              </Card>
            ))}
          </Stack>
        )}
      </Stack>
    </PullToRefresh>
  )
}
