'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, Select, TextInput,
  LoadingOverlay, Pagination,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import {
  IconSearch, IconEye, IconSend, IconCash, IconX,
} from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { notifications } from '@mantine/notifications'
import Link from 'next/link'

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'GERADA', label: 'Gerada' },
  { value: 'ENVIADA', label: 'Enviada' },
  { value: 'PAGA', label: 'Paga' },
  { value: 'CANCELADA', label: 'Cancelada' },
  { value: 'ATRASADA', label: 'Atrasada' },
]

const STATUS_COLORS: Record<string, string> = {
  GERADA: 'gray',
  ENVIADA: 'blue',
  PAGA: 'green',
  CANCELADA: 'red',
  ATRASADA: 'orange',
}

export default function FaturasPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - Faturas' }, [])

  const queryClient = useQueryClient()
  const [status, setStatus] = useState<string>('')
  const [clienteId, setClienteId] = useState<string>('')
  const [periodoInicio, setPeriodoInicio] = useState<Date | null>(null)
  const [periodoFim, setPeriodoFim] = useState<Date | null>(null)
  const [page, setPage] = useState(1)
  const limit = 20

  const { data: clientesResp } = useQuery<any>({
    queryKey: ['clientes'],
    queryFn: async () => {
      const { data } = await api.get('/clientes', { params: { limit: 200 } })
      return data
    },
  })

  const clienteOptions = [
    { value: '', label: 'Todos' },
    ...(clientesResp?.data || []).map((c: any) => ({
      value: String(c.id),
      label: c.nome || c.razaoSocial,
    })),
  ]

  const { data: resp, isLoading } = useQuery<any>({
    queryKey: ['faturamento', 'faturas', status, clienteId, periodoInicio, periodoFim, page],
    queryFn: async () => {
      const params: any = { page, limit }
      if (status) params.status = status
      if (clienteId) params.clienteId = clienteId
      if (periodoInicio) params.periodoInicio = periodoInicio.toISOString()
      if (periodoFim) params.periodoFim = periodoFim.toISOString()
      const { data } = await api.get('/faturamento/faturas', { params })
      return data
    },
  })

  const items = resp?.data || []
  const total = resp?.pagination?.total || 0
  const totalPages = resp?.pagination?.totalPages || 0

  const enviarMutation = useMutation({
    mutationFn: async (faturaId: string) => {
      await api.put(`/faturamento/faturas/${faturaId}/enviar`)
    },
    onSuccess: () => {
      notifications.show({ title: 'Sucesso', message: 'Fatura enviada', color: 'green' })
      queryClient.invalidateQueries({ queryKey: ['faturamento', 'faturas'] })
    },
    onError: () => {
      notifications.show({ title: 'Erro', message: 'Erro ao enviar fatura', color: 'red' })
    },
  })

  const pagarMutation = useMutation({
    mutationFn: async (faturaId: string) => {
      await api.put(`/faturamento/faturas/${faturaId}/pagar`)
    },
    onSuccess: () => {
      notifications.show({ title: 'Sucesso', message: 'Fatura marcada como paga', color: 'green' })
      queryClient.invalidateQueries({ queryKey: ['faturamento', 'faturas'] })
    },
    onError: () => {
      notifications.show({ title: 'Erro', message: 'Erro ao marcar pagamento', color: 'red' })
    },
  })

  const cancelarMutation = useMutation({
    mutationFn: async (faturaId: string) => {
      await api.put(`/faturamento/faturas/${faturaId}/cancelar`)
    },
    onSuccess: () => {
      notifications.show({ title: 'Sucesso', message: 'Fatura cancelada', color: 'green' })
      queryClient.invalidateQueries({ queryKey: ['faturamento', 'faturas'] })
    },
    onError: () => {
      notifications.show({ title: 'Erro', message: 'Erro ao cancelar fatura', color: 'red' })
    },
  })

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Faturamento / Faturas</Text>
      <Text size="xl" fw={600} mb="lg">Faturas</Text>

      {/* Filters */}
      <Card mb="md">
        <Group gap="md" align="flex-end">
          <Select
            label="Status"
            placeholder="Filtrar por status"
            data={STATUS_OPTIONS}
            value={status}
            onChange={(val) => { setStatus(val || ''); setPage(1) }}
            clearable
            className="w-44"
          />
          <Select
            label="Cliente"
            placeholder="Filtrar por cliente"
            data={clienteOptions}
            value={clienteId}
            onChange={(val) => { setClienteId(val || ''); setPage(1) }}
            clearable
            searchable
            className="w-56"
          />
          <DateInput
            label="Período Início"
            placeholder="De"
            value={periodoInicio}
            onChange={(val) => { setPeriodoInicio(val); setPage(1) }}
            valueFormat="DD/MM/YYYY"
            clearable
          />
          <DateInput
            label="Período Fim"
            placeholder="Até"
            value={periodoFim}
            onChange={(val) => { setPeriodoFim(val); setPage(1) }}
            valueFormat="DD/MM/YYYY"
            clearable
          />
        </Group>
      </Card>

      {/* Table */}
      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Número</Table.Th>
              <Table.Th>Cliente</Table.Th>
              <Table.Th>Período</Table.Th>
              <Table.Th>Valor Total</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td className="font-mono">{item.numero}</Table.Td>
                <Table.Td>{item.clienteNome || item.clienteId}</Table.Td>
                <Table.Td>{item.periodo || '—'}</Table.Td>
                <Table.Td>
                  {(item.valorTotal ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </Table.Td>
                <Table.Td>
                  <Badge variant="light" color={STATUS_COLORS[item.status] || 'gray'}>
                    {item.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Button
                      component={Link}
                      href={`/wms/faturamento/faturas/${item.id}`}
                      variant="subtle"
                      size="xs"
                      leftSection={<IconEye size={14} />}
                    >
                      Ver
                    </Button>
                    {item.status === 'GERADA' && (
                      <Button
                        variant="subtle"
                        size="xs"
                        color="blue"
                        leftSection={<IconSend size={14} />}
                        onClick={() => enviarMutation.mutate(item.id)}
                        loading={enviarMutation.isPending}
                      >
                        Enviar
                      </Button>
                    )}
                    {item.status === 'ENVIADA' && (
                      <Button
                        variant="subtle"
                        size="xs"
                        color="green"
                        leftSection={<IconCash size={14} />}
                        onClick={() => pagarMutation.mutate(item.id)}
                        loading={pagarMutation.isPending}
                      >
                        Pagar
                      </Button>
                    )}
                    {(item.status === 'GERADA' || item.status === 'ENVIADA') && (
                      <Button
                        variant="subtle"
                        size="xs"
                        color="red"
                        leftSection={<IconX size={14} />}
                        onClick={() => cancelarMutation.mutate(item.id)}
                        loading={cancelarMutation.isPending}
                      >
                        Cancelar
                      </Button>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {items.length === 0 && !isLoading && (
              <Table.Tr>
                <Table.Td colSpan={6} className="text-center py-8 text-zinc-500">
                  Nenhuma fatura encontrada
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
