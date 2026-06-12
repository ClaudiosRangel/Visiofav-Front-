'use client'

import { useEffect } from 'react'
import { Card, Group, Text, SimpleGrid, ThemeIcon, RingProgress, LoadingOverlay } from '@mantine/core'
import { IconPackage, IconTruckDelivery, IconClipboardCheck, IconMapPin } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export default function DashboardPage() {
  useEffect(() => { document.title = 'Vizor - Dashboard' }, [])
  const { data: produtosResp } = useQuery({ queryKey: ['dash-produtos'], queryFn: async () => { const { data } = await api.get('/produtos', { params: { limit: 1 } }); return data }, staleTime: 1000 * 60 })
  const { data: enderecosResp } = useQuery({ queryKey: ['dash-enderecos'], queryFn: async () => { const { data } = await api.get('/enderecos', { params: { limit: 1 } }); return data }, staleTime: 1000 * 60 })
  const { data: endOcupados } = useQuery({ queryKey: ['dash-end-ocupados'], queryFn: async () => { const { data } = await api.get('/enderecos', { params: { estado: 'OCUPADO', limit: 1 } }); return data }, staleTime: 1000 * 60 })
  const { data: endLivres } = useQuery({ queryKey: ['dash-end-livres'], queryFn: async () => { const { data } = await api.get('/enderecos', { params: { estado: 'LIVRE', limit: 1 } }); return data }, staleTime: 1000 * 60 })
  const { data: osResp } = useQuery({ queryKey: ['dash-os'], queryFn: async () => { const { data } = await api.get('/ordens-servico', { params: { limit: 1 } }); return data }, staleTime: 1000 * 60 })
  const { data: notasResp } = useQuery({ queryKey: ['dash-notas'], queryFn: async () => { const { data } = await api.get('/notas-entrada', { params: { limit: 1 } }); return data }, staleTime: 1000 * 60 })

  const totalProdutos = produtosResp?.total || 0
  const totalEnderecos = enderecosResp?.total || 0
  const totalOcupados = endOcupados?.total || 0
  const totalLivres = endLivres?.total || 0
  const totalOS = osResp?.total || 0
  const totalNotas = notasResp?.total || 0
  const percOcupacao = totalEnderecos > 0 ? Math.round((totalOcupados / totalEnderecos) * 100) : 0
  const percLivre = totalEnderecos > 0 ? Math.round((totalLivres / totalEnderecos) * 100) : 0

  const stats = [
    { title: 'Produtos', value: String(totalProdutos), icon: IconPackage, color: 'primary' },
    { title: 'Endereços', value: String(totalEnderecos), icon: IconMapPin, color: 'blue' },
    { title: 'Ordens de Serviço', value: String(totalOS), icon: IconClipboardCheck, color: 'grape' },
    { title: 'Notas de Entrada', value: String(totalNotas), icon: IconTruckDelivery, color: 'orange' },
  ]

  return (
    <div>
      <Text size="xl" fw={600} mb="lg">Dashboard</Text>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="xl">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>{stat.title}</Text>
                <Text size="xl" fw={700} mt={4}>{stat.value}</Text>
              </div>
              <ThemeIcon color={stat.color} variant="light" size={48} radius="md"><stat.icon size={24} /></ThemeIcon>
            </Group>
          </Card>
        ))}
      </SimpleGrid>

      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <Card>
          <Text fw={600} mb="md">Ocupação do Armazém</Text>
          <Group justify="center">
            <RingProgress
              size={180} thickness={16} roundCaps
              sections={[
                { value: percOcupacao, color: 'primary' },
                { value: percLivre, color: 'gray.2' },
              ]}
              label={<Text ta="center" size="lg" fw={700}>{percOcupacao}%</Text>}
            />
          </Group>
          <Group justify="center" mt="md" gap="lg">
            <Group gap={4}><div className="w-3 h-3 rounded-full bg-teal-600" /><Text size="xs">Ocupado: {totalOcupados}</Text></Group>
            <Group gap={4}><div className="w-3 h-3 rounded-full bg-gray-200" /><Text size="xs">Livre: {totalLivres}</Text></Group>
            <Text size="xs" c="dimmed">Total: {totalEnderecos}</Text>
          </Group>
        </Card>

        <Card>
          <Text fw={600} mb="md">Resumo Rápido</Text>
          <div className="space-y-4">
            <Group justify="space-between" className="py-2 border-b border-gray-100">
              <Text size="sm">Produtos cadastrados</Text>
              <Text size="sm" fw={600} c="primary">{totalProdutos}</Text>
            </Group>
            <Group justify="space-between" className="py-2 border-b border-gray-100">
              <Text size="sm">Endereços totais</Text>
              <Text size="sm" fw={600} c="primary">{totalEnderecos}</Text>
            </Group>
            <Group justify="space-between" className="py-2 border-b border-gray-100">
              <Text size="sm">Endereços ocupados</Text>
              <Text size="sm" fw={600} c="blue">{totalOcupados}</Text>
            </Group>
            <Group justify="space-between" className="py-2 border-b border-gray-100">
              <Text size="sm">Endereços livres</Text>
              <Text size="sm" fw={600} c="green">{totalLivres}</Text>
            </Group>
            <Group justify="space-between" className="py-2">
              <Text size="sm">Ordens de serviço</Text>
              <Text size="sm" fw={600} c="grape">{totalOS}</Text>
            </Group>
          </div>
        </Card>
      </SimpleGrid>
    </div>
  )
}
