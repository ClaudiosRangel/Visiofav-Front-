'use client'

import { useEffect, useState, useMemo, useRef, useCallback } from 'react'
import {
  Title, Stack, Group, Text, Loader, Center, Badge, Paper, Box,
  Tooltip, TextInput, SegmentedControl, ActionIcon, Button,
  Modal, ColorInput, MultiSelect, Select,
} from '@mantine/core'
import {
  IconSearch, IconTimeline, IconRefresh, IconLock, IconLockOpen,
  IconCalendar, IconZoomIn, IconZoomOut, IconPalette, IconAdjustments,
  IconFilterOff, IconFocus2, IconArrowsLeftRight, IconArrowsSort, IconInfoCircle,
} from '@tabler/icons-react'
import { Menu } from '@mantine/core'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'
import { rotuloPlano } from '@/lib/plano-rotulo'
import { empilharBarras, xInicio, xFim, ocupacaoPorDia } from './gantt-layout'

/**
 * Deriva o rótulo de face/plano a partir da descrição da etapa (Spec
 * pcp-visualizacao-planos-gantt, Req 3). A descrição do roteiro multi-plano/
 * retiração traz "<nome> — FRENTE/VERSO/<PLANO>"; extraímos o trecho após o
 * último "—". Sempre normaliza "COSTA" → "VERSO". '' quando não há face/plano.
 */
function faceDaDescricao(descricao: string | null | undefined): string {
  const txt = rotuloPlano(descricao)
  const idx = txt.lastIndexOf('—')
  if (idx < 0) return ''
  const face = txt.slice(idx + 1).trim()
  // Só considera "face" quando é curta (FRENTE/VERSO/TAMPA/CAIXA...), evitando
  // pegar um traço no meio de uma descrição longa sem plano.
  return face.length > 0 && face.length <= 24 ? face : ''
}

// ============================================================================
// TYPES
// ============================================================================

interface EtapaTimeline {
  id: string
  sequencia: number
  descricao: string
  centroProducao: string | null
  centroProducaoId: string | null
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
  agendaTravada?: boolean
  inicioAgendadoManual?: string | null
  turno?: { horaInicio: string; horaFim: string; diasSemana: number[] } | null
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
  // Cor/status por OP (spec pcp-gantt-melhorias, Req 3). Vêm do backend
  // (GET /pcp/timeline → corGantt/statusObs); null = usar COR_PADRAO / sem status.
  corGantt: string | null
  statusObs: string | null
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
  // Rótulo de face/plano derivado da descrição (ex.: "VERSO", "TAMPA"). '' = sem.
  faceLabel: string
  // Nº da passada da MESMA OP neste MESMO centro (1 = 1ª; >1 marca "2ª passada").
  passada: number
  // Âncora de agenda (spec pcp-gantt-travar-mover).
  agendaTravada: boolean
  inicioAgendadoManual: string | null
  // Turno do centro — usado para segmentar a barra por janelas de trabalho.
  turno: { horaInicio: string; horaFim: string; diasSemana: number[] } | null
  // Id do centro — chave para buscar as exceções de calendário na segmentação.
  centroProducaoId: string | null
  // Cor/status por OP (spec pcp-gantt-melhorias, Req 3) — propagados da OP.
  corGantt: string | null
  statusObs: string | null
  // Indicador GERAL da OP (spec pcp-gantt-melhorias, Req 5.1 — filtro por
  // indicador). Propagado de op.indicadorGeral para filtrar as barras.
  indicadorGeral: string
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

// Cor única padrão das barras da OP (spec pcp-gantt-melhorias, Req 3.1 —
// padrão de mercado "event color": uma cor neutra; o usuário personaliza por
// OP). Azul Mantine indigo-6. A cor efetiva = op.corGantt || COR_PADRAO.
const COR_PADRAO = '#4C6EF5'

// Swatches para o editor de cor da OP (cores sólidas Mantine, ~10 opções).
const SWATCHES_COR_OP = [
  '#4C6EF5', '#40C057', '#FA5252', '#FD7E14', '#FAB005',
  '#BE4BDB', '#15AAB1', '#E64980', '#7950F2', '#868E96',
]

// Opções do filtro por indicador (spec pcp-gantt-melhorias, Req 5.1). Os
// valores batem EXATAMENTE com os de `op.indicadorGeral` do payload
// (GET /pcp/timeline): NO_TEMPO | ADIANTADO | ATRASADO | RISCO_ENTREGA | CONCLUIDO.
const OPCOES_INDICADOR: Array<{ value: string; label: string }> = [
  { value: 'ATRASADO', label: 'Atrasado' },
  { value: 'RISCO_ENTREGA', label: 'Risco de entrega' },
  { value: 'NO_TEMPO', label: 'No tempo' },
  { value: 'ADIANTADO', label: 'Adiantado' },
  { value: 'CONCLUIDO', label: 'Concluído' },
]

// Borda de STATUS das barras (esquema RAG — padrão de mercado Office Timeline:
// vermelho=crítico, âmbar=atenção, verde=ok). Tons da paleta Mantine (nível 6),
// harmônicos com o resto do ERP e legíveis sobre a cor saturada do bloco nos
// dois temas (claro/escuro). Spec pcp-gantt-tema-cores.
const STATUS_BORDER: Record<string, string> = {
  ATRASADO: '#fa5252',   // red-6 — crítico
  PARADA: '#fd7e14',     // orange-6 — atenção
  ADIANTADO: '#228be6',  // blue-6
  NO_TEMPO: '#40c057',   // green-6 — ok
  CONCLUIDO: '#12b886',  // teal-6
  AGUARDANDO: '#adb5bd', // gray-5 — neutro
}

const LABEL_WIDTH = 200
// Nota (spec pcp-gantt-melhorias, Req 4.1): as antigas constantes RAIA_HEIGHT/
// SETUP_HEIGHT deixaram de ser usadas após o empilhamento por sub-linhas
// (SUBLINHA_H/alturaDaRaia) — removidas para o build final ficar limpo.

// Ocupação/carga por máquina (spec pcp-gantt-melhorias, Req 7 — "gargalos").
// Limiares da mini-faixa de ocupação média do período no rótulo de cada raia:
// verde < 70%, âmbar 70–100%, vermelho > 100% (sobrecarga). Padrão de mercado
// (Preactor/PlanetTogether: utilização de recurso por faixa de cor).
function corOcupacao(mediaPct: number): string {
  if (mediaPct > 100) return 'var(--mantine-color-red-6)'
  if (mediaPct >= 70) return 'var(--mantine-color-yellow-6)'
  return 'var(--mantine-color-green-6)'
}

// Empilhamento visual (spec pcp-gantt-melhorias, Req 4.1 — padrão Bryntum/DHTMLX
// "stack"): quando barras de uma raia se sobrepõem no tempo, cada uma vai para
// uma SUB-LINHA distinta e a altura da raia cresce com o nº de sub-linhas.
// SUBLINHA_H é a altura de UMA sub-linha. Com 1 sub-linha a raia fica
// ~RAIA_HEIGHT (56), preservando o visual de hoje; a barra ocupa
// SUBLINHA_H - SUBLINHA_GAP de altura.
const SUBLINHA_H = 48
const SUBLINHA_GAP = 16
const alturaDaRaia = (sub: number) => Math.max(1, sub) * SUBLINHA_H

// Zoom contínuo (pixels por minuto): preset por visão + limites de clamp.
const PPM_PRESET: Record<'12h' | '24h' | '3d' | '7d', number> = {
  '12h': 2.5,
  '24h': 1.2,
  '3d': 0.4,
  '7d': 0.17,
}
const PPM_MIN = 0.05
const PPM_MAX = 6
const ZOOM_IN_FATOR = 1.25
const ZOOM_OUT_FATOR = 0.8
const clampPpm = (v: number) => Math.min(PPM_MAX, Math.max(PPM_MIN, v))

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

/** Exceção de calendário de um centro (vinda do backend). */
interface ExcecaoCalendarioFront {
  data: string // "YYYY-MM-DD"
  tipo: string // HORA_EXTRA | DIA_EXTRA | NAO_TRABALHO
  horaInicio: string | null
  horaFim: string | null
}

/** Chave "YYYY-MM-DD" (dia civil local) — igual ao backend (janelaDoDia). */
function chaveDiaLocalFront(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Intervalos NÃO-trabalhados (fora do turno) dentro de [inicioMs, fimMs].
 * Usado para "segmentar" visualmente a barra do Gantt: os vãos noturnos e de
 * fim de semana recebem um overlay, deixando a barra aparecer só nas janelas
 * de trabalho (padrão DHTMLX/Bryntum). Retorna [] quando não há turno.
 *
 * As exceções de calendário (spec pcp-excecoes-calendario-gantt) sobrepõem o
 * turno-base na data: HORA_EXTRA/DIA_EXTRA mostram a janela extra como tempo
 * útil; NAO_TRABALHO esmaece o dia inteiro.
 */
function intervalosForaDoTurno(
  inicioMs: number,
  fimMs: number,
  turno: { horaInicio: string; horaFim: string; diasSemana: number[] } | null,
  excecoes: ExcecaoCalendarioFront[] = [],
): Array<{ ini: number; fim: number }> {
  if (!turno || fimMs <= inicioMs) return []
  const [hIni, mIni] = turno.horaInicio.split(':').map(Number)
  const [hFim, mFim] = turno.horaFim.split(':').map(Number)
  const tIniBase = hIni * 60 + mIni
  const tFimBase = hFim * 60 + mFim
  const dias = turno.diasSemana || []

  const gaps: Array<{ ini: number; fim: number }> = []
  // Varre dia a dia do range, somando os trechos fora do expediente.
  const cursor = new Date(inicioMs)
  cursor.setHours(0, 0, 0, 0)
  let guard = 0
  while (cursor.getTime() <= fimMs && guard < 400) {
    guard++
    const diaConv = cursor.getDay() === 0 ? 7 : cursor.getDay()
    const base = cursor.getTime()

    // Resolve a janela efetiva do dia: exceção da data vence o turno-base.
    const exc = excecoes.find((e) => e.data === chaveDiaLocalFront(cursor))
    let trabalha: boolean
    let tIni = tIniBase
    let tFim = tFimBase
    if (exc) {
      if (exc.tipo === 'NAO_TRABALHO') {
        trabalha = false
      } else if (exc.horaInicio && exc.horaFim) {
        const [ehi, emi] = exc.horaInicio.split(':').map(Number)
        const [ehf, emf] = exc.horaFim.split(':').map(Number)
        const ei = ehi * 60 + emi
        const ef = ehf * 60 + emf
        if (ef > ei) {
          trabalha = true
          tIni = ei
          tFim = ef
        } else {
          trabalha = dias.includes(diaConv) // janela inválida → turno-base
        }
      } else {
        trabalha = dias.includes(diaConv)
      }
    } else {
      trabalha = dias.includes(diaConv)
    }

    if (!trabalha) {
      // Dia inteiro é vão.
      gaps.push({ ini: base, fim: base + 24 * 60 * 60000 })
    } else {
      // Antes da janela (00:00 → tIni) e depois (tFim → 24:00).
      if (tIni > 0) gaps.push({ ini: base, fim: base + tIni * 60000 })
      if (tFim < 24 * 60) gaps.push({ ini: base + tFim * 60000, fim: base + 24 * 60 * 60000 })
    }
    cursor.setDate(cursor.getDate() + 1)
  }
  // Recorta cada gap ao range da barra e descarta os vazios.
  return gaps
    .map((g) => ({ ini: Math.max(g.ini, inicioMs), fim: Math.min(g.fim, fimMs) }))
    .filter((g) => g.fim > g.ini)
}

/** Cor efetiva da OP: a personalizada (corGantt) ou a cor única padrão. */
function corDaOp(corGantt: string | null | undefined): string {
  return corGantt || COR_PADRAO
}

// ============================================================================
// COMPONENT
// ============================================================================

export default function GanttProducaoPage() {
  useEffect(() => { document.title = 'PCP - Gantt de Produção' }, [])

  const [loading, setLoading] = useState(true)
  const [timeline, setTimeline] = useState<OpTimeline[]>([])
  const [conflitos, setConflitos] = useState<any[]>([])
  // Exceções de calendário por centro (spec pcp-excecoes-calendario-gantt).
  const [excecoesPorCentro, setExcecoesPorCentro] = useState<Record<string, ExcecaoCalendarioFront[]>>({})
  const [busca, setBusca] = useState('')
  // ── Filtros visuais (spec pcp-gantt-melhorias, Req 5.1) — NÃO alteram dados,
  // só a montagem das raias/barras. filtroCentros/filtroTipos escondem raias;
  // filtroIndicador esconde as OPs cujo indicadorGeral não bate. ──
  const [filtroCentros, setFiltroCentros] = useState<string[]>([])
  const [filtroTipos, setFiltroTipos] = useState<string[]>([])
  const [filtroIndicador, setFiltroIndicador] = useState<string | null>(null)
  // ── Foco de uma OP (spec pcp-gantt-melhorias, Req 5.2/5.3) — realça a OP e
  // habilita as setas de dependência (overlay SVG). null = sem foco. ──
  const [opEmFoco, setOpEmFoco] = useState<string | null>(null)
  const [visao, setVisao] = useState<'12h' | '24h' | '3d' | '7d'>('24h')
  // Zoom contínuo: ppm é estado numérico, inicializado pelo preset da visão.
  // Trocar a visão no SegmentedControl redefine o ppm base; os botões −/+ e o
  // Ctrl+wheel ajustam continuamente a partir daí (ancorados no viewport/cursor).
  const [pixelsPorMinuto, setPixelsPorMinuto] = useState<number>(PPM_PRESET['24h'])
  // Ancoragem inicial no "agora" só uma vez (não repete em refreshes).
  const jaAncorou = useRef(false)

  // ── Virtualização vertical das raias (spec pcp-gantt-melhorias, Req 8/9) ──
  // Rastreamos a janela vertical visível da área do Gantt (scrollTop + altura do
  // viewport). Ao renderizar as BARRAS, pulamos as raias cujo intervalo vertical
  // está fora de [viewY.top - BUFFER, viewY.top + viewY.height + BUFFER]. Como o
  // container de conteúdo mantém `minHeight: totalContentHeight + 32`, o scroll e
  // as posições absolutas (top) continuam corretos mesmo não desenhando as
  // barras fora da tela. É só vertical — scrollLeft/zoom/âncora de "hoje" intactos.
  // height === 0 (antes da 1ª medição) é tratado como "mostrar tudo" para nunca
  // aparecer tela vazia no 1º render.
  const VIRT_BUFFER = 600
  const [viewY, setViewY] = useState<{ top: number; height: number }>({ top: 0, height: 0 })
  // Throttle via requestAnimationFrame: o onScroll só agenda uma atualização por
  // frame (evita re-render excessivo ao rolar).
  const viewYRafRef = useRef<number | null>(null)

  const labelsRef = useRef<HTMLDivElement>(null)
  const ganttRef = useRef<HTMLDivElement>(null)

  /** Captura scrollTop/clientHeight do ganttRef para a janela de virtualização. */
  const medirViewY = useCallback(() => {
    const el = ganttRef.current
    if (!el) return
    setViewY((prev) => {
      if (prev.top === el.scrollTop && prev.height === el.clientHeight) return prev
      return { top: el.scrollTop, height: el.clientHeight }
    })
  }, [])

  /** Agenda uma medição no próximo frame (throttle simples). */
  const agendarMedirViewY = useCallback(() => {
    if (viewYRafRef.current != null) return
    viewYRafRef.current = requestAnimationFrame(() => {
      viewYRafRef.current = null
      medirViewY()
    })
  }, [medirViewY])

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
      setExcecoesPorCentro(data.excecoesPorCentro || {})
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

  // Medição inicial + ResizeObserver da janela vertical (spec Req 8/9). Mede
  // assim que o ganttRef existe (via rAF, pós-layout) e observa mudanças de
  // tamanho do viewport do Gantt — mantendo viewY.height correto quando a
  // janela/painel redimensiona. Só vertical; não interfere no scrollLeft/zoom.
  useEffect(() => {
    const el = ganttRef.current
    if (!el) return
    // 1ª medição no próximo frame, quando o DOM já tem a altura real.
    const raf = requestAnimationFrame(() => medirViewY())
    const ro = new ResizeObserver(() => agendarMedirViewY())
    ro.observe(el)
    return () => {
      cancelAnimationFrame(raf)
      if (viewYRafRef.current != null) {
        cancelAnimationFrame(viewYRafRef.current)
        viewYRafRef.current = null
      }
      ro.disconnect()
    }
  }, [medirViewY, agendarMedirViewY])

  // ── Edição do Gantt (spec pcp-gantt-travar-mover) ──
  // pixelsPorMinuto vivo num ref para o handler de drag (que não re-renderiza).
  const ppmRef = useRef(1.2)
  // Deslocamento visual otimista por etapa (minutos) durante/após o arraste.
  const [offsetMin, setOffsetMin] = useState<Record<string, number>>({})
  // O dragRef guarda, além do início do drag temporal, o contexto da RAIA de
  // origem (centro + barras ordenadas pela fila visual) — necessário para o
  // modo "reordenar fila" (spec pcp-gantt-melhorias, Req 6), que calcula a
  // posição-alvo na fila ao soltar.
  const dragRef = useRef<{
    etapaId: string
    startX: number
    inicioMs: number
    centroProducaoId: string | null
    // Barras da raia de origem já ordenadas pela fila visual (por inicioMs).
    filaRaia: Array<{ etapaId: string; inicioMs: number }>
  } | null>(null)
  const [salvandoAgenda, setSalvandoAgenda] = useState(false)

  // ── Modo do Gantt (spec pcp-gantt-melhorias, Req 6) ──
  // 'reagendar' = arrastar no tempo trava a etapa numa data (comportamento
  // atual, intacto). 'reordenar' = arrastar troca a ORDEM da fila da máquina
  // (PATCH /pcp/etapas/reordenar), sem travar no tempo. Toggle no cabeçalho
  // para eliminar ambiguidade entre as duas interações de drag.
  const [modoGantt, setModoGantt] = useState<'reagendar' | 'reordenar'>('reagendar')
  // modoRef vivo (igual ao ppmRef): os handlers de pointer são useCallback e
  // capturam o valor no momento da criação; o ref garante que leiam o modo ATUAL.
  const modoRef = useRef<'reagendar' | 'reordenar'>('reagendar')
  modoRef.current = modoGantt
  // Evita duplo-disparo do reordenar enquanto persiste.
  const [reordenandoFila, setReordenandoFila] = useState(false)
  const reordenandoFilaRef = useRef(false)
  reordenandoFilaRef.current = reordenandoFila

  /** Trava a etapa numa data (ISO) — usado pelo drag e pelo menu. */
  async function agendarEtapa(etapaId: string, inicioISO: string) {
    setSalvandoAgenda(true)
    try {
      await api.patch(`/pcp/etapas/${etapaId}/agendar`, { inicio: inicioISO })
      notifications.show({ title: 'Etapa travada', message: 'Agenda fixada nesta data.', color: 'green' })
      setOffsetMin((p) => { const n = { ...p }; delete n[etapaId]; return n })
      await carregar()
    } catch (e: any) {
      notifications.show({ title: 'Não foi possível agendar', message: e?.response?.data?.message || 'Falha ao travar a etapa.', color: 'red' })
      // Reverte o deslocamento otimista (Req 3.5).
      setOffsetMin((p) => { const n = { ...p }; delete n[etapaId]; return n })
    } finally {
      setSalvandoAgenda(false)
    }
  }

  /** Destrava a etapa (volta ao cálculo automático). */
  async function destravarEtapa(etapaId: string) {
    setSalvandoAgenda(true)
    try {
      await api.patch(`/pcp/etapas/${etapaId}/destravar`, {})
      notifications.show({ title: 'Etapa destravada', message: 'Agenda volta ao cálculo automático.', color: 'blue' })
      await carregar()
    } catch (e: any) {
      notifications.show({ title: 'Erro', message: e?.response?.data?.message || 'Falha ao destravar.', color: 'red' })
    } finally {
      setSalvandoAgenda(false)
    }
  }

  /**
   * Reordena a fila de um centro (spec pcp-gantt-melhorias, Req 6). Persiste a
   * nova ordem via `PATCH /pcp/etapas/reordenar` (o backend renumera
   * `posicaoFila` 1..N na ordem recebida, isolado por `empresaId`), notifica e
   * recarrega. NÃO mexe em travas/âncoras: reordenar só muda a fila; o motor
   * (no-overlap) re-sequencia respeitando as etapas travadas (pontos fixos).
   * `reordenandoFila` evita duplo-disparo.
   */
  async function reordenarFilaCentro(centroProducaoId: string, etapaIds: string[]) {
    if (reordenandoFilaRef.current) return
    setReordenandoFila(true)
    try {
      await api.patch('/pcp/etapas/reordenar', { centroProducaoId, etapaIds })
      notifications.show({ title: 'Fila reordenada', message: 'Nova ordem da máquina aplicada.', color: 'green' })
      await carregar()
    } catch (e: any) {
      notifications.show({
        title: 'Não foi possível reordenar',
        message: e?.response?.data?.message || 'Falha ao reordenar a fila da máquina.',
        color: 'red',
      })
    } finally {
      setReordenandoFila(false)
    }
  }

  // ── Resolver conflitos em 1 clique (spec pcp-gantt-melhorias, Req 4.4) ──
  // Para cada máquina (centro) que aparece nos conflitos, reaplica a fila
  // sequencial: pega as etapas daquela raia ordenadas por início e chama
  // `PATCH /pcp/etapas/reordenar` com os ids nessa ordem. O backend renumera a
  // `posicaoFila` e o motor (no-overlap) sequencia um job após o outro,
  // eliminando a sobreposição. Depois `carregar()` recalcula a cascata.
  const [resolvendoConflitos, setResolvendoConflitos] = useState(false)

  /**
   * Monta, a partir dos `conflitos` + das `raias` já montadas, o conjunto de
   * centros conflitantes e, para cada um, a lista de etapaIds ordenada por
   * `inicioMs`. Reordena cada centro no backend e recarrega.
   */
  async function resolverConflitos() {
    if (conflitos.length === 0 || resolvendoConflitos) return
    setResolvendoConflitos(true)
    try {
      // Centros em conflito (o conflito expõe o centro pela DESCRIÇÃO).
      const descricoesEmConflito = new Set<string>(
        conflitos.map((c: any) => c.centroProducao).filter(Boolean),
      )
      // Casar a descrição do conflito com as raias já montadas (que têm o id de
      // centro em cada barra). Monta centroProducaoId → etapaIds ordenados.
      const reordenacoes: Array<{ centroProducaoId: string; etapaIds: string[] }> = []
      for (const raia of raias) {
        if (!descricoesEmConflito.has(raia.centroProducao)) continue
        // Id do centro: vem das barras (todas as barras da raia são do mesmo
        // centro). Pula com segurança se nenhuma barra tiver o id (raro).
        const centroProducaoId = raia.barras.find((b) => b.centroProducaoId)?.centroProducaoId
        if (!centroProducaoId) continue
        const etapaIds = [...raia.barras]
          .sort((a, b) => a.inicioMs - b.inicioMs)
          .map((b) => b.etapaId)
        if (etapaIds.length > 0) reordenacoes.push({ centroProducaoId, etapaIds })
      }

      if (reordenacoes.length === 0) {
        notifications.show({
          title: 'Nada a resolver',
          message: 'Não foi possível identificar as máquinas em conflito.',
          color: 'yellow',
        })
        return
      }

      for (const r of reordenacoes) {
        await api.patch('/pcp/etapas/reordenar', r)
      }
      await carregar()
      notifications.show({
        title: 'Conflitos resolvidos',
        message: `${reordenacoes.length} máquina${reordenacoes.length > 1 ? 's' : ''} resequenciada${reordenacoes.length > 1 ? 's' : ''}.`,
        color: 'green',
      })
    } catch (e: any) {
      notifications.show({
        title: 'Falha ao resolver conflitos',
        message: e?.response?.data?.message || 'Não foi possível reaplicar a fila das máquinas.',
        color: 'red',
      })
    } finally {
      setResolvendoConflitos(false)
    }
  }

  // ── Editor de cor/status por OP (spec pcp-gantt-melhorias, Req 3) ──
  // Como o Menu fecha ao clicar, guardamos a OP em edição num estado e abrimos
  // um Modal controlado por ele (fora do loop de barras).
  const [editandoOp, setEditandoOp] = useState<{
    opId: string; opNumero: string; corAtual: string | null; statusAtual: string | null
  } | null>(null)
  // Rascunho do editor (cor hex e texto de status).
  const [corEdit, setCorEdit] = useState<string>('')
  const [statusEdit, setStatusEdit] = useState<string>('')
  const [salvandoGantt, setSalvandoGantt] = useState(false)

  /**
   * Alterna o foco da OP (spec pcp-gantt-melhorias, Req 5.2/5.3). Clicar de novo
   * na mesma OP limpa. Como a barra já tem um Menu (trigger="click") e um drag
   * por pointer, o clique direto na barra é ambíguo (abre o menu / inicia o
   * drag); por isso o foco é acionado por um item do Menu — abordagem robusta
   * que NÃO quebra nem o menu nem o drag (decisão documentada no relatório).
   */
  const alternarFocoOp = useCallback((opId: string) => {
    setOpEmFoco((atual) => (atual === opId ? null : opId))
  }, [])

  /** Abre o editor de cor/status para uma OP (a partir do menu do bloco). */
  function abrirEditorCorStatus(bar: GanttBar) {
    setEditandoOp({
      opId: bar.opId,
      opNumero: bar.opNumero,
      corAtual: bar.corGantt,
      statusAtual: bar.statusObs,
    })
    setCorEdit(bar.corGantt || COR_PADRAO)
    setStatusEdit(bar.statusObs || '')
  }

  /**
   * Salva cor/status via PATCH .../gantt. A cor hex do ColorInput do Mantine é
   * "#rrggbb" (compatível com a regex do backend); status vazio vira null.
   */
  async function salvarCorStatus(corGantt: string | null, statusGanttObs: string | null) {
    if (!editandoOp) return
    const { opId } = editandoOp
    setSalvandoGantt(true)
    try {
      await api.patch(`/pcp/ordens-producao/${opId}/gantt`, { corGantt, statusGanttObs })
      await carregar()
      setEditandoOp(null)
      notifications.show({ title: 'Cor e status atualizados', message: `OP ${editandoOp.opNumero} atualizada.`, color: 'green' })
    } catch (e: any) {
      notifications.show({
        title: 'Não foi possível salvar',
        message: e?.response?.data?.message || 'Falha ao atualizar cor/status da OP.',
        color: 'red',
      })
      // Mantém o modal aberto para o usuário corrigir (padrão do arquivo).
    } finally {
      setSalvandoGantt(false)
    }
  }

  // Pointer drag: início no bloco, delta horizontal → delta de minutos.
  // Recebe também a lista de barras da RAIA de origem (fila daquele centro) para
  // o modo "reordenar fila" (spec Req 6) poder calcular a posição-alvo ao soltar.
  const onBarPointerDown = useCallback((e: React.PointerEvent, bar: GanttBar, barrasDaRaia: GanttBar[]) => {
    // Só botão esquerdo; ignora se já salvando.
    if (e.button !== 0) return
    e.preventDefault()
    // Fila visual da raia = barras ordenadas por inicioMs (mesma ordem exibida).
    const filaRaia = [...barrasDaRaia]
      .sort((a, b) => a.inicioMs - b.inicioMs)
      .map((b) => ({ etapaId: b.etapaId, inicioMs: b.inicioMs }))
    dragRef.current = {
      etapaId: bar.etapaId,
      startX: e.clientX,
      inicioMs: bar.inicioMs,
      centroProducaoId: bar.centroProducaoId,
      filaRaia,
    }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }, [])

  const onBarPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const deltaPx = e.clientX - d.startX
    const deltaMin = deltaPx / (ppmRef.current || 1.2)
    setOffsetMin((p) => ({ ...p, [d.etapaId]: deltaMin }))
  }, [])

  const onBarPointerUp = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current
    dragRef.current = null
    if (!d) return
    const deltaPx = e.clientX - d.startX
    const deltaMin = deltaPx / (ppmRef.current || 1.2)
    // Ignora cliques (sem arraste significativo) — < 3px.
    if (Math.abs(deltaPx) < 3) return

    // ── Ramificação por MODO (spec pcp-gantt-melhorias, Req 6) — lê o modo VIVO
    // via modoRef (o handler é useCallback e capturaria o valor antigo). ──
    if (modoRef.current === 'reordenar') {
      // Limpa o offset otimista: no modo reordenar o drag NÃO desloca a barra no
      // tempo (não chama agendarEtapa); só reposiciona na fila do MESMO centro.
      setOffsetMin((p) => { const n = { ...p }; delete n[d.etapaId]; return n })
      if (!d.centroProducaoId) return
      const fila = d.filaRaia
      const idxAtual = fila.findIndex((f) => f.etapaId === d.etapaId)
      if (idxAtual < 0 || fila.length < 2) return

      // Posição X (ms) do cursor ao soltar = início da barra + deslocamento.
      const msSolto = d.inicioMs + deltaMin * 60000
      // Índice-alvo = nº de OUTRAS barras cujo início (fila atual) é menor que o
      // ponto solto. Robusto (não depende de pixels perfeitos): compara ms↔ms.
      let idxAlvo = 0
      for (const f of fila) {
        if (f.etapaId === d.etapaId) continue
        if (f.inicioMs < msSolto) idxAlvo++
      }
      idxAlvo = Math.max(0, Math.min(fila.length - 1, idxAlvo))
      if (idxAlvo === idxAtual) return // sem mudança → não dispara request

      // Monta a nova ordem movendo a etapa arrastada de idxAtual para idxAlvo.
      const etapaIds = fila.map((f) => f.etapaId)
      etapaIds.splice(idxAtual, 1)
      etapaIds.splice(idxAlvo, 0, d.etapaId)
      reordenarFilaCentro(d.centroProducaoId, etapaIds)
      return
    }

    // Modo 'reagendar' (comportamento atual, intacto): trava a etapa na data.
    // Snap a 15 min.
    const snapped = Math.round((d.inicioMs + deltaMin * 60000) / (15 * 60000)) * (15 * 60000)
    agendarEtapa(d.etapaId, new Date(snapped).toISOString())
  }, [])

  // Mantém o ref vivo para o handler de drag (que roda fora do render).
  ppmRef.current = pixelsPorMinuto

  // ── Opções dos selects de filtro (spec pcp-gantt-melhorias, Req 5.1) ──
  // Populadas a partir de TODA a timeline (antes de qualquer filtro), para o
  // usuário poder escolher qualquer centro/tipo presente nas OPs. Listas únicas
  // e ordenadas alfabeticamente.
  const opcoesFiltro = useMemo(() => {
    const centros = new Set<string>()
    const tipos = new Set<string>()
    for (const op of timeline) {
      for (const etapa of op.etapas) {
        if (etapa.centroProducao) centros.add(etapa.centroProducao)
        if (etapa.tipoProcesso) tipos.add(etapa.tipoProcesso)
      }
    }
    return {
      centros: Array.from(centros).sort((a, b) => a.localeCompare(b)),
      tipos: Array.from(tipos).sort((a, b) => a.localeCompare(b)),
    }
  }, [timeline])

  // Há algum filtro/busca ativo? (controla o botão "Limpar filtros").
  const temFiltroAtivo =
    busca.trim() !== '' ||
    filtroCentros.length > 0 ||
    filtroTipos.length > 0 ||
    filtroIndicador !== null

  /** Zera busca + todos os filtros visuais (Req 5.1). */
  const limparFiltros = useCallback(() => {
    setBusca('')
    setFiltroCentros([])
    setFiltroTipos([])
    setFiltroIndicador(null)
  }, [])

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

      // Filtro por indicador (spec Req 5.1): se setado, só entram as OPs cujo
      // indicadorGeral bate. Combina com a busca textual acima (visual-only).
      if (filtroIndicador && op.indicadorGeral !== filtroIndicador) continue

      // Marcador de entrega
      if (op.dataEntrega) {
        entregas.push({ opNumero: op.opNumero, ms: new Date(op.dataEntrega).getTime(), opId: op.opId })
      }

      let etapaAnteriorCentro: string | null = null

      for (const etapa of op.etapas) {
        if (!etapa.centroProducao || !etapa.tipoProcesso) continue
        if (!etapa.inicioPrevistoAt || !etapa.fimPrevistoAt) continue

        // Filtro por máquina/processo (spec Req 5.1): a raia (etapa) só entra se
        // (filtroCentros vazio OU centro ∈ filtro) E (filtroTipos vazio OU tipo ∈ filtro).
        if (filtroCentros.length > 0 && !filtroCentros.includes(etapa.centroProducao)) continue
        if (filtroTipos.length > 0 && !filtroTipos.includes(etapa.tipoProcesso)) continue

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
          faceLabel: faceDaDescricao(etapa.descricao),
          passada: 1,
          agendaTravada: Boolean(etapa.agendaTravada),
          inicioAgendadoManual: etapa.inicioAgendadoManual ?? null,
          turno: etapa.turno ?? null,
          centroProducaoId: etapa.centroProducaoId ?? null,
          corGantt: op.corGantt ?? null,
          statusObs: op.statusObs ?? null,
          indicadorGeral: op.indicadorGeral,
        })

        etapaAnteriorCentro = etapa.centroProducao
      }
    }

    for (const raia of raiaMap.values()) {
      raia.barras.sort((a, b) => a.inicioMs - b.inicioMs)
      // Numera a passada de cada OP dentro da raia (mesmo centro): a 2ª+ barra
      // da mesma OP recebe passada>1 → marca visual de "2ª passada" (Req 3.5).
      const contagemPorOp = new Map<string, number>()
      for (const bar of raia.barras) {
        const n = (contagemPorOp.get(bar.opId) ?? 0) + 1
        contagemPorOp.set(bar.opId, n)
        bar.passada = n
      }
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
  }, [timeline, busca, pixelsPorMinuto, filtroCentros, filtroTipos, filtroIndicador])

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

  // ── Layout de empilhamento (spec pcp-gantt-melhorias, Req 4.1) ──
  // Calcula UMA única vez, por grupo→raia: a sub-linha de cada barra
  // (empilharBarras), o nº de sub-linhas e a altura resultante da raia. O MESMO
  // mapa é reusado na coluna de rótulos, na área de barras, no grid, na linha
  // "agora" e no totalContentHeight — garantindo que rótulo e barras fiquem
  // sempre alinhados (as alturas vêm da mesma fonte).
  const { layout, totalContentHeight } = useMemo(() => {
    let total = 0
    const grupos = gruposProcesso.map((grupo) => {
      const topDoGrupo = total
      total += 28 // header do grupo
      const raias = grupo.raias.map((raia) => {
        const topDaRaia = total
        const { itens, maxSubLinhas } = empilharBarras(raia.barras)
        const sub = Math.max(1, maxSubLinhas)
        const alturaRaia = alturaDaRaia(sub)
        const subLinhaPorEtapa = new Map<string, number>()
        for (const it of itens) subLinhaPorEtapa.set(it.barra.etapaId, it.subLinha)
        total += alturaRaia
        return { raia, sub, alturaRaia, topDaRaia, subLinhaPorEtapa }
      })
      return { tipoProcesso: grupo.tipoProcesso, topDoGrupo, raias }
    })
    return { layout: grupos, totalContentHeight: total }
  }, [gruposProcesso])

  // ── Dias visíveis (spec pcp-gantt-melhorias, Req 7) ──
  // Lista de timestamps à MEIA-NOITE LOCAL de cada dia entre minTime e maxTime
  // (inclusive). Base de cálculo da ocupação por dia (ocupacaoPorDia). Itera do
  // dia de minTime ao dia de maxTime com passo de 1 dia, usando
  // `new Date(y, m, d).getTime()` (meia-noite local, robusto a horário de
  // verão). Limite defensivo ~400 dias para não estourar em ranges absurdos.
  const diasVisiveis = useMemo<number[]>(() => {
    if (!Number.isFinite(minTime) || !Number.isFinite(maxTime) || maxTime < minTime) return []
    const dias: number[] = []
    const ini = new Date(minTime)
    let y = ini.getFullYear()
    let m = ini.getMonth()
    let d = ini.getDate()
    let guard = 0
    while (guard < 400) {
      guard++
      const ms = new Date(y, m, d).getTime()
      if (ms > maxTime) break
      dias.push(ms)
      // Avança 1 dia reconstruindo a data (normaliza fim de mês/ano).
      const prox = new Date(y, m, d + 1)
      y = prox.getFullYear()
      m = prox.getMonth()
      d = prox.getDate()
    }
    return dias
  }, [minTime, maxTime])

  // ── Ocupação média por raia no período (spec pcp-gantt-melhorias, Req 7) ──
  // Para cada raia (máquina), calcula a ocupação por dia (reusando o motor puro
  // `ocupacaoPorDia` do ./gantt-layout — NÃO reimplementa a regra de turno/
  // exceção) e deriva a MÉDIA do período considerando SÓ os dias com janela útil
  // (`minutosUteis > 0`). Ignorar dias sem janela (fins de semana/feriados)
  // evita diluir a média. Sem nenhum dia útil ⇒ média 0. Tudo no FRONT, sem
  // request extra: turno vem da 1ª barra da raia; exceções do excecoesPorCentro.
  // Chave do Map = `tipoProcesso||centro` (a MESMA chave usada na montagem das
  // raias/raiaMap), estável e determinística.
  const ocupacaoPorRaia = useMemo<Map<string, { mediaPct: number }>>(() => {
    const mapa = new Map<string, { mediaPct: number }>()
    if (diasVisiveis.length === 0) return mapa
    for (const raia of raias) {
      const chave = `${raia.tipoProcesso}||${raia.centroProducao}`
      const turno = raia.barras[0]?.turno ?? null
      const centroId = raia.barras.find((b) => b.centroProducaoId)?.centroProducaoId ?? null
      const excecoes = (centroId && excecoesPorCentro[centroId]) || []
      const ocup = ocupacaoPorDia(raia.barras, turno, excecoes, diasVisiveis)
      const diasUteis = ocup.filter((o) => o.minutosUteis > 0)
      const mediaPct = diasUteis.length
        ? diasUteis.reduce((acc, o) => acc + o.ocupacaoPct, 0) / diasUteis.length
        : 0
      mapa.set(chave, { mediaPct })
    }
    return mapa
  }, [raias, diasVisiveis, excecoesPorCentro])

  // ── Pontos de cada etapa para as setas de dependência (spec pcp-gantt-
  // melhorias, Req 5.3) ──
  // Deriva do MESMO `layout` (topDaRaia/subLinha) + minTime + ppm as coordenadas
  // X/Y de cada barra, idênticas às usadas no posicionamento das barras no
  // render (raiaTop = 32 + topDaRaia; barTop = raiaTop + subLinha*SUBLINHA_H +
  // SUBLINHA_GAP/2). O Y central = barTop + (SUBLINHA_H - SUBLINHA_GAP)/2. Assim
  // as setas saem/entram no meio de cada barra, sem recalcular carga.
  const pontosPorEtapa = useMemo(() => {
    const mapa = new Map<string, { xIni: number; xFim: number; yCentro: number; opId: string; sequencia: number }>()
    const barHeight = SUBLINHA_H - SUBLINHA_GAP
    for (const grupo of layout) {
      for (const rl of grupo.raias) {
        const raiaTop = 32 + rl.topDaRaia
        for (const bar of rl.raia.barras) {
          const subLinha = rl.subLinhaPorEtapa.get(bar.etapaId) ?? 0
          const barTop = raiaTop + subLinha * SUBLINHA_H + SUBLINHA_GAP / 2
          mapa.set(bar.etapaId, {
            xIni: xInicio(bar.inicioMs, minTime, pixelsPorMinuto),
            xFim: xFim(bar.fimMs, minTime, pixelsPorMinuto),
            yCentro: barTop + barHeight / 2,
            opId: bar.opId,
            sequencia: bar.sequencia,
          })
        }
      }
    }
    return mapa
  }, [layout, minTime, pixelsPorMinuto])

  // ── Segmentos de seta (n → n+1) da OP em foco (spec Req 5.3/5.4/5.5) ──
  // Coleta TODAS as barras/etapas da OP focada (de qualquer raia), ordena por
  // `sequencia` e gera um segmento por par consecutivo. Nada quando sem foco
  // (performance: só as setas da OP focada).
  const segmentosSetas = useMemo(() => {
    if (!opEmFoco) return [] as Array<{ x1: number; y1: number; x2: number; y2: number; paraTras: boolean }>
    const pts = Array.from(pontosPorEtapa.values())
      .filter((p) => p.opId === opEmFoco)
      .sort((a, b) => a.sequencia - b.sequencia)
    const segs: Array<{ x1: number; y1: number; x2: number; y2: number; paraTras: boolean }> = []
    for (let i = 0; i < pts.length - 1; i++) {
      const de = pts[i]
      const para = pts[i + 1]
      segs.push({
        x1: de.xFim,
        y1: de.yCentro,
        x2: para.xIni,
        y2: para.yCentro,
        // "Para trás": a próxima etapa começa antes (no tempo) do fim da atual.
        paraTras: para.xIni < de.xFim,
      })
    }
    return segs
  }, [opEmFoco, pontosPorEtapa])

  // ── Navegação / zoom (spec pcp-gantt-melhorias, Req 2) ──

  /**
   * Posiciona o scroll horizontal para a linha "agora" ficar visível, com ~30%
   * de margem à esquerda (padrão APS/MS Project). Usado na 1ª carga e pelo
   * botão "Hoje".
   */
  const irParaHoje = useCallback(() => {
    const el = ganttRef.current
    if (!el || !Number.isFinite(minTime)) return
    const alvo = ((Date.now() - minTime) / 60000) * pixelsPorMinuto - el.clientWidth * 0.3
    el.scrollLeft = Math.max(0, alvo)
  }, [minTime, pixelsPorMinuto])

  /**
   * Aplica um novo ppm mantendo o instante do CENTRO do viewport fixo no centro
   * (zoom ancorado). Calcula o ms do centro com o ppm atual, aplica o novo ppm
   * e, após o re-render refletir a nova largura, reposiciona o scrollLeft.
   */
  const aplicarZoom = useCallback((fator: number) => {
    const el = ganttRef.current
    const ppmAntigo = ppmRef.current || pixelsPorMinuto
    const ppmNovo = clampPpm(ppmAntigo * fator)
    if (ppmNovo === ppmAntigo) return
    if (!el || !Number.isFinite(minTime)) {
      setPixelsPorMinuto(ppmNovo)
      return
    }
    const msCentro = minTime + ((el.scrollLeft + el.clientWidth / 2) / ppmAntigo) * 60000
    setPixelsPorMinuto(ppmNovo)
    // O layout (largura/posições) depende do ppm via useMemo; reposiciona o
    // scroll no próximo frame, quando o DOM já refletiu o novo ppm.
    requestAnimationFrame(() => {
      const alvo = ((msCentro - minTime) / 60000) * ppmNovo - el.clientWidth / 2
      el.scrollLeft = Math.max(0, alvo)
    })
  }, [minTime, pixelsPorMinuto])

  // ── Zoom por Ctrl+wheel ancorado no CURSOR (spec pcp-gantt-melhorias, Req 2.3/2.4) ──
  // Padrão MS Project/Bryntum: segurar Ctrl e rolar a roda aproxima/afasta o
  // tempo mantendo FIXO o instante sob o ponteiro. Precisa de um listener NATIVO
  // com `{ passive: false }` — o `onWheel` do React é passivo e não permite
  // `preventDefault` (bloquearia o zoom do navegador). `minTime` entra por um
  // ref vivo para o listener não "congelar" o valor antigo entre re-renders.
  const minTimeRef = useRef(minTime)
  minTimeRef.current = minTime
  useEffect(() => {
    const el = ganttRef.current
    if (!el) return
    const onWheelNativo = (e: WheelEvent) => {
      // Só agimos com Ctrl (ou ⌘ no Mac) pressionado — sem isso, deixa o scroll
      // normal da página/área intacto.
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const mt = minTimeRef.current
      if (!Number.isFinite(mt)) return
      const ppmAntigo = ppmRef.current || 1.2
      // deltaY < 0 (rolar para cima/"afastar dedos") = zoom IN; > 0 = zoom OUT.
      const fator = e.deltaY < 0 ? ZOOM_IN_FATOR : ZOOM_OUT_FATOR
      const ppmNovo = clampPpm(ppmAntigo * fator)
      if (ppmNovo === ppmAntigo) return
      // Instante (ms) sob o cursor ANTES do zoom: usa a posição X do mouse
      // relativa à área rolável (scrollLeft + offset dentro do elemento).
      const rect = el.getBoundingClientRect()
      const xNoConteudo = el.scrollLeft + (e.clientX - rect.left)
      const msCursor = mt + (xNoConteudo / ppmAntigo) * 60000
      setPixelsPorMinuto(ppmNovo)
      // Reposiciona o scroll no próximo frame para manter msCursor sob o mesmo
      // ponto X da tela (ancoragem no cursor).
      requestAnimationFrame(() => {
        const alvo = ((msCursor - mt) / 60000) * ppmNovo - (e.clientX - rect.left)
        el.scrollLeft = Math.max(0, alvo)
      })
    }
    el.addEventListener('wheel', onWheelNativo, { passive: false })
    return () => el.removeEventListener('wheel', onWheelNativo)
  }, [])

  // Âncora inicial no "agora" assim que há dados e o layout tem minTime/ppm.
  // Só na 1ª vez (flag jaAncorou) — refreshes do auto-refresh não repetem.
  useEffect(() => {
    if (jaAncorou.current) return
    if (timeline.length === 0 || !Number.isFinite(minTime)) return
    // Deixa o DOM pintar a largura total antes de posicionar o scroll.
    const raf = requestAnimationFrame(() => {
      irParaHoje()
      jaAncorou.current = true
    })
    return () => cancelAnimationFrame(raf)
  }, [timeline, minTime, irParaHoje])

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
          {/* Toggle de MODO do drag (spec pcp-gantt-melhorias, Req 6). Reagendar
              = arrastar no tempo TRAVA a etapa na data. Reordenar fila = arrastar
              troca a ORDEM da fila da máquina. Modos mutuamente exclusivos — sem
              ambiguidade entre as duas interações de drag. */}
          <Tooltip
            multiline
            w={280}
            label="Reagendar: arrastar no tempo trava a etapa naquela data. Reordenar fila: arrastar um bloco sobre outro da mesma máquina troca a ordem da fila dela."
          >
            <Group gap={4} wrap="nowrap">
              <IconInfoCircle size={14} color="var(--mantine-color-dimmed)" />
              <SegmentedControl
                size="xs"
                value={modoGantt}
                disabled={reordenandoFila || salvandoAgenda}
                onChange={(v) => setModoGantt(v as 'reagendar' | 'reordenar')}
                data={[
                  { value: 'reagendar', label: (<Group gap={4} wrap="nowrap"><IconArrowsLeftRight size={13} /><span>Reagendar</span></Group>) },
                  { value: 'reordenar', label: (<Group gap={4} wrap="nowrap"><IconArrowsSort size={13} /><span>Reordenar fila</span></Group>) },
                ]}
              />
            </Group>
          </Tooltip>
          <SegmentedControl
            size="xs"
            value={visao}
            onChange={(v) => {
              const nv = v as '12h' | '24h' | '3d' | '7d'
              setVisao(nv)
              // Trocar a visão redefine o ppm base (preset); o usuário segue
              // podendo ajustar continuamente com os botões −/+.
              setPixelsPorMinuto(PPM_PRESET[nv])
            }}
            data={[
              { value: '12h', label: '12h' },
              { value: '24h', label: '24h' },
              { value: '3d', label: '3 dias' },
              { value: '7d', label: '7 dias' },
            ]}
          />
          <ActionIcon.Group>
            <Tooltip label="Diminuir zoom (ou Ctrl + roda do mouse)">
              <ActionIcon variant="default" size="sm" onClick={() => aplicarZoom(ZOOM_OUT_FATOR)}>
                <IconZoomOut size={16} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label="Aumentar zoom (ou Ctrl + roda do mouse)">
              <ActionIcon variant="default" size="sm" onClick={() => aplicarZoom(ZOOM_IN_FATOR)}>
                <IconZoomIn size={16} />
              </ActionIcon>
            </Tooltip>
          </ActionIcon.Group>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconCalendar size={14} />}
            onClick={irParaHoje}
          >
            Hoje
          </Button>
          <ActionIcon variant="subtle" size="sm" onClick={carregar}>
            <IconRefresh size={16} />
          </ActionIcon>
        </Group>
      </Group>

      {/* Linha de filtros visuais (spec pcp-gantt-melhorias, Req 5.1). NÃO
          alteram dados — só a montagem das raias/barras. Group com wrap para
          caber em telas estreitas. */}
      <Group gap="sm" wrap="wrap" align="flex-end">
        <MultiSelect
          label="Máquinas"
          placeholder={filtroCentros.length ? undefined : 'Todas'}
          data={opcoesFiltro.centros}
          value={filtroCentros}
          onChange={setFiltroCentros}
          size="xs"
          w={240}
          clearable
          searchable
          nothingFoundMessage="Nenhuma máquina"
        />
        <MultiSelect
          label="Processos"
          placeholder={filtroTipos.length ? undefined : 'Todos'}
          data={opcoesFiltro.tipos}
          value={filtroTipos}
          onChange={setFiltroTipos}
          size="xs"
          w={220}
          clearable
          searchable
          nothingFoundMessage="Nenhum processo"
        />
        <Select
          label="Indicador"
          placeholder="Todos"
          data={OPCOES_INDICADOR}
          value={filtroIndicador}
          onChange={setFiltroIndicador}
          size="xs"
          w={180}
          clearable
        />
        {opEmFoco && (
          <Button
            size="xs"
            variant="light"
            color="indigo"
            leftSection={<IconFocus2 size={14} />}
            onClick={() => setOpEmFoco(null)}
          >
            Limpar foco
          </Button>
        )}
        {temFiltroAtivo && (
          <Button
            size="xs"
            variant="subtle"
            color="gray"
            leftSection={<IconFilterOff size={14} />}
            onClick={limparFiltros}
          >
            Limpar filtros
          </Button>
        )}
      </Group>

      {/* Legenda */}
      <Group gap="xs">
        {[...new Set(timeline.map(op => op.opId))].slice(0, 8).map(opId => {
          const op = timeline.find(t => t.opId === opId)
          if (!op) return null
          return (
            <Badge key={opId} size="xs" variant="filled" style={{ background: corDaOp(op.corGantt) }}>
              OP {op.opNumero} - {(op.produtoNome || '').slice(0, 20)}
            </Badge>
          )
        })}
        {timeline.length > 8 && <Text size="xs" c="dimmed">+{timeline.length - 8} OPs</Text>}
      </Group>

      {/* Alertas de Conflitos */}
      {conflitos.length > 0 && (
        <Paper p="xs" radius="sm" withBorder style={{ borderColor: 'var(--mantine-color-red-light-color)', background: 'var(--mantine-color-red-light)' }}>
          <Group gap="xs" mb={4} justify="space-between">
            <Group gap="xs">
              <Text size="xs" fw={700} c="red.7">⚠️ {conflitos.length} conflito{conflitos.length > 1 ? 's' : ''} detectado{conflitos.length > 1 ? 's' : ''}</Text>
              <Text size="xs" c="dimmed">(sobreposição de OPs na mesma máquina)</Text>
            </Group>
            <Button
              size="xs"
              variant="filled"
              color="red"
              leftSection={<IconAdjustments size={14} />}
              loading={resolvendoConflitos}
              onClick={resolverConflitos}
            >
              Resolver conflitos
            </Button>
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
              } withinPortal>
                <Badge size="xs" color="red" variant="light" style={{ cursor: 'help' }}>
                  {c.centroProducao}: OP{c.etapa1.opNumero} × OP{c.etapa2.opNumero} ({formatMinutos(c.sobreposicaoMinutos)})
                </Badge>
              </Tooltip>
            ))}
            {conflitos.length > 5 && <Text size="xs" c="red.7">+{conflitos.length - 5} conflitos</Text>}
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
            background: 'var(--mantine-color-body)',
            borderRight: '2px solid var(--mantine-color-default-border)',
            overflowY: 'auto',
            overflowX: 'hidden',
            scrollbarWidth: 'none',
          }}
        >
          {/* Spacer para alinhar com header do eixo X */}
          <div style={{ height: 32, borderBottom: '1px solid var(--mantine-color-default-border)', display: 'flex', alignItems: 'center', padding: '0 8px', position: 'sticky', top: 0, background: 'var(--mantine-color-body)', zIndex: 5 }}>
            <Text size="xs" fw={600} c="dimmed">Máquina / Recurso</Text>
          </div>
          {/* Labels — alturas por raia vêm do mesmo `layout` das barras (Req 4.1) */}
          {layout.map((grupo, gi) => (
            <div key={gi}>
              <div style={{ height: 28, display: 'flex', alignItems: 'center', padding: '0 8px', background: 'var(--mantine-color-default)', borderBottom: '1px solid var(--mantine-color-default-border)' }}>
                <Text size="10px" fw={700} tt="uppercase" c="var(--mantine-color-text)">{grupo.tipoProcesso}</Text>
              </div>
              {grupo.raias.map((rl, ri) => {
                // Ocupação/carga média da máquina no período (spec Req 7). A
                // mini-faixa vai DENTRO do div de altura rl.alturaRaia — NÃO
                // muda a altura (preserva o alinhamento rótulo↔barras).
                const chaveRaia = `${rl.raia.tipoProcesso}||${rl.raia.centroProducao}`
                const mediaPct = ocupacaoPorRaia.get(chaveRaia)?.mediaPct ?? 0
                const mediaArred = Math.round(mediaPct)
                const sobrecarga = mediaPct > 100
                const corFaixa = corOcupacao(mediaPct)
                // Largura proporcional (clamp 100%): a barra fininha preenche de
                // 0 a 100% da largura disponível; >100% fica cheia (+ cor vermelha
                // e rótulo "sobrecarga" sinalizam o excedente).
                const larguraPct = Math.min(100, Math.max(0, mediaPct))
                return (
                  <div key={ri} style={{ height: rl.alturaRaia, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 3, padding: '0 8px', borderBottom: '1px solid var(--mantine-color-default-border)', overflow: 'hidden' }}>
                    <Text size="xs" lineClamp={1}>{rl.raia.centroProducao}</Text>
                    <Tooltip
                      label={`Ocupação média no período: ${mediaArred}%${sobrecarga ? ' — sobrecarga' : ''}`}
                      withinPortal
                    >
                      <Group gap={4} wrap="nowrap" style={{ cursor: 'help' }}>
                        <div style={{ flex: 1, height: 4, borderRadius: 2, background: 'var(--mantine-color-default-border)', overflow: 'hidden' }}>
                          <div style={{ width: `${larguraPct}%`, height: '100%', background: corFaixa }} />
                        </div>
                        <Text size="9px" c={corFaixa} fw={600} style={{ whiteSpace: 'nowrap' }}>{mediaArred}%</Text>
                      </Group>
                    </Tooltip>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* ═══ ÁREA DO GANTT (scroll X + Y, com padding-left para não sobrepor a coluna) ═══ */}
        <div
          ref={ganttRef}
          onScroll={() => { syncScroll('gantt'); agendarMedirViewY() }}
          style={{ position: 'absolute', left: LABEL_WIDTH, top: 0, right: 0, bottom: 0, overflow: 'auto' }}
        >
          <div style={{ width: totalWidth, minHeight: totalContentHeight + 32, position: 'relative' }}>
            {/* Eixo X (sticky top) */}
            <div style={{ height: 32, position: 'sticky', top: 0, zIndex: 10, background: 'var(--mantine-color-body)', borderBottom: '1px solid var(--mantine-color-default-border)' }}>
              {hourMarkers.map((m, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  left: ((m.ms - minTime) / 60000) * pixelsPorMinuto,
                  top: 0, height: '100%',
                  borderLeft: `1px ${m.isNewDay ? 'solid' : 'dashed'} var(--mantine-color-gray-${m.isNewDay ? '4' : '3'})`,
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
                borderLeft: `1px ${m.isNewDay ? 'solid' : 'dashed'} var(--mantine-color-gray-${m.isNewDay ? '4' : '3'})`,
                pointerEvents: 'none',
              }} />
            ))}

            {/* Linha "agora" */}
            {agora >= minTime && agora <= maxTime && (
              <div style={{
                position: 'absolute',
                left: ((agora - minTime) / 60000) * pixelsPorMinuto,
                top: 0, height: '100%', width: 2, background: 'var(--mantine-color-red-6)', zIndex: 8, pointerEvents: 'none',
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
                  borderTop: '10px solid var(--mantine-color-red-6)', zIndex: 9, cursor: 'pointer',
                }} />
              </Tooltip>
            ))}

            {/* Overlay de setas de dependência da OP em foco (spec pcp-gantt-
                melhorias, Req 5.3/5.4/5.5). SVG absoluto cobrindo toda a área de
                conteúdo; pointerEvents:none para não bloquear cliques/drag das
                barras. Só desenha quando há OP focada (poucas setas → leve). */}
            {opEmFoco && segmentosSetas.length > 0 && (
              <svg
                width={totalWidth}
                height={totalContentHeight + 32}
                // A cor das setas segue o tema via `currentColor`: no tema claro
                // fica escura (texto padrão), no escuro fica clara — sempre com
                // contraste (antes era branca fixa e sumia no tema claro).
                style={{ position: 'absolute', left: 0, top: 0, pointerEvents: 'none', zIndex: 6, color: 'var(--mantine-color-text)' }}
              >
                <defs>
                  <marker
                    id="seta-dep-gantt"
                    markerWidth="8"
                    markerHeight="8"
                    refX="6"
                    refY="3"
                    orient="auto"
                    markerUnits="strokeWidth"
                  >
                    <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
                  </marker>
                </defs>
                {segmentosSetas.map((s, i) => {
                  // Caminho Bézier: para a FRENTE, controle que avança no sentido
                  // do fluxo (padrão MS Project Finish-to-Start). Para TRÁS
                  // (próxima começa antes), desenha um laço que sai para a direita
                  // e retorna — mantém a seta visível indicando o sentido n→n+1.
                  let d: string
                  if (!s.paraTras) {
                    const dx = Math.max(16, (s.x2 - s.x1) * 0.4)
                    d = `M ${s.x1} ${s.y1} C ${s.x1 + dx} ${s.y1}, ${s.x2 - dx} ${s.y2}, ${s.x2} ${s.y2}`
                  } else {
                    // Laço de retorno: sai para a direita do fim da etapa n, desce/
                    // sobe e volta para o início da etapa n+1 (que está à esquerda).
                    const saida = 40
                    d = `M ${s.x1} ${s.y1} C ${s.x1 + saida} ${s.y1}, ${s.x2 - saida} ${s.y2}, ${s.x2} ${s.y2}`
                  }
                  return (
                    <path
                      key={i}
                      d={d}
                      fill="none"
                      stroke="currentColor"
                      strokeOpacity={0.75}
                      strokeWidth={2}
                      strokeDasharray={s.paraTras ? '5,4' : undefined}
                      markerEnd="url(#seta-dep-gantt)"
                    />
                  )
                })}
              </svg>
            )}

            {/* Barras — posição vertical pela sub-linha do empilhamento (Req 4.1).
                As alturas/offsets vêm do mesmo `layout` da coluna de rótulos,
                então rótulo e barras ficam sempre alinhados. */}
            {layout.map((grupo, gi) => {
              return grupo.raias.map((rl, ri) => {
                // topDaRaia é relativo ao conteúdo; +32 compensa o eixo X (sticky).
                const raiaTop = 32 + rl.topDaRaia
                const barHeight = SUBLINHA_H - SUBLINHA_GAP
                // ── Virtualização vertical (spec pcp-gantt-melhorias, Req 8/9) ──
                // Pula o desenho das barras desta raia quando o intervalo vertical
                // [raiaTop, raiaTop+alturaRaia] está FORA da janela visível + buffer.
                // viewY.height === 0 (antes da 1ª medição) = "mostrar tudo" (evita
                // tela vazia no 1º render). As posições absolutas (top) e o scroll
                // seguem corretos porque o container mantém o minHeight total.
                if (viewY.height > 0) {
                  const raiaBottom = raiaTop + rl.alturaRaia
                  const janelaTopo = viewY.top - VIRT_BUFFER
                  const janelaFundo = viewY.top + viewY.height + VIRT_BUFFER
                  if (raiaBottom < janelaTopo || raiaTop > janelaFundo) return null
                }
                return rl.raia.barras.map((bar, bi) => {
                  const subLinha = rl.subLinhaPorEtapa.get(bar.etapaId) ?? 0
                  const barTop = raiaTop + subLinha * SUBLINHA_H + (SUBLINHA_GAP / 2)
                  const offMin = offsetMin[bar.etapaId] || 0
                  const barLeft = ((bar.inicioMs - minTime) / 60000) * pixelsPorMinuto + offMin * pixelsPorMinuto
                  const barWidth = Math.max(20, ((bar.fimMs - bar.inicioMs) / 60000) * pixelsPorMinuto)
                  const setupWidth = bar.tempoSetupMinutos > 0 ? Math.max(4, bar.tempoSetupMinutos * pixelsPorMinuto) : 0
                  const color = corDaOp(bar.corGantt)
                  const borderColor = STATUS_BORDER[bar.indicador] || '#9e9e9e'
                  const isActive = bar.status === 'EM_ANDAMENTO'
                  const podeEditar = bar.status !== 'CONCLUIDO' && bar.status !== 'CONCLUIDA'
                  // Realce de foco (spec Req 5.2): com uma OP em foco, as barras
                  // de outras OPs ficam esmaecidas; as da OP focada ficam opacas
                  // e ganham um leve realce (sombra/zIndex).
                  const emFoco = opEmFoco !== null && bar.opId === opEmFoco
                  const esmaecida = opEmFoco !== null && bar.opId !== opEmFoco

                  return (
                    <Menu key={`${gi}-${ri}-${bi}`} shadow="md" width={210} position="bottom-start" withinPortal trigger="click" openDelay={0}>
                      <Menu.Target>
                    <Tooltip
                      multiline w={300}
                      label={
                        <div>
                          <Text size="xs" fw={700}>
                            OP {bar.opNumero} — {bar.produtoNome || rotuloPlano(bar.descricao)}
                            {bar.faceLabel ? ` · ${bar.faceLabel}` : ''}
                          </Text>
                          <Text size="xs">{bar.clienteNome || '—'} | Qtd: {bar.quantidade.toLocaleString('pt-BR')}</Text>
                          <Text size="xs" c="dimmed">Operação: {rotuloPlano(bar.descricao)}{bar.passada > 1 ? ` · ${bar.passada}ª passada` : ''}</Text>
                          <Text size="xs" c="dimmed">Setup: {formatMinutos(bar.tempoSetupMinutos)} | Operação: {formatMinutos(bar.tempoTotalPrevisto - bar.tempoSetupMinutos)}</Text>
                          <Text size="xs" c="dimmed">Previsto: {formatHora(bar.inicioMs)} → {formatHora(bar.fimMs)}</Text>
                          {bar.statusObs && <Text size="xs" c="cyan">📌 {bar.statusObs}</Text>}
                          {bar.agendaTravada && <Text size="xs" c="yellow.4">🔒 Travado{bar.inicioAgendadoManual ? ` em ${formatHora(new Date(bar.inicioAgendadoManual).getTime())}` : ''}</Text>}
                          {bar.tempoRealMinutos !== null && <Text size="xs" c="dimmed">Real: {formatMinutos(bar.tempoRealMinutos)}</Text>}
                          {bar.dataEntrega && <Text size="xs" c={bar.riscoEntrega ? 'red' : 'green'}>Entrega: {new Date(bar.dataEntrega).toLocaleDateString('pt-BR')}{bar.riscoEntrega ? ' ⚠️ RISCO' : ' ✓'}</Text>}
                        </div>
                      }
                    >
                      <div
                        style={{
                          position: 'absolute', top: barTop, left: barLeft, width: barWidth, height: barHeight,
                          touchAction: 'none',
                          opacity: esmaecida ? 0.25 : 1,
                          zIndex: emFoco ? 7 : undefined,
                          transition: 'opacity 120ms ease',
                        }}
                        onPointerDown={podeEditar ? (e) => onBarPointerDown(e, bar, rl.raia.barras) : undefined}
                        onPointerMove={podeEditar ? onBarPointerMove : undefined}
                        onPointerUp={podeEditar ? onBarPointerUp : undefined}
                      >
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
                          border: emFoco ? `3px solid #fff` : `2px solid ${borderColor}`,
                          cursor: 'pointer',
                          display: 'flex', alignItems: 'center', padding: '0 6px',
                          overflow: 'hidden',
                          boxShadow: isActive ? `0 0 8px ${color}` : undefined,
                          animation: isActive ? 'pulse-gantt 2s infinite' : undefined,
                        }}>
                          <div style={{ overflow: 'hidden', width: '100%' }}>
                            <Text size="9px" c="white" fw={700} lineClamp={1}>
                              OP{bar.opNumero}{bar.faceLabel ? ` · ${bar.faceLabel}` : (bar.produtoNome ? ` - ${bar.produtoNome.slice(0, 22)}` : '')}
                              {bar.statusObs ? ' 📌' : ''}
                            </Text>
                            <Text size="8px" c="rgba(255,255,255,0.8)" lineClamp={1}>
                              {bar.passada > 1 ? `${bar.passada}ª passada · ` : ''}x{bar.quantidade.toLocaleString('pt-BR')} | {formatMinutos(bar.tempoTotalPrevisto)}
                            </Text>
                          </div>
                        </div>
                        {/* Indicador visual mínimo de status (spec pcp-gantt-melhorias,
                            Req 3.6): um dot discreto no canto; o texto fica no tooltip
                            para não poluir barras estreitas. */}
                        {bar.statusObs && barWidth > 28 && (
                          <div style={{
                            position: 'absolute', bottom: 2, right: 3, zIndex: 2,
                            width: 7, height: 7, borderRadius: '50%',
                            background: '#22d3ee', border: '1px solid rgba(255,255,255,0.85)',
                            pointerEvents: 'none',
                          }} />
                        )}
                        {/* Vãos fora do turno (noite/fim de semana): overlays que
                            "segmentam" a barra, mostrando só o tempo útil (padrão APS). */}
                        {intervalosForaDoTurno(bar.inicioMs, bar.fimMs, bar.turno, bar.centroProducaoId ? (excecoesPorCentro[bar.centroProducaoId] || []) : []).map((g, idx) => {
                          const left = ((g.ini - bar.inicioMs) / 60000) * pixelsPorMinuto
                          const w = ((g.fim - g.ini) / 60000) * pixelsPorMinuto
                          if (w < 1) return null
                          return (
                            <div key={`gap-${idx}`} style={{
                              position: 'absolute', left, top: 0, width: w, height: '100%',
                              background: 'var(--mantine-color-body)', opacity: 0.82,
                              borderLeft: '1px dashed rgba(120,120,120,0.5)',
                              borderRight: '1px dashed rgba(120,120,120,0.5)',
                              pointerEvents: 'none', zIndex: 1,
                            }} />
                          )
                        })}
                        {/* Marca de 2ª+ passada da mesma OP no mesmo centro (Req 3.5) */}
                        {bar.passada > 1 && (
                          <div style={{
                            position: 'absolute', top: -3, right: -3, zIndex: 2,
                            background: 'var(--mantine-color-body)', color: borderColor,
                            fontSize: 8, fontWeight: 800, lineHeight: '12px',
                            minWidth: 14, height: 14, borderRadius: 7, textAlign: 'center',
                            border: `1.5px solid ${borderColor}`, padding: '0 2px',
                          }}>
                            {bar.passada}ª
                          </div>
                        )}
                        {/* Cadeado quando a etapa está travada (Req 5.1) */}
                        {bar.agendaTravada && (
                          <div style={{
                            position: 'absolute', top: -3, left: -3, zIndex: 3,
                            background: 'var(--mantine-color-body)', borderRadius: 7, width: 14, height: 14,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            border: `1.5px solid ${borderColor}`,
                          }}>
                            <IconLock size={9} color={borderColor} />
                          </div>
                        )}
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
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Label>OP {bar.opNumero} · {rotuloPlano(bar.descricao)}</Menu.Label>
                        {bar.agendaTravada ? (
                          <Menu.Item
                            leftSection={<IconLockOpen size={14} />}
                            disabled={salvandoAgenda}
                            onClick={() => destravarEtapa(bar.etapaId)}
                          >
                            Destravar (cálculo automático)
                          </Menu.Item>
                        ) : (
                          <Menu.Item
                            leftSection={<IconLock size={14} />}
                            disabled={salvandoAgenda || !podeEditar}
                            onClick={() => agendarEtapa(bar.etapaId, new Date(bar.inicioMs).toISOString())}
                          >
                            Travar nesta data
                          </Menu.Item>
                        )}
                        <Menu.Divider />
                        {/* Editor de cor/status por OP (spec pcp-gantt-melhorias, Req 3) */}
                        <Menu.Item
                          leftSection={<IconPalette size={14} />}
                          onClick={() => abrirEditorCorStatus(bar)}
                        >
                          Cor e status…
                        </Menu.Item>
                        {/* Foco da OP + setas de dependência (spec Req 5.2/5.3) */}
                        <Menu.Item
                          leftSection={<IconFocus2 size={14} />}
                          onClick={() => alternarFocoOp(bar.opId)}
                        >
                          {opEmFoco === bar.opId ? 'Limpar foco desta OP' : 'Focar cascata desta OP'}
                        </Menu.Item>
                        <Menu.Label>Dica: arraste o bloco para reagendar</Menu.Label>
                      </Menu.Dropdown>
                    </Menu>
                  )
                })
              })
            })}
          </div>
        </div>
      </Paper>

      {/* Editor de cor/status por OP (spec pcp-gantt-melhorias, Req 3) */}
      <Modal
        opened={editandoOp !== null}
        onClose={() => setEditandoOp(null)}
        title={editandoOp ? `Cor e status — OP ${editandoOp.opNumero}` : 'Cor e status'}
        centered
        size="sm"
      >
        <Stack gap="md">
          <ColorInput
            label="Cor da OP no Gantt"
            description="Aplica a todas as barras desta OP"
            format="hex"
            value={corEdit}
            onChange={setCorEdit}
            swatches={SWATCHES_COR_OP}
            disabled={salvandoGantt}
          />
          <TextInput
            label="Status / observação"
            placeholder="Ex.: Aguardando cliente"
            maxLength={120}
            value={statusEdit}
            onChange={(e) => setStatusEdit(e.currentTarget.value)}
            disabled={salvandoGantt}
          />
          <Group justify="space-between" mt="xs">
            <Group gap="xs">
              <Button
                variant="subtle"
                color="gray"
                size="xs"
                disabled={salvandoGantt}
                onClick={() => setCorEdit(COR_PADRAO)}
              >
                Limpar cor
              </Button>
              <Button
                variant="subtle"
                color="gray"
                size="xs"
                disabled={salvandoGantt}
                onClick={() => setStatusEdit('')}
              >
                Limpar status
              </Button>
            </Group>
            <Group gap="xs">
              <Button variant="default" size="xs" disabled={salvandoGantt} onClick={() => setEditandoOp(null)}>
                Cancelar
              </Button>
              <Button
                size="xs"
                loading={salvandoGantt}
                onClick={() => {
                  // "Limpar cor" = voltar à padrão → envia null (backend usa padrão).
                  const cor = corEdit && corEdit.toUpperCase() !== COR_PADRAO.toUpperCase() ? corEdit : null
                  const status = statusEdit.trim() ? statusEdit.trim() : null
                  salvarCorStatus(cor, status)
                }}
              >
                Salvar
              </Button>
            </Group>
          </Group>
        </Stack>
      </Modal>

      <style>{`
        @keyframes pulse-gantt { 0%,100% { opacity: 1; } 50% { opacity: 0.8; } }
        div::-webkit-scrollbar { width: 6px; height: 6px; }
        div::-webkit-scrollbar-thumb { background: var(--mantine-color-gray-5); border-radius: 3px; }
      `}</style>
    </Stack>
  )
}
