'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Title, Stack, Table, Group, Button, Badge, Text, Loader, Center,
  TextInput, Paper, ScrollArea, Pagination, NumberInput, Modal, Alert,
  SimpleGrid,
} from '@mantine/core'
import { IconSearch, IconAlertTriangle } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

// ============================================================================
// Tipos — espelham GET /calculo-grafico
// ============================================================================

interface ResumoCalculo {
  id: string
  numero: number | null
  numeroCalcgraf: number | null
  clienteNome: string | null
  produto: string | null
  descricao: string | null
  linhaProduto: string | null
  siglaAcabado: string | null
  dataCalculo: string | null
  origem: string | null
}

interface RespostaBusca {
  itens: ResumoCalculo[]
  total: number
  pagina: number
  tamanho: number
}

// Detalhe (foto) do cálculo — campos usados no modal "Abrir".
interface CalculoDetalhe {
  id: string
  numero?: number | null
  numeroCalcgraf?: number | null
  clienteNome?: string | null
  produto?: string | null
  descricao?: string | null
  origem?: string | null
  custoProducao?: number | string | null
  valorTotal?: number | string | null
}

const TAMANHO = 20

// ============================================================================
// Formatadores
// ============================================================================

function formatarData(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}

function formatCurrency(val: number | string | null | undefined): string {
  if (val == null) return '—'
  const num = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(num)) return '—'
  return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function rotuloCalcgraf(n: number | null | undefined): string {
  return n != null ? `Calcgraf ${n}` : '—'
}

function BadgeOrigem({ origem }: { origem: string | null | undefined }) {
  if (origem === 'MIGRADO_CALCGRAF') return <Badge color="gray">Calcgraf</Badge>
  if (origem === 'VIZOR') return <Badge color="blue">Vizor</Badge>
  return <Badge color="gray" variant="light">—</Badge>
}

// ============================================================================
// Página — Biblioteca de Cálculos ("Localiza o Cálculo Padrão")
// ============================================================================

export default function BibliotecaCalculosPage() {
  const router = useRouter()

  useEffect(() => { document.title = 'Biblioteca de Cálculos' }, [])

  // Filtros
  const [cliente, setCliente] = useState('')
  const [linhaProduto, setLinhaProduto] = useState('')
  const [produto, setProduto] = useState('')
  const [descricao, setDescricao] = useState('')
  const [siglaAcabado, setSiglaAcabado] = useState('')
  const [numeroCalcgraf, setNumeroCalcgraf] = useState<number | ''>('')
  const [numero, setNumero] = useState<number | ''>('')

  // Resultado
  const [itens, setItens] = useState<ResumoCalculo[]>([])
  const [total, setTotal] = useState(0)
  const [pagina, setPagina] = useState(1)
  const [loading, setLoading] = useState(true)

  // Modal "Abrir" (detalhe do cálculo)
  const [detalhe, setDetalhe] = useState<CalculoDetalhe | null>(null)
  const [detalheLoading, setDetalheLoading] = useState(false)

  const totalPaginas = Math.max(1, Math.ceil(total / TAMANHO))

  const buscar = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, unknown> = { pagina, tamanho: TAMANHO }
      if (cliente.trim()) params.cliente = cliente.trim()
      if (linhaProduto.trim()) params.linhaProduto = linhaProduto.trim()
      if (produto.trim()) params.produto = produto.trim()
      if (descricao.trim()) params.descricao = descricao.trim()
      if (siglaAcabado.trim()) params.siglaAcabado = siglaAcabado.trim()
      if (typeof numeroCalcgraf === 'number') params.numeroCalcgraf = numeroCalcgraf
      if (typeof numero === 'number') params.numero = numero

      const res = await api.get('/calculo-grafico', { params })
      const data: RespostaBusca = res.data
      setItens(data.itens || [])
      setTotal(data.total || 0)
    } catch (err: any) {
      notifications.show({
        title: 'Erro ao buscar',
        message: err?.response?.data?.message || 'Falha ao buscar cálculos.',
        color: 'red',
      })
    } finally {
      setLoading(false)
    }
  }, [pagina, cliente, linhaProduto, produto, descricao, siglaAcabado, numeroCalcgraf, numero])

  // Reset de página ao mudar filtros
  useEffect(() => { setPagina(1) }, [cliente, linhaProduto, produto, descricao, siglaAcabado, numeroCalcgraf, numero])

  // Debounce simples (recarrega no change)
  useEffect(() => {
    const t = setTimeout(() => { buscar() }, 400)
    return () => clearTimeout(t)
  }, [buscar])

  const abrirDetalhe = async (calculoId: string) => {
    setDetalheLoading(true)
    setDetalhe({ id: calculoId }) // abre o modal já em loading
    try {
      const res = await api.get(`/calculo-grafico/${calculoId}`)
      setDetalhe(res.data)
    } catch (err: any) {
      notifications.show({
        title: 'Erro',
        message: err?.response?.data?.message || 'Falha ao abrir o cálculo.',
        color: 'red',
      })
      setDetalhe(null)
    } finally {
      setDetalheLoading(false)
    }
  }

  const usarEmOrcamento = () => {
    notifications.show({
      title: 'Usar em orçamento',
      message: "Abra um orçamento e use 'Localizar Cálculo' no item.",
      color: 'blue',
    })
    router.push('/orcamento-grafico')
  }

  return (
    <Stack gap="md">
      {/* Header */}
      <div>
        <Title order={3}>Biblioteca de Cálculos</Title>
        <Text size="sm" c="dimmed">
          Localiza o Cálculo Padrão — {total} cálculo{total !== 1 ? 's' : ''} encontrado{total !== 1 ? 's' : ''}
        </Text>
      </div>

      {/* Filtros */}
      <Paper p="sm" withBorder>
        <Group gap="sm" align="flex-end" wrap="wrap">
          <TextInput
            label="Cliente"
            placeholder="Nome do cliente"
            leftSection={<IconSearch size={14} />}
            value={cliente}
            onChange={(e) => setCliente(e.currentTarget.value)}
            style={{ flex: 1, minWidth: 180 }}
          />
          <TextInput
            label="Linha de Produto"
            value={linhaProduto}
            onChange={(e) => setLinhaProduto(e.currentTarget.value)}
            w={160}
          />
          <TextInput
            label="Produto"
            value={produto}
            onChange={(e) => setProduto(e.currentTarget.value)}
            w={160}
          />
          <TextInput
            label="Descrição"
            value={descricao}
            onChange={(e) => setDescricao(e.currentTarget.value)}
            w={160}
          />
          <TextInput
            label="Sigla do Acabado"
            value={siglaAcabado}
            onChange={(e) => setSiglaAcabado(e.currentTarget.value)}
            w={140}
          />
          <NumberInput
            label="Nº Calcgraf"
            value={numeroCalcgraf}
            onChange={(v) => setNumeroCalcgraf(typeof v === 'number' ? v : '')}
            allowDecimal={false}
            min={0}
            w={130}
          />
          <NumberInput
            label="Nº Vizor"
            value={numero}
            onChange={(v) => setNumero(typeof v === 'number' ? v : '')}
            allowDecimal={false}
            min={0}
            w={130}
          />
        </Group>
      </Paper>

      {/* Tabela */}
      {loading ? (
        <Center py="xl"><Loader /></Center>
      ) : (
        <ScrollArea>
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nº Vizor</Table.Th>
                <Table.Th>Nº Calcgraf</Table.Th>
                <Table.Th>Cliente</Table.Th>
                <Table.Th>Produto/Descrição</Table.Th>
                <Table.Th>Linha</Table.Th>
                <Table.Th>Data</Table.Th>
                <Table.Th>Origem</Table.Th>
                <Table.Th ta="center">Ações</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {itens.map((c) => (
                <Table.Tr key={c.id}>
                  <Table.Td fw={600}>{c.numero ?? '—'}</Table.Td>
                  <Table.Td>{rotuloCalcgraf(c.numeroCalcgraf)}</Table.Td>
                  <Table.Td>{c.clienteNome || '—'}</Table.Td>
                  <Table.Td>{c.produto || c.descricao || '—'}</Table.Td>
                  <Table.Td>{c.linhaProduto || '—'}</Table.Td>
                  <Table.Td>{formatarData(c.dataCalculo)}</Table.Td>
                  <Table.Td><BadgeOrigem origem={c.origem} /></Table.Td>
                  <Table.Td ta="center">
                    <Group gap="xs" justify="center" wrap="nowrap">
                      <Button size="xs" variant="light" onClick={() => abrirDetalhe(c.id)}>
                        Abrir
                      </Button>
                      <Button size="xs" variant="subtle" onClick={usarEmOrcamento}>
                        Usar em orçamento
                      </Button>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {itens.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={8}>
                    <Text ta="center" c="dimmed" py="md">
                      Nenhum cálculo encontrado
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}

      {/* Paginação */}
      {totalPaginas > 1 && (
        <Group justify="center">
          <Pagination total={totalPaginas} value={pagina} onChange={setPagina} />
        </Group>
      )}

      {/* Modal "Abrir" — detalhe básico do cálculo */}
      <Modal
        opened={!!detalhe}
        onClose={() => setDetalhe(null)}
        title="Detalhes do Cálculo"
        size="lg"
      >
        {detalheLoading || !detalhe ? (
          <Center py="xl"><Loader /></Center>
        ) : (
          <Stack gap="md">
            {detalhe.origem === 'MIGRADO_CALCGRAF' && (
              <Alert icon={<IconAlertTriangle size={16} />} color="yellow" title="Foto arquivada">
                Foto arquivada — não recalcular.
              </Alert>
            )}

            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              <Text size="sm"><strong>Nº Vizor:</strong> {detalhe.numero ?? '—'}</Text>
              <Text size="sm"><strong>Nº Calcgraf:</strong> {rotuloCalcgraf(detalhe.numeroCalcgraf)}</Text>
              <Text size="sm"><strong>Cliente:</strong> {detalhe.clienteNome || '—'}</Text>
              <Text size="sm"><strong>Produto:</strong> {detalhe.produto || '—'}</Text>
              <Text size="sm" style={{ gridColumn: '1 / -1' }}>
                <strong>Descrição:</strong> {detalhe.descricao || '—'}
              </Text>
              <Text size="sm"><strong>Origem:</strong> <BadgeOrigem origem={detalhe.origem} /></Text>
            </SimpleGrid>

            {(detalhe.custoProducao != null || detalhe.valorTotal != null) && (
              <Paper p="sm" withBorder>
                <Group justify="space-between">
                  <Text size="sm">Custo de Produção</Text>
                  <Text size="sm" fw={600} c="red">{formatCurrency(detalhe.custoProducao)}</Text>
                </Group>
                <Group justify="space-between">
                  <Text size="sm">Valor Total</Text>
                  <Text size="sm" fw={700} c="green">{formatCurrency(detalhe.valorTotal)}</Text>
                </Group>
              </Paper>
            )}

            <Group justify="flex-end">
              <Button variant="default" onClick={() => setDetalhe(null)}>Fechar</Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </Stack>
  )
}
