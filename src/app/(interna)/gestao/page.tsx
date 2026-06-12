'use client'

import { useEffect } from 'react'
import { Card, Group, Text, SimpleGrid, Badge, ThemeIcon, Table, Button, LoadingOverlay } from '@mantine/core'
import { IconCalendar, IconTruck, IconUsers, IconDoor, IconRefresh } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const statusColor: Record<string, string> = {
  AGENDADO: 'blue', CONFIRMADO: 'cyan', ESPERA: 'orange', NA_DOCA: 'grape',
  CONFERINDO: 'yellow', CONFERIDO: 'teal', RECEBIDO: 'green', CANCELADO: 'red',
}

export default function GestaoPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - Gestão' }, [])

  const dataStr = new Date().toISOString().split('T')[0]

  const { data: agendaResp, isLoading: loadAgenda, refetch: refetchAgenda } = useQuery<any>({
    queryKey: ['gestao-agenda', dataStr],
    queryFn: async () => { const { data } = await api.get('/agenda-wms', { params: { data: dataStr, limit: 50 } }); return data },
    refetchInterval: 30000,
  })

  const { data: portariaResp, isLoading: loadPortaria } = useQuery<any>({
    queryKey: ['gestao-portaria'],
    queryFn: async () => { const { data } = await api.get('/portaria/agendamentos-hoje'); return data },
    refetchInterval: 15000,
  })

  const { data: funcResp } = useQuery<any>({
    queryKey: ['gestao-funcionarios'],
    queryFn: async () => { const { data } = await api.get('/funcionarios', { params: { limit: 100 } }); return data },
  })

  const { data: docasResp } = useQuery<any>({
    queryKey: ['gestao-docas'],
    queryFn: async () => { const { data } = await api.get('/docas', { params: { limit: 50 } }); return data },
  })

  const agendamentos = agendaResp?.data || []
  const portariaItems = portariaResp?.data || []
  const funcionarios = funcResp?.data || []
  const docas = docasResp?.data || []

  const agendadosHoje = agendamentos.length
  const veiculosNaDoca = portariaItems.filter((i: any) => ['NA_DOCA', 'CONFERINDO'].includes(i.status)).length
  const funcPresentes = funcionarios.filter((f: any) => f.presente).length
  const docasOcupadas = portariaItems.filter((i: any) => ['NA_DOCA', 'CONFERINDO', 'CONFERIDO'].includes(i.status)).length

  const stats = [
    { title: 'Agendamentos Hoje', value: String(agendadosHoje), icon: IconCalendar, color: 'blue' },
    { title: 'Veículos na Doca', value: String(veiculosNaDoca), icon: IconTruck, color: 'orange' },
    { title: 'Funcionários Presentes', value: `${funcPresentes} / ${funcionarios.length}`, icon: IconUsers, color: 'green' },
    { title: 'Docas Ocupadas', value: `${docasOcupadas} / ${docas.length}`, icon: IconDoor, color: 'grape' },
  ]

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Gestão</Text>
      <Group justify="space-between" mb="lg">
        <Text size="xl" fw={600}>Gestão Operacional</Text>
        <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetchAgenda()}>Atualizar</Button>
      </Group>

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

      <SimpleGrid cols={{ base: 1, lg: 2 }} mb="xl">
        <Card pos="relative">
          <LoadingOverlay visible={loadAgenda} />
          <Group justify="space-between" mb="md">
            <Text fw={600}>Agendamento de Docas (Hoje)</Text>
            <Badge variant="light">{agendamentos.length} agendamento(s)</Badge>
          </Group>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Doca</Table.Th><Table.Th>Fornecedor</Table.Th>
                <Table.Th>Horário</Table.Th><Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {agendamentos.slice(0, 10).map((item: any) => (
                <Table.Tr key={item.id}>
                  <Table.Td fw={500}>{item.doca?.descricao || '—'}</Table.Td>
                  <Table.Td>{item.fornecedor?.nomeFantasia || item.fornecedor?.razaoSocial || '—'}</Table.Td>
                  <Table.Td>{item.horaInicio || '—'} - {item.horaFim || '—'}</Table.Td>
                  <Table.Td><Badge color={statusColor[item.status] || 'gray'} variant="light">{item.status}</Badge></Table.Td>
                </Table.Tr>
              ))}
              {agendamentos.length === 0 && (
                <Table.Tr><Table.Td colSpan={4} className="text-center py-6 text-zinc-500">Nenhum agendamento hoje</Table.Td></Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Card>

        <Card pos="relative">
          <LoadingOverlay visible={loadPortaria} />
          <Group justify="space-between" mb="md">
            <Text fw={600}>Controle de Portaria</Text>
            <Badge variant="light">{portariaItems.length} veículo(s)</Badge>
          </Group>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Placa</Table.Th><Table.Th>Motorista</Table.Th>
                <Table.Th>Doca</Table.Th><Table.Th>Status</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {portariaItems.slice(0, 10).map((item: any) => (
                <Table.Tr key={item.id}>
                  <Table.Td fw={500} className="font-mono">{item.placa || '—'}</Table.Td>
                  <Table.Td>{item.motorista || '—'}</Table.Td>
                  <Table.Td>{item.doca?.descricao || '—'}</Table.Td>
                  <Table.Td><Badge color={statusColor[item.status] || 'gray'} variant="light">{item.status}</Badge></Table.Td>
                </Table.Tr>
              ))}
              {portariaItems.length === 0 && (
                <Table.Tr><Table.Td colSpan={4} className="text-center py-6 text-zinc-500">Nenhum veículo registrado hoje</Table.Td></Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Card>
      </SimpleGrid>
    </div>
  )
}
