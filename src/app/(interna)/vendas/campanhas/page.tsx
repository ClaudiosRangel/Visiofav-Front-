'use client'

import { useState, useEffect } from 'react'
import {
  Button, Card, Group, Text, Table, Badge, ActionIcon, Tooltip,
  LoadingOverlay, Pagination, Modal, TextInput, Select, NumberInput,
} from '@mantine/core'
import { IconPlus, IconRefresh, IconEdit, IconPlayerPlay, IconPlayerPause } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import {
  useCampanhasDesconto, useCriarCampanhaDesconto, useEditarCampanhaDesconto,
} from '@/data/hooks/vendas/useCampanhaDesconto'

export default function CampanhasPage() {
  useModuloGuard('VENDAS')
  useEffect(() => { document.title = 'Vizor - Vendas - Campanhas de Desconto' }, [])

  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState({ nome: '', tipo: 'PERCENTUAL', valor: 0, codigoCupom: '', dataInicio: '', dataFim: '' })

  const { data: response, isLoading, refetch } = useCampanhasDesconto({ page, limit: 20 })
  const criar = useCriarCampanhaDesconto()
  const editar = useEditarCampanhaDesconto()

  const items = response?.data || []
  const total = response?.total || 0
  const totalPages = Math.ceil(total / 20)

  function openCreate() {
    setEditItem(null)
    setForm({ nome: '', tipo: 'PERCENTUAL', valor: 0, codigoCupom: '', dataInicio: '', dataFim: '' })
    setModalOpen(true)
  }

  function openEdit(item: any) {
    setEditItem(item)
    setForm({
      nome: item.nome,
      tipo: item.tipo,
      valor: item.valor,
      codigoCupom: item.codigoCupom || '',
      dataInicio: item.dataInicio?.slice(0, 10) || '',
      dataFim: item.dataFim?.slice(0, 10) || '',
    })
    setModalOpen(true)
  }

  function handleSave() {
    const body = { ...form, valor: Number(form.valor) }
    if (editItem) {
      editar.mutate({ id: editItem.id, ...body }, {
        onSuccess: () => { setModalOpen(false); notifications.show({ title: 'Sucesso', message: 'Campanha atualizada', color: 'green' }) },
        onError: () => notifications.show({ title: 'Erro', message: 'Falha ao salvar', color: 'red' }),
      })
    } else {
      criar.mutate(body, {
        onSuccess: () => { setModalOpen(false); notifications.show({ title: 'Sucesso', message: 'Campanha criada', color: 'green' }) },
        onError: () => notifications.show({ title: 'Erro', message: 'Falha ao criar', color: 'red' }),
      })
    }
  }

  function toggleAtivo(item: any) {
    editar.mutate({ id: item.id, ativo: !item.ativo }, {
      onSuccess: () => notifications.show({ title: 'Sucesso', message: item.ativo ? 'Campanha inativada' : 'Campanha ativada', color: 'green' }),
    })
  }

  function formatDate(d: string) {
    return d ? new Date(d).toLocaleDateString('pt-BR') : '—'
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Vendas / Campanhas</Text>
      <Text size="xl" fw={600} mb="lg">Campanhas de Desconto</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />

        <Group justify="space-between" mb="md">
          <Group>
            <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
          </Group>
          <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>Nova Campanha</Button>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nome</Table.Th>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Valor</Table.Th>
              <Table.Th>Cupom</Table.Th>
              <Table.Th>Início</Table.Th>
              <Table.Th>Fim</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th style={{ width: 100 }}>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td fw={500}>{item.nome}</Table.Td>
                <Table.Td>{item.tipo}</Table.Td>
                <Table.Td>{item.tipo === 'PERCENTUAL' ? `${item.valor}%` : item.valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
                <Table.Td>{item.codigoCupom || '—'}</Table.Td>
                <Table.Td>{formatDate(item.dataInicio)}</Table.Td>
                <Table.Td>{formatDate(item.dataFim)}</Table.Td>
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
                <Table.Td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--mantine-color-dimmed)' }}>
                  Nenhuma campanha encontrada
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

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Editar Campanha' : 'Nova Campanha'} centered>
        <TextInput label="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.currentTarget.value })} mb="sm" />
        <Select label="Tipo" data={[{ value: 'PERCENTUAL', label: 'Percentual' }, { value: 'VALOR_FIXO', label: 'Valor Fixo' }]} value={form.tipo} onChange={(v) => setForm({ ...form, tipo: v || 'PERCENTUAL' })} mb="sm" />
        <NumberInput label="Valor" value={form.valor} onChange={(v) => setForm({ ...form, valor: Number(v) || 0 })} mb="sm" />
        <TextInput label="Código Cupom" value={form.codigoCupom} onChange={(e) => setForm({ ...form, codigoCupom: e.currentTarget.value })} mb="sm" />
        <TextInput label="Data Início" type="date" value={form.dataInicio} onChange={(e) => setForm({ ...form, dataInicio: e.currentTarget.value })} mb="sm" />
        <TextInput label="Data Fim" type="date" value={form.dataFim} onChange={(e) => setForm({ ...form, dataFim: e.currentTarget.value })} mb="sm" />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button loading={criar.isPending || editar.isPending} onClick={handleSave}>Salvar</Button>
        </Group>
      </Modal>
    </div>
  )
}
