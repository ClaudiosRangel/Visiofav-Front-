'use client'

import { useEffect, useState, useCallback, Fragment } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Title, Stack, Group, Button, Text, Loader, Center, Paper, SimpleGrid,
  Badge, Divider, Progress, Table, Modal, Textarea, Alert, ScrollArea,
  ActionIcon, Tooltip, Collapse, Checkbox,
} from '@mantine/core'
import {
  IconArrowLeft, IconEdit, IconCopy, IconSend, IconCheck, IconX,
  IconChartPie, IconAlertCircle, IconFileText, IconPlus, IconTrash,
  IconChevronDown, IconChevronRight, IconStack2, IconFileInvoice,
  IconReportAnalytics,
} from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'
import { StatusBadge } from '../page'
import ItemWizardModal, { type ItemParaEditar } from './ItemWizardModal'
import RelatorioItem from './RelatorioItem'
import PlanosDoItem, { type PlanoCalculo } from './PlanosDoItem'
import {
  BadgeOp, OpModalOpcoes, useEmissaoOp, carregarStatusOpItem,
  type StatusOpItem, type OpcoesEmissaoOp,
} from './EmitirOp'

// ============================================================================
// Tipos
// ============================================================================

interface CorDetalhe {
  nome: string
  tipo: string
  coberturaPercent: number
  precoKg?: number
  rendimentoM2Kg?: number
}

interface AcabamentoDetalhe {
  tipo: string
  custoHora?: number
  velocidade?: number
  custoMaterialM2?: number
}

interface ResultadoCalculo {
  papel?: { pesoKg: number; custo: number }
  tinta?: { custoTotal: number; detalhePorCor?: Array<{ cor: string; consumoKg: number; custo: number }> }
  maquinas?: { custoTotal: number; detalhePorEtapa?: Array<{ etapa: string; tempoMin: number; custo: number }> }
  acabamentos?: { custoTotal: number; detalhePorAcabamento?: Array<{ tipo: string; custo: number }> }
  custoTotal?: number
  precoVenda?: number
  precoUnitario?: number
  margemReal?: number
  breakdown?: { papel: number; tinta: number; maquina: number; acabamento: number; overhead: number }
  // Paridade Calcgraf (decomposição estilo memória de cálculo)
  materialDireto?: number
  custoTransformacao?: number
  servicoExterno?: number
  custoProducao?: number
  cevPerc?: number
  cevValor?: number
  contribuicaoMarginalValor?: number
  contribuicaoMarginalPerc?: number
}

// Item de orçamento (multi-item). Reflete o GET /:id → itens[].
interface ItemOrcamento {
  id: string
  sequencia: number
  tipoEmbalagemId: string
  descricao?: string | null
  medidas?: Record<string, number> | null
  papelId?: string | null
  papelDescricao?: string | null
  suporteId?: string | null
  gramatura?: number | string | null
  numCores: number
  cores?: CorDetalhe[] | null
  maquinaId?: string | null
  acabamentosRicos?: any[] | null
  modeloFacaId?: string | null
  itensDiversos?: any[] | null
  itensFornecidos?: any[] | null
  camposLivres?: any[] | null
  quantidade: number
  resultadoCalculo?: ResultadoCalculo | null
  margemSelecionada?: number | string | null
  custoProducao?: number | string | null
  valorTotal?: number | string | null
  pendente?: boolean
  // Suporte de produção no nível do item (Task 18). Usado quando o item não
  // tem planos — o Select/badge de troca aparecem no PlanosDoItem.
  suporteProducaoId?: string | null
  rotuloTrocaSuporte?: string | null
  // Planos do cálculo (Task 11). O GET /:id ainda não os retorna; quando passar
  // a retornar, semeiam o editor PlanosDoItem (senão parte de estado vazio).
  planos?: PlanoCalculo[] | null
}

interface OrcamentoDetalhe {
  id: string
  numero: number
  versao: number
  serie?: string | null
  dataOrcamento?: string | null
  clienteId?: string | null
  clienteNome?: string | null
  vendedorId?: string | null
  tipoEmbalagemId: string
  tipoEmbalagem?: { codigo: string; descricao: string } | null
  medidas?: Record<string, number>
  resultadoCalculo?: ResultadoCalculo | null
  papelId?: string | null
  papelDescricao?: string | null
  gramatura?: number | null
  numCores: number
  cores?: CorDetalhe[] | null
  acabamentos?: AcabamentoDetalhe[] | null
  quantidade: number
  custoMaterial?: number | string | null
  custoMaquina?: number | string | null
  custoAcabamento?: number | string | null
  custoTotal?: number | string | null
  precoVenda?: number | string | null
  precoUnitario?: number | string | null
  margemReal?: number | string | null
  status: string
  validadeAte?: string | null
  motivoRecusa?: string | null
  aprovadoEm?: string | null
  variacoes?: Array<{ quantidade: number; precoUnitario: number; precoTotal: number }> | null
  observacoes?: string | null
  produtoNome?: string | null
  criadoEm: string
  atualizadoEm: string
  // Multi-item (spec multi-item-gcad)
  itens?: ItemOrcamento[] | null
  custoProducaoConsolidado?: number | string | null
  valorTotalConsolidado?: number | string | null
}

interface VersaoResumida {
  id: string
  numero: number
  versao: number
  status: string
  precoVenda?: number | string | null
  quantidade: number
  criadoEm: string
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

function formatPercent(val: number | string | null | undefined): string {
  if (val == null) return '—'
  const num = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(num)) return '—'
  return `${num.toFixed(1)}%`
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('pt-BR')
}

// ============================================================================
// Breakdown Bar (reutilizado do StepRevisao)
// ============================================================================

function BreakdownBar({ breakdown }: { breakdown: { papel: number; tinta: number; maquina: number; acabamento: number; overhead: number } }) {
  const total = breakdown.papel + breakdown.tinta + breakdown.maquina + breakdown.acabamento + breakdown.overhead
  if (total === 0) return null

  const items = [
    { label: 'Papel', value: breakdown.papel, color: 'blue' },
    { label: 'Tinta', value: breakdown.tinta, color: 'grape' },
    { label: 'Máquina', value: breakdown.maquina, color: 'orange' },
    { label: 'Acabamento', value: breakdown.acabamento, color: 'teal' },
    { label: 'Overhead', value: breakdown.overhead, color: 'gray' },
  ]

  const sections = items
    .filter(i => i.value > 0)
    .map(i => ({
      value: (i.value / total) * 100,
      color: i.color,
      tooltip: `${i.label}: ${((i.value / total) * 100).toFixed(1)}%`,
    }))

  return (
    <Stack gap="xs">
      <Progress.Root size={24}>
        {sections.map((s, i) => (
          <Progress.Section key={i} value={s.value} color={s.color}>
            <Progress.Label>{s.tooltip}</Progress.Label>
          </Progress.Section>
        ))}
      </Progress.Root>
      <Group gap="md">
        {items.filter(i => i.value > 0).map((item) => (
          <Group key={item.label} gap={4}>
            <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: `var(--mantine-color-${item.color}-5)` }} />
            <Text size="xs">{item.label}: {((item.value / total) * 100).toFixed(1)}%</Text>
          </Group>
        ))}
      </Group>
    </Stack>
  )
}

// ============================================================================
// Página de Detalhe do Orçamento — cabeçalho + Itens do Orçamento (multi-item)
// ============================================================================

export default function OrcamentoDetalhePage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [orcamento, setOrcamento] = useState<OrcamentoDetalhe | null>(null)
  const [versoes, setVersoes] = useState<VersaoResumida[]>([])
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)

  // Modal de recusa
  const [recusaModalOpen, setRecusaModalOpen] = useState(false)
  const [motivoRecusa, setMotivoRecusa] = useState('')

  // Editor de item (modal reusando os steps)
  const [itemModalOpen, setItemModalOpen] = useState(false)
  const [itemEmEdicao, setItemEmEdicao] = useState<ItemParaEditar | null>(null)

  // Confirmação de remoção de item
  const [itemParaRemover, setItemParaRemover] = useState<ItemOrcamento | null>(null)
  const [removendo, setRemovendo] = useState(false)

  // Relatório fiel por item (Task 30): item cujo relatório está aberto no modal.
  const [itemRelatorio, setItemRelatorio] = useState<ItemOrcamento | null>(null)

  // Expansão da seção "Planos do Cálculo" por item (Task 11)
  const [itensExpandidos, setItensExpandidos] = useState<Record<string, boolean>>({})
  const toggleExpandir = (itemId: string) =>
    setItensExpandidos((prev) => ({ ...prev, [itemId]: !prev[itemId] }))

  // ---------------------------------------------------------------------------
  // Emissão de OP (Task 24): status por item (badge), seleção para lote e modal
  // de opções compartilhado entre emissão por item e em lote.
  // ---------------------------------------------------------------------------
  const [statusOp, setStatusOp] = useState<Record<string, StatusOpItem>>({})
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
  const [opModalOpen, setOpModalOpen] = useState(false)
  // Alvo da emissão: um itemId específico, ou 'lote' para os selecionados.
  const [opAlvo, setOpAlvo] = useState<string | 'lote' | null>(null)
  const { emitindo, emitirItem, emitirLote } = useEmissaoOp(id)

  useEffect(() => { document.title = 'Detalhe do Orçamento' }, [])

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get(`/orcamento-grafico/${id}`)
      setOrcamento(res.data)

      // Buscar outras versões do mesmo número
      if (res.data.numero) {
        try {
          const versoesRes = await api.get('/orcamento-grafico', {
            params: { numero: res.data.numero, limit: 50 },
          })
          const todasVersoes: VersaoResumida[] = (versoesRes.data.data || [])
            .filter((v: any) => v.id !== id)
            .map((v: any) => ({
              id: v.id,
              numero: v.numero,
              versao: v.versao,
              status: v.status,
              precoVenda: v.precoVenda,
              quantidade: v.quantidade,
              criadoEm: v.criadoEm,
            }))
          setVersoes(todasVersoes)
        } catch {
          setVersoes([])
        }
      }
    } catch (err: any) {
      notifications.show({
        title: 'Erro ao carregar',
        message: err?.response?.data?.message || 'Falha ao buscar orçamento',
        color: 'red',
      })
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { carregar() }, [carregar])

  // Carrega o status de OP de cada item (badge "OP: N") ao montar/atualizar a
  // lista. Faz uma requisição por item (lazy por lista) — a ausência de badge é
  // o estado seguro em caso de falha (ver carregarStatusOpItem).
  const carregarStatusOps = useCallback(async (itemIds: string[]) => {
    if (!itemIds.length) {
      setStatusOp({})
      return
    }
    const resultados = await Promise.all(
      itemIds.map(async (itemId) => [itemId, await carregarStatusOpItem(id, itemId)] as const),
    )
    setStatusOp(Object.fromEntries(resultados))
  }, [id])

  useEffect(() => {
    const ids = (orcamento?.itens ?? []).map((i) => i.id)
    carregarStatusOps(ids)
  }, [orcamento?.itens, carregarStatusOps])

  // ============================================================================
  // Ações do cabeçalho (preservadas)
  // ============================================================================

  const handleCopiar = async () => {
    setActionLoading(true)
    try {
      const { data } = await api.post(`/orcamento-grafico/${id}/copiar`)
      notifications.show({ title: 'Copiado', message: `Nova versão V${data.versao} criada.`, color: 'green' })
      router.push(`/orcamento-grafico/${data.id}`)
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao copiar', color: 'red' })
    } finally {
      setActionLoading(false)
    }
  }

  // Abre o relatório (PDF) no layout do pré-cálculo Calcgraf em nova aba.
  const handleRelatorio = async () => {
    setActionLoading(true)
    try {
      const { data } = await api.get(`/orcamento-grafico/${id}/relatorio.pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }))
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao gerar relatório', color: 'red' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleEnviar = async () => {
    setActionLoading(true)
    try {
      await api.post(`/orcamento-grafico/${id}/enviar`)
      notifications.show({ title: 'Enviado', message: 'Proposta enviada com sucesso!', color: 'green' })
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao enviar', color: 'red' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleAprovar = async () => {
    setActionLoading(true)
    try {
      await api.post(`/orcamento-grafico/${id}/aprovar`)
      notifications.show({ title: 'Aprovado', message: 'Orçamento aprovado com sucesso!', color: 'green' })
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao aprovar', color: 'red' })
    } finally {
      setActionLoading(false)
    }
  }

  const handleRecusar = async () => {
    if (!motivoRecusa.trim()) {
      notifications.show({ title: 'Erro', message: 'Informe o motivo da recusa.', color: 'red' })
      return
    }
    setActionLoading(true)
    try {
      await api.post(`/orcamento-grafico/${id}/recusar`, { motivoRecusa: motivoRecusa.trim() })
      notifications.show({ title: 'Recusado', message: 'Orçamento recusado.', color: 'orange' })
      setRecusaModalOpen(false)
      setMotivoRecusa('')
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao recusar', color: 'red' })
    } finally {
      setActionLoading(false)
    }
  }

  // ============================================================================
  // Ações de item (multi-item)
  // ============================================================================

  const abrirNovoItem = () => {
    setItemEmEdicao(null)
    setItemModalOpen(true)
  }

  const abrirEdicaoItem = (item: ItemOrcamento) => {
    setItemEmEdicao({
      id: item.id,
      tipoEmbalagemId: item.tipoEmbalagemId,
      tipoEmbalagem: orcamento?.tipoEmbalagem ?? null,
      medidas: item.medidas ?? null,
      papelId: item.papelId ?? null,
      papelDescricao: item.papelDescricao ?? null,
      suporteId: item.suporteId ?? null,
      gramatura: item.gramatura ?? null,
      numCores: item.numCores,
      cores: item.cores ?? null,
      acabamentosRicos: item.acabamentosRicos ?? null,
      maquinaId: item.maquinaId ?? null,
      quantidade: item.quantidade,
      resultadoCalculo: item.resultadoCalculo ?? null,
    })
    setItemModalOpen(true)
  }

  const confirmarRemocaoItem = async () => {
    if (!itemParaRemover) return
    setRemovendo(true)
    try {
      await api.delete(`/orcamento-grafico/${id}/itens/${itemParaRemover.id}`)
      notifications.show({ title: 'Item removido', message: `Item #${itemParaRemover.sequencia} removido.`, color: 'orange' })
      setItemParaRemover(null)
      await carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao remover item', color: 'red' })
    } finally {
      setRemovendo(false)
    }
  }

  // ============================================================================
  // Ações de emissão de OP (Task 24)
  // ============================================================================

  const abrirEmitirItem = (itemId: string) => {
    setOpAlvo(itemId)
    setOpModalOpen(true)
  }

  const abrirEmitirLote = () => {
    if (selecionados.size === 0) return
    setOpAlvo('lote')
    setOpModalOpen(true)
  }

  const toggleSelecionado = (itemId: string) =>
    setSelecionados((prev) => {
      const prox = new Set(prev)
      if (prox.has(itemId)) prox.delete(itemId)
      else prox.add(itemId)
      return prox
    })

  const toggleSelecionarTodos = (itemIds: string[], marcar: boolean) =>
    setSelecionados(marcar ? new Set(itemIds) : new Set())

  const confirmarEmissaoOp = async (opcoes: OpcoesEmissaoOp, emails: string[]) => {
    if (opAlvo === 'lote') {
      const itemIds = Array.from(selecionados)
      const resultados = await emitirLote(itemIds, opcoes, emails)
      if (resultados) {
        setOpModalOpen(false)
        setSelecionados(new Set())
        await carregar()
      }
    } else if (opAlvo) {
      const ok = await emitirItem(opAlvo, opcoes, emails)
      if (ok) {
        setOpModalOpen(false)
        await carregar()
      }
    }
  }

  // ============================================================================
  // Render
  // ============================================================================

  if (loading) {
    return <Center py="xl"><Loader size="lg" /></Center>
  }

  if (!orcamento) {
    return (
      <Center py="xl">
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Orçamento não encontrado">
          O orçamento solicitado não foi encontrado.
        </Alert>
      </Center>
    )
  }

  const resultado = orcamento.resultadoCalculo
  const itens = orcamento.itens ?? []
  const temItens = itens.length > 0
  const podeEditarItens = orcamento.status === 'RASCUNHO'

  return (
    <Stack gap="md">
      {/* Header */}
      <Group justify="space-between" align="flex-start">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => router.push('/orcamento-grafico')}
          >
            Voltar
          </Button>
          <div>
            <Group gap="sm">
              <Title order={3}>Orçamento #{orcamento.numero}</Title>
              {orcamento.serie && <Badge variant="light" size="lg">Série {orcamento.serie}</Badge>}
              <Badge variant="outline" size="lg">V{orcamento.versao}</Badge>
              <StatusBadge status={orcamento.status} />
            </Group>
            <Text size="sm" c="dimmed">
              {orcamento.dataOrcamento && <>Data {formatDate(orcamento.dataOrcamento)} · </>}
              Criado em {formatDateTime(orcamento.criadoEm)} · Atualizado em {formatDateTime(orcamento.atualizadoEm)}
            </Text>
          </div>
        </Group>

        {/* Action buttons (preservadas) */}
        <Group gap="xs">
          {orcamento.status === 'RASCUNHO' && (
            <Button
              variant="outline"
              leftSection={<IconEdit size={16} />}
              onClick={() => router.push(`/orcamento-grafico/novo?editId=${id}`)}
              disabled={actionLoading}
            >
              Editar Cabeçalho
            </Button>
          )}
          <Button
            variant="outline"
            leftSection={<IconCopy size={16} />}
            onClick={handleCopiar}
            loading={actionLoading}
          >
            Copiar
          </Button>
          <Button
            variant="outline"
            leftSection={<IconFileText size={16} />}
            onClick={handleRelatorio}
            loading={actionLoading}
          >
            Relatório (Calcgraf)
          </Button>
          {orcamento.status === 'RASCUNHO' && (
            <Button
              leftSection={<IconSend size={16} />}
              onClick={handleEnviar}
              loading={actionLoading}
            >
              Enviar Proposta
            </Button>
          )}
          {orcamento.status === 'ENVIADO' && (
            <>
              <Button
                color="green"
                leftSection={<IconCheck size={16} />}
                onClick={handleAprovar}
                loading={actionLoading}
              >
                Aprovar
              </Button>
              <Button
                color="red"
                variant="outline"
                leftSection={<IconX size={16} />}
                onClick={() => setRecusaModalOpen(true)}
                disabled={actionLoading}
              >
                Recusar
              </Button>
            </>
          )}
        </Group>
      </Group>

      {/* Motivo de recusa (se recusado) */}
      {orcamento.status === 'RECUSADO' && orcamento.motivoRecusa && (
        <Alert icon={<IconX size={16} />} color="red" title="Motivo da Recusa">
          {orcamento.motivoRecusa}
        </Alert>
      )}

      {/* Cabeçalho comercial */}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <Paper p="md" withBorder>
          <Text fw={600} size="sm" mb="xs">Dados Comerciais</Text>
          <Stack gap={4}>
            <Text size="sm"><strong>Cliente:</strong> {orcamento.clienteNome || '—'}</Text>
            <Text size="sm"><strong>Série:</strong> {orcamento.serie || '—'}</Text>
            <Text size="sm"><strong>Data:</strong> {formatDate(orcamento.dataOrcamento)}</Text>
            <Text size="sm"><strong>Status:</strong> <StatusBadge status={orcamento.status} /></Text>
            {orcamento.validadeAte && (
              <Text size="sm"><strong>Validade:</strong> {formatDate(orcamento.validadeAte)}</Text>
            )}
            {orcamento.aprovadoEm && (
              <Text size="sm"><strong>Aprovado em:</strong> {formatDateTime(orcamento.aprovadoEm)}</Text>
            )}
          </Stack>
        </Paper>

        <Paper p="md" withBorder>
          <Text fw={600} size="sm" mb="xs">Totais Consolidados</Text>
          <Stack gap={4}>
            <Group justify="space-between">
              <Text size="sm">Custo de Produção consolidado</Text>
              <Text size="sm" fw={600} c="red">{formatCurrency(orcamento.custoProducaoConsolidado)}</Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm">Valor Total consolidado</Text>
              <Text size="lg" fw={700} c="green">{formatCurrency(orcamento.valorTotalConsolidado)}</Text>
            </Group>
            <Text size="xs" c="dimmed">
              {itens.length} {itens.length === 1 ? 'item' : 'itens'} no orçamento
            </Text>
          </Stack>
        </Paper>
      </SimpleGrid>

      {/* ===================================================================== */}
      {/* ITENS DO ORÇAMENTO (multi-item) */}
      {/* ===================================================================== */}
      <Paper p="md" withBorder>
        <Group justify="space-between" mb="sm">
          <Text fw={600}>Itens do Orçamento</Text>
          <Group gap="xs">
            {temItens && (
              <Button
                size="xs"
                variant="light"
                color="green"
                leftSection={<IconFileInvoice size={14} />}
                onClick={abrirEmitirLote}
                disabled={selecionados.size === 0 || emitindo}
              >
                Emitir OP em lote{selecionados.size > 0 ? ` (${selecionados.size})` : ''}
              </Button>
            )}
            {podeEditarItens && (
              <Button size="xs" leftSection={<IconPlus size={14} />} onClick={abrirNovoItem}>
                Novo Item
              </Button>
            )}
          </Group>
        </Group>

        <ScrollArea>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={40} ta="center">
                  <Checkbox
                    aria-label="Selecionar todos os itens"
                    checked={temItens && selecionados.size === itens.length}
                    indeterminate={selecionados.size > 0 && selecionados.size < itens.length}
                    onChange={(e) => toggleSelecionarTodos(itens.map((i) => i.id), e.currentTarget.checked)}
                  />
                </Table.Th>
                <Table.Th w={40}></Table.Th>
                <Table.Th w={60}>Seq.</Table.Th>
                <Table.Th>Linha de Produto</Table.Th>
                <Table.Th>Descrição</Table.Th>
                <Table.Th ta="right">Tiragem</Table.Th>
                <Table.Th ta="right">Custo Produção</Table.Th>
                <Table.Th ta="right">Valor Total</Table.Th>
                <Table.Th w={150} ta="center">Ações</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {itens.map((item) => {
                const expandido = !!itensExpandidos[item.id]
                return (
                  <Fragment key={item.id}>
                    <Table.Tr>
                      <Table.Td ta="center">
                        <Checkbox
                          aria-label={`Selecionar item ${item.sequencia}`}
                          checked={selecionados.has(item.id)}
                          onChange={() => toggleSelecionado(item.id)}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Tooltip label={expandido ? 'Ocultar planos' : 'Ver planos do cálculo'}>
                          <ActionIcon variant="subtle" color="gray" onClick={() => toggleExpandir(item.id)}>
                            {expandido ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                          </ActionIcon>
                        </Tooltip>
                      </Table.Td>
                      <Table.Td fw={600}>{item.sequencia}</Table.Td>
                      <Table.Td>
                        <Group gap={6}>
                          <Text size="sm">{orcamento.tipoEmbalagem?.descricao || item.tipoEmbalagemId}</Text>
                          {item.pendente && (
                            <Badge size="xs" color="orange" variant="light">Pendente</Badge>
                          )}
                          <BadgeOp label={statusOp[item.id]?.label} />
                        </Group>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">{item.descricao || '—'}</Text>
                      </Table.Td>
                      <Table.Td ta="right">{item.quantidade?.toLocaleString('pt-BR')}</Table.Td>
                      <Table.Td ta="right">{formatCurrency(item.custoProducao)}</Table.Td>
                      <Table.Td ta="right" fw={600}>{formatCurrency(item.valorTotal)}</Table.Td>
                      <Table.Td>
                        <Group gap={4} justify="center">
                          <Tooltip label="Relatório do item (pré-cálculo)">
                            <ActionIcon
                              variant="subtle"
                              color="grape"
                              onClick={() => setItemRelatorio(item)}
                            >
                              <IconReportAnalytics size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label="Emitir OP para este item">
                            <ActionIcon
                              variant="subtle"
                              color="green"
                              onClick={() => abrirEmitirItem(item.id)}
                              disabled={emitindo}
                            >
                              <IconFileInvoice size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label={podeEditarItens ? 'Editar item' : 'Edição só em rascunho'}>
                            <ActionIcon
                              variant="subtle"
                              color="blue"
                              onClick={() => abrirEdicaoItem(item)}
                              disabled={!podeEditarItens}
                            >
                              <IconEdit size={16} />
                            </ActionIcon>
                          </Tooltip>
                          <Tooltip label={podeEditarItens ? 'Remover item' : 'Remoção só em rascunho'}>
                            <ActionIcon
                              variant="subtle"
                              color="red"
                              onClick={() => setItemParaRemover(item)}
                              disabled={!podeEditarItens}
                            >
                              <IconTrash size={16} />
                            </ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                    <Table.Tr>
                      <Table.Td colSpan={9} p={0} style={{ borderBottom: 0 }}>
                        <Collapse in={expandido}>
                          <Paper p="md" bg="var(--mantine-color-gray-light)" radius={0}>
                            <Group gap={6} mb="xs">
                              <IconStack2 size={16} />
                              <Text size="sm" fw={600}>
                                Planos do cálculo — item #{item.sequencia}
                              </Text>
                            </Group>
                            <PlanosDoItem
                              orcamentoId={id}
                              itemId={item.id}
                              planosIniciais={item.planos ?? null}
                              suporteProducaoItemInicial={item.suporteProducaoId ?? null}
                              rotuloTrocaItemInicial={item.rotuloTrocaSuporte ?? null}
                              podeEditar={podeEditarItens}
                              onChanged={carregar}
                            />
                          </Paper>
                        </Collapse>
                      </Table.Td>
                    </Table.Tr>
                  </Fragment>
                )
              })}
              {!temItens && (
                <Table.Tr>
                  <Table.Td colSpan={9}>
                    <Text ta="center" c="dimmed" py="md">
                      Nenhum item neste orçamento.{podeEditarItens ? ' Use "Novo Item" para adicionar.' : ''}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
            {temItens && (
              <Table.Tfoot>
                <Table.Tr>
                  <Table.Td colSpan={6} ta="right" fw={700}>Total consolidado</Table.Td>
                  <Table.Td ta="right" fw={700} c="red">{formatCurrency(orcamento.custoProducaoConsolidado)}</Table.Td>
                  <Table.Td ta="right" fw={700} c="green">{formatCurrency(orcamento.valorTotalConsolidado)}</Table.Td>
                  <Table.Td />
                </Table.Tr>
              </Table.Tfoot>
            )}
          </Table>
        </ScrollArea>
      </Paper>

      {/* ===================================================================== */}
      {/* DETALHE LEGADO DO ITEM ÚNICO (fallback de compatibilidade) */}
      {/* Mantido para orçamentos antigos cujos dados de cálculo vivem no        */}
      {/* cabeçalho. Exibido apenas quando NÃO há itens multi-item.              */}
      {/* ===================================================================== */}
      {!temItens && (
        <>
          <Divider label="Detalhe do Item (compatibilidade)" labelPosition="left" />

          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <Paper p="md" withBorder>
              <Text fw={600} size="sm" mb="xs">Produto</Text>
              <Stack gap={4}>
                <Text size="sm"><strong>Tipo de Embalagem:</strong> {orcamento.tipoEmbalagem?.descricao || '—'}</Text>
                {orcamento.produtoNome && (
                  <Text size="sm"><strong>Produto (repetição):</strong> {orcamento.produtoNome}</Text>
                )}
                <Text size="sm"><strong>Quantidade:</strong> {orcamento.quantidade?.toLocaleString('pt-BR')}</Text>
              </Stack>
            </Paper>

            <Paper p="md" withBorder>
              <Text fw={600} size="sm" mb="xs">Material / Papel</Text>
              <Stack gap={4}>
                <Text size="sm"><strong>Papel:</strong> {orcamento.papelDescricao || '—'}</Text>
                <Text size="sm"><strong>Gramatura:</strong> {orcamento.gramatura ? `${orcamento.gramatura} g/m²` : '—'}</Text>
                <Text size="sm"><strong>Nº Cores:</strong> {orcamento.numCores}</Text>
              </Stack>
            </Paper>
          </SimpleGrid>

          {/* Medidas */}
          {orcamento.medidas && Object.keys(orcamento.medidas).length > 0 && (
            <Paper p="md" withBorder>
              <Text fw={600} size="sm" mb="xs">Medidas</Text>
              <Group gap="lg">
                {Object.entries(orcamento.medidas).map(([key, val]) => (
                  <Text key={key} size="sm"><strong>{key}:</strong> {val} mm</Text>
                ))}
              </Group>
            </Paper>
          )}

          {/* Cores */}
          {orcamento.cores && orcamento.cores.length > 0 && (
            <Paper p="md" withBorder>
              <Text fw={600} size="sm" mb="xs">Cores</Text>
              <Group gap="xs">
                {orcamento.cores.map((cor, i) => (
                  <Badge key={i} variant="light" color={cor.tipo === 'CMYK' ? 'blue' : 'grape'}>
                    {cor.nome} ({cor.coberturaPercent}%)
                  </Badge>
                ))}
              </Group>
            </Paper>
          )}

          {/* Acabamentos */}
          {orcamento.acabamentos && orcamento.acabamentos.length > 0 && (
            <Paper p="md" withBorder>
              <Text fw={600} size="sm" mb="xs">Acabamentos</Text>
              <Group gap="xs">
                {orcamento.acabamentos.map((acab, i) => (
                  <Badge key={i} variant="light" color="teal">{acab.tipo}</Badge>
                ))}
              </Group>
            </Paper>
          )}

          {/* Resultado do cálculo */}
          {resultado && (
            <>
              <Divider label="Resultado do Cálculo" labelPosition="left" />

              {/* Resumo principal */}
              <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
                <Paper p="md" withBorder ta="center">
                  <Text size="xs" c="dimmed" tt="uppercase">Custo Total</Text>
                  <Text fw={700} size="lg" c="red">{formatCurrency(resultado.custoTotal ?? orcamento.custoTotal)}</Text>
                </Paper>
                <Paper p="md" withBorder ta="center">
                  <Text size="xs" c="dimmed" tt="uppercase">Preço Venda</Text>
                  <Text fw={700} size="lg" c="green">{formatCurrency(resultado.precoVenda ?? orcamento.precoVenda)}</Text>
                </Paper>
                <Paper p="md" withBorder ta="center">
                  <Text size="xs" c="dimmed" tt="uppercase">Preço Unitário</Text>
                  <Text fw={700} size="lg">{formatCurrency(resultado.precoUnitario ?? orcamento.precoUnitario)}</Text>
                </Paper>
                <Paper p="md" withBorder ta="center">
                  <Text size="xs" c="dimmed" tt="uppercase">Margem</Text>
                  <Text fw={700} size="lg" c="blue">{formatPercent(resultado.margemReal ?? orcamento.margemReal)}</Text>
                </Paper>
              </SimpleGrid>

              {/* Decomposição estilo Calcgraf (paridade) */}
              {resultado.custoProducao != null && (
                <Paper p="md" withBorder>
                  <Text fw={500} size="sm" mb="sm">Decomposição do Custo (paridade Calcgraf)</Text>
                  <Table>
                    <Table.Tbody>
                      <Table.Tr>
                        <Table.Td>Material Direto (MD)</Table.Td>
                        <Table.Td ta="right">{formatCurrency(resultado.materialDireto)}</Table.Td>
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Td>Custo de Transformação (CT)</Table.Td>
                        <Table.Td ta="right">{formatCurrency(resultado.custoTransformacao)}</Table.Td>
                      </Table.Tr>
                      {(resultado.servicoExterno ?? 0) > 0 && (
                        <Table.Tr>
                          <Table.Td>Serviço Externo (SE)</Table.Td>
                          <Table.Td ta="right">{formatCurrency(resultado.servicoExterno)}</Table.Td>
                        </Table.Tr>
                      )}
                      <Table.Tr>
                        <Table.Td fw={600}>Custo de Produção (MD + CT + SE)</Table.Td>
                        <Table.Td ta="right" fw={600}>{formatCurrency(resultado.custoProducao)}</Table.Td>
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Td>CEV (custos de venda)</Table.Td>
                        <Table.Td ta="right">{formatPercent(resultado.cevPerc)} = {formatCurrency(resultado.cevValor)}</Table.Td>
                      </Table.Tr>
                      <Table.Tr>
                        <Table.Td fw={600} c="teal">Contribuição Marginal</Table.Td>
                        <Table.Td ta="right" fw={600} c="teal">
                          {formatPercent(resultado.contribuicaoMarginalPerc)} = {formatCurrency(resultado.contribuicaoMarginalValor)}
                        </Table.Td>
                      </Table.Tr>
                    </Table.Tbody>
                  </Table>
                </Paper>
              )}

              {/* Breakdown visual */}
              {resultado.breakdown && (
                <Paper p="md" withBorder>
                  <Group gap="xs" mb="sm">
                    <IconChartPie size={18} />
                    <Text fw={500} size="sm">Composição do Custo</Text>
                  </Group>
                  <BreakdownBar breakdown={resultado.breakdown} />
                </Paper>
              )}

              {/* Detalhamento */}
              <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
                <Paper p="md" withBorder>
                  <Text fw={500} size="sm" mb="xs">Papel</Text>
                  <Text size="sm">Peso: {resultado.papel?.pesoKg?.toFixed(2) || '—'} kg</Text>
                  <Text size="sm" c="dimmed">Custo: {formatCurrency(resultado.papel?.custo)}</Text>
                </Paper>
                <Paper p="md" withBorder>
                  <Text fw={500} size="sm" mb="xs">Tinta</Text>
                  <Text size="sm" c="dimmed">Custo: {formatCurrency(resultado.tinta?.custoTotal)}</Text>
                  {resultado.tinta?.detalhePorCor?.map((c, i) => (
                    <Text key={i} size="xs" c="dimmed">{c.cor}: {c.consumoKg?.toFixed(3)} kg = {formatCurrency(c.custo)}</Text>
                  ))}
                </Paper>
                <Paper p="md" withBorder>
                  <Text fw={500} size="sm" mb="xs">Máquinas</Text>
                  <Text size="sm" c="dimmed">Custo: {formatCurrency(resultado.maquinas?.custoTotal)}</Text>
                  {resultado.maquinas?.detalhePorEtapa?.map((e, i) => (
                    <Text key={i} size="xs" c="dimmed">{e.etapa}: {e.tempoMin?.toFixed(0)} min = {formatCurrency(e.custo)}</Text>
                  ))}
                </Paper>
                <Paper p="md" withBorder>
                  <Text fw={500} size="sm" mb="xs">Acabamentos</Text>
                  <Text size="sm" c="dimmed">Custo: {formatCurrency(resultado.acabamentos?.custoTotal)}</Text>
                  {resultado.acabamentos?.detalhePorAcabamento?.map((a, i) => (
                    <Text key={i} size="xs" c="dimmed">{a.tipo}: {formatCurrency(a.custo)}</Text>
                  ))}
                </Paper>
              </SimpleGrid>
            </>
          )}

          {/* Se não tem resultado de cálculo, mostra valores do orçamento */}
          {!resultado && (orcamento.custoTotal || orcamento.precoVenda) && (
            <>
              <Divider label="Valores" labelPosition="left" />
              <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
                <Paper p="md" withBorder ta="center">
                  <Text size="xs" c="dimmed" tt="uppercase">Custo Total</Text>
                  <Text fw={700} size="lg" c="red">{formatCurrency(orcamento.custoTotal)}</Text>
                </Paper>
                <Paper p="md" withBorder ta="center">
                  <Text size="xs" c="dimmed" tt="uppercase">Preço Venda</Text>
                  <Text fw={700} size="lg" c="green">{formatCurrency(orcamento.precoVenda)}</Text>
                </Paper>
                <Paper p="md" withBorder ta="center">
                  <Text size="xs" c="dimmed" tt="uppercase">Preço Unitário</Text>
                  <Text fw={700} size="lg">{formatCurrency(orcamento.precoUnitario)}</Text>
                </Paper>
                <Paper p="md" withBorder ta="center">
                  <Text size="xs" c="dimmed" tt="uppercase">Margem</Text>
                  <Text fw={700} size="lg" c="blue">{formatPercent(orcamento.margemReal)}</Text>
                </Paper>
              </SimpleGrid>
            </>
          )}

          {/* Variações de tiragem */}
          {orcamento.variacoes && orcamento.variacoes.length > 0 && (
            <>
              <Divider label="Variações de Tiragem" labelPosition="left" />
              <Table striped highlightOnHover withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Quantidade</Table.Th>
                    <Table.Th ta="right">Preço Unitário</Table.Th>
                    <Table.Th ta="right">Preço Total</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {orcamento.variacoes.map((v, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>{v.quantidade?.toLocaleString('pt-BR')}</Table.Td>
                      <Table.Td ta="right">{formatCurrency(v.precoUnitario)}</Table.Td>
                      <Table.Td ta="right">{formatCurrency(v.precoTotal)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </>
          )}
        </>
      )}

      {/* Observações */}
      {orcamento.observacoes && (
        <Paper p="md" withBorder>
          <Text fw={600} size="sm" mb="xs">Observações</Text>
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{orcamento.observacoes}</Text>
        </Paper>
      )}

      {/* Comparação de Versões */}
      {versoes.length > 0 && (
        <>
          <Divider label="Outras Versões" labelPosition="left" />
          <Paper p="md" withBorder>
            <Text fw={600} size="sm" mb="sm">
              Comparação de Versões (Orçamento #{orcamento.numero})
            </Text>
            <ScrollArea>
              <Table striped highlightOnHover withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Versão</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th ta="right">Quantidade</Table.Th>
                    <Table.Th ta="right">Preço Venda</Table.Th>
                    <Table.Th>Criado em</Table.Th>
                    <Table.Th></Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {/* Versão atual destacada */}
                  <Table.Tr bg="var(--mantine-color-blue-light)">
                    <Table.Td fw={600}>V{orcamento.versao} (atual)</Table.Td>
                    <Table.Td><StatusBadge status={orcamento.status} /></Table.Td>
                    <Table.Td ta="right">{orcamento.quantidade?.toLocaleString('pt-BR')}</Table.Td>
                    <Table.Td ta="right">{formatCurrency(orcamento.precoVenda)}</Table.Td>
                    <Table.Td>{formatDate(orcamento.criadoEm)}</Table.Td>
                    <Table.Td></Table.Td>
                  </Table.Tr>
                  {/* Outras versões */}
                  {versoes.map((v) => (
                    <Table.Tr key={v.id}>
                      <Table.Td>V{v.versao}</Table.Td>
                      <Table.Td><StatusBadge status={v.status} /></Table.Td>
                      <Table.Td ta="right">{v.quantidade?.toLocaleString('pt-BR')}</Table.Td>
                      <Table.Td ta="right">{formatCurrency(v.precoVenda)}</Table.Td>
                      <Table.Td>{formatDate(v.criadoEm)}</Table.Td>
                      <Table.Td>
                        <Button
                          variant="subtle"
                          size="xs"
                          onClick={() => router.push(`/orcamento-grafico/${v.id}`)}
                        >
                          Ver
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          </Paper>
        </>
      )}

      {/* Modal de Recusa */}
      <Modal
        opened={recusaModalOpen}
        onClose={() => setRecusaModalOpen(false)}
        title="Recusar Orçamento"
        centered
      >
        <Stack gap="md">
          <Textarea
            label="Motivo da Recusa"
            placeholder="Informe o motivo da recusa..."
            value={motivoRecusa}
            onChange={(e) => setMotivoRecusa(e.currentTarget.value)}
            required
            minRows={3}
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setRecusaModalOpen(false)}>
              Cancelar
            </Button>
            <Button color="red" onClick={handleRecusar} loading={actionLoading}>
              Confirmar Recusa
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Confirmação de remoção de item */}
      <Modal
        opened={!!itemParaRemover}
        onClose={() => setItemParaRemover(null)}
        title="Remover Item"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Remover o item #{itemParaRemover?.sequencia} ({itemParaRemover?.quantidade?.toLocaleString('pt-BR')} un)?
            Os totais do orçamento serão recalculados.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setItemParaRemover(null)} disabled={removendo}>
              Cancelar
            </Button>
            <Button color="red" onClick={confirmarRemocaoItem} loading={removendo}>
              Remover
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Editor de item (modal reusando os steps do wizard) */}
      <ItemWizardModal
        opened={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        orcamentoId={id}
        item={itemEmEdicao}
        onSaved={carregar}
      />

      {/* Modal de opções de emissão de OP (item único e em lote — Task 24) */}
      <OpModalOpcoes
        opened={opModalOpen}
        onClose={() => setOpModalOpen(false)}
        titulo={opAlvo === 'lote' ? 'Emitir OP em lote' : 'Emitir OP'}
        descricao={
          opAlvo === 'lote'
            ? `Emitir Ordens de Produção para ${selecionados.size} ${selecionados.size === 1 ? 'item selecionado' : 'itens selecionados'}.`
            : 'Emitir a Ordem de Produção para este item.'
        }
        loading={emitindo}
        onConfirmar={confirmarEmissaoOp}
      />

      {/* Relatório fiel do item (pré-cálculo Calcgraf) — Task 30 */}
      <Modal
        opened={!!itemRelatorio}
        onClose={() => setItemRelatorio(null)}
        title={
          itemRelatorio
            ? `Relatório do item #${itemRelatorio.sequencia} — Orçamento #${orcamento.numero}`
            : 'Relatório do item'
        }
        size="xl"
      >
        {itemRelatorio && (
          <RelatorioItem orcamentoId={id} itemId={itemRelatorio.id} />
        )}
      </Modal>
    </Stack>
  )
}
