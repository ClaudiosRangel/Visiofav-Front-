'use client'

import { useEffect, useState } from 'react'
import { Title, Stack, Table, Group, Button, Badge, Text, Loader, Center, Modal, TextInput, Select, NumberInput, ActionIcon } from '@mantine/core'
import { IconPlus, IconEdit, IconPower } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

export default function CentrosProducaoPage() {
  useEffect(() => { document.title = 'PCP - Centros de Produção' }, [])

  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [form, setForm] = useState({ codigo: '', descricao: '', tipo: 'MAQUINA', tipoMaquina: null as string | null, capacidadeHora: 0, custoHora: 0 })

  async function carregar() {
    setLoading(true)
    try { const res = await api.get('/centros-producao', { params: { limit: 100 } }); setData(res.data.data || []) }
    catch {} finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [])

  function abrirNovo() { setEditando(null); setForm({ codigo: '', descricao: '', tipo: 'MAQUINA', tipoMaquina: null, capacidadeHora: 0, custoHora: 0 }); setModalAberto(true) }
  function abrirEdicao(item: any) { setEditando(item); setForm({ codigo: item.codigo, descricao: item.descricao, tipo: item.tipo, tipoMaquina: item.tipoMaquina || null, capacidadeHora: Number(item.capacidadeHora) || 0, custoHora: Number(item.custoHora) || 0 }); setModalAberto(true) }

  async function salvar() {
    try {
      const payload = {
        ...form,
        tipoMaquina: form.tipo === 'MAQUINA' ? form.tipoMaquina : null,
      }
      if (editando) { await api.put(`/centros-producao/${editando.id}`, payload) }
      else { await api.post('/centros-producao', payload) }
      notifications.show({ title: 'Salvo', message: '', color: 'green' })
      setModalAberto(false); carregar()
    } catch (err: any) { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) }
  }

  async function toggleStatus(item: any) {
    try {
      await api.patch(`/centros-producao/${item.id}/${item.status ? 'inativar' : 'ativar'}`)
      carregar()
    } catch {}
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={3}>Centros de Produção</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>Novo Centro</Button>
      </Group>

      {loading ? <Center py="xl"><Loader /></Center> : (
        <Table striped highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th>Código</Table.Th><Table.Th>Descrição</Table.Th><Table.Th>Tipo</Table.Th><Table.Th>Cap/Hora</Table.Th><Table.Th>Custo/Hora</Table.Th><Table.Th>Status</Table.Th><Table.Th></Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>
            {data.map((item) => (
              <Table.Tr key={item.id}>
                <Table.Td fw={600}>{item.codigo}</Table.Td>
                <Table.Td>{item.descricao}</Table.Td>
                <Table.Td><Badge variant="light">{item.tipo}</Badge></Table.Td>
                <Table.Td>{Number(item.capacidadeHora) || '—'}</Table.Td>
                <Table.Td>{Number(item.custoHora) ? `R$ ${Number(item.custoHora)}` : '—'}</Table.Td>
                <Table.Td><Badge color={item.status ? 'green' : 'red'}>{item.status ? 'Ativo' : 'Inativo'}</Badge></Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <ActionIcon variant="subtle" onClick={() => abrirEdicao(item)}><IconEdit size={16} /></ActionIcon>
                    <ActionIcon variant="subtle" color={item.status ? 'red' : 'green'} onClick={() => toggleStatus(item)}><IconPower size={16} /></ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={modalAberto} onClose={() => setModalAberto(false)} title={editando ? 'Editar Centro' : 'Novo Centro'} centered>
        <Stack gap="md">
          <TextInput label="Código" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.currentTarget.value })} required />
          <TextInput label="Descrição" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.currentTarget.value })} required />
          <Select label="Tipo" data={['MAQUINA', 'SETOR', 'LINHA']} value={form.tipo} onChange={(v) => setForm({ ...form, tipo: v || 'MAQUINA', tipoMaquina: v === 'MAQUINA' ? form.tipoMaquina : null })} />
          {form.tipo === 'MAQUINA' && (
            <Select
              label="Tipo de Máquina"
              placeholder="Selecione o tipo"
              data={[
                { value: 'IMPRESSAO', label: 'Impressão' },
                { value: 'ACABAMENTO', label: 'Acabamento' },
                { value: 'CORTADEIRA', label: 'Cortadeira' },
                { value: 'COLAGEM', label: 'Colagem' },
                { value: 'VERNIZ', label: 'Verniz' },
              ]}
              value={form.tipoMaquina}
              onChange={(v) => setForm({ ...form, tipoMaquina: v })}
              clearable
            />
          )}
          <Group grow>
            <NumberInput label="Capacidade/Hora" value={form.capacidadeHora} onChange={(v) => setForm({ ...form, capacidadeHora: typeof v === 'number' ? v : 0 })} min={0} />
            <NumberInput label="Custo/Hora (R$)" value={form.custoHora} onChange={(v) => setForm({ ...form, custoHora: typeof v === 'number' ? v : 0 })} min={0} decimalScale={2} />
          </Group>
          <Button onClick={salvar} fullWidth>{editando ? 'Salvar' : 'Criar'}</Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
