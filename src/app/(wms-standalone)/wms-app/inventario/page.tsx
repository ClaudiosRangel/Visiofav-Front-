'use client'

import { useEffect } from 'react'
import { Card, Group, Text, Table, Badge, Button, SimpleGrid, ThemeIcon, Loader, Center } from '@mantine/core'
import { IconClipboardCheck, IconRefresh } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api'

function useWmsQuery<T = any>(endpoint: string) {
  return useQuery<T>({
    queryKey: ['wms-standalone', endpoint],
    queryFn: async () => {
      const token = localStorage.getItem('wms-token')
      const res = await fetch(`${API_URL}${endpoint}`, { headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    retry: false,
  })
}

const statusCores: Record<string, string> = { ABERTO: 'blue', EM_CONTAGEM: 'orange', CONCLUIDO: 'green', CANCELADO: 'red' }

export default function InventarioStandalonePage() {
  useEffect(() => { document.title = 'Vizor WMS - Inventário' }, [])
  const { data, isLoading, refetch } = useWmsQuery<any>('/inventarios?limit=20')
  const inventarios = data?.data || []

  if (isLoading) return <Center h={300}><Loader /></Center>

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <div>
          <Text size="xs" c="dimmed" mb={4}>WMS / Inventário</Text>
          <Text size="xl" fw={600}>Inventário / Contagem Cíclica</Text>
        </div>
        <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="lg">
        <Card withBorder>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Abertos</Text>
          <Text size="xl" fw={700} c="blue">{inventarios.filter((i: any) => ['ABERTO','EM_CONTAGEM'].includes(i.status)).length}</Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Concluídos</Text>
          <Text size="xl" fw={700} c="green">{inventarios.filter((i: any) => i.status === 'CONCLUIDO').length}</Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Total</Text>
          <Text size="xl" fw={700}>{inventarios.length}</Text>
        </Card>
      </SimpleGrid>

      <Card>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr><Table.Th>#</Table.Th><Table.Th>Tipo</Table.Th><Table.Th>Itens</Table.Th><Table.Th>Status</Table.Th><Table.Th>Data</Table.Th></Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {inventarios.map((inv: any) => (
              <Table.Tr key={inv.id}>
                <Table.Td fw={600}>#{inv.numero}</Table.Td>
                <Table.Td><Badge variant="light">{inv.tipo}</Badge></Table.Td>
                <Table.Td>{inv.totalItens || inv._count?.itens || 0}</Table.Td>
                <Table.Td><Badge color={statusCores[inv.status] || 'gray'}>{inv.status}</Badge></Table.Td>
                <Table.Td>{new Date(inv.criadoEm).toLocaleDateString('pt-BR')}</Table.Td>
              </Table.Tr>
            ))}
            {inventarios.length === 0 && <Table.Tr><Table.Td colSpan={5} className="text-center py-8 text-zinc-500">Nenhum inventário</Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>
      </Card>
    </div>
  )
}
