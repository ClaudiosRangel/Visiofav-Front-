'use client'

import { useEffect, useState } from 'react'
import {
  Title, Stack, Table, Group, Button, Badge, Text, Loader, Center,
  Modal, TextInput, NumberInput, Switch, ActionIcon, ScrollArea,
} from '@mantine/core'
import { IconPlus, IconEdit } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

// ============================================================================
// Materiais de Acabamento — cadastro (código, nome, valor de referência, ativo).
// Endpoint base: /orcamento-grafico/materiais-acabamento
// ============================================================================

interface MaterialAcabamento {
  id: string
  codigo: string
  nome: string
  valorReferencia: number | null
  ativo: boolean
}

interface FormData {
  codigo: string
  nome: string
  valorReferencia: number | string
  ativo: boolean
}

const FORM_INICIAL: FormData = {
  codigo: '',
  nome: '',
  valorReferencia: 0,
  ativo: true,
}

export default function MateriaisAcabamentoPage() {
  useEffect(() => { document.title = 'Orçamento Gráfico - Materiais de Acabamento' }, [])

  const [data, setData] = useState<MaterialAcabamento[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<MaterialAcabamento | null>(null)
  const [form, setForm] = useState<FormData>(FORM_INICIAL)
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    setLoading(true)
    try {
      const res = await api.get('/orcamento-grafico/materiais-acabamento', {
        params: {
          situacao: mostrarInativos ? 'todas' : 'ativa',
          busca: busca || undefined,
        },
      })
      setData(res.data.data || res.data || [])
    } catch (err: any) {
      notifications.show({ title: 'Erro ao carregar', message: err?.response?.data?.message || 'Falha ao buscar materiais de acabamento', color: 'red' })
    } finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [busca, mostrarInativos]) // eslint-disable-line react-hooks/exhaustive-deps

  function abrirNovo() {
    setEditando(null)
    setForm(FORM_INICIAL)
    setModalAberto(true)
  }

  function abrirEdicao(item: MaterialAcabamento) {
    setEditando(item)
    setForm({
      codigo: item.codigo,
      nome: item.nome,
      valorReferencia: item.valorReferencia != null ? Number(item.valorReferencia) : 0,
      ativo: item.ativo,
    })
    setModalAberto(true)
  }

  async function salvar() {
    if (!form.codigo.trim()) { notifications.show({ title: 'Erro', message: 'Código obrigatório', color: 'red' }); return }
    if (!form.nome.trim()) { notifications.show({ title: 'Erro', message: 'Nome obrigatório', color: 'red' }); return }

    setSalvando(true)
    try {
      const payload = {
        codigo: form.codigo.trim(),
        nome: form.nome.trim(),
        valorReferencia: typeof form.valorReferencia === 'number' ? form.valorReferencia : 0,
        ativo: form.ativo,
      }
      if (editando) {
        await api.put(`/orcamento-grafico/materiais-acabamento/${editando.id}`, payload)
      } else {
        await api.post('/orcamento-grafico/materiais-acabamento', payload)
      }
      notifications.show({ title: 'Salvo', message: `Material de acabamento ${editando ? 'atualizado' : 'criado'} com sucesso`, color: 'green' })
      setModalAberto(false)
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro ao salvar', message: err?.response?.data?.message || 'Falha ao salvar', color: 'red' })
    } finally { setSalvando(false) }
  }

  function fmtValor(v: number | null) {
    if (v == null) return '—'
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 4 })
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Materiais de Acabamento</Title>
          <Text size="sm" c="dimmed">Cadastro de materiais de acabamento do orçamento gráfico</Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>Novo</Button>
      </Group>

      <Group justify="space-between">
        <TextInput
          placeholder="Buscar por código ou nome..."
          value={busca}
          onChange={(e) => setBusca(e.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <Switch
          label="Mostrar inativos"
          checked={mostrarInativos}
          onChange={(e) => setMostrarInativos(e.currentTarget.checked)}
        />
      </Group>

      {loading ? <Center py="xl"><Loader /></Center> : (
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Código</Table.Th>
                <Table.Th>Nome</Table.Th>
                <Table.Th>Valor de referência</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td fw={500}>{item.codigo}</Table.Td>
                  <Table.Td>{item.nome}</Table.Td>
                  <Table.Td>{fmtValor(item.valorReferencia)}</Table.Td>
                  <Table.Td>
                    <Badge color={item.ativo ? 'green' : 'red'}>{item.ativo ? 'Ativo' : 'Inativo'}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon variant="subtle" onClick={() => abrirEdicao(item)}>
                      <IconEdit size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
              {data.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text ta="center" c="dimmed" py="md">Nenhum material de acabamento encontrado</Text>
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
        title={editando ? 'Editar Material de Acabamento' : 'Novo Material de Acabamento'}
        centered
      >
        <Stack gap="md">
          <TextInput
            label="Código"
            value={form.codigo}
            onChange={(e) => setForm({ ...form, codigo: e.currentTarget.value })}
            required
            maxLength={30}
            placeholder="Ex: MA-001"
          />
          <TextInput
            label="Nome"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.currentTarget.value })}
            required
            maxLength={200}
            placeholder="Ex: BOPP Brilho"
          />
          <NumberInput
            label="Valor de referência"
            value={form.valorReferencia}
            onChange={(v) => setForm({ ...form, valorReferencia: typeof v === 'number' ? v : 0 })}
            min={0}
            prefix="R$ "
            decimalScale={4}
            decimalSeparator=","
            thousandSeparator="."
            step={0.01}
          />
          <Switch
            label="Ativo"
            checked={form.ativo}
            onChange={(e) => setForm({ ...form, ativo: e.currentTarget.checked })}
          />
          <Button onClick={salvar} fullWidth loading={salvando}>
            {editando ? 'Salvar Alterações' : 'Criar'}
          </Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
