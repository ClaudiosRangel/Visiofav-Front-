'use client'

import { useState, useEffect } from 'react'
import { Card, Group, Text, Table, Badge, LoadingOverlay, Select } from '@mantine/core'
import { IconFilter, IconBell, IconCheck } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const tipoColors: Record<string, string> = {
  ESTOQUE: 'blue', FATURA: 'green', EXPEDICAO: 'orange', SISTEMA: 'gray', ALERTA: 'red',
}

export default function PortalNotificacoesPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Portal Notificações' }, [])

  const [filtroTipo, setFiltroTipo] = useState<string | null>(null)

  const { data: response, isLoading } = useQuery<any>({
    queryKey: ['portal-notificacoes', filtroTipo],
    queryFn: async () => {
      const params = filtroTipo ? { tipo: filtroTipo } : {}
      const { data } = await api.get('/portal/admin/notificacoes', { params })
      return data
    },
  })

  const notificacoes = response?.data || []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Portal 3PL / Notificações</Text>
      <Text size="xl" fw={600} mb="lg">Notificações Enviadas</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />

        <Group justify="space-between" mb="md">
          <Group>
            <IconFilter size={16} className="text-gray-400" />
            <Select
              placeholder="Filtrar por tipo"
              data={[
                { value: 'ESTOQUE', label: 'Estoque' },
                { value: 'FATURA', label: 'Fatura' },
                { value: 'EXPEDICAO', label: 'Expedição' },
                { value: 'SISTEMA', label: 'Sistema' },
                { value: 'ALERTA', label: 'Alerta' },
              ]}
              value={filtroTipo}
              onChange={setFiltroTipo}
              clearable
              className="w-48"
            />
          </Group>
          <Text size="sm" c="dimmed">{notificacoes.length} notificação(ões)</Text>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Cliente</Table.Th>
              <Table.Th>Título</Table.Th>
              <Table.Th>Lida</Table.Th>
              <Table.Th>Data</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {notificacoes.map((n: any) => (
              <Table.Tr key={n.id}>
                <Table.Td>
                  <Badge color={tipoColors[n.tipo] || 'gray'} variant="light">{n.tipo}</Badge>
                </Table.Td>
                <Table.Td>{n.cliente?.nome || '—'}</Table.Td>
                <Table.Td fw={500}>{n.titulo}</Table.Td>
                <Table.Td>
                  {n.lida ? (
                    <Badge color="green" variant="light" leftSection={<IconCheck size={12} />}>Sim</Badge>
                  ) : (
                    <Badge color="gray" variant="light">Não</Badge>
                  )}
                </Table.Td>
                <Table.Td>{n.createdAt ? new Date(n.createdAt).toLocaleString('pt-BR') : '—'}</Table.Td>
              </Table.Tr>
            ))}
            {notificacoes.length === 0 && (
              <Table.Tr><Table.Td colSpan={5} className="text-center py-8 text-zinc-500">Nenhuma notificação encontrada</Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </div>
  )
}
