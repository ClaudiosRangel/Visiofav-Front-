'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, Select, LoadingOverlay,
  ActionIcon, Pagination,
} from '@mantine/core'
import { IconTrash, IconRefresh } from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'PROCESSANDO', label: 'Processando' },
  { value: 'SUCESSO', label: 'Sucesso' },
  { value: 'FALHA', label: 'Falha' },
]

const STATUS_COLORS: Record<string, string> = {
  PENDENTE: 'blue',
  PROCESSANDO: 'orange',
  SUCESSO: 'green',
  FALHA: 'red',
}

const PRIORIDADE_COLORS: Record<string, string> = {
  URGENTE: 'red',
  NORMAL: 'blue',
  BAIXA: 'gray',
}

export default function FilaImpressaoPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Fila de Impressão' }, [])

  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')

  const { data: resp, isLoading } = useQuery<any>({
    queryKey: ['etiquetas-zpl-fila', page, statusFilter],
    queryFn: async () => {
      const params: any = { page, limit: 20 }
      if (statusFilter) params.status = statusFilter
      const { data } = await api.get('/etiquetas-zpl/fila', { params })
      return data
    },
    refetchInterval: 5000, // Auto refresh every 5s
  })

  const items = resp?.data || resp || []
  const total = resp?.total || 0
  const totalPages = Math.ceil(total / 20)

  const cancelar = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/etiquetas-zpl/fila/${id}`)
    },
    onSuccess: () => {
      notifications.show({ title: 'Sucesso', message: 'Item cancelado da fila', color: 'green' })
      queryClient.invalidateQueries({ queryKey: ['etiquetas-zpl-fila'] })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao cancelar', color: 'red' })
    },
  })

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Etiquetas ZPL / Fila de Impressão</Text>

      <Group justify="space-between" mb="lg">
        <Text size="xl" fw={600}>Fila de Impressão</Text>
        <Button
          variant="light"
          leftSection={<IconRefresh size={16} />}
          onClick={() => queryClient.invalidateQueries({ queryKey: ['etiquetas-zpl-fila'] })}
        >
          Atualizar
        </Button>
      </Group>

      {/* Filter */}
      <Card mb="md">
        <Group>
          <Select
            label="Status"
            placeholder="Filtrar por status"
            data={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v || ''); setPage(1) }}
            clearable
            className="w-48"
          />
        </Group>
      </Card>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Template</Table.Th>
              <Table.Th>Impressora</Table.Th>
              <Table.Th>Quantidade</Table.Th>
              <Table.Th>Prioridade</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Tentativas</Table.Th>
              <Table.Th>Erro</Table.Th>
              <Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(Array.isArray(items) ? items : []).map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td>{item.template?.nome || item.templateId?.slice(0, 8) || '—'}</Table.Td>
                <Table.Td>{item.impressora?.nome || item.impressoraId?.slice(0, 8) || '—'}</Table.Td>
                <Table.Td>{item.quantidade}</Table.Td>
                <Table.Td>
                  <Badge variant="light" color={PRIORIDADE_COLORS[item.prioridade] || 'gray'} size="sm">
                    {item.prioridade}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge variant="filled" color={STATUS_COLORS[item.status] || 'gray'} size="sm">
                    {item.status}
                  </Badge>
                </Table.Td>
                <Table.Td>{item.tentativas || 0}</Table.Td>
                <Table.Td>
                  <Text size="xs" c="red" lineClamp={1} maw={200}>
                    {item.erro || '—'}
                  </Text>
                </Table.Td>
                <Table.Td>
                  {item.status === 'PENDENTE' && (
                    <ActionIcon
                      variant="light"
                      color="red"
                      onClick={() => cancelar.mutate(item.id)}
                      title="Cancelar"
                    >
                      <IconTrash size={16} />
                    </ActionIcon>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
            {items.length === 0 && !isLoading && (
              <Table.Tr>
                <Table.Td colSpan={8} className="text-center py-8 text-zinc-500">
                  Nenhum item na fila de impressão
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
