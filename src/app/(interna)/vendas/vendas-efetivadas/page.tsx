'use client'

import { useState, useEffect } from 'react'
import { Button, Card, Group, Text, Table, Badge, ActionIcon, Tooltip, LoadingOverlay, Pagination } from '@mantine/core'
import { IconRefresh, IconEye } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useRouter } from 'next/navigation'

const entregaColors: Record<string, string> = { PENDENTE: 'gray', EM_TRANSITO: 'orange', ENTREGUE: 'green' }

export default function VendasEfetivadasPage() {
  useModuloGuard('VENDAS')
  useEffect(() => { document.title = 'Vizor - Vendas - Efetivadas' }, [])
  const router = useRouter()
  const [page, setPage] = useState(1)
  const limit = 20

  const { data: response, isLoading, refetch } = useQuery<any>({
    queryKey: ['vendas', { page, limit }],
    queryFn: async () => { const { data } = await api.get('/vendas', { params: { page, limit } }); return data },
  })

  const items = response?.data || []
  const total = response?.total || 0
  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Vendas / Vendas Efetivadas</Text>
      <Text size="xl" fw={600} mb="lg">Vendas Efetivadas</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Group justify="flex-end" mb="md">
          <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Pedido #</Table.Th>
              <Table.Th>Cliente</Table.Th>
              <Table.Th>Vendedor</Table.Th>
              <Table.Th>Valor Total</Table.Th>
              <Table.Th>Comissão</Table.Th>
              <Table.Th>Entrega</Table.Th>
              <Table.Th className="w-20">Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td fw={500}>{item.pedidoVenda?.numero}</Table.Td>
                <Table.Td>{item.pedidoVenda?.cliente?.nomeFantasia || item.pedidoVenda?.cliente?.razaoSocial}</Table.Td>
                <Table.Td>{item.pedidoVenda?.vendedor?.nome || '—'}</Table.Td>
                <Table.Td>{Number(item.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
                <Table.Td>{item.comissaoValor ? Number(item.comissaoValor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</Table.Td>
                <Table.Td><Badge color={entregaColors[item.statusEntrega] || 'gray'}>{item.statusEntrega}</Badge></Table.Td>
                <Table.Td>
                  <Tooltip label="Ver detalhes">
                    <ActionIcon variant="subtle" color="gray" onClick={() => router.push(`/vendas/pedidos/${item.pedidoVendaId}`)}><IconEye size={18} /></ActionIcon>
                  </Tooltip>
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && items.length === 0 && <Table.Tr><Table.Td colSpan={7} className="text-center py-8 text-zinc-500">Nenhuma venda efetivada</Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>

        {totalPages > 1 && <Group justify="center" mt="md"><Pagination total={totalPages} value={page} onChange={setPage} /></Group>}
      </Card>
    </div>
  )
}
