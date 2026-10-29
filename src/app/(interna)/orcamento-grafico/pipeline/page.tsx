'use client'

/**
 * Painel de Status Unificado (Pipeline Comercial) — B3. Lista os pedidos de
 * origem comercial com a régua de estágios ponta a ponta
 * (Orçamento → Amostra → Pedido → Produção → Faturamento). Consome
 * GET /orcamento-grafico/pedidos/jornadas.
 */
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Title, Stack, Group, Text, Loader, Center, Paper, Badge, TextInput,
  Button, Tooltip, SegmentedControl,
} from '@mantine/core'
import { IconSearch, IconRefresh, IconExternalLink } from '@tabler/icons-react'
import { api } from '@/lib/api'

type EstadoEstagio = 'CONCLUIDO' | 'ATUAL' | 'PENDENTE' | 'BLOQUEADO'
interface Estagio { chave: string; titulo: string; estado: EstadoEstagio; detalhe?: string }
interface ItemPainel {
  pedidoVendaId: string
  numeroPedido: number
  statusPedido: string
  cliente: string | null
  valorTotal: number
  orcamentoId: string | null
  orcamentoNumero: number | null
  exigeAmostra: boolean
  amostraStatus: string | null
  opsTotal: number
  opsConcluidas: number
  estagioAtual: string
  estagios: Estagio[]
}

const COR_ESTADO: Record<EstadoEstagio, string> = {
  CONCLUIDO: 'green',
  ATUAL: 'blue',
  PENDENTE: 'gray',
  BLOQUEADO: 'red',
}

function brl(n: number) {
  return Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

const FILTROS_STATUS = [
  { label: 'Todos', value: '' },
  { label: 'Rascunho', value: 'RASCUNHO' },
  { label: 'Confirmado', value: 'CONFIRMADO' },
  { label: 'Em separação', value: 'EM_SEPARACAO' },
  { label: 'Efetivado', value: 'EFETIVADO' },
  { label: 'Faturado', value: 'FATURADO' },
]

export default function PipelineComercialPage() {
  const router = useRouter()
  useEffect(() => { document.title = 'Pipeline Comercial' }, [])

  const [itens, setItens] = useState<ItemPainel[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (statusFiltro) params.statusPedido = statusFiltro
      if (busca.trim()) params.busca = busca.trim()
      const { data } = await api.get('/orcamento-grafico/pedidos/jornadas', { params })
      setItens(Array.isArray(data) ? data : [])
    } catch {
      setItens([])
    } finally {
      setLoading(false)
    }
  }, [statusFiltro, busca])

  useEffect(() => { carregar() }, [statusFiltro]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Pipeline Comercial</Title>
          <Text size="sm" c="dimmed">Status ponta a ponta: Orçamento → Amostra → Pedido → Produção → Faturamento.</Text>
        </div>
        <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={carregar}>Atualizar</Button>
      </Group>

      <Paper p="sm" withBorder>
        <Group>
          <TextInput
            placeholder="Buscar por nº ou cliente..."
            leftSection={<IconSearch size={16} />}
            value={busca}
            onChange={(e) => setBusca(e.currentTarget.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') carregar() }}
            style={{ flex: 1 }}
          />
          <SegmentedControl
            size="xs"
            value={statusFiltro}
            onChange={setStatusFiltro}
            data={FILTROS_STATUS}
          />
        </Group>
      </Paper>

      {loading ? (
        <Center py="xl"><Loader /></Center>
      ) : itens.length === 0 ? (
        <Paper p="xl" withBorder><Text c="dimmed" ta="center">Nenhum pedido comercial nesta visão.</Text></Paper>
      ) : (
        <Stack gap="sm">
          {itens.map((it) => (
            <Paper key={it.pedidoVendaId} p="md" withBorder>
              <Group justify="space-between" mb="xs" wrap="nowrap">
                <Group gap="xs" wrap="nowrap">
                  <Text fw={700}>Pedido {it.numeroPedido}</Text>
                  {it.orcamentoNumero != null && (
                    <Badge variant="light" color="gray">Orç. {it.orcamentoNumero}</Badge>
                  )}
                  <Text size="sm" c="dimmed">{it.cliente || '—'}</Text>
                </Group>
                <Group gap="xs" wrap="nowrap">
                  <Text fw={600}>{brl(it.valorTotal)}</Text>
                  {it.orcamentoId && (
                    <Tooltip label="Abrir orçamento">
                      <Button size="compact-xs" variant="subtle" leftSection={<IconExternalLink size={13} />}
                        onClick={() => router.push(`/orcamento-grafico/${it.orcamentoId}`)}>
                        Abrir
                      </Button>
                    </Tooltip>
                  )}
                </Group>
              </Group>

              {/* Régua de estágios */}
              <Group gap={6} wrap="wrap">
                {it.estagios.map((e, i) => (
                  <Group key={e.chave} gap={6} wrap="nowrap">
                    <Tooltip label={e.detalhe || e.titulo}>
                      <Badge
                        variant={e.estado === 'ATUAL' ? 'filled' : 'light'}
                        color={COR_ESTADO[e.estado]}
                      >
                        {e.titulo}
                        {e.chave === 'PRODUCAO' && it.opsTotal > 0 ? ` ${it.opsConcluidas}/${it.opsTotal}` : ''}
                      </Badge>
                    </Tooltip>
                    {i < it.estagios.length - 1 && <Text c="dimmed" size="sm">→</Text>}
                  </Group>
                ))}
              </Group>
            </Paper>
          ))}
        </Stack>
      )}
    </Stack>
  )
}
