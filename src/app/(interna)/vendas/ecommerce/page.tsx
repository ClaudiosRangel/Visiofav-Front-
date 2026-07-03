'use client'

import { useState, useEffect } from 'react'
import {
  Button, Card, Group, Text, Table, Badge, ActionIcon, Tooltip,
  LoadingOverlay, Pagination, Modal, TextInput,
} from '@mantine/core'
import { IconPlus, IconRefresh, IconEdit, IconPlayerPlay, IconPlayerPause } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import {
  useIntegracoesEcommerce, usePedidosEcommerce,
  useCriarIntegracaoEcommerce, useEditarIntegracaoEcommerce,
} from '@/data/hooks/vendas/useIntegracaoEcommerce'

const statusColors: Record<string, string> = {
  IMPORTADO: 'blue',
  PROCESSADO: 'green',
  ERRO: 'red',
  PENDENTE: 'orange',
}

export default function EcommercePage() {
  useModuloGuard('VENDAS')
  useEffect(() => { document.title = 'Vizor - Vendas - Integração E-commerce' }, [])

  const [pageInt, setPageInt] = useState(1)
  const [pagePed, setPagePed] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState({ plataforma: '', storeId: '' })

  const { data: intResp, isLoading: loadingInt, refetch: refetchInt } = useIntegracoesEcommerce({ page: pageInt, limit: 20 })
  const { data: pedResp, isLoading: loadingPed, refetch: refetchPed } = usePedidosEcommerce({ page: pagePed, limit: 20 })
  const criar = useCriarIntegracaoEcommerce()
  const editar = useEditarIntegracaoEcommerce()

  const integracoes = intResp?.data || []
  const totalInt = Math.ceil((intResp?.total || 0) / 20)
  const pedidos = pedResp?.data || []
  const totalPed = Math.ceil((pedResp?.total || 0) / 20)

  function openCreate() {
    setEditItem(null)
    setForm({ plataforma: '', storeId: '' })
    setModalOpen(true)
  }

  function openEdit(item: any) {
    setEditItem(item)
    setForm({ plataforma: item.plataforma, storeId: item.storeId })
    setModalOpen(true)
  }

  function handleSave() {
    if (editItem) {
      editar.mutate({ id: editItem.id, ...form }, {
        onSuccess: () => { setModalOpen(false); notifications.show({ title: 'Sucesso', message: 'Integração atualizada', color: 'green' }) },
        onError: () => notifications.show({ title: 'Erro', message: 'Falha ao salvar', color: 'red' }),
      })
    } else {
      criar.mutate(form, {
        onSuccess: () => { setModalOpen(false); notifications.show({ title: 'Sucesso', message: 'Integração criada', color: 'green' }) },
        onError: () => notifications.show({ title: 'Erro', message: 'Falha ao criar', color: 'red' }),
      })
    }
  }

  function toggleAtivo(item: any) {
    editar.mutate({ id: item.id, ativo: !item.ativo }, {
      onSuccess: () => notifications.show({ title: 'Sucesso', message: item.ativo ? 'Integração desativada' : 'Integração ativada', color: 'green' }),
    })
  }

  function formatDate(d?: string) {
    return d ? new Date(d).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
  }

  function formatCurrency(v: number) {
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Vendas / E-commerce</Text>
      <Text size="xl" fw={600} mb="lg">Integração E-commerce</Text>

      {/* Integrações */}
      <Card pos="relative" mb="lg">
        <LoadingOverlay visible={loadingInt} />
        <Group justify="space-between" mb="md">
          <Text size="lg" fw={500}>Integrações</Text>
          <Group>
            <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetchInt()}>Atualizar</Button>
            <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>Nova Integração</Button>
          </Group>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Plataforma</Table.Th>
              <Table.Th>Store ID</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Última Sincronização</Table.Th>
              <Table.Th style={{ width: 100 }}>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {integracoes.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td fw={500}>{item.plataforma}</Table.Td>
                <Table.Td>{item.storeId}</Table.Td>
                <Table.Td>
                  <Badge color={item.ativo ? 'green' : 'gray'}>{item.ativo ? 'Ativo' : 'Inativo'}</Badge>
                </Table.Td>
                <Table.Td>{formatDate(item.ultimaSync)}</Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <Tooltip label="Editar">
                      <ActionIcon variant="subtle" color="blue" onClick={() => openEdit(item)}>
                        <IconEdit size={18} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label={item.ativo ? 'Desativar' : 'Ativar'}>
                      <ActionIcon variant="subtle" color={item.ativo ? 'orange' : 'green'} onClick={() => toggleAtivo(item)}>
                        {item.ativo ? <IconPlayerPause size={18} /> : <IconPlayerPlay size={18} />}
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {!loadingInt && integracoes.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--mantine-color-dimmed)' }}>
                  Nenhuma integração encontrada
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>

        {totalInt > 1 && (
          <Group justify="center" mt="md">
            <Pagination total={totalInt} value={pageInt} onChange={setPageInt} />
          </Group>
        )}
      </Card>

      {/* Pedidos Importados */}
      <Card pos="relative">
        <LoadingOverlay visible={loadingPed} />
        <Group justify="space-between" mb="md">
          <Text size="lg" fw={500}>Pedidos Importados</Text>
          <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetchPed()}>Atualizar</Button>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Pedido Externo</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Valor Total</Table.Th>
              <Table.Th>Data Importação</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {pedidos.map((ped: any) => (
              <Table.Tr key={ped.id}>
                <Table.Td fw={500}>{ped.pedidoExterno}</Table.Td>
                <Table.Td>
                  <Badge color={statusColors[ped.status] || 'gray'}>{ped.status}</Badge>
                </Table.Td>
                <Table.Td>{formatCurrency(ped.valorTotal)}</Table.Td>
                <Table.Td>{formatDate(ped.criadoEm)}</Table.Td>
              </Table.Tr>
            ))}
            {!loadingPed && pedidos.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--mantine-color-dimmed)' }}>
                  Nenhum pedido importado
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>

        {totalPed > 1 && (
          <Group justify="center" mt="md">
            <Pagination total={totalPed} value={pagePed} onChange={setPagePed} />
          </Group>
        )}
      </Card>

      {/* Modal */}
      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Editar Integração' : 'Nova Integração'} centered>
        <TextInput label="Plataforma" value={form.plataforma} onChange={(e) => setForm({ ...form, plataforma: e.currentTarget.value })} mb="sm" />
        <TextInput label="Store ID" value={form.storeId} onChange={(e) => setForm({ ...form, storeId: e.currentTarget.value })} mb="sm" />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button loading={criar.isPending || editar.isPending} onClick={handleSave}>Salvar</Button>
        </Group>
      </Modal>
    </div>
  )
}
