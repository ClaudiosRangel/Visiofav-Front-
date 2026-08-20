'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  Title, Stack, Group, Text, Loader, Center, Badge, Paper, Box,
  Tooltip, Select, TextInput, SegmentedControl, ActionIcon,
} from '@mantine/core'
import {
  IconSearch, IconTimeline, IconZoomIn, IconZoomOut, IconRefresh,
} from '@tabler/icons-react'
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
  clienteNome: string | null
  descricao: string
  centroProducao: string
  tipoProcesso: string
  inicioMs: number
  fimMs: number
  inicioRealMs: number | null
  fimRealMs: number | null
  indicador: string
  status: string
  tempoTotalPrevisto: number
  tempoRealMinutos: number | null
  prioridade: string
}

interface Raia {
  tipoProcesso: string
  centroProducao: string
  barras: GanttBar[]
}

// ============================================================================
// CONSTANTS
// ============================================================================

const INDICADOR_COLORS: Record<string, string> = {
  NO_TEMPO: '#40c057',
  ADIANTADO: '#228be6',
  ATRASADO: '#fa5252',
  PARADA: '#fd7e14',
  AGUARDANDO: '#868e96',
  CONCLUIDO: '#12b886',
}

const PRIORIDADE_COLORS: Record<string, string> = {
  BAIXA: '#868e96',
  NORMAL: '#228be6',
  ALTA: '#fd7e14',
  URGENTE: '#fa5252',
}

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
  const sinal = min < 0 ? '-' : ''
  if (h === 0) return `${sinal}${m}min`
  return `${sinal}${h}h${m > 0 ? `${m}min` : ''}`
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function GanttPage() {
  useEffect(() => { document.title = 'PCP - Gantt de Produção' }, [])

  const [loading, setLoading] = useState(true)
  const [timeline, setTimeline] = useState<OpTimeline[]>([])
  const [busca, setBusca] = useState('')
  const [zoom, setZoom] = useState(1) // pixels por minuto
  const [visao, setVisao] = useState<'8h' | '24h' | '3d' | '7d'>('24h')

  async function carregar() {
    setLoading(true)
    try {
      const { data } = await api.get('/pcp/timeline')
      setTimeline(data.timeline)
    } catch {
      notifications.show({ title: 'Erro', message: 'Falha ao carregar timeline', color: 'red' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar() }, [])
  useEffect(() => {
    const interval = setInterval(carregar, 60000)
    return () => clearInterval(interval)
  }, [])

  // Calcular zoom baseado na visão selecionada
  const pixelsPorMinuto = useMemo(() => {
    switch (visao) {
      case '8h': return 3
      case '24h': return 1.2
      case '3d': return 0.4
      case '7d': return 0.17
      default: return 1.2
    }
  }, [visao])

  // Transformar timeline (por OP) em raias (por máquina)
  const { raias, minTime, maxTime } = useMemo(() => {
    const raiaMap = new Map<string, Raia>()
    let minT = Infinity
    let maxT = -Infinity

    for (const op of timeline) {
      // Filtro por busca
      if (busca) {
        const termo = busca.toLowerCase()
        const match = op.opNumero.toLowerCase().includes(termo) ||
          (op.clienteNome || '').toLowerCase().includes(termo) ||
          (op.produtoNome || '').toLowerCase().includes(termo)
        if (!match) continue
      }

      for (const etapa of op.etapas) {
        if (!etapa.centroProducao || !etapa.tipoProcesso) continue
        if (!etapa.inicioPrevistoAt || !etapa.fimPrevistoAt) continue

        const key = `${etapa.tipoProcesso}||${etapa.centroProducao}`
        if (!raiaMap.has(key)) {
          raiaMap.set(key, {
            tipoProcesso: etapa.tipoProcesso,
            centroProducao: etapa.centroProducao,
            barras: [],
          })
        }

        const inicioMs = new Date(etapa.inicioPrevistoAt).getTime()
        const fimMs = new Date(etapa.fimPrevistoAt).getTime()
        const inicioRealMs = etapa.inicioRealAt ? new Date(etapa.inicioRealAt).getTime() : null
        const fimRealMs = etapa.fimRealAt ? new Date(etapa.fimRealAt).getTime() : null

        // Usar real quando disponível, previsto quando não
        const barInicioMs = inicioRealMs || inicioMs
        const barFimMs = fimRealMs || (etapa.status === 'EM_ANDAMENTO' ? Date.now() : fimMs)

        if (barInicioMs < minT) minT = barInicioMs
        if (barFimMs > maxT) maxT = barFimMs

        raiaMap.get(key)!.barras.push({
          etapaId: etapa.id,
          opNumero: op.opNumero,
          clienteNome: op.clienteNome,
          descricao: etapa.descricao,
          centroProducao: etapa.centroProducao,
          tipoProcesso: etapa.tipoProcesso,
          inicioMs,
          fimMs,
          inicioRealMs,
          fimRealMs,
          indicador: etapa.indicador,
          status: etapa.status,
          tempoTotalPrevisto: etapa.tempoTotalPrevisto,
          tempoRealMinutos: etapa.tempoRealMinutos,
          prioridade: op.prioridade,
        })
      }
    }

    // Ordenar barras por início dentro de cada raia
    for (const raia of raiaMap.values()) {
      raia.barras.sort((a, b) => a.inicioMs - b.inicioMs)
    }

    // Ordenar raias por tipo de processo (ordem da programação)
    const raiasArr = Array.from(raiaMap.values())
    // Agrupar por tipoProcesso e ordenar internamente por centro
    raiasArr.sort((a, b) => {
      if (a.tipoProcesso !== b.tipoProcesso) return a.tipoProcesso.localeCompare(b.tipoProcesso)
      return a.centroProducao.localeCompare(b.centroProducao)
    })

    // Se não há dados, usar 24h a partir de agora
    if (minT === Infinity) {
      minT = Date.now() - 4 * 60 * 60 * 1000
      maxT = Date.now() + 20 * 60 * 60 * 1000
    }

    // Expandir margem
    minT -= 30 * 60 * 1000 // 30min antes
    maxT += 60 * 60 * 1000 // 1h depois

    return { raias: raiasArr, minTime: minT, maxTime: maxT }
  }, [timeline, busca])

  const totalMinutos = (maxTime - minTime) / 60000
  const totalWidth = totalMinutos * pixelsPorMinuto
  const RAIA_HEIGHT = 44
  const LABEL_WIDTH = 220
  const agora = Date.now()

  // Gerar marcadores de hora para o eixo X
  const hourMarkers = useMemo(() => {
    const markers: Array<{ ms: number; label: string }> = []
    const startHour = new Date(minTime)
    startHour.setMinutes(0, 0, 0)
    let cursor = startHour.getTime()
    while (cursor < maxTime) {
      if (cursor >= minTime) {
        const d = new Date(cursor)
        const label = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        markers.push({ ms: cursor, label })
      }
      cursor += 60 * 60 * 1000 // a cada hora
    }
    return markers
  }, [minTime, maxTime])

  // Agrupar raias por tipo de processo para exibir headers
  const gruposProcesso = useMemo(() => {
    const grupos: Array<{ tipoProcesso: string; raias: Raia[] }> = []
    let grupoAtual: { tipoProcesso: string; raias: Raia[] } | null = null
    for (const raia of raias) {
      if (!grupoAtual || grupoAtual.tipoProcesso !== raia.tipoProcesso) {
        grupoAtual = { tipoProcesso: raia.tipoProcesso, raias: [] }
        grupos.push(grupoAtual)
      }
      grupoAtual.raias.push(raia)
    }
    return grupos
  }, [raias])

  if (loading && timeline.length === 0) {
    return <Center h={400}><Loader size="lg" /></Center>
  }

  return (
    <Stack p="md" gap="sm" h="calc(100vh - 80px)">
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
            style={{ width: 200 }}
          />
          <SegmentedControl
            size="xs"
            value={visao}
            onChange={(v) => setVisao(v as any)}
            data={[
              { value: '8h', label: '8h' },
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
        <Badge size="xs" color="green" variant="filled">No tempo</Badge>
        <Badge size="xs" color="blue" variant="filled">Adiantado</Badge>
        <Badge size="xs" color="red" variant="filled">Atrasado</Badge>
        <Badge size="xs" color="orange" variant="filled">Parada</Badge>
        <Badge size="xs" color="gray" variant="filled">Aguardando</Badge>
        <Badge size="xs" color="teal" variant="filled">Concluído</Badge>
      </Group>

      {/* Gantt */}
      <Paper withBorder radius="md" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {/* Container principal com scroll vertical */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          <div style={{ display: 'inline-flex', minWidth: '100%' }}>
            {/* Coluna fixa de labels */}
            <div style={{
              position: 'sticky',
              left: 0,
              zIndex: 20,
              width: LABEL_WIDTH,
              minWidth: LABEL_WIDTH,
              background: 'var(--mantine-color-body)',
              borderRight: '1px solid var(--mantine-color-gray-3)',
            }}>
              {/* Header da coluna */}
              <div style={{
                height: 28,
                display: 'flex',
                alignItems: 'center',
                padding: '0 8px',
                borderBottom: '1px solid var(--mantine-color-gray-3)',
                position: 'sticky',
                top: 0,
                background: 'var(--mantine-color-body)',
                zIndex: 21,
              }}>
                <Text size="xs" fw={600} c="dimmed">Processo / Máquina</Text>
              </div>
              {/* Labels */}
              {gruposProcesso.map((grupo, gi) => (
                <div key={gi}>
                  <div style={{
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '0 8px',
                    background: 'var(--mantine-color-dark-6)',
                    borderBottom: '1px solid var(--mantine-color-gray-2)',
                  }}>
                    <Text size="10px" fw={700} tt="uppercase" c="dimmed">{grupo.tipoProcesso}</Text>
                  </div>
                  {grupo.raias.map((raia, ri) => (
                    <div key={ri} style={{
                      height: RAIA_HEIGHT,
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 8px',
                      borderBottom: '1px solid var(--mantine-color-gray-1)',
                    }}>
                      <Text size="xs" lineClamp={2} title={raia.centroProducao}>
                        {raia.centroProducao}
                      </Text>
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Área do Gantt (scrollável) */}
            <div style={{ width: totalWidth, position: 'relative' }}>
              {/* Eixo X (horas) — sticky no topo */}
              <div style={{
                height: 28,
                position: 'sticky',
                top: 0,
                background: 'var(--mantine-color-body)',
                zIndex: 15,
                borderBottom: '1px solid var(--mantine-color-gray-3)',
              }}>
                {hourMarkers.map((m, i) => {
                  const left = ((m.ms - minTime) / 60000) * pixelsPorMinuto
                  const isNewDay = new Date(m.ms).getHours() === 0
                  return (
                    <div key={i} style={{
                      position: 'absolute',
                      left,
                      top: 0,
                      height: '100%',
                      borderLeft: `1px ${isNewDay ? 'solid' : 'dashed'} var(--mantine-color-gray-${isNewDay ? '5' : '2'})`,
                      paddingLeft: 4,
                      display: 'flex',
                      alignItems: 'center',
                    }}>
                      <Text size="10px" c="dimmed" fw={isNewDay ? 700 : 400}>
                        {isNewDay ? new Date(m.ms).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' : ''}
                        {m.label}
                      </Text>
                    </div>
                  )
                })}
              </div>

              {/* Linhas de grade (horas) */}
              {hourMarkers.map((m, i) => {
                const left = ((m.ms - minTime) / 60000) * pixelsPorMinuto
                const isNewDay = new Date(m.ms).getHours() === 0
                const totalRaiaHeight = gruposProcesso.reduce(
                  (acc, g) => acc + 24 + g.raias.length * RAIA_HEIGHT, 0
                )
                return (
                  <div key={i} style={{
                    position: 'absolute',
                    left,
                    top: 28,
                    height: totalRaiaHeight,
                    borderLeft: `1px ${isNewDay ? 'solid' : 'dashed'} var(--mantine-color-gray-${isNewDay ? '4' : '1'})`,
                    pointerEvents: 'none',
                  }} />
                )
              })}

              {/* Linha "agora" */}
              {agora >= minTime && agora <= maxTime && (
                <div style={{
                  position: 'absolute',
                  left: ((agora - minTime) / 60000) * pixelsPorMinuto,
                  top: 0,
                  height: '100%',
                  width: 2,
                  background: '#fa5252',
                  zIndex: 10,
                  pointerEvents: 'none',
                }}>
                  <div style={{
                    position: 'absolute',
                    top: 26,
                    left: -3,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: '#fa5252',
                  }} />
                </div>
              )}

              {/* Barras por raia */}
              {gruposProcesso.map((grupo, gi) => {
                const offsetY = 28 + gruposProcesso.slice(0, gi).reduce(
                  (acc, g) => acc + 24 + g.raias.length * RAIA_HEIGHT, 0
                )
                return grupo.raias.map((raia, ri) => {
                  const raiaTop = offsetY + 24 + ri * RAIA_HEIGHT
                  return raia.barras.map((bar, bi) => {
                    const barLeft = ((bar.inicioMs - minTime) / 60000) * pixelsPorMinuto
                    const barWidth = Math.max(4, ((bar.fimMs - bar.inicioMs) / 60000) * pixelsPorMinuto)
                    const color = INDICADOR_COLORS[bar.indicador] || '#868e96'
                    const isEmAndamento = bar.status === 'EM_ANDAMENTO'

                    return (
                      <Tooltip
                        key={`${gi}-${ri}-${bi}`}
                        multiline
                        w={280}
                        label={
                          <div>
                            <Text size="xs" fw={700}>OP {bar.opNumero} — {bar.clienteNome || '—'}</Text>
                            <Text size="xs">{bar.descricao}</Text>
                            <Text size="xs" c="dimmed">
                              Previsto: {formatMinutos(bar.tempoTotalPrevisto)}
                              {bar.tempoRealMinutos !== null && ` | Real: ${formatMinutos(bar.tempoRealMinutos)}`}
                            </Text>
                            <Text size="xs" c="dimmed">
                              {formatHora(bar.inicioMs)} → {formatHora(bar.fimMs)}
                            </Text>
                            {bar.inicioRealMs && (
                              <Text size="xs" c="dimmed">
                                Real: {formatHora(bar.inicioRealMs)} → {bar.fimRealMs ? formatHora(bar.fimRealMs) : 'em andamento'}
                              </Text>
                            )}
                          </div>
                        }
                      >
                        <div style={{
                          position: 'absolute',
                          top: raiaTop + 8,
                          left: barLeft,
                          width: barWidth,
                          height: RAIA_HEIGHT - 16,
                          background: color,
                          opacity: bar.indicador === 'AGUARDANDO' ? 0.4 : 0.85,
                          borderRadius: 4,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflow: 'hidden',
                          border: isEmAndamento ? '2px solid #fff' : 'none',
                          boxShadow: isEmAndamento ? `0 0 6px ${color}` : undefined,
                          animation: isEmAndamento ? 'pulse-bar 2s infinite' : undefined,
                        }}>
                          {barWidth > 40 && (
                            <Text size="9px" c="white" fw={600} lineClamp={1} px={4}>
                              {bar.opNumero}
                            </Text>
                          )}
                        </div>
                      </Tooltip>
                    )
                  })
                })
              })}
            </div>
          </div>
        </div>
      </Paper>

      {/* CSS para animação */}
      <style>{`
        @keyframes pulse-bar {
          0%, 100% { opacity: 0.85; }
          50% { opacity: 1; }
        }
      `}</style>
    </Stack>
  )
}
