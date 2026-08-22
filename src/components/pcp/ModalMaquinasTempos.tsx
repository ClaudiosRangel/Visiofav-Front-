'use client'

import { useEffect, useState } from 'react'
import { Modal, Group, Stack, Text, Badge, Table, Select, NumberInput, Button, Loader, Center, Box, Tooltip } from '@mantine/core'
import { IconDeviceFloppy } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

interface ModalMaquinasTemposProps {
  opened: boolean
  onClose: () => void
  opId: string | null
  onSaved?: () => void
}

interface EtapaCompleta {
  id: string
  sequencia: number
  descricao: string | null
  status: string
  centroProducaoId: string | null
  centroNome: string | null
  tipoProcesso: string | null
  tempoSetupMinutos: number
  tempoOperacaoMinutos: number
  tempoOperacaoCalculado: number
  tempoEsperaMinutos: number
  quantidadeProduzida: number
  quantidadePerda: number
  quantidadePrevista: number
  dataInicioReal: string | null
  dataFimReal: string | null
}

interface OpInfo {
  id: string
  numero: number
  referenciaExterna: string | null
  quantidade: number
  unidadeMedida: string | null
  dataEntregaPrevista: string | null
  dataEmissao: string | null
  clienteNome: string | null
  produtoNome: string | null
  prioridade: string
  status: string
}

interface EtapaEdit {
  centroProducaoId: string | null
  tempoSetupMinutos: number
  tempoOperacaoCalculado: number
  dirty: boolean
}

const STATUS_COLORS: Record<string, string> = { PENDENTE: 'gray', EM_ANDAMENTO: 'blue', PAUSADA: 'orange', CONCLUIDA: 'green' }

export default function ModalMaquinasTempos({ opened, onClose, opId, onSaved }: ModalMaquinasTemposProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [op, setOp] = useState<OpInfo | null>(null)
  const [etapas, setEtapas] = useState<EtapaCompleta[]>([])
  const [centrosDisponiveis, setCentrosDisponiveis] = useState<Array<{ value: string; label: string }>>([])
  const [edits, setEdits] = useState<Record<string, EtapaEdit>>({})

  useEffect(() => {
    if (!opened || !opId) return
    setLoading(true)
    api.get(`/pcp/ordens-producao/${opId}/etapas-completas`)
      .then(({ data }) => {
        setOp(data.op)
        setEtapas(data.etapas)
        setCentrosDisponiveis(data.centrosDisponiveis)
        // Inicializar edits
        const initial: Record<string, EtapaEdit> = {}
        for (const e of data.etapas) {
          initial[e.id] = {
            centroProducaoId: e.centroProducaoId,
            tempoSetupMinutos: e.tempoSetupMinutos,
            tempoOperacaoCalculado: e.tempoOperacaoCalculado,
            dirty: false,
          }
        }
        setEdits(initial)
      })
      .catch(() => {
        notifications.show({ title: 'Erro', message: 'Falha ao carregar dados da OP', color: 'red' })
      })
      .finally(() => setLoading(false))
  }, [opened, opId])

  function updateEdit(etapaId: string, field: keyof EtapaEdit, value: any) {
    setEdits(prev => ({
      ...prev,
      [etapaId]: { ...prev[etapaId], [field]: value, dirty: true },
    }))
  }

  async function salvarAlteracoes() {
    const alterados = Object.entries(edits).filter(([, e]) => e.dirty)
    if (alterados.length === 0) {
      onClose()
      return
    }

    setSaving(true)
    let sucesso = 0
    for (const [etapaId, edit] of alterados) {
      try {
        const payload: any = {}
        const original = etapas.find(e => e.id === etapaId)
        if (edit.centroProducaoId && edit.centroProducaoId !== original?.centroProducaoId) {
          payload.centroProducaoId = edit.centroProducaoId
        }
        if (edit.tempoSetupMinutos !== original?.tempoSetupMinutos) {
          payload.tempoSetupMinutos = edit.tempoSetupMinutos
        }
        if (edit.tempoOperacaoCalculado !== original?.tempoOperacaoCalculado) {
          payload.tempoOperacaoCalculado = edit.tempoOperacaoCalculado
        }
        if (Object.keys(payload).length > 0) {
          await api.patch(`/pcp/etapas/${etapaId}/atribuir-maquina`, payload)
          sucesso++
        }
      } catch (err: any) {
        notifications.show({
          title: 'Erro',
          message: `Falha ao salvar etapa: ${err?.response?.data?.message || 'erro'}`,
          color: 'red',
        })
      }
    }

    if (sucesso > 0) {
      notifications.show({ title: 'Sucesso', message: `${sucesso} etapa(s) atualizada(s)`, color: 'green' })
      onSaved?.()
    }
    setSaving(false)
    onClose()
  }

  const opNumeroDisplay = op?.referenciaExterna || (op?.numero ? String(op.numero) : '—')

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700} size="lg">Máquinas e Tempos — OP {opNumeroDisplay}</Text>}
      size="xl"
      padding="lg"
    >
      {loading ? (
        <Center py="xl"><Loader /></Center>
      ) : (
        <Stack gap="md">
          {/* Header da OP */}
          {op && (
            <Box p="sm" style={{ background: 'var(--mantine-color-dark-6)', borderRadius: 8 }}>
              <Group gap="lg" wrap="wrap">
                <Tooltip label="Número da OP (referência externa do GPrint ou sequencial do Vizor)">
                <Box>
                  <Text size="xs" c="dimmed">Nº OP</Text>
                  <Text size="sm" fw={600}>{opNumeroDisplay}</Text>
                </Box>
                </Tooltip>
                <Tooltip label="Data de criação/importação da Ordem de Produção">
                <Box>
                  <Text size="xs" c="dimmed">Emissão</Text>
                  <Text size="sm">{op.dataEmissao ? new Date(op.dataEmissao).toLocaleDateString('pt-BR') : '—'}</Text>
                </Box>
                </Tooltip>
                <Tooltip label="Nome do cliente desta OP">
                <Box>
                  <Text size="xs" c="dimmed">Cliente</Text>
                  <Text size="sm">{op.clienteNome || '—'}</Text>
                </Box>
                </Tooltip>
                <Tooltip label="Quantidade total de peças a produzir nesta OP">
                <Box>
                  <Text size="xs" c="dimmed">Quantidade</Text>
                  <Text size="sm" fw={600}>{op.quantidade?.toLocaleString('pt-BR')}</Text>
                </Box>
                </Tooltip>
                <Tooltip label="Produto/serviço sendo produzido">
                <Box>
                  <Text size="xs" c="dimmed">Serviço / Produto</Text>
                  <Text size="sm">{op.produtoNome || '—'}</Text>
                </Box>
                </Tooltip>
                <Tooltip label="Data de entrega prometida ao cliente — referência para os indicadores de prazo">
                <Box>
                  <Text size="xs" c="dimmed">Entrega</Text>
                  <Text size="sm">{op.dataEntregaPrevista ? new Date(op.dataEntregaPrevista).toLocaleDateString('pt-BR') : '—'}</Text>
                </Box>
                </Tooltip>
              </Group>
            </Box>
          )}

          {/* Tabela de etapas */}
          <Box style={{ overflowX: 'auto' }}>
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 40 }}><Tooltip label="Sequência da etapa no roteiro"><span>#</span></Tooltip></Table.Th>
                  <Table.Th><Tooltip label="Descrição da etapa/componente (ex: Capa, Miolo, etc.)"><span>Componente / Descrição</span></Tooltip></Table.Th>
                  <Table.Th><Tooltip label="Tipo de processo produtivo (Impressão, Corte Vinco, Colagem, etc.)"><span>Atividade / Processo</span></Tooltip></Table.Th>
                  <Table.Th style={{ width: 220 }}><Tooltip label="Máquina atribuída — clique para alterar (só etapas pendentes/pausadas)"><span>Máquina</span></Tooltip></Table.Th>
                  <Table.Th style={{ width: 100 }}><Tooltip label="Tempo de acerto/setup da máquina (em minutos). Tempo fixo gasto antes de iniciar a produção."><span>T. Acerto (min)</span></Tooltip></Table.Th>
                  <Table.Th style={{ width: 120 }}><Tooltip label="Tempo de produção/operação (em minutos). Calculado com base na tiragem e velocidade da máquina."><span>T. Produção (min)</span></Tooltip></Table.Th>
                  <Table.Th style={{ width: 120 }}><Tooltip label="Data prevista de conclusão desta etapa. 🟢 No prazo, 🟡 Atenção (falta &lt;1 dia), 🔴 Atrasado (passa da entrega)"><span>Prev. Conclusão</span></Tooltip></Table.Th>
                  <Table.Th style={{ width: 80 }}><Tooltip label="Status atual da etapa: PENDENTE (aguardando), EM_ANDAMENTO (produzindo), PAUSADA, CONCLUÍDA"><span>Status</span></Tooltip></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(() => {
                  // Calcular previsão de conclusão acumulada por etapa
                  const agora = new Date()
                  let relogio = new Date(agora)
                  const previsoes: Record<string, { data: Date | null; statusPrazo: string | null }> = {}
                  for (const etapa of etapas) {
                    if (etapa.status === 'CONCLUIDA') {
                      previsoes[etapa.id] = { data: etapa.dataFimReal ? new Date(etapa.dataFimReal) : null, statusPrazo: null }
                      continue
                    }
                    const tempoTotal = (etapa.tempoSetupMinutos || 0) + (etapa.tempoOperacaoCalculado || 0)
                    if (tempoTotal <= 0) {
                      previsoes[etapa.id] = { data: null, statusPrazo: null }
                      continue
                    }
                    let minutosRestantes = tempoTotal
                    if (etapa.status === 'EM_ANDAMENTO' && etapa.dataInicioReal) {
                      const elapsed = (agora.getTime() - new Date(etapa.dataInicioReal).getTime()) / 60000
                      minutosRestantes = Math.max(0, tempoTotal - elapsed)
                    }
                    const previsao = new Date(relogio.getTime() + minutosRestantes * 60000)
                    // Comparar com entrega da OP
                    let statusPrazo: string | null = null
                    if (op?.dataEntregaPrevista) {
                      const entrega = new Date(op.dataEntregaPrevista)
                      const umDiaAntes = new Date(entrega.getTime() - 24 * 60 * 60 * 1000)
                      if (previsao > entrega) statusPrazo = 'ATRASADO'
                      else if (previsao > umDiaAntes) statusPrazo = 'ATENCAO'
                      else statusPrazo = 'NO_PRAZO'
                    }
                    previsoes[etapa.id] = { data: previsao, statusPrazo }
                    relogio = previsao
                  }
                  return etapas.map((etapa) => {
                  const edit = edits[etapa.id]
                  const isEditable = etapa.status === 'PENDENTE' || etapa.status === 'PAUSADA'
                  return (
                    <Table.Tr key={etapa.id}>
                      <Table.Td>{etapa.sequencia}</Table.Td>
                      <Table.Td>
                        <Text size="sm" lineClamp={1}>
                          {etapa.descricao || '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">{etapa.tipoProcesso || '—'}</Text>
                      </Table.Td>
                      <Table.Td>
                        {isEditable ? (
                          <Select
                            size="xs"
                            data={centrosDisponiveis}
                            value={edit?.centroProducaoId || null}
                            onChange={(v) => updateEdit(etapa.id, 'centroProducaoId', v)}
                            searchable
                            clearable={false}
                          />
                        ) : (
                          <Text size="sm">{etapa.centroNome || '—'}</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {isEditable ? (
                          <NumberInput
                            size="xs"
                            value={edit?.tempoSetupMinutos ?? 0}
                            onChange={(v) => updateEdit(etapa.id, 'tempoSetupMinutos', Number(v) || 0)}
                            min={0}
                          />
                        ) : (
                          <Text size="sm">{etapa.tempoSetupMinutos}</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {isEditable ? (
                          <NumberInput
                            size="xs"
                            value={edit?.tempoOperacaoCalculado ?? 0}
                            onChange={(v) => updateEdit(etapa.id, 'tempoOperacaoCalculado', Number(v) || 0)}
                            min={0}
                          />
                        ) : (
                          <Text size="sm">{etapa.tempoOperacaoCalculado}</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {(() => {
                          const prev = previsoes[etapa.id]
                          if (!prev?.data) return <Text size="xs" c="dimmed">—</Text>
                          const cor = prev.statusPrazo === 'ATRASADO' ? 'red' : prev.statusPrazo === 'ATENCAO' ? 'orange' : prev.statusPrazo === 'NO_PRAZO' ? 'green' : 'dimmed'
                          return (
                            <Text size="sm" fw={500} c={cor}>
                              {prev.data.toLocaleDateString('pt-BR')}
                              {prev.statusPrazo === 'ATRASADO' && ' 🔴'}
                              {prev.statusPrazo === 'ATENCAO' && ' 🟡'}
                              {prev.statusPrazo === 'NO_PRAZO' && ' 🟢'}
                            </Text>
                          )
                        })()}
                      </Table.Td>
                      <Table.Td>
                        <Badge color={STATUS_COLORS[etapa.status] || 'gray'} size="sm">
                          {etapa.status === 'EM_ANDAMENTO' ? 'Andamento' : etapa.status === 'CONCLUIDA' ? 'Concluída' : etapa.status}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  )
                })})()}
              </Table.Tbody>
            </Table>
          </Box>

          {/* Mini-Gantt Timeline */}
          {etapas.length > 0 && (() => {
            const agora = new Date()
            // Calcular timeline: início, duração acumulada por etapa, e range total
            let timelineStart = agora
            const firstInProgress = etapas.find(e => e.status === 'EM_ANDAMENTO' && e.dataInicioReal)
            if (firstInProgress?.dataInicioReal) {
              timelineStart = new Date(firstInProgress.dataInicioReal)
            }
            // Conclusões passadas podem estar antes de "agora"
            const firstConcluida = etapas.find(e => e.status === 'CONCLUIDA' && e.dataInicioReal)
            if (firstConcluida?.dataInicioReal && new Date(firstConcluida.dataInicioReal) < timelineStart) {
              timelineStart = new Date(firstConcluida.dataInicioReal)
            }

            // Calcular posição e duração de cada etapa
            interface GanttBar { id: string; label: string; startMin: number; durationMin: number; status: string }
            const bars: GanttBar[] = []
            let acumulado = 0
            for (const etapa of etapas) {
              const setup = edits[etapa.id]?.tempoSetupMinutos ?? etapa.tempoSetupMinutos ?? 0
              const operacao = edits[etapa.id]?.tempoOperacaoCalculado ?? etapa.tempoOperacaoCalculado ?? 0
              const duracao = setup + operacao

              let startMin = acumulado
              // Se a etapa já tem data real de início, usar essa referência
              if (etapa.dataInicioReal) {
                const diffMs = new Date(etapa.dataInicioReal).getTime() - timelineStart.getTime()
                startMin = Math.max(0, diffMs / 60000)
              }

              bars.push({
                id: etapa.id,
                label: etapa.descricao || `Etapa ${etapa.sequencia}`,
                startMin,
                durationMin: duracao,
                status: etapa.status,
              })
              acumulado = startMin + duracao
            }

            // Range total da timeline
            const entregaDate = op?.dataEntregaPrevista ? new Date(op.dataEntregaPrevista) : null
            const lastEnd = bars.length > 0 ? Math.max(...bars.map(b => b.startMin + b.durationMin)) : 0
            const entregaMin = entregaDate ? Math.max(0, (entregaDate.getTime() - timelineStart.getTime()) / 60000) : 0
            const hojeMin = Math.max(0, (agora.getTime() - timelineStart.getTime()) / 60000)
            const totalRange = Math.max(lastEnd, entregaMin, hojeMin) * 1.1 || 1440 // +10% buffer, mínimo 1 dia

            const BAR_HEIGHT = 28
            const ROW_GAP = 4
            const LABEL_WIDTH = 140
            const CHART_HEIGHT = bars.length * (BAR_HEIGHT + ROW_GAP) + 40

            const STATUS_BAR_COLORS: Record<string, string> = {
              CONCLUIDA: '#2f9e44',
              EM_ANDAMENTO: '#228be6',
              PAUSADA: '#f08c00',
              PENDENTE: '#868e96',
            }

            // Calcular labels de data no eixo X (a cada ~8h ou 1 dia dependendo do range)
            const totalDays = totalRange / 1440
            const stepDays = totalDays <= 2 ? 0.5 : totalDays <= 7 ? 1 : 2
            const dateLabels: { label: string; pct: number }[] = []
            for (let d = 0; d * 1440 <= totalRange; d += stepDays) {
              const dt = new Date(timelineStart.getTime() + d * 24 * 60 * 60 * 1000)
              dateLabels.push({
                label: dt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
                pct: (d * 1440 / totalRange) * 100,
              })
            }

            return (
              <Box mt="md" p="sm" style={{ background: 'var(--mantine-color-dark-7)', borderRadius: 8, overflowX: 'auto' }}>
                <Tooltip label="Visualização gráfica da sequência de produção. Barras mostram cada etapa com duração proporcional ao tempo. Linha azul = Hoje, linha vermelha tracejada = Data de Entrega." multiline w={320}>
                <Text size="sm" fw={600} mb="xs" style={{ cursor: 'help' }}>Timeline</Text>
                </Tooltip>
                <div style={{ position: 'relative', minHeight: CHART_HEIGHT, display: 'flex' }}>
                  {/* Labels à esquerda */}
                  <div style={{ width: LABEL_WIDTH, flexShrink: 0 }}>
                    {bars.map((bar, i) => (
                      <div key={bar.id} style={{ height: BAR_HEIGHT, marginBottom: ROW_GAP, display: 'flex', alignItems: 'center' }}>
                        <Text size="xs" c="dimmed" lineClamp={1} style={{ fontSize: 10 }}>{bar.label}</Text>
                      </div>
                    ))}
                  </div>
                  {/* Chart area */}
                  <div style={{ flex: 1, position: 'relative', minWidth: 300 }}>
                    {/* Bars */}
                    {bars.map((bar, i) => {
                      const leftPct = (bar.startMin / totalRange) * 100
                      const widthPct = Math.max((bar.durationMin / totalRange) * 100, 0.5)
                      return (
                        <div
                          key={bar.id}
                          style={{
                            position: 'absolute',
                            top: i * (BAR_HEIGHT + ROW_GAP),
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            height: BAR_HEIGHT,
                            background: STATUS_BAR_COLORS[bar.status] || '#868e96',
                            borderRadius: 4,
                            opacity: 0.85,
                            display: 'flex',
                            alignItems: 'center',
                            paddingLeft: 4,
                            minWidth: 2,
                          }}
                          title={`${bar.label}: ${Math.round(bar.durationMin)} min`}
                        >
                          {widthPct > 8 && (
                            <Text size="xs" c="white" fw={500} style={{ fontSize: 9, whiteSpace: 'nowrap', overflow: 'hidden' }}>
                              {Math.round(bar.durationMin)}min
                            </Text>
                          )}
                        </div>
                      )
                    })}
                    {/* Linha "Hoje" — sólida azul */}
                    {hojeMin > 0 && hojeMin < totalRange && (
                      <div style={{ position: 'absolute', top: 0, bottom: 20, left: `${(hojeMin / totalRange) * 100}%`, width: 2, background: '#228be6', zIndex: 2 }}>
                        <Text size="xs" c="blue" fw={600} style={{ position: 'absolute', top: -14, left: -10, fontSize: 9 }}>Hoje</Text>
                      </div>
                    )}
                    {/* Linha "Entrega" — tracejada vermelha */}
                    {entregaDate && entregaMin > 0 && entregaMin < totalRange && (
                      <div style={{ position: 'absolute', top: 0, bottom: 20, left: `${(entregaMin / totalRange) * 100}%`, width: 0, borderLeft: '2px dashed #e03131', zIndex: 2 }}>
                        <Text size="xs" c="red" fw={600} style={{ position: 'absolute', top: -14, left: -16, fontSize: 9 }}>Entrega</Text>
                      </div>
                    )}
                    {/* Eixo de datas no fundo */}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 16, borderTop: '1px solid var(--mantine-color-dark-4)' }}>
                      {dateLabels.map((dl, i) => (
                        <Text key={i} size="xs" c="dimmed" style={{ position: 'absolute', left: `${dl.pct}%`, bottom: 0, fontSize: 9, transform: 'translateX(-50%)' }}>
                          {dl.label}
                        </Text>
                      ))}
                    </div>
                  </div>
                </div>
              </Box>
            )
          })()}

          {/* Botões */}
          <Group justify="flex-end">
            <Tooltip label="Fecha sem salvar alterações">
            <Button variant="default" onClick={onClose}>Cancelar</Button>
            </Tooltip>
            <Tooltip label="Salva as atribuições de máquina e tempos alterados para esta OP">
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={salvarAlteracoes}
              loading={saving}
              disabled={!Object.values(edits).some(e => e.dirty)}
            >
              Salvar Alterações
            </Button>
            </Tooltip>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}
