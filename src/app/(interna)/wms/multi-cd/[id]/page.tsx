'use client'

import { useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, Timeline, LoadingOverlay,
  SimpleGrid, Divider,
} from '@mantine/core'
import {
  IconArrowLeft, IconCheck, IconClock, IconTruckDelivery,
  IconPackageExport, IconBox, IconX, IconClipboardCheck,
} from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useParams, useRouter } from 'next/navigation'
import { notifications } from '@mantine/notifications'

const STATUS_STEPS = [
  { key: 'PENDENTE', label: 'Pendente', icon: IconClock, color: 'yellow' },
  { key: 'APROVADA', label: 'Aprovada', icon: IconClipboardCheck, color: 'blue' },
  { key: 'EM_SEPARACAO', label: 'Em Separação', icon: IconBox, color: 'indigo' },
  { key: 'EXPEDIDA', label: 'Expedida', icon: IconPackageExport, color: 'violet' },
  { key: 'EM_TRANSITO', label: 'Em Trânsito', icon: IconTruckDelivery, color: 'orange' },
  { key: 'RECEBIDA', label: 'Recebida', icon: IconCheck, color: 'green' },
]

const STATUS_COLORS: Record<string, string> = {
  PENDENTE: 'yellow',
  APROVADA: 'blue',
  EM_SEPARACAO: 'indigo',
  EXPEDIDA: 'violet',
  EM_TRANSITO: 'orange',
  RECEBIDA: 'green',
  CANCELADA: 'gray',
}

const PRIORIDADE_COLORS: Record<string, string> = {
  BAIXA: 'gray',
  NORMAL: 'blue',
  ALTA: 'orange',
  URGENTE: 'red',
}

export default function DetalhesSolicitacaoPage() {
  useModuloGuard('WMS')
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()

  useEffect(() => { document.title = 'VisioFab - WMS - Detalhes da Transferência' }, [])

  const { data: solicitacao, isLoading } = useQuery<any>({
    queryKey: ['multi-cd-solicitacao', id],
    queryFn: async () => {
      const { data } = await api.get(`/multi-cd/solicitacoes/${id}`)
      return data
    },
    enabled: !!id,
  })

  const actionMutation = useMutation({
    mutationFn: async ({ action, payload }: { action: string; payload?: any }) => {
      const { data } = await api.post(`/multi-cd/solicitacoes/${id}/${action}`, payload || {})
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['multi-cd-solicitacao', id] })
      notifications.show({ title: 'Sucesso', message: 'Ação realizada com sucesso', color: 'green' })
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Erro',
        message: err?.response?.data?.message || 'Erro ao executar ação',
        color: 'red',
      })
    },
  })

  const currentStepIndex = STATUS_STEPS.findIndex(s => s.key === solicitacao?.status)
  const isCancelada = solicitacao?.status === 'CANCELADA'

  const formatDate = (date: string | null) => {
    if (!date) return '—'
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Multi-CD / Detalhes</Text>
      <Group mb="lg">
        <Button
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => router.push('/wms/multi-cd')}
        >
          Voltar
        </Button>
        <Text size="xl" fw={600}>
          Solicitação {solicitacao?.numero || ''}
        </Text>
        {solicitacao?.status && (
          <Badge size="lg" variant="light" color={STATUS_COLORS[solicitacao.status] || 'gray'}>
            {solicitacao.status.replace(/_/g, ' ')}
          </Badge>
        )}
      </Group>

      <Card pos="relative" mb="md">
        <LoadingOverlay visible={isLoading} />

        {/* Info */}
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="lg">
          <div>
            <Text size="xs" c="dimmed">CD Origem</Text>
            <Text fw={500}>{solicitacao?.cdOrigem?.nome || solicitacao?.cdOrigemId || '—'}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">CD Destino</Text>
            <Text fw={500}>{solicitacao?.cdDestino?.nome || solicitacao?.cdDestinoId || '—'}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">Prioridade</Text>
            <Badge variant="light" color={PRIORIDADE_COLORS[solicitacao?.prioridade] || 'gray'}>
              {solicitacao?.prioridade || '—'}
            </Badge>
          </div>
          <div>
            <Text size="xs" c="dimmed">Motivo</Text>
            <Text fw={500}>{solicitacao?.motivo || '—'}</Text>
          </div>
        </SimpleGrid>

        <Divider mb="lg" />

        {/* Timeline */}
        <Text fw={500} mb="md">Histórico</Text>
        <Timeline active={isCancelada ? -1 : currentStepIndex} bulletSize={28} lineWidth={2} mb="lg">
          {STATUS_STEPS.map((step) => {
            const evento = solicitacao?.historico?.find((h: any) => h.status === step.key)
            const StepIcon = step.icon
            return (
              <Timeline.Item
                key={step.key}
                bullet={<StepIcon size={14} />}
                title={step.label}
                color={step.color}
              >
                {evento ? (
                  <>
                    <Text size="xs" c="dimmed">{formatDate(evento.data)}</Text>
                    {evento.responsavel && (
                      <Text size="xs" c="dimmed">por {evento.responsavel}</Text>
                    )}
                  </>
                ) : (
                  <Text size="xs" c="dimmed">—</Text>
                )}
              </Timeline.Item>
            )
          })}
        </Timeline>

        {isCancelada && (
          <Badge color="gray" size="lg" variant="light" mb="md">
            Cancelada {solicitacao?.motivoCancelamento ? `— ${solicitacao.motivoCancelamento}` : ''}
          </Badge>
        )}
      </Card>

      {/* Items Table */}
      <Card mb="md">
        <Text fw={500} mb="md">Itens</Text>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Produto</Table.Th>
              <Table.Th>Qtd. Solicitada</Table.Th>
              <Table.Th>Qtd. Expedida</Table.Th>
              <Table.Th>Qtd. Recebida</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(solicitacao?.itens || []).map((item: any, idx: number) => (
              <Table.Tr key={item.id || idx}>
                <Table.Td>{item.produto?.nome || item.produtoId}</Table.Td>
                <Table.Td>{item.quantidadeSolicitada}</Table.Td>
                <Table.Td>{item.quantidadeExpedida ?? '—'}</Table.Td>
                <Table.Td>
                  {item.quantidadeRecebida != null ? (
                    <Text
                      span
                      c={item.quantidadeRecebida < item.quantidadeExpedida ? 'red' : undefined}
                      fw={item.quantidadeRecebida < item.quantidadeExpedida ? 600 : undefined}
                    >
                      {item.quantidadeRecebida}
                    </Text>
                  ) : '—'}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>

      {/* Action Buttons */}
      {!isCancelada && solicitacao?.status && (
        <Card>
          <Group>
            {solicitacao.status === 'PENDENTE' && (
              <>
                <Button
                  color="green"
                  leftSection={<IconCheck size={16} />}
                  onClick={() => actionMutation.mutate({ action: 'aprovar' })}
                  loading={actionMutation.isPending}
                >
                  Aprovar
                </Button>
                <Button
                  color="red"
                  variant="light"
                  leftSection={<IconX size={16} />}
                  onClick={() => actionMutation.mutate({ action: 'cancelar' })}
                  loading={actionMutation.isPending}
                >
                  Cancelar
                </Button>
              </>
            )}
            {solicitacao.status === 'APROVADA' && (
              <Button
                color="indigo"
                leftSection={<IconBox size={16} />}
                onClick={() => actionMutation.mutate({ action: 'iniciar-separacao' })}
                loading={actionMutation.isPending}
              >
                Iniciar Separação
              </Button>
            )}
            {solicitacao.status === 'EM_SEPARACAO' && (
              <Button
                color="violet"
                leftSection={<IconPackageExport size={16} />}
                onClick={() => actionMutation.mutate({ action: 'expedir' })}
                loading={actionMutation.isPending}
              >
                Expedir
              </Button>
            )}
            {solicitacao.status === 'EXPEDIDA' && (
              <Button
                color="orange"
                leftSection={<IconTruckDelivery size={16} />}
                onClick={() => actionMutation.mutate({ action: 'iniciar-transito' })}
                loading={actionMutation.isPending}
              >
                Registrar Saída (Trânsito)
              </Button>
            )}
            {solicitacao.status === 'EM_TRANSITO' && (
              <Button
                component="a"
                href={`/wms/multi-cd/receber/${id}`}
                color="green"
                leftSection={<IconCheck size={16} />}
              >
                Receber
              </Button>
            )}
            {solicitacao.status !== 'RECEBIDA' && solicitacao.status !== 'CANCELADA' && (
              <Button
                color="red"
                variant="subtle"
                leftSection={<IconX size={16} />}
                onClick={() => actionMutation.mutate({ action: 'cancelar' })}
                loading={actionMutation.isPending}
              >
                Cancelar Solicitação
              </Button>
            )}
          </Group>
        </Card>
      )}
    </div>
  )
}
