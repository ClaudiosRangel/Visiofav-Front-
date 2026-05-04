'use client'

import { useState } from 'react'
import { Tooltip, UnstyledButton, Stack, Text } from '@mantine/core'
import {
  IconHome,
  IconSettings,
  IconChartBar,
  IconPackage,
  IconTruckDelivery,
  IconClipboardCheck,
  IconArrowsExchange,
  IconBarcode,
  IconBuildingWarehouse,
  IconShoppingCart,
  IconReceipt,
  IconCash,
  IconFileText,
  IconApps,
} from '@tabler/icons-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

interface NavItem {
  icon: React.ElementType
  label: string
  href: string
  color?: string
}

const navItems: NavItem[] = [
  { icon: IconApps, label: 'Módulos', href: '/modulos' },
  { icon: IconHome, label: 'Início', href: '/dashboard' },
  { icon: IconShoppingCart, label: 'Compras', href: '/compras/pedidos' },
  { icon: IconReceipt, label: 'Vendas', href: '/vendas/pedidos' },
  { icon: IconCash, label: 'Financ', href: '/financeiro/contas-pagar' },
  { icon: IconFileText, label: 'Fiscal', href: '/fiscal/nfe' },
  { icon: IconBuildingWarehouse, label: 'Estoque', href: '/estoque' },
  { icon: IconTruckDelivery, label: 'Recebo', href: '/recebimento' },
  { icon: IconPackage, label: 'Exped', href: '/expedicao' },
  { icon: IconArrowsExchange, label: 'Movim', href: '/movimentacao' },
  { icon: IconClipboardCheck, label: 'Invent', href: '/inventario' },
  { icon: IconBarcode, label: 'Picking', href: '/picking' },
  { icon: IconChartBar, label: 'Gestão', href: '/gestao' },
  { icon: IconSettings, label: 'Config', href: '/configurador' },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <nav className="fixed left-0 top-0 h-screen w-[70px] bg-white border-r border-gray-200 flex flex-col items-center py-4 z-50">
      <div className="mb-6">
        <Text size="xs" fw={700} c="primary" className="text-center">
          WMS
        </Text>
      </div>

      <Stack gap={2} className="flex-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href)
          return (
            <Tooltip key={item.href} label={item.label} position="right" withArrow>
              <UnstyledButton
                component={Link}
                href={item.href}
                className={`flex flex-col items-center justify-center w-[58px] h-[58px] rounded-lg transition-colors ${
                  isActive
                    ? 'bg-teal-50 text-teal-700'
                    : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700'
                }`}
              >
                <item.icon size={22} stroke={1.5} />
                <Text size="10px" mt={2}>
                  {item.label}
                </Text>
              </UnstyledButton>
            </Tooltip>
          )
        })}
      </Stack>
    </nav>
  )
}
