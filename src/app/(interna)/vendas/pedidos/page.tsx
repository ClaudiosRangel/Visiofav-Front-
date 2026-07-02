'use client'

import { useState, useEffect } from 'react'
import {
  Button, Card, Group, Text, Table, Badge, ActionIcon, Tooltip,
  LoadingOverlay, Select, Pagination, TextInput, Switch,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconPlus, IconRefresh, IconEye, IconCheck, IconX, IconSearch } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useRouter } from 'next/navigation'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { usePedidosVenda, useConfirmarPedido, useCancelarPedido } from '@/data/hooks/vendas/usePedidoVenda'
import { BadgePrioridade } from '@/components/vendas/BadgePrioridade'
import type { PrioridadePedido, OrigemPedido, StatusPedido, PedidosVendaFilters } from '@/data/hooks/vendas/types'

const statusColors: Record<string, string> = {
  RASCUNHO: 'gray',
  CONFIRMADO: 'blue',
  EM_SEPARACAO: 'orange',
  EFETIVADO: 'teal',
  FATURADO: 'green',
  CANCELADO: 'red',
}

const STATUS_OPTIONS = [
  { value: 'RASCUNHO', label: 'Rascunho' },
  { value: 'CONFIRMADO', label: 'Confirmado' },
  { value: 'EM_SEPARACAO', label: 'Em Separação' },
  { value: 'EFETIVADO', label: 'Efetivado' },
  { value: 'FATURADO', label: 'Faturado' },
  { value: 'CANCELADO', label: 'Cancelado' },
]

const PRIORIDADE_OPTIONS = [
  { value: 'BAIXA', label: 'Baixa' },
  { value: 'NORMAL', label: 'Normal' },
  { value: 'URGENTE', label: 'Urgente' },
]

const ORIGEM_OPTIONS = [
  { value: 'MANUAL', label: 'Manual' },
  { value: 'ECOMMERCE', label: 'E-commerce' },
  { value: 'EDI', label: 'EDI' },
  { value: 'ORCAMENTO', label: 'Orçamento' },
]

export default function PedidosVendaPage() {
  useModuloGuard('VENDAS')
  useEffect(() => { document.title = 'Vizor - Vendas - Pedidos' }, [])

  const router = useRouter()

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [prioridadeFilter, setPrioridadeFilter] = useState<string | null>(null)
  const [origemFilter, setOrigemFilter] = useState<string | null>(null)
  const [numeroPedidoCliente, setNumeroPedidoCliente] = useState('')
  const [debouncedNumeroPedido] = useDebouncedValue(numeroPedidoCliente, 400)
  const [ordenarPorPrioridade, setOrdenarPorPrioridade] = useState(false)
  const [page, setPage] = useState(1)
  const limit = 20

  // Reset page when any filter changes
  useEffect(() => { setPage(1) }, [statusFilter, prioridadeFilter, origemFilter, debouncedNumeroPedido, ordenarPorPrioridade])

  // Build filters object
  const filters: PedidosVendaFilters = {
    page,
    limit,
    ...(statusFilter ? { status: statusFilter as StatusPedido } : {}),
    ...(prioridadeFilter ? { prioridade: prioridadeFilter as PrioridadePedido } : {}),
    ...(origemFilter ? { origemPedido: origemFilter as OrigemPedido } : {}),
    ...(debouncedNumeroPedido.trim() ? { numeroPedidoCliente: debouncedNumeroPedido.trim() } : {}),
    ...(ordenarPorPrioridade ? { ordenarPorPrioridade: true } : {}),
  }

  const { data: response, isLoading, refetch } = usePedidosVenda(filters)

  const confirmar = useConfirmarPedido()
  const cancelar = useCancelarPedido()

  const items = response?.data || []
  const total = response?.total || 0
  const totalPages = Math.ceil(total / limit)

  function handleConfirmar(id: string) {
    if (confirm('Confirmar pedido?')) {
      confirmar.mutate(id, {
        onSuccess: () => notifications.show({ title: 'Sucesso', message: 'Pedido confirmado', color: 'green' }),
        onError: (err: any) => notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao confirmar', color: 'red' }),
      })
    }
  }

  function handleCancelar(id: string) {
    const motivo = prompt('Motivo do cancelamento (mínimo 10 caracteres):')
    if (motivo && motivo.length >= 10) {
      cancelar.mutate({ id, motivo }, {
        onSuccess: () => notifications.show({ title: 'Sucesso', message: 'Pedido cancelado', color: 'green' }),
        onError: (err: any) => notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao cancelar', color: 'red' }),
      })
    }
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Vendas / Pedidos</Text>
      <Text size="xl" fw={600} mb="lg">Pedidos de Venda</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />

        {/* Filters row */}
        <Group justify="space-between" mb="md" wrap="wrap">
          <Group wrap="wrap">
            <Select
              placeholder="Status"
              data={STATUS_OPTIONS}
              value={statusFilter}
              onChange={setStatusFilter}
              clearable
              style={{ minWidth: 150 }}
            />
            <Select
              placeholder="Prioridade"
              data={PRIORIDADE_OPTIONS}
              value={prioridadeFilter}
              onChange={setPrioridadeFilter}
              clearable
              style={{ minWidth: 140 }}
            />
            <Select
              placeholder="Origem"
              data={ORIGEM_OPTIONS}
              value={origemFilter}
              onChange={setOrigemFilter}
              clearable
              style={{ minWidth: 140 }}
            />
            <TextInput
              placeholder="Nº Pedido Cliente"
              leftSection={<IconSearch size={16} />}
              value={numeroPedidoCliente}
              onChange={(e) => setNumeroPedidoCliente(e.currentTarget.value)}
              style={{ minWidth: 180 }}
            />
            <Switch
              label="Ordenar por Prioridade"
              checked={ordenarPorPrioridade}
              onChange={(e) => setOrdenarPorPrioridade(e.currentTarget.checked)}
            />
          </Group>
          <Group>
            <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
            <Button leftSection={<IconPlus size={16} />} onClick={() => router.push('/vendas/pedidos/novo')}>Novo Pedido</Button>
          </Group>
        </Group>

        {/* Table */}
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Número</Table.Th>
              <Table.Th>Cliente</Table.Th>
              <Table.Th>Vendedor</Table.Th>
              <Table.Th>Valor Total</Table.Th>
              <Table.Th>Prioridade</Table.Th>
              <Table.Th>Origem</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th style={{ width: 120 }}>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td fw={500}>{item.numero}</Table.Td>
                <Table.Td>{item.cliente?.nomeFantasia || item.cliente?.razaoSocial || '—'}</Table.Td>
                <Table.Td>{item.vendedor?.nome || '—'}</Table.Td>
                <Table.Td>{Number(item.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
                <Table.Td>
                  <BadgePrioridade prioridade={item.prioridade} />
                </Table.Td>
                <Table.Td>
                  <Badge variant="light" size="sm">{item.origemPedido}</Badge>
                </Table.Td>
                <Table.Td>
                  <Badge color={statusColors[item.status] || 'gray'}>{item.status}</Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <Tooltip label="Ver">
                      <ActionIcon variant="subtle" color="gray" onClick={() => router.push(`/vendas/pedidos/${item.id}`)}>
                        <IconEye size={18} />
                      </ActionIcon>
                    </Tooltip>
                    {item.status === 'RASCUNHO' && (
                      <Tooltip label="Confirmar">
                        <ActionIcon variant="subtle" color="blue" onClick={() => handleConfirmar(item.id)}>
                          <IconCheck size={18} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                    {['RASCUNHO', 'CONFIRMADO'].includes(item.status) && (
                      <Tooltip label="Cancelar">
                        <ActionIcon variant="subtle" color="red" onClick={() => handleCancelar(item.id)}>
                          <IconX size={18} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && items.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={8} className="text-center py-8 text-zinc-500">
                  Nenhum pedido encontrado
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>

        {totalPages > 1 && (
          <Group justify="center" mt="md">
            <Pagination total={totalPages} value={page} onChange={setPage} />
          </Group>
        )}
      </Card>
    </div>
  )
}
