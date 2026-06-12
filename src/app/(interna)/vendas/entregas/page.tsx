'use client'

import { Button, Card, Group, Text, Table, Badge, Select, LoadingOverlay, Modal, Textarea } from '@mantine/core'
import { IconRefresh, IconTruckDelivery } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useState, useEffect } from 'react'

const entregaColors: Record<string, string> = { PENDENTE: 'gray', EM_TRANSITO: 'orange', ENTREGUE: 'green' }
const statusOptions = [
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'EM_TRANSITO', label: 'Em Trânsito' },
  { value: 'ENTREGUE', label: 'Entregue' },
]

export default function EntregasPage() {
  useModuloGuard('VENDAS')
  useEffect(() => { document.title = 'Vizor - Vendas - Entregas' }, [])
  const queryClient = useQueryClient()
  const [motivoModal, setMotivoModal] = useState<{ vendaId: string; novoStatus: string } | null>(null)
  const [motivo, setMotivo] = useState('')

  const { data: response, isLoading, refetch } = useQuery<any>({
    queryKey: ['vendas', { page: 1, limit: 100 }],
    queryFn: async () => { const { data } = await api.get('/vendas', { params: { limit: 100 } }); return data },
  })

  const atualizarEntrega = useMutation({
    mutationFn: async ({ id, statusEntrega, motivoReversao }: { id: string; statusEntrega: string; motivoReversao?: string }) => {
      const body: any = { statusEntrega }
      if (motivoReversao) body.motivoReversao = motivoReversao
      const { data } = await api.patch(`/vendas/${id}/entrega`, body)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vendas'] })
      notifications.show({ title: 'Sucesso', message: 'Status de entrega atualizado', color: 'green' })
      setMotivoModal(null)
      setMotivo('')
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' })
    },
  })

  function handleStatusChange(vendaId: string, statusAtual: string, novoStatus: string) {
    if (statusAtual === 'ENTREGUE' && novoStatus !== 'ENTREGUE') {
      setMotivoModal({ vendaId, novoStatus })
      return
    }
    atualizarEntrega.mutate({ id: vendaId, statusEntrega: novoStatus })
  }

  function handleConfirmReversao() {
    if (!motivoModal || motivo.length < 10) {
      notifications.show({ title: 'Erro', message: 'Motivo deve ter no mínimo 10 caracteres', color: 'red' })
      return
    }
    atualizarEntrega.mutate({ id: motivoModal.vendaId, statusEntrega: motivoModal.novoStatus, motivoReversao: motivo })
  }

  const items = (response?.data || []).filter((v: any) => v.statusEntrega !== undefined)

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Vendas / Entregas</Text>
      <Text size="xl" fw={600} mb="lg">Controle de Entregas</Text>

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
              <Table.Th>Valor</Table.Th>
              <Table.Th>Status Entrega</Table.Th>
              <Table.Th>Data Entrega</Table.Th>
              <Table.Th className="w-48">Alterar Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td fw={500}>{item.pedidoVenda?.numero}</Table.Td>
                <Table.Td>{item.pedidoVenda?.cliente?.nomeFantasia || item.pedidoVenda?.cliente?.razaoSocial}</Table.Td>
                <Table.Td>{Number(item.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
                <Table.Td><Badge color={entregaColors[item.statusEntrega] || 'gray'}>{item.statusEntrega}</Badge></Table.Td>
                <Table.Td>{item.dataEntrega ? new Date(item.dataEntrega).toLocaleDateString('pt-BR') : '—'}</Table.Td>
                <Table.Td>
                  <Select
                    data={statusOptions}
                    value={item.statusEntrega}
                    onChange={(val) => val && handleStatusChange(item.id, item.statusEntrega, val)}
                    size="xs"
                  />
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && items.length === 0 && <Table.Tr><Table.Td colSpan={6} className="text-center py-8 text-zinc-500">Nenhuma venda para controle de entrega</Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>
      </Card>

      <Modal opened={!!motivoModal} onClose={() => { setMotivoModal(null); setMotivo('') }} title="Motivo da Reversão" centered>
        <Textarea label="Motivo" description="Mínimo 10 caracteres" placeholder="Informe o motivo..." minRows={3} value={motivo} onChange={(e) => setMotivo(e.currentTarget.value)} error={motivo.length > 0 && motivo.length < 10 ? 'Mínimo 10 caracteres' : undefined} />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => { setMotivoModal(null); setMotivo('') }}>Cancelar</Button>
          <Button onClick={handleConfirmReversao} loading={atualizarEntrega.isPending} disabled={motivo.length < 10}>Confirmar</Button>
        </Group>
      </Modal>
    </div>
  )
}
