'use client'

import { Badge } from '@mantine/core'
import { IconMapPinFilled, IconMapPinOff } from '@tabler/icons-react'

interface GeoStatusBadgeProps {
  geocodificado: boolean
}

export function GeoStatusBadge({ geocodificado }: GeoStatusBadgeProps) {
  if (geocodificado) {
    return (
      <Badge color="green" size="xs" leftSection={<IconMapPinFilled size={12} />}>
        Geocodificado
      </Badge>
    )
  }

  return (
    <Badge color="gray" size="xs" leftSection={<IconMapPinOff size={12} />}>
      Não geocodificado
    </Badge>
  )
}
