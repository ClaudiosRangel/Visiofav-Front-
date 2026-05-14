'use client'

import { useState } from 'react'
import {
  Button, Card, Group, Text, Table, Badge, LoadingOverlay, Modal, Textarea,
} from '@mantine/core'
import { IconArrowLeft, IconCheck, IconX } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useRouter, useParams } from 'next/navigation'

const statusColors: Record<string, string> = {
  RASCUNHO: 'gray', CONFIRMADO: 'blue', EM_SEPARACAO: 'orange', FATURADO: 'green', CANCELADO: 'red',
}

export default function DetalhePedidoVendaPage() {
  useModuloGuard('VENDAS')
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const queryClient = useQueryClient()
  const [cancelModal, setCancelModal] = useState(false)
  const [motivo, setMotivo] = useState('')

  const { data: pedido, isLoading } = useQuery<any>({
    queryKey: ['pedido-venda', id],
    queryFn: async () => { const { data } = await api.get(`/pedidos-venda/${id}`); return data },
  })

  const confirmar = useMutation({
    mutationFn: async () => { const { data } = await api.patch(`/pedidos-venda/${id}/confirmar`); return data },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pedido-venda', id] }); notifications.show({ title: 'Sucesso', message: 'Pedido confirmado', color: 'green' }) },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) },
  })

  const cancelar = useMutation({
    mutationFn: async () => { const { data } = await api.patch(`/pedidos-venda/${id}/cancelar`, { motivo }); return data },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pedido-venda', id] }); setCancelModal(false); setMotivo(''); notifications.show({ title: 'Sucesso', message: 'Pedido cancelado', color: 'green' }) },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) },
  })

  const efetivar = useMutation({
    mutationFn: async () => {
      // 1. Efetivar a venda
      const { data: vendaResp } = await api.post('/vendas/efetivar', {
        pedidoVendaId: id,
        condicaoPagamento: { formaPagamento: 'BOLETO', parcelas: 1 },
      })
      return vendaResp
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedido-venda', id] })
      notifications.show({ title: '✅ Venda efetivada', message: 'Pedido enviado para separação no WMS. Contas a receber geradas.', color: 'green' })
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao efetivar', color: 'red' }) },
  })

  if (isLoading) return <Card pos="relative" mih={200}><LoadingOverlay visible /></Card>
  if (!pedido) return <div><Text>Pedido não encontrado</Text><Button mt="md" onClick={() => router.push('/vendas/pedidos')}>Voltar</Button></div>

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Vendas / Pedidos / #{pedido.numero}</Text>
      <Group mb="lg">
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => router.push('/vendas/pedidos')}>Voltar</Button>
        <Text size="xl" fw={600}>Pedido de Venda #{pedido.numero}</Text>
        <Badge color={statusColors[pedido.status] || 'gray'} size="lg">{pedido.status}</Badge>
      </Group>

      <Card mb="md">
        <Text fw={500} mb="sm">Dados do Pedido</Text>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div><Text size="sm" c="dimmed">Cliente</Text><Text fw={500}>{pedido.cliente?.nomeFantasia || pedido.cliente?.razaoSocial}</Text></div>
          <div><Text size="sm" c="dimmed">Vendedor</Text><Text>{pedido.vendedor?.nome || '—'}</Text></div>
          <div><Text size="sm" c="dimmed">Tabela de Preço</Text><Text>{pedido.tabelaPreco?.nome || '—'}</Text></div>
          <div><Text size="sm" c="dimmed">Valor Total</Text><Text fw={600} size="lg">{Number(pedido.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Text></div>
        </div>
      </Card>

      <Card mb="md">
        <Text fw={500} mb="sm">Itens ({pedido.itens?.length || 0})</Text>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Produto</Table.Th><Table.Th>Unidade</Table.Th><Table.Th>Quantidade</Table.Th>
              <Table.Th>Preço Base</Table.Th><Table.Th>Preço Final</Table.Th><Table.Th>Total</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(pedido.itens || []).map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td fw={500}>{item.produto?.nome || item.produtoId}</Table.Td>
                <Table.Td>{item.unidade || item.produto?.unidade || '—'}</Table.Td>
                <Table.Td>{Number(item.quantidade)}</Table.Td>
                <Table.Td>{Number(item.precoBase).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
                <Table.Td>{Number(item.precoFinal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
                <Table.Td fw={500}>{Number(item.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        <Group justify="flex-end" mt="md">
          <Text size="lg" fw={600}>Total: {Number(pedido.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Text>
        </Group>
      </Card>

      {pedido.motivoCancelamento && (
        <Card mb="md"><Text fw={500} mb="sm">Motivo do Cancelamento</Text><Text>{pedido.motivoCancelamento}</Text></Card>
      )}

      <Group justify="flex-end">
        {pedido.status === 'RASCUNHO' && (
          <>
            <Button variant="light" onClick={() => router.push(`/vendas/pedidos/novo?editId=${id}`)}>Editar Itens</Button>
            <Button color="blue" leftSection={<IconCheck size={16} />} onClick={() => { if (confirm('Confirmar pedido?')) confirmar.mutate() }}>Confirmar</Button>
          </>
        )}
        {pedido.status === 'CONFIRMADO' && (
          <>
            <Button color="green" leftSection={<IconCheck size={16} />} onClick={() => { if (confirm('Efetivar venda? Isso irá gerar contas a receber e enviar para separação no WMS.')) efetivar.mutate() }} loading={efetivar.isPending}>
              Efetivar Venda
            </Button>
          </>
        )}
        {pedido.status === 'EM_SEPARACAO' && (
          <Badge color="orange" size="lg">Aguardando separação no WMS</Badge>
        )}
        {['RASCUNHO', 'CONFIRMADO'].includes(pedido.status) && (
          <Button color="red" variant="light" leftSection={<IconX size={16} />} onClick={() => setCancelModal(true)}>Cancelar Pedido</Button>
        )}
      </Group>

      <Modal opened={cancelModal} onClose={() => { setCancelModal(false); setMotivo('') }} title="Cancelar Pedido" centered>
        <Textarea label="Motivo" description="Mínimo 10 caracteres" placeholder="Informe o motivo..." minRows={3} value={motivo} onChange={(e) => setMotivo(e.currentTarget.value)} error={motivo.length > 0 && motivo.length < 10 ? 'Mínimo 10 caracteres' : undefined} />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => { setCancelModal(false); setMotivo('') }}>Voltar</Button>
          <Button color="red" onClick={() => cancelar.mutate()} loading={cancelar.isPending} disabled={motivo.length < 10}>Confirmar Cancelamento</Button>
        </Group>
      </Modal>
    </div>
  )
}
