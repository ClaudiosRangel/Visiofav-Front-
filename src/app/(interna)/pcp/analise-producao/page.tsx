'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Title, Stack, Card, Group, Text, Table, Badge, Button, Select,
  LoadingOverlay, Center, Loader, Divider, ThemeIcon,
} from '@mantine/core'
import {
  IconClipboardCheck, IconPackage, IconFlask, IconCheck, IconAlertTriangle,
  IconRefresh, IconSearch, IconLock, IconCalendarClock, IconClock,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'

// ── Tipos ──────────────────────────────────────────────────────────────────

interface OpResumo {
  id: string
  numero: number
  referenciaExterna: string | null
  status: string
  quantidade: number
  clienteNome?: string | null
  produtoNome?: string | null
}

interface DisponibilidadePA {
  produtoId: string | null
  descricao: string
  unidade: string
  quantidadePedido: number
  estoqueDisponivel: number
  aProduzir: number
  atendeDoEstoque: boolean
}

interface DisponibilidadeMaterial {
  produtoComponenteId: string | null
  descricao: string
  tipoMaterial: string | null
  unidade: string
  quantidadeNecessaria: number
  estoqueFisico: number
  estoqueReservado: number
  saldoDisponivel: number
  falta: number
  situacao: 'SUFICIENTE' | 'PARCIAL' | 'SEM_ESTOQUE'
  origemEstoque: 'WMS' | 'ERP' | 'NENHUM'
}

interface ResultadoEstoque {
  ordemProducaoId: string
  numero: number
  produtoAcabado: DisponibilidadePA | null
  materiais: DisponibilidadeMaterial[]
  resumo: {
    totalMateriais: number
    materiaisSuficientes: number
    materiaisComFalta: number
    todosDisponiveis: boolean
  }
}

interface EtapaCalculada {
  sequencia: number
  descricao: string
  centroNome: string | null
  tempoTotalMin: number
  filaAnteriorMin: number
}

interface ResultadoData {
  tempoProducaoTotalMin: number
  tempoProducaoTotalHoras: number
  filaTotalMin: number
  dataInicioEstimada: string
  dataFimEstimada: string
  dataEntregaViavel: string
  dataEntregaDesejada: string | null
  atendeDataDesejada: boolean | null
  diasAtraso: number
  horasUteisPorDia: number
  etapas: EtapaCalculada[]
  avisos: string[]
}

const SITUACAO_CONFIG: Record<string, { color: string; label: string }> = {
  SUFICIENTE: { color: 'green', label: 'Suficiente' },
  PARCIAL: { color: 'yellow', label: 'Parcial' },
  SEM_ESTOQUE: { color: 'red', label: 'Sem estoque' },
}

// Status de OP elegíveis para análise (antes de liberar para produção)
const STATUS_ANALISE = ['PLANEJADA', 'PROGRAMADA', 'RASCUNHO']

function formatNum(n: number): string {
  return n.toLocaleString('pt-BR', { maximumFractionDigits: 4 })
}

function formatData(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('pt-BR')
}

function formatHoras(min: number): string {
  const h = Math.floor(min / 60)
  const m = Math.round(min % 60)
  if (h > 0) return `${h}h${m > 0 ? ` ${m}min` : ''}`
  return `${m}min`
}

export default function AnaliseProducaoPage() {
  useEffect(() => { document.title = 'Vizor - PCP - Análise de Produção' }, [])

  const [ops, setOps] = useState<OpResumo[]>([])
  const [loadingOps, setLoadingOps] = useState(true)
  const [opSelecionada, setOpSelecionada] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoEstoque | null>(null)
  const [loadingAnalise, setLoadingAnalise] = useState(false)

  // Carregar OPs elegíveis para análise
  const carregarOps = useCallback(async () => {
    setLoadingOps(true)
    try {
      const res = await api.get('/ordens-producao', { params: { limit: 100 } })
      const lista: OpResumo[] = (res.data.data || []).filter((op: OpResumo) =>
        STATUS_ANALISE.includes(op.status),
      )
      setOps(lista)
    } catch {
      notifications.show({ title: 'Erro', message: 'Falha ao carregar ordens de produção', color: 'red' })
    } finally {
      setLoadingOps(false)
    }
  }, [])

  useEffect(() => { carregarOps() }, [carregarOps])

  const [reservando, setReservando] = useState(false)
  const [resultadoData, setResultadoData] = useState<ResultadoData | null>(null)

  // Analisar estoque + data de entrega da OP selecionada
  const analisar = useCallback(async (opId: string) => {
    setLoadingAnalise(true)
    setResultado(null)
    setResultadoData(null)
    try {
      const [estoqueRes, dataRes] = await Promise.all([
        api.get(`/pcp/analise-producao/${opId}/estoque`),
        api.get(`/pcp/analise-producao/${opId}/data-entrega`).catch(() => null),
      ])
      setResultado(estoqueRes.data)
      if (dataRes) setResultadoData(dataRes.data)
    } catch (err: any) {
      notifications.show({
        title: 'Erro',
        message: err?.response?.data?.message || 'Falha ao analisar estoque',
        color: 'red',
      })
    } finally {
      setLoadingAnalise(false)
    }
  }, [])

  // Reservar materiais da OP selecionada
  const reservar = useCallback(async () => {
    if (!opSelecionada) return
    setReservando(true)
    try {
      const res = await api.post(`/pcp/analise-producao/${opSelecionada}/reservar`)
      const { reservasCriadas, reservasIgnoradas } = res.data
      notifications.show({
        title: 'Reservas processadas',
        message: `${reservasCriadas} material(is) reservado(s), ${reservasIgnoradas} ignorado(s).`,
        color: reservasCriadas > 0 ? 'green' : 'yellow',
      })
      // Recarregar análise para refletir novos reservados
      await analisar(opSelecionada)
    } catch (err: any) {
      notifications.show({
        title: 'Erro',
        message: err?.response?.data?.message || 'Falha ao reservar materiais',
        color: 'red',
      })
    } finally {
      setReservando(false)
    }
  }, [opSelecionada, analisar])

  function handleSelecionar(opId: string | null) {
    setOpSelecionada(opId)
    if (opId) analisar(opId)
    else setResultado(null)
  }

  const opOptions = ops.map((op) => ({
    value: op.id,
    label: `OP #${op.referenciaExterna || op.numero} — ${op.produtoNome || op.clienteNome || 'Sem descrição'}`,
  }))

  return (
    <Stack gap="lg" p="md">
      <Group gap="sm">
        <ThemeIcon variant="light" color="green" size="lg"><IconClipboardCheck size={20} /></ThemeIcon>
        <Title order={3}>Análise de Produção</Title>
      </Group>
      <Text size="sm" c="dimmed" mt={-10}>
        Verifique a disponibilidade de estoque (produto acabado e materiais) antes de liberar a OP para produção.
      </Text>

      {/* Seleção de OP */}
      <Card withBorder pos="relative">
        <LoadingOverlay visible={loadingOps} />
        <Group align="flex-end">
          <Select
            label="Ordem de Produção"
            placeholder="Selecione uma OP para analisar"
            data={opOptions}
            value={opSelecionada}
            onChange={handleSelecionar}
            searchable
            leftSection={<IconSearch size={16} />}
            style={{ flex: 1 }}
            nothingFoundMessage="Nenhuma OP elegível para análise"
          />
          <Button
            variant="default"
            leftSection={<IconRefresh size={16} />}
            onClick={() => { carregarOps(); if (opSelecionada) analisar(opSelecionada) }}
          >
            Atualizar
          </Button>
        </Group>
        {ops.length === 0 && !loadingOps && (
          <Text size="sm" c="dimmed" mt="sm">
            Nenhuma OP com status Planejada/Programada/Rascunho encontrada.
          </Text>
        )}
      </Card>

      {/* Resultado da análise */}
      {loadingAnalise && (
        <Center h={200}><Loader color="green" /></Center>
      )}

      {resultado && !loadingAnalise && (
        <Stack gap="md">
          {/* Bloco 1 — Produto Acabado */}
          {resultado.produtoAcabado && (
            <Card withBorder>
              <Group gap="xs" mb="sm">
                <ThemeIcon variant="light" color="blue" size="md"><IconPackage size={16} /></ThemeIcon>
                <Text fw={600}>Produto Acabado</Text>
              </Group>
              <Group gap="xl">
                <div>
                  <Text size="xs" c="dimmed">Necessário</Text>
                  <Text fw={500}>{formatNum(resultado.produtoAcabado.quantidadePedido)} {resultado.produtoAcabado.unidade}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Em estoque (livre)</Text>
                  <Text fw={500} c="green">{formatNum(resultado.produtoAcabado.estoqueDisponivel)} {resultado.produtoAcabado.unidade}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">A produzir</Text>
                  <Text fw={700} c={resultado.produtoAcabado.aProduzir > 0 ? 'orange' : 'green'}>
                    {formatNum(resultado.produtoAcabado.aProduzir)} {resultado.produtoAcabado.unidade}
                  </Text>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                  {resultado.produtoAcabado.atendeDoEstoque ? (
                    <Badge color="green" leftSection={<IconCheck size={12} />}>Atende do estoque</Badge>
                  ) : (
                    <Badge color="orange" leftSection={<IconAlertTriangle size={12} />}>Precisa produzir</Badge>
                  )}
                </div>
              </Group>
            </Card>
          )}

          {/* Bloco 2 — Materiais */}
          <Card withBorder>
            <Group gap="xs" mb="sm">
              <ThemeIcon variant="light" color="grape" size="md"><IconFlask size={16} /></ThemeIcon>
              <Text fw={600}>Materiais (Matéria-Prima)</Text>
              <Group gap="xs" ml="auto">
                {resultado.resumo.todosDisponiveis ? (
                  <Badge color="green" leftSection={<IconCheck size={12} />}>
                    Todos disponíveis
                  </Badge>
                ) : (
                  <Badge color="red" leftSection={<IconAlertTriangle size={12} />}>
                    {resultado.resumo.materiaisComFalta} com falta
                  </Badge>
                )}
                {resultado.materiais.some((m) => m.produtoComponenteId) && (
                  <Button
                    size="xs"
                    variant="light"
                    color="grape"
                    leftSection={<IconLock size={14} />}
                    onClick={reservar}
                    loading={reservando}
                  >
                    Reservar Materiais
                  </Button>
                )}
              </Group>
            </Group>

            {resultado.materiais.length === 0 ? (
              <Text size="sm" c="dimmed">Esta OP não possui materiais cadastrados.</Text>
            ) : (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Material</Table.Th>
                    <Table.Th>Tipo</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Necessário</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Disponível</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Falta</Table.Th>
                    <Table.Th>Origem</Table.Th>
                    <Table.Th>Situação</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {resultado.materiais.map((m, idx) => (
                    <Table.Tr key={idx}>
                      <Table.Td>{m.descricao}</Table.Td>
                      <Table.Td>{m.tipoMaterial || '—'}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>{formatNum(m.quantidadeNecessaria)} {m.unidade}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>{formatNum(m.saldoDisponivel)} {m.unidade}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        {m.falta > 0 ? (
                          <Text c="red" fw={600} component="span">{formatNum(m.falta)} {m.unidade}</Text>
                        ) : '—'}
                      </Table.Td>
                      <Table.Td>
                        <Badge variant="light" color={m.origemEstoque === 'NENHUM' ? 'gray' : 'blue'} size="sm">
                          {m.origemEstoque === 'NENHUM' ? 'Sem cadastro' : m.origemEstoque}
                        </Badge>
                      </Table.Td>
                      <Table.Td>
                        <Badge color={SITUACAO_CONFIG[m.situacao].color}>
                          {SITUACAO_CONFIG[m.situacao].label}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            )}
          </Card>

          {/* Bloco 3 — Data de Entrega e Capacidade */}
          {resultadoData && (
            <Card withBorder>
              <Group gap="xs" mb="sm">
                <ThemeIcon variant="light" color="teal" size="md"><IconCalendarClock size={16} /></ThemeIcon>
                <Text fw={600}>Data de Entrega e Capacidade</Text>
                {resultadoData.atendeDataDesejada === true && (
                  <Badge color="green" ml="auto" leftSection={<IconCheck size={12} />}>Atende o prazo</Badge>
                )}
                {resultadoData.atendeDataDesejada === false && (
                  <Badge color="red" ml="auto" leftSection={<IconAlertTriangle size={12} />}>
                    {resultadoData.diasAtraso} dia(s) de atraso
                  </Badge>
                )}
              </Group>

              <Group gap="xl" mb="sm">
                <div>
                  <Text size="xs" c="dimmed">Tempo de produção</Text>
                  <Text fw={500}>{formatHoras(resultadoData.tempoProducaoTotalMin)}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Fila nas máquinas (gargalo)</Text>
                  <Text fw={500} c={resultadoData.filaTotalMin > 0 ? 'orange' : 'green'}>
                    {formatHoras(resultadoData.filaTotalMin)}
                  </Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Início estimado</Text>
                  <Text fw={500}>{formatData(resultadoData.dataInicioEstimada)}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Fim de produção</Text>
                  <Text fw={500}>{formatData(resultadoData.dataFimEstimada)}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Entrega viável</Text>
                  <Text fw={700} c="teal">{formatData(resultadoData.dataEntregaViavel)}</Text>
                </div>
                {resultadoData.dataEntregaDesejada && (
                  <div>
                    <Text size="xs" c="dimmed">Data desejada</Text>
                    <Text fw={500}>{formatData(resultadoData.dataEntregaDesejada)}</Text>
                  </div>
                )}
              </Group>

              {resultadoData.etapas.length > 0 && (
                <Table striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>#</Table.Th>
                      <Table.Th>Etapa</Table.Th>
                      <Table.Th>Centro/Máquina</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Tempo</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Fila no centro</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {resultadoData.etapas.map((e) => (
                      <Table.Tr key={e.sequencia}>
                        <Table.Td>{e.sequencia}</Table.Td>
                        <Table.Td>{e.descricao}</Table.Td>
                        <Table.Td>{e.centroNome || '—'}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>{formatHoras(e.tempoTotalMin)}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          {e.filaAnteriorMin > 0 ? (
                            <Text component="span" c="orange" size="sm">{formatHoras(e.filaAnteriorMin)}</Text>
                          ) : '—'}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              )}

              {resultadoData.avisos.length > 0 && (
                <Stack gap={2} mt="sm">
                  {resultadoData.avisos.map((a, i) => (
                    <Text key={i} size="xs" c="dimmed">
                      <IconClock size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />{a}
                    </Text>
                  ))}
                </Stack>
              )}
            </Card>
          )}

          <Divider label="Próximos passos (em breve)" labelPosition="center" />
          <Text size="xs" c="dimmed" ta="center">
            Requisição de compra dos materiais em falta e geração da Ordem de Produção serão adicionados nas próximas etapas.
          </Text>
        </Stack>
      )}
    </Stack>
  )
}
