'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, LoadingOverlay, Modal, SimpleGrid,
} from '@mantine/core'
import { IconCalendar } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const statusColors: Record<string, string> = {
  SIMULADO: 'yellow', CONFIRMADO: 'green', EM_ANDAMENTO: 'blue', CONCLUIDO: 'teal', CANCELADO: 'red',
}

export default function WavePlanejamentosPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Wave Planejamentos' }, [])

  const [detalhes, setDetalhes] = useState<any>(null)

  const { data: response, isLoading } = useQuery<any>({
    queryKey: ['wave-planejamentos'],
    queryFn: async () => { const { data } = await api.get('/wave/planejamentos'); return data },
  })

  const { data: detalheResponse } = useQuery<any>({
    queryKey: ['wave-planejamento-detalhe', detalhes?.id],
    queryFn: async () => {
      if (!detalhes?.id) return null
      const { data } = await api.get(`/wave/planejamentos/${detalhes.id}`)
      return data
    },
    enabled: !!detalhes?.id,
  })

  const planejamentos = response?.data || []
  const detalheData = detalheResponse || detalhes

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Wave Planning / Planejamentos</Text>
      <Text size="xl" fw={600} mb="lg">Planejamentos de Onda</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Data</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Ondas</Table.Th>
              <Table.Th>Pedidos</Table.Th>
              <Table.Th>Itens</Table.Th>
              <Table.Th>Confirmado por</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {planejamentos.map((p: any) => (
              <Table.Tr key={p.id} className="cursor-pointer" onClick={() => setDetalhes(p)}>
                <Table.Td>
                  <Group gap="xs">
                    <IconCalendar size={14} className="text-gray-400" />
                    <Text size="sm" fw={500}>
                      {p.data ? new Date(p.data).toLocaleDateString('pt-BR') : '—'}
                    </Text>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Badge color={statusColors[p.status] || 'gray'} variant="light">{p.status}</Badge>
                </Table.Td>
                <Table.Td fw={500}>{p.totalOndas || 0}</Table.Td>
                <Table.Td>{p.totalPedidos || 0}</Table.Td>
                <Table.Td>{p.totalItens || 0}</Table.Td>
                <Table.Td>{p.confirmadoPor || '—'}</Table.Td>
              </Table.Tr>
            ))}
            {planejamentos.length === 0 && (
              <Table.Tr><Table.Td colSpan={6} className="text-center py-8 text-zinc-500">Nenhum planejamento encontrado</Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      {/* Modal Detalhes */}
      <Modal opened={!!detalhes} onClose={() => setDetalhes(null)} title="Detalhes do Planejamento" size="lg" centered>
        {detalheData && (
          <>
            <SimpleGrid cols={3} mb="md">
              <div>
                <Text size="xs" c="dimmed">Data</Text>
                <Text fw={500}>{detalheData.data ? new Date(detalheData.data).toLocaleDateString('pt-BR') : '—'}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">Status</Text>
                <Badge color={statusColors[detalheData.status] || 'gray'} variant="light">{detalheData.status}</Badge>
              </div>
              <div>
                <Text size="xs" c="dimmed">Confirmado por</Text>
                <Text fw={500}>{detalheData.confirmadoPor || '—'}</Text>
              </div>
            </SimpleGrid>

            <Text fw={600} mb="sm">Ondas ({detalheData.ondas?.length || detalheData.totalOndas || 0})</Text>
            <Table striped withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Onda</Table.Th>
                  <Table.Th>Doca</Table.Th>
                  <Table.Th>Rota</Table.Th>
                  <Table.Th>Pedidos</Table.Th>
                  <Table.Th>Itens</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(detalheData.ondas || []).map((onda: any) => (
                  <Table.Tr key={onda.id || onda.numero}>
                    <Table.Td fw={500}>#{onda.numero}</Table.Td>
                    <Table.Td>{onda.doca || '—'}</Table.Td>
                    <Table.Td>{onda.rota || '—'}</Table.Td>
                    <Table.Td>{onda.pedidos || 0}</Table.Td>
                    <Table.Td>{onda.itens || 0}</Table.Td>
                    <Table.Td>
                      <Badge color={statusColors[onda.status] || 'gray'} variant="light" size="sm">{onda.status}</Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {(!detalheData.ondas || detalheData.ondas.length === 0) && (
                  <Table.Tr><Table.Td colSpan={6} className="text-center py-4 text-zinc-500">Ondas não disponíveis</Table.Td></Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </>
        )}
      </Modal>
    </div>
  )
}
