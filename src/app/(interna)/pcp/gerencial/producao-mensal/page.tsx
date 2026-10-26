'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Title, Stack, Group, Select, NumberInput, Button, Tabs, Card, SimpleGrid,
  Text, Table, Loader, Center, Badge, Progress,
} from '@mantine/core'
import { IconChartBar, IconCalendar, IconUsers, IconAlertTriangle, IconPrinter, IconClipboardList, IconTable } from '@tabler/icons-react'
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line, ReferenceLine,
} from 'recharts'
import { api } from '@/lib/api'
import { getAuthToken } from '@/lib/authStorage'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api'
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const MES_ABREV = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const hoje = new Date()

function num(n: number) { return Number(n || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 }) }
function brl(n: number) { return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function diaCurto(d: string) { const p = d.split('-'); return `${p[2]}/${p[1]}` }

interface ResumoProc { tipoProcessoId: string | null; tipoProcessoCodigo: string | null; base: string; produzido: number; valorRs: number; metaQuantidade: number | null; percentualAtingido: number | null }
interface SerieDia { data: string; produzido: number; valorRs: number }
interface Diaria { serie: SerieDia[]; pico: SerieDia | null; segundoMaior: SerieDia | null; terceiroMaior: SerieDia | null; mediaDiaria: number; menorDia: SerieDia | null }
interface ParetoItem { codigo: string; descricao: string; minutos: number; ocorrencias: number }
interface ProdLinha { chaveId: string; nome: string; meses: { mes: string; quantidade: number }[]; totalQuantidade: number }
interface OpsAno { ano: number; meses: number[] }
interface TipoProcesso { id: string; codigo: string; descricao: string }
interface DadosCentro { centros: { id: string; descricao: string }[]; dias: { data: string; porCentro: Record<string, number>; total: number }[]; metaQuantidade: number | null }

export default function RelatorioProducaoMensalPage() {
  useEffect(() => { document.title = 'PCP - Relatório Mensal de Produção' }, [])
  const [ano, setAno] = useState(hoje.getFullYear())
  const [mes, setMes] = useState(hoje.getMonth() + 1)
  const [loading, setLoading] = useState(true)
  const [resumo, setResumo] = useState<ResumoProc[]>([])
  const [diaria, setDiaria] = useState<Diaria | null>(null)
  const [pareto, setPareto] = useState<ParetoItem[]>([])

  const carregar = useCallback(() => {
    setLoading(true)
    api.get('/pcp/gerencial/producao-mensal', { params: { ano, mes } })
      .then(({ data }) => { setResumo(data.resumo || []); setDiaria(data.diaria || null); setPareto(data.pareto || []) })
      .catch(() => { setResumo([]); setDiaria(null); setPareto([]) })
      .finally(() => setLoading(false))
  }, [ano, mes])
  useEffect(() => { carregar() }, [carregar])

  function abrirPdf() {
    const token = getAuthToken() || ''
    const qs = new URLSearchParams({ ano: String(ano), mes: String(mes), token })
    window.open(`${API_BASE}/pcp/gerencial/producao-mensal.pdf?${qs.toString()}`, '_blank')
  }

  const totalProd = resumo.reduce((s, r) => s + r.produzido, 0)
  const totalRs = resumo.reduce((s, r) => s + r.valorRs, 0)
  const periodo = { dataInicio: `${ano}-${String(mes).padStart(2, '0')}-01`, dataFim: `${ano}-${String(mes).padStart(2, '0')}-${new Date(ano, mes, 0).getDate()}` }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={3}>Relatório Mensal de Produção</Title>
        <Button leftSection={<IconPrinter size={16} />} onClick={abrirPdf}>Imprimir (PDF)</Button>
      </Group>

      <Group>
        <Select label="Mês" w={160} value={String(mes)} onChange={(v) => setMes(Number(v))}
          data={MESES.map((m, i) => ({ value: String(i + 1), label: m }))} />
        <NumberInput label="Ano" w={120} value={ano} onChange={(v) => setAno(Number(v) || hoje.getFullYear())} min={2000} max={2100} />
      </Group>

      {loading ? <Center py="xl"><Loader /></Center> : (
        <Tabs defaultValue="resumo">
          <Tabs.List>
            <Tabs.Tab value="resumo" leftSection={<IconChartBar size={16} />}>Resumo</Tabs.Tab>
            <Tabs.Tab value="diaria" leftSection={<IconCalendar size={16} />}>Produção Diária</Tabs.Tab>
            <Tabs.Tab value="metas" leftSection={<IconChartBar size={16} />}>Metas por Processo</Tabs.Tab>
            <Tabs.Tab value="centro" leftSection={<IconTable size={16} />}>Dados por Centro</Tabs.Tab>
            <Tabs.Tab value="produtividade" leftSection={<IconUsers size={16} />}>Produtividade</Tabs.Tab>
            <Tabs.Tab value="ops" leftSection={<IconClipboardList size={16} />}>OPs Emitidas</Tabs.Tab>
            <Tabs.Tab value="pareto" leftSection={<IconAlertTriangle size={16} />}>Pareto</Tabs.Tab>
            <Tabs.Tab value="trabalhos" leftSection={<IconClipboardList size={16} />}>Trabalhos em Máquina</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="resumo" pt="md">
            <Stack>
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <Card withBorder><Text size="sm" c="dimmed">Produção total ({MESES[mes - 1]}/{ano})</Text><Text fw={700} size="xl">{num(totalProd)}</Text></Card>
                <Card withBorder><Text size="sm" c="dimmed">Valor total (custo)</Text><Text fw={700} size="xl">{brl(totalRs)}</Text></Card>
              </SimpleGrid>
              {resumo.length === 0 ? <Text c="dimmed" ta="center" py="md">Sem produção no mês.</Text> : (
                <>
                  <Card withBorder h={300}>
                    <Text size="sm" fw={600} mb="xs">Produção por processo</Text>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={resumo.map((r) => ({ nome: r.tipoProcessoCodigo ?? '—', Produzido: r.produzido }))}>
                        <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="nome" fontSize={11} /><YAxis fontSize={11} /><Tooltip formatter={(v: number) => num(v)} /><Bar dataKey="Produzido" fill="#1f3d5a" />
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>
                  <Table striped withTableBorder>
                    <Table.Thead><Table.Tr>
                      <Table.Th>Processo</Table.Th><Table.Th>Base</Table.Th>
                      <Table.Th ta="right">Produzido</Table.Th><Table.Th ta="right">Valor R$</Table.Th><Table.Th>Meta</Table.Th>
                    </Table.Tr></Table.Thead>
                    <Table.Tbody>
                      {resumo.map((r) => (
                        <Table.Tr key={r.tipoProcessoCodigo}>
                          <Table.Td fw={600}>{r.tipoProcessoCodigo ?? '—'}</Table.Td>
                          <Table.Td><Badge variant="light" color={r.base === 'UNIDADE' ? 'grape' : 'blue'}>{r.base === 'UNIDADE' ? 'Peças' : 'Folhas'}</Badge></Table.Td>
                          <Table.Td ta="right">{num(r.produzido)}</Table.Td>
                          <Table.Td ta="right">{brl(r.valorRs)}</Table.Td>
                          <Table.Td>{r.percentualAtingido != null ? (
                            <Group gap={6} wrap="nowrap"><Progress value={Math.min(r.percentualAtingido, 100)} w={70} color={r.percentualAtingido >= 100 ? 'green' : 'orange'} /><Text size="xs">{num(r.percentualAtingido)}%</Text></Group>
                          ) : <Text size="xs" c="dimmed">—</Text>}</Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </>
              )}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="diaria" pt="md">
            {!diaria || diaria.serie.length === 0 ? <Text c="dimmed" ta="center" py="md">Sem produção no mês.</Text> : (
              <Stack>
                <SimpleGrid cols={{ base: 1, sm: 4 }}>
                  <Card withBorder><Text size="xs" c="dimmed">Pico</Text><Text fw={700}>{num(diaria.pico?.produzido || 0)}</Text><Text size="xs">{diaria.pico?.data}</Text></Card>
                  <Card withBorder><Text size="xs" c="dimmed">2º maior</Text><Text fw={700}>{num(diaria.segundoMaior?.produzido || 0)}</Text><Text size="xs">{diaria.segundoMaior?.data}</Text></Card>
                  <Card withBorder><Text size="xs" c="dimmed">Média diária</Text><Text fw={700}>{num(diaria.mediaDiaria)}</Text></Card>
                  <Card withBorder><Text size="xs" c="dimmed">Menor dia</Text><Text fw={700}>{num(diaria.menorDia?.produzido || 0)}</Text><Text size="xs">{diaria.menorDia?.data}</Text></Card>
                </SimpleGrid>
                <Card withBorder h={320}>
                  <Text size="sm" fw={600} mb="xs">Produção diária consolidada</Text>
                  <ResponsiveContainer width="100%" height={270}>
                    <LineChart data={diaria.serie.map((d) => ({ dia: diaCurto(d.data), Produção: d.produzido }))}>
                      <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="dia" fontSize={10} /><YAxis fontSize={10} /><Tooltip formatter={(v: number) => num(v)} />
                      <ReferenceLine y={diaria.mediaDiaria} stroke="#2e8b57" strokeDasharray="4 4" label={{ value: 'média', fontSize: 10 }} />
                      <Line type="monotone" dataKey="Produção" stroke="#1f6feb" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </Stack>
            )}
          </Tabs.Panel>

          <Tabs.Panel value="metas" pt="md">
            <MetasProcessoAba ano={ano} mes={mes} resumo={resumo} />
          </Tabs.Panel>

          <Tabs.Panel value="centro" pt="md">
            <DadosPorCentroAba ano={ano} mes={mes} />
          </Tabs.Panel>

          <Tabs.Panel value="produtividade" pt="md">
            <ProdutividadeAba periodo={periodo} />
          </Tabs.Panel>

          <Tabs.Panel value="ops" pt="md">
            <OpsEmitidasAba ano={ano} />
          </Tabs.Panel>

          <Tabs.Panel value="trabalhos" pt="md">
            <TrabalhosEmMaquinaAba ano={ano} mes={mes} pico={diaria?.pico ?? null} />
          </Tabs.Panel>

          <Tabs.Panel value="pareto" pt="md">
            {pareto.length === 0 ? <Text c="dimmed" ta="center" py="md">Sem paradas no mês.</Text> : (
              <Stack>
                <Card withBorder h={300}>
                  <Text size="sm" fw={600} mb="xs">Tempo de parada por motivo (minutos)</Text>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={pareto.slice(0, 10).map((p) => ({ nome: p.codigo, Minutos: p.minutos }))}>
                      <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="nome" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Bar dataKey="Minutos" fill="#2e8b57" />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
                <Table striped withTableBorder>
                  <Table.Thead><Table.Tr><Table.Th>Código</Table.Th><Table.Th>Descrição</Table.Th><Table.Th ta="right">Minutos</Table.Th><Table.Th ta="right">Ocorrências</Table.Th></Table.Tr></Table.Thead>
                  <Table.Tbody>
                    {pareto.map((p) => (<Table.Tr key={`${p.codigo}-${p.descricao}`}><Table.Td fw={600}>{p.codigo}</Table.Td><Table.Td>{p.descricao}</Table.Td><Table.Td ta="right" fw={600}>{p.minutos.toLocaleString('pt-BR')}</Table.Td><Table.Td ta="right">{p.ocorrencias}</Table.Td></Table.Tr>))}
                  </Table.Tbody>
                </Table>
              </Stack>
            )}
          </Tabs.Panel>
        </Tabs>
      )}
    </Stack>
  )
}

// ─── Aba Metas por Processo (série diária + linha de meta) ──────────────────
function MetasProcessoAba({ ano, mes, resumo }: { ano: number; mes: number; resumo: ResumoProc[] }) {
  const [tpId, setTpId] = useState<string | null>(null)
  const [dados, setDados] = useState<DadosCentro | null>(null)
  const [loading, setLoading] = useState(false)
  const processos = resumo.filter((r) => r.tipoProcessoId).map((r) => ({ value: r.tipoProcessoId as string, label: r.tipoProcessoCodigo ?? '' }))

  useEffect(() => { if (!tpId && processos.length) setTpId(processos[0].value) }, [processos, tpId])
  useEffect(() => {
    if (!tpId) return
    setLoading(true)
    api.get('/pcp/gerencial/dados-por-centro', { params: { ano, mes, tipoProcessoId: tpId } })
      .then(({ data }) => setDados(data)).catch(() => setDados(null)).finally(() => setLoading(false))
  }, [tpId, ano, mes])

  const serie = (dados?.dias || []).map((d) => ({ dia: diaCurto(d.data), Produção: d.total }))
  const meta = dados?.metaQuantidade ?? null
  const media = serie.length ? Math.round(serie.reduce((s, d) => s + d.Produção, 0) / serie.length) : 0

  return (
    <Stack>
      <Select label="Processo" w={240} data={processos} value={tpId} onChange={setTpId} />
      {loading ? <Center py="xl"><Loader /></Center> : !dados || serie.length === 0 ? <Text c="dimmed" ta="center" py="md">Sem dados.</Text> : (
        <Card withBorder h={340}>
          <Text size="sm" fw={600} mb="xs">Produção diária x Meta {meta ? `(meta ${num(meta)}/dia)` : '(sem meta cadastrada)'}</Text>
          <ResponsiveContainer width="100%" height={290}>
            <LineChart data={serie}>
              <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="dia" fontSize={10} /><YAxis fontSize={10} /><Tooltip formatter={(v: number) => num(v)} /><Legend />
              {meta ? <ReferenceLine y={meta} stroke="#d62728" strokeWidth={2} label={{ value: 'Meta', fontSize: 10 }} /> : null}
              <ReferenceLine y={media} stroke="#2e8b57" strokeDasharray="4 4" label={{ value: 'Média', fontSize: 10 }} />
              <Line type="monotone" dataKey="Produção" stroke="#1f6feb" strokeWidth={2} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      )}
    </Stack>
  )
}

// ─── Aba Dados por Centro (matriz data × centro) ────────────────────────────
function DadosPorCentroAba({ ano, mes }: { ano: number; mes: number }) {
  const [processos, setProcessos] = useState<TipoProcesso[]>([])
  const [tpId, setTpId] = useState<string | null>(null)
  const [dados, setDados] = useState<DadosCentro | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    api.get('/tipos-processo').then(({ data }) => {
      const lista = (data?.data || data || []).map((t: any) => ({ id: t.id, codigo: t.codigo, descricao: t.descricao }))
      setProcessos(lista); if (lista.length) setTpId(lista[0].id)
    }).catch(() => setProcessos([]))
  }, [])
  useEffect(() => {
    if (!tpId) return
    setLoading(true)
    api.get('/pcp/gerencial/dados-por-centro', { params: { ano, mes, tipoProcessoId: tpId } })
      .then(({ data }) => setDados(data)).catch(() => setDados(null)).finally(() => setLoading(false))
  }, [tpId, ano, mes])

  return (
    <Stack>
      <Select label="Processo" w={240} data={processos.map((p) => ({ value: p.id, label: p.descricao }))} value={tpId} onChange={setTpId} />
      {loading ? <Center py="xl"><Loader /></Center> : !dados || dados.dias.length === 0 ? <Text c="dimmed" ta="center" py="md">Sem dados.</Text> : (
        <Table striped withTableBorder>
          <Table.Thead><Table.Tr>
            <Table.Th>Data</Table.Th>
            {dados.centros.map((c) => <Table.Th key={c.id} ta="right">{c.descricao}</Table.Th>)}
            <Table.Th ta="right">Total</Table.Th>
            <Table.Th ta="right">Meta</Table.Th>
          </Table.Tr></Table.Thead>
          <Table.Tbody>
            {dados.dias.map((d) => (
              <Table.Tr key={d.data}>
                <Table.Td>{diaCurto(d.data)}</Table.Td>
                {dados.centros.map((c) => <Table.Td key={c.id} ta="right">{d.porCentro[c.id] ? num(d.porCentro[c.id]) : '—'}</Table.Td>)}
                <Table.Td ta="right" fw={700}>{num(d.total)}</Table.Td>
                <Table.Td ta="right" c={dados.metaQuantidade && d.total >= dados.metaQuantidade ? 'green' : undefined}>{dados.metaQuantidade ? num(dados.metaQuantidade) : '—'}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  )
}

// ─── Aba Produtividade (operador/máquina por mês) ───────────────────────────
function ProdutividadeAba({ periodo }: { periodo: { dataInicio: string; dataFim: string } }) {
  const [por, setPor] = useState<'operador' | 'maquina'>('maquina')
  const [linhas, setLinhas] = useState<ProdLinha[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    setLoading(true)
    api.get('/pcp/gerencial/produtividade', { params: { ...periodo, por } })
      .then(({ data }) => setLinhas(data)).catch(() => setLinhas([])).finally(() => setLoading(false))
  }, [periodo, por])
  const meses = [...new Set(linhas.flatMap((l) => l.meses.map((m) => m.mes)))].sort()

  return (
    <Stack>
      <Select label="Agrupar por" w={200} value={por} onChange={(v) => setPor((v as 'operador' | 'maquina') || 'maquina')}
        data={[{ value: 'maquina', label: 'Máquina' }, { value: 'operador', label: 'Operador' }]} />
      {loading ? <Center py="xl"><Loader /></Center> : linhas.length === 0 ? <Text c="dimmed" ta="center" py="md">Sem dados.</Text> : (
        <>
          <Card withBorder h={320}>
            <ResponsiveContainer width="100%" height={290}>
              <BarChart data={linhas.map((l) => ({ nome: l.nome, Total: l.totalQuantidade }))}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="nome" fontSize={10} /><YAxis fontSize={10} /><Tooltip formatter={(v: number) => num(v)} /><Bar dataKey="Total" fill="#1f6feb" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Table striped withTableBorder>
            <Table.Thead><Table.Tr><Table.Th>{por === 'operador' ? 'Operador' : 'Máquina'}</Table.Th>{meses.map((m) => <Table.Th key={m} ta="right">{m}</Table.Th>)}<Table.Th ta="right">Total</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {linhas.map((l) => (
                <Table.Tr key={l.chaveId}><Table.Td fw={600}>{l.nome}</Table.Td>
                  {meses.map((m) => { const v = l.meses.find((x) => x.mes === m); return <Table.Td key={m} ta="right">{v ? num(v.quantidade) : '—'}</Table.Td> })}
                  <Table.Td ta="right" fw={700}>{num(l.totalQuantidade)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}
    </Stack>
  )
}

// ─── Aba OPs Emitidas (comparativo anual) ───────────────────────────────────
function OpsEmitidasAba({ ano }: { ano: number }) {
  const [dados, setDados] = useState<OpsAno[]>([])
  const [loading, setLoading] = useState(true)
  const anos = [ano - 2, ano - 1, ano]
  useEffect(() => {
    setLoading(true)
    api.get('/pcp/gerencial/ops-emitidas', { params: { anos: anos.join(',') } })
      .then(({ data }) => setDados(data)).catch(() => setDados([])).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ano])
  const chart = MES_ABREV.map((m, i) => {
    const row: Record<string, string | number> = { mes: m }
    for (const d of dados) row[String(d.ano)] = d.meses[i] ?? 0
    return row
  })
  const cores = ['#9aa5b1', '#f4a261', '#1f6feb']

  return (
    <Stack>
      {loading ? <Center py="xl"><Loader /></Center> : dados.length === 0 ? <Text c="dimmed" ta="center" py="md">Sem dados.</Text> : (
        <>
          <Card withBorder h={340}>
            <Text size="sm" fw={600} mb="xs">Quantidade de OPs emitidas (comparativo anual)</Text>
            <ResponsiveContainer width="100%" height={290}>
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="mes" fontSize={11} /><YAxis fontSize={11} /><Tooltip /><Legend />
                {dados.map((d, i) => <Bar key={d.ano} dataKey={String(d.ano)} fill={cores[i % cores.length]} />)}
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <Table striped withTableBorder>
            <Table.Thead><Table.Tr><Table.Th>Mês</Table.Th>{dados.map((d) => <Table.Th key={d.ano} ta="right">{d.ano}</Table.Th>)}</Table.Tr></Table.Thead>
            <Table.Tbody>
              {MESES.map((m, i) => (
                <Table.Tr key={m}><Table.Td>{m}</Table.Td>{dados.map((d) => <Table.Td key={d.ano} ta="right">{d.meses[i] || '—'}</Table.Td>)}</Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}
    </Stack>
  )
}

// ─── Aba Trabalhos em Máquina (OPs/clientes num dia) ────────────────────────
interface TrabalhoMaquina { opNumero: number | null; referenciaExterna: string | null; cliente: string | null; centroDescricao: string }
function TrabalhosEmMaquinaAba({ ano, mes, pico }: { ano: number; mes: number; pico: SerieDia | null }) {
  const diasNoMes = new Date(ano, mes, 0).getDate()
  const [dia, setDia] = useState<string>(pico?.data || `${ano}-${String(mes).padStart(2, '0')}-01`)
  const [itens, setItens] = useState<TrabalhoMaquina[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    api.get('/pcp/gerencial/trabalhos-em-maquina', { params: { data: dia } })
      .then(({ data }) => setItens(data)).catch(() => setItens([])).finally(() => setLoading(false))
  }, [dia])

  const opcoesDia = Array.from({ length: diasNoMes }, (_, i) => {
    const d = `${ano}-${String(mes).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`
    return { value: d, label: diaCurto(d) }
  })

  return (
    <Stack>
      <Group align="end">
        <Select label="Dia" w={160} data={opcoesDia} value={dia} onChange={(v) => v && setDia(v)} searchable />
        {pico && <Text size="sm" c="dimmed">Dica: {diaCurto(pico.data)} foi o pico do mês ({num(pico.produzido)}).</Text>}
      </Group>
      {loading ? <Center py="xl"><Loader /></Center> : itens.length === 0 ? <Text c="dimmed" ta="center" py="md">Nenhum trabalho apontado nesse dia.</Text> : (
        <Table striped withTableBorder>
          <Table.Thead><Table.Tr><Table.Th>OP</Table.Th><Table.Th>Cliente</Table.Th><Table.Th>Máquina</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>
            {itens.map((t, i) => (
              <Table.Tr key={`${t.opNumero}-${t.centroDescricao}-${i}`}>
                <Table.Td fw={600}>{t.referenciaExterna || (t.opNumero ? `#${t.opNumero}` : '—')}</Table.Td>
                <Table.Td>{t.cliente || '—'}</Table.Td>
                <Table.Td>{t.centroDescricao}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  )
}
