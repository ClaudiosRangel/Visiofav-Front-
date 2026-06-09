'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, Select, TextInput,
  LoadingOverlay, Pagination,
} from '@mantine/core'
import { IconSearch, IconPlus, IconEye } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import Link from 'next/link'
import { ContratoModal } from './ContratoModal'

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'ATIVO', label: 'Ativo' },
  { value: 'SUSPENSO', label: 'Suspenso' },
  { value: 'ENCERRADO', label: 'Encerrado' },
]

const STATUS_COLORS: Record<string, string> = {
  ATIVO: 'green',
  SUSPENSO: 'yellow',
  ENCERRADO: 'gray',
}

const PERIODICIDADE_LABELS: Record<string, string> = {
  MENSAL: 'Mensal',
  QUINZENAL: 'Quinzenal',
  SEMANAL: 'Semanal',
}

export default function ContratosPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - Contratos' }, [])

  const [status, setStatus] = useState<string>('')
  const [clienteId, setClienteId] = useState<string>('')
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
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

  const { data: resp, isLoading, refetch } = useQuery<any>({
    queryKey: ['faturamento', 'contratos', status, clienteId, page],
    queryFn: async () => {
      const params: any = { page, limit }
      if (status) params.status = status
      if (clienteId) params.clienteId = clienteId
      const { data } = await api.get('/faturamento/contratos', { params })
      return data
    },
  })

  const items = resp?.data || []
  const total = resp?.total || 0
  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Faturamento / Contratos</Text>
      <Group justify="space-between" mb="lg">
        <Text size="xl" fw={600}>Contratos</Text>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setModalOpen(true)}>
          Novo Contrato
        </Button>
      </Group>

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
          <Select
            label="Cliente"
            placeholder="Filtrar por cliente"
            data={clienteOptions}
            value={clienteId}
            onChange={(val) => { setClienteId(val || ''); setPage(1) }}
            clearable
            searchable
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
              <Table.Th>Cliente</Table.Th>
              <Table.Th>Data Início</Table.Th>
              <Table.Th>Data Fim</Table.Th>
              <Table.Th>Periodicidade</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td>{item.clienteNome || item.clienteId}</Table.Td>
                <Table.Td>
                  {item.dataInicio
                    ? new Date(item.dataInicio).toLocaleDateString('pt-BR')
                    : '—'}
                </Table.Td>
                <Table.Td>
                  {item.dataFim
                    ? new Date(item.dataFim).toLocaleDateString('pt-BR')
                    : '—'}
                </Table.Td>
                <Table.Td>{PERIODICIDADE_LABELS[item.periodicidade] || item.periodicidade}</Table.Td>
                <Table.Td>
                  <Badge variant="light" color={STATUS_COLORS[item.status] || 'gray'}>
                    {item.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Button
                    component={Link}
                    href={`/wms/faturamento/contratos/${item.id}`}
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
                  Nenhum contrato encontrado
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

      <ContratoModal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => { setModalOpen(false); refetch() }}
      />
    </div>
  )
}
