'use client'

import { useEffect, useState, useCallback } from 'react'
import { Title, Stack, Group, Button, Table, Loader, Center, Text, Modal, TextInput, Switch, ActionIcon, Badge } from '@mantine/core'
import { IconPlus, IconPencil, IconTrash } from '@tabler/icons-react'
import { api } from '@/lib/api'

interface CodigoParada { id: string; codigo: string; descricao: string; status: boolean }

export default function CodigosParadaPage() {
  useEffect(() => { document.title = 'PCP - Códigos de Parada' }, [])
  const [itens, setItens] = useState<CodigoParada[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState({ codigo: '', descricao: '', status: true })

  const carregar = useCallback(() => {
    setLoading(true)
    api.get('/pcp/gerencial/codigos-parada').then(({ data }) => setItens(data)).catch(() => setItens([])).finally(() => setLoading(false))
  }, [])
  useEffect(() => { carregar() }, [carregar])

  function abrirNovo() { setEditId(null); setForm({ codigo: '', descricao: '', status: true }); setModal(true) }
  function abrirEdicao(c: CodigoParada) { setEditId(c.id); setForm({ codigo: c.codigo, descricao: c.descricao, status: c.status }); setModal(true) }

  async function salvar() {
    if (editId) await api.put(`/pcp/gerencial/codigos-parada/${editId}`, form)
    else await api.post('/pcp/gerencial/codigos-parada', form)
    setModal(false); setEditId(null); carregar()
  }
  async function remover(id: string) { await api.delete(`/pcp/gerencial/codigos-parada/${id}`); carregar() }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={3}>Códigos de Parada</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>Novo Código</Button>
      </Group>
      <Text c="dimmed" size="sm">Códigos usados no Pareto de paradas do Relatório Mensal (ex.: 1 = Troca de chapa/Setup).</Text>

      {loading ? <Center py="xl"><Loader /></Center> : itens.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">Nenhum código cadastrado.</Text>
      ) : (
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead><Table.Tr><Table.Th>Código</Table.Th><Table.Th>Descrição</Table.Th><Table.Th>Status</Table.Th><Table.Th /></Table.Tr></Table.Thead>
          <Table.Tbody>
            {itens.map((c) => (
              <Table.Tr key={c.id}>
                <Table.Td fw={600}>{c.codigo}</Table.Td>
                <Table.Td>{c.descricao}</Table.Td>
                <Table.Td><Badge color={c.status ? 'green' : 'gray'} variant="light">{c.status ? 'Ativo' : 'Inativo'}</Badge></Table.Td>
                <Table.Td>
                  <Group gap={4} justify="flex-end">
                    <ActionIcon variant="subtle" onClick={() => abrirEdicao(c)}><IconPencil size={16} /></ActionIcon>
                    <ActionIcon variant="subtle" color="red" onClick={() => remover(c.id)}><IconTrash size={16} /></ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={modal} onClose={() => setModal(false)} title={editId ? 'Editar Código' : 'Novo Código'}>
        <Stack>
          <TextInput label="Código" required value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.currentTarget.value })} placeholder="1" />
          <TextInput label="Descrição" required value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.currentTarget.value })} placeholder="Troca de chapa / Setup" />
          <Switch label="Ativo" checked={form.status} onChange={(e) => setForm({ ...form, status: e.currentTarget.checked })} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setModal(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={!form.codigo || !form.descricao}>Salvar</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
