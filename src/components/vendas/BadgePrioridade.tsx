import { Badge } from '@mantine/core'
import type { PrioridadePedido } from '@/data/hooks/vendas/types'
import { PRIORIDADE_COLORS } from './utils'

interface BadgePrioridadeProps {
  prioridade: PrioridadePedido
}

export function BadgePrioridade({ prioridade }: BadgePrioridadeProps) {
  return (
    <Badge color={PRIORIDADE_COLORS[prioridade]} size="sm">
      {prioridade}
    </Badge>
  )
}
