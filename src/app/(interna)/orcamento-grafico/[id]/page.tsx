'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Title, Stack, Group, Button, Text, Loader, Center, Paper, SimpleGrid,
  Badge, Divider, Progress, Table, Modal, Textarea, Alert, ScrollArea,
} from '@mantine/core'
import {
  IconArrowLeft, IconEdit, IconCopy, IconSend, IconCheck, IconX,
  IconChartPie, IconAlertCircle,
} from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'
import { StatusBadge } from '../page'

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
}

interface OrcamentoDetalhe {
  id: string
  numero: number
  versao: number
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
  criadoEm: string
  atualizadoEm: string
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
// Página de Detalhe do Orçamento (Task 8.3 + 8.4 + 8.5)
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

  // ============================================================================
  // Ações (Task 8.4)
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
              <Badge variant="outline" size="lg">V{orcamento.versao}</Badge>
              <StatusBadge status={orcamento.status} />
            </Group>
            <Text size="sm" c="dimmed">
              Criado em {formatDateTime(orcamento.criadoEm)} · Atualizado em {formatDateTime(orcamento.atualizadoEm)}
            </Text>
          </div>
        </Group>

        {/* Action buttons (Task 8.4) */}
        <Group gap="xs">
          {orcamento.status === 'RASCUNHO' && (
            <Button
              variant="outline"
              leftSection={<IconEdit size={16} />}
              onClick={() => router.push(`/orcamento-grafico/novo?editId=${id}`)}
              disabled={actionLoading}
            >
              Editar
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

      {/* Informações gerais */}
      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <Paper p="md" withBorder>
          <Text fw={600} size="sm" mb="xs">Informações do Cliente</Text>
          <Stack gap={4}>
            <Text size="sm"><strong>Cliente:</strong> {orcamento.clienteNome || '—'}</Text>
            <Text size="sm"><strong>Tipo de Embalagem:</strong> {orcamento.tipoEmbalagem?.descricao || '—'}</Text>
            <Text size="sm"><strong>Quantidade:</strong> {orcamento.quantidade?.toLocaleString('pt-BR')}</Text>
            {orcamento.validadeAte && (
              <Text size="sm"><strong>Validade:</strong> {formatDate(orcamento.validadeAte)}</Text>
            )}
            {orcamento.aprovadoEm && (
              <Text size="sm"><strong>Aprovado em:</strong> {formatDateTime(orcamento.aprovadoEm)}</Text>
            )}
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

      {/* Observações */}
      {orcamento.observacoes && (
        <Paper p="md" withBorder>
          <Text fw={600} size="sm" mb="xs">Observações</Text>
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{orcamento.observacoes}</Text>
        </Paper>
      )}

      {/* Comparação de Versões (Task 8.5) */}
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
    </Stack>
  )
}
