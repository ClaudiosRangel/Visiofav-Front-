'use client'

import { useEffect, useState } from 'react'
import {
  Title, Stack, Table, Group, Button, Text, Loader, Center,
  Modal, NumberInput, Select, ActionIcon, ScrollArea,
} from '@mantine/core'
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

// ============================================================================
// Tipos
// ============================================================================

interface ParametroPerda {
  id: string
  tipoProcessoId: string | null
  centroProducaoId: string | null
  perdaFixaFolhas: number
  perdaVariavel: number
  tipoProcesso?: { descricao: string } | null
  centroProducao?: { descricao: string } | null
}

interface FormData {
  tipoProcessoId: string | null
  centroProducaoId: string | null
  perdaFixaFolhas: number
  perdaVariavel: number
}

const FORM_INICIAL: FormData = {
  tipoProcessoId: null,
  centroProducaoId: null,
  perdaFixaFolhas: 0,
  perdaVariavel: 5,
}

// ============================================================================
// Página Principal
// ============================================================================

export default function ParametrosPerdaPage() {
  useEffect(() => { document.title = 'Orçamento Gráfico - Parâmetros de Perda' }, [])

  const [data, setData] = useState<ParametroPerda[]>([])
  const [loading, setLoading] = useState(true)
  const [tiposProcesso, setTiposProcesso] = useState<any[]>([])
  const [centros, setCentros] = useState<any[]>([])
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<ParametroPerda | null>(null)
  const [form, setForm] = useState<FormData>(FORM_INICIAL)
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    setLoading(true)
    try {
      const [resParams, resTipos, resCentros] = await Promise.all([
        api.get('/orcamento-grafico/parametros-perda'),
        api.get('/tipos-processo', { params: { status: 'true' } }),
        api.get('/centros-producao', { params: { limit: 100 } }),
      ])
      setData(resParams.data.data || resParams.data || [])
      setTiposProcesso(resTipos.data.data || resTipos.data || [])
      setCentros(resCentros.data.data || resCentros.data || [])
    } catch (err: any) {
      notifications.show({ title: 'Erro ao carregar', message: err?.response?.data?.message || 'Falha', color: 'red' })
    } finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [])

  function abrirNovo() {
    setEditando(null)
    setForm(FORM_INICIAL)
    setModalAberto(true)
  }

  function abrirEdicao(item: ParametroPerda) {
    setEditando(item)
    setForm({
      tipoProcessoId: item.tipoProcessoId,
      centroProducaoId: item.centroProducaoId,
      perdaFixaFolhas: item.perdaFixaFolhas,
      perdaVariavel: Number(item.perdaVariavel),
    })
    setModalAberto(true)
  }

  async function salvar() {
    setSalvando(true)
    try {
      const payload = {
        tipoProcessoId: form.tipoProcessoId || undefined,
        centroProducaoId: form.centroProducaoId || undefined,
        perdaFixaFolhas: form.perdaFixaFolhas,
        perdaVariavel: form.perdaVariavel,
      }

      if (editando) {
        await api.put(`/orcamento-grafico/parametros-perda/${editando.id}`, payload)
      } else {
        await api.post('/orcamento-grafico/parametros-perda', payload)
      }
      notifications.show({ title: 'Salvo', message: 'Parâmetro salvo com sucesso', color: 'green' })
      setModalAberto(false)
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro ao salvar', message: err?.response?.data?.message || 'Falha ao salvar', color: 'red' })
    } finally { setSalvando(false) }
  }

  async function excluir(item: ParametroPerda) {
    if (!confirm('Deseja excluir este parâmetro de perda?')) return
    try {
      await api.delete(`/orcamento-grafico/parametros-perda/${item.id}`)
      notifications.show({ title: 'Excluído', message: 'Parâmetro removido', color: 'yellow' })
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao excluir', color: 'red' })
    }
  }

  function labelProcesso(id: string | null): string {
    if (!id) return '—'
    const tp = tiposProcesso.find((t) => t.id === id)
    return tp?.descricao || id
  }

  function labelCentro(id: string | null): string {
    if (!id) return '(Todos)'
    const c = centros.find((x) => x.id === id)
    return c?.descricao || id
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Parâmetros de Perda</Title>
          <Text size="sm" c="dimmed">
            Configuração de perdas fixas (folhas de acerto) e variáveis (%) por processo/máquina
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>Novo Parâmetro</Button>
      </Group>

      {loading ? <Center py="xl"><Loader /></Center> : (
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Tipo de Processo</Table.Th>
                <Table.Th>Centro de Produção</Table.Th>
                <Table.Th>Perda Fixa (folhas)</Table.Th>
                <Table.Th>Perda Variável (%)</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td fw={500}>
                    {item.tipoProcesso?.descricao || labelProcesso(item.tipoProcessoId)}
                  </Table.Td>
                  <Table.Td>
                    {item.centroProducao?.descricao || labelCentro(item.centroProducaoId)}
                  </Table.Td>
                  <Table.Td>{item.perdaFixaFolhas}</Table.Td>
                  <Table.Td>{Number(item.perdaVariavel).toFixed(2)}%</Table.Td>
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
                  <Table.Td colSpan={5}>
                    <Text ta="center" c="dimmed" py="md">Nenhum parâmetro cadastrado</Text>
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
        title={editando ? 'Editar Parâmetro' : 'Novo Parâmetro de Perda'}
        centered
      >
        <Stack gap="md">
          <Select
            label="Tipo de Processo"
            placeholder="Selecione"
            data={tiposProcesso.map((t) => ({ value: t.id, label: t.descricao }))}
            value={form.tipoProcessoId}
            onChange={(v) => setForm({ ...form, tipoProcessoId: v })}
            clearable
            searchable
          />
          <Select
            label="Centro de Produção (opcional)"
            description="Deixe vazio para aplicar a todos os centros deste processo"
            placeholder="Todos"
            data={centros.map((c) => ({ value: c.id, label: `${c.codigo} - ${c.descricao}` }))}
            value={form.centroProducaoId}
            onChange={(v) => setForm({ ...form, centroProducaoId: v })}
            clearable
            searchable
          />
          <NumberInput
            label="Perda Fixa (folhas de acerto)"
            value={form.perdaFixaFolhas}
            onChange={(v) => setForm({ ...form, perdaFixaFolhas: typeof v === 'number' ? v : 0 })}
            min={0}
          />
          <NumberInput
            label="Perda Variável (%)"
            value={form.perdaVariavel}
            onChange={(v) => setForm({ ...form, perdaVariavel: typeof v === 'number' ? v : 0 })}
            min={0}
            max={100}
            decimalScale={2}
            suffix="%"
          />
          <Button onClick={salvar} fullWidth loading={salvando}>
            {editando ? 'Salvar Alterações' : 'Criar Parâmetro'}
          </Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
