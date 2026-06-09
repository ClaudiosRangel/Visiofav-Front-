'use client'

import { useEffect } from 'react'
import {
  Card, Group, Text, Badge, Button, Table, LoadingOverlay, Stack, Timeline,
} from '@mantine/core'
import {
  IconArrowLeft, IconPackageImport, IconEye, IconClipboardCheck,
  IconCheck, IconX, IconCircleDot,
} from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

const STATUS_COLORS: Record<string, string> = {
  ABERTA: 'blue',
  RECEBIDA: 'orange',
  INSPECIONADA: 'yellow',
  CONCLUIDA: 'green',
  CANCELADA: 'gray',
}

const STATUS_LABELS: Record<string, string> = {
  ABERTA: 'Aberta',
  RECEBIDA: 'Recebida',
  INSPECIONADA: 'Inspecionada',
  CONCLUIDA: 'Concluída',
  CANCELADA: 'Cancelada',
}

const CONDICAO_COLORS: Record<string, string> = {
  PERFEITO: 'green',
  AVARIADO: 'red',
  INCOMPLETO: 'orange',
}

const DISPOSICAO_COLORS: Record<string, string> = {
  REESTOQUE: 'green',
  AVARIA: 'red',
  DESCARTE: 'gray',
  RETORNO_FORNECEDOR: 'violet',
}

const LIFECYCLE_STEPS = ['ABERTA', 'RECEBIDA', 'INSPECIONADA', 'CONCLUIDA']

function getTimelineActive(status: string): number {
  if (status === 'CANCELADA') return -1
  const idx = LIFECYCLE_STEPS.indexOf(status)
  return idx >= 0 ? idx : 0
}

export default function RADetailPage() {
  useModuloGuard('WMS')
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()

  const { data: resp, isLoading } = useQuery<any>({
    queryKey: ['logistica-reversa-ra', id],
    queryFn: async () => {
      const { data } = await api.get(`/logistica-reversa/ra/${id}`)
      return data.data || data
    },
    enabled: !!id,
  })

  const ra = resp || null

  useEffect(() => {
    if (ra?.numero) {
      document.title = `VisioFab - WMS - ${ra.numero}`
    }
  }, [ra?.numero])

  // Cancel mutation
  const cancelar = useMutation({
    mutationFn: async () => {
      await api.put(`/logistica-reversa/ra/${id}/cancelar`)
    },
    onSuccess: () => {
      notifications.show({ title: 'Sucesso', message: 'RA cancelada', color: 'green' })
      queryClient.invalidateQueries({ queryKey: ['logistica-reversa-ra', id] })
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Erro',
        message: err?.response?.data?.message || 'Erro ao cancelar',
        color: 'red',
      })
    },
  })

  // Register receipt mutation
  const registrarRecebimento = useMutation({
    mutationFn: async () => {
      await api.post(`/logistica-reversa/ra/${id}/receber`)
    },
    onSuccess: () => {
      notifications.show({ title: 'Sucesso', message: 'Recebimento registrado', color: 'green' })
      queryClient.invalidateQueries({ queryKey: ['logistica-reversa-ra', id] })
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Erro',
        message: err?.response?.data?.message || 'Erro ao registrar recebimento',
        color: 'red',
      })
    },
  })

  if (isLoading || !ra) {
    return (
      <div>
        <LoadingOverlay visible={isLoading} />
        {!isLoading && !ra && <Text>RA não encontrada</Text>}
      </div>
    )
  }

  const activeStep = getTimelineActive(ra.status)

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Gestão / Logística Reversa / {ra.numero}</Text>

      <Group mb="lg">
        <Button
          component={Link}
          href="/wms/logistica-reversa"
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
        >
          Voltar
        </Button>
        <Text size="xl" fw={600}>{ra.numero}</Text>
        <Badge size="lg" variant="light" color={STATUS_COLORS[ra.status] || 'gray'}>
          {STATUS_LABELS[ra.status] || ra.status}
        </Badge>
      </Group>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
        {/* Timeline */}
        <Card withBorder>
          <Text fw={500} mb="md">Ciclo de Vida</Text>
          <Timeline active={activeStep} bulletSize={24} lineWidth={2}>
            <Timeline.Item
              bullet={<IconCircleDot size={12} />}
              title="Aberta"
            >
              <Text size="xs" c="dimmed">
                {ra.criadoEm ? new Date(ra.criadoEm).toLocaleString('pt-BR') : '—'}
              </Text>
            </Timeline.Item>
            <Timeline.Item
              bullet={<IconPackageImport size={12} />}
              title="Recebida"
            >
              <Text size="xs" c="dimmed">
                {ra.recebidoEm ? new Date(ra.recebidoEm).toLocaleString('pt-BR') : 'Pendente'}
              </Text>
            </Timeline.Item>
            <Timeline.Item
              bullet={<IconEye size={12} />}
              title="Inspecionada"
            >
              <Text size="xs" c="dimmed">
                {ra.status === 'INSPECIONADA' || ra.status === 'CONCLUIDA' ? 'Concluído' : 'Pendente'}
              </Text>
            </Timeline.Item>
            <Timeline.Item
              bullet={<IconCheck size={12} />}
              title="Concluída"
            >
              <Text size="xs" c="dimmed">
                {ra.concluidoEm ? new Date(ra.concluidoEm).toLocaleString('pt-BR') : 'Pendente'}
              </Text>
            </Timeline.Item>
          </Timeline>
          {ra.status === 'CANCELADA' && (
            <Badge mt="md" color="red" variant="filled" leftSection={<IconX size={12} />}>
              Cancelada
            </Badge>
          )}
        </Card>

        {/* Details */}
        <Card withBorder className="lg:col-span-2">
          <Text fw={500} mb="md">Detalhes</Text>
          <Stack gap="xs">
            <Group>
              <Text size="sm" c="dimmed" w={140}>Motivo:</Text>
              <Text size="sm">{ra.motivo}</Text>
            </Group>
            <Group>
              <Text size="sm" c="dimmed" w={140}>Cliente:</Text>
              <Text size="sm">{ra.clienteNome || ra.clienteId}</Text>
            </Group>
            <Group>
              <Text size="sm" c="dimmed" w={140}>NF-e Referência:</Text>
              <Text size="sm">{ra.nfeNumero || ra.nfeOrigemId}</Text>
            </Group>
            <Group>
              <Text size="sm" c="dimmed" w={140}>Data Limite:</Text>
              <Text size="sm">
                {ra.dataLimite
                  ? new Date(ra.dataLimite).toLocaleDateString('pt-BR')
                  : '—'}
              </Text>
            </Group>
            <Group>
              <Text size="sm" c="dimmed" w={140}>Observação:</Text>
              <Text size="sm">{ra.observacao || '—'}</Text>
            </Group>
          </Stack>
        </Card>
      </div>

      {/* Items table */}
      <Card withBorder mb="md">
        <Text fw={500} mb="md">Itens</Text>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Produto</Table.Th>
              <Table.Th>Quantidade</Table.Th>
              <Table.Th>Qtd Recebida</Table.Th>
              <Table.Th>Condição</Table.Th>
              <Table.Th>Disposição</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(ra.itens || []).map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td>{item.produtoNome || item.produtoId}</Table.Td>
                <Table.Td>{Number(item.quantidade)}</Table.Td>
                <Table.Td>{item.quantidadeRecebida != null ? Number(item.quantidadeRecebida) : '—'}</Table.Td>
                <Table.Td>
                  {item.condicao ? (
                    <Badge variant="light" color={CONDICAO_COLORS[item.condicao] || 'gray'}>
                      {item.condicao}
                    </Badge>
                  ) : '—'}
                </Table.Td>
                <Table.Td>
                  {item.disposicao ? (
                    <Badge variant="light" color={DISPOSICAO_COLORS[item.disposicao] || 'gray'}>
                      {item.disposicao}
                    </Badge>
                  ) : '—'}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>

      {/* Action buttons based on status */}
      <Group justify="flex-end">
        {ra.status === 'ABERTA' && (
          <>
            <Button
              onClick={() => registrarRecebimento.mutate()}
              loading={registrarRecebimento.isPending}
              leftSection={<IconPackageImport size={16} />}
            >
              Registrar Recebimento
            </Button>
            <Button
              variant="outline"
              color="red"
              onClick={() => cancelar.mutate()}
              loading={cancelar.isPending}
              leftSection={<IconX size={16} />}
            >
              Cancelar
            </Button>
          </>
        )}
        {ra.status === 'RECEBIDA' && (
          <Button
            component={Link}
            href={`/wms/logistica-reversa/${id}/inspecao`}
            leftSection={<IconClipboardCheck size={16} />}
          >
            Inspecionar
          </Button>
        )}
        {ra.status === 'INSPECIONADA' && (
          <Button
            component={Link}
            href={`/wms/logistica-reversa/${id}/disposicao`}
            leftSection={<IconCheck size={16} />}
          >
            Definir Disposição
          </Button>
        )}
      </Group>
    </div>
  )
}
