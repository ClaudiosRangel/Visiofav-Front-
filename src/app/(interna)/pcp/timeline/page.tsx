'use client'

import { useEffect, useState } from 'react'
import {
  Title, Stack, Card, Group, Badge, Text, Loader, Center, Progress,
  ThemeIcon, Tooltip, Select, TextInput, SimpleGrid, Paper, Box,
  Collapse, UnstyledButton, Table, ScrollArea,
} from '@mantine/core'
import {
  IconClock, IconAlertTriangle, IconCheck, IconPlayerPause,
  IconTrendingUp, IconTrendingDown, IconMinus, IconChevronDown,
  IconChevronRight, IconSearch, IconTimeline, IconHourglass,
} from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

interface Parada {
  motivo: string
  duracaoMinutos: number
  observacao: string | null
}

interface EtapaTimeline {
  id: string
  sequencia: number
  descricao: string
  centroProducao: string | null
  tipoProcesso: string | null
  status: string
  tempoSetupMinutos: number
  tempoOperacaoMinutos: number
  tempoTotalPrevisto: number
  inicioPrevistoAt: string | null
  fimPrevistoAt: string | null
  inicioRealAt: string | null
  fimRealAt: string | null
  tempoRealMinutos: number | null
  indicador: 'NO_TEMPO' | 'ADIANTADO' | 'ATRASADO' | 'PARADA' | 'AGUARDANDO' | 'CONCLUIDO'
  desvioMinutos: number
  desvioPercent: number
  paradas: Parada[]
}

interface OpTimeline {
  opId: string
  opNumero: string
  clienteNome: string | null
  produtoNome: string | null
  quantidade: number
  prioridade: string
  status: string
  dataEntrega: string | null
  tempoTotalPrevisto: number
  tempoRealAcumulado: number
  previsaoConclusaoAt: string | null
  riscoEntrega: boolean
  diferencaEntregaMinutos: number | null
  indicadorGeral: 'NO_TEMPO' | 'ADIANTADO' | 'ATRASADO' | 'RISCO_ENTREGA' | 'CONCLUIDO'
  percentualConcluido: number
  etapas: EtapaTimeline[]
}

interface Resumo {
  totalOps: number
  noTempo: number
  adiantadas: number
  atrasadas: number
  riscoEntrega: number
  concluidas: number
}

const INDICADOR_CONFIG = {
  NO_TEMPO: { color: 'green', icon: IconCheck, label: 'No tempo' },
  ADIANTADO: { color: 'blue', icon: IconTrendingDown, label: 'Adiantado' },
  ATRASADO: { color: 'red', icon: IconTrendingUp, label: 'Atrasado' },
  RISCO_ENTREGA: { color: 'red', icon: IconAlertTriangle, label: 'Risco de entrega' },
  PARADA: { color: 'orange', icon: IconPlayerPause, label: 'Parada' },
  AGUARDANDO: { color: 'gray', icon: IconHourglass, label: 'Aguardando' },
  CONCLUIDO: { color: 'teal', icon: IconCheck, label: 'Concluído' },
}

const PRIORIDADE_COLORS: Record<string, string> = {
  BAIXA: 'gray', NORMAL: 'blue', ALTA: 'orange', URGENTE: 'red',
}

const MOTIVO_PARADA_LABEL: Record<string, string> = {
  MANUTENCAO: 'Manutenção',
  FALTA_MATERIAL: 'Falta de material',
  ACERTO_MAQUINA: 'Acerto de máquina',
  TROCA_TURNO: 'Troca de turno',
  OUTRO: 'Outro',
}

function formatMinutos(min: number): string {
  if (min === 0) return '0min'
  const h = Math.floor(Math.abs(min) / 60)
  const m = Math.abs(min) % 60
  const sinal = min < 0 ? '-' : ''
  if (h === 0) return `${sinal}${m}min`
  return `${sinal}${h}h${m > 0 ? ` ${m}min` : ''}`
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

export default function TimelinePage() {
  useEffect(() => { document.title = 'PCP - Timeline de Produção' }, [])

  const [loading, setLoading] = useState(true)
  const [resumo, setResumo] = useState<Resumo | null>(null)
  const [timeline, setTimeline] = useState<OpTimeline[]>([])
  const [abertos, setAbertos] = useState<Record<string, boolean>>({})
  const [filtroStatus, setFiltroStatus] = useState<string | null>(null)
  const [filtroIndicador, setFiltroIndicador] = useState<string | null>(null)
  const [busca, setBusca] = useState('')

  async function carregarTimeline() {
    setLoading(true)
    try {
      const params: any = {}
      if (filtroStatus) params.status = filtroStatus
      const { data } = await api.get('/pcp/timeline', { params })
      setResumo(data.resumo)
      setTimeline(data.timeline)
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: 'Não foi possível carregar a timeline', color: 'red' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregarTimeline() }, [filtroStatus])

  // Auto-refresh a cada 60 segundos
  useEffect(() => {
    const interval = setInterval(carregarTimeline, 60000)
    return () => clearInterval(interval)
  }, [filtroStatus])

  const toggleOp = (opId: string) => setAbertos(prev => ({ ...prev, [opId]: !prev[opId] }))

  // Filtros locais
  const timelineFiltrada = timeline.filter(op => {
    if (filtroIndicador && op.indicadorGeral !== filtroIndicador) return false
    if (busca) {
      const termo = busca.toLowerCase()
      return (
        op.opNumero.toLowerCase().includes(termo) ||
        (op.clienteNome || '').toLowerCase().includes(termo) ||
        (op.produtoNome || '').toLowerCase().includes(termo)
      )
    }
    return true
  })

  if (loading && !resumo) {
    return <Center h={400}><Loader size="lg" /></Center>
  }

  return (
    <Stack p="md" gap="md">
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <IconTimeline size={28} />
          <Title order={2}>Timeline de Produção</Title>
        </Group>
        <Badge size="lg" variant="light" color="gray">
          Atualiza a cada 60s
        </Badge>
      </Group>

      {/* Cards de resumo */}
      {resumo && (
        <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="sm">
          <ResumoCard label="Total OPs" valor={resumo.totalOps} color="gray" />
          <ResumoCard label="No tempo" valor={resumo.noTempo} color="green" />
          <ResumoCard label="Adiantadas" valor={resumo.adiantadas} color="blue" />
          <ResumoCard label="Atrasadas" valor={resumo.atrasadas} color="red" />
          <ResumoCard label="Risco entrega" valor={resumo.riscoEntrega} color="red" />
          <ResumoCard label="Concluídas" valor={resumo.concluidas} color="teal" />
        </SimpleGrid>
      )}

      {/* Filtros */}
      <Group gap="sm">
        <TextInput
          placeholder="Buscar OP, cliente ou produto..."
          leftSection={<IconSearch size={16} />}
          value={busca}
          onChange={(e) => setBusca(e.currentTarget.value)}
          style={{ flex: 1, maxWidth: 300 }}
        />
        <Select
          placeholder="Status"
          clearable
          value={filtroStatus}
          onChange={setFiltroStatus}
          data={[
            { value: 'PROGRAMADA', label: 'Programada' },
            { value: 'LIBERADA', label: 'Liberada' },
            { value: 'EM_PRODUCAO', label: 'Em Produção' },
            { value: 'PROGRAMADA,LIBERADA,EM_PRODUCAO', label: 'Todas ativas' },
          ]}
          style={{ width: 180 }}
        />
        <Select
          placeholder="Indicador"
          clearable
          value={filtroIndicador}
          onChange={setFiltroIndicador}
          data={[
            { value: 'NO_TEMPO', label: '🟢 No tempo' },
            { value: 'ADIANTADO', label: '🔵 Adiantado' },
            { value: 'ATRASADO', label: '🔴 Atrasado' },
            { value: 'RISCO_ENTREGA', label: '⚠️ Risco entrega' },
          ]}
          style={{ width: 180 }}
        />
      </Group>

      {/* Lista de OPs */}
      <Stack gap="xs">
        {timelineFiltrada.length === 0 && !loading && (
          <Text c="dimmed" ta="center" py="xl">Nenhuma OP encontrada com os filtros selecionados.</Text>
        )}
        {timelineFiltrada.map(op => (
          <OpTimelineCard
            key={op.opId}
            op={op}
            aberto={!!abertos[op.opId]}
            onToggle={() => toggleOp(op.opId)}
          />
        ))}
      </Stack>
    </Stack>
  )
}

function ResumoCard({ label, valor, color }: { label: string; valor: number; color: string }) {
  return (
    <Paper p="sm" radius="md" withBorder>
      <Text size="xs" c="dimmed" tt="uppercase" fw={600}>{label}</Text>
      <Text size="xl" fw={700} c={color}>{valor}</Text>
    </Paper>
  )
}

function OpTimelineCard({ op, aberto, onToggle }: { op: OpTimeline; aberto: boolean; onToggle: () => void }) {
  const config = INDICADOR_CONFIG[op.indicadorGeral]
  const Icon = config.icon

  return (
    <Card padding="sm" radius="md" withBorder shadow={aberto ? 'sm' : undefined}>
      <UnstyledButton onClick={onToggle} w="100%">
        <Group justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            {aberto ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
            <ThemeIcon size="sm" variant="light" color={config.color}>
              <Icon size={14} />
            </ThemeIcon>
            <Text fw={600} size="sm">OP {op.opNumero}</Text>
            <Badge size="xs" color={PRIORIDADE_COLORS[op.prioridade] || 'gray'} variant="light">
              {op.prioridade}
            </Badge>
            <Text size="xs" c="dimmed" lineClamp={1} style={{ maxWidth: 200 }}>
              {op.clienteNome || '—'}
            </Text>
            <Text size="xs" c="dimmed" lineClamp={1} style={{ maxWidth: 250 }}>
              {op.produtoNome || '—'}
            </Text>
          </Group>

          <Group gap="sm" wrap="nowrap">
            {op.dataEntrega && (
              <Tooltip label={`Entrega: ${formatDate(op.dataEntrega)}`}>
                <Badge size="xs" variant="outline" color={op.riscoEntrega ? 'red' : 'gray'}>
                  {formatDate(op.dataEntrega)}
                </Badge>
              </Tooltip>
            )}
            <Tooltip label={`Previsto: ${formatMinutos(op.tempoTotalPrevisto)} | Real: ${formatMinutos(op.tempoRealAcumulado)}`}>
              <Badge size="xs" variant="light" color={config.color}>
                {formatMinutos(op.tempoRealAcumulado)} / {formatMinutos(op.tempoTotalPrevisto)}
              </Badge>
            </Tooltip>
            <Box style={{ width: 80 }}>
              <Progress
                value={op.percentualConcluido}
                color={config.color}
                size="sm"
                radius="xl"
              />
            </Box>
            <Text size="xs" fw={500} c={config.color} w={35} ta="right">
              {op.percentualConcluido}%
            </Text>
          </Group>
        </Group>
      </UnstyledButton>

      <Collapse in={aberto}>
        <Box mt="sm">
          {/* Info resumida */}
          <Group gap="lg" mb="xs">
            <Text size="xs" c="dimmed">
              Qtd: <Text span fw={600}>{op.quantidade.toLocaleString('pt-BR')}</Text>
            </Text>
            {op.previsaoConclusaoAt && (
              <Text size="xs" c="dimmed">
                Previsão conclusão: <Text span fw={600} c={op.riscoEntrega ? 'red' : undefined}>
                  {formatDateTime(op.previsaoConclusaoAt)}
                </Text>
              </Text>
            )}
            {op.diferencaEntregaMinutos !== null && (
              <Text size="xs" c={op.diferencaEntregaMinutos >= 0 ? 'green' : 'red'} fw={500}>
                {op.diferencaEntregaMinutos >= 0
                  ? `Folga: ${formatMinutos(op.diferencaEntregaMinutos)}`
                  : `Atraso previsto: ${formatMinutos(Math.abs(op.diferencaEntregaMinutos))}`
                }
              </Text>
            )}
          </Group>

          {/* Tabela de etapas */}
          <ScrollArea>
            <Table fontSize="xs" striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Seq</Table.Th>
                  <Table.Th>Etapa / Centro</Table.Th>
                  <Table.Th ta="center">Setup</Table.Th>
                  <Table.Th ta="center">Operação</Table.Th>
                  <Table.Th ta="center">Previsto</Table.Th>
                  <Table.Th ta="center">Real</Table.Th>
                  <Table.Th ta="center">Desvio</Table.Th>
                  <Table.Th ta="center">Início Prev.</Table.Th>
                  <Table.Th ta="center">Fim Prev.</Table.Th>
                  <Table.Th ta="center">Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {op.etapas.map(etapa => (
                  <EtapaRow key={etapa.id} etapa={etapa} />
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>

          {/* Barra visual de progresso por etapa */}
          <Box mt="sm">
            <Group gap={2} wrap="nowrap">
              {op.etapas.map(etapa => {
                const cfg = INDICADOR_CONFIG[etapa.indicador]
                const largura = op.tempoTotalPrevisto > 0
                  ? Math.max(3, (etapa.tempoTotalPrevisto / op.tempoTotalPrevisto) * 100)
                  : 100 / op.etapas.length
                return (
                  <Tooltip
                    key={etapa.id}
                    label={`${etapa.descricao} — ${cfg.label} (${formatMinutos(etapa.tempoTotalPrevisto)})`}
                  >
                    <Box
                      style={{
                        width: `${largura}%`,
                        height: 24,
                        borderRadius: 4,
                        background: `var(--mantine-color-${cfg.color}-${etapa.status === 'AGUARDANDO' || etapa.indicador === 'AGUARDANDO' ? '2' : '5'})`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      <Text size="10px" c="white" fw={600} lineClamp={1}>
                        {etapa.centroProducao?.split(' ')[0] || etapa.sequencia}
                      </Text>
                    </Box>
                  </Tooltip>
                )
              })}
            </Group>
          </Box>
        </Box>
      </Collapse>
    </Card>
  )
}

function EtapaRow({ etapa }: { etapa: EtapaTimeline }) {
  const cfg = INDICADOR_CONFIG[etapa.indicador]
  const Icon = cfg.icon

  return (
    <Table.Tr style={{ background: etapa.indicador === 'ATRASADO' ? 'var(--mantine-color-red-0)' : undefined }}>
      <Table.Td>{etapa.sequencia}</Table.Td>
      <Table.Td>
        <Stack gap={0}>
          <Text size="xs" fw={500}>{etapa.descricao}</Text>
          <Text size="10px" c="dimmed">{etapa.centroProducao || '—'}</Text>
        </Stack>
      </Table.Td>
      <Table.Td ta="center">
        <Text size="xs">{formatMinutos(etapa.tempoSetupMinutos)}</Text>
      </Table.Td>
      <Table.Td ta="center">
        <Text size="xs">{formatMinutos(etapa.tempoOperacaoMinutos)}</Text>
      </Table.Td>
      <Table.Td ta="center">
        <Text size="xs" fw={500}>{formatMinutos(etapa.tempoTotalPrevisto)}</Text>
      </Table.Td>
      <Table.Td ta="center">
        <Text size="xs" fw={500} c={cfg.color}>
          {etapa.tempoRealMinutos !== null ? formatMinutos(etapa.tempoRealMinutos) : '—'}
        </Text>
      </Table.Td>
      <Table.Td ta="center">
        {etapa.tempoRealMinutos !== null ? (
          <Badge size="xs" variant="light" color={cfg.color}>
            {etapa.desvioMinutos > 0 ? '+' : ''}{formatMinutos(etapa.desvioMinutos)}
            {etapa.desvioPercent !== 0 && ` (${etapa.desvioPercent > 0 ? '+' : ''}${etapa.desvioPercent}%)`}
          </Badge>
        ) : (
          <Text size="xs" c="dimmed">—</Text>
        )}
      </Table.Td>
      <Table.Td ta="center">
        <Text size="10px">{formatDateTime(etapa.inicioPrevistoAt)}</Text>
      </Table.Td>
      <Table.Td ta="center">
        <Text size="10px">{formatDateTime(etapa.fimPrevistoAt)}</Text>
      </Table.Td>
      <Table.Td ta="center">
        <Group gap={4} justify="center" wrap="nowrap">
          <ThemeIcon size={16} variant="light" color={cfg.color} radius="xl">
            <Icon size={10} />
          </ThemeIcon>
          <Text size="10px" c={cfg.color} fw={500}>{cfg.label}</Text>
        </Group>
        {etapa.paradas.length > 0 && (
          <Stack gap={0} mt={2}>
            {etapa.paradas.slice(0, 2).map((p, i) => (
              <Text key={i} size="9px" c="orange">
                ⏸ {MOTIVO_PARADA_LABEL[p.motivo] || p.motivo} ({formatMinutos(p.duracaoMinutos)})
              </Text>
            ))}
            {etapa.paradas.length > 2 && (
              <Text size="9px" c="dimmed">+{etapa.paradas.length - 2} paradas</Text>
            )}
          </Stack>
        )}
      </Table.Td>
    </Table.Tr>
  )
}
