'use client'

import { useState, useEffect } from 'react'
import { Button, Card, Group, Text, Table, ActionIcon, Tooltip, LoadingOverlay, Pagination } from '@mantine/core'
import { IconRefresh, IconEye, IconTrash } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useRouter } from 'next/navigation'

export default function ComprasEfetivadasPage() {
  useModuloGuard('COMPRAS')
  useEffect(() => { document.title = 'VisioFab - Compras - Efetivadas' }, [])
  const router = useRouter()
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const limit = 20

  const { data: response, isLoading, refetch } = useQuery<any>({
    queryKey: ['compras', { page, limit }],
    queryFn: async () => {
      const { data } = await api.get('/compras', { params: { page, limit } })
      return data
    },
  })

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/compras/${id}`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['compras'] })
      notifications.show({ title: 'Sucesso', message: 'Compra excluída', color: 'green' })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao excluir', color: 'red' })
    },
  })

  const items = response?.data || []
  const total = response?.total || 0
  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Compras / Compras Efetivadas</Text>
      <Text size="xl" fw={600} mb="lg">Compras Efetivadas</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Group justify="flex-end" mb="md">
          <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Pedido #</Table.Th>
              <Table.Th>NF</Table.Th>
              <Table.Th>Fornecedor</Table.Th>
              <Table.Th>Data Efetivação</Table.Th>
              <Table.Th>Valor Total</Table.Th>
              <Table.Th className="w-28">Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td fw={500}>{item.pedidoCompra?.numero}</Table.Td>
                <Table.Td>
                  {item.numeroNf ? (
                    <Text size="sm" fw={500} className="font-mono">{item.numeroNf}{item.serieNf ? `/${item.serieNf}` : ''}</Text>
                  ) : (
                    <Text size="sm" c="dimmed">—</Text>
                  )}
                </Table.Td>
                <Table.Td>{item.pedidoCompra?.fornecedor?.nomeFantasia || item.pedidoCompra?.fornecedor?.razaoSocial}</Table.Td>
                <Table.Td>{new Date(item.dataEfetivacao).toLocaleDateString('pt-BR')}</Table.Td>
                <Table.Td>{Number(item.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <Tooltip label="Ver detalhes">
                      <ActionIcon variant="subtle" color="gray" onClick={() => router.push(`/compras/compras-efetivadas/${item.id}`)}>
                        <IconEye size={18} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Excluir">
                      <ActionIcon variant="subtle" color="red"
                        onClick={() => { if (confirm('Excluir esta compra efetivada? Isso também excluirá contas a pagar e devoluções vinculadas.')) excluir.mutate(item.id) }}
                        loading={excluir.isPending}>
                        <IconTrash size={18} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && items.length === 0 && (
              <Table.Tr><Table.Td colSpan={6} className="text-center py-8 text-zinc-500">Nenhuma compra efetivada</Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>

        {totalPages > 1 && (
          <Group justify="center" mt="md"><Pagination total={totalPages} value={page} onChange={setPage} /></Group>
        )}
      </Card>
    </div>
  )
}
