'use client'

import { useEffect } from 'react'
import { Card, Group, Text, SimpleGrid, ThemeIcon, Badge, Loader, Center } from '@mantine/core'
import { IconTruckDelivery, IconBuildingWarehouse, IconPackage, IconClipboardCheck, IconClock } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api'

function useWmsQuery<T = any>(endpoint: string) {
  return useQuery<T>({
    queryKey: ['wms-standalone-dash', endpoint],
    queryFn: async () => {
      const token = localStorage.getItem('wms-token')
      const res = await fetch(`${API_URL}${endpoint}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) return null
      return res.json()
    },
    retry: false,
  })
}

export default function WmsDashboardPage() {
  useEffect(() => { document.title = 'Vizor WMS - Dashboard' }, [])

  const { data: configStatus } = useWmsQuery<any>('/wms-standalone/config/status')
  const { data: notasResp } = useWmsQuery<any>('/notas-entrada?limit=100&status=PENDENTE')
  const { data: estoqueResp } = useWmsQuery<any>('/estoque/saldos?limit=500')
  const { data: inventariosResp } = useWmsQuery<any>('/inventarios?status=ABERTO&limit=5')

  const notasPendentes = notasResp?.total || notasResp?.data?.length || 0
  const totalProdutosEstoque = estoqueResp?.data?.length || (Array.isArray(estoqueResp) ? estoqueResp.length : 0)
  const inventariosAbertos = inventariosResp?.data?.length || 0

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <div>
          <Text size="xl" fw={700}>Dashboard WMS</Text>
          <Text size="sm" c="dimmed">Painel operacional do armazém</Text>
        </div>
        {configStatus && (
          <Badge size="lg" color={configStatus.integracaoAtiva ? 'green' : 'red'} variant="dot">
            Integração: {configStatus.integracaoAtiva ? 'Ativa' : 'Inativa'}
            {configStatus.sistemaExterno && ` — ${configStatus.sistemaExterno}`}
          </Badge>
        )}
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} mb="xl">
        <Card withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Notas Pendentes</Text>
              <Text size="xl" fw={700} c="orange">{notasPendentes}</Text>
            </div>
            <ThemeIcon color="orange" variant="light" size={48} radius="md"><IconTruckDelivery size={24} /></ThemeIcon>
          </Group>
        </Card>
        <Card withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Produtos c/ Estoque</Text>
              <Text size="xl" fw={700} c="green">{totalProdutosEstoque}</Text>
            </div>
            <ThemeIcon color="green" variant="light" size={48} radius="md"><IconBuildingWarehouse size={24} /></ThemeIcon>
          </Group>
        </Card>
        <Card withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Inventários Abertos</Text>
              <Text size="xl" fw={700} c="blue">{inventariosAbertos}</Text>
            </div>
            <ThemeIcon color="blue" variant="light" size={48} radius="md"><IconClipboardCheck size={24} /></ThemeIcon>
          </Group>
        </Card>
        <Card withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Modo</Text>
              <Text size="xl" fw={700}>Standalone</Text>
            </div>
            <ThemeIcon color="violet" variant="light" size={48} radius="md"><IconPackage size={24} /></ThemeIcon>
          </Group>
        </Card>
      </SimpleGrid>

      <Card withBorder>
        <Group gap="sm" mb="sm">
          <IconClock size={20} />
          <Text fw={600}>Status Operacional</Text>
        </Group>
        <Text c="dimmed" size="sm">
          {notasPendentes > 0
            ? `${notasPendentes} nota(s) de entrada aguardando conferência/endereçamento.`
            : 'Todas as notas processadas. Armazém operando normalmente.'}
        </Text>
      </Card>
    </div>
  )
}
