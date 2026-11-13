'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Box, Group, Progress, Text, ActionIcon, Tooltip, TextInput } from '@mantine/core'
import { IconMaximize, IconMinimize, IconSearch, IconFilterOff, IconX } from '@tabler/icons-react'
import { api } from '@/lib/api'

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface EtapaAtual {
  opNumero: string
  cliente: string | null
  produto: string | null
  quantidade: number
  quantidadeProduzida: number
  percentual: number
  // Base de contagem por Tipo de Processo (spec base-contagem-por-tipo-processo).
  contagem?: { base: 'UNIDADE' | 'TIRAGEM'; planejado: number; apontado: number; progresso: number }
  tempoNaEtapa: number
  operadores: string[]
}

interface Maquina {
  centroId: string
  centroNome: string
  tipoProcesso: string
  status: 'PRODUZINDO' | 'PARADA' | 'OCIOSA'
  tempoParadaMinutos?: number | null
  paradaDesde?: string | null
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

type StatusFiltro = 'PRODUZINDO' | 'PARADA' | 'OCIOSA'

export default function QuadroProducaoPage() {
  const [data, setData] = useState<QuadroData | null>(null)
  const [clock, setClock] = useState(new Date())
  const [fullscreen, setFullscreen] = useState(false)
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null)

  // ── Filtros (client-side; os dados já vêm completos do backend) ──
  // Status selecionados (vazio = todos). Tipos de processo selecionados
  // (vazio = todos). Busca por nome de máquina. Persistem no auto-refresh.
  const [statusSel, setStatusSel] = useState<Set<StatusFiltro>>(new Set())
  const [processosSel, setProcessosSel] = useState<Set<string>>(new Set())
  const [busca, setBusca] = useState('')
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
    // Reavalia quando os dados OU os filtros mudam (a lista visível muda).
  }, [data, statusSel, processosSel, busca])

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
  const maquinas = useMemo(() => data?.maquinas || [], [data])

  // Lista de tipos de processo distintos presentes (para os chips de processo).
  const processosDisponiveis = useMemo(() => {
    const set = new Set<string>()
    for (const m of maquinas) if (m.tipoProcesso) set.add(m.tipoProcesso)
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [maquinas])

  // Máquinas após aplicar os filtros (status + processo + busca).
  const maquinasFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return maquinas.filter((m) => {
      if (statusSel.size > 0 && !statusSel.has(m.status)) return false
      if (processosSel.size > 0 && !processosSel.has(m.tipoProcesso)) return false
      if (termo) {
        const alvo = `${m.centroNome} ${m.tipoProcesso} ${m.etapaAtual?.opNumero ?? ''} ${m.etapaAtual?.cliente ?? ''} ${m.etapaAtual?.produto ?? ''}`.toLowerCase()
        if (!alvo.includes(termo)) return false
      }
      return true
    })
  }, [maquinas, statusSel, processosSel, busca])

  const temFiltro = statusSel.size > 0 || processosSel.size > 0 || busca.trim().length > 0

  const toggleStatus = useCallback((s: StatusFiltro) => {
    setStatusSel((prev) => {
      const next = new Set(prev)
      if (next.has(s)) next.delete(s)
      else next.add(s)
      return next
    })
  }, [])

  const toggleProcesso = useCallback((p: string) => {
    setProcessosSel((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }, [])

  const limparFiltros = useCallback(() => {
    setStatusSel(new Set())
    setProcessosSel(new Set())
    setBusca('')
  }, [])

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
              {/* Totalizadores CLICÁVEIS = filtro por status (pedido do cliente). */}
              <Badge
                color={COLORS.green}
                label={`🟢 ${resumo.maquinasAtivas} Produzindo`}
                active={statusSel.has('PRODUZINDO')}
                onClick={() => toggleStatus('PRODUZINDO')}
              />
              <Badge
                color={COLORS.orange}
                label={`🟡 ${resumo.maquinasParadas} Parada${resumo.maquinasParadas !== 1 ? 's' : ''}`}
                active={statusSel.has('PARADA')}
                onClick={() => toggleStatus('PARADA')}
              />
              <Badge
                color={COLORS.gray}
                label={`⚪ ${resumo.maquinasOciosas} Ociosa${resumo.maquinasOciosas !== 1 ? 's' : ''}`}
                active={statusSel.has('OCIOSA')}
                onClick={() => toggleStatus('OCIOSA')}
              />
              {/* Concluídas é indicador do dia (não é status de máquina) — informativo. */}
              <Badge color="#099268" label={`✅ ${resumo.opsConcluídasHoje} Concluída${resumo.opsConcluídasHoje !== 1 ? 's' : ''}`} />
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

      {/* ─── Barra de filtros ──────────────────────────────────────── */}
      <Group justify="space-between" mb="sm" wrap="wrap" gap="sm">
        <Group gap={8} wrap="wrap" style={{ flex: 1, minWidth: 0 }}>
          {/* Filtro por TIPO DE PROCESSO (grupos de máquinas) — chips clicáveis. */}
          {processosDisponiveis.map((p) => (
            <Badge
              key={p}
              color="#4c6ef5"
              label={p}
              active={processosSel.has(p)}
              onClick={() => toggleProcesso(p)}
            />
          ))}
        </Group>

        <Group gap="sm" wrap="nowrap">
          <TextInput
            size="xs"
            placeholder="Buscar máquina, OP, cliente..."
            value={busca}
            onChange={(e) => setBusca(e.currentTarget.value)}
            leftSection={<IconSearch size={14} />}
            rightSection={
              busca ? (
                <IconX
                  size={14}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setBusca('')}
                />
              ) : null
            }
            styles={{
              input: {
                background: COLORS.card,
                borderColor: COLORS.cardBorder,
                color: COLORS.textBright,
                width: 240,
              },
            }}
          />
          {temFiltro && (
            <Tooltip label="Limpar filtros">
              <ActionIcon variant="subtle" color="gray" size="md" onClick={limparFiltros}>
                <IconFilterOff size={18} />
              </ActionIcon>
            </Tooltip>
          )}
        </Group>
      </Group>

      {/* Contador de resultado (mostrando X de Y) — só quando há filtro. */}
      {temFiltro && (
        <Text size="xs" c={COLORS.textSecondary} mb={6}>
          Mostrando {maquinasFiltradas.length} de {maquinas.length} máquinas
        </Text>
      )}

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
        {maquinasFiltradas.map(maquina => (
          <MaquinaCard key={maquina.centroId} maquina={maquina} />
        ))}

        {maquinas.length === 0 && (
          <Box style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 0' }}>
            <Text size="xl" c={COLORS.textSecondary}>
              Carregando quadro de produção...
            </Text>
          </Box>
        )}

        {maquinas.length > 0 && maquinasFiltradas.length === 0 && (
          <Box style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '60px 0' }}>
            <Text size="xl" c={COLORS.textSecondary}>
              Nenhuma máquina para os filtros selecionados.
            </Text>
          </Box>
        )}
      </Box>
    </Box>
  )
}

// ─── Badge simples (substitui Mantine Badge para controle visual) ───────────

function Badge({
  color,
  label,
  active,
  onClick,
}: {
  color: string
  label: string
  active?: boolean
  onClick?: () => void
}) {
  const clicavel = typeof onClick === 'function'
  return (
    <Text
      size="sm"
      fw={600}
      c={active ? COLORS.textBright : COLORS.textPrimary}
      onClick={onClick}
      role={clicavel ? 'button' : undefined}
      style={{
        background: active
          ? `color-mix(in srgb, ${color} 45%, transparent)`
          : `color-mix(in srgb, ${color} 15%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} ${active ? 90 : 40}%, transparent)`,
        borderRadius: 6,
        padding: '4px 10px',
        whiteSpace: 'nowrap',
        cursor: clicavel ? 'pointer' : 'default',
        boxShadow: active ? `0 0 10px color-mix(in srgb, ${color} 35%, transparent)` : undefined,
        transition: 'all 0.15s ease',
        userSelect: 'none',
      }}
    >
      {label}
    </Text>
  )
}

// ─── Card de Máquina ────────────────────────────────────────────────────────

function MaquinaCard({ maquina }: { maquina: Maquina }) {
  const { status, etapaAtual, centroNome, tipoProcesso, motivoParada, tempoParadaMinutos } = maquina

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

      {/* Motivo + tempo da parada atual (R3 — pedido do Caio) */}
      {status === 'PARADA' && (
        <Text size="xs" c={COLORS.orange} fw={500}>
          {motivoParada ? `${motivoParada} · ` : ''}
          ⏸ parada há {formatarTempo(tempoParadaMinutos ?? 0)}
        </Text>
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

          {/* Progresso — na BASE DE CONTAGEM do processo (COLAGEM→Unidade;
              demais→Tiragem). Usa `contagem` (fonte única do backend) com
              fallback aos campos legados. */}
          {(() => {
            const apontado = etapaAtual.contagem?.apontado ?? etapaAtual.quantidadeProduzida
            const planejado = etapaAtual.contagem?.planejado ?? etapaAtual.quantidade
            const progresso = etapaAtual.contagem?.progresso ?? etapaAtual.percentual
            const sufixo = etapaAtual.contagem?.base === 'UNIDADE' ? ' un' : etapaAtual.contagem?.base === 'TIRAGEM' ? ' fls' : ''
            return (
              <Box mt={4}>
                <Group justify="space-between" mb={4}>
                  <Text size="xs" c={COLORS.textSecondary}>
                    {apontado.toLocaleString('pt-BR')} / {planejado.toLocaleString('pt-BR')}{sufixo}
                  </Text>
                  <Text size="xs" fw={600} c={COLORS.textPrimary}>{Math.round(progresso)}%</Text>
                </Group>
                <Progress
                  value={progresso}
                  size="lg"
                  radius="sm"
                  color={progresso >= 100 ? 'green' : status === 'PARADA' ? 'orange' : 'blue'}
                  style={{ background: '#373a40' }}
                />
              </Box>
            )
          })()}

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
