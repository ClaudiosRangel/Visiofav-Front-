'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, Checkbox,
  LoadingOverlay, Pagination,
} from '@mantine/core'
import {
  IconCheck, IconX, IconClipboardCheck,
} from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { notifications } from '@mantine/notifications'

const PRIORIDADE_COLORS: Record<string, string> = {
  BAIXA: 'gray',
  NORMAL: 'blue',
  ALTA: 'orange',
  URGENTE: 'red',
}

export default function AprovacoesPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - Aprovações de Transferência' }, [])

  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<string[]>([])
  const limit = 20

  const { data: resp, isLoading } = useQuery<any>({
    queryKey: ['multi-cd-aprovacoes', page],
    queryFn: async () => {
      const { data } = await api.get('/multi-cd/solicitacoes', {
        params: { page, limit, status: 'PENDENTE' },
      })
      return data
    },
  })

  const items = resp?.data || []
  const total = resp?.total || 0
  const totalPages = Math.ceil(total / limit)

  const toggleSelect = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]
    )
  }

  const toggleSelectAll = () => {
    if (selected.length === items.length) {
      setSelected([])
    } else {
      setSelected(items.map((i: any) => i.id))
    }
  }

  const aprovarMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/multi-cd/solicitacoes/${id}/aprovar`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['multi-cd-aprovacoes'] })
      notifications.show({ title: 'Aprovada', message: 'Solicitação aprovada com sucesso', color: 'green' })
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Erro',
        message: err?.response?.data?.message || 'Erro ao aprovar',
        color: 'red',
      })
    },
  })

  const rejeitarMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/multi-cd/solicitacoes/${id}/cancelar`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['multi-cd-aprovacoes'] })
      notifications.show({ title: 'Rejeitada', message: 'Solicitação rejeitada', color: 'orange' })
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Erro',
        message: err?.response?.data?.message || 'Erro ao rejeitar',
        color: 'red',
      })
    },
  })

  const bulkAprovarMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data } = await api.post('/multi-cd/solicitacoes/aprovar-lote', { ids })
      return data
    },
    onSuccess: () => {
      setSelected([])
      queryClient.invalidateQueries({ queryKey: ['multi-cd-aprovacoes'] })
      notifications.show({
        title: 'Aprovações em lote',
        message: 'Solicitações aprovadas com sucesso',
        color: 'green',
      })
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Erro',
        message: err?.response?.data?.message || 'Erro ao aprovar em lote',
        color: 'red',
      })
    },
  })

  const formatDate = (date: string | null) => {
    if (!date) return '—'
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Multi-CD / Aprovações</Text>
      <Group justify="space-between" mb="lg">
        <Group gap="sm">
          <IconClipboardCheck size={24} />
          <Text size="xl" fw={600}>Fila de Aprovações</Text>
        </Group>
        {selected.length > 0 && (
          <Button
            color="green"
            leftSection={<IconCheck size={16} />}
            onClick={() => bulkAprovarMutation.mutate(selected)}
            loading={bulkAprovarMutation.isPending}
          >
            Aprovar Selecionados ({selected.length})
          </Button>
        )}
      </Group>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>
                <Checkbox
                  checked={items.length > 0 && selected.length === items.length}
                  indeterminate={selected.length > 0 && selected.length < items.length}
                  onChange={toggleSelectAll}
                  aria-label="Selecionar todos"
                />
              </Table.Th>
              <Table.Th>Número</Table.Th>
              <Table.Th>Rota</Table.Th>
              <Table.Th>Motivo</Table.Th>
              <Table.Th>Prioridade</Table.Th>
              <Table.Th>Criado por</Table.Th>
              <Table.Th>Data</Table.Th>
              <Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td>
                  <Checkbox
                    checked={selected.includes(item.id)}
                    onChange={() => toggleSelect(item.id)}
                    aria-label={`Selecionar ${item.numero}`}
                  />
                </Table.Td>
                <Table.Td className="font-mono">{item.numero}</Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <Text size="sm">{item.cdOrigem?.nome || item.cdOrigemId}</Text>
                    <Text size="sm" c="dimmed">→</Text>
                    <Text size="sm">{item.cdDestino?.nome || item.cdDestinoId}</Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Text size="sm" lineClamp={1}>{item.motivo || '—'}</Text>
                </Table.Td>
                <Table.Td>
                  <Badge variant="light" color={PRIORIDADE_COLORS[item.prioridade] || 'gray'}>
                    {item.prioridade}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{item.criadoPor?.nome || item.criadoPorId || '—'}</Text>
                </Table.Td>
                <Table.Td>{formatDate(item.criadoEm)}</Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Button
                      size="xs"
                      color="green"
                      variant="light"
                      leftSection={<IconCheck size={14} />}
                      onClick={() => aprovarMutation.mutate(item.id)}
                      loading={aprovarMutation.isPending}
                    >
                      Aprovar
                    </Button>
                    <Button
                      size="xs"
                      color="red"
                      variant="subtle"
                      leftSection={<IconX size={14} />}
                      onClick={() => rejeitarMutation.mutate(item.id)}
                      loading={rejeitarMutation.isPending}
                    >
                      Rejeitar
                    </Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {items.length === 0 && !isLoading && (
              <Table.Tr>
                <Table.Td colSpan={8} className="text-center py-8 text-zinc-500">
                  Nenhuma solicitação pendente de aprovação
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
