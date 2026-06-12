'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, Select,
  LoadingOverlay, Pagination,
} from '@mantine/core'
import { IconAlertTriangle, IconCheck } from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const SEVERIDADE_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'INFO', label: 'Info' },
  { value: 'WARNING', label: 'Warning' },
  { value: 'CRITICAL', label: 'Critical' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'ABERTO', label: 'Aberto' },
  { value: 'RESOLVIDO', label: 'Resolvido' },
  { value: 'RECONHECIDO', label: 'Reconhecido' },
]

const SEVERIDADE_COLORS: Record<string, string> = {
  INFO: 'blue',
  WARNING: 'yellow',
  CRITICAL: 'red',
}

const STATUS_COLORS: Record<string, string> = {
  ABERTO: 'red',
  RESOLVIDO: 'green',
  RECONHECIDO: 'orange',
}

export default function AlertasKpiPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Alertas KPI' }, [])

  const queryClient = useQueryClient()
  const [severidade, setSeveridade] = useState<string>('')
  const [status, setStatus] = useState<string>('')
  const [page, setPage] = useState(1)
  const limit = 20

  const { data: resp, isLoading } = useQuery<any>({
    queryKey: ['kpi-alertas', severidade, status, page],
    queryFn: async () => {
      const params: any = { page, limit }
      if (severidade) params.severidade = severidade
      if (status) params.status = status
      const { data } = await api.get('/kpi/alertas', { params })
      return data
    },
  })

  const reconhecerMutation = useMutation({
    mutationFn: async (alertaId: string) => {
      await api.put(`/kpi/alertas/${alertaId}/reconhecer`)
    },
    onSuccess: () => {
      notifications.show({
        title: 'Sucesso',
        message: 'Alerta reconhecido com sucesso',
        color: 'green',
      })
      queryClient.invalidateQueries({ queryKey: ['kpi-alertas'] })
    },
    onError: () => {
      notifications.show({
        title: 'Erro',
        message: 'Falha ao reconhecer alerta',
        color: 'red',
      })
    },
  })

  const alertas = resp?.data || []
  const total = resp?.total || 0
  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Gestão / KPI / Alertas</Text>
      <Text size="xl" fw={600} mb="lg">Alertas KPI</Text>

      {/* Filters */}
      <Card mb="md">
        <Group gap="md">
          <Select
            label="Severidade"
            placeholder="Filtrar severidade"
            data={SEVERIDADE_OPTIONS}
            value={severidade}
            onChange={(val) => { setSeveridade(val || ''); setPage(1) }}
            clearable
            className="w-48"
          />
          <Select
            label="Status"
            placeholder="Filtrar status"
            data={STATUS_OPTIONS}
            value={status}
            onChange={(val) => { setStatus(val || ''); setPage(1) }}
            clearable
            className="w-48"
          />
        </Group>
      </Card>

      {/* Table */}
      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Severidade</Table.Th>
              <Table.Th>Mensagem</Table.Th>
              <Table.Th>Regra</Table.Th>
              <Table.Th>Valor Atual</Table.Th>
              <Table.Th>Threshold</Table.Th>
              <Table.Th>Data</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {alertas.map((alerta: any) => (
              <Table.Tr key={alerta.id}>
                <Table.Td>
                  <Badge
                    variant="light"
                    color={SEVERIDADE_COLORS[alerta.severidade] || 'gray'}
                  >
                    {alerta.severidade}
                  </Badge>
                </Table.Td>
                <Table.Td style={{ maxWidth: 300 }}>
                  <Text size="sm" lineClamp={2}>{alerta.mensagem}</Text>
                </Table.Td>
                <Table.Td>{alerta.regraKpi?.nome || '—'}</Table.Td>
                <Table.Td fw={500}>{alerta.valorAtual}</Table.Td>
                <Table.Td>{alerta.threshold}</Table.Td>
                <Table.Td>
                  {alerta.criadoEm
                    ? new Date(alerta.criadoEm).toLocaleDateString('pt-BR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })
                    : '—'}
                </Table.Td>
                <Table.Td>
                  <Badge
                    variant="light"
                    color={STATUS_COLORS[alerta.status] || 'gray'}
                  >
                    {alerta.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {alerta.status === 'ABERTO' && (
                    <Button
                      variant="subtle"
                      size="xs"
                      color="orange"
                      leftSection={<IconCheck size={14} />}
                      onClick={() => reconhecerMutation.mutate(alerta.id)}
                      loading={reconhecerMutation.isPending}
                    >
                      Reconhecer
                    </Button>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
            {alertas.length === 0 && !isLoading && (
              <Table.Tr>
                <Table.Td colSpan={8} className="text-center py-8 text-zinc-500">
                  Nenhum alerta encontrado
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>

        {totalPages > 1 && (
          <Group justify="center" mt="md">
            <Pagination value={page} onChange={setPage} total={totalPages} />
          </Group>
        )}
      </Card>
    </div>
  )
}
