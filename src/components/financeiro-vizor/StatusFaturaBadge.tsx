'use client'

import { Badge } from '@mantine/core'
import type { StatusFatura } from '@/lib/financeiro-vizor/types'

/**
 * Mapa de cor por valor de `StatusFatura`.
 *
 * Exposto para viabilizar teste (Property 8): todo valor do enum mapeia para
 * exatamente uma cor e valores distintos usam cores distintas.
 *
 * Usa nomes de cor do tema Mantine (não índices claros fixos `-0`); com
 * `variant="light"` o `Badge` deriva fundo/texto dos tokens `*-light`, que se
 * adaptam a tema claro e escuro mantendo contraste. (Req 4.3, 7.2, 7.4)
 */
export const CORES_STATUS_FATURA: Record<StatusFatura, string> = {
  PENDENTE: 'blue',
  VENCIDA: 'orange',
  PAGA: 'green',
  CANCELADA: 'gray',
}

/** Rótulos legíveis para cada status de fatura. */
export const ROTULOS_STATUS_FATURA: Record<StatusFatura, string> = {
  PENDENTE: 'Pendente',
  VENCIDA: 'Vencida',
  PAGA: 'Paga',
  CANCELADA: 'Cancelada',
}

interface StatusFaturaBadgeProps {
  status: StatusFatura
}

export function StatusFaturaBadge({ status }: StatusFaturaBadgeProps) {
  return (
    <Badge color={CORES_STATUS_FATURA[status]} variant="light">
      {ROTULOS_STATUS_FATURA[status]}
    </Badge>
  )
}
