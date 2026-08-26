'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Title, Stack, Card, Group, Text, Table, Badge, Button, Select,
  LoadingOverlay, Center, Loader, ThemeIcon, Tabs,
} from '@mantine/core'
import {
  IconClipboardCheck, IconPackage, IconFlask, IconCheck, IconAlertTriangle,
  IconRefresh, IconSearch, IconLock, IconCalendarClock, IconClock,
  IconShoppingCart, IconCirclePlus, IconCircleCheck,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'

// ── Tipos ──────────────────────────────────────────────────────────────────

interface PedidoElegivel {
  id: string
  numero: number
  clienteNome: string | null
  valorTotal: number
  origemPedido: string
  origemOrcamentoGrafico: boolean
  criadoEm: string
  itens: Array<{ id: string; produtoId: string; produtoNome: string; quantidade: number; unidade: string }>
}

interface OpNativa {
  id: string
  numero: number
  referenciaExterna: string | null
  status: string
  quantidade: number
  unidadeMedida: string
  origemImportacao: string | null
  dataEntregaPrevista: string | null
  clienteNome: string | null
  produtoNome: string | null
  criadoEm: string
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

function formatMoeda(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

// ── ABA 1: Gerar OP a partir de pedidos aprovados ────────────────────────────

function AbaGerarOp() {
  const [pedidos, setPedidos] = useState<PedidoElegivel[]>([])
  const [loading, setLoading] = useState(true)
  const [gerandoId, setGerandoId] = useState<string | null>(null)

  const carregarPedidos = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/pcp/analise-producao/pedidos-elegiveis')
      setPedidos(res.data.data || res.data || [])
    } catch {
      notifications.show({ title: 'Erro', message: 'Falha ao carregar pedidos elegíveis', color: 'red' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { carregarPedidos() }, [carregarPedidos])

  const gerarOp = useCallback(async (pedidoId: string) => {
    setGerandoId(pedidoId)
    try {
      const res = await api.post(`/pcp/analise-producao/pedidos/${pedidoId}/gerar-op`)
      const { opsGeradas, avisos } = res.data
      const numeros = (opsGeradas || []).map((op: { numero: number }) => `#${op.numero}`).join(', ')
      notifications.show({
        title: 'OPs geradas',
        message: `${(opsGeradas || []).length} OP(s) gerada(s)${numeros ? `: ${numeros}` : ''}.`,
        color: 'green',
      })
      if (avisos && avisos.length > 0) {
        notifications.show({ title: 'Avisos', message: avisos.join(' '), color: 'yellow' })
      }
      await carregarPedidos()
    } catch (err: any) {
      notifications.show({
        title: 'Erro',
        message: err?.response?.data?.message || 'Falha ao gerar OP a partir do pedido',
        color: 'red',
      })
    } finally {
      setGerandoId(null)
    }
  }, [carregarPedidos])

  return (
    <Card withBorder pos="relative" mt="md">
      <LoadingOverlay visible={loading} />
      <Group gap="xs" mb="sm">
        <ThemeIcon variant="light" color="green" size="md"><IconCirclePlus size={16} /></ThemeIcon>
        <Text fw={600}>Pedidos Aprovados Aguardando Geração de OP</Text>
        <Button
          size="xs"
          variant="default"
          ml="auto"
          leftSection={<IconRefresh size={14} />}
          onClick={carregarPedidos}
        >
          Atualizar
        </Button>
      </Group>

      {pedidos.length === 0 && !loading ? (
        <Center h={120}>
          <Text size="sm" c="dimmed">Nenhum pedido aprovado aguardando geração de OP.</Text>
        </Center>
      ) : (
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Pedido</Table.Th>
              <Table.Th>Cliente</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Valor</Table.Th>
              <Table.Th>Origem</Table.Th>
              <Table.Th style={{ textAlign: 'center' }}>Itens</Table.Th>
              <Table.Th style={{ textAlign: 'right' }}>Ação</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {pedidos.map((p) => (
              <Table.Tr key={p.id}>
                <Table.Td fw={600}>#{p.numero}</Table.Td>
                <Table.Td>{p.clienteNome || '—'}</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>{formatMoeda(p.valorTotal)}</Table.Td>
                <Table.Td>
                  <Badge variant="light" color={p.origemOrcamentoGrafico ? 'grape' : 'blue'} size="sm">
                    {p.origemOrcamentoGrafico ? 'Orçamento Gráfico' : p.origemPedido}
                  </Badge>
                </Table.Td>
                <Table.Td style={{ textAlign: 'center' }}>{p.itens?.length ?? 0}</Table.Td>
                <Table.Td style={{ textAlign: 'right' }}>
                  <Button
                    size="xs"
                    color="green"
                    leftSection={<IconCircleCheck size={14} />}
                    onClick={() => gerarOp(p.id)}
                    loading={gerandoId === p.id}
                    disabled={gerandoId !== null && gerandoId !== p.id}
                  >
                    Gerar OP
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Card>
  )
}

// ── ABA 2: Cálculos / Análises de OPs nativas ────────────────────────────────

// Status de OP elegíveis para análise (antes de liberar para produção)
const STATUS_ANALISE = ['PLANEJADA', 'PROGRAMADA', 'RASCUNHO']

function AbaAnalises() {
  const [ops, setOps] = useState<OpNativa[]>([])
  const [loadingOps, setLoadingOps] = useState(true)
  const [opSelecionada, setOpSelecionada] = useState<string | null>(null)
  const [resultado, setResultado] = useState<ResultadoEstoque | null>(null)
  const [loadingAnalise, setLoadingAnalise] = useState(false)
  const [reservando, setReservando] = useState(false)
  const [resultadoData, setResultadoData] = useState<ResultadoData | null>(null)
  const [gerandoCompras, setGerandoCompras] = useState(false)

  // Carregar OPs nativas elegíveis para análise
  const carregarOps = useCallback(async () => {
    setLoadingOps(true)
    try {
      const res = await api.get('/pcp/analise-producao/ops-nativas')
      const lista: OpNativa[] = (res.data.data || res.data || []).filter((op: OpNativa) =>
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

  // Gerar sugestões de compra dos materiais em falta
  const gerarCompras = useCallback(async () => {
    if (!opSelecionada) return
    setGerandoCompras(true)
    try {
      const res = await api.post(`/pcp/analise-producao/${opSelecionada}/sugestoes-compra`)
      const { sugestoesCriadas, sugestoesIgnoradas } = res.data
      notifications.show({
        title: 'Sugestões de compra',
        message: `${sugestoesCriadas} sugestão(ões) criada(s), ${sugestoesIgnoradas} ignorada(s).`,
        color: sugestoesCriadas > 0 ? 'green' : 'yellow',
      })
    } catch (err: any) {
      notifications.show({
        title: 'Erro',
        message: err?.response?.data?.message || 'Falha ao gerar sugestões de compra',
        color: 'red',
      })
    } finally {
      setGerandoCompras(false)
    }
  }, [opSelecionada])

  function handleSelecionar(opId: string | null) {
    setOpSelecionada(opId)
    if (opId) analisar(opId)
    else { setResultado(null); setResultadoData(null) }
  }

  const opOptions = ops.map((op) => ({
    value: op.id,
    label: `OP #${op.referenciaExterna || op.numero} — ${op.produtoNome || op.clienteNome || 'Sem descrição'}`,
  }))

  return (
    <Stack gap="md" mt="md">
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
          <Button
            color="green"
            leftSection={<IconClipboardCheck size={16} />}
            onClick={() => { if (opSelecionada) analisar(opSelecionada) }}
            disabled={!opSelecionada}
            loading={loadingAnalise}
          >
            Recalcular
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

          {/* Bloco 4 — Compras Necessárias */}
          {resultado.resumo.materiaisComFalta > 0 && (
            <Card withBorder>
              <Group gap="xs" mb="sm">
                <ThemeIcon variant="light" color="orange" size="md"><IconShoppingCart size={16} /></ThemeIcon>
                <Text fw={600}>Compras Necessárias</Text>
                <Button
                  size="xs"
                  variant="light"
                  color="orange"
                  ml="auto"
                  leftSection={<IconShoppingCart size={14} />}
                  onClick={gerarCompras}
                  loading={gerandoCompras}
                >
                  Gerar Requisições de Compra
                </Button>
              </Group>

              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Material</Table.Th>
                    <Table.Th style={{ textAlign: 'right' }}>Falta</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {resultado.materiais.filter((m) => m.falta > 0).map((m, idx) => (
                    <Table.Tr key={idx}>
                      <Table.Td>{m.descricao}</Table.Td>
                      <Table.Td style={{ textAlign: 'right' }}>
                        <Text c="red" fw={600} component="span">{formatNum(m.falta)} {m.unidade}</Text>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Card>
          )}
        </Stack>
      )}
    </Stack>
  )
}

export default function AnaliseProducaoPage() {
  useEffect(() => { document.title = 'Vizor - PCP - Análise de Produção' }, [])

  return (
    <Stack gap="lg" p="md">
      <Group gap="sm">
        <ThemeIcon variant="light" color="green" size="lg"><IconClipboardCheck size={20} /></ThemeIcon>
        <Title order={3}>Análise de Produção</Title>
      </Group>
      <Text size="sm" c="dimmed" mt={-10}>
        Gere Ordens de Produção a partir de pedidos aprovados ou analise a disponibilidade de estoque das OPs existentes.
      </Text>

      <Tabs defaultValue="gerar">
        <Tabs.List>
          <Tabs.Tab value="gerar" leftSection={<IconCirclePlus size={16} />}>
            Gerar OP
          </Tabs.Tab>
          <Tabs.Tab value="analises" leftSection={<IconClipboardCheck size={16} />}>
            Cálculos / Análises
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="gerar">
          <AbaGerarOp />
        </Tabs.Panel>

        <Tabs.Panel value="analises">
          <AbaAnalises />
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
