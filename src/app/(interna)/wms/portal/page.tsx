'use client'

import { useEffect } from 'react'
import { Card, Group, Text, SimpleGrid, ThemeIcon, Table, Badge, Button, LoadingOverlay } from '@mantine/core'
import {
  IconUsers, IconClipboardList, IconBell, IconExternalLink,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import Link from 'next/link'

export default function PortalAdminPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Portal 3PL' }, [])

  const { data: dashboard, isLoading } = useQuery<any>({
    queryKey: ['portal-dashboard'],
    queryFn: async () => { const { data } = await api.get('/portal/admin/dashboard'); return data },
  })

  const stats = dashboard || {}
  const ultimasSolicitacoes = stats.ultimasSolicitacoes || []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Portal 3PL</Text>
      <Text size="xl" fw={600} mb="lg">Portal 3PL - Administração</Text>

      <LoadingOverlay visible={isLoading} />

      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="xl">
        <Card>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Clientes no Portal</Text>
              <Text size="xl" fw={700}>{stats.totalClientes || 0}</Text>
            </div>
            <ThemeIcon color="blue" variant="light" size={48} radius="md"><IconUsers size={24} /></ThemeIcon>
          </Group>
        </Card>
        <Card>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Usuários Ativos</Text>
              <Text size="xl" fw={700} c="green">{stats.usuariosAtivos || 0}</Text>
            </div>
            <ThemeIcon color="green" variant="light" size={48} radius="md"><IconUsers size={24} /></ThemeIcon>
          </Group>
        </Card>
        <Card>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Solicitações Pendentes</Text>
              <Text size="xl" fw={700} c="orange">{stats.solicitacoesPendentes || 0}</Text>
            </div>
            <ThemeIcon color="orange" variant="light" size={48} radius="md"><IconClipboardList size={24} /></ThemeIcon>
          </Group>
        </Card>
        <Card>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Notificações Pendentes</Text>
              <Text size="xl" fw={700} c="grape">{stats.notificacoesPendentes || 0}</Text>
            </div>
            <ThemeIcon color="grape" variant="light" size={48} radius="md"><IconBell size={24} /></ThemeIcon>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Links de gestão */}
      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="xl">
        <Card withBorder className="hover:shadow-md transition-shadow">
          <Link href="/wms/portal/usuarios" className="no-underline text-inherit">
            <Group gap="sm">
              <ThemeIcon color="blue" variant="light" size={40} radius="md"><IconUsers size={20} /></ThemeIcon>
              <div>
                <Text fw={600}>Gestão de Usuários</Text>
                <Text size="xs" c="dimmed">Gerenciar usuários do portal</Text>
              </div>
              <IconExternalLink size={16} className="ml-auto text-gray-400" />
            </Group>
          </Link>
        </Card>
        <Card withBorder className="hover:shadow-md transition-shadow">
          <Link href="/wms/portal/solicitacoes" className="no-underline text-inherit">
            <Group gap="sm">
              <ThemeIcon color="orange" variant="light" size={40} radius="md"><IconClipboardList size={20} /></ThemeIcon>
              <div>
                <Text fw={600}>Solicitações</Text>
                <Text size="xs" c="dimmed">Aprovar/Rejeitar pedidos</Text>
              </div>
              <IconExternalLink size={16} className="ml-auto text-gray-400" />
            </Group>
          </Link>
        </Card>
        <Card withBorder className="hover:shadow-md transition-shadow">
          <Link href="/wms/portal/notificacoes" className="no-underline text-inherit">
            <Group gap="sm">
              <ThemeIcon color="grape" variant="light" size={40} radius="md"><IconBell size={20} /></ThemeIcon>
              <div>
                <Text fw={600}>Notificações</Text>
                <Text size="xs" c="dimmed">Gerenciar notificações enviadas</Text>
              </div>
              <IconExternalLink size={16} className="ml-auto text-gray-400" />
            </Group>
          </Link>
        </Card>
      </SimpleGrid>

      {/* Últimas solicitações */}
      <Text fw={600} mb="sm">Últimas Solicitações</Text>
      <Card>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Número</Table.Th>
              <Table.Th>Cliente</Table.Th>
              <Table.Th>Itens</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Data</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {ultimasSolicitacoes.map((s: any) => (
              <Table.Tr key={s.id}>
                <Table.Td className="font-mono">#{s.numero}</Table.Td>
                <Table.Td>{s.cliente?.nome || '—'}</Table.Td>
                <Table.Td>{s.totalItens || 0}</Table.Td>
                <Table.Td>
                  <Badge color={s.status === 'PENDENTE' ? 'orange' : s.status === 'APROVADA' ? 'green' : 'red'} variant="light">
                    {s.status}
                  </Badge>
                </Table.Td>
                <Table.Td>{s.createdAt ? new Date(s.createdAt).toLocaleDateString('pt-BR') : '—'}</Table.Td>
              </Table.Tr>
            ))}
            {ultimasSolicitacoes.length === 0 && (
              <Table.Tr><Table.Td colSpan={5} className="text-center py-8 text-zinc-500">Nenhuma solicitação recente</Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </div>
  )
}
