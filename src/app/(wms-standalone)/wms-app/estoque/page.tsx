'use client'

import { useEffect } from 'react'
import { Card, Group, Text, Table, Badge, Button, SimpleGrid, ThemeIcon, Loader, Center } from '@mantine/core'
import { IconBuildingWarehouse, IconRefresh } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api'

function useWmsQuery<T = any>(endpoint: string) {
  return useQuery<T>({
    queryKey: ['wms-standalone', endpoint],
    queryFn: async () => {
      const token = localStorage.getItem('wms-token')
      const res = await fetch(`${API_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    },
    retry: false,
  })
}

export default function EstoquePage() {
  useEffect(() => { document.title = 'Vizor WMS - Estoque' }, [])

  const { data, isLoading, refetch } = useWmsQuery<any>('/estoque/saldos?limit=50')
  const saldos = data?.data || data || []

  if (isLoading) return <Center h={300}><Loader /></Center>

  const totalProdutos = Array.isArray(saldos) ? saldos.length : 0

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <div>
          <Text size="xs" c="dimmed" mb={4}>WMS / Estoque</Text>
          <Text size="xl" fw={600}>Consulta de Saldos</Text>
        </div>
        <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2 }} mb="lg">
        <Card withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Produtos com Saldo</Text>
              <Text size="xl" fw={700} c="green">{totalProdutos}</Text>
            </div>
            <ThemeIcon color="green" variant="light" size={40} radius="md"><IconBuildingWarehouse size={20} /></ThemeIcon>
          </Group>
        </Card>
      </SimpleGrid>

      <Card>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Código</Table.Th>
              <Table.Th>Produto</Table.Th>
              <Table.Th>Quantidade</Table.Th>
              <Table.Th>Reservado</Table.Th>
              <Table.Th>Disponível</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(Array.isArray(saldos) ? saldos : []).map((s: any, i: number) => (
              <Table.Tr key={s.id || i}>
                <Table.Td className="font-mono">{s.produto?.codigo || s.codigo || '—'}</Table.Td>
                <Table.Td>{s.produto?.nome || s.nome || '—'}</Table.Td>
                <Table.Td fw={600}>{Number(s.quantidade || 0).toLocaleString('pt-BR')}</Table.Td>
                <Table.Td>{Number(s.reservado || 0).toLocaleString('pt-BR')}</Table.Td>
                <Table.Td c="green" fw={600}>{Number((s.quantidade || 0) - (s.reservado || 0)).toLocaleString('pt-BR')}</Table.Td>
              </Table.Tr>
            ))}
            {totalProdutos === 0 && (
              <Table.Tr><Table.Td colSpan={5} className="text-center py-8 text-zinc-500">Nenhum saldo encontrado</Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </div>
  )
}
