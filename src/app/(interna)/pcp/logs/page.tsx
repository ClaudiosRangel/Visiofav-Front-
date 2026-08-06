'use client'

import { useState, useEffect } from 'react'
import { Card, Table, Text, Group, Badge, Pagination, Stack, Loader, Center } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { usePerfilGuard } from '@/hooks/usePerfilGuard'

const STATUS_COLORS: Record<string, string> = {
  RASCUNHO: 'gray',
  PLANEJADA: 'blue',
  PROGRAMADA: 'cyan',
  LIBERADA: 'teal',
  EM_PRODUCAO: 'yellow',
  CONCLUIDA: 'green',
  CANCELADA: 'red',
  PENDENTE: 'gray',
  EM_ANDAMENTO: 'yellow',
  PAUSADA: 'orange',
}

export default function PcpLogsPage() {
  usePerfilGuard(['ADMIN', 'SUPER_ADMIN'])
  useEffect(() => { document.title = 'PCP - Logs de Auditoria' }, [])

  const [page, setPage] = useState(1)

  const { data: response, isLoading } = useQuery<any>({
    queryKey: ['pcp-logs', page],
    queryFn: async () => {
      const { data } = await api.get('/pcp/logs', { params: { page, limit: 30 } })
      return data
    },
  })

  const logs = response?.data || []
  const totalPages = response?.totalPages || 1

  if (isLoading) return <Center py="xl"><Loader /></Center>

  return (
    <Stack gap="md">
      <Text size="xs" c="dimmed">PCP / Logs de Auditoria</Text>
      <Text size="xl" fw={600}>Logs de Auditoria — PCP</Text>
      <Text size="sm" c="dimmed">Histórico de todas as transições de status das Ordens de Produção</Text>

      <Card withBorder>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Data/Hora</Table.Th>
              <Table.Th>OS</Table.Th>
              <Table.Th>De</Table.Th>
              <Table.Th>Para</Table.Th>
              <Table.Th>Usuário</Table.Th>
              <Table.Th>Observação</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {logs.map((log: any) => (
              <Table.Tr key={log.id}>
                <Table.Td>
                  <Text size="xs">{new Date(log.criadoEm).toLocaleString('pt-BR')}</Text>
                </Table.Td>
                <Table.Td fw={500}>{log.opNumero}</Table.Td>
                <Table.Td>
                  <Badge size="xs" color={STATUS_COLORS[log.statusAnterior] || 'gray'} variant="light">
                    {log.statusAnterior}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge size="xs" color={STATUS_COLORS[log.statusNovo] || 'gray'} variant="light">
                    {log.statusNovo}
                  </Badge>
                </Table.Td>
                <Table.Td><Text size="xs">{log.usuario}</Text></Table.Td>
                <Table.Td><Text size="xs" c="dimmed" lineClamp={2}>{log.observacao || '—'}</Text></Table.Td>
              </Table.Tr>
            ))}
            {logs.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text ta="center" c="dimmed" py="md">Nenhum log encontrado</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>

        {totalPages > 1 && (
          <Group justify="center" mt="md">
            <Pagination total={totalPages} value={page} onChange={setPage} />
          </Group>
        )}
      </Card>
    </Stack>
  )
}
