'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Title, Stack, Card, Group, Text, Table, Badge, Button, Select,
  LoadingOverlay, Center, Loader, ThemeIcon, Tabs, Modal, NumberInput,
  Divider, Alert,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import {
  IconClipboardCheck, IconPackage, IconFlask, IconCheck, IconAlertTriangle,
  IconRefresh, IconSearch, IconLock, IconCalendarClock, IconClock,
  IconShoppingCart, IconCirclePlus, IconCircleCheck, IconRocket,
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

// ── Painel de Análise (reutilizável) ─────────────────────────────────────────
// Renderiza a análise completa de uma OP (estoque de PA, materiais, edição de
// quantidade/data/prioridade, data de entrega/capacidade e compras). Usado
// tanto no assistente "Gerar OP" (dentro de um Modal) quanto na aba de
// Cálculos/Análises (seleção manual de OP).

interface PainelAnaliseProps {
  opId: string
  /** Callback após firmar (Gerar OP) com sucesso. Se ausente, o botão firmar não aparece. */
  onFirmado?: () => void
  /** Permite editar quantidade/data/prioridade (fase de simulação). */
  editavel?: boolean
}

function PainelAnalise({ opId, onFirmado, editavel = true }: PainelAnaliseProps) {
  const [resultado, setResultado] = useState<ResultadoEstoque | null>(null)
  const [resultadoData, setResultadoData] = useState<ResultadoData | null>(null)
  const [loading, setLoading] = useState(false)
  const [reservando, setReservando] = useState(false)
  const [gerandoCompras, setGerandoCompras] = useState(false)
  const [firmando, setFirmando] = useState(false)

  // Campos editáveis (simulação)
  const [quantidade, setQuantidade] = useState<number | undefined>(undefined)
  const [prioridade, setPrioridade] = useState<string | null>(null)
  const [dataDesejada, setDataDesejada] = useState<Date | null>(null)
  const [salvandoEdicao, setSalvandoEdicao] = useState(false)

  const analisar = useCallback(async () => {
    setLoading(true)
    setResultado(null)
    setResultadoData(null)
    try {
      const [estoqueRes, dataRes] = await Promise.all([
        api.get(`/pcp/analise-producao/${opId}/estoque`),
        api.get(`/pcp/analise-producao/${opId}/data-entrega`).catch(() => null),
      ])
      setResultado(estoqueRes.data)
      if (dataRes) {
        setResultadoData(dataRes.data)
        if (dataRes.data?.dataEntregaDesejada && !dataDesejada) {
          setDataDesejada(new Date(dataRes.data.dataEntregaDesejada))
        }
      }
      if (estoqueRes.data?.produtoAcabado && quantidade === undefined) {
        setQuantidade(estoqueRes.data.produtoAcabado.quantidadePedido)
      }
    } catch (err: any) {
      notifications.show({
        title: 'Erro',
        message: err?.response?.data?.message || 'Falha ao analisar a OP',
        color: 'red',
      })
    } finally {
      setLoading(false)
    }
  }, [opId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { analisar() }, [analisar])

  const salvarEdicao = useCallback(async () => {
    setSalvandoEdicao(true)
    try {
      await api.patch(`/pcp/analise-producao/${opId}/editar`, {
        quantidade: quantidade,
        prioridade: prioridade ?? undefined,
        dataEntregaPrevista: dataDesejada ? dataDesejada.toISOString() : null,
      })
      notifications.show({ title: 'Atualizado', message: 'Dados da OP atualizados. Recalculando...', color: 'green' })
      await analisar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao salvar edição', color: 'red' })
    } finally {
      setSalvandoEdicao(false)
    }
  }, [opId, quantidade, prioridade, dataDesejada, analisar])

  const reservar = useCallback(async () => {
    setReservando(true)
    try {
      const res = await api.post(`/pcp/analise-producao/${opId}/reservar`)
      const { reservasCriadas, reservasIgnoradas } = res.data
      notifications.show({
        title: 'Reservas processadas',
        message: `${reservasCriadas} reservado(s), ${reservasIgnoradas} ignorado(s).`,
        color: reservasCriadas > 0 ? 'green' : 'yellow',
      })
      await analisar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao reservar', color: 'red' })
    } finally {
      setReservando(false)
    }
  }, [opId, analisar])

  const gerarCompras = useCallback(async () => {
    setGerandoCompras(true)
    try {
      const res = await api.post(`/pcp/analise-producao/${opId}/sugestoes-compra`)
      const { sugestoesCriadas, sugestoesIgnoradas } = res.data
      notifications.show({
        title: 'Sugestões de compra',
        message: `${sugestoesCriadas} criada(s), ${sugestoesIgnoradas} ignorada(s).`,
        color: sugestoesCriadas > 0 ? 'green' : 'yellow',
      })
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao gerar compras', color: 'red' })
    } finally {
      setGerandoCompras(false)
    }
  }, [opId])

  // Firmar = "Gerar OP": reserva + compras + data + avança para PROGRAMADA
  const firmar = useCallback(async () => {
    setFirmando(true)
    try {
      const res = await api.post(`/pcp/analise-producao/${opId}/confirmar`, {
        reservar: true, gerarCompras: true, avancarStatus: true,
      })
      const { statusNovo, reservasCriadas, sugestoesCompraCriadas, avisos } = res.data
      notifications.show({
        title: 'OP gerada e firmada',
        message: `OP agora em ${statusNovo}. ${reservasCriadas} reserva(s), ${sugestoesCompraCriadas} compra(s).`,
        color: 'green',
      })
      if (avisos && avisos.length > 0) {
        notifications.show({ title: 'Avisos', message: avisos.join(' '), color: 'yellow' })
      }
      onFirmado?.()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao firmar a OP', color: 'red' })
    } finally {
      setFirmando(false)
    }
  }, [opId, onFirmado])

  if (loading && !resultado) {
    return <Center h={200}><Loader color="green" /></Center>
  }
  if (!resultado) {
    return <Center h={120}><Text size="sm" c="dimmed">Sem dados de análise.</Text></Center>
  }

  const temMaterialSemCadastro = resultado.materiais.some((m) => !m.produtoComponenteId)

  return (
    <Stack gap="md" pos="relative">
      <LoadingOverlay visible={loading} />

      {/* Edição de dados da OP (simulação) */}
      {editavel && (
        <Card withBorder>
          <Group gap="xs" mb="sm">
            <ThemeIcon variant="light" color="blue" size="md"><IconClipboardCheck size={16} /></ThemeIcon>
            <Text fw={600}>Dados da OP (editáveis antes de gerar)</Text>
          </Group>
          <Group align="flex-end" wrap="wrap">
            <NumberInput
              label="Quantidade"
              value={quantidade}
              onChange={(v) => setQuantidade(typeof v === 'number' ? v : undefined)}
              min={1}
              style={{ minWidth: 140 }}
            />
            <Select
              label="Prioridade"
              placeholder="Manter"
              data={[
                { value: 'BAIXA', label: 'Baixa' },
                { value: 'NORMAL', label: 'Normal' },
                { value: 'ALTA', label: 'Alta' },
                { value: 'URGENTE', label: 'Urgente' },
              ]}
              value={prioridade}
              onChange={setPrioridade}
              clearable
              style={{ minWidth: 140 }}
            />
            <DateInput
              label="Data de entrega desejada"
              placeholder="Selecione"
              value={dataDesejada}
              onChange={(v) => setDataDesejada(v as Date | null)}
              clearable
              valueFormat="DD/MM/YYYY"
              style={{ minWidth: 180 }}
            />
            <Button variant="light" onClick={salvarEdicao} loading={salvandoEdicao} leftSection={<IconRefresh size={14} />}>
              Aplicar e recalcular
            </Button>
          </Group>
        </Card>
      )}

      {/* Produto Acabado */}
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

      {/* Materiais */}
      <Card withBorder>
        <Group gap="xs" mb="sm">
          <ThemeIcon variant="light" color="grape" size="md"><IconFlask size={16} /></ThemeIcon>
          <Text fw={600}>Materiais (Matéria-Prima)</Text>
          <Group gap="xs" ml="auto">
            {resultado.resumo.todosDisponiveis ? (
              <Badge color="green" leftSection={<IconCheck size={12} />}>Todos disponíveis</Badge>
            ) : (
              <Badge color="red" leftSection={<IconAlertTriangle size={12} />}>{resultado.resumo.materiaisComFalta} com falta</Badge>
            )}
            {resultado.materiais.some((m) => m.produtoComponenteId) && (
              <Button size="xs" variant="light" color="grape" leftSection={<IconLock size={14} />} onClick={reservar} loading={reservando}>
                Reservar Materiais
              </Button>
            )}
          </Group>
        </Group>

        {temMaterialSemCadastro && (
          <Alert color="yellow" variant="light" mb="sm" icon={<IconAlertTriangle size={16} />}>
            Há materiais sem vínculo de cadastro (comuns em OPs de orçamento gráfico). Para eles não é possível
            ver estoque nem reservar — vincule o material a um produto cadastrado no cadastro da OP para habilitar a análise completa.
          </Alert>
        )}

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
                    {m.falta > 0 ? <Text c="red" fw={600} component="span">{formatNum(m.falta)} {m.unidade}</Text> : '—'}
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={m.origemEstoque === 'NENHUM' ? 'gray' : 'blue'} size="sm">
                      {m.origemEstoque === 'NENHUM' ? 'Sem cadastro' : m.origemEstoque}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={SITUACAO_CONFIG[m.situacao].color}>{SITUACAO_CONFIG[m.situacao].label}</Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {/* Data de Entrega e Capacidade */}
      {resultadoData && (
        <Card withBorder>
          <Group gap="xs" mb="sm">
            <ThemeIcon variant="light" color="teal" size="md"><IconCalendarClock size={16} /></ThemeIcon>
            <Text fw={600}>Data de Entrega e Capacidade</Text>
            {resultadoData.atendeDataDesejada === true && (
              <Badge color="green" ml="auto" leftSection={<IconCheck size={12} />}>Atende o prazo</Badge>
            )}
            {resultadoData.atendeDataDesejada === false && (
              <Badge color="red" ml="auto" leftSection={<IconAlertTriangle size={12} />}>{resultadoData.diasAtraso} dia(s) de atraso</Badge>
            )}
          </Group>

          <Group gap="xl" mb="sm">
            <div><Text size="xs" c="dimmed">Tempo de produção</Text><Text fw={500}>{formatHoras(resultadoData.tempoProducaoTotalMin)}</Text></div>
            <div><Text size="xs" c="dimmed">Fila nas máquinas (gargalo)</Text><Text fw={500} c={resultadoData.filaTotalMin > 0 ? 'orange' : 'green'}>{formatHoras(resultadoData.filaTotalMin)}</Text></div>
            <div><Text size="xs" c="dimmed">Início estimado</Text><Text fw={500}>{formatData(resultadoData.dataInicioEstimada)}</Text></div>
            <div><Text size="xs" c="dimmed">Fim de produção</Text><Text fw={500}>{formatData(resultadoData.dataFimEstimada)}</Text></div>
            <div><Text size="xs" c="dimmed">Entrega viável</Text><Text fw={700} c="teal">{formatData(resultadoData.dataEntregaViavel)}</Text></div>
            {resultadoData.dataEntregaDesejada && (
              <div><Text size="xs" c="dimmed">Data desejada</Text><Text fw={500}>{formatData(resultadoData.dataEntregaDesejada)}</Text></div>
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
                      {e.filaAnteriorMin > 0 ? <Text component="span" c="orange" size="sm">{formatHoras(e.filaAnteriorMin)}</Text> : '—'}
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

      {/* Compras Necessárias */}
      {resultado.resumo.materiaisComFalta > 0 && (
        <Card withBorder>
          <Group gap="xs" mb="sm">
            <ThemeIcon variant="light" color="orange" size="md"><IconShoppingCart size={16} /></ThemeIcon>
            <Text fw={600}>Compras Necessárias</Text>
            <Button size="xs" variant="light" color="orange" ml="auto" leftSection={<IconShoppingCart size={14} />} onClick={gerarCompras} loading={gerandoCompras}>
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
                  <Table.Td style={{ textAlign: 'right' }}><Text c="red" fw={600} component="span">{formatNum(m.falta)} {m.unidade}</Text></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      {/* Botão final: Firmar / Gerar OP */}
      {onFirmado && (
        <>
          <Divider />
          <Group justify="space-between">
            <Text size="sm" c="dimmed">
              Ao gerar, os materiais disponíveis são reservados, as compras da falta são geradas, a data é
              gravada e a OP entra na Programação.
            </Text>
            <Button color="green" size="md" leftSection={<IconRocket size={18} />} onClick={firmar} loading={firmando}>
              Gerar OP (Firmar)
            </Button>
          </Group>
        </>
      )}
    </Stack>
  )
}

// ── ABA 1: Gerar OP a partir de pedidos aprovados (assistente) ───────────────

function AbaGerarOp() {
  const [pedidos, setPedidos] = useState<PedidoElegivel[]>([])
  const [loading, setLoading] = useState(true)
  const [iniciandoId, setIniciandoId] = useState<string | null>(null)
  // Análise aberta em modal: { opId, numero, pedidoCliente }
  const [analiseAberta, setAnaliseAberta] = useState<{ opId: string; numero: number; cliente: string | null } | null>(null)

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

  // Passo 1 do assistente: cria a OP em PLANEJADA e abre a tela de análise
  const analisar = useCallback(async (pedido: PedidoElegivel) => {
    setIniciandoId(pedido.id)
    try {
      const res = await api.post(`/pcp/analise-producao/pedidos/${pedido.id}/iniciar-analise`)
      const { ordemProducaoId, numero, avisos } = res.data
      if (avisos && avisos.length > 0) {
        notifications.show({ title: 'Avisos', message: avisos.join(' '), color: 'yellow' })
      }
      setAnaliseAberta({ opId: ordemProducaoId, numero, cliente: pedido.clienteNome })
    } catch (err: any) {
      notifications.show({
        title: 'Não foi possível analisar',
        message: err?.response?.data?.message || 'Falha ao iniciar a análise do pedido',
        color: 'red',
      })
    } finally {
      setIniciandoId(null)
    }
  }, [])

  // Passo 2 concluído: OP firmada → fecha modal e recarrega lista
  const aoFirmar = useCallback(() => {
    setAnaliseAberta(null)
    carregarPedidos()
  }, [carregarPedidos])

  return (
    <Card withBorder pos="relative" mt="md">
      <LoadingOverlay visible={loading} />
      <Group gap="xs" mb="sm">
        <ThemeIcon variant="light" color="green" size="md"><IconCirclePlus size={16} /></ThemeIcon>
        <Text fw={600}>Pedidos Aprovados Aguardando Geração de OP</Text>
        <Button size="xs" variant="default" ml="auto" leftSection={<IconRefresh size={14} />} onClick={carregarPedidos}>
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
                    color="teal"
                    leftSection={<IconClipboardCheck size={14} />}
                    onClick={() => analisar(p)}
                    loading={iniciandoId === p.id}
                    disabled={iniciandoId !== null && iniciandoId !== p.id}
                  >
                    Analisar / Gerar OP
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {/* Modal do assistente: tela de Cálculos/Análises + botão Gerar OP no fim */}
      <Modal
        opened={!!analiseAberta}
        onClose={() => setAnaliseAberta(null)}
        title={
          <Group gap="xs">
            <ThemeIcon variant="light" color="teal" size="md"><IconClipboardCheck size={16} /></ThemeIcon>
            <Text fw={600}>
              Análise de Produção — OP #{analiseAberta?.numero}
              {analiseAberta?.cliente ? ` · ${analiseAberta.cliente}` : ''}
            </Text>
          </Group>
        }
        size="90%"
        centered
      >
        {analiseAberta && (
          <PainelAnalise opId={analiseAberta.opId} onFirmado={aoFirmar} editavel />
        )}
      </Modal>
    </Card>
  )
}

// ── ABA 2: Cálculos / Análises de OPs nativas (seleção manual) ───────────────

const STATUS_ANALISE = ['PLANEJADA', 'PROGRAMADA', 'RASCUNHO']

function AbaAnalises() {
  const [ops, setOps] = useState<OpNativa[]>([])
  const [loadingOps, setLoadingOps] = useState(true)
  const [opSelecionada, setOpSelecionada] = useState<string | null>(null)

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

  const opOptions = ops.map((op) => ({
    value: op.id,
    label: `OP #${op.referenciaExterna || op.numero} — ${op.produtoNome || op.clienteNome || 'Sem descrição'} (${op.status})`,
  }))

  return (
    <Stack gap="md" mt="md">
      <Card withBorder pos="relative">
        <LoadingOverlay visible={loadingOps} />
        <Group align="flex-end">
          <Select
            label="Ordem de Produção"
            placeholder="Selecione uma OP para analisar"
            data={opOptions}
            value={opSelecionada}
            onChange={setOpSelecionada}
            searchable
            leftSection={<IconSearch size={16} />}
            style={{ flex: 1 }}
            nothingFoundMessage="Nenhuma OP elegível para análise"
          />
          <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={carregarOps}>
            Atualizar
          </Button>
        </Group>
        {ops.length === 0 && !loadingOps && (
          <Text size="sm" c="dimmed" mt="sm">Nenhuma OP com status Planejada/Programada/Rascunho encontrada.</Text>
        )}
      </Card>

      {opSelecionada && (
        // Na aba de consulta não mostramos o botão firmar (sem onFirmado):
        // é só análise/recalculo das OPs já existentes.
        <PainelAnalise key={opSelecionada} opId={opSelecionada} editavel={false} />
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
        Analise estoque, capacidade, prazos e compras — e gere a Ordem de Produção ao final da análise.
      </Text>

      <Tabs defaultValue="gerar">
        <Tabs.List>
          <Tabs.Tab value="gerar" leftSection={<IconCirclePlus size={16} />}>Gerar OP</Tabs.Tab>
          <Tabs.Tab value="analises" leftSection={<IconClipboardCheck size={16} />}>Cálculos / Análises</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="gerar"><AbaGerarOp /></Tabs.Panel>
        <Tabs.Panel value="analises"><AbaAnalises /></Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
