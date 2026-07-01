import { Badge } from '@mantine/core'

export const FISCAL_STATUS_COLORS: Record<string, string> = {
  PENDENTE: 'gray',
  RASCUNHO: 'gray',
  AUTORIZADA: 'green',
  AUTORIZADO: 'green',
  REJEITADA: 'red',
  REJEITADO: 'red',
  CANCELADA: 'orange',
  CANCELADO: 'orange',
  DENEGADA: 'yellow',
  CONTINGENCIA: 'blue',
  FALHA_RETRANSMISSAO: 'red',
  INUTILIZADO: 'violet',
}

interface StatusBadgeProps {
  status: string
  colorMap?: Record<string, string>
}

export function StatusBadge({ status, colorMap }: StatusBadgeProps) {
  const map = colorMap ?? FISCAL_STATUS_COLORS
  const color = map[status] ?? 'gray'

  return (
    <Badge color={color} size="sm">
      {status}
    </Badge>
  )
}
