'use client'

import { useState, useEffect } from 'react'
import {
  Button, Card, Group, Text, Table, Badge, ActionIcon, Tooltip,
  LoadingOverlay, Pagination, Modal, TextInput,
} from '@mantine/core'
import { IconRefresh, IconArrowBack } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import {
  useVendasConsignadas, useEditarVendaConsignada,
} from '@/data/hooks/vendas/useVendaConsignada'

const statusColors: Record<string, string> = {
  EM_CONSIGNACAO: 'blue',
  PARCIAL: 'orange',
  RETORNADA: 'teal',
  FATURADA: 'green',
}

export default function ConsignadasPage() {
  useModuloGuard('VENDAS')
  useEffect(() => { document.title = 'Vizor - Vendas - Consignadas' }, [])

  const [page, setPage] = useState(1)
  const [retornoModal, setRetornoModal] = useState<any>(null)
  const [retornoObs, setRetornoObs] = useState('')

  const { data: response, isLoading, refetch } = useVendasConsignadas({ page, limit: 20 })
  const editar = useEditarVendaConsignada()

  const items = response?.data || []
  const total = response?.total || 0
  const totalPages = Math.ceil(total / 20)

  function formatCurrency(v: number) {
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  function formatDate(d?: string) {
    return d ? new Date(d).toLocaleDateString('pt-BR') : '—'
  }

  function handleRetorno() {
    if (!retornoModal) return
    editar.mutate({ id: retornoModal.id, status: 'RETORNADA', observacao: retornoObs }, {
      onSuccess: () => { setRetornoModal(null); setRetornoObs(''); notifications.show({ title: 'Sucesso', message: 'Retorno registrado', color: 'green' }) },
      onError: () => notifications.show({ title: 'Erro', message: 'Falha ao registrar retorno', color: 'red' }),
    })
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Vendas / Consignadas</Text>
      <Text size="xl" fw={600} mb="lg">Vendas Consignadas</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />

        <Group justify="space-between" mb="md">
          <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Número</Table.Th>
              <Table.Th>Cliente</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Data Remessa</Table.Th>
              <Table.Th>Valor Total</Table.Th>
              <Table.Th style={{ width: 60 }}>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td fw={500}>{item.numero}</Table.Td>
                <Table.Td>{item.cliente}</Table.Td>
                <Table.Td>
                  <Badge color={statusColors[item.status] || 'gray'}>{item.status}</Badge>
                </Table.Td>
                <Table.Td>{formatDate(item.dataRemessa)}</Table.Td>
                <Table.Td>{formatCurrency(item.valorTotal)}</Table.Td>
                <Table.Td>
                  {item.status === 'EM_CONSIGNACAO' && (
                    <Tooltip label="Registrar Retorno">
                      <ActionIcon variant="subtle" color="teal" onClick={() => setRetornoModal(item)}>
                        <IconArrowBack size={18} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && items.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--mantine-color-dimmed)' }}>
                  Nenhuma venda consignada encontrada
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

      <Modal opened={!!retornoModal} onClose={() => { setRetornoModal(null); setRetornoObs('') }} title="Registrar Retorno" centered>
        <Text size="sm" mb="sm">Registrar retorno da consignação #{retornoModal?.numero}?</Text>
        <TextInput label="Observação" value={retornoObs} onChange={(e) => setRetornoObs(e.currentTarget.value)} mb="sm" />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => { setRetornoModal(null); setRetornoObs('') }}>Cancelar</Button>
          <Button color="teal" loading={editar.isPending} onClick={handleRetorno}>Confirmar Retorno</Button>
        </Group>
      </Modal>
    </div>
  )
}
