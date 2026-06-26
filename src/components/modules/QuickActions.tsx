'use client'

import { Text } from '@mantine/core'
import {
  IconFileText,
  IconReceipt,
  IconUserPlus,
  IconClipboardCheck,
} from '@tabler/icons-react'

interface QuickAction {
  icon: React.ElementType
  label: string
  href: string
}

const actions: QuickAction[] = [
  { icon: IconFileText, label: 'Nova Cotação', href: '/compras/pedidos' },
  { icon: IconReceipt, label: 'Novo Pedido', href: '/vendas/pedidos' },
  { icon: IconUserPlus, label: 'Novo Cliente', href: '/configurador/clientes' },
  { icon: IconClipboardCheck, label: 'Receber OS', href: '/recebimento' },
]

export default function QuickActions() {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl px-8 py-6 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Text fw={600} size="md" c="#111827">
            Acesso rápido
          </Text>
          <Text size="xs" c="#6B7280">
            Atalhos para rotinas mais utilizadas no dia a dia.
          </Text>
        </div>
        <div className="flex flex-wrap items-center gap-6">
          {actions.map((action) => (
            <a
              key={action.label}
              href={action.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-gray-600 hover:text-green-700 transition-colors"
            >
              <action.icon size={18} stroke={1.5} />
              <Text size="sm" fw={500}>
                {action.label}
              </Text>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
