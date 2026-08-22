'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Box, Group, Text, Select, Progress, Badge, Table, ActionIcon, Tooltip } from '@mantine/core'
import { IconMaximize, IconMinimize, IconRefresh } from '@tabler/icons-react'
import { api } from '@/lib/api'

// ─── Tipos ──────────────────────────────────────────────────────────────────

interface EtapaPainel {
  id: string
  opId: string
  opNumero: string
  clienteNome: string | null
  produtoNome: string | null
  status: 'PENDENTE' | 'EM_ANDAMENTO' | 'PAUSADA'
  quantidade: number
  quantidadeProduzida: number
  percentual: number
  dataEntrega: string | null
  dataInicioReal: string | null
  tiragem: number | null
  centroNome: string | null
  centroId: string | null
  tipoProcessoCodigo: string | null
  tempoSetupMinutos: number | null
  tempoOperacaoCalculado: number | null
  observacaoOperador: string | null
  prioridade: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatarDataHora(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const dias = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB']
  const dia = String(d.getDate()).padStart(2, '0')
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const diaSemana = dias[d.getDay()]
  const hora = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${dia}-${mes} ${diaSemana} ${hora}:${min}`
}

function formatarData(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}

function calcularTempoRestante(etapa: EtapaPainel): string {
  const tempoTotal = (etapa.tempoSetupMinutos || 0) + (etapa.tempoOperacaoCalculado || 0)
  if (!tempoTotal) return '—'
  // Se em andamento e tem dataInicioReal, calcular tempo já decorrido
  let minutosRestantes = tempoTotal
  if (etapa.dataInicioReal && etapa.status === 'EM_ANDAMENTO') {
    const inicio = new Date(etapa.dataInicioReal).getTime()
    const agora = Date.now()
    const decorrido = Math.floor((agora - inicio) / 60000)
    minutosRestantes = Math.max(0, tempoTotal - decorrido)
  }
  const h = Math.floor(minutosRestantes / 60)
  const m = minutosRestantes % 60
  if (h === 0) return `${m} min`
  return `${h} h ${m} min`
}

function getStatusIcon(status: string): string {
  switch (status) {
    case 'EM_ANDAMENTO': return '🟢'
    case 'PAUSADA': return '🟡'
    case 'PENDENTE': return '⚪'
    default: return '⚪'
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'EM_ANDAMENTO': return 'Produzindo'
    case 'PAUSADA': return 'Pausado'
    case 'PENDENTE': return 'Planejado'
    default: return status
  }
}

// ─── Estilos ────────────────────────────────────────────────────────────────

const COLORS = {
  bg: '#0d1117',
  header: '#161b22',
  card: '#1c2128',
  border: '#30363d',
  green: '#3fb950',
  yellow: '#d29922',
  red: '#f85149',
  gray: '#8b949e',
  textPrimary: '#e6edf3',
  textSecondary: '#8b949e',
  textBright: '#ffffff',
  blue: '#58a6ff',
}

// ─── Componente Principal ───────────────────────────────────────────────────

export default function PainelProducaoPage() {
  const [etapas, setEtapas] = useState<EtapaPainel[]>([])
  const [tiposProcesso, setTiposProcesso] = useState<Array<{ value: string; label: string }>>([])
  const [filtroProcesso, setFiltroProcesso] = useState<string | null>(null)
  const [clock, setClock] = useState(new Date())
  const [fullscreen, setFullscreen] = useState(false)
  const [ultimaAtualizacao, setUltimaAtualizacao] = useState<Date | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => { document.title = 'Painel de Produção — Controle de Produção' }, [])

  const carregar = useCallback(async () => {
    try {
      const { data } = await api.get('/pcp/programacao/painel')
      // Transformar dados do painel em lista flat para o monitor
      const todasEtapas: EtapaPainel[] = []
      for (const centro of (data.centros || [])) {
        for (const etapa of centro.etapas) {
          todasEtapas.push({
            id: etapa.id,
            opId: etapa.opId,
            opNumero: etapa.opNumero,
            clienteNome: etapa.clienteNome,
            produtoNome: etapa.produtoNome,
            status: etapa.status,
            quantidade: etapa.quantidade,
            quantidadeProduzida: etapa.quantidadeProduzida,
            percentual: etapa.percentual,
            dataEntrega: etapa.dataEntrega,
            dataInicioReal: etapa.dataInicioReal,
            tiragem: etapa.tiragem,
            centroNome: centro.centro.descricao || centro.centro.codigo,
            centroId: centro.centro.id,
            tipoProcessoCodigo: centro.centro.tipoProcesso?.codigo || null,
            tempoSetupMinutos: etapa.tempoSetupMinutos ?? null,
            tempoOperacaoCalculado: etapa.tempoOperacaoCalculado ?? null,
            observacaoOperador: etapa.observacaoOperador,
            prioridade: etapa.prioridade,
          })
        }
      }
      // Ordenar: EM_ANDAMENTO primeiro, depois PAUSADA, depois PENDENTE
      const statusOrder: Record<string, number> = { EM_ANDAMENTO: 0, PAUSADA: 1, PENDENTE: 2 }
      todasEtapas.sort((a, b) => (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3))
      setEtapas(todasEtapas)

      // Extrair tipos de processo únicos para o filtro
      const tiposSet = new Map<string, string>()
      for (const centro of (data.centros || [])) {
        const codigo = centro.centro.tipoProcesso?.codigo
        const descricao = centro.centro.tipoProcesso?.descricao
        if (codigo && descricao) tiposSet.set(codigo, descricao)
      }
      const tiposArr = Array.from(tiposSet.entries()).map(([codigo, descricao]) => ({
        value: codigo,
        label: descricao,
      }))
      setTiposProcesso(tiposArr)
      setUltimaAtualizacao(new Date())
    } catch (err) {
      console.error('[PainelProducao] Erro ao carregar:', err)
    }
  }, [])

  // Auto-refresh: dados a cada 30s, relógio a cada 1s
  useEffect(() => {
    carregar()
    const dataInterval = setInterval(carregar, 30000)
    const clockInterval = setInterval(() => setClock(new Date()), 1000)
    return () => {
      clearInterval(dataInterval)
      clearInterval(clockInterval)
    }
  }, [carregar])

  // Fullscreen toggle
  function toggleFullscreen() {
    if (!containerRef.current) return
    if (!document.fullscreenElement) {
      containerRef.current.requestFullscreen().then(() => setFullscreen(true)).catch(() => {})
    } else {
      document.exitFullscreen().then(() => setFullscreen(false)).catch(() => {})
    }
  }

  useEffect(() => {
    function onFs() { setFullscreen(!!document.fullscreenElement) }
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  // Filtrar etapas
  const etapasFiltradas = filtroProcesso
    ? etapas.filter(e => e.tipoProcessoCodigo === filtroProcesso)
    : etapas

  // Resumo
  const emAndamento = etapasFiltradas.filter(e => e.status === 'EM_ANDAMENTO').length
  const pausadas = etapasFiltradas.filter(e => e.status === 'PAUSADA').length
  const pendentes = etapasFiltradas.filter(e => e.status === 'PENDENTE').length

  return (
    <div
      ref={containerRef}
      style={{
        background: COLORS.bg,
        minHeight: '100vh',
        color: COLORS.textPrimary,
        padding: '16px 24px',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Header */}
      <Group justify="space-between" mb="md">
        <Box>
          <Text size="xl" fw={700} c={COLORS.textBright} style={{ fontSize: '1.6rem' }}>
            Painel de Produção
          </Text>
          <Text size="sm" c={COLORS.textSecondary}>
            CONTROLE DE PRODUÇÃO
          </Text>
        </Box>

        <Group gap="md">
          {/* Resumo rápido */}
          <Group gap="xs">
            <Badge color="green" variant="filled" size="lg">🟢 {emAndamento}</Badge>
            <Badge color="yellow" variant="filled" size="lg">🟡 {pausadas}</Badge>
            <Badge color="gray" variant="filled" size="lg">⚪ {pendentes}</Badge>
          </Group>

          {/* Filtro por tipo de processo */}
          <Select
            placeholder="TODOS"
            data={[{ value: '', label: 'TODOS' }, ...tiposProcesso]}
            value={filtroProcesso || ''}
            onChange={(v) => setFiltroProcesso(v || null)}
            size="sm"
            w={180}
            clearable={false}
            styles={{
              input: { background: COLORS.card, border: `1px solid ${COLORS.border}`, color: COLORS.textPrimary },
              dropdown: { background: COLORS.card, border: `1px solid ${COLORS.border}` },
            }}
          />

          {/* Relógio */}
          <Text size="lg" fw={600} c={COLORS.textBright} style={{ fontFamily: 'monospace', fontSize: '1.3rem' }}>
            {clock.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </Text>

          {/* Ações */}
          <Group gap={4}>
            <Tooltip label="Atualizar agora">
              <ActionIcon variant="subtle" c={COLORS.textSecondary} onClick={carregar}>
                <IconRefresh size={20} />
              </ActionIcon>
            </Tooltip>
            <Tooltip label={fullscreen ? 'Sair do fullscreen' : 'Fullscreen'}>
              <ActionIcon variant="subtle" c={COLORS.textSecondary} onClick={toggleFullscreen}>
                {fullscreen ? <IconMinimize size={20} /> : <IconMaximize size={20} />}
              </ActionIcon>
            </Tooltip>
          </Group>
        </Group>
      </Group>

      {/* Tabela principal */}
      <Box style={{ borderRadius: 8, border: `1px solid ${COLORS.border}`, overflow: 'hidden' }}>
        <Table
          striped={false}
          highlightOnHover={false}
          styles={{
            table: { background: COLORS.card },
            thead: { background: COLORS.header },
            th: { color: COLORS.textSecondary, fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', padding: '10px 12px', borderBottom: `1px solid ${COLORS.border}` },
            td: { color: COLORS.textPrimary, fontSize: '0.95rem', padding: '10px 12px', borderBottom: `1px solid ${COLORS.border}` },
          }}
        >
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 40 }}>St</Table.Th>
              <Table.Th>Máquina</Table.Th>
              <Table.Th>Início</Table.Th>
              <Table.Th>Nº OP</Table.Th>
              <Table.Th>Cliente / Serviço</Table.Th>
              <Table.Th>Entrega</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Qtd</Table.Th>
              <Table.Th>Tempo</Table.Th>
              <Table.Th style={{ width: 180 }}>Situação</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {etapasFiltradas.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={9} style={{ textAlign: 'center', padding: 40, color: COLORS.textSecondary }}>
                  Nenhuma etapa ativa no momento
                </Table.Td>
              </Table.Tr>
            )}
            {etapasFiltradas.map((etapa) => (
              <Table.Tr
                key={etapa.id}
                style={{
                  background: etapa.status === 'EM_ANDAMENTO'
                    ? 'rgba(63, 185, 80, 0.05)'
                    : etapa.status === 'PAUSADA'
                    ? 'rgba(210, 153, 34, 0.05)'
                    : undefined,
                }}
              >
                {/* Status */}
                <Table.Td style={{ fontSize: '1.2rem', textAlign: 'center' }}>
                  {getStatusIcon(etapa.status)}
                </Table.Td>

                {/* Máquina */}
                <Table.Td>
                  <Text size="sm" fw={600} c={COLORS.textBright} lineClamp={1}>
                    {etapa.centroNome || '—'}
                  </Text>
                </Table.Td>

                {/* Início */}
                <Table.Td>
                  <Text size="xs" c={COLORS.textSecondary} style={{ fontFamily: 'monospace' }}>
                    {formatarDataHora(etapa.dataInicioReal)}
                  </Text>
                </Table.Td>

                {/* Nº OP */}
                <Table.Td>
                  <Text size="sm" fw={600} c={COLORS.blue}>
                    {etapa.opNumero}
                  </Text>
                </Table.Td>

                {/* Cliente / Serviço */}
                <Table.Td>
                  <Text size="sm" c={COLORS.textPrimary} lineClamp={1}>
                    {etapa.clienteNome || '—'}
                  </Text>
                  <Text size="xs" c={COLORS.textSecondary} lineClamp={1}>
                    {etapa.produtoNome || '—'}
                  </Text>
                </Table.Td>

                {/* Entrega */}
                <Table.Td>
                  <Text size="sm" c={COLORS.textPrimary}>
                    {formatarData(etapa.dataEntrega)}
                  </Text>
                </Table.Td>

                {/* Quantidade */}
                <Table.Td style={{ textAlign: 'right' }}>
                  <Text size="sm" c={COLORS.textPrimary}>
                    {etapa.quantidade?.toLocaleString('pt-BR') || '—'}
                  </Text>
                </Table.Td>

                {/* Tempo */}
                <Table.Td>
                  <Text size="sm" c={COLORS.textSecondary} style={{ fontFamily: 'monospace' }}>
                    {calcularTempoRestante(etapa)}
                  </Text>
                </Table.Td>

                {/* Situação */}
                <Table.Td>
                  {etapa.percentual >= 100 ? (
                    <Badge color="green" variant="filled" size="md">100%</Badge>
                  ) : etapa.status === 'PAUSADA' ? (
                    <Badge color="yellow" variant="filled" size="md">Pausado</Badge>
                  ) : etapa.status === 'PENDENTE' ? (
                    <Badge color="gray" variant="light" size="md">Planejado</Badge>
                  ) : (
                    <Group gap={6} wrap="nowrap">
                      <Progress
                        value={etapa.percentual}
                        color="green"
                        size="lg"
                        style={{ flex: 1 }}
                        styles={{ root: { background: COLORS.border } }}
                      />
                      <Text size="xs" c={COLORS.textSecondary} w={36} ta="right">
                        {etapa.percentual}%
                      </Text>
                    </Group>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Box>

      {/* Footer */}
      <Group justify="space-between" mt="sm">
        <Text size="xs" c={COLORS.textSecondary}>
          {etapasFiltradas.length} etapa(s) ativa(s) • Atualização automática a cada 30s
        </Text>
        <Text size="xs" c={COLORS.textSecondary}>
          Última atualização: {ultimaAtualizacao ? ultimaAtualizacao.toLocaleTimeString('pt-BR') : '—'}
        </Text>
      </Group>
    </div>
  )
}
