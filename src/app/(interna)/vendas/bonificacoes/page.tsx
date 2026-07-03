'use client'

import { useState, useEffect } from 'react'
import {
  Button, Card, Group, Text, Table, Badge, ActionIcon, Tooltip,
  LoadingOverlay, Pagination, Modal, TextInput, NumberInput,
} from '@mantine/core'
import { IconPlus, IconRefresh, IconEdit, IconPlayerPlay, IconPlayerPause } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import {
  useBonificacoes, useCriarBonificacao, useEditarBonificacao,
} from '@/data/hooks/vendas/useBonificacao'

export default function BonificacoesPage() {
  useModuloGuard('VENDAS')
  useEffect(() => { document.title = 'Vizor - Vendas - Bonificações' }, [])

  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState({ nome: '', produtoGatilho: '', qtdMinima: 1, produtoBonus: '', qtdBonus: 1 })

  const { data: response, isLoading, refetch } = useBonificacoes({ page, limit: 20 })
  const criar = useCriarBonificacao()
  const editar = useEditarBonificacao()

  const items = response?.data || []
  const total = response?.total || 0
  const totalPages = Math.ceil(total / 20)

  function openCreate() {
    setEditItem(null)
    setForm({ nome: '', produtoGatilho: '', qtdMinima: 1, produtoBonus: '', qtdBonus: 1 })
    setModalOpen(true)
  }

  function openEdit(item: any) {
    setEditItem(item)
    setForm({
      nome: item.nome,
      produtoGatilho: item.produtoGatilho,
      qtdMinima: item.qtdMinima,
      produtoBonus: item.produtoBonus,
      qtdBonus: item.qtdBonus,
    })
    setModalOpen(true)
  }

  function handleSave() {
    const body = { ...form, qtdMinima: Number(form.qtdMinima), qtdBonus: Number(form.qtdBonus) }
    if (editItem) {
      editar.mutate({ id: editItem.id, ...body }, {
        onSuccess: () => { setModalOpen(false); notifications.show({ title: 'Sucesso', message: 'Bonificação atualizada', color: 'green' }) },
        onError: () => notifications.show({ title: 'Erro', message: 'Falha ao salvar', color: 'red' }),
      })
    } else {
      criar.mutate(body, {
        onSuccess: () => { setModalOpen(false); notifications.show({ title: 'Sucesso', message: 'Bonificação criada', color: 'green' }) },
        onError: () => notifications.show({ title: 'Erro', message: 'Falha ao criar', color: 'red' }),
      })
    }
  }

  function toggleAtivo(item: any) {
    editar.mutate({ id: item.id, ativo: !item.ativo }, {
      onSuccess: () => notifications.show({ title: 'Sucesso', message: item.ativo ? 'Bonificação inativada' : 'Bonificação ativada', color: 'green' }),
    })
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Vendas / Bonificações</Text>
      <Text size="xl" fw={600} mb="lg">Bonificações</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />

        <Group justify="space-between" mb="md">
          <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>Nova Bonificação</Button>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nome</Table.Th>
              <Table.Th>Produto Gatilho</Table.Th>
              <Table.Th>Qtd Mínima</Table.Th>
              <Table.Th>Produto Bônus</Table.Th>
              <Table.Th>Qtd Bônus</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th style={{ width: 100 }}>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td fw={500}>{item.nome}</Table.Td>
                <Table.Td>{item.produtoGatilho}</Table.Td>
                <Table.Td>{item.qtdMinima}</Table.Td>
                <Table.Td>{item.produtoBonus}</Table.Td>
                <Table.Td>{item.qtdBonus}</Table.Td>
                <Table.Td>
                  <Badge color={item.ativo ? 'green' : 'gray'}>{item.ativo ? 'Ativo' : 'Inativo'}</Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <Tooltip label="Editar">
                      <ActionIcon variant="subtle" color="blue" onClick={() => openEdit(item)}>
                        <IconEdit size={18} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label={item.ativo ? 'Inativar' : 'Ativar'}>
                      <ActionIcon variant="subtle" color={item.ativo ? 'orange' : 'green'} onClick={() => toggleAtivo(item)}>
                        {item.ativo ? <IconPlayerPause size={18} /> : <IconPlayerPlay size={18} />}
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && items.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--mantine-color-dimmed)' }}>
                  Nenhuma bonificação encontrada
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

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Editar Bonificação' : 'Nova Bonificação'} centered>
        <TextInput label="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.currentTarget.value })} mb="sm" />
        <TextInput label="Produto Gatilho" value={form.produtoGatilho} onChange={(e) => setForm({ ...form, produtoGatilho: e.currentTarget.value })} mb="sm" />
        <NumberInput label="Qtd Mínima" value={form.qtdMinima} onChange={(v) => setForm({ ...form, qtdMinima: Number(v) || 1 })} min={1} mb="sm" />
        <TextInput label="Produto Bônus" value={form.produtoBonus} onChange={(e) => setForm({ ...form, produtoBonus: e.currentTarget.value })} mb="sm" />
        <NumberInput label="Qtd Bônus" value={form.qtdBonus} onChange={(v) => setForm({ ...form, qtdBonus: Number(v) || 1 })} min={1} mb="sm" />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button loading={criar.isPending || editar.isPending} onClick={handleSave}>Salvar</Button>
        </Group>
      </Modal>
    </div>
  )
}
