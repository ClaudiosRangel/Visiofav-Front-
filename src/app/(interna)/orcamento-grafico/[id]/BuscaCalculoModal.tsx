'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Modal, Stack, Group, TextInput, Table, Badge, Text, Loader, Center,
  ScrollArea, Pagination, Button, NumberInput, Paper,
} from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

// ============================================================================
// Tipos — espelham GET /calculo-grafico
// ============================================================================

export interface ResumoCalculo {
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

interface BuscaCalculoModalProps {
  opened: boolean
  onClose: () => void
  orcamentoId: string
  /** Chamado após criar o item a partir do cálculo (sucesso). */
  onUsado: () => void
}

const TAMANHO = 20

function formatarData(dateStr: string | null): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR')
}

function BadgeOrigem({ origem }: { origem: string | null }) {
  if (origem === 'MIGRADO_CALCGRAF') return <Badge color="gray">Calcgraf</Badge>
  if (origem === 'VIZOR') return <Badge color="blue">Vizor</Badge>
  return <Badge color="gray" variant="light">—</Badge>
}

function rotuloCalcgraf(n: number | null): string {
  return n != null ? `Calcgraf ${n}` : '—'
}

// ============================================================================
// Modal de busca de cálculos reutilizável (biblioteca + wizard de item)
// ============================================================================

export default function BuscaCalculoModal({
  opened,
  onClose,
  orcamentoId,
  onUsado,
}: BuscaCalculoModalProps) {
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
  const [loading, setLoading] = useState(false)

  // Uso
  const [usandoId, setUsandoId] = useState<string | null>(null)
  const [novaQuantidade, setNovaQuantidade] = useState<number | ''>('')

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

  // Debounce nos filtros + reset de página
  useEffect(() => {
    if (!opened) return
    setPagina(1)
  }, [cliente, linhaProduto, produto, descricao, siglaAcabado, numeroCalcgraf, numero, opened])

  useEffect(() => {
    if (!opened) return
    const t = setTimeout(() => { buscar() }, 400)
    return () => clearTimeout(t)
  }, [opened, buscar])

  const usarCalculo = async (calculoId: string) => {
    setUsandoId(calculoId)
    try {
      const body: Record<string, unknown> = { calculoId }
      if (typeof novaQuantidade === 'number' && novaQuantidade > 0) {
        body.novaQuantidade = novaQuantidade
      }
      await api.post(`/orcamento-grafico/${orcamentoId}/itens/de-calculo`, body)
      notifications.show({
        title: 'Item criado',
        message: 'Item criado a partir do cálculo.',
        color: 'green',
      })
      onUsado()
      onClose()
    } catch (err: any) {
      notifications.show({
        title: 'Erro',
        message: err?.response?.data?.message || 'Falha ao usar o cálculo.',
        color: 'red',
      })
    } finally {
      setUsandoId(null)
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="Localizar Cálculo"
      size="xl"
    >
      <Stack gap="md">
        {/* Filtros */}
        <Paper p="sm" withBorder>
          <Group gap="sm" align="flex-end" wrap="wrap">
            <TextInput
              label="Cliente"
              placeholder="Nome do cliente"
              leftSection={<IconSearch size={14} />}
              value={cliente}
              onChange={(e) => setCliente(e.currentTarget.value)}
              style={{ flex: 1, minWidth: 160 }}
            />
            <TextInput
              label="Linha de Produto"
              value={linhaProduto}
              onChange={(e) => setLinhaProduto(e.currentTarget.value)}
              w={150}
            />
            <TextInput
              label="Produto"
              value={produto}
              onChange={(e) => setProduto(e.currentTarget.value)}
              w={150}
            />
            <TextInput
              label="Descrição"
              value={descricao}
              onChange={(e) => setDescricao(e.currentTarget.value)}
              w={150}
            />
            <TextInput
              label="Sigla Acabado"
              value={siglaAcabado}
              onChange={(e) => setSiglaAcabado(e.currentTarget.value)}
              w={120}
            />
            <NumberInput
              label="Nº Calcgraf"
              value={numeroCalcgraf}
              onChange={(v) => setNumeroCalcgraf(typeof v === 'number' ? v : '')}
              allowDecimal={false}
              min={0}
              w={120}
            />
            <NumberInput
              label="Nº Vizor"
              value={numero}
              onChange={(v) => setNumero(typeof v === 'number' ? v : '')}
              allowDecimal={false}
              min={0}
              w={120}
            />
          </Group>
        </Paper>

        {/* Nova quantidade (opcional) */}
        <NumberInput
          label="Nova quantidade (opcional)"
          description="Vazio = usa a quantidade do cálculo"
          value={novaQuantidade}
          onChange={(v) => setNovaQuantidade(typeof v === 'number' ? v : '')}
          allowDecimal={false}
          min={1}
          thousandSeparator="."
          decimalSeparator=","
          w={260}
        />

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
                      <Button
                        size="xs"
                        variant="light"
                        loading={usandoId === c.id}
                        onClick={() => usarCalculo(c.id)}
                      >
                        Usar
                      </Button>
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
      </Stack>
    </Modal>
  )
}
