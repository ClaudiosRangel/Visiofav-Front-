'use client'
/**
 * Faixa do fluxo por operação: mostra em que etapa o pedido está, quais setores
 * estão bloqueados e permite concluir a etapa (ou encaminhar OP/PCP → Faturamento).
 * Use `pedidoId` (telas de pedido/pré-impressão) ou `orcamentoId` (tela de orçamento).
 * Sem pedido vinculado ao orçamento, não renderiza nada.
 */
import { useCallback, useEffect, useState } from 'react'
import { Alert, Badge, Button, Card, Group, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconCheck, IconLock } from '@tabler/icons-react'
import { api } from '@/lib/api'

type Etapa = 'COMERCIAL' | 'ORCAMENTO' | 'PRE_IMPRESSAO' | 'OP_PCP' | 'FATURAMENTO'
interface EtapaConfig { etapa: Etapa; ativa: boolean; bloqueia: Etapa[]; automatica?: boolean }
interface Contexto {
  pedidoId: string
  operacao: 'NOVO' | 'REPETICAO' | 'MOSTRUARIO' | 'ALTERACAO'
  etapas: EtapaConfig[]
  etapaAtual: Etapa | 'CONCLUIDO'
  concluido: boolean
  bloqueados: Etapa[]
  proxima: Etapa | null
}

const ROTULO: Record<Etapa, string> = {
  COMERCIAL: 'Comercial',
  ORCAMENTO: 'Orçamento',
  PRE_IMPRESSAO: 'Pré-Impressão',
  OP_PCP: 'OP / PCP',
  FATURAMENTO: 'Faturamento',
}
const ROTULO_OPERACAO: Record<Contexto['operacao'], string> = {
  NOVO: 'Novo',
  REPETICAO: 'Repetição',
  MOSTRUARIO: 'Mostruário',
  ALTERACAO: 'Alteração',
}

interface Props {
  pedidoId?: string
  orcamentoId?: string
  onChanged?: () => void
}

export default function FluxoPedidoBanner({ pedidoId, orcamentoId, onChanged }: Props) {
  const [ctx, setCtx] = useState<Contexto | null>(null)
  const [concluindo, setConcluindo] = useState(false)

  const carregar = useCallback(async () => {
    try {
      if (pedidoId) {
        const { data } = await api.get<Contexto>(`/orcamento-grafico/comercial/pedidos/${pedidoId}/fluxo`)
        setCtx(data)
      } else if (orcamentoId) {
        const { data } = await api.get<{ fluxo: Contexto | null }>(`/orcamento-grafico/comercial/orcamentos/${orcamentoId}/fluxo`)
        setCtx(data.fluxo)
      }
    } catch {
      setCtx(null)
    }
  }, [pedidoId, orcamentoId])

  useEffect(() => { void carregar() }, [carregar])

  if (!ctx) return null

  const ativas = ctx.etapas.filter((e) => e.ativa)
  const idxAtual = ctx.concluido ? ativas.length : ativas.findIndex((e) => e.etapa === ctx.etapaAtual)
  const atual = ctx.concluido ? null : (ctx.etapaAtual as Etapa)
  const rotuloBotao =
    atual === 'OP_PCP' ? 'Encaminhar para ' + (ctx.proxima ? ROTULO[ctx.proxima] : 'conclusão')
      : atual ? `Concluir ${ROTULO[atual]}` : ''

  const concluir = async () => {
    setConcluindo(true)
    try {
      const { data } = await api.post<Contexto>(`/orcamento-grafico/comercial/pedidos/${ctx.pedidoId}/fluxo/concluir`)
      setCtx(data)
      notifications.show({ color: 'green', message: 'Etapa concluída.' })
      onChanged?.()
    } catch (e) {
      const m = (e as { response?: { data?: { message?: string; error?: string } } }).response?.data
      notifications.show({ color: 'red', message: m?.message || m?.error || 'Não foi possível concluir a etapa.' })
      void carregar()
    } finally {
      setConcluindo(false)
    }
  }

  return (
    <Card withBorder padding="sm" radius="md">
      <Group justify="space-between" wrap="wrap" gap="xs">
        <Group gap={6} wrap="wrap">
          <Badge variant="light" color="indigo">Operação: {ROTULO_OPERACAO[ctx.operacao]}</Badge>
          {ativas.map((e, i) => {
            const feita = i < idxAtual
            const corrente = i === idxAtual
            return (
              <Group key={e.etapa} gap={4} wrap="nowrap">
                <Badge
                  color={feita ? 'green' : corrente ? 'blue' : 'gray'}
                  variant={corrente ? 'filled' : 'light'}
                  leftSection={feita ? <IconCheck size={10} /> : undefined}
                >
                  {ROTULO[e.etapa]}
                </Badge>
                {i < ativas.length - 1 && <Text size="xs" c="dimmed">→</Text>}
              </Group>
            )
          })}
          {ctx.concluido && <Badge color="green">Fluxo concluído</Badge>}
        </Group>
        {atual && (
          <Button size="xs" onClick={concluir} loading={concluindo}>
            {rotuloBotao}
          </Button>
        )}
      </Group>
      {ctx.bloqueados.length > 0 && atual && (
        <Alert mt="xs" color="orange" variant="light" icon={<IconLock size={16} />} p="xs">
          Enquanto {ROTULO[atual]} não for concluída, {ctx.bloqueados.map((s) => ROTULO[s]).join(' e ')} {ctx.bloqueados.length > 1 ? 'não podem' : 'não pode'} alterar este pedido.
        </Alert>
      )}
    </Card>
  )
}
