'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Title, Stack, Table, Group, Button, Select, Text, Loader, Center, Tabs,
  Card, SimpleGrid, NumberInput, TextInput, Modal, ActionIcon, Badge, Progress,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { IconChartBar, IconUsers, IconHistory, IconPrinter, IconTarget, IconPlus, IconTrash, IconPencil } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { getAuthToken } from '@/lib/authStorage'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api'

// ─── Tipos ────────────────────────────────────────────────────────────────
interface CentroOpcao { id: string; descricao: string }
interface DashboardCentro {
  centroId: string; centroDescricao: string; base: string
  produzido: number; perda: number; retrabalho: number; paradaMinutos: number
  valorRs: number; metaQuantidade: number | null; metaValorRs: number | null
  percentualAtingido: number | null
  serieDiaria: { data: string; produzido: number; valorRs: number }[]
}
interface ProdLinha { chaveId: string; nome: string; meses: { mes: string; quantidade: number }[]; totalQuantidade: number }
interface HistItem {
  id: string; dataHora: string; centroDescricao: string | null; operadorId: string | null
  opNumero: number | null; referenciaExterna: string | null; tipo: string
  quantidade: number; motivo: string | null; observacao: string | null
}
interface Meta {
  id: string; centroProducaoId: string; metaQuantidadeDia: string; metaValorDia: string | null
  vigenciaInicio: string; vigenciaFim: string | null
}

const hoje = new Date()
const trintaDias = new Date(hoje.getTime() - 29 * 86400000)
function ymd(d: Date | null): string | undefined {
  if (!d) return undefined
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function brl(n: number) { return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function num(n: number) { return n.toLocaleString('pt-BR', { maximumFractionDigits: 2 }) }

export default function ApontamentosPage() {
  useEffect(() => { document.title = 'PCP - Apontamentos' }, [])
  const [aba, setAba] = useState<string | null>('dashboard')
  const [periodo, setPeriodo] = useState<[Date | null, Date | null]>([trintaDias, hoje])
  const [centros, setCentros] = useState<CentroOpcao[]>([])
  const [centroId, setCentroId] = useState<string | null>(null)

  const paramsPeriodo = useCallback(() => ({
    dataInicio: ymd(periodo[0]), dataFim: ymd(periodo[1]),
    ...(centroId ? { centroId } : {}),
  }), [periodo, centroId])

  // Centros ativos+disponíveis (backend já filtra via /quadro-producao? usamos cadastro)
  useEffect(() => {
    api.get('/centros-producao', { params: { limit: 100, status: 'true' } })
      .then(({ data }) => {
        const lista = (data?.data || data || [])
          .filter((c: any) => (c?.status === true || c?.status === 'true' || c?.status === undefined) && c?.disponivelProgramacao !== false)
          .map((c: any) => ({ id: c.id, descricao: c.descricao || c.codigo }))
        setCentros(lista)
      })
      .catch(() => setCentros([]))
  }, [])

  function abrirPdf(path: string) {
    const token = getAuthToken() || ''
    const p = paramsPeriodo()
    const qs = new URLSearchParams({ ...(p.dataInicio ? { dataInicio: p.dataInicio } : {}), ...(p.dataFim ? { dataFim: p.dataFim } : {}), ...(p.centroId ? { centroId: p.centroId } : {}), token })
    window.open(`${API_BASE}${path}?${qs.toString()}`, '_blank')
  }

  return (
    <Stack gap="md">
      <Title order={3}>Apontamentos de Produção</Title>

      <Group>
        <DatePickerInput
          type="range" label="Período" value={periodo} onChange={setPeriodo}
          valueFormat="DD/MM/YYYY" w={280}
        />
        <Select
          label="Centro" placeholder="Todos" clearable searchable
          data={centros.map((c) => ({ value: c.id, label: c.descricao }))}
          value={centroId} onChange={setCentroId} w={240}
        />
      </Group>

      <Tabs value={aba} onChange={setAba}>
        <Tabs.List>
          <Tabs.Tab value="dashboard" leftSection={<IconChartBar size={16} />}>Dashboard</Tabs.Tab>
          <Tabs.Tab value="produtividade" leftSection={<IconUsers size={16} />}>Produtividade</Tabs.Tab>
          <Tabs.Tab value="historico" leftSection={<IconHistory size={16} />}>Histórico</Tabs.Tab>
          <Tabs.Tab value="relatorios" leftSection={<IconPrinter size={16} />}>Relatórios</Tabs.Tab>
          <Tabs.Tab value="metas" leftSection={<IconTarget size={16} />}>Metas</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="dashboard" pt="md">
          <AbaDashboard params={paramsPeriodo} />
        </Tabs.Panel>
        <Tabs.Panel value="produtividade" pt="md">
          <AbaProdutividade params={paramsPeriodo} />
        </Tabs.Panel>
        <Tabs.Panel value="historico" pt="md">
          <AbaHistorico params={paramsPeriodo} />
        </Tabs.Panel>
        <Tabs.Panel value="relatorios" pt="md">
          <Stack>
            <Text c="dimmed">Gere relatórios do período selecionado em PDF para impressão.</Text>
            <Group>
              <Button leftSection={<IconPrinter size={16} />} onClick={() => abrirPdf('/pcp/apontamentos-bi/relatorio-diario.pdf')}>
                Relatório de Produção Diária (PDF)
              </Button>
              <Button variant="light" leftSection={<IconPrinter size={16} />} onClick={() => abrirPdf('/pcp/apontamentos-bi/dashboard.pdf')}>
                Totais por Centro (PDF)
              </Button>
            </Group>
          </Stack>
        </Tabs.Panel>
        <Tabs.Panel value="metas" pt="md">
          <AbaMetas centros={centros} />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}

// ─── Aba Dashboard ──────────────────────────────────────────────────────────
function AbaDashboard({ params }: { params: () => Record<string, string | undefined> }) {
  const [dados, setDados] = useState<DashboardCentro[]>([])
  const [loading, setLoading] = useState(true)
  const p = params()
  useEffect(() => {
    setLoading(true)
    api.get('/pcp/apontamentos-bi/dashboard', { params: p })
      .then((r) => setDados(r.data))
      .catch(() => setDados([]))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(p)])

  if (loading) return <Center py="xl"><Loader /></Center>
  if (dados.length === 0) return <Text c="dimmed" ta="center" py="xl">Nenhum apontamento no período.</Text>

  const totalProd = dados.reduce((s, c) => s + c.produzido, 0)
  const totalRs = dados.reduce((s, c) => s + c.valorRs, 0)
  const totalPerda = dados.reduce((s, c) => s + c.perda, 0)

  return (
    <Stack>
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Card withBorder><Text size="sm" c="dimmed">Produção total</Text><Text fw={700} size="xl">{num(totalProd)}</Text></Card>
        <Card withBorder><Text size="sm" c="dimmed">Valor total</Text><Text fw={700} size="xl">{brl(totalRs)}</Text></Card>
        <Card withBorder><Text size="sm" c="dimmed">Perdas</Text><Text fw={700} size="xl" c="red">{num(totalPerda)}</Text></Card>
      </SimpleGrid>

      <Table striped highlightOnHover withTableBorder>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Centro</Table.Th>
            <Table.Th>Base</Table.Th>
            <Table.Th ta="right">Produzido</Table.Th>
            <Table.Th ta="right">Perda</Table.Th>
            <Table.Th ta="right">Parada (min)</Table.Th>
            <Table.Th ta="right">Valor R$</Table.Th>
            <Table.Th>Meta</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {dados.map((c) => (
            <Table.Tr key={c.centroId}>
              <Table.Td fw={600}>{c.centroDescricao}</Table.Td>
              <Table.Td><Badge variant="light" color={c.base === 'UNIDADE' ? 'grape' : 'blue'}>{c.base === 'UNIDADE' ? 'Peças' : 'Folhas'}</Badge></Table.Td>
              <Table.Td ta="right">{num(c.produzido)}</Table.Td>
              <Table.Td ta="right" c={c.perda > 0 ? 'red' : undefined}>{num(c.perda)}</Table.Td>
              <Table.Td ta="right">{num(c.paradaMinutos)}</Table.Td>
              <Table.Td ta="right">{brl(c.valorRs)}</Table.Td>
              <Table.Td>
                {c.percentualAtingido != null ? (
                  <Group gap={6} wrap="nowrap">
                    <Progress value={Math.min(c.percentualAtingido, 100)} w={70} color={c.percentualAtingido >= 100 ? 'green' : 'orange'} />
                    <Text size="xs">{num(c.percentualAtingido)}%</Text>
                  </Group>
                ) : <Text size="xs" c="dimmed">—</Text>}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  )
}

// ─── Aba Produtividade ────────────────────────────────────────────────────
interface ProdOperadorMaquina {
  operadorId: string
  operadorNome: string
  totalQuantidade: number
  maquinas: { centroId: string; centroDescricao: string; quantidade: number }[]
}

function AbaProdutividade({ params }: { params: () => Record<string, string | undefined> }) {
  const [por, setPor] = useState<'operador' | 'maquina' | 'operador-maquina'>('operador')
  const [linhas, setLinhas] = useState<ProdLinha[]>([])
  const [opMaq, setOpMaq] = useState<ProdOperadorMaquina[]>([])
  const [loading, setLoading] = useState(true)
  const p = params()
  useEffect(() => {
    setLoading(true)
    api.get('/pcp/apontamentos-bi/produtividade', { params: { ...p, por } })
      .then((r) => {
        if (por === 'operador-maquina') { setOpMaq(r.data); setLinhas([]) }
        else { setLinhas(r.data); setOpMaq([]) }
      })
      .catch(() => { setLinhas([]); setOpMaq([]) })
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(p), por])

  const meses = [...new Set(linhas.flatMap((l) => l.meses.map((m) => m.mes)))].sort()

  return (
    <Stack>
      <Select
        label="Agrupar por" w={220} value={por}
        onChange={(v) => setPor((v as 'operador' | 'maquina' | 'operador-maquina') || 'operador')}
        data={[
          { value: 'operador', label: 'Operador' },
          { value: 'maquina', label: 'Máquina' },
          { value: 'operador-maquina', label: 'Operador × Máquina' },
        ]}
      />
      {loading ? <Center py="xl"><Loader /></Center> : por === 'operador-maquina' ? (
        opMaq.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">Sem dados no período.</Text>
        ) : (
          <Stack gap="md">
            {opMaq.map((op) => (
              <Card key={op.operadorId} withBorder>
                <Group justify="space-between" mb="xs">
                  <Text fw={700}>{op.operadorNome}</Text>
                  <Badge variant="light">Total: {num(op.totalQuantidade)}</Badge>
                </Group>
                <Table withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Máquina</Table.Th>
                      <Table.Th ta="right">Produzido</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {op.maquinas.map((m) => (
                      <Table.Tr key={m.centroId}>
                        <Table.Td>{m.centroDescricao}</Table.Td>
                        <Table.Td ta="right">{num(m.quantidade)}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Card>
            ))}
          </Stack>
        )
      ) : linhas.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">Sem dados no período.</Text>
      ) : (
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>{por === 'operador' ? 'Operador' : 'Máquina'}</Table.Th>
              {meses.map((m) => <Table.Th key={m} ta="right">{m}</Table.Th>)}
              <Table.Th ta="right">Total</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {linhas.map((l) => (
              <Table.Tr key={l.chaveId}>
                <Table.Td fw={600}>{l.nome}</Table.Td>
                {meses.map((m) => {
                  const v = l.meses.find((x) => x.mes === m)
                  return <Table.Td key={m} ta="right">{v ? num(v.quantidade) : '—'}</Table.Td>
                })}
                <Table.Td ta="right" fw={700}>{num(l.totalQuantidade)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  )
}

// ─── Aba Histórico ──────────────────────────────────────────────────────────
function AbaHistorico({ params }: { params: () => Record<string, string | undefined> }) {
  const [itens, setItens] = useState<HistItem[]>([])
  const [loading, setLoading] = useState(true)
  const [tipo, setTipo] = useState<string | null>(null)
  const p = params()
  useEffect(() => {
    setLoading(true)
    api.get('/pcp/apontamentos-bi/historico', { params: { ...p, ...(tipo ? { tipo } : {}), pageSize: 200 } })
      .then((r) => setItens(r.data.itens))
      .catch(() => setItens([]))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(p), tipo])

  return (
    <Stack>
      <Select
        label="Tipo" w={200} clearable placeholder="Todos" value={tipo} onChange={setTipo}
        data={[{ value: 'PRODUCAO', label: 'Produção' }, { value: 'PERDA', label: 'Perda' }, { value: 'PARADA', label: 'Parada' }, { value: 'RETOMADA', label: 'Retomada' }]}
      />
      {loading ? <Center py="xl"><Loader /></Center> : itens.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">Nenhum apontamento no período.</Text>
      ) : (
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Data/Hora</Table.Th>
              <Table.Th>Centro</Table.Th>
              <Table.Th>OP</Table.Th>
              <Table.Th>Tipo</Table.Th>
              <Table.Th ta="right">Qtd</Table.Th>
              <Table.Th>Motivo/Obs</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {itens.map((it) => (
              <Table.Tr key={it.id}>
                <Table.Td>{new Date(it.dataHora).toLocaleString('pt-BR')}</Table.Td>
                <Table.Td>{it.centroDescricao ?? '—'}</Table.Td>
                <Table.Td>{it.referenciaExterna || (it.opNumero ? `#${it.opNumero}` : '—')}</Table.Td>
                <Table.Td><Badge variant="light" color={it.tipo === 'PERDA' ? 'red' : it.tipo === 'PARADA' ? 'orange' : 'green'}>{it.tipo}</Badge></Table.Td>
                <Table.Td ta="right">{num(it.quantidade)}</Table.Td>
                <Table.Td>{it.observacao || it.motivo || '—'}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  )
}

// ─── Aba Metas ──────────────────────────────────────────────────────────────
function AbaMetas({ centros }: { centros: CentroOpcao[] }) {
  const [metas, setMetas] = useState<Meta[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState<{ centroProducaoId: string | null; metaQuantidadeDia: number | string; metaValorDia: number | string; vigenciaInicio: Date | null; vigenciaFim: Date | null }>(
    { centroProducaoId: null, metaQuantidadeDia: 0, metaValorDia: '', vigenciaInicio: new Date(), vigenciaFim: null },
  )

  const carregar = useCallback(() => {
    setLoading(true)
    api.get('/pcp/apontamentos-bi/metas').then((r) => setMetas(r.data)).catch(() => setMetas([])).finally(() => setLoading(false))
  }, [])
  useEffect(() => { carregar() }, [carregar])

  const centroNome = (id: string) => centros.find((c) => c.id === id)?.descricao ?? id

  async function salvar() {
    const body = {
      centroProducaoId: form.centroProducaoId,
      metaQuantidadeDia: Number(form.metaQuantidadeDia),
      metaValorDia: form.metaValorDia === '' ? null : Number(form.metaValorDia),
      vigenciaInicio: ymd(form.vigenciaInicio),
      vigenciaFim: ymd(form.vigenciaFim),
    }
    if (editId) await api.put(`/pcp/apontamentos-bi/metas/${editId}`, body)
    else await api.post('/pcp/apontamentos-bi/metas', body)
    setModal(false); setEditId(null); carregar()
  }

  function abrirNova() {
    setEditId(null)
    setForm({ centroProducaoId: null, metaQuantidadeDia: 0, metaValorDia: '', vigenciaInicio: new Date(), vigenciaFim: null })
    setModal(true)
  }
  function abrirEdicao(m: Meta) {
    setEditId(m.id)
    setForm({
      centroProducaoId: m.centroProducaoId,
      metaQuantidadeDia: Number(m.metaQuantidadeDia),
      metaValorDia: m.metaValorDia != null ? Number(m.metaValorDia) : '',
      vigenciaInicio: new Date(m.vigenciaInicio),
      vigenciaFim: m.vigenciaFim ? new Date(m.vigenciaFim) : null,
    })
    setModal(true)
  }
  async function remover(id: string) {
    await api.delete(`/pcp/apontamentos-bi/metas/${id}`); carregar()
  }

  return (
    <Stack>
      <Group justify="space-between">
        <Text c="dimmed">Metas de produção por centro (quantidade/dia e opcionalmente R$/dia).</Text>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNova}>Nova Meta</Button>
      </Group>
      {loading ? <Center py="xl"><Loader /></Center> : metas.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">Nenhuma meta cadastrada.</Text>
      ) : (
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Centro</Table.Th>
              <Table.Th ta="right">Meta Qtd/dia</Table.Th>
              <Table.Th ta="right">Meta R$/dia</Table.Th>
              <Table.Th>Vigência</Table.Th>
              <Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {metas.map((m) => (
              <Table.Tr key={m.id}>
                <Table.Td fw={600}>{centroNome(m.centroProducaoId)}</Table.Td>
                <Table.Td ta="right">{num(Number(m.metaQuantidadeDia))}</Table.Td>
                <Table.Td ta="right">{m.metaValorDia != null ? brl(Number(m.metaValorDia)) : '—'}</Table.Td>
                <Table.Td>{new Date(m.vigenciaInicio).toLocaleDateString('pt-BR')}{m.vigenciaFim ? ` a ${new Date(m.vigenciaFim).toLocaleDateString('pt-BR')}` : ' (indefinida)'}</Table.Td>
                <Table.Td>
                  <Group gap={4} justify="flex-end">
                    <ActionIcon variant="subtle" onClick={() => abrirEdicao(m)}><IconPencil size={16} /></ActionIcon>
                    <ActionIcon variant="subtle" color="red" onClick={() => remover(m.id)}><IconTrash size={16} /></ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={modal} onClose={() => setModal(false)} title={editId ? 'Editar Meta' : 'Nova Meta'}>
        <Stack>
          <Select
            label="Centro" required searchable data={centros.map((c) => ({ value: c.id, label: c.descricao }))}
            value={form.centroProducaoId} onChange={(v) => setForm((f) => ({ ...f, centroProducaoId: v }))}
          />
          <NumberInput label="Meta de quantidade/dia" required min={0} value={form.metaQuantidadeDia}
            onChange={(v) => setForm((f) => ({ ...f, metaQuantidadeDia: v }))} />
          <NumberInput label="Meta de valor R$/dia (opcional)" min={0} value={form.metaValorDia}
            onChange={(v) => setForm((f) => ({ ...f, metaValorDia: v }))} />
          <DatePickerInput label="Vigência início" required value={form.vigenciaInicio}
            onChange={(v) => setForm((f) => ({ ...f, vigenciaInicio: v }))} valueFormat="DD/MM/YYYY" />
          <DatePickerInput label="Vigência fim (opcional)" clearable value={form.vigenciaFim}
            onChange={(v) => setForm((f) => ({ ...f, vigenciaFim: v }))} valueFormat="DD/MM/YYYY" />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setModal(false)}>Cancelar</Button>
            <Button onClick={salvar} disabled={!form.centroProducaoId || !form.metaQuantidadeDia}>Salvar</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
