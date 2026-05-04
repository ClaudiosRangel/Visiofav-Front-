'use client'

import { useEffect } from 'react'
import { Card, SimpleGrid, Text, Title, ThemeIcon, UnstyledButton, Center, Stack } from '@mantine/core'
import {
  IconShoppingCart,
  IconReceipt,
  IconCash,
  IconBuildingWarehouse,
  IconTruck,
  IconSettings,
} from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { useEmpresa } from '@/providers/EmpresaProvider'

const MODULOS_CONFIG = [
  { modulo: 'COMPRAS', label: 'Compras', icon: IconShoppingCart, href: '/compras/pedidos', color: 'blue' },
  { modulo: 'VENDAS', label: 'Vendas', icon: IconReceipt, href: '/vendas/pedidos', color: 'green' },
  { modulo: 'FINANCEIRO', label: 'Financeiro', icon: IconCash, href: '/financeiro/contas-pagar', color: 'yellow' },
  { modulo: 'WMS', label: 'WMS', icon: IconBuildingWarehouse, href: '/recebimento', color: 'primary' },
  { modulo: 'CTE', label: 'CT-e', icon: IconTruck, href: '/fiscal/cte', color: 'orange' },
  { modulo: 'PCP', label: 'Configurador', icon: IconSettings, href: '/configurador', color: 'grape' },
] as const

export default function ModulosPage() {
  useEffect(() => { document.title = 'VisioFab - Módulos' }, [])
  const router = useRouter()
  const { modulos, empresa } = useEmpresa()

  const modulosVisiveis = MODULOS_CONFIG.filter((m) => modulos.includes(m.modulo))

  if (modulosVisiveis.length === 0) {
    return (
      <Center h="60vh">
        <Text size="lg" c="dimmed">
          Nenhum módulo disponível para esta empresa.
        </Text>
      </Center>
    )
  }

  return (
    <Stack gap="lg">
      <Title order={2}>
        Módulos{empresa ? ` — ${empresa.nomeFantasia || empresa.razaoSocial}` : ''}
      </Title>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {modulosVisiveis.map((m) => (
          <UnstyledButton key={m.modulo} onClick={() => window.open(m.href, '_blank')}>
            <Card withBorder style={{ cursor: 'pointer' }} className="hover:shadow-md transition-shadow">
              <Stack align="center" gap="sm" py="md">
                <ThemeIcon color={m.color} variant="light" size={56} radius="md">
                  <m.icon size={28} />
                </ThemeIcon>
                <Text fw={600} size="lg">
                  {m.label}
                </Text>
              </Stack>
            </Card>
          </UnstyledButton>
        ))}
      </SimpleGrid>
    </Stack>
  )
}
