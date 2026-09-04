'use client'

import { Badge } from '@mantine/core'
import type { StatusFinanceiro } from '@/lib/financeiro-vizor/types'

/**
 * Mapa de cor por valor de `StatusFinanceiro`.
 *
 * Exposto para viabilizar teste (Property 8): todo valor do enum mapeia para
 * exatamente uma cor e valores distintos usam cores distintas.
 *
 * Usa nomes de cor do tema Mantine (não índices claros fixos `-0`); com
 * `variant="light"` o `Badge` deriva fundo/texto dos tokens `*-light`, que se
 * adaptam a tema claro e escuro mantendo contraste. (Req 2.2, 7.2, 7.4)
 */
export const CORES_STATUS_FINANCEIRO: Record<StatusFinanceiro, string> = {
  ATIVO: 'green',
  SOMENTE_LEITURA: 'yellow',
  INATIVADO: 'red',
}

/** Rótulos legíveis para cada status financeiro. */
export const ROTULOS_STATUS_FINANCEIRO: Record<StatusFinanceiro, string> = {
  ATIVO: 'Ativo',
  SOMENTE_LEITURA: 'Somente leitura',
  INATIVADO: 'Inativado',
}

interface StatusFinanceiroBadgeProps {
  status: StatusFinanceiro
}

export function StatusFinanceiroBadge({ status }: StatusFinanceiroBadgeProps) {
  return (
    <Badge color={CORES_STATUS_FINANCEIRO[status]} variant="light">
      {ROTULOS_STATUS_FINANCEIRO[status]}
    </Badge>
  )
}
