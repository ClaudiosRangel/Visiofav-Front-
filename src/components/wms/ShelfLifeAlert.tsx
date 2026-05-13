'use client'

import { Alert } from '@mantine/core'
import { IconAlertTriangle } from '@tabler/icons-react'
import { verificarShelfLife } from '@/utils/shelfLife'

interface ShelfLifeAlertProps {
  dataVencimento: string | Date | null | undefined
  shelfLifeMinimo: number | null | undefined
}

export function ShelfLifeAlert({ dataVencimento, shelfLifeMinimo }: ShelfLifeAlertProps) {
  const resultado = verificarShelfLife(dataVencimento, shelfLifeMinimo)
  if (!resultado) return null

  return (
    <Alert
      color="yellow"
      variant="light"
      icon={<IconAlertTriangle size={16} />}
      title="Shelf Life abaixo do mínimo"
    >
      Validade com {resultado.diasRestantes} dias restantes — mínimo exigido: {resultado.minimoExigido} dias
    </Alert>
  )
}
