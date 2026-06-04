'use client'

import { useEffect, useState } from 'react'
import { Title, Stack, Tabs, Table, Group, Button, Badge, Loader, Center, Modal, TextInput, NumberInput, ActionIcon } from '@mantine/core'
import { IconPlus, IconEdit, IconPower } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

interface TipoConfig { endpoint: string; label: string; extraFields?: string[] }

const TIPOS: TipoConfig[] = [
  { endpoint: 'tipos-cartao', label: 'Cartão' },
  { endpoint: 'tipos-cor', label: 'Cores', extraFields: ['codigoPantone', 'hexadecimal'] },
  { endpoint: 'tipos-formato', label: 'Formato', extraFields: ['larguraMm', 'alturaMm'] },
  { endpoint: 'tipos-gramatura', label: 'Gramatura', extraFields: ['valorGm2'] },
  { endpoint: 'tipos-policromia', label: 'Policromia', extraFields: ['numeroCores'] },
  { endpoint: 'tipos-verniz', label: 'Verniz', extraFields: ['tipo'] },
]

function TipoCrud({ config }: { config: TipoConfig }) {
  const [data, setData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [form, setForm] = useState<any>({ codigo: '', descricao: '' })

  async function carregar() {
    setLoading(true)
    try { const res = await api.get(`/atributos-graficos/${config.endpoint}`, { params: { limit: 100 } }); setData(res.data.data || []) }
    catch {} finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [])

  function abrirNovo() { setEditando(null); setForm({ codigo: '', descricao: '' }); setModalAberto(true) }
  function abrirEdicao(item: any) { setEditando(item); setForm({ ...item }); setModalAberto(true) }

  async function salvar() {
    try {
      if (editando) { await api.put(`/atributos-graficos/${config.endpoint}/${editando.id}`, form) }
      else { await api.post(`/atributos-graficos/${config.endpoint}`, form) }
      notifications.show({ title: 'Salvo', message: '', color: 'green' })
      setModalAberto(false); carregar()
    } catch (err: any) { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) }
  }

  async function inativar(item: any) {
    try { await api.patch(`/atributos-graficos/${config.endpoint}/${item.id}/inativar`); carregar() } catch {}
  }

  return (
    <Stack gap="md">
      <Group justify="flex-end">
        <Button size="xs" leftSection={<IconPlus size={14} />} onClick={abrirNovo}>Novo</Button>
      </Group>

      {loading ? <Center py="md"><Loader size="sm" /></Center> : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Código</Table.Th>
              <Table.Th>Descrição</Table.Th>
              {config.extraFields?.map((f) => <Table.Th key={f}>{f}</Table.Th>)}
              <Table.Th>Status</Table.Th>
              <Table.Th></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.map((item) => (
              <Table.Tr key={item.id}>
                <Table.Td fw={600}>{item.codigo}</Table.Td>
                <Table.Td>{item.descricao}</Table.Td>
                {config.extraFields?.map((f) => <Table.Td key={f}>{item[f] ?? '—'}</Table.Td>)}
                <Table.Td><Badge color={item.status ? 'green' : 'red'} size="sm">{item.status ? 'Ativo' : 'Inativo'}</Badge></Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <ActionIcon variant="subtle" size="sm" onClick={() => abrirEdicao(item)}><IconEdit size={14} /></ActionIcon>
                    <ActionIcon variant="subtle" size="sm" color="red" onClick={() => inativar(item)}><IconPower size={14} /></ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={modalAberto} onClose={() => setModalAberto(false)} title={editando ? `Editar ${config.label}` : `Novo ${config.label}`} centered>
        <Stack gap="md">
          <TextInput label="Código" value={form.codigo || ''} onChange={(e) => setForm({ ...form, codigo: e.currentTarget.value })} required />
          <TextInput label="Descrição" value={form.descricao || ''} onChange={(e) => setForm({ ...form, descricao: e.currentTarget.value })} required />
          {config.extraFields?.includes('codigoPantone') && <TextInput label="Código Pantone" value={form.codigoPantone || ''} onChange={(e) => setForm({ ...form, codigoPantone: e.currentTarget.value })} />}
          {config.extraFields?.includes('hexadecimal') && <TextInput label="Hexadecimal" placeholder="#FF0000" value={form.hexadecimal || ''} onChange={(e) => setForm({ ...form, hexadecimal: e.currentTarget.value })} />}
          {config.extraFields?.includes('larguraMm') && <NumberInput label="Largura (mm)" value={form.larguraMm || ''} onChange={(v) => setForm({ ...form, larguraMm: v })} min={1} />}
          {config.extraFields?.includes('alturaMm') && <NumberInput label="Altura (mm)" value={form.alturaMm || ''} onChange={(v) => setForm({ ...form, alturaMm: v })} min={1} />}
          {config.extraFields?.includes('valorGm2') && <NumberInput label="Gramatura (g/m²)" value={form.valorGm2 || ''} onChange={(v) => setForm({ ...form, valorGm2: v })} min={1} />}
          {config.extraFields?.includes('numeroCores') && <NumberInput label="Número de Cores" value={form.numeroCores || ''} onChange={(v) => setForm({ ...form, numeroCores: v })} min={1} />}
          {config.extraFields?.includes('tipo') && <TextInput label="Tipo (UV, AQUOSO, OLEOSO, NENHUM)" value={form.tipo || ''} onChange={(e) => setForm({ ...form, tipo: e.currentTarget.value })} />}
          <Button onClick={salvar} fullWidth>{editando ? 'Salvar' : 'Criar'}</Button>
        </Stack>
      </Modal>
    </Stack>
  )
}

export default function AtributosGraficosPage() {
  useEffect(() => { document.title = 'PCP - Atributos Gráficos' }, [])

  return (
    <Stack gap="md">
      <Title order={3}>Atributos Gráficos</Title>

      <Tabs defaultValue="tipos-cartao">
        <Tabs.List>
          {TIPOS.map((t) => <Tabs.Tab key={t.endpoint} value={t.endpoint}>{t.label}</Tabs.Tab>)}
        </Tabs.List>

        {TIPOS.map((t) => (
          <Tabs.Panel key={t.endpoint} value={t.endpoint} pt="md">
            <TipoCrud config={t} />
          </Tabs.Panel>
        ))}
      </Tabs>
    </Stack>
  )
}
