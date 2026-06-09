'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import {
  Card, Group, Text, Table, Badge, Button, Stack, SimpleGrid,
  LoadingOverlay, Divider,
} from '@mantine/core'
import { IconSend, IconCash, IconX } from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { notifications } from '@mantine/notifications'

const STATUS_COLORS: Record<string, string> = {
  RASCUNHO: 'gray',
  ENVIADA: 'blue',
  PAGA: 'green',
  CANCELADA: 'red',
  ATRASADA: 'orange',
}

export default function FaturaDetailPage() {
  useModuloGuard('WMS')
  const { id } = useParams<{ id: string }>()
  const queryClient = useQueryClient()
  useEffect(() => { document.title = 'VisioFab - WMS - Fatura Detalhe' }, [])

  const { data: fatura, isLoading } = useQuery<any>({
    queryKey: ['faturamento', 'faturas', id],
    queryFn: async () => {
      const { data } = await api.get(`/faturamento/faturas/${id}`)
      return data
    },
    enabled: !!id,
  })

  const enviarMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/faturamento/faturas/${id}/enviar`)
    },
    onSuccess: () => {
      notifications.show({ title: 'Sucesso', message: 'Fatura enviada', color: 'green' })
      queryClient.invalidateQueries({ queryKey: ['faturamento', 'faturas', id] })
    },
    onError: () => {
      notifications.show({ title: 'Erro', message: 'Erro ao enviar fatura', color: 'red' })
    },
  })

  const pagarMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/faturamento/faturas/${id}/pagar`)
    },
    onSuccess: () => {
      notifications.show({ title: 'Sucesso', message: 'Fatura marcada como paga', color: 'green' })
      queryClient.invalidateQueries({ queryKey: ['faturamento', 'faturas', id] })
    },
    onError: () => {
      notifications.show({ title: 'Erro', message: 'Erro ao marcar pagamento', color: 'red' })
    },
  })

  const cancelarMutation = useMutation({
    mutationFn: async () => {
      await api.patch(`/faturamento/faturas/${id}/cancelar`)
    },
    onSuccess: () => {
      notifications.show({ title: 'Sucesso', message: 'Fatura cancelada', color: 'green' })
      queryClient.invalidateQueries({ queryKey: ['faturamento', 'faturas', id] })
    },
    onError: () => {
      notifications.show({ title: 'Erro', message: 'Erro ao cancelar fatura', color: 'red' })
    },
  })

  const items = fatura?.itens || []
  const valorTotal = items.reduce((acc: number, item: any) => acc + (item.subtotal ?? 0), 0)

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Faturamento / Faturas / Detalhe</Text>
      <Group justify="space-between" mb="lg">
        <Text size="xl" fw={600}>
          Fatura {fatura?.numero ? `#${fatura.numero}` : ''}
        </Text>
        {fatura?.status && (
          <Badge size="lg" variant="light" color={STATUS_COLORS[fatura.status] || 'gray'}>
            {fatura.status}
          </Badge>
        )}
      </Group>

      <Card pos="relative" withBorder mb="md">
        <LoadingOverlay visible={isLoading} />

        {/* Header Info */}
        <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md" mb="md">
          <Stack gap="xs">
            <Text size="sm" c="dimmed">Cliente</Text>
            <Text fw={500}>{fatura?.clienteNome || fatura?.clienteId || '—'}</Text>
          </Stack>
          <Stack gap="xs">
            <Text size="sm" c="dimmed">Período</Text>
            <Text fw={500}>{fatura?.periodo || '—'}</Text>
          </Stack>
          <Stack gap="xs">
            <Text size="sm" c="dimmed">Data Emissão</Text>
            <Text fw={500}>
              {fatura?.dataEmissao
                ? new Date(fatura.dataEmissao).toLocaleDateString('pt-BR')
                : '—'}
            </Text>
          </Stack>
          <Stack gap="xs">
            <Text size="sm" c="dimmed">Data Vencimento</Text>
            <Text fw={500}>
              {fatura?.dataVencimento
                ? new Date(fatura.dataVencimento).toLocaleDateString('pt-BR')
                : '—'}
            </Text>
          </Stack>
        </SimpleGrid>

        <Divider mb="md" />

        {/* Items Table */}
        <Text fw={600} mb="sm">Itens</Text>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Tipo Tarifa</Table.Th>
              <Table.Th>Descrição</Table.Th>
              <Table.Th>Quantidade</Table.Th>
              <Table.Th>Valor Unitário</Table.Th>
              <Table.Th>Subtotal</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any, i: number) => (
              <Table.Tr key={i}>
                <Table.Td>
                  <Badge variant="light" size="sm">{item.tipoTarifa}</Badge>
                </Table.Td>
                <Table.Td>{item.descricao || '—'}</Table.Td>
                <Table.Td>{item.quantidade}</Table.Td>
                <Table.Td>
                  {(item.valorUnitario ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </Table.Td>
                <Table.Td>
                  {(item.subtotal ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </Table.Td>
              </Table.Tr>
            ))}
            {items.length === 0 && !isLoading && (
              <Table.Tr>
                <Table.Td colSpan={5} className="text-center py-4 text-zinc-500">
                  Nenhum item nesta fatura
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
          <Table.Tfoot>
            <Table.Tr>
              <Table.Td colSpan={4} className="text-right">
                <Text fw={600}>Total</Text>
              </Table.Td>
              <Table.Td>
                <Text fw={700}>
                  {(fatura?.valorTotal ?? valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </Text>
              </Table.Td>
            </Table.Tr>
          </Table.Tfoot>
        </Table>
      </Card>

      {/* Action Buttons */}
      {fatura && (
        <Card withBorder>
          <Group gap="md">
            {fatura.status === 'RASCUNHO' && (
              <Button
                leftSection={<IconSend size={16} />}
                onClick={() => enviarMutation.mutate()}
                loading={enviarMutation.isPending}
              >
                Enviar Fatura
              </Button>
            )}
            {fatura.status === 'ENVIADA' && (
              <Button
                color="green"
                leftSection={<IconCash size={16} />}
                onClick={() => pagarMutation.mutate()}
                loading={pagarMutation.isPending}
              >
                Registrar Pagamento
              </Button>
            )}
            {(fatura.status === 'RASCUNHO' || fatura.status === 'ENVIADA') && (
              <Button
                color="red"
                variant="outline"
                leftSection={<IconX size={16} />}
                onClick={() => cancelarMutation.mutate()}
                loading={cancelarMutation.isPending}
              >
                Cancelar Fatura
              </Button>
            )}
          </Group>
        </Card>
      )}
    </div>
  )
}
