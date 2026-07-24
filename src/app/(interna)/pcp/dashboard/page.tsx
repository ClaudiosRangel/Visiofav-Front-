'use client'

import { useEffect, useState } from 'react'
import { Title, Stack, SimpleGrid, Card, Text, ThemeIcon, Group, Loader, Center, Tabs, Badge, Divider } from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { IconAlertTriangle, IconClipboardCheck, IconPackage, IconClock } from '@tabler/icons-react'
import { api } from '@/lib/api'
import {
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LineChart, Line,
} from 'recharts'

const CENTRO_COLORS: Record<string, string> = {
  Cortadeira: '#7c3aed',
  Impressão: '#0ca678',
  Acabamento: '#f59f00',
}

const MOTIVO_LABELS: Record<string, string> = {
  MANUTENCAO: 'Manutenção',
  FALTA_MATERIAL: 'Falta de Material',
  ACERTO_MAQUINA: 'Acerto de Máquina',
  TROCA_TURNO: 'Troca de Turno',
  OUTRO: 'Outro',
  ACERTO: 'Acerto',
  REFUGO: 'Refugo',
  DEFEITO: 'Defeito',
  APARA: 'Apara',
}

function formatarDataBR(iso: string) {
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

/** Card de gráfico com título e altura fixa — evita repetir a mesma estrutura
 * de Card/Text/ResponsiveContainer em cada um dos 4 blocos de indicadores. */
function CardGrafico({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: React.ReactNode }) {
  return (
    <Card withBorder padding="md">
      <Text fw={600} mb={subtitulo ? 0 : 'sm'}>{titulo}</Text>
      {subtitulo && <Text size="xs" c="dimmed" mb="sm">{subtitulo}</Text>}
      <div style={{ width: '100%', height: 300 }}>{children}</div>
    </Card>
  )
}

export default function DashboardPcpPage() {
  useEffect(() => { document.title = 'PCP - Dashboard' }, [])

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [indicadores, setIndicadores] = useState<any>(null)
  const [loadingIndicadores, setLoadingIndicadores] = useState(true)
  const [periodo, setPeriodo] = useState<[Date | null, Date | null]>(() => {
    const fim = new Date()
    const inicio = new Date(fim.getTime() - 29 * 86400000)
    return [inicio, fim]
  })

  async function carregar() {
    try {
      const res = await api.get('/pcp/dashboard')
      setData(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function carregarIndicadores() {
    setLoadingIndicadores(true)
    try {
      const params: any = {}
      if (periodo[0]) params.dataInicio = periodo[0].toISOString().slice(0, 10)
      if (periodo[1]) params.dataFim = periodo[1].toISOString().slice(0, 10)
      const res = await api.get('/pcp/dashboard/indicadores', { params })
      setIndicadores(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoadingIndicadores(false)
    }
  }

  useEffect(() => { carregar() }, [])
  useEffect(() => { carregarIndicadores() }, [periodo])

  if (loading) return <Center py="xl"><Loader /></Center>
  if (!data) return <Text c="dimmed" ta="center">Erro ao carregar dashboard</Text>

  const { producao, estoque } = data

  return (
    <Stack gap="md">
      <Title order={3}>Dashboard PCP</Title>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        <Card withBorder>
          <Group>
            <ThemeIcon color="orange" variant="light" size={48} radius="md">
              <IconAlertTriangle size={24} />
            </ThemeIcon>
            <div>
              <Text size="xl" fw={700}>{producao.opsAtrasadas}</Text>
              <Text size="sm" c="dimmed">OPs Atrasadas</Text>
            </div>
          </Group>
        </Card>

        <Card withBorder>
          <Group>
            <ThemeIcon color="blue" variant="light" size={48} radius="md">
              <IconPackage size={24} />
            </ThemeIcon>
            <div>
              <Text size="xl" fw={700}>{producao.liberacoesPendentes}</Text>
              <Text size="sm" c="dimmed">Liberações Pendentes</Text>
            </div>
          </Group>
        </Card>

        <Card withBorder>
          <Group>
            <ThemeIcon color="green" variant="light" size={48} radius="md">
              <IconClipboardCheck size={24} />
            </ThemeIcon>
            <div>
              <Text size="xl" fw={700}>{producao.producaoHoje.apontamentos}</Text>
              <Text size="sm" c="dimmed">Apontamentos Hoje</Text>
            </div>
          </Group>
        </Card>

        <Card withBorder>
          <Group>
            <ThemeIcon color="red" variant="light" size={48} radius="md">
              <IconClock size={24} />
            </ThemeIcon>
            <div>
              <Text size="xl" fw={700}>{estoque.itensAbaixoMinimo}</Text>
              <Text size="sm" c="dimmed">Itens Estoque Baixo</Text>
            </div>
          </Group>
        </Card>
      </SimpleGrid>

      {producao.opsPorStatus.length > 0 && (
        <Card withBorder>
          <Text fw={600} mb="sm">OPs por Status</Text>
          <Group>
            {producao.opsPorStatus.map((s: any) => (
              <Card key={s.status} withBorder padding="xs" radius="sm">
                <Text size="xs" c="dimmed">{s.status}</Text>
                <Text size="lg" fw={700}>{s.total}</Text>
              </Card>
            ))}
          </Group>
        </Card>
      )}

      <Divider mt="md" label="Indicadores por Estágio — Cortadeira, Impressão e Acabamento" labelPosition="left" />

      <Group justify="flex-end">
        <DatePickerInput
          type="range"
          label="Período"
          value={periodo}
          onChange={(v) => setPeriodo(v as [Date | null, Date | null])}
          size="sm"
          maw={280}
          allowSingleDateInRange
        />
      </Group>

      {loadingIndicadores ? (
        <Center py="xl"><Loader /></Center>
      ) : !indicadores ? (
        <Text c="dimmed" ta="center">Erro ao carregar indicadores</Text>
      ) : (
        <Tabs defaultValue="oee">
          <Tabs.List>
            <Tabs.Tab value="oee">OEE por Estágio</Tabs.Tab>
            <Tabs.Tab value="producao">Produção Diária</Tabs.Tab>
            <Tabs.Tab value="paradas">Motivos de Parada</Tabs.Tab>
            <Tabs.Tab value="perdas">Motivos de Perda</Tabs.Tab>
          </Tabs.List>

          {/* ABA OEE — radar comparando Disponibilidade x Desempenho x Qualidade entre os 3 centros */}
          <Tabs.Panel value="oee" pt="md">
            <SimpleGrid cols={{ base: 1, lg: 2 }}>
              <CardGrafico titulo="OEE — Disponibilidade × Desempenho × Qualidade" subtitulo="Comparação entre estágios no período selecionado">
                <ResponsiveContainer>
                  <RadarChart data={[
                    { indicador: 'Disponibilidade', ...Object.fromEntries(indicadores.oeePorCentro.map((c: any) => [c.centro, c.disponibilidade])) },
                    { indicador: 'Desempenho', ...Object.fromEntries(indicadores.oeePorCentro.map((c: any) => [c.centro, c.desempenho])) },
                    { indicador: 'Qualidade', ...Object.fromEntries(indicadores.oeePorCentro.map((c: any) => [c.centro, c.qualidade])) },
                  ]}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="indicador" tick={{ fontSize: 12 }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
                    {indicadores.oeePorCentro.map((c: any) => (
                      <Radar key={c.centro} name={c.centro} dataKey={c.centro} stroke={CENTRO_COLORS[c.centro]} fill={CENTRO_COLORS[c.centro]} fillOpacity={0.15} />
                    ))}
                    <Legend />
                    <Tooltip formatter={(v: any): [string, string] => [`${v}%`, '']} />
                  </RadarChart>
                </ResponsiveContainer>
              </CardGrafico>

              <Card withBorder padding="md">
                <Text fw={600} mb="sm">OEE Final por Estágio</Text>
                <Stack gap="sm">
                  {indicadores.oeePorCentro.map((c: any) => (
                    <Group key={c.centro} justify="space-between" wrap="nowrap">
                      <Text size="sm" fw={500}>{c.centro}</Text>
                      <Group gap="xs">
                        <Text size="xs" c="dimmed">Disp. {c.disponibilidade}% · Desemp. {c.desempenho}% · Qual. {c.qualidade}%</Text>
                        <Badge size="lg" color={c.oee >= 85 ? 'green' : c.oee >= 60 ? 'yellow' : 'red'}>{c.oee}% OEE</Badge>
                      </Group>
                    </Group>
                  ))}
                </Stack>
                <Text size="xs" c="dimmed" mt="md">
                  OEE = Disponibilidade × Desempenho × Qualidade. Referência de mercado: acima de 85% é classe mundial, 60-85% é razoável, abaixo de 60% indica perdas relevantes a investigar.
                </Text>
              </Card>
            </SimpleGrid>
          </Tabs.Panel>

          {/* ABA PRODUÇÃO DIÁRIA — linha por centro */}
          <Tabs.Panel value="producao" pt="md">
            <CardGrafico titulo="Produção diária por estágio" subtitulo="Quantidade apontada (produzida) por dia, no período selecionado">
              <ResponsiveContainer>
                <LineChart data={indicadores.producaoDiaria[0]?.serie.map((_: any, i: number) => {
                  const ponto: any = { data: formatarDataBR(indicadores.producaoDiaria[0].serie[i].data) }
                  for (const c of indicadores.producaoDiaria) ponto[c.centro] = c.serie[i].quantidade
                  return ponto
                })}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="data" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  {indicadores.producaoDiaria.map((c: any) => (
                    <Line key={c.centro} type="monotone" dataKey={c.centro} stroke={CENTRO_COLORS[c.centro]} strokeWidth={2} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </CardGrafico>
          </Tabs.Panel>

          {/* ABA PARETO DE PARADAS — barras por motivo + linha de % acumulado, um gráfico por centro */}
          <Tabs.Panel value="paradas" pt="md">
            <SimpleGrid cols={{ base: 1, lg: 3 }}>
              {indicadores.paretoParadas.map((c: any) => (
                <CardGrafico key={c.centro} titulo={c.centro} subtitulo="Minutos parados por motivo (Pareto)">
                  {c.dados.length === 0 ? (
                    <Center h="100%"><Text size="sm" c="dimmed">Sem paradas registradas no período</Text></Center>
                  ) : (
                    <ResponsiveContainer>
                      <BarChart data={c.dados.map((d: any) => ({ ...d, motivoLabel: MOTIVO_LABELS[d.motivo] || d.motivo }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="motivoLabel" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v: any): [string, string] => [`${v} min`, 'Minutos']} />
                        <Bar dataKey="valor" fill={CENTRO_COLORS[c.centro]} name="Minutos" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardGrafico>
              ))}
            </SimpleGrid>
          </Tabs.Panel>

          {/* ABA PARETO DE PERDAS — mesmo padrão, por quantidade perdida */}
          <Tabs.Panel value="perdas" pt="md">
            <SimpleGrid cols={{ base: 1, lg: 3 }}>
              {indicadores.paretoPerdas.map((c: any) => (
                <CardGrafico key={c.centro} titulo={c.centro} subtitulo="Quantidade perdida por motivo (Pareto)">
                  {c.dados.length === 0 ? (
                    <Center h="100%"><Text size="sm" c="dimmed">Sem perdas registradas no período</Text></Center>
                  ) : (
                    <ResponsiveContainer>
                      <BarChart data={c.dados.map((d: any) => ({ ...d, motivoLabel: MOTIVO_LABELS[d.motivo] || d.motivo }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="motivoLabel" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={50} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip formatter={(v: any) => v} />
                        <Bar dataKey="valor" fill={CENTRO_COLORS[c.centro]} name="Quantidade" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardGrafico>
              ))}
            </SimpleGrid>
          </Tabs.Panel>
        </Tabs>
      )}
    </Stack>
  )
}
