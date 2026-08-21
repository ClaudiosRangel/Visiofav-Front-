'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import {
  Title, Stack, Group, Text, Loader, Center, Badge, Paper, Box,
  Tooltip, TextInput, SegmentedControl, ActionIcon,
} from '@mantine/core'
import { IconSearch, IconTimeline, IconRefresh } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

// ============================================================================
// TYPES
// ============================================================================

interface EtapaTimeline {
  id: string
  sequencia: number
  descricao: string
  centroProducao: string | null
  tipoProcesso: string | null
  tipoProcessoPosicao: number
  status: string
  tempoSetupMinutos: number
  tempoOperacaoMinutos: number
  tempoTotalPrevisto: number
  inicioPrevistoAt: string | null
  fimPrevistoAt: string | null
  inicioRealAt: string | null
  fimRealAt: string | null
  tempoRealMinutos: number | null
  indicador: string
  desvioMinutos: number
  desvioPercent: number
  paradas: Array<{ motivo: string; duracaoMinutos: number; observacao: string | null }>
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
  indicadorGeral: string
  percentualConcluido: number
  etapas: EtapaTimeline[]
}

interface GanttBar {
  etapaId: string
  opNumero: string
  opId: string
  clienteNome: string | null
  produtoNome: string | null
  descricao: string
  centroProducao: string
  tipoProcesso: string
  inicioMs: number
  fimMs: number
  inicioRealMs: number | null
  fimRealMs: number | null
  indicador: string
  status: string
  tempoSetupMinutos: number
  tempoTotalPrevisto: number
  tempoRealMinutos: number | null
  prioridade: string
  quantidade: number
  dataEntrega: string | null
  riscoEntrega: boolean
  sequencia: number
  // Para setas de dependência
  opEtapaAnteriorCentro: string | null
}

interface Raia {
  tipoProcesso: string
  tipoProcessoPosicao: number
  centroProducao: string
  barras: GanttBar[]
}

// ============================================================================
// CONSTANTS
// ============================================================================

const OP_COLORS = [
  '#2196F3', '#4CAF50', '#FF9800', '#9C27B0', '#00BCD4',
  '#E91E63', '#8BC34A', '#FF5722', '#3F51B5', '#009688',
  '#FFC107', '#673AB7', '#03A9F4', '#CDDC39', '#795548',
  '#607D8B', '#F44336', '#1B5E20', '#E65100', '#4A148C',
]

const STATUS_BORDER: Record<string, string> = {
  ATRASADO: '#ff1744',
  PARADA: '#ff9100',
  ADIANTADO: '#2979ff',
  NO_TEMPO: '#00e676',
  CONCLUIDO: '#00bfa5',
  AGUARDANDO: '#9e9e9e',
}

const RAIA_HEIGHT = 56
const LABEL_WIDTH = 200
const SETUP_HEIGHT = 8

// ============================================================================
// HELPERS
// ============================================================================

function formatHora(ms: number): string {
  const d = new Date(ms)
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function formatMinutos(min: number): string {
  if (min === 0) return '0min'
  const h = Math.floor(Math.abs(min) / 60)
  const m = Math.abs(min) % 60
  if (h === 0) return `${m}min`
  return `${h}h${m > 0 ? `${m}m` : ''}`
}

function getOpColor(opId: string, colorMap: Map<string, string>): string {
  if (!colorMap.has(opId)) {
    colorMap.set(opId, OP_COLORS[colorMap.size % OP_COLORS.length])
  }
  return colorMap.get(opId)!
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function GanttProducaoPage() {
  useEffect(() => { document.title = 'PCP - Gantt de Produção' }, [])

  const [loading, setLoading] = useState(true)
  const [timeline, setTimeline] = useState<OpTimeline[]>([])
  const [conflitos, setConflitos] = useState<any[]>([])
  const [busca, setBusca] = useState('')
  const [visao, setVisao] = useState<'12h' | '24h' | '3d' | '7d'>('24h')

  const labelsRef = useRef<HTMLDivElement>(null)
  const ganttRef = useRef<HTMLDivElement>(null)

  // Sincronizar scroll vertical entre labels e gantt
  const syncScroll = useCallback((source: 'labels' | 'gantt') => {
    const labels = labelsRef.current
    const gantt = ganttRef.current
    if (!labels || !gantt) return
    if (source === 'gantt') {
      labels.scrollTop = gantt.scrollTop
    } else {
      gantt.scrollTop = labels.scrollTop
    }
  }, [])

  async function carregar() {
    setLoading(true)
    try {
      const { data } = await api.get('/pcp/timeline')
      setTimeline(data.timeline)
      setConflitos(data.conflitos || [])
    } catch {
      notifications.show({ title: 'Erro', message: 'Falha ao carregar dados', color: 'red' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar() }, [])
  useEffect(() => {
    const interval = setInterval(carregar, 60000)
    return () => clearInterval(interval)
  }, [])

  const pixelsPorMinuto = useMemo(() => {
    switch (visao) {
      case '12h': return 2.5
      case '24h': return 1.2
      case '3d': return 0.4
      case '7d': return 0.17
      default: return 1.2
    }
  }, [visao])

  // Mapa de cores por OP
  const opColorMap = useMemo(() => new Map<string, string>(), [timeline])

  // Transformar dados em raias
  const { raias, minTime, maxTime, totalWidth, hourMarkers, entregaMarkers } = useMemo(() => {
    const raiaMap = new Map<string, Raia>()
    let minT = Infinity
    let maxT = -Infinity
    const entregas: Array<{ opNumero: string; ms: number; opId: string }> = []

    for (const op of timeline) {
      if (busca) {
        const termo = busca.toLowerCase()
        const match = op.opNumero.toLowerCase().includes(termo) ||
          (op.clienteNome || '').toLowerCase().includes(termo) ||
          (op.produtoNome || '').toLowerCase().includes(termo)
        if (!match) continue
      }

      // Marcador de entrega
      if (op.dataEntrega) {
        entregas.push({ opNumero: op.opNumero, ms: new Date(op.dataEntrega).getTime(), opId: op.opId })
      }

      let etapaAnteriorCentro: string | null = null

      for (const etapa of op.etapas) {
        if (!etapa.centroProducao || !etapa.tipoProcesso) continue
        if (!etapa.inicioPrevistoAt || !etapa.fimPrevistoAt) continue

        const key = `${etapa.tipoProcesso}||${etapa.centroProducao}`
        if (!raiaMap.has(key)) {
          raiaMap.set(key, { tipoProcesso: etapa.tipoProcesso, tipoProcessoPosicao: etapa.tipoProcessoPosicao || 999, centroProducao: etapa.centroProducao, barras: [] })
        }

        const inicioMs = new Date(etapa.inicioPrevistoAt).getTime()
        const fimMs = new Date(etapa.fimPrevistoAt).getTime()

        if (inicioMs < minT) minT = inicioMs
        if (fimMs > maxT) maxT = fimMs

        raiaMap.get(key)!.barras.push({
          etapaId: etapa.id,
          opNumero: op.opNumero,
          opId: op.opId,
          clienteNome: op.clienteNome,
          produtoNome: op.produtoNome,
          descricao: etapa.descricao,
          centroProducao: etapa.centroProducao,
          tipoProcesso: etapa.tipoProcesso,
          inicioMs,
          fimMs,
          inicioRealMs: etapa.inicioRealAt ? new Date(etapa.inicioRealAt).getTime() : null,
          fimRealMs: etapa.fimRealAt ? new Date(etapa.fimRealAt).getTime() : null,
          indicador: etapa.indicador,
          status: etapa.status,
          tempoSetupMinutos: etapa.tempoSetupMinutos,
          tempoTotalPrevisto: etapa.tempoTotalPrevisto,
          tempoRealMinutos: etapa.tempoRealMinutos,
          prioridade: op.prioridade,
          quantidade: op.quantidade,
          dataEntrega: op.dataEntrega,
          riscoEntrega: op.riscoEntrega,
          sequencia: etapa.sequencia,
          opEtapaAnteriorCentro: etapaAnteriorCentro,
        })

        etapaAnteriorCentro = etapa.centroProducao
      }
    }

    for (const raia of raiaMap.values()) {
      raia.barras.sort((a, b) => a.inicioMs - b.inicioMs)
    }

    const raiasArr = Array.from(raiaMap.values())
    raiasArr.sort((a, b) => {
      if (a.tipoProcessoPosicao !== b.tipoProcessoPosicao) return a.tipoProcessoPosicao - b.tipoProcessoPosicao
      return a.centroProducao.localeCompare(b.centroProducao)
    })

    if (minT === Infinity) {
      minT = Date.now() - 4 * 60 * 60 * 1000
      maxT = Date.now() + 20 * 60 * 60 * 1000
    }
    minT -= 30 * 60 * 1000
    maxT += 60 * 60 * 1000

    // Marcadores de entrega que caem no range
    const entregasVisiveis = entregas.filter(e => e.ms >= minT && e.ms <= maxT)

    const totalMin = (maxT - minT) / 60000
    const tw = totalMin * pixelsPorMinuto

    // Hour markers
    const markers: Array<{ ms: number; label: string; isNewDay: boolean }> = []
    const startH = new Date(minT)
    startH.setMinutes(0, 0, 0)
    let cursor = startH.getTime()
    while (cursor < maxT) {
      if (cursor >= minT) {
        const d = new Date(cursor)
        markers.push({
          ms: cursor,
          label: d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
          isNewDay: d.getHours() === 0,
        })
      }
      cursor += 60 * 60 * 1000
    }

    return { raias: raiasArr, minTime: minT, maxTime: maxT, totalWidth: tw, hourMarkers: markers, entregaMarkers: entregasVisiveis }
  }, [timeline, busca, pixelsPorMinuto])

  // Agrupar raias por processo
  const gruposProcesso = useMemo(() => {
    const grupos: Array<{ tipoProcesso: string; raias: Raia[] }> = []
    let atual: typeof grupos[0] | null = null
    for (const raia of raias) {
      if (!atual || atual.tipoProcesso !== raia.tipoProcesso) {
        atual = { tipoProcesso: raia.tipoProcesso, raias: [] }
        grupos.push(atual)
      }
      atual.raias.push(raia)
    }
    return grupos
  }, [raias])

  const agora = Date.now()
  const totalContentHeight = gruposProcesso.reduce((acc, g) => acc + 28 + g.raias.length * RAIA_HEIGHT, 0)

  if (loading && timeline.length === 0) {
    return <Center h={400}><Loader size="lg" /></Center>
  }

  return (
    <Stack p="md" gap="sm" style={{ height: 'calc(100vh - 80px)' }}>
      {/* Header */}
      <Group justify="space-between" align="center">
        <Group gap="xs">
          <IconTimeline size={24} />
          <Title order={3}>Gantt de Produção</Title>
        </Group>
        <Group gap="sm">
          <TextInput
            placeholder="Buscar OP, cliente..."
            leftSection={<IconSearch size={14} />}
            value={busca}
            onChange={(e) => setBusca(e.currentTarget.value)}
            size="xs"
            w={200}
          />
          <SegmentedControl
            size="xs"
            value={visao}
            onChange={(v) => setVisao(v as any)}
            data={[
              { value: '12h', label: '12h' },
              { value: '24h', label: '24h' },
              { value: '3d', label: '3 dias' },
              { value: '7d', label: '7 dias' },
            ]}
          />
          <ActionIcon variant="subtle" size="sm" onClick={carregar}>
            <IconRefresh size={16} />
          </ActionIcon>
        </Group>
      </Group>

      {/* Legenda */}
      <Group gap="xs">
        {[...new Set(timeline.map(op => op.opId))].slice(0, 8).map(opId => {
          const op = timeline.find(t => t.opId === opId)
          if (!op) return null
          return (
            <Badge key={opId} size="xs" variant="filled" style={{ background: getOpColor(opId, opColorMap) }}>
              OP {op.opNumero} - {(op.produtoNome || '').slice(0, 20)}
            </Badge>
          )
        })}
        {timeline.length > 8 && <Text size="xs" c="dimmed">+{timeline.length - 8} OPs</Text>}
      </Group>

      {/* Alertas de Conflitos */}
      {conflitos.length > 0 && (
        <Paper p="xs" radius="sm" withBorder style={{ borderColor: 'var(--mantine-color-red-7)', background: 'var(--mantine-color-red-9)' }}>
          <Group gap="xs" mb={4}>
            <Text size="xs" fw={700} c="red.3">⚠️ {conflitos.length} conflito{conflitos.length > 1 ? 's' : ''} detectado{conflitos.length > 1 ? 's' : ''}</Text>
            <Text size="xs" c="dimmed">(sobreposição de OPs na mesma máquina)</Text>
          </Group>
          <Group gap="xs" wrap="wrap">
            {conflitos.slice(0, 5).map((c: any, i: number) => (
              <Tooltip key={i} multiline w={300} label={
                <div>
                  <Text size="xs" fw={700}>{c.centroProducao}</Text>
                  <Text size="xs">OP {c.etapa1.opNumero} ({c.etapa1.descricao})</Text>
                  <Text size="xs">× OP {c.etapa2.opNumero} ({c.etapa2.descricao})</Text>
                  <Text size="xs" c="red.3">Sobreposição: {formatMinutos(c.sobreposicaoMinutos)}</Text>
                </div>
              }>
                <Badge size="xs" color="red" variant="light" style={{ cursor: 'help' }}>
                  {c.centroProducao}: OP{c.etapa1.opNumero} × OP{c.etapa2.opNumero} ({formatMinutos(c.sobreposicaoMinutos)})
                </Badge>
              </Tooltip>
            ))}
            {conflitos.length > 5 && <Text size="xs" c="red.3">+{conflitos.length - 5} conflitos</Text>}
          </Group>
        </Paper>
      )}

      {/* Gantt Container */}
      <Paper withBorder radius="md" style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {/* ═══ COLUNA FIXA (absolute, nunca se move horizontalmente) ═══ */}
        <div
          ref={labelsRef}
          onScroll={() => syncScroll('labels')}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: LABEL_WIDTH,
            zIndex: 30,
            background: 'var(--mantine-color-dark-7)',
            borderRight: '2px solid var(--mantine-color-gray-5)',
            overflowY: 'auto',
            overflowX: 'hidden',
            scrollbarWidth: 'none',
          }}
        >
          {/* Spacer para alinhar com header do eixo X */}
          <div style={{ height: 32, borderBottom: '1px solid var(--mantine-color-dark-4)', display: 'flex', alignItems: 'center', padding: '0 8px', position: 'sticky', top: 0, background: 'var(--mantine-color-dark-7)', zIndex: 5 }}>
            <Text size="xs" fw={600} c="dimmed">Máquina / Recurso</Text>
          </div>
          {/* Labels */}
          {gruposProcesso.map((grupo, gi) => (
            <div key={gi}>
              <div style={{ height: 28, display: 'flex', alignItems: 'center', padding: '0 8px', background: 'var(--mantine-color-dark-6)', borderBottom: '1px solid var(--mantine-color-dark-4)' }}>
                <Text size="10px" fw={700} tt="uppercase" c="yellow">{grupo.tipoProcesso}</Text>
              </div>
              {grupo.raias.map((raia, ri) => (
                <div key={ri} style={{ height: RAIA_HEIGHT, display: 'flex', alignItems: 'center', padding: '0 8px', borderBottom: '1px solid var(--mantine-color-dark-5)' }}>
                  <Text size="xs" lineClamp={2}>{raia.centroProducao}</Text>
                </div>
              ))}
            </div>
          ))}
        </div>

        {/* ═══ ÁREA DO GANTT (scroll X + Y, com padding-left para não sobrepor a coluna) ═══ */}
        <div
          ref={ganttRef}
          onScroll={() => syncScroll('gantt')}
          style={{ position: 'absolute', left: LABEL_WIDTH, top: 0, right: 0, bottom: 0, overflow: 'auto' }}
        >
          <div style={{ width: totalWidth, minHeight: totalContentHeight + 32, position: 'relative' }}>
            {/* Eixo X (sticky top) */}
            <div style={{ height: 32, position: 'sticky', top: 0, zIndex: 10, background: 'var(--mantine-color-dark-7)', borderBottom: '1px solid var(--mantine-color-dark-4)' }}>
              {hourMarkers.map((m, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  left: ((m.ms - minTime) / 60000) * pixelsPorMinuto,
                  top: 0, height: '100%',
                  borderLeft: `1px ${m.isNewDay ? 'solid' : 'dashed'} var(--mantine-color-dark-${m.isNewDay ? '3' : '5'})`,
                  paddingLeft: 4, display: 'flex', alignItems: 'center',
                }}>
                  <Text size="10px" c="dimmed" fw={m.isNewDay ? 700 : 400}>
                    {m.isNewDay ? new Date(m.ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' : ''}{m.label}
                  </Text>
                </div>
              ))}
            </div>

            {/* Grid lines */}
            {hourMarkers.map((m, i) => (
              <div key={`g${i}`} style={{
                position: 'absolute',
                left: ((m.ms - minTime) / 60000) * pixelsPorMinuto,
                top: 32, height: totalContentHeight,
                borderLeft: `1px ${m.isNewDay ? 'solid' : 'dashed'} var(--mantine-color-dark-${m.isNewDay ? '4' : '6'})`,
                pointerEvents: 'none',
              }} />
            ))}

            {/* Linha "agora" */}
            {agora >= minTime && agora <= maxTime && (
              <div style={{
                position: 'absolute',
                left: ((agora - minTime) / 60000) * pixelsPorMinuto,
                top: 0, height: '100%', width: 2, background: '#ff1744', zIndex: 8, pointerEvents: 'none',
              }} />
            )}

            {/* Marcadores de entrega (triângulos) */}
            {entregaMarkers.map((e, i) => (
              <Tooltip key={i} label={`Prazo OP ${e.opNumero}: ${new Date(e.ms).toLocaleDateString('pt-BR')}`}>
                <div style={{
                  position: 'absolute',
                  left: ((e.ms - minTime) / 60000) * pixelsPorMinuto - 6,
                  top: 32, width: 0, height: 0,
                  borderLeft: '6px solid transparent', borderRight: '6px solid transparent',
                  borderTop: '10px solid #ff1744', zIndex: 9, cursor: 'pointer',
                }} />
              </Tooltip>
            ))}

            {/* Barras */}
            {gruposProcesso.map((grupo, gi) => {
              const offsetY = 32 + gruposProcesso.slice(0, gi).reduce((acc, g) => acc + 28 + g.raias.length * RAIA_HEIGHT, 0)
              return grupo.raias.map((raia, ri) => {
                const raiaTop = offsetY + 28 + ri * RAIA_HEIGHT
                return raia.barras.map((bar, bi) => {
                  const barLeft = ((bar.inicioMs - minTime) / 60000) * pixelsPorMinuto
                  const barWidth = Math.max(20, ((bar.fimMs - bar.inicioMs) / 60000) * pixelsPorMinuto)
                  const setupWidth = bar.tempoSetupMinutos > 0 ? Math.max(4, bar.tempoSetupMinutos * pixelsPorMinuto) : 0
                  const color = getOpColor(bar.opId, opColorMap)
                  const borderColor = STATUS_BORDER[bar.indicador] || '#9e9e9e'
                  const isActive = bar.status === 'EM_ANDAMENTO'

                  return (
                    <Tooltip
                      key={`${gi}-${ri}-${bi}`}
                      multiline w={300}
                      label={
                        <div>
                          <Text size="xs" fw={700}>OP {bar.opNumero} — {bar.produtoNome || bar.descricao}</Text>
                          <Text size="xs">{bar.clienteNome || '—'} | Qtd: {bar.quantidade.toLocaleString('pt-BR')}</Text>
                          <Text size="xs" c="dimmed">Setup: {formatMinutos(bar.tempoSetupMinutos)} | Operação: {formatMinutos(bar.tempoTotalPrevisto - bar.tempoSetupMinutos)}</Text>
                          <Text size="xs" c="dimmed">Previsto: {formatHora(bar.inicioMs)} → {formatHora(bar.fimMs)}</Text>
                          {bar.tempoRealMinutos !== null && <Text size="xs" c="dimmed">Real: {formatMinutos(bar.tempoRealMinutos)}</Text>}
                          {bar.dataEntrega && <Text size="xs" c={bar.riscoEntrega ? 'red' : 'green'}>Entrega: {new Date(bar.dataEntrega).toLocaleDateString('pt-BR')}{bar.riscoEntrega ? ' ⚠️ RISCO' : ' ✓'}</Text>}
                        </div>
                      }
                    >
                      <div style={{ position: 'absolute', top: raiaTop + 8, left: barLeft, width: barWidth, height: RAIA_HEIGHT - 16 }}>
                        {/* Setup block */}
                        {setupWidth > 0 && (
                          <div style={{
                            position: 'absolute', left: 0, top: 0, width: setupWidth, height: '100%',
                            background: `${color}88`, borderRadius: '4px 0 0 4px',
                            borderLeft: `3px solid ${borderColor}`,
                          }} />
                        )}
                        {/* Main bar */}
                        <div style={{
                          position: 'absolute', left: setupWidth, top: 0,
                          width: barWidth - setupWidth, height: '100%',
                          background: bar.indicador === 'AGUARDANDO' ? `${color}55` : color,
                          borderRadius: setupWidth > 0 ? '0 4px 4px 0' : 4,
                          border: `2px solid ${borderColor}`,
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', padding: '0 6px',
                          overflow: 'hidden',
                          boxShadow: isActive ? `0 0 8px ${color}` : undefined,
                          animation: isActive ? 'pulse-gantt 2s infinite' : undefined,
                        }}>
                          <div style={{ overflow: 'hidden', width: '100%' }}>
                            <Text size="9px" c="white" fw={700} lineClamp={1}>
                              OP{bar.opNumero} {bar.produtoNome ? `- ${bar.produtoNome.slice(0, 25)}` : ''}
                            </Text>
                            <Text size="8px" c="rgba(255,255,255,0.8)" lineClamp={1}>
                              x{bar.quantidade.toLocaleString('pt-BR')} | {formatMinutos(bar.tempoTotalPrevisto)}
                            </Text>
                          </div>
                        </div>
                        {/* Seta de dependência (da etapa anterior) */}
                        {bar.opEtapaAnteriorCentro && bar.opEtapaAnteriorCentro !== bar.centroProducao && (
                          <div style={{
                            position: 'absolute', left: -12, top: '50%', transform: 'translateY(-50%)',
                            width: 0, height: 0,
                            borderTop: '5px solid transparent', borderBottom: '5px solid transparent',
                            borderLeft: `8px solid ${color}`,
                            opacity: 0.8,
                          }} />
                        )}
                      </div>
                    </Tooltip>
                  )
                })
              })
            })}
          </div>
        </div>
      </Paper>

      <style>{`
        @keyframes pulse-gantt { 0%,100% { opacity: 1; } 50% { opacity: 0.8; } }
        div::-webkit-scrollbar { width: 6px; height: 6px; }
        div::-webkit-scrollbar-thumb { background: #555; border-radius: 3px; }
      `}</style>
    </Stack>
  )
}
