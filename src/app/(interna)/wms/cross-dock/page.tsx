'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, Select, TextInput,
  LoadingOverlay, SimpleGrid, Pagination, ThemeIcon,
} from '@mantine/core'
import {
  IconArrowsExchange, IconSearch, IconEye, IconPackage,
  IconTruckDelivery, IconBox, IconCheck,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import Link from 'next/link'

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'IDENTIFICADO', label: 'Identificado' },
  { value: 'EM_TRANSITO', label: 'Em Trânsito' },
  { value: 'EM_STAGING', label: 'Em Staging' },
  { value: 'EXPEDIDO', label: 'Expedido' },
  { value: 'CANCELADO', label: 'Cancelado' },
]

const STATUS_COLORS: Record<string, string> = {
  IDENTIFICADO: 'blue',
  EM_TRANSITO: 'orange',
  EM_STAGING: 'yellow',
  EXPEDIDO: 'green',
  CANCELADO: 'gray',
}

const STATUS_LABELS: Record<string, string> = {
  IDENTIFICADO: 'Identificado',
  EM_TRANSITO: 'Em Trânsito',
  EM_STAGING: 'Em Staging',
  EXPEDIDO: 'Expedido',
  CANCELADO: 'Cancelado',
}

const TIPO_LABELS: Record<string, string> = {
  TRANSITO: 'Trânsito',
  OPORTUNISTICO: 'Oportunístico',
}

const TIPO_COLORS: Record<string, string> = {
  TRANSITO: 'violet',
  OPORTUNISTICO: 'cyan',
}

export default function CrossDockPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Cross-Docking' }, [])

  const [status, setStatus] = useState<string>('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20

  const { data: resp, isLoading } = useQuery<any>({
    queryKey: ['cross-dock', status, search, page],
    queryFn: async () => {
      const params: any = { page, limit }
      if (status) params.status = status
      if (search) params.search = search
      const { data } = await api.get('/cross-dock', { params })
      return data
    },
  })

  const items = resp?.data || []
  const total = resp?.total || 0
  const totalPages = Math.ceil(total / limit)

  // Summary counts
  const totalAtivos = resp?.resumo?.totalAtivos ?? 0
  const emTransito = resp?.resumo?.emTransito ?? 0
  const emStaging = resp?.resumo?.emStaging ?? 0
  const expedidosHoje = resp?.resumo?.expedidosHoje ?? 0

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Expedição / Cross-Docking</Text>
      <Text size="xl" fw={600} mb="lg">Cross-Docking</Text>

      {/* Summary Cards */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="md">
        <Card withBorder>
          <Group gap="sm">
            <ThemeIcon size="lg" variant="light" color="blue">
              <IconPackage size={20} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">Total Ativos</Text>
              <Text size="xl" fw={700}>{totalAtivos}</Text>
            </div>
          </Group>
        </Card>
        <Card withBorder>
          <Group gap="sm">
            <ThemeIcon size="lg" variant="light" color="orange">
              <IconTruckDelivery size={20} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">Em Trânsito</Text>
              <Text size="xl" fw={700}>{emTransito}</Text>
            </div>
          </Group>
        </Card>
        <Card withBorder>
          <Group gap="sm">
            <ThemeIcon size="lg" variant="light" color="yellow">
              <IconBox size={20} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">Em Staging</Text>
              <Text size="xl" fw={700}>{emStaging}</Text>
            </div>
          </Group>
        </Card>
        <Card withBorder>
          <Group gap="sm">
            <ThemeIcon size="lg" variant="light" color="green">
              <IconCheck size={20} />
            </ThemeIcon>
            <div>
              <Text size="xs" c="dimmed">Expedidos Hoje</Text>
              <Text size="xl" fw={700}>{expedidosHoje}</Text>
            </div>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Filters */}
      <Card mb="md">
        <Group gap="md">
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
            placeholder="Produto, pedido..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => { setSearch(e.currentTarget.value); setPage(1) }}
            className="w-64"
          />
        </Group>
      </Card>

      {/* Table */}
      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Produto</Table.Th>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Pedido Destino</Table.Th>
              <Table.Th>Staging Area</Table.Th>
              <Table.Th>Criado em</Table.Th>
              <Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td className="font-mono">{item.produtoId}</Table.Td>
                <Table.Td>
                  <Badge variant="light" color={TIPO_COLORS[item.tipo] || 'gray'}>
                    {TIPO_LABELS[item.tipo] || item.tipo}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge variant="light" color={STATUS_COLORS[item.status] || 'gray'}>
                    {STATUS_LABELS[item.status] || item.status}
                  </Badge>
                </Table.Td>
                <Table.Td>{item.pedidoVendaId || '—'}</Table.Td>
                <Table.Td>{item.stagingArea?.nome || '—'}</Table.Td>
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
                    href={`/wms/cross-dock/${item.id}`}
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
                <Table.Td colSpan={7} className="text-center py-8 text-zinc-500">
                  Nenhum item cross-dock encontrado
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
