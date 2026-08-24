'use client'

import { Badge } from '@mantine/core'

interface NotificationBadgeProps {
  count: number
}

/**
 * Badge de notificações não-lidas.
 * - count === 0: oculto
 * - 1 ≤ count ≤ 99: exibe número exato
 * - count > 99: exibe "99+"
 */
export function NotificationBadge({ count }: NotificationBadgeProps) {
  if (count <= 0) return null

  const label = count > 99 ? '99+' : String(count)

  return (
    <Badge
      size="xs"
      variant="filled"
      color="red"
      circle={count <= 9}
      style={{
        position: 'absolute',
        top: -4,
        right: -4,
        minWidth: 16,
        height: 16,
        padding: '0 4px',
        fontSize: 10,
        lineHeight: '16px',
        pointerEvents: 'none',
      }}
    >
      {label}
    </Badge>
  )
}
