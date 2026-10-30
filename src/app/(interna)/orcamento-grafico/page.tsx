'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Title, Stack, Table, Group, Button, Badge, Text, Loader, Center,
  TextInput, Select, Paper, ScrollArea, Pagination, Tooltip, Modal, PasswordInput,
  Textarea,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import {
  IconPlus, IconSearch, IconFilter, IconListSearch, IconPlayerPlay, IconExternalLink,
  IconFileText, IconSignature, IconX, IconChecks, IconRefresh, IconPrinter,
} from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'
import BuscaCalculoModal from './[id]/BuscaCalculoModal'

// ============================================================================
// Tipos
// ============================================================================

interface OrcamentoGrafico {
  id: string
  numero: number
  versao: number
  clienteNome?: string | null
  clienteId?: string | null
  tipoEmbalagem?: { descricao: string } | null
  quantidade: number
  precoVenda?: number | string | null
  status: string
  etapaCalculo?: string | null // AGUARDANDO | EM_CALCULO | VALIDAR | VALIDADO | null
  tipo?: string | null // NOVO | REPETICAO
  criadoEm: string
}

interface PaginatedResponse {
  data: OrcamentoGrafico[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ============================================================================
// Status Badge (status principal — reusado por outras telas)
// ============================================================================

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  RASCUNHO: { color: 'gray', label: 'Rascunho' },
  ENVIADO: { color: 'blue', label: 'Enviado' },
  APROVADO: { color: 'green', label: 'Aprovado' },
  CONVERTIDO: { color: 'teal', label: 'Convertido' },
  RECUSADO: { color: 'red', label: 'Recusado' },
  VENCIDO: { color: 'orange', label: 'Vencido' },
}

export function StatusBadge({ status }: { status: string }) {
  const config = STATUS_CONFIG[status] || { color: 'gray', label: status }
  return <Badge color={config.color}>{config.label}</Badge>
}

// Badge da sub-etapa do cálculo (grids do Comercial).
const ETAPA_CONFIG: Record<string, { color: string; label: string }> = {
  AGUARDANDO: { color: 'yellow', label: 'A orçar' },
  EM_CALCULO: { color: 'indigo', label: 'Em cálculo' },
  VALIDAR: { color: 'orange', label: 'Validar cálculo' },
  VALIDADO: { color: 'green', label: 'Validado' },
}

function EtapaBadge({ etapa }: { etapa?: string | null }) {
  if (!etapa) return <Badge variant="light" color="gray">Avulso</Badge>
  const c = ETAPA_CONFIG[etapa] || { color: 'gray', label: etapa }
  return <Badge variant="light" color={c.color}>{c.label}</Badge>
}

// ============================================================================
// Formatadores
// ============================================================================

function formatCurrency(val: number | string | null | undefined): string {
  if (val == null) return '—'
  const num = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(num)) return '—'
  return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

// ============================================================================
// Página Principal — Orçamento (dois grids + listagem geral)
// ============================================================================

export default function OrcamentosGraficoPage() {
  const router = useRouter()

  useEffect(() => { document.title = 'Orçamentos Gráficos' }, [])

  // ── Listagem geral (histórico completo, paginado) ──
  const [data, setData] = useState<OrcamentoGrafico[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)

  // Filtros da listagem geral
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState<string | null>(null)
  const [dataInicio, setDataInicio] = useState<Date | null>(null)
  const [dataFim, setDataFim] = useState<Date | null>(null)

  // ── Grids do Comercial ──
  const [aOrcar, setAOrcar] = useState<OrcamentoGrafico[]>([])
  const [emAndamento, setEmAndamento] = useState<OrcamentoGrafico[]>([])
  const [loadingGrids, setLoadingGrids] = useState(true)
  const [acaoLoading, setAcaoLoading] = useState<string | null>(null)

  // Modal assinatura (validar cálculo)
  const [assinarAlvo, setAssinarAlvo] = useState<OrcamentoGrafico | null>(null)
  const [senhaAssinatura, setSenhaAssinatura] = useState('')
  // Modal cancelar
  const [cancelarAlvo, setCancelarAlvo] = useState<OrcamentoGrafico | null>(null)
  const [motivoCancelar, setMotivoCancelar] = useState('')

  // Puxar Cálculo da Biblioteca (modo criação — sem orcamentoId)
  const [buscaCalcOpen, setBuscaCalcOpen] = useState(false)

  const LIMIT = 50

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, any> = { page, limit: LIMIT }
      if (busca.trim()) params.busca = busca.trim()
      if (statusFiltro) params.status = statusFiltro
      if (dataInicio) params.dataInicio = dataInicio.toISOString()
      if (dataFim) params.dataFim = dataFim.toISOString()

      const res = await api.get('/orcamento-grafico', { params })
      const result: PaginatedResponse = res.data
      setData(result.data || [])
      setTotal(result.total || 0)
      setTotalPages(result.totalPages || 1)
    } catch (err: any) {
      notifications.show({
        title: 'Erro ao carregar',
        message: err?.response?.data?.message || 'Falha ao buscar orçamentos',
        color: 'red',
      })
    } finally {
      setLoading(false)
    }
  }, [page, busca, statusFiltro, dataInicio, dataFim])

  // Carrega os dois grids do funil (entrada + em andamento).
  const carregarGrids = useCallback(async () => {
    setLoadingGrids(true)
    try {
      const [r1, r2] = await Promise.all([
        api.get('/orcamento-grafico', { params: { etapa: 'A_ORCAR', limit: 100 } }),
        api.get('/orcamento-grafico', { params: { etapa: 'EM_ANDAMENTO', limit: 100 } }),
      ])
      setAOrcar(r1.data?.data || [])
      setEmAndamento(r2.data?.data || [])
    } catch {
      setAOrcar([])
      setEmAndamento([])
    } finally {
      setLoadingGrids(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { carregarGrids() }, [carregarGrids])
  useEffect(() => { setPage(1) }, [busca, statusFiltro, dataInicio, dataFim])

  function recarregarTudo() {
    carregar()
    carregarGrids()
  }

  // ── Ações do funil ──
  async function iniciar(orc: OrcamentoGrafico) {
    setAcaoLoading(orc.id)
    try {
      await api.post(`/orcamento-grafico/${orc.id}/calculo/iniciar`)
      notifications.show({ title: 'Cálculo iniciado', message: `Orçamento ${orc.numero} em cálculo.`, color: 'green' })
      router.push(`/orcamento-grafico/${orc.id}`)
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao iniciar', color: 'red' })
      setAcaoLoading(null)
    }
  }

  async function enviarValidacao(orc: OrcamentoGrafico) {
    setAcaoLoading(orc.id)
    try {
      await api.post(`/orcamento-grafico/${orc.id}/calculo/enviar-validacao`)
      notifications.show({ title: 'Enviado para validação', message: `Orçamento ${orc.numero} aguardando assinatura.`, color: 'green' })
      carregarGrids()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao enviar', color: 'red' })
    } finally {
      setAcaoLoading(null)
    }
  }

  async function assinar() {
    if (!assinarAlvo) return
    setAcaoLoading(assinarAlvo.id)
    try {
      await api.post(`/orcamento-grafico/${assinarAlvo.id}/calculo/assinar`, { senha: senhaAssinatura || undefined })
      notifications.show({ title: 'Cálculo validado', message: `Orçamento ${assinarAlvo.numero} assinado. Pronto para enviar proposta.`, color: 'green' })
      setAssinarAlvo(null)
      setSenhaAssinatura('')
      carregarGrids()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao assinar', color: 'red' })
    } finally {
      setAcaoLoading(null)
    }
  }

  async function reabrir(orc: OrcamentoGrafico) {
    setAcaoLoading(orc.id)
    try {
      await api.post(`/orcamento-grafico/${orc.id}/calculo/reabrir`)
      notifications.show({ title: 'Reaberto', message: `Orçamento ${orc.numero} voltou para cálculo.`, color: 'blue' })
      carregarGrids()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao reabrir', color: 'red' })
    } finally {
      setAcaoLoading(null)
    }
  }

  async function cancelar() {
    if (!cancelarAlvo) return
    setAcaoLoading(cancelarAlvo.id)
    try {
      await api.post(`/orcamento-grafico/${cancelarAlvo.id}/calculo/cancelar`, { motivo: motivoCancelar.trim() })
      notifications.show({ title: 'Cancelado', message: `Orçamento ${cancelarAlvo.numero} cancelado.`, color: 'orange' })
      setCancelarAlvo(null)
      setMotivoCancelar('')
      recarregarTudo()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao cancelar', color: 'red' })
    } finally {
      setAcaoLoading(null)
    }
  }

  async function imprimir(orc: OrcamentoGrafico) {
    setAcaoLoading(orc.id)
    try {
      const { data } = await api.get(`/orcamento-grafico/${orc.id}/proposta-pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }))
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao gerar PDF', color: 'red' })
    } finally {
      setAcaoLoading(null)
    }
  }

  return (
    <Stack gap="md">
      {/* Header */}
      <Group justify="space-between">
        <div>
          <Title order={3}>Orçamento</Title>
          <Text size="sm" c="dimmed">
            Fila de cálculo do setor de orçamento. {total} orçamento{total !== 1 ? 's' : ''} no total.
          </Text>
        </div>
        <Group gap="sm">
          <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={recarregarTudo}>Atualizar</Button>
          <Button
            variant="light"
            leftSection={<IconListSearch size={16} />}
            onClick={() => setBuscaCalcOpen(true)}
          >
            Puxar Cálculo
          </Button>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => router.push('/orcamento-grafico/novo')}
          >
            Novo Orçamento
          </Button>
        </Group>
      </Group>

      {/* ── GRID 1 — A orçar (entrada liberada pelo setor Propostas) ── */}
      <Paper withBorder p="md">
        <Group justify="space-between" mb="xs">
          <Group gap="xs">
            <Text fw={700}>A orçar</Text>
            <Badge color="yellow" variant="light">{aOrcar.length}</Badge>
          </Group>
          <Text size="xs" c="dimmed">Propostas/pedidos liberados aguardando iniciar o cálculo.</Text>
        </Group>
        {loadingGrids ? (
          <Center py="md"><Loader size="sm" /></Center>
        ) : aOrcar.length === 0 ? (
          <Text c="dimmed" size="sm" py="sm">Nenhum item aguardando orçamento.</Text>
        ) : (
          <ScrollArea>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nº</Table.Th>
                  <Table.Th>Cliente</Table.Th>
                  <Table.Th>Tipo Embalagem</Table.Th>
                  <Table.Th ta="right">Quantidade</Table.Th>
                  <Table.Th>Recebido</Table.Th>
                  <Table.Th>Ações</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {aOrcar.map((orc) => (
                  <Table.Tr key={orc.id}>
                    <Table.Td fw={600}>{orc.numero}</Table.Td>
                    <Table.Td>{orc.clienteNome || '—'}</Table.Td>
                    <Table.Td>{orc.tipoEmbalagem?.descricao || '—'}</Table.Td>
                    <Table.Td ta="right">{orc.quantidade?.toLocaleString('pt-BR') || '—'}</Table.Td>
                    <Table.Td>{formatDate(orc.criadoEm)}</Table.Td>
                    <Table.Td>
                      <Group gap={6} wrap="nowrap">
                        <Button
                          size="compact-sm"
                          color="indigo"
                          leftSection={<IconPlayerPlay size={15} />}
                          loading={acaoLoading === orc.id}
                          onClick={() => iniciar(orc)}
                        >
                          Iniciar orçamento
                        </Button>
                        <Tooltip label="Abrir / ver dados">
                          <Button size="compact-sm" variant="subtle" leftSection={<IconExternalLink size={15} />}
                            onClick={() => router.push(`/orcamento-grafico/${orc.id}`)}>
                            Abrir
                          </Button>
                        </Tooltip>
                        <Tooltip label="Cancelar / devolver ao comercial">
                          <Button size="compact-sm" variant="subtle" color="red" leftSection={<IconX size={15} />}
                            onClick={() => { setCancelarAlvo(orc); setMotivoCancelar('') }}>
                            Cancelar
                          </Button>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Paper>

      {/* ── GRID 2 — Em andamento (orçamentos sendo calculados/validados) ── */}
      <Paper withBorder p="md">
        <Group justify="space-between" mb="xs">
          <Group gap="xs">
            <Text fw={700}>Em andamento</Text>
            <Badge color="indigo" variant="light">{emAndamento.length}</Badge>
          </Group>
          <Text size="xs" c="dimmed">Em cálculo, aguardando validação (assinatura) ou já validados.</Text>
        </Group>
        {loadingGrids ? (
          <Center py="md"><Loader size="sm" /></Center>
        ) : emAndamento.length === 0 ? (
          <Text c="dimmed" size="sm" py="sm">Nenhum orçamento em andamento.</Text>
        ) : (
          <ScrollArea>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nº</Table.Th>
                  <Table.Th>Cliente</Table.Th>
                  <Table.Th ta="right">Preço</Table.Th>
                  <Table.Th>Etapa</Table.Th>
                  <Table.Th>Ações</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {emAndamento.map((orc) => (
                  <Table.Tr key={orc.id}>
                    <Table.Td fw={600}>{orc.numero}</Table.Td>
                    <Table.Td>{orc.clienteNome || '—'}</Table.Td>
                    <Table.Td ta="right">{formatCurrency(orc.precoVenda)}</Table.Td>
                    <Table.Td><EtapaBadge etapa={orc.etapaCalculo} /></Table.Td>
                    <Table.Td>
                      <Group gap={6} wrap="nowrap">
                        <Tooltip label="Abrir / calcular">
                          <Button size="compact-sm" variant="subtle" leftSection={<IconExternalLink size={15} />}
                            onClick={() => router.push(`/orcamento-grafico/${orc.id}`)}>
                            Abrir
                          </Button>
                        </Tooltip>
                        <Tooltip label="Imprimir proposta (PDF)">
                          <Button size="compact-sm" variant="subtle" leftSection={<IconPrinter size={15} />}
                            loading={acaoLoading === orc.id}
                            onClick={() => imprimir(orc)}>
                            Imprimir
                          </Button>
                        </Tooltip>

                        {orc.etapaCalculo === 'EM_CALCULO' && (
                          <Button size="compact-sm" color="orange" leftSection={<IconFileText size={15} />}
                            loading={acaoLoading === orc.id}
                            onClick={() => enviarValidacao(orc)}>
                            Enviar p/ validação
                          </Button>
                        )}
                        {orc.etapaCalculo === 'VALIDAR' && (
                          <>
                            <Button size="compact-sm" color="green" leftSection={<IconSignature size={15} />}
                              onClick={() => { setAssinarAlvo(orc); setSenhaAssinatura('') }}>
                              Assinar
                            </Button>
                            <Tooltip label="Devolver ao calculista">
                              <Button size="compact-sm" variant="subtle" color="gray"
                                loading={acaoLoading === orc.id}
                                onClick={() => reabrir(orc)}>
                                Devolver
                              </Button>
                            </Tooltip>
                          </>
                        )}
                        {orc.etapaCalculo === 'VALIDADO' && (
                          <Badge color="green" variant="light" leftSection={<IconChecks size={13} />}>
                            Pronto p/ enviar proposta
                          </Badge>
                        )}
                        <Tooltip label="Cancelar">
                          <Button size="compact-sm" variant="subtle" color="red" leftSection={<IconX size={15} />}
                            onClick={() => { setCancelarAlvo(orc); setMotivoCancelar('') }}>
                            Cancelar
                          </Button>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Paper>

      {/* ── Listagem geral (histórico completo) ── */}
      <Paper withBorder p="md">
        <Text fw={700} mb="xs">Todos os orçamentos</Text>
        <Paper p="sm" withBorder mb="sm">
          <Group gap="sm" align="flex-end" wrap="wrap">
            <TextInput
              placeholder="Buscar por número, cliente..."
              leftSection={<IconSearch size={16} />}
              value={busca}
              onChange={(e) => setBusca(e.currentTarget.value)}
              style={{ flex: 1, minWidth: 200 }}
            />
            <Select
              placeholder="Status"
              leftSection={<IconFilter size={16} />}
              data={[
                { value: 'RASCUNHO', label: 'Rascunho' },
                { value: 'ENVIADO', label: 'Enviado' },
                { value: 'APROVADO', label: 'Aprovado' },
                { value: 'RECUSADO', label: 'Recusado' },
                { value: 'VENCIDO', label: 'Vencido' },
              ]}
              value={statusFiltro}
              onChange={setStatusFiltro}
              clearable
              w={160}
            />
            <DatePickerInput placeholder="Data início" value={dataInicio} onChange={setDataInicio} clearable w={150} valueFormat="DD/MM/YYYY" />
            <DatePickerInput placeholder="Data fim" value={dataFim} onChange={setDataFim} clearable w={150} valueFormat="DD/MM/YYYY" />
          </Group>
        </Paper>

        {loading ? (
          <Center py="xl"><Loader /></Center>
        ) : (
          <ScrollArea>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Número</Table.Th>
                  <Table.Th>Cliente</Table.Th>
                  <Table.Th>Tipo Embalagem</Table.Th>
                  <Table.Th ta="right">Quantidade</Table.Th>
                  <Table.Th ta="right">Preço Venda</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Etapa</Table.Th>
                  <Table.Th>Criado em</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {data.map((orc) => (
                  <Table.Tr
                    key={orc.id}
                    style={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/orcamento-grafico/${orc.id}`)}
                  >
                    <Table.Td fw={600}>
                      <Group gap={6} wrap="nowrap">
                        {orc.numero}
                        {orc.tipo === 'REPETICAO' && (
                          <Badge size="xs" color="violet" variant="light">Repetição</Badge>
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>{orc.clienteNome || '—'}</Table.Td>
                    <Table.Td>{orc.tipoEmbalagem?.descricao || '—'}</Table.Td>
                    <Table.Td ta="right">{orc.quantidade?.toLocaleString('pt-BR') || '—'}</Table.Td>
                    <Table.Td ta="right">{formatCurrency(orc.precoVenda)}</Table.Td>
                    <Table.Td><StatusBadge status={orc.status} /></Table.Td>
                    <Table.Td><EtapaBadge etapa={orc.etapaCalculo} /></Table.Td>
                    <Table.Td>{formatDate(orc.criadoEm)}</Table.Td>
                  </Table.Tr>
                ))}
                {data.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={8}>
                      <Text ta="center" c="dimmed" py="md">Nenhum orçamento encontrado</Text>
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}

        {totalPages > 1 && (
          <Group justify="center" mt="sm">
            <Pagination total={totalPages} value={page} onChange={setPage} />
          </Group>
        )}
      </Paper>

      {/* Modal — assinar validação do cálculo */}
      <Modal
        opened={!!assinarAlvo}
        onClose={() => { setAssinarAlvo(null); setSenhaAssinatura('') }}
        title={`Validar cálculo do orçamento ${assinarAlvo?.numero ?? ''}`}
        centered
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            A assinatura confere o cálculo e libera o envio da proposta ao cliente. Informe sua senha para assinar.
          </Text>
          <PasswordInput
            label="Sua senha"
            placeholder="••••••••"
            value={senhaAssinatura}
            onChange={(e) => setSenhaAssinatura(e.currentTarget.value)}
            required
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => { setAssinarAlvo(null); setSenhaAssinatura('') }}>Cancelar</Button>
            <Button color="green" leftSection={<IconSignature size={16} />} loading={acaoLoading === assinarAlvo?.id} onClick={assinar}>
              Assinar e validar
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal — cancelar */}
      <Modal
        opened={!!cancelarAlvo}
        onClose={() => { setCancelarAlvo(null); setMotivoCancelar('') }}
        title={`Cancelar orçamento ${cancelarAlvo?.numero ?? ''}`}
        centered
      >
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            O orçamento será recusado. Se veio de uma solicitação de representante, ela retorna ao comercial.
          </Text>
          <Textarea
            label="Motivo"
            placeholder="Descreva o motivo do cancelamento..."
            minRows={3}
            value={motivoCancelar}
            onChange={(e) => setMotivoCancelar(e.currentTarget.value)}
            required
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => { setCancelarAlvo(null); setMotivoCancelar('') }}>Voltar</Button>
            <Button color="red" leftSection={<IconX size={16} />} loading={acaoLoading === cancelarAlvo?.id}
              disabled={motivoCancelar.trim().length < 3} onClick={cancelar}>
              Cancelar orçamento
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Puxar Cálculo da Biblioteca — modo criação (sem orcamentoId) */}
      <BuscaCalculoModal
        opened={buscaCalcOpen}
        onClose={() => setBuscaCalcOpen(false)}
        onCriado={(id) => {
          setBuscaCalcOpen(false)
          router.push('/orcamento-grafico/' + id)
        }}
      />
    </Stack>
  )
}
