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
// Suporte Gráfico — cadastro de papel/suporte com coeficiente de tinta (SPANKS).
// O coefTinta alimenta o cálculo de consumo de tinta do Orçamento Gráfico
// (ver docs/calcgraf-consumo-tinta.md). Valores de referência da indústria:
// CARTÃO 1,5 · KRAFT 2,2 · OFFSET 1,6 · COUCHE 1,0 · JORNAL 1,8.
// ============================================================================

interface Suporte {
  id: string
  codigo: string
  descricao: string
  tipoSuporte: string
  coefTinta: number
  gramaturas: string | null
  status: boolean
}

interface FormData {
  codigo: string
  descricao: string
  tipoSuporte: string
  coefTinta: number
  gramaturas: string
}

const FORM_INICIAL: FormData = {
  codigo: '',
  descricao: '',
  tipoSuporte: 'CARTAO',
  coefTinta: 1.5,
  gramaturas: '',
}

// Tipos de suporte com o coefTinta de referência (fator "Stock" do SPANKS).
const TIPOS_SUPORTE = [
  { value: 'CARTAO', label: 'Cartão', coef: 1.5 },
  { value: 'KRAFT', label: 'Kraft', coef: 2.2 },
  { value: 'OFFSET', label: 'Offset', coef: 1.6 },
  { value: 'COUCHE', label: 'Couché', coef: 1.0 },
  { value: 'JORNAL', label: 'Jornal', coef: 1.8 },
  { value: 'MICRO', label: 'Micro-ondulado', coef: 2.2 },
  { value: 'OUTRO', label: 'Outro', coef: 1.5 },
]

export default function SuportesPage() {
  useEffect(() => { document.title = 'Orçamento Gráfico - Suportes' }, [])

  const [data, setData] = useState<Suporte[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Suporte | null>(null)
  const [form, setForm] = useState<FormData>(FORM_INICIAL)
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    setLoading(true)
    try {
      const res = await api.get('/orcamento-grafico/suportes', {
        params: { page: 1, limit: 100, busca: busca || undefined },
      })
      setData(res.data.data || res.data || [])
    } catch (err: any) {
      notifications.show({ title: 'Erro ao carregar', message: err?.response?.data?.message || 'Falha ao buscar suportes', color: 'red' })
    } finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [busca]) // eslint-disable-line react-hooks/exhaustive-deps

  function abrirNovo() {
    setEditando(null)
    setForm(FORM_INICIAL)
    setModalAberto(true)
  }

  function abrirEdicao(item: Suporte) {
    setEditando(item)
    setForm({
      codigo: item.codigo,
      descricao: item.descricao,
      tipoSuporte: item.tipoSuporte,
      coefTinta: Number(item.coefTinta) || 1.5,
      gramaturas: item.gramaturas || '',
    })
    setModalAberto(true)
  }

  // Ao trocar o tipo, sugere o coefTinta de referência (usuário pode ajustar).
  function onTipoChange(v: string | null) {
    const tipo = v || 'OUTRO'
    const ref = TIPOS_SUPORTE.find(t => t.value === tipo)
    setForm(f => ({ ...f, tipoSuporte: tipo, coefTinta: ref ? ref.coef : f.coefTinta }))
  }

  async function salvar() {
    if (!form.codigo.trim()) { notifications.show({ title: 'Erro', message: 'Código obrigatório', color: 'red' }); return }
    if (!form.descricao.trim()) { notifications.show({ title: 'Erro', message: 'Descrição obrigatória', color: 'red' }); return }

    setSalvando(true)
    try {
      const payload = {
        codigo: form.codigo.trim(),
        descricao: form.descricao.trim(),
        tipoSuporte: form.tipoSuporte,
        coefTinta: form.coefTinta,
        gramaturas: form.gramaturas.trim() || null,
      }
      if (editando) {
        await api.put(`/orcamento-grafico/suportes/${editando.id}`, payload)
      } else {
        await api.post('/orcamento-grafico/suportes', payload)
      }
      notifications.show({ title: 'Salvo', message: `Suporte ${editando ? 'atualizado' : 'criado'} com sucesso`, color: 'green' })
      setModalAberto(false)
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro ao salvar', message: err?.response?.data?.message || 'Falha ao salvar', color: 'red' })
    } finally { setSalvando(false) }
  }

  async function excluir(item: Suporte) {
    if (!confirm(`Deseja inativar "${item.descricao}"?`)) return
    try {
      await api.delete(`/orcamento-grafico/suportes/${item.id}`)
      notifications.show({ title: 'Inativado', message: `"${item.descricao}" foi inativado`, color: 'yellow' })
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao inativar', color: 'red' })
    }
  }

  function labelTipo(v: string) {
    return TIPOS_SUPORTE.find(t => t.value === v)?.label || v
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Suportes (Papel/Cartão)</Title>
          <Text size="sm" c="dimmed">
            Cadastro de suportes com o coeficiente de tinta usado no cálculo de consumo (fórmula SPANKS).
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>Novo Suporte</Button>
      </Group>

      <TextInput
        placeholder="Buscar por código ou descrição..."
        value={busca}
        onChange={(e) => setBusca(e.currentTarget.value)}
      />

      {loading ? <Center py="xl"><Loader /></Center> : (
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Código</Table.Th>
                <Table.Th>Descrição</Table.Th>
                <Table.Th>Tipo</Table.Th>
                <Table.Th>Coef. Tinta</Table.Th>
                <Table.Th>Gramaturas</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td fw={500}>{item.codigo}</Table.Td>
                  <Table.Td>{item.descricao}</Table.Td>
                  <Table.Td><Badge variant="light">{labelTipo(item.tipoSuporte)}</Badge></Table.Td>
                  <Table.Td>{Number(item.coefTinta).toLocaleString('pt-BR', { minimumFractionDigits: 1 })}</Table.Td>
                  <Table.Td c="dimmed">{item.gramaturas || '—'}</Table.Td>
                  <Table.Td>
                    <Badge color={item.status ? 'green' : 'red'}>{item.status ? 'Ativo' : 'Inativo'}</Badge>
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
                    <Text ta="center" c="dimmed" py="md">Nenhum suporte encontrado</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}

      <Modal
        opened={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editando ? 'Editar Suporte' : 'Novo Suporte'}
        centered
      >
        <Stack gap="md">
          <Group grow>
            <TextInput
              label="Código"
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.currentTarget.value })}
              required
              maxLength={30}
              placeholder="Ex: STORA-199"
            />
            <Select
              label="Tipo de Suporte"
              data={TIPOS_SUPORTE.map(t => ({ value: t.value, label: t.label }))}
              value={form.tipoSuporte}
              onChange={onTipoChange}
              required
            />
          </Group>
          <TextInput
            label="Descrição"
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.currentTarget.value })}
            required
            maxLength={200}
            placeholder="Ex: Stora Enzo Bobina 199g"
          />
          <NumberInput
            label="Coeficiente de Tinta (fator Stock SPANKS)"
            description="Referência: Cartão 1,5 · Kraft 2,2 · Offset 1,6 · Couché 1,0 · Jornal 1,8"
            value={form.coefTinta}
            onChange={(v) => setForm({ ...form, coefTinta: typeof v === 'number' ? v : 0 })}
            min={0}
            max={100}
            decimalScale={3}
            step={0.1}
            required
          />
          <TextInput
            label="Gramaturas disponíveis (opcional)"
            description="Lista livre separada por vírgula"
            value={form.gramaturas}
            onChange={(e) => setForm({ ...form, gramaturas: e.currentTarget.value })}
            placeholder="Ex: 191, 230, 280"
          />
          <Button onClick={salvar} fullWidth loading={salvando}>
            {editando ? 'Salvar Alterações' : 'Criar Suporte'}
          </Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
