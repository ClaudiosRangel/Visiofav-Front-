'use client'

import { useEffect } from 'react'
import { Card, Group, Text, SimpleGrid, ThemeIcon, Table, Badge, LoadingOverlay } from '@mantine/core'
import {
  IconPackage, IconReceipt, IconClipboardList, IconBell,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { portalApi } from '@/lib/portalApi'

export default function PortalDashboardPage() {
  useEffect(() => { document.title = 'Portal 3PL - Dashboard' }, [])

  const { data: dashboard, isLoading } = useQuery<any>({
    queryKey: ['portal-meu-dashboard'],
    queryFn: async () => { const { data } = await portalApi.get('/portal/dashboard'); return data },
  })

  const stats = dashboard || {}
  const notificacoes = stats.ultimasNotificacoes || []

  return (
    <div>
      <Text size="xl" fw={600} mb="lg">Meu Painel</Text>

      <LoadingOverlay visible={isLoading} />

      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="xl">
        <Card>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Estoque Total</Text>
              <Text size="xl" fw={700}>{stats.estoqueTotal || 0}</Text>
              <Text size="xs" c="dimmed">itens</Text>
            </div>
            <ThemeIcon color="blue" variant="light" size={48} radius="md"><IconPackage size={24} /></ThemeIcon>
          </Group>
        </Card>
        <Card>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Faturas Pendentes</Text>
              <Text size="xl" fw={700} c="orange">{stats.faturasPendentes || 0}</Text>
            </div>
            <ThemeIcon color="orange" variant="light" size={48} radius="md"><IconReceipt size={24} /></ThemeIcon>
          </Group>
        </Card>
        <Card>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Solicitações Ativas</Text>
              <Text size="xl" fw={700} c="green">{stats.solicitacoesAtivas || 0}</Text>
            </div>
            <ThemeIcon color="green" variant="light" size={48} radius="md"><IconClipboardList size={24} /></ThemeIcon>
          </Group>
        </Card>
        <Card>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Notificações</Text>
              <Text size="xl" fw={700} c="grape">{stats.notificacoesNaoLidas || 0}</Text>
              <Text size="xs" c="dimmed">não lidas</Text>
            </div>
            <ThemeIcon color="grape" variant="light" size={48} radius="md"><IconBell size={24} /></ThemeIcon>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Últimas Notificações */}
      <Text fw={600} mb="sm">Últimas Notificações</Text>
      <Card>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Título</Table.Th>
              <Table.Th>Data</Table.Th>
              <Table.Th>Lida</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {notificacoes.map((n: any) => (
              <Table.Tr key={n.id}>
                <Table.Td>
                  <Badge variant="light" color={n.tipo === 'ALERTA' ? 'red' : n.tipo === 'EXPEDICAO' ? 'orange' : 'blue'}>
                    {n.tipo}
                  </Badge>
                </Table.Td>
                <Table.Td fw={500}>{n.titulo}</Table.Td>
                <Table.Td>{n.createdAt ? new Date(n.createdAt).toLocaleString('pt-BR') : '—'}</Table.Td>
                <Table.Td>
                  <Badge color={n.lida ? 'green' : 'gray'} variant="light" size="sm">
                    {n.lida ? 'Sim' : 'Não'}
                  </Badge>
                </Table.Td>
              </Table.Tr>
            ))}
            {notificacoes.length === 0 && (
              <Table.Tr><Table.Td colSpan={4} className="text-center py-8 text-zinc-500">Nenhuma notificação</Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </div>
  )
}
