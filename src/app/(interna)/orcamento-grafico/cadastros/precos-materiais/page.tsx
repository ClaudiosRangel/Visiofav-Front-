'use client'

import { useEffect, useState } from 'react'
import {
  Title, Stack, Table, Group, Button, Badge, Text, Loader, Center,
  Modal, TextInput, Select, NumberInput, ActionIcon, ScrollArea,
} from '@mantine/core'
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

// ============================================================================
// Tipos
// ============================================================================

interface PrecoMaterial {
  id: string
  descricao: string
  tipo: string
  unidade: string
  precoUnitario: number
  dataVigencia: string
  status: boolean
}

interface FormData {
  descricao: string
  tipo: string
  unidade: string
  precoUnitario: number
  dataVigencia: string
}

const FORM_INICIAL: FormData = {
  descricao: '',
  tipo: 'PAPEL',
  unidade: 'KG',
  precoUnitario: 0,
  dataVigencia: new Date().toISOString().slice(0, 10),
}

const TIPOS_MATERIAL = [
  { value: 'PAPEL', label: 'Papel' },
  { value: 'TINTA', label: 'Tinta' },
  { value: 'VERNIZ', label: 'Verniz' },
  { value: 'COLA', label: 'Cola' },
  { value: 'FACA', label: 'Faca' },
  { value: 'BOPP', label: 'BOPP' },
  { value: 'OUTRO', label: 'Outro' },
]

const UNIDADES = [
  { value: 'KG', label: 'KG' },
  { value: 'M2', label: 'M²' },
  { value: 'UN', label: 'UN' },
  { value: 'LT', label: 'LT' },
]

// ============================================================================
// Página Principal
// ============================================================================

export default function PrecosMaterialPage() {
  useEffect(() => { document.title = 'Orçamento Gráfico - Preços de Materiais' }, [])

  const [data, setData] = useState<PrecoMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroTipo, setFiltroTipo] = useState<string | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<PrecoMaterial | null>(null)
  const [form, setForm] = useState<FormData>(FORM_INICIAL)
  const [salvando, setSalvando] = useState(false)
  // Inline edit
  const [editandoPrecoId, setEditandoPrecoId] = useState<string | null>(null)
  const [editandoPrecoValor, setEditandoPrecoValor] = useState<number>(0)

  async function carregar() {
    setLoading(true)
    try {
      const res = await api.get('/orcamento-grafico/precos-mp', {
        params: { page: 1, limit: 100, busca: busca || undefined, tipo: filtroTipo || undefined },
      })
      setData(res.data.data || res.data || [])
    } catch (err: any) {
      notifications.show({ title: 'Erro ao carregar', message: err?.response?.data?.message || 'Falha ao buscar preços', color: 'red' })
    } finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [busca, filtroTipo])

  function abrirNovo() {
    setEditando(null)
    setForm(FORM_INICIAL)
    setModalAberto(true)
  }

  function abrirEdicao(item: PrecoMaterial) {
    setEditando(item)
    setForm({
      descricao: item.descricao,
      tipo: item.tipo,
      unidade: item.unidade,
      precoUnitario: Number(item.precoUnitario) || 0,
      dataVigencia: item.dataVigencia ? item.dataVigencia.slice(0, 10) : new Date().toISOString().slice(0, 10),
    })
    setModalAberto(true)
  }

  async function salvar() {
    if (!form.descricao.trim()) { notifications.show({ title: 'Erro', message: 'Descrição obrigatória', color: 'red' }); return }
    if (form.precoUnitario <= 0) { notifications.show({ title: 'Erro', message: 'Preço deve ser maior que zero', color: 'red' }); return }

    setSalvando(true)
    try {
      const payload = {
        descricao: form.descricao.trim(),
        tipo: form.tipo,
        unidade: form.unidade,
        precoUnitario: form.precoUnitario,
        dataVigencia: form.dataVigencia ? new Date(form.dataVigencia + 'T00:00:00').toISOString() : undefined,
      }

      if (editando) {
        await api.put(`/orcamento-grafico/precos-mp/${editando.id}`, payload)
      } else {
        await api.post('/orcamento-grafico/precos-mp', payload)
      }
      notifications.show({ title: 'Salvo', message: `Preço ${editando ? 'atualizado' : 'criado'} com sucesso`, color: 'green' })
      setModalAberto(false)
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro ao salvar', message: err?.response?.data?.message || 'Falha ao salvar', color: 'red' })
    } finally { setSalvando(false) }
  }

  async function excluir(item: PrecoMaterial) {
    if (!confirm(`Deseja inativar "${item.descricao}"?`)) return
    try {
      await api.delete(`/orcamento-grafico/precos-mp/${item.id}`)
      notifications.show({ title: 'Inativado', message: `"${item.descricao}" foi inativado`, color: 'yellow' })
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao inativar', color: 'red' })
    }
  }

  async function salvarPrecoInline(item: PrecoMaterial) {
    try {
      await api.put(`/orcamento-grafico/precos-mp/${item.id}`, {
        descricao: item.descricao,
        tipo: item.tipo,
        unidade: item.unidade,
        precoUnitario: editandoPrecoValor,
        dataVigencia: item.dataVigencia,
      })
      notifications.show({ title: 'Preço atualizado', message: '', color: 'green' })
      setEditandoPrecoId(null)
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao atualizar preço', color: 'red' })
    }
  }

  function formatarPreco(valor: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 4 }).format(valor)
  }

  function formatarData(iso: string) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('pt-BR')
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Preços de Matéria-Prima</Title>
          <Text size="sm" c="dimmed">
            Tabela de preços unitários por material — clique no preço para edição rápida
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>Novo Preço</Button>
      </Group>

      <Group>
        <TextInput
          placeholder="Buscar por descrição..."
          value={busca}
          onChange={(e) => setBusca(e.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <Select
          placeholder="Filtrar por tipo"
          data={TIPOS_MATERIAL}
          value={filtroTipo}
          onChange={setFiltroTipo}
          clearable
          w={160}
        />
      </Group>

      {loading ? <Center py="xl"><Loader /></Center> : (
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Descrição</Table.Th>
                <Table.Th>Tipo</Table.Th>
                <Table.Th>Unidade</Table.Th>
                <Table.Th>Preço Unitário</Table.Th>
                <Table.Th>Vigência</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td fw={500}>{item.descricao}</Table.Td>
                  <Table.Td><Badge variant="light">{item.tipo}</Badge></Table.Td>
                  <Table.Td>{item.unidade}</Table.Td>
                  <Table.Td>
                    {editandoPrecoId === item.id ? (
                      <NumberInput
                        size="xs"
                        value={editandoPrecoValor}
                        onChange={(v) => setEditandoPrecoValor(typeof v === 'number' ? v : 0)}
                        decimalScale={4}
                        min={0}
                        w={130}
                        onBlur={() => salvarPrecoInline(item)}
                        onKeyDown={(e) => { if (e.key === 'Enter') salvarPrecoInline(item); if (e.key === 'Escape') setEditandoPrecoId(null) }}
                        autoFocus
                      />
                    ) : (
                      <Text
                        size="sm"
                        fw={600}
                        c="blue"
                        style={{ cursor: 'pointer' }}
                        onClick={() => { setEditandoPrecoId(item.id); setEditandoPrecoValor(Number(item.precoUnitario)) }}
                        title="Clique para editar"
                      >
                        {formatarPreco(Number(item.precoUnitario))}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>{formatarData(item.dataVigencia)}</Table.Td>
                  <Table.Td>
                    <Badge color={item.status ? 'green' : 'red'}>
                      {item.status ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <ActionIcon variant="subtle" onClick={() => abrirEdicao(item)}>
                        <IconEdit size={16} />
                      </ActionIcon>
                      {item.status && (
                        <ActionIcon variant="subtle" color="red" onClick={() => excluir(item)}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {data.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={7}>
                    <Text ta="center" c="dimmed" py="md">Nenhum preço encontrado</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}

      {/* Modal de criação/edição */}
      <Modal
        opened={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editando ? 'Editar Preço' : 'Novo Preço de Material'}
        centered
      >
        <Stack gap="md">
          <TextInput
            label="Descrição"
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.currentTarget.value })}
            required
            maxLength={200}
            placeholder="Ex: Cartão Duplex 300g"
          />
          <Group grow>
            <Select
              label="Tipo"
              data={TIPOS_MATERIAL}
              value={form.tipo}
              onChange={(v) => setForm({ ...form, tipo: v || 'PAPEL' })}
              required
            />
            <Select
              label="Unidade"
              data={UNIDADES}
              value={form.unidade}
              onChange={(v) => setForm({ ...form, unidade: v || 'KG' })}
              required
            />
          </Group>
          <NumberInput
            label="Preço Unitário (R$)"
            value={form.precoUnitario}
            onChange={(v) => setForm({ ...form, precoUnitario: typeof v === 'number' ? v : 0 })}
            min={0}
            decimalScale={4}
            required
          />
          <TextInput
            label="Data de Vigência"
            type="date"
            value={form.dataVigencia}
            onChange={(e) => setForm({ ...form, dataVigencia: e.currentTarget.value })}
          />
          <Button onClick={salvar} fullWidth loading={salvando}>
            {editando ? 'Salvar Alterações' : 'Criar Preço'}
          </Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
