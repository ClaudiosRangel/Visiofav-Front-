'use client'

import { useEffect, useState } from 'react'
import {
  Title, Stack, Table, Group, Button, Badge, Text, Loader, Center,
  Modal, TextInput, Select, NumberInput, ActionIcon, ScrollArea, Pagination,
  SimpleGrid,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

// ============================================================================
// Modelos de Faca (GCad) — catálogo de gabaritos técnicos reais com dimensões,
// repetição/encaixe (poses por folha) e formato de corte. A seleção de um
// modelo no wizard do orçamento preenche a geometria/imposição reais do item
// (ponto de injeção `aproveitamento = linhas × colunas`). Ver design §6.1/§6.2.
// Multi-tenant por empresaId (resolvido no backend). CRUD completo.
// ============================================================================

interface ModeloFaca {
  id: string
  codigo: string
  clienteNome: string | null
  modelo: string
  servico: string
  larguraMm: number
  alturaMm: number
  repeticaoLinhas: number
  repeticaoColunas: number
  formatoCorteLarguraMm: number
  formatoCorteAlturaMm: number
  tipoCartucho: string | null
  suporteId: string | null
  gramatura: number | null
  status: boolean
}

interface SuporteItem {
  id: string
  descricao: string
}

interface FormData {
  codigo: string
  clienteNome: string
  modelo: string
  servico: string
  larguraMm: number
  alturaMm: number
  repeticaoLinhas: number
  repeticaoColunas: number
  formatoCorteLarguraMm: number
  formatoCorteAlturaMm: number
  tipoCartucho: string
  suporteId: string | null
  gramatura: number | null
}

const FORM_INICIAL: FormData = {
  codigo: '',
  clienteNome: '',
  modelo: '',
  servico: '',
  larguraMm: 0,
  alturaMm: 0,
  repeticaoLinhas: 1,
  repeticaoColunas: 1,
  formatoCorteLarguraMm: 0,
  formatoCorteAlturaMm: 0,
  tipoCartucho: '',
  suporteId: null,
  gramatura: null,
}

export default function ModelosFacaPage() {
  useEffect(() => { document.title = 'Orçamento Gráfico - Modelos de Faca (GCad)' }, [])

  const [data, setData] = useState<ModeloFaca[]>([])
  const [loading, setLoading] = useState(true)
  // Filtros server-side por cliente e modelo (design §6.1)
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroModelo, setFiltroModelo] = useState('')
  const [debCliente] = useDebouncedValue(filtroCliente, 300)
  const [debModelo] = useDebouncedValue(filtroModelo, 300)

  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<ModeloFaca | null>(null)
  const [form, setForm] = useState<FormData>(FORM_INICIAL)
  const [salvando, setSalvando] = useState(false)

  // Suportes para o Select opcional (GET /suportes)
  const [suportes, setSuportes] = useState<SuporteItem[]>([])

  // Paginação (50 itens/página)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const LIMIT = 50

  async function carregar() {
    setLoading(true)
    try {
      const res = await api.get('/orcamento-grafico/modelos-faca', {
        params: {
          page,
          limit: LIMIT,
          cliente: debCliente || undefined,
          modelo: debModelo || undefined,
        },
      })
      setData(res.data.data || res.data || [])
      setTotal(res.data.total || 0)
      setTotalPages(res.data.totalPages || 1)
    } catch (err: any) {
      notifications.show({ title: 'Erro ao carregar', message: err?.response?.data?.message || 'Falha ao buscar modelos de faca', color: 'red' })
    } finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [debCliente, debModelo, page]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setPage(1) }, [debCliente, debModelo])

  // Carrega os suportes uma vez (para o Select do form).
  useEffect(() => {
    api.get('/orcamento-grafico/suportes', { params: { limit: 100 } })
      .then(({ data }) => {
        const items = (Array.isArray(data) ? data : data.data || []).map((s: any) => ({ id: s.id, descricao: s.descricao }))
        setSuportes(items)
      })
      .catch(() => setSuportes([]))
  }, [])

  function abrirNovo() {
    setEditando(null)
    setForm(FORM_INICIAL)
    setModalAberto(true)
  }

  function abrirEdicao(item: ModeloFaca) {
    setEditando(item)
    setForm({
      codigo: item.codigo,
      clienteNome: item.clienteNome || '',
      modelo: item.modelo,
      servico: item.servico,
      larguraMm: Number(item.larguraMm) || 0,
      alturaMm: Number(item.alturaMm) || 0,
      repeticaoLinhas: Number(item.repeticaoLinhas) || 1,
      repeticaoColunas: Number(item.repeticaoColunas) || 1,
      formatoCorteLarguraMm: Number(item.formatoCorteLarguraMm) || 0,
      formatoCorteAlturaMm: Number(item.formatoCorteAlturaMm) || 0,
      tipoCartucho: item.tipoCartucho || '',
      suporteId: item.suporteId || null,
      gramatura: item.gramatura != null ? Number(item.gramatura) : null,
    })
    setModalAberto(true)
  }

  async function salvar() {
    // Campos obrigatórios (design §6.1)
    if (!form.codigo.trim()) { notifications.show({ title: 'Erro', message: 'Código obrigatório', color: 'red' }); return }
    if (!form.modelo.trim()) { notifications.show({ title: 'Erro', message: 'Modelo obrigatório', color: 'red' }); return }
    if (!form.servico.trim()) { notifications.show({ title: 'Erro', message: 'Serviço obrigatório', color: 'red' }); return }
    if (form.larguraMm <= 0 || form.alturaMm <= 0) { notifications.show({ title: 'Erro', message: 'Largura e altura (mm) devem ser maiores que zero', color: 'red' }); return }
    if (form.repeticaoLinhas < 1 || form.repeticaoColunas < 1) { notifications.show({ title: 'Erro', message: 'Repetição de linhas e colunas deve ser no mínimo 1', color: 'red' }); return }
    if (form.formatoCorteLarguraMm <= 0 || form.formatoCorteAlturaMm <= 0) { notifications.show({ title: 'Erro', message: 'Formato de corte (largura e altura em mm) deve ser maior que zero', color: 'red' }); return }

    setSalvando(true)
    try {
      const payload = {
        codigo: form.codigo.trim(),
        clienteNome: form.clienteNome.trim() || null,
        modelo: form.modelo.trim(),
        servico: form.servico.trim(),
        larguraMm: form.larguraMm,
        alturaMm: form.alturaMm,
        repeticaoLinhas: form.repeticaoLinhas,
        repeticaoColunas: form.repeticaoColunas,
        formatoCorteLarguraMm: form.formatoCorteLarguraMm,
        formatoCorteAlturaMm: form.formatoCorteAlturaMm,
        tipoCartucho: form.tipoCartucho.trim() || null,
        suporteId: form.suporteId || null,
        gramatura: form.gramatura && form.gramatura > 0 ? form.gramatura : null,
      }
      if (editando) {
        await api.put(`/orcamento-grafico/modelos-faca/${editando.id}`, payload)
      } else {
        await api.post('/orcamento-grafico/modelos-faca', payload)
      }
      notifications.show({ title: 'Salvo', message: `Modelo de faca ${editando ? 'atualizado' : 'criado'} com sucesso`, color: 'green' })
      setModalAberto(false)
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro ao salvar', message: err?.response?.data?.message || 'Falha ao salvar', color: 'red' })
    } finally { setSalvando(false) }
  }

  async function excluir(item: ModeloFaca) {
    if (!confirm(`Deseja excluir o modelo "${item.modelo}" (${item.codigo})?`)) return
    try {
      await api.delete(`/orcamento-grafico/modelos-faca/${item.id}`)
      notifications.show({ title: 'Excluído', message: `Modelo "${item.modelo}" foi excluído`, color: 'yellow' })
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao excluir (verifique se há orçamentos vinculados)', color: 'red' })
    }
  }

  function fmt(v: number) {
    return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Modelos de Faca (GCad)</Title>
          <Text size="sm" c="dimmed">
            {total} {total === 1 ? 'modelo' : 'modelos'} — gabaritos técnicos (dimensões, repetição/encaixe e formato de corte) usados no cálculo do orçamento.
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>Novo Modelo</Button>
      </Group>

      <Group grow>
        <TextInput
          placeholder="Filtrar por cliente..."
          value={filtroCliente}
          onChange={(e) => setFiltroCliente(e.currentTarget.value)}
        />
        <TextInput
          placeholder="Filtrar por modelo..."
          value={filtroModelo}
          onChange={(e) => setFiltroModelo(e.currentTarget.value)}
        />
      </Group>

      {loading ? <Center py="xl"><Loader /></Center> : (
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Código</Table.Th>
                <Table.Th>Cliente</Table.Th>
                <Table.Th>Modelo</Table.Th>
                <Table.Th>Serviço</Table.Th>
                <Table.Th>Dimensões (mm)</Table.Th>
                <Table.Th>Repetição</Table.Th>
                <Table.Th>Formato de Corte (mm)</Table.Th>
                <Table.Th>Tipo Cartucho</Table.Th>
                <Table.Th>Gramatura</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td fw={500}>{item.codigo}</Table.Td>
                  <Table.Td>{item.clienteNome || '—'}</Table.Td>
                  <Table.Td>{item.modelo}</Table.Td>
                  <Table.Td>{item.servico}</Table.Td>
                  <Table.Td>{fmt(item.larguraMm)} × {fmt(item.alturaMm)}</Table.Td>
                  <Table.Td>
                    <Badge variant="light" color="grape">
                      {item.repeticaoLinhas} × {item.repeticaoColunas} = {item.repeticaoLinhas * item.repeticaoColunas}
                    </Badge>
                  </Table.Td>
                  <Table.Td>{fmt(item.formatoCorteLarguraMm)} × {fmt(item.formatoCorteAlturaMm)}</Table.Td>
                  <Table.Td c="dimmed">{item.tipoCartucho || '—'}</Table.Td>
                  <Table.Td c="dimmed">{item.gramatura != null ? `${fmt(item.gramatura)} g/m²` : '—'}</Table.Td>
                  <Table.Td>
                    <Badge color={item.status ? 'green' : 'red'}>{item.status ? 'Ativo' : 'Inativo'}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <ActionIcon variant="subtle" onClick={() => abrirEdicao(item)}>
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon variant="subtle" color="red" onClick={() => excluir(item)}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {data.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={11}>
                    <Text ta="center" c="dimmed" py="md">Nenhum modelo de faca encontrado</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}

      {totalPages > 1 && (
        <Group justify="center">
          <Pagination total={totalPages} value={page} onChange={setPage} />
        </Group>
      )}

      <Modal
        opened={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editando ? 'Editar Modelo de Faca' : 'Novo Modelo de Faca'}
        size="lg"
        centered
      >
        <Stack gap="md">
          <Group grow>
            <TextInput
              label="Código"
              value={form.codigo}
              onChange={(e) => setForm({ ...form, codigo: e.currentTarget.value })}
              required
              maxLength={40}
              placeholder="Ex: FACA-2529B"
            />
            <TextInput
              label="Cliente (opcional)"
              value={form.clienteNome}
              onChange={(e) => setForm({ ...form, clienteNome: e.currentTarget.value })}
              maxLength={200}
              placeholder="Ex: Indústria Alfa Ltda"
            />
          </Group>

          <Group grow>
            <TextInput
              label="Modelo"
              value={form.modelo}
              onChange={(e) => setForm({ ...form, modelo: e.currentTarget.value })}
              required
              maxLength={200}
              placeholder="Ex: Cartucho 60x40x120"
            />
            <TextInput
              label="Serviço"
              value={form.servico}
              onChange={(e) => setForm({ ...form, servico: e.currentTarget.value })}
              required
              maxLength={200}
              placeholder="Ex: Corte e Vinco"
            />
          </Group>

          <Text fw={600} size="sm" c="dimmed">Dimensões do produto</Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <NumberInput
              label="Largura (mm)"
              value={form.larguraMm}
              onChange={(v) => setForm({ ...form, larguraMm: typeof v === 'number' ? v : 0 })}
              min={0}
              decimalScale={2}
              required
              suffix=" mm"
            />
            <NumberInput
              label="Altura (mm)"
              value={form.alturaMm}
              onChange={(v) => setForm({ ...form, alturaMm: typeof v === 'number' ? v : 0 })}
              min={0}
              decimalScale={2}
              required
              suffix=" mm"
            />
          </SimpleGrid>

          <Text fw={600} size="sm" c="dimmed">Repetição / Encaixe (poses por folha)</Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <NumberInput
              label="Repetição de Linhas"
              value={form.repeticaoLinhas}
              onChange={(v) => setForm({ ...form, repeticaoLinhas: typeof v === 'number' ? v : 1 })}
              min={1}
              step={1}
              required
            />
            <NumberInput
              label="Repetição de Colunas"
              value={form.repeticaoColunas}
              onChange={(v) => setForm({ ...form, repeticaoColunas: typeof v === 'number' ? v : 1 })}
              min={1}
              step={1}
              required
            />
          </SimpleGrid>
          <Text size="xs" c="dimmed">
            Poses por folha = {form.repeticaoLinhas} × {form.repeticaoColunas} = <strong>{form.repeticaoLinhas * form.repeticaoColunas}</strong>
          </Text>

          <Text fw={600} size="sm" c="dimmed">Formato de corte (folha)</Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <NumberInput
              label="Formato de Corte — Largura (mm)"
              value={form.formatoCorteLarguraMm}
              onChange={(v) => setForm({ ...form, formatoCorteLarguraMm: typeof v === 'number' ? v : 0 })}
              min={0}
              decimalScale={2}
              required
              suffix=" mm"
            />
            <NumberInput
              label="Formato de Corte — Altura (mm)"
              value={form.formatoCorteAlturaMm}
              onChange={(v) => setForm({ ...form, formatoCorteAlturaMm: typeof v === 'number' ? v : 0 })}
              min={0}
              decimalScale={2}
              required
              suffix=" mm"
            />
          </SimpleGrid>

          <Text fw={600} size="sm" c="dimmed">Opcionais</Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <TextInput
              label="Tipo de Cartucho (opcional)"
              value={form.tipoCartucho}
              onChange={(e) => setForm({ ...form, tipoCartucho: e.currentTarget.value })}
              maxLength={100}
              placeholder="Ex: Fundo Automático"
            />
            <Select
              label="Suporte (opcional)"
              placeholder="Selecione um suporte"
              data={suportes.map(s => ({ value: s.id, label: s.descricao }))}
              value={form.suporteId}
              onChange={(v) => setForm({ ...form, suporteId: v })}
              searchable
              clearable
              comboboxProps={{ withinPortal: true }}
            />
          </SimpleGrid>
          <NumberInput
            label="Gramatura (opcional)"
            description="Peso do papel em g/m²"
            value={form.gramatura ?? ''}
            onChange={(v) => setForm({ ...form, gramatura: typeof v === 'number' ? v : null })}
            min={0}
            max={2000}
            decimalScale={2}
            suffix=" g/m²"
          />

          <Button onClick={salvar} fullWidth loading={salvando}>
            {editando ? 'Salvar Alterações' : 'Criar Modelo'}
          </Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
