'use client'

/**
 * Cadastro de Exceções de Calendário por centro/data (spec
 * pcp-excecoes-calendario-gantt). Sobrepõem o turno-base do centro naquela
 * data: hora extra, dia extra trabalhado ou não-trabalho/parada. Refletem no
 * Gantt (motor de agenda + segmentação visual).
 */
import { useEffect, useState } from 'react'
import {
  Title, Stack, Group, Button, Modal, Select, TextInput, Textarea, ActionIcon, Badge, Text,
} from '@mantine/core'
import { IconPlus, IconTrash, IconEdit } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'
import { DataTablePadrao } from '@/components/ui/DataTablePadrao'

const TIPOS: Record<string, { label: string; color: string }> = {
  HORA_EXTRA: { label: 'Hora extra', color: 'blue' },
  DIA_EXTRA: { label: 'Dia extra', color: 'teal' },
  NAO_TRABALHO: { label: 'Não-trabalho', color: 'red' },
}

interface Excecao {
  id: string
  centroProducaoId: string
  data: string
  tipo: string
  horaInicio: string | null
  horaFim: string | null
  observacao: string | null
}

export default function ExcecoesCalendarioPage() {
  useEffect(() => { document.title = 'PCP - Exceções de Calendário' }, [])

  const [centros, setCentros] = useState<any[]>([])
  const [centroId, setCentroId] = useState<string | null>(null)
  const [dados, setDados] = useState<Excecao[]>([])
  const [loading, setLoading] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Excecao | null>(null)
  const [form, setForm] = useState({
    data: '',
    tipo: 'HORA_EXTRA',
    horaInicio: '17:00',
    horaFim: '20:00',
    observacao: '',
  })

  async function carregarCentros() {
    try {
      const res = await api.get('/centros-producao', { params: { limit: 100 } })
      setCentros(res.data.data || [])
    } catch { /* noop */ }
  }

  async function carregar() {
    if (!centroId) { setDados([]); return }
    setLoading(true)
    try {
      const res = await api.get('/pcp/excecoes-turno', { params: { centroProducaoId: centroId } })
      setDados(res.data || [])
    } catch { /* noop */ } finally { setLoading(false) }
  }

  useEffect(() => { carregarCentros() }, [])
  useEffect(() => { carregar() }, [centroId])

  function abrirNovo() {
    setEditando(null)
    setForm({ data: '', tipo: 'HORA_EXTRA', horaInicio: '17:00', horaFim: '20:00', observacao: '' })
    setModalAberto(true)
  }

  function abrirEdicao(item: Excecao) {
    setEditando(item)
    setForm({
      data: item.data?.slice(0, 10) || '',
      tipo: item.tipo,
      horaInicio: item.horaInicio || '17:00',
      horaFim: item.horaFim || '20:00',
      observacao: item.observacao || '',
    })
    setModalAberto(true)
  }

  async function salvar() {
    if (!centroId) { notifications.show({ title: 'Erro', message: 'Selecione um centro', color: 'red' }); return }
    if (!form.data) { notifications.show({ title: 'Erro', message: 'Informe a data', color: 'red' }); return }
    const naoTrabalho = form.tipo === 'NAO_TRABALHO'
    const payload: any = {
      centroProducaoId: centroId,
      data: form.data,
      tipo: form.tipo,
      horaInicio: naoTrabalho ? null : form.horaInicio,
      horaFim: naoTrabalho ? null : form.horaFim,
      observacao: form.observacao || null,
    }
    try {
      if (editando) await api.put(`/pcp/excecoes-turno/${editando.id}`, payload)
      else await api.post('/pcp/excecoes-turno', payload)
      notifications.show({ title: 'Salvo', message: '', color: 'green' })
      setModalAberto(false)
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao salvar', color: 'red' })
    }
  }

  async function excluir(item: Excecao) {
    if (!confirm('Excluir esta exceção?')) return
    try {
      await api.delete(`/pcp/excecoes-turno/${item.id}`)
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao excluir', color: 'red' })
    }
  }

  const colunas = [
    {
      accessor: 'data',
      title: 'Data',
      sortable: true,
      render: (r: Excecao) => new Date(r.data).toLocaleDateString('pt-BR', { timeZone: 'UTC' }),
    },
    {
      accessor: 'tipo',
      title: 'Tipo',
      sortable: true,
      render: (r: Excecao) => <Badge color={TIPOS[r.tipo]?.color || 'gray'} variant="light">{TIPOS[r.tipo]?.label || r.tipo}</Badge>,
    },
    {
      accessor: 'janela',
      title: 'Janela',
      render: (r: Excecao) => (r.tipo === 'NAO_TRABALHO' ? <Text size="sm" c="dimmed">—</Text> : <Text size="sm">{r.horaInicio} às {r.horaFim}</Text>),
    },
    { accessor: 'observacao', title: 'Observação', render: (r: Excecao) => r.observacao || '—' },
    {
      accessor: 'acoes',
      title: 'Ações',
      width: 90,
      render: (r: Excecao) => (
        <Group gap={4}>
          <ActionIcon variant="subtle" color="blue" onClick={() => abrirEdicao(r)}><IconEdit size={16} /></ActionIcon>
          <ActionIcon variant="subtle" color="red" onClick={() => excluir(r)}><IconTrash size={16} /></ActionIcon>
        </Group>
      ),
    },
  ]

  const naoTrabalho = form.tipo === 'NAO_TRABALHO'

  return (
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Exceções de Calendário</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo} disabled={!centroId}>Nova exceção</Button>
      </Group>

      <Text size="sm" c="dimmed">
        Sobrepõem o turno-base da máquina em uma data específica: hora extra (estende o expediente),
        dia extra (trabalha num dia normalmente livre, ex. sábado) ou não-trabalho (feriado/parada).
        O Gantt se alinha automaticamente a essas exceções.
      </Text>

      <Select
        label="Centro de produção (máquina)"
        placeholder="Selecione a máquina"
        searchable
        data={centros.map((c) => ({ value: c.id, label: `${c.codigo} - ${c.descricao}` }))}
        value={centroId}
        onChange={setCentroId}
        w={420}
      />

      {centroId && (
        <DataTablePadrao<Excecao>
          dados={dados}
          colunas={colunas as any}
          carregando={loading}
          camposBusca={['tipo', 'observacao']}
          buscaPlaceholder="Buscar por tipo/observação..."
          textoVazio="Nenhuma exceção cadastrada para esta máquina"
          ordenacaoInicial={{ columnAccessor: 'data', direction: 'asc' }}
        />
      )}

      <Modal opened={modalAberto} onClose={() => setModalAberto(false)} title={editando ? 'Editar exceção' : 'Nova exceção'} centered>
        <Stack>
          <TextInput
            label="Data"
            type="date"
            value={form.data}
            onChange={(e) => setForm({ ...form, data: e.currentTarget.value })}
            required
          />
          <Select
            label="Tipo"
            data={Object.entries(TIPOS).map(([value, v]) => ({ value, label: v.label }))}
            value={form.tipo}
            onChange={(v) => setForm({ ...form, tipo: v || 'HORA_EXTRA' })}
          />
          {!naoTrabalho && (
            <Group grow>
              <TextInput label="Hora início" type="time" value={form.horaInicio} onChange={(e) => setForm({ ...form, horaInicio: e.currentTarget.value })} />
              <TextInput label="Hora fim" type="time" value={form.horaFim} onChange={(e) => setForm({ ...form, horaFim: e.currentTarget.value })} />
            </Group>
          )}
          <Textarea label="Observação (opcional)" value={form.observacao} onChange={(e) => setForm({ ...form, observacao: e.currentTarget.value })} autosize minRows={2} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={salvar}>Salvar</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
