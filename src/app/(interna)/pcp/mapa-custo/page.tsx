'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Title, Stack, Table, Group, Button, Badge, Text, Loader, Center,
  Modal, TextInput, NumberInput, ActionIcon,
} from '@mantine/core'
import { IconPlus, IconEye, IconCopy } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

/**
 * Mapa de Custos RKW — lista de mapas por competência.
 * Spec: VisioFab.Wms.Back/.kiro/specs/mapa-custos-rkw
 */
interface MapaCusto {
  id: string
  competencia: string
  descricao: string | null
  status: 'RASCUNHO' | 'FECHADO'
  custoFixoTotal: string | null
  taxaAdministrativa: string | null
}

export default function MapaCustoListaPage() {
  useEffect(() => { document.title = 'PCP - Mapa de Custos' }, [])
  const router = useRouter()

  const [data, setData] = useState<MapaCusto[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [form, setForm] = useState({
    competencia: '',
    descricao: '',
    percEncargos: 60,
    horasProdutivasBase: 150,
    ajustePraticarPerc: 24,
  })

  async function carregar() {
    setLoading(true)
    try {
      const res = await api.get('/pcp/mapa-custo')
      setData(Array.isArray(res.data) ? res.data : [])
    } catch {
      /* silencioso */
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar() }, [])

  async function criar() {
    if (!/^\d{4}-\d{2}$/.test(form.competencia)) {
      notifications.show({ title: 'Competência inválida', message: 'Use o formato AAAA-MM (ex.: 2026-01).', color: 'red' })
      return
    }
    setSalvando(true)
    try {
      const res = await api.post('/pcp/mapa-custo', form)
      notifications.show({ title: 'Mapa criado', message: `Competência ${form.competencia}`, color: 'green' })
      setModalAberto(false)
      router.push(`/pcp/mapa-custo/${res.data.id}`)
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao criar', color: 'red' })
    } finally {
      setSalvando(false)
    }
  }

  async function duplicar(mapa: MapaCusto) {
    const competencia = window.prompt(`Duplicar o mapa ${mapa.competencia} para qual competência? (AAAA-MM)`)
    if (!competencia) return
    if (!/^\d{4}-\d{2}$/.test(competencia)) {
      notifications.show({ title: 'Competência inválida', message: 'Use AAAA-MM.', color: 'red' })
      return
    }
    try {
      const res = await api.post(`/pcp/mapa-custo/${mapa.id}/duplicar`, { competencia })
      notifications.show({ title: 'Mapa duplicado', message: `Nova competência ${competencia}`, color: 'green' })
      router.push(`/pcp/mapa-custo/${res.data.id}`)
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao duplicar', color: 'red' })
    }
  }

  const fmtMoeda = (v: string | null) =>
    v == null ? '—' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Mapa de Custos (RKW)</Title>
          <Text size="sm" c="dimmed">
            Custeio por centro pela metodologia RKW. Uma foto por competência (mês).
            O custo/hora calculado alimenta o Orçamento Gráfico.
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setModalAberto(true)}>Novo Mapa</Button>
      </Group>

      {loading ? (
        <Center py="xl"><Loader /></Center>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Competência</Table.Th>
              <Table.Th>Descrição</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Custo Fixo Total</Table.Th>
              <Table.Th>Taxa Adm.</Table.Th>
              <Table.Th></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.map((m) => (
              <Table.Tr key={m.id} style={{ cursor: 'pointer' }}>
                <Table.Td fw={600} onClick={() => router.push(`/pcp/mapa-custo/${m.id}`)}>{m.competencia}</Table.Td>
                <Table.Td onClick={() => router.push(`/pcp/mapa-custo/${m.id}`)}>{m.descricao || '—'}</Table.Td>
                <Table.Td>
                  <Badge color={m.status === 'FECHADO' ? 'gray' : 'green'}>
                    {m.status === 'FECHADO' ? 'Fechado' : 'Rascunho'}
                  </Badge>
                </Table.Td>
                <Table.Td>{fmtMoeda(m.custoFixoTotal)}</Table.Td>
                <Table.Td>{m.taxaAdministrativa == null ? '—' : `${Number(m.taxaAdministrativa).toFixed(1)}%`}</Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <ActionIcon variant="subtle" title="Abrir" onClick={() => router.push(`/pcp/mapa-custo/${m.id}`)}><IconEye size={16} /></ActionIcon>
                    <ActionIcon variant="subtle" title="Duplicar" onClick={() => duplicar(m)}><IconCopy size={16} /></ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {data.length === 0 && (
              <Table.Tr><Table.Td colSpan={6}><Text ta="center" c="dimmed" py="md">Nenhum mapa de custos cadastrado</Text></Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={modalAberto} onClose={() => setModalAberto(false)} title="Novo Mapa de Custos" centered>
        <Stack gap="md">
          <TextInput
            label="Competência (AAAA-MM)"
            placeholder="2026-01"
            value={form.competencia}
            onChange={(e) => setForm({ ...form, competencia: e.currentTarget.value })}
            required
          />
          <TextInput
            label="Descrição (opcional)"
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.currentTarget.value })}
          />
          <Group grow>
            <NumberInput label="Encargos (%)" value={form.percEncargos} onChange={(v) => setForm({ ...form, percEncargos: Number(v) || 0 })} min={0} max={100} />
            <NumberInput label="Horas base/mês" value={form.horasProdutivasBase} onChange={(v) => setForm({ ...form, horasProdutivasBase: Number(v) || 0 })} min={0} />
            <NumberInput label="Ajuste a Praticar (%)" value={form.ajustePraticarPerc} onChange={(v) => setForm({ ...form, ajustePraticarPerc: Number(v) || 0 })} min={0} />
          </Group>
          <Button onClick={criar} fullWidth loading={salvando}>Criar</Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
