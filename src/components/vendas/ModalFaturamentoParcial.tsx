import { Modal, Text } from '@mantine/core'
import type { ItemPedidoVenda } from '@/data/hooks/vendas/types'

interface ModalFaturamentoParcialProps {
  opened: boolean
  onClose: () => void
  itens: ItemPedidoVenda[]
  pedidoId: string
}

/**
 * Placeholder — será implementado completamente na task 7.1.
 */
export function ModalFaturamentoParcial({ opened, onClose, itens, pedidoId }: ModalFaturamentoParcialProps) {
  return (
    <Modal opened={opened} onClose={onClose} title="Faturamento Parcial" centered size="lg">
      <Text c="dimmed">Implementação pendente (task 7.1)</Text>
    </Modal>
  )
}
