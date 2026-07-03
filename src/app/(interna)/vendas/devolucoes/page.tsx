'use client'

import { useState, useEffect } from 'react'
import {
  Button, Card, Group, Text, Table, Badge, LoadingOverlay, Pagination,
} from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useDevolucoesVenda } from '@/data/hooks/vendas/useDevolucaoVenda'

export default function DevolucoesVendaPage() {
  useModuloGuard('VENDAS')
  useEffect(() => { document.title = 'Vizor - Vendas - Devoluções' }, [])

  const [page, setPage] = useState(1)
  const { data: response, isLoading, refetch } = useDevolucoesVenda({ page, limit: 20 })

  const items = response?.data || []
  const total = response?.total || 0
  const totalPages = Math.ceil(total / 20)

  function formatCurrency(v: number) {
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('pt-BR')
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Vendas / Devoluções</Text>
      <Text size="xl" fw={600} mb="lg">Devoluções de Venda</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />

        <Group justify="space-between" mb="md">
          <Text size="sm" c="dimmed">{total} devolução(ões) registrada(s)</Text>
          <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Data</Table.Th>
              <Table.Th>Pedido Origem</Table.Th>
              <Table.Th>Motivo</Table.Th>
              <Table.Th>Itens</Table.Th>
              <Table.Th>Valor Estorno</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((dev: any) => (
              <Table.Tr key={dev.id}>
                <Table.Td>{formatDate(dev.criadoEm)}</Table.Td>
                <Table.Td fw={500}>#{dev.vendaEfetivada?.pedidoVenda?.numero || '—'}</Table.Td>
                <Table.Td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dev.motivo}</Table.Td>
                <Table.Td>{dev.itens?.length || 0}</Table.Td>
                <Table.Td c="red" fw={500}>{formatCurrency(dev.valorTotal)}</Table.Td>
                <Table.Td>
                  <Badge color={dev.status === 'PROCESSADA' ? 'green' : 'red'}>{dev.status}</Badge>
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && items.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--mantine-color-dimmed)' }}>
                  Nenhuma devolução registrada
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
