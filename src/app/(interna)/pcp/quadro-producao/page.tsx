'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Box, Group, Progress, Text, ActionIcon, Tooltip } from '@mantine/core'
import { IconMaximize, IconMinimize } from '@tabler/icons-react'
import { api } from '@/lib/api'

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface EtapaAtual {
  opNumero: string
  cliente: string | null
  produto: string | null
  quantidade: number
  quantidadeProduzida: number
  percentual: number
  tempoNaEtapa: number
  operadores: string[]
}

interface Maquina {
  centroId: string
  centroNome: string
  tipoProcesso: string
  status: 'PRODUZINDO' | 'PARADA' | 'OCIOSA'
  etapaAtual: EtapaAtual | null
  ultimoApontamento: string | null
  motivoParada: string | null
}

interface Resumo {
  maquinasAtivas: number
  maquinasParadas: number
  maquinasOciosas: number
  opsConcluídasHoje: number
  producaoHoje: number
  alertasParada: number
}

interface QuadroData {
  resumo: Resumo
  maquinas: Maquina[]
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatarTempo(minutos: number): string {
  if (minutos < 60) return `${minutos}min`
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return m > 0 ? `${h}h ${m}min` : `${h}h`
}

function formatarRelogio(date: Date): string {
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatarData(date: Date): string {
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─── Estilos ────────────────────────────────────────────────────────────────

const COLORS = {
  bg: '#1a1b1e',
  card: '#25262b',
  cardBorder: '#2c2e33',
  green: '#2f9e44',
  orange: '#f76707',
  gray: '#868e96',
  textPrimary: '#c1c2c5',
  textSecondary: '#909296',
  textBright: '#e9ecef',
}

// ─── Componente Principal ───────────────────────────────────────────────────

export default function QuadroProducaoPage() {
  const [data, setData] = useState<QuadroData | null>(null)
  const [clock, setClock] = useState(new Date())
  const [fullscreen, setFullscreen] = useState(false)
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const scrollPosRef = useRef(0)
  const scrollDirectionRef = useRef<'down' | 'up'>('down')

  // Carregar dados
  const carregar = useCallback(async () => {
    try {
      const res = await api.get('/pcp/quadro-producao')
      setData(res.data)
      setUltimaAtualizacao(new Date())
    } catch (err) {
      console.error('[QuadroProducao] Erro ao carregar:', err)
    }
  }, [])

  // Auto-refresh: dados a cada 15s, relógio a cada 1s
  useEffect(() => {
    carregar()
    const dataInterval = setInterval(carregar, 15000)
    const clockInterval = setInterval(() => setClock(new Date()), 1000)
    return () => {
      clearInterval(dataInterval)
      clearInterval(clockInterval)
    }
  }, [carregar])

  // Auto-scroll suave para quando há mais cards do que cabe na tela
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const interval = setInterval(() => {
      const maxScroll = el.scrollHeight - el.clientHeight
      if (maxScroll <= 0) return
      if (scrollDirectionRef.current === 'down') {
        scrollPosRef.current += 1
        if (scrollPosRef.current >= maxScroll) scrollDirectionRef.current = 'up'
      } else {
        scrollPosRef.current -= 1
        if (scrollPosRef.current <= 0) scrollDirectionRef.current = 'down'
      }
      el.scrollTop = scrollPosRef.current
    }, 50)
    return () => clearInterval(interval)
  }, [data])

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.()
      setFullscreen(true)
    } else {
      document.exitFullscreen?.()
      setFullscreen(false)
    }
  }, [])

  useEffect(() => {
    const handler = () => setFullscreen(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', handler)
    return () => document.removeEventListener('fullscreenchange', handler)
  }, [])

  // Título da aba
  useEffect(() => { document.title = 'PCP - Quadro de Produção (TV)' }, [])

  // Wake Lock para manter tela ligada
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null
    async function requestWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen')
        }
      } catch { /* silencioso */ }
    }
    requestWakeLock()
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') requestWakeLock()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      wakeLock?.release()
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [])

  const resumo = data?.resumo
  const maquinas = data?.maquinas || []

  return (
    <Box
      ref={containerRef}
      style={{
        background: COLORS.bg,
        minHeight: '100vh',
        padding: fullscreen ? '20px 24px' : '16px 20px',
        position: fullscreen ? 'fixed' : 'relative',
        inset: fullscreen ? 0 : undefined,
        zIndex: fullscreen ? 9999 : undefined,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <Group justify="space-between" mb="md" wrap="nowrap">
        <Group gap="lg" wrap="nowrap">
          <Text fw={700} size="xl" c={COLORS.textBright} style={{ fontSize: '1.4rem', letterSpacing: '0.5px' }}>
            VIZOR PCP — QUADRO DE PRODUÇÃO
          </Text>
          {resumo && (
            <Group gap="md" wrap="wrap">
              <Badge color="green" label={`🟢 ${resumo.maquinasAtivas} Produzindo`} />
              <Badge color="orange" label={`🟡 ${resumo.maquinasParadas} Parada${resumo.maquinasParadas !== 1 ? 's' : ''}`} />
              <Badge color="gray" label={`⚪ ${resumo.maquinasOciosas} Ociosa${resumo.maquinasOciosas !== 1 ? 's' : ''}`} />
              <Badge color="teal" label={`✅ ${resumo.opsConcluídasHoje} Concluída${resumo.opsConcluídasHoje !== 1 ? 's' : ''}`} />
            </Group>
          )}
        </Group>

        <Group gap="md" wrap="nowrap">
          <Box style={{ textAlign: 'right' }}>
            <Text fw={700} size="lg" c={COLORS.textBright} style={{ fontSize: '1.5rem', fontVariantNumeric: 'tabular-nums' }}>
              {formatarRelogio(clock)}
            </Text>
            <Text size="sm" c={COLORS.textSecondary}>
              {formatarData(clock)}
            </Text>
            {ultimaAtualizacao && (
              <Text size="xs" c={COLORS.textSecondary} style={{ opacity: 0.6 }}>
                Atualizado: {formatarRelogio(ultimaAtualizacao)}
              </Text>
            )}
          </Box>
          <Tooltip label={fullscreen ? 'Sair Fullscreen' : 'Modo TV (Fullscreen)'}>
            <ActionIcon
              variant="subtle"
              color="gray"
              size="lg"
              onClick={toggleFullscreen}
            >
              {fullscreen ? <IconMinimize size={22} /> : <IconMaximize size={22} />}
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* ─── Grid de Cards ─────────────────────────────────────────── */}
      <Box
        ref={scrollRef}
        style={{
          flex: 1,
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px',
          alignContent: 'start',
        }}
      >
        {maquinas.map(maquina => (
          <MaquinaCard key={maquina.centroId} maquina={maquina} />
        ))}

        {maquinas.length === 0 && (
          <Box style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 0' }}>
            <Text size="xl" c={COLORS.textSecondary}>
              Carregando quadro de produção...
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  )
}

// ─── Badge simples (substitui Mantine Badge para controle visual) ───────────

function Badge({ color, label }: { color: string; label: string }) {
  return (
    <Text
      size="sm"
      fw={600}
      c={COLORS.textPrimary}
      style={{
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
        borderRadius: 6,
        padding: '4px 10px',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Text>
  )
}

// ─── Card de Máquina ────────────────────────────────────────────────────────

function MaquinaCard({ maquina }: { maquina: Maquina }) {
  const { status, etapaAtual, centroNome, tipoProcesso, motivoParada } = maquina

  const borderColor = status === 'PRODUZINDO' ? COLORS.green
    : status === 'PARADA' ? COLORS.orange
    : COLORS.gray

  const glowStyle = status === 'PRODUZINDO'
    ? { boxShadow: `0 0 12px color-mix(in srgb, ${COLORS.green} 25%, transparent)` }
    : status === 'PARADA'
    ? { animation: 'pulse-border 2s ease-in-out infinite' }
    : { opacity: 0.7 }

  const statusLabel = status === 'PRODUZINDO' ? '🟢 PRODUZINDO'
    : status === 'PARADA' ? '🟡 PARADA'
    : '⚪ OCIOSA'

  return (
    <Box
      style={{
        background: COLORS.card,
        borderRadius: 10,
        borderLeft: `5px solid ${borderColor}`,
        padding: '16px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minHeight: 200,
        ...glowStyle,
      }}
    >
      {/* Nome da máquina */}
      <Box>
        <Text fw={700} size="md" c={COLORS.textBright} lineClamp={1} style={{ fontSize: '1.05rem' }}>
          {centroNome}
        </Text>
        <Text size="xs" c={COLORS.textSecondary}>{tipoProcesso}</Text>
      </Box>

      {/* Status */}
      <Text fw={600} size="sm" c={borderColor} style={{ letterSpacing: '0.3px' }}>
        {statusLabel}
      </Text>

      {/* Motivo parada */}
      {status === 'PARADA' && motivoParada && (
        <Text size="xs" c={COLORS.orange} fw={500}>{motivoParada}</Text>
      )}

      {/* Info da etapa atual */}
      {etapaAtual ? (
        <>
          <Text fw={600} size="sm" c={COLORS.textBright}>
            OP #{etapaAtual.opNumero}
          </Text>
          {etapaAtual.cliente && (
            <Text size="xs" c={COLORS.textPrimary} lineClamp={1}>{etapaAtual.cliente}</Text>
          )}
          {etapaAtual.produto && (
            <Text size="xs" c={COLORS.textSecondary} lineClamp={1}>{etapaAtual.produto}</Text>
          )}

          {/* Progresso */}
          <Box mt={4}>
            <Group justify="space-between" mb={4}>
              <Text size="xs" c={COLORS.textSecondary}>
                {etapaAtual.quantidadeProduzida.toLocaleString('pt-BR')} / {etapaAtual.quantidade.toLocaleString('pt-BR')}
              </Text>
              <Text size="xs" fw={600} c={COLORS.textPrimary}>{etapaAtual.percentual}%</Text>
            </Group>
            <Progress
              value={etapaAtual.percentual}
              size="lg"
              radius="sm"
              color={etapaAtual.percentual >= 100 ? 'green' : status === 'PARADA' ? 'orange' : 'blue'}
              style={{ background: '#373a40' }}
            />
          </Box>

          {/* Tempo na etapa */}
          <Text size="sm" c={COLORS.textPrimary} mt={4}>
            ⏱ {formatarTempo(etapaAtual.tempoNaEtapa)}
          </Text>

          {/* Operadores */}
          {etapaAtual.operadores.length > 0 && (
            <Box>
              {etapaAtual.operadores.map((op, i) => (
                <Text key={i} size="xs" c={COLORS.textSecondary}>
                  👤 {op}
                </Text>
              ))}
            </Box>
          )}
        </>
      ) : (
        <Box style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Text size="lg" c={COLORS.textSecondary} ta="center">—</Text>
        </Box>
      )}

      {/* CSS para animação de pulse nos cards parados */}
      <style>{`
        @keyframes pulse-border {
          0%, 100% { box-shadow: 0 0 8px color-mix(in srgb, ${COLORS.orange} 20%, transparent); }
          50% { box-shadow: 0 0 20px color-mix(in srgb, ${COLORS.orange} 50%, transparent); }
        }
      `}</style>
    </Box>
  )
}
