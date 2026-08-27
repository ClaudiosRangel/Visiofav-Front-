'use client'

import { useEffect, useState } from 'react'
import { Card, Group, Text, Table, Badge, Button, SimpleGrid, ThemeIcon, Loader, Center } from '@mantine/core'
import { IconTruckDelivery, IconRefresh } from '@tabler/icons-react'
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

const statusCores: Record<string, string> = {
  PENDENTE: 'orange', CONFERIDA: 'blue', ENDERECADA: 'green', CANCELADA: 'red',
}

export default function RecebimentoPage() {
  useEffect(() => { document.title = 'Vizor WMS - Recebimento' }, [])

  const { data, isLoading, refetch } = useWmsQuery<any>('/notas-entrada?limit=30')
  const notas = data?.data || []

  if (isLoading) return <Center h={300}><Loader /></Center>

  const pendentes = notas.filter((n: any) => n.status === 'PENDENTE').length
  const conferidas = notas.filter((n: any) => n.status === 'CONFERIDA').length

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <div>
          <Text size="xs" c="dimmed" mb={4}>WMS / Recebimento</Text>
          <Text size="xl" fw={600}>Notas de Entrada</Text>
        </div>
        <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="lg">
        <Card withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Pendentes</Text>
              <Text size="xl" fw={700} c="orange">{pendentes}</Text>
            </div>
            <ThemeIcon color="orange" variant="light" size={40} radius="md"><IconTruckDelivery size={20} /></ThemeIcon>
          </Group>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Conferidas</Text>
          <Text size="xl" fw={700} c="blue">{conferidas}</Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Total</Text>
          <Text size="xl" fw={700}>{notas.length}</Text>
        </Card>
      </SimpleGrid>

      <Card>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>#</Table.Th>
              <Table.Th>Fornecedor</Table.Th>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Itens</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Data</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {notas.map((nota: any) => (
              <Table.Tr key={nota.id}>
                <Table.Td fw={600}>{nota.numero}</Table.Td>
                <Table.Td>{nota.fornecedor || '—'}</Table.Td>
                <Table.Td><Badge variant="light" size="sm">{nota.tipo}</Badge></Table.Td>
                <Table.Td>{nota.itens?.length || 0}</Table.Td>
                <Table.Td><Badge color={statusCores[nota.status] || 'gray'}>{nota.status}</Badge></Table.Td>
                <Table.Td>{new Date(nota.criadoEm).toLocaleDateString('pt-BR')}</Table.Td>
              </Table.Tr>
            ))}
            {notas.length === 0 && (
              <Table.Tr><Table.Td colSpan={6} className="text-center py-8 text-zinc-500">Nenhuma nota de entrada</Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </div>
  )
}
