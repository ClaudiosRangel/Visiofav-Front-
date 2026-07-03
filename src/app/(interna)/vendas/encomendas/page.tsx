'use client'

import { useState, useEffect } from 'react'
import {
  Button, Card, Group, Text, Table, Badge, ActionIcon, Tooltip,
  LoadingOverlay, Pagination, Modal, Select,
} from '@mantine/core'
import { IconRefresh, IconEdit } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import {
  useVendasEncomenda, useEditarVendaEncomenda,
} from '@/data/hooks/vendas/useVendaEncomenda'

const statusColors: Record<string, string> = {
  PENDENTE: 'orange',
  EM_PRODUCAO: 'blue',
  PRONTO: 'teal',
  ENTREGUE: 'green',
  CANCELADO: 'red',
}

const STATUS_OPTIONS = [
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'EM_PRODUCAO', label: 'Em Produção' },
  { value: 'PRONTO', label: 'Pronto' },
  { value: 'ENTREGUE', label: 'Entregue' },
  { value: 'CANCELADO', label: 'Cancelado' },
]

export default function EncomendasPage() {
  useModuloGuard('VENDAS')
  useEffect(() => { document.title = 'Vizor - Vendas - Encomendas' }, [])

  const [page, setPage] = useState(1)
  const [statusModal, setStatusModal] = useState<any>(null)
  const [novoStatus, setNovoStatus] = useState<string | null>(null)

  const { data: response, isLoading, refetch } = useVendasEncomenda({ page, limit: 20 })
  const editar = useEditarVendaEncomenda()

  const items = response?.data || []
  const total = response?.total || 0
  const totalPages = Math.ceil(total / 20)

  function openStatusModal(item: any) {
    setStatusModal(item)
    setNovoStatus(item.status)
  }

  function handleSaveStatus() {
    if (!statusModal || !novoStatus) return
    editar.mutate({ id: statusModal.id, status: novoStatus }, {
      onSuccess: () => { setStatusModal(null); notifications.show({ title: 'Sucesso', message: 'Status atualizado', color: 'green' }) },
      onError: () => notifications.show({ title: 'Erro', message: 'Falha ao atualizar', color: 'red' }),
    })
  }

  function formatDate(d?: string) {
    return d ? new Date(d).toLocaleDateString('pt-BR') : '—'
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Vendas / Encomendas</Text>
      <Text size="xl" fw={600} mb="lg">Vendas sob Encomenda</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />

        <Group justify="space-between" mb="md">
          <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Pedido</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Ordem de Produção</Table.Th>
              <Table.Th>Previsão Entrega</Table.Th>
              <Table.Th style={{ width: 60 }}>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td fw={500}>{item.pedido}</Table.Td>
                <Table.Td>
                  <Badge color={statusColors[item.status] || 'gray'}>{item.status}</Badge>
                </Table.Td>
                <Table.Td>{item.ordemProducao || '—'}</Table.Td>
                <Table.Td>{formatDate(item.previsaoEntrega)}</Table.Td>
                <Table.Td>
                  <Tooltip label="Atualizar Status">
                    <ActionIcon variant="subtle" color="blue" onClick={() => openStatusModal(item)}>
                      <IconEdit size={18} />
                    </ActionIcon>
                  </Tooltip>
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && items.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--mantine-color-dimmed)' }}>
                  Nenhuma encomenda encontrada
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

      <Modal opened={!!statusModal} onClose={() => setStatusModal(null)} title="Atualizar Status" centered>
        <Select label="Novo Status" data={STATUS_OPTIONS} value={novoStatus} onChange={setNovoStatus} mb="sm" />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setStatusModal(null)}>Cancelar</Button>
          <Button loading={editar.isPending} onClick={handleSaveStatus}>Salvar</Button>
        </Group>
      </Modal>
    </div>
  )
}
