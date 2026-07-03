'use client'

import { useState, useEffect } from 'react'
import {
  Button, Card, Group, Text, Table, Progress, ActionIcon, Tooltip,
  LoadingOverlay, Pagination, Modal, TextInput, NumberInput,
} from '@mantine/core'
import { IconPlus, IconRefresh, IconEdit } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import {
  useMetasVendedor, useCriarMetaVendedor, useEditarMetaVendedor,
} from '@/data/hooks/vendas/useMetaVendedor'

export default function MetasPage() {
  useModuloGuard('VENDAS')
  useEffect(() => { document.title = 'Vizor - Vendas - Metas Vendedores' }, [])

  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState({ vendedorId: '', periodo: '', metaValor: 0 })

  const { data: response, isLoading, refetch } = useMetasVendedor({ page, limit: 20 })
  const criar = useCriarMetaVendedor()
  const editar = useEditarMetaVendedor()

  const items = response?.data || []
  const total = response?.total || 0
  const totalPages = Math.ceil(total / 20)

  function formatCurrency(v: number) {
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  function openCreate() {
    setEditItem(null)
    setForm({ vendedorId: '', periodo: '', metaValor: 0 })
    setModalOpen(true)
  }

  function openEdit(item: any) {
    setEditItem(item)
    setForm({ vendedorId: item.vendedor?.id || '', periodo: item.periodo, metaValor: item.metaValor })
    setModalOpen(true)
  }

  function handleSave() {
    const body = { ...form, metaValor: Number(form.metaValor) }
    if (editItem) {
      editar.mutate({ id: editItem.id, ...body }, {
        onSuccess: () => { setModalOpen(false); notifications.show({ title: 'Sucesso', message: 'Meta atualizada', color: 'green' }) },
        onError: () => notifications.show({ title: 'Erro', message: 'Falha ao salvar', color: 'red' }),
      })
    } else {
      criar.mutate(body, {
        onSuccess: () => { setModalOpen(false); notifications.show({ title: 'Sucesso', message: 'Meta criada', color: 'green' }) },
        onError: () => notifications.show({ title: 'Erro', message: 'Falha ao criar', color: 'red' }),
      })
    }
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Vendas / Metas</Text>
      <Text size="xl" fw={600} mb="lg">Força de Vendas — Metas</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />

        <Group justify="space-between" mb="md">
          <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>Nova Meta</Button>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Vendedor</Table.Th>
              <Table.Th>Período</Table.Th>
              <Table.Th>Meta</Table.Th>
              <Table.Th>Realizado</Table.Th>
              <Table.Th style={{ width: 200 }}>Progresso</Table.Th>
              <Table.Th>% Atingimento</Table.Th>
              <Table.Th style={{ width: 60 }}>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any) => {
              const pct = item.metaValor > 0 ? Math.min((item.realizadoValor / item.metaValor) * 100, 100) : 0
              return (
                <Table.Tr key={item.id}>
                  <Table.Td fw={500}>{item.vendedor?.nome || '—'}</Table.Td>
                  <Table.Td>{item.periodo}</Table.Td>
                  <Table.Td>{formatCurrency(item.metaValor)}</Table.Td>
                  <Table.Td>{formatCurrency(item.realizadoValor)}</Table.Td>
                  <Table.Td>
                    <Progress value={pct} color={pct >= 100 ? 'green' : pct >= 70 ? 'blue' : 'orange'} size="lg" />
                  </Table.Td>
                  <Table.Td fw={500}>{pct.toFixed(1)}%</Table.Td>
                  <Table.Td>
                    <Tooltip label="Editar">
                      <ActionIcon variant="subtle" color="blue" onClick={() => openEdit(item)}>
                        <IconEdit size={18} />
                      </ActionIcon>
                    </Tooltip>
                  </Table.Td>
                </Table.Tr>
              )
            })}
            {!isLoading && items.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--mantine-color-dimmed)' }}>
                  Nenhuma meta encontrada
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

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Editar Meta' : 'Nova Meta'} centered>
        <TextInput label="ID Vendedor" value={form.vendedorId} onChange={(e) => setForm({ ...form, vendedorId: e.currentTarget.value })} mb="sm" />
        <TextInput label="Período (ex: 2025-01)" value={form.periodo} onChange={(e) => setForm({ ...form, periodo: e.currentTarget.value })} mb="sm" />
        <NumberInput label="Meta (R$)" value={form.metaValor} onChange={(v) => setForm({ ...form, metaValor: Number(v) || 0 })} mb="sm" />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button loading={criar.isPending || editar.isPending} onClick={handleSave}>Salvar</Button>
        </Group>
      </Modal>
    </div>
  )
}
