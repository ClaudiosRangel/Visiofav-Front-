'use client'

import { useEffect, useState } from 'react'
import { Title, Stack, Table, Group, Button, Badge, Loader, Center, Modal, TextInput, NumberInput, MultiSelect, ActionIcon } from '@mantine/core'
import { IconPlus, IconEdit, IconPower } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

const DIAS = [
  { value: '0', label: 'Domingo' }, { value: '1', label: 'Segunda' }, { value: '2', label: 'Terça' },
  { value: '3', label: 'Quarta' }, { value: '4', label: 'Quinta' }, { value: '5', label: 'Sexta' }, { value: '6', label: 'Sábado' },
]

export default function TurnosProducaoPage() {
  useEffect(() => { document.title = 'PCP - Turnos' }, [])

  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [form, setForm] = useState({ codigo: '', descricao: '', horaInicio: '08:00', horaFim: '17:00', diasSemana: ['1', '2', '3', '4', '5'] })

  async function carregar() {
    setLoading(true)
    try { const res = await api.get('/turnos-producao', { params: { limit: 50 } }); setData(res.data.data || []) }
    catch {} finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [])

  function abrirNovo() { setEditando(null); setForm({ codigo: '', descricao: '', horaInicio: '08:00', horaFim: '17:00', diasSemana: ['1', '2', '3', '4', '5'] }); setModalAberto(true) }
  function abrirEdicao(item: any) { setEditando(item); setForm({ codigo: item.codigo, descricao: item.descricao, horaInicio: item.horaInicio, horaFim: item.horaFim, diasSemana: (item.diasSemana || []).map(String) }); setModalAberto(true) }

  async function salvar() {
    try {
      const body = { ...form, diasSemana: form.diasSemana.map(Number) }
      if (editando) { await api.put(`/turnos-producao/${editando.id}`, body) }
      else { await api.post('/turnos-producao', body) }
      notifications.show({ title: 'Salvo', message: '', color: 'green' })
      setModalAberto(false); carregar()
    } catch (err: any) { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) }
  }

  async function inativar(item: any) {
    try { await api.patch(`/turnos-producao/${item.id}/inativar`); carregar() } catch {}
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={3}>Turnos de Produção</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>Novo Turno</Button>
      </Group>

      {loading ? <Center py="xl"><Loader /></Center> : (
        <Table striped highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th>Código</Table.Th><Table.Th>Descrição</Table.Th><Table.Th>Início</Table.Th><Table.Th>Fim</Table.Th><Table.Th>Duração</Table.Th><Table.Th>Dias</Table.Th><Table.Th>Status</Table.Th><Table.Th></Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>
            {data.map((item) => (
              <Table.Tr key={item.id}>
                <Table.Td fw={600}>{item.codigo}</Table.Td>
                <Table.Td>{item.descricao}</Table.Td>
                <Table.Td>{item.horaInicio}</Table.Td>
                <Table.Td>{item.horaFim}</Table.Td>
                <Table.Td>{item.duracaoMinutos} min</Table.Td>
                <Table.Td>{(item.diasSemana || []).map((d: number) => DIAS[d]?.label?.substring(0, 3)).join(', ')}</Table.Td>
                <Table.Td><Badge color={item.status ? 'green' : 'red'}>{item.status ? 'Ativo' : 'Inativo'}</Badge></Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <ActionIcon variant="subtle" onClick={() => abrirEdicao(item)}><IconEdit size={16} /></ActionIcon>
                    <ActionIcon variant="subtle" color="red" onClick={() => inativar(item)}><IconPower size={16} /></ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={modalAberto} onClose={() => setModalAberto(false)} title={editando ? 'Editar Turno' : 'Novo Turno'} centered>
        <Stack gap="md">
          <TextInput label="Código" placeholder="T1" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.currentTarget.value })} required />
          <TextInput label="Descrição" placeholder="Turno Manhã" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.currentTarget.value })} required />
          <Group grow>
            <TextInput label="Hora Início" placeholder="08:00" value={form.horaInicio} onChange={(e) => setForm({ ...form, horaInicio: e.currentTarget.value })} />
            <TextInput label="Hora Fim" placeholder="17:00" value={form.horaFim} onChange={(e) => setForm({ ...form, horaFim: e.currentTarget.value })} />
          </Group>
          <MultiSelect label="Dias da Semana" data={DIAS} value={form.diasSemana} onChange={(v) => setForm({ ...form, diasSemana: v })} />
          <Button onClick={salvar} fullWidth>{editando ? 'Salvar' : 'Criar'}</Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
