'use client'

import { Alert } from '@mantine/core'
import { IconInfoCircle } from '@tabler/icons-react'
import type { StatusPedido } from '@/data/hooks/vendas/types'

interface BannerStatusProps {
  status: StatusPedido
  temFaturamentoParcial?: boolean
}

export function BannerStatus({ status, temFaturamentoParcial }: BannerStatusProps) {
  if (status === 'RASCUNHO') return null

  if (status === 'CONFIRMADO') {
    return (
      <Alert color="blue" icon={<IconInfoCircle size={16} />} mb="md">
        Pedido confirmado — apenas alguns campos podem ser editados.
        {temFaturamentoParcial && (
          <> Itens parcialmente faturados não podem ser alterados.</>
        )}
      </Alert>
    )
  }

  // EFETIVADO, CANCELADO → redirect para página de detalhe (não chega aqui)
  return null
}
