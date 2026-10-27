'use client'

/**
 * Régua de estágios da jornada do pedido (Painel de Status Unificado — R9 da
 * spec orcamento-grafico-handoff-comercial). Mostra o caminho ponta a ponta:
 * Orçamento → Amostra → Pedido → Produção (PCP) → Faturamento. Camada de
 * leitura: consome GET /orcamento-grafico/pedidos/:pedidoId/jornada.
 */
import { useEffect, useState, useCallback } from 'react'
import { Paper, Group, Text, Badge, Stack, Loader, Center, ThemeIcon, Tooltip } from '@mantine/core'
import { IconCheck, IconClock, IconHourglass, IconBan, IconChevronRight } from '@tabler/icons-react'
import { api } from '@/lib/api'

type EstadoEstagio = 'CONCLUIDO' | 'ATUAL' | 'PENDENTE' | 'BLOQUEADO'

interface Estagio {
  chave: string
  titulo: string
  estado: EstadoEstagio
  detalhe?: string
}

interface OpJornada {
  id: string
  numero: number
  status: string
  descricao: string | null
}

interface Jornada {
  pedidoVendaId: string
  numeroPedido: number
  statusPedido: string
  cliente: string | null
  valorTotal: number
  orcamento: { id: string; numero: number; status: string } | null
  exigeAmostra: boolean
  amostra: { status: string | null; rodadas: number } | null
  ops: OpJornada[]
  estagios: Estagio[]
}

const ICONE: Record<EstadoEstagio, React.ReactNode> = {
  CONCLUIDO: <IconCheck size={16} />,
  ATUAL: <IconClock size={16} />,
  PENDENTE: <IconHourglass size={16} />,
  BLOQUEADO: <IconBan size={16} />,
}

const COR: Record<EstadoEstagio, string> = {
  CONCLUIDO: 'green',
  ATUAL: 'blue',
  PENDENTE: 'gray',
  BLOQUEADO: 'red',
}

export default function JornadaPedido({ pedidoId }: { pedidoId: string }) {
  const [jornada, setJornada] = useState<Jornada | null>(null)
  const [loading, setLoading] = useState(true)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get(`/orcamento-grafico/pedidos/${pedidoId}/jornada`)
      setJornada(data)
    } catch {
      setJornada(null)
    } finally {
      setLoading(false)
    }
  }, [pedidoId])

  useEffect(() => { carregar() }, [carregar])

  if (loading) return <Center py="md"><Loader size="sm" /></Center>
  if (!jornada) return null

  return (
    <Paper p="md" withBorder radius="md">
      <Text fw={600} size="sm" mb="sm">Jornada do pedido</Text>

      <Group gap={4} wrap="wrap" align="center">
        {jornada.estagios.map((e, i) => (
          <Group key={e.chave} gap={4} wrap="nowrap">
            <Tooltip label={e.detalhe || e.titulo} withArrow>
              <Group gap={6} wrap="nowrap">
                <ThemeIcon size="md" radius="xl" color={COR[e.estado]} variant={e.estado === 'PENDENTE' ? 'light' : 'filled'}>
                  {ICONE[e.estado]}
                </ThemeIcon>
                <Stack gap={0}>
                  <Text size="xs" fw={600}>{e.titulo}</Text>
                  {e.detalhe && <Text size="xs" c="dimmed">{e.detalhe}</Text>}
                </Stack>
              </Group>
            </Tooltip>
            {i < jornada.estagios.length - 1 && <IconChevronRight size={16} color="var(--mantine-color-gray-5)" />}
          </Group>
        ))}
      </Group>

      {jornada.ops.length > 0 && (
        <Stack gap={4} mt="sm">
          <Text size="xs" c="dimmed">Ordens de produção:</Text>
          <Group gap={6} wrap="wrap">
            {jornada.ops.map((op) => (
              <Badge
                key={op.id}
                variant="light"
                color={op.status === 'CONCLUIDA' ? 'green' : op.status === 'EM_PRODUCAO' ? 'blue' : 'gray'}
              >
                OP {op.numero} · {op.status}
              </Badge>
            ))}
          </Group>
        </Stack>
      )}
    </Paper>
  )
}
