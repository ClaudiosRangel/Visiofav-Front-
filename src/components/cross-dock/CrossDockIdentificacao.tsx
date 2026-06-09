'use client'

import { Button, Card, Table, Badge, Text, LoadingOverlay, Group } from '@mantine/core'
import { IconArrowsExchange } from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'

interface Props {
  notaEntradaId: string
}

export function CrossDockIdentificacao({ notaEntradaId }: Props) {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['cross-dock-elegiveis', notaEntradaId],
    queryFn: async () => {
      const { data } = await api.post('/cross-dock/identificar', { notaEntradaId })
      return data
    },
    enabled: !!notaEntradaId,
  })

  const confirmar = useMutation({
    mutationFn: async (itens: any[]) => {
      const { data } = await api.post('/cross-dock/confirmar', { itens })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cross-dock-elegiveis'] })
      notifications.show({
        title: 'Cross-dock confirmado',
        message: 'Itens confirmados para cross-docking',
        color: 'green',
      })
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Erro',
        message: err?.response?.data?.message || 'Falha ao confirmar cross-dock',
        color: 'red',
      })
    },
  })

  if (!data || data.length === 0) return null

  return (
    <Card withBorder mt="md">
      <Group mb="sm">
        <IconArrowsExchange size={20} />
        <Text fw={600}>Cross-Dock Disponível</Text>
      </Group>
      <LoadingOverlay visible={isLoading || confirmar.isPending} />
      <Table striped>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Produto</Table.Th>
            <Table.Th>Qtd</Table.Th>
            <Table.Th>Pedidos Elegíveis</Table.Th>
            <Table.Th>Ação</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {data.map((item: any) => (
            <Table.Tr key={item.itemNotaEntradaId}>
              <Table.Td>{item.produtoNome}</Table.Td>
              <Table.Td>{item.quantidade}</Table.Td>
              <Table.Td>
                {item.pedidosElegiveis.map((p: any) => (
                  <Badge key={p.pedidoVendaId} variant="light" size="sm" mr={4}>
                    #{p.pedidoNumero} - {p.clienteNome} ({p.quantidadePendente})
                  </Badge>
                ))}
              </Table.Td>
              <Table.Td>
                <Button
                  size="xs"
                  variant="light"
                  color="violet"
                  loading={confirmar.isPending}
                  onClick={() =>
                    confirmar.mutate(
                      item.pedidosElegiveis.map((p: any) => ({
                        itemNotaEntradaId: item.itemNotaEntradaId,
                        produtoId: item.produtoId,
                        quantidade: Math.min(item.quantidade, p.quantidadePendente),
                        pedidoVendaId: p.pedidoVendaId,
                        tipo: 'TRANSITO',
                      }))
                    )
                  }
                >
                  Confirmar Cross-Dock
                </Button>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Card>
  )
}
