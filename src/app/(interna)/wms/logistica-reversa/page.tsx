'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, Select, TextInput,
  LoadingOverlay, Pagination,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { IconSearch, IconEye, IconPlus } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import Link from 'next/link'

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'ABERTA', label: 'Aberta' },
  { value: 'RECEBIDA', label: 'Recebida' },
  { value: 'INSPECIONADA', label: 'Inspecionada' },
  { value: 'CONCLUIDA', label: 'Concluída' },
  { value: 'CANCELADA', label: 'Cancelada' },
]

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

export default function LogisticaReversaPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Logística Reversa' }, [])

  const [status, setStatus] = useState<string>('')
  const [search, setSearch] = useState('')
  const [dataInicio, setDataInicio] = useState<Date | null>(null)
  const [dataFim, setDataFim] = useState<Date | null>(null)
  const [page, setPage] = useState(1)
  const limit = 20

  const { data: resp, isLoading } = useQuery<any>({
    queryKey: ['logistica-reversa', status, search, dataInicio, dataFim, page],
    queryFn: async () => {
      const params: any = { page, limit }
      if (status) params.status = status
      if (search) params.search = search
      if (dataInicio) params.dataInicio = dataInicio.toISOString()
      if (dataFim) params.dataFim = dataFim.toISOString()
      const { data } = await api.get('/logistica-reversa/ra', { params })
      return data
    },
  })

  const items = resp?.data || []
  const total = resp?.total || 0
  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Gestão / Logística Reversa</Text>

      <Group justify="space-between" mb="lg">
        <Text size="xl" fw={600}>Logística Reversa</Text>
        <Button
          component={Link}
          href="/wms/logistica-reversa/nova"
          leftSection={<IconPlus size={16} />}
        >
          Nova RA
        </Button>
      </Group>

      {/* Filters */}
      <Card mb="md">
        <Group gap="md" align="end">
          <Select
            label="Status"
            placeholder="Filtrar por status"
            data={STATUS_OPTIONS}
            value={status}
            onChange={(val) => { setStatus(val || ''); setPage(1) }}
            clearable
            className="w-48"
          />
          <TextInput
            label="Buscar"
            placeholder="Número, cliente..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => { setSearch(e.currentTarget.value); setPage(1) }}
            className="w-64"
          />
          <DateInput
            label="Data início"
            placeholder="De"
            value={dataInicio}
            onChange={(val) => { setDataInicio(val); setPage(1) }}
            clearable
            valueFormat="DD/MM/YYYY"
          />
          <DateInput
            label="Data fim"
            placeholder="Até"
            value={dataFim}
            onChange={(val) => { setDataFim(val); setPage(1) }}
            clearable
            valueFormat="DD/MM/YYYY"
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
              <Table.Th>Motivo</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Data Criação</Table.Th>
              <Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td className="font-mono">{item.numero}</Table.Td>
                <Table.Td>{item.clienteNome || item.clienteId}</Table.Td>
                <Table.Td>{item.motivo}</Table.Td>
                <Table.Td>
                  <Badge variant="light" color={STATUS_COLORS[item.status] || 'gray'}>
                    {STATUS_LABELS[item.status] || item.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {item.criadoEm
                    ? new Date(item.criadoEm).toLocaleDateString('pt-BR', {
                        day: '2-digit', month: '2-digit', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })
                    : '—'}
                </Table.Td>
                <Table.Td>
                  <Button
                    component={Link}
                    href={`/wms/logistica-reversa/${item.id}`}
                    variant="subtle"
                    size="xs"
                    leftSection={<IconEye size={14} />}
                  >
                    Ver
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
            {items.length === 0 && !isLoading && (
              <Table.Tr>
                <Table.Td colSpan={6} className="text-center py-8 text-zinc-500">
                  Nenhuma autorização de retorno encontrada
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
