'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Title, Stack, Table, Group, Button, Badge, Text, Loader, Center, Modal,
  TextInput, NumberInput, Switch, ActionIcon, ScrollArea,
} from '@mantine/core'
import { IconPlus, IconEdit } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

// Tributação por operação (paridade TributacaoVenda do Calcgraf).
// Spec configurador-grafico-calcgraf (Req 3.6).

interface Tributacao {
  id: string
  nome: string
  ativo: boolean
  aliquotaImposto: number | string
  aliquotaIpi: number | string
  pisCofinsPercent: number | string
  comissaoPercent: number | string
  flagCredIcms: boolean
  flagCredIpi: boolean
  flagCredPisCofins: boolean
  flagPapelImune: boolean
  prazoFinanciamento: number
}

interface FormData {
  nome: string
  ativo: boolean
  aliquotaImposto: number
  aliquotaIpi: number
  pisCofinsPercent: number
  comissaoPercent: number
  flagCredIcms: boolean
  flagCredIpi: boolean
  flagCredPisCofins: boolean
  flagPapelImune: boolean
  prazoFinanciamento: number
}

const FORM_INICIAL: FormData = {
  nome: '',
  ativo: true,
  aliquotaImposto: 0,
  aliquotaIpi: 0,
  pisCofinsPercent: 9.25,
  comissaoPercent: 0,
  flagCredIcms: false,
  flagCredIpi: false,
  flagCredPisCofins: false,
  flagPapelImune: false,
  prazoFinanciamento: 0,
}

const n = (v: number | string) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function TributacaoPage() {
  useEffect(() => { document.title = 'Orçamento Gráfico - Tributação' }, [])

  const [itens, setItens] = useState<Tributacao[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<Tributacao | null>(null)
  const [form, setForm] = useState<FormData>(FORM_INICIAL)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/configurador-grafico/tributacao')
      setItens(data.itens || [])
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao carregar.', color: 'red' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  function abrirNovo() {
    setEditando(null)
    setForm(FORM_INICIAL)
    setModalAberto(true)
  }

  function abrirEdicao(t: Tributacao) {
    setEditando(t)
    setForm({
      nome: t.nome,
      ativo: t.ativo,
      aliquotaImposto: Number(t.aliquotaImposto),
      aliquotaIpi: Number(t.aliquotaIpi),
      pisCofinsPercent: Number(t.pisCofinsPercent),
      comissaoPercent: Number(t.comissaoPercent),
      flagCredIcms: t.flagCredIcms,
      flagCredIpi: t.flagCredIpi,
      flagCredPisCofins: t.flagCredPisCofins,
      flagPapelImune: t.flagPapelImune,
      prazoFinanciamento: t.prazoFinanciamento,
    })
    setModalAberto(true)
  }

  async function salvar() {
    if (!form.nome.trim()) {
      notifications.show({ title: 'Atenção', message: 'Informe o nome da operação.', color: 'yellow' })
      return
    }
    setSalvando(true)
    try {
      if (editando) {
        await api.put(`/configurador-grafico/tributacao/${editando.id}`, form)
      } else {
        await api.post('/configurador-grafico/tributacao', form)
      }
      notifications.show({ title: 'Salvo', message: 'Tributação salva com sucesso.', color: 'green' })
      setModalAberto(false)
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao salvar.', color: 'red' })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Tributação</Title>
          <Text size="sm" c="dimmed">Tributação por operação (ICMS/IPI/PIS-COFINS, comissão, créditos, papel imune).</Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>Nova Operação</Button>
      </Group>

      {loading ? (
        <Center py="xl"><Loader /></Center>
      ) : (
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Operação</Table.Th>
                <Table.Th ta="right">ICMS %</Table.Th>
                <Table.Th ta="right">IPI %</Table.Th>
                <Table.Th ta="right">PIS/COFINS %</Table.Th>
                <Table.Th ta="right">Comissão %</Table.Th>
                <Table.Th>Créditos / Imune</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th ta="center">Ações</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {itens.map((t) => (
                <Table.Tr key={t.id}>
                  <Table.Td fw={500}>{t.nome}</Table.Td>
                  <Table.Td ta="right">{n(t.aliquotaImposto)}</Table.Td>
                  <Table.Td ta="right">{n(t.aliquotaIpi)}</Table.Td>
                  <Table.Td ta="right">{n(t.pisCofinsPercent)}</Table.Td>
                  <Table.Td ta="right">{n(t.comissaoPercent)}</Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {t.flagCredIcms && <Badge size="xs" variant="light">cr.ICMS</Badge>}
                      {t.flagCredIpi && <Badge size="xs" variant="light">cr.IPI</Badge>}
                      {t.flagCredPisCofins && <Badge size="xs" variant="light" color="teal">cr.PIS/COFINS</Badge>}
                      {t.flagPapelImune && <Badge size="xs" variant="light" color="grape">papel imune</Badge>}
                    </Group>
                  </Table.Td>
                  <Table.Td><Badge color={t.ativo ? 'green' : 'gray'}>{t.ativo ? 'Ativo' : 'Inativo'}</Badge></Table.Td>
                  <Table.Td ta="center">
                    <ActionIcon variant="subtle" onClick={() => abrirEdicao(t)}><IconEdit size={18} /></ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
              {itens.length === 0 && (
                <Table.Tr><Table.Td colSpan={8}><Text ta="center" c="dimmed" py="md">Nenhuma operação cadastrada</Text></Table.Td></Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}

      <Modal opened={modalAberto} onClose={() => setModalAberto(false)} title={editando ? 'Editar Tributação' : 'Nova Tributação'} size="md">
        <Stack gap="sm">
          <TextInput label="Nome da operação" placeholder="Ex.: ICMS + IPI" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.currentTarget.value })} required />
          <Group grow>
            <NumberInput label="ICMS %" value={form.aliquotaImposto} onChange={(v) => setForm({ ...form, aliquotaImposto: Number(v) || 0 })} min={0} max={100} decimalScale={2} />
            <NumberInput label="IPI %" value={form.aliquotaIpi} onChange={(v) => setForm({ ...form, aliquotaIpi: Number(v) || 0 })} min={0} max={100} decimalScale={2} />
          </Group>
          <Group grow>
            <NumberInput label="PIS/COFINS %" value={form.pisCofinsPercent} onChange={(v) => setForm({ ...form, pisCofinsPercent: Number(v) || 0 })} min={0} max={100} decimalScale={2} />
            <NumberInput label="Comissão %" value={form.comissaoPercent} onChange={(v) => setForm({ ...form, comissaoPercent: Number(v) || 0 })} min={0} max={100} decimalScale={2} />
          </Group>
          <NumberInput label="Prazo de financiamento (dias)" value={form.prazoFinanciamento} onChange={(v) => setForm({ ...form, prazoFinanciamento: Number(v) || 0 })} min={0} />
          <Switch label="Crédito de ICMS" checked={form.flagCredIcms} onChange={(e) => setForm({ ...form, flagCredIcms: e.currentTarget.checked })} />
          <Switch label="Crédito de IPI" checked={form.flagCredIpi} onChange={(e) => setForm({ ...form, flagCredIpi: e.currentTarget.checked })} />
          <Switch label="Crédito de PIS/COFINS (desconta do material direto)" checked={form.flagCredPisCofins} onChange={(e) => setForm({ ...form, flagCredPisCofins: e.currentTarget.checked })} />
          <Switch label="Papel imune" checked={form.flagPapelImune} onChange={(e) => setForm({ ...form, flagPapelImune: e.currentTarget.checked })} />
          <Switch label="Ativo" checked={form.ativo} onChange={(e) => setForm({ ...form, ativo: e.currentTarget.checked })} />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={salvar} loading={salvando}>Salvar</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
