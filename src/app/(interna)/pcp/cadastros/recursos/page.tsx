'use client'

import { useEffect, useState } from 'react'
import { Title, Stack, Table, Group, Button, Badge, Text, Loader, Center, Modal, TextInput, Select, NumberInput, ActionIcon } from '@mantine/core'
import { IconPlus, IconEdit, IconPower } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

export default function RecursosProducaoPage() {
  useEffect(() => { document.title = 'PCP - Recursos' }, [])

  const [data, setData] = useState<any[]>([])
  const [centros, setCentros] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [form, setForm] = useState({ codigo: '', descricao: '', tipo: 'FERRAMENTA', centroProducaoId: null as string | null, custoHora: 0 })

  async function carregar() {
    setLoading(true)
    try {
      const [res, centrosRes] = await Promise.all([
        api.get('/recursos-producao', { params: { limit: 100 } }),
        api.get('/centros-producao', { params: { limit: 100, status: 'true' } }),
      ])
      setData(res.data.data || [])
      setCentros((centrosRes.data.data || []).map((c: any) => ({ value: c.id, label: `${c.codigo} - ${c.descricao}` })))
    } catch {} finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [])

  function abrirNovo() { setEditando(null); setForm({ codigo: '', descricao: '', tipo: 'FERRAMENTA', centroProducaoId: null, custoHora: 0 }); setModalAberto(true) }
  function abrirEdicao(item: any) { setEditando(item); setForm({ codigo: item.codigo, descricao: item.descricao, tipo: item.tipo, centroProducaoId: item.centroProducaoId, custoHora: Number(item.custoHora) || 0 }); setModalAberto(true) }

  async function salvar() {
    try {
      if (editando) { await api.put(`/recursos-producao/${editando.id}`, form) }
      else { await api.post('/recursos-producao', form) }
      notifications.show({ title: 'Salvo', message: '', color: 'green' })
      setModalAberto(false); carregar()
    } catch (err: any) { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) }
  }

  async function inativar(item: any) {
    try { await api.patch(`/recursos-producao/${item.id}/inativar`); carregar() } catch {}
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={3}>Recursos de Produção</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>Novo Recurso</Button>
      </Group>

      {loading ? <Center py="xl"><Loader /></Center> : (
        <Table striped highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th>Código</Table.Th><Table.Th>Descrição</Table.Th><Table.Th>Tipo</Table.Th><Table.Th>Centro</Table.Th><Table.Th>Custo/Hora</Table.Th><Table.Th>Status</Table.Th><Table.Th></Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>
            {data.map((item) => (
              <Table.Tr key={item.id}>
                <Table.Td fw={600}>{item.codigo}</Table.Td>
                <Table.Td>{item.descricao}</Table.Td>
                <Table.Td><Badge variant="light">{item.tipo}</Badge></Table.Td>
                <Table.Td>{item.centroProducao?.descricao || '—'}</Table.Td>
                <Table.Td>{Number(item.custoHora) ? `R$ ${Number(item.custoHora)}` : '—'}</Table.Td>
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

      <Modal opened={modalAberto} onClose={() => setModalAberto(false)} title={editando ? 'Editar Recurso' : 'Novo Recurso'} centered>
        <Stack gap="md">
          <TextInput label="Código" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.currentTarget.value })} required />
          <TextInput label="Descrição" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.currentTarget.value })} required />
          <Select label="Tipo" data={['OPERADOR', 'FERRAMENTA', 'MOLDE', 'FACA', 'OUTRO']} value={form.tipo} onChange={(v) => setForm({ ...form, tipo: v || 'FERRAMENTA' })} />
          <Select label="Centro de Produção (opcional)" data={centros} value={form.centroProducaoId} onChange={(v) => setForm({ ...form, centroProducaoId: v })} clearable searchable />
          <NumberInput label="Custo/Hora (R$)" value={form.custoHora} onChange={(v) => setForm({ ...form, custoHora: typeof v === 'number' ? v : 0 })} min={0} decimalScale={2} />
          <Button onClick={salvar} fullWidth>{editando ? 'Salvar' : 'Criar'}</Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
