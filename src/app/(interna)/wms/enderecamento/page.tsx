'use client'

import { useEffect } from 'react'
import { Card, Group, Text, Table, Badge, Button, Tabs, LoadingOverlay } from '@mantine/core'
import { IconMapPin, IconCheck, IconRefresh, IconArrowRight } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const statusColors: Record<string, string> = {
  CONFERIDA: 'green', ENDERECADA: 'teal', PENDENTE: 'orange', EM_CONFERENCIA: 'blue',
}

export default function EnderecamentoPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - Endereçamento' }, [])
  const queryClient = useQueryClient()

  // Notas conferidas (prontas para endereçar)
  const { data: conferidasResp, isLoading: loadConf, refetch: refetchConf } = useQuery<any>({
    queryKey: ['enderecamento-conferidas'],
    queryFn: async () => { const { data } = await api.get('/conferencia-entrada/notas-conferidas'); return data },
  })

  // Notas endereçadas
  const { data: enderecadasResp, isLoading: loadEnd, refetch: refetchEnd } = useQuery<any>({
    queryKey: ['enderecamento-enderecadas'],
    queryFn: async () => {
      const { data } = await api.get('/conferencia-entrada/notas-pendentes')
      // Filtrar apenas as ENDERECADAS (buscar via endpoint de notas)
      return data
    },
  })

  // Buscar notas endereçadas separadamente
  const { data: notasEnderecadasResp } = useQuery<any>({
    queryKey: ['notas-enderecadas'],
    queryFn: async () => {
      // Buscar notas com status ENDERECADA
      const { data } = await api.get('/notas-entrada', { params: { status: 'ENDERECADA', limit: 50 } }).catch(() => ({ data: { data: [] } }))
      return data
    },
  })

  // Endereçamento automático
  const enderecarAuto = useMutation({
    mutationFn: async (notaId: string) => { const { data } = await api.post(`/conferencia-entrada/enderecamento-automatico/${notaId}`); return data },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['enderecamento-conferidas'] })
      queryClient.invalidateQueries({ queryKey: ['notas-enderecadas'] })
      notifications.show({ title: '✅ Endereçamento concluído', message: `${data.itens?.length || 0} itens endereçados`, color: 'green' })
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) },
  })

  const conferidas = conferidasResp?.data || []
  const enderecadas = notasEnderecadasResp?.data || []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Endereçamento</Text>
      <Text size="xl" fw={600} mb="lg">Endereçamento</Text>

      <Card>
        <Tabs defaultValue="enderecar">
          <Tabs.List mb="md">
            <Tabs.Tab value="enderecar" leftSection={<IconMapPin size={16} />}>
              Endereçar ({conferidas.length})
            </Tabs.Tab>
            <Tabs.Tab value="enderecadas" leftSection={<IconCheck size={16} />}>
              Endereçadas ({enderecadas.length})
            </Tabs.Tab>
          </Tabs.List>

          {/* ABA ENDEREÇAR */}
          <Tabs.Panel value="enderecar">
            <LoadingOverlay visible={loadConf} />
            <Group justify="space-between" mb="sm">
              <Text fw={500}>Notas conferidas prontas para endereçamento</Text>
              <Button variant="default" size="xs" leftSection={<IconRefresh size={14} />} onClick={() => refetchConf()}>Atualizar</Button>
            </Group>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>NF</Table.Th><Table.Th>Fornecedor</Table.Th><Table.Th>Itens</Table.Th><Table.Th>Status</Table.Th><Table.Th>Ações</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {conferidas.map((nota: any) => (
                  <Table.Tr key={nota.id}>
                    <Table.Td fw={500}>{nota.numero}</Table.Td>
                    <Table.Td>{nota.fornecedor || '—'}</Table.Td>
                    <Table.Td>{nota.itens?.length || 0}</Table.Td>
                    <Table.Td><Badge color="green" variant="light">CONFERIDA</Badge></Table.Td>
                    <Table.Td>
                      <Button size="xs" variant="light" color="teal" leftSection={<IconArrowRight size={14} />}
                        onClick={() => enderecarAuto.mutate(nota.id)} loading={enderecarAuto.isPending}>
                        Endereçar Automático
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {conferidas.length === 0 && (
                  <Table.Tr><Table.Td colSpan={5} className="text-center py-8 text-zinc-500">Nenhuma nota aguardando endereçamento</Table.Td></Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Tabs.Panel>

          {/* ABA ENDEREÇADAS */}
          <Tabs.Panel value="enderecadas">
            <LoadingOverlay visible={loadEnd} />
            <Group justify="space-between" mb="sm">
              <Text fw={500}>Notas já endereçadas</Text>
              <Button variant="default" size="xs" leftSection={<IconRefresh size={14} />} onClick={() => refetchEnd()}>Atualizar</Button>
            </Group>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>NF</Table.Th><Table.Th>Fornecedor</Table.Th><Table.Th>Itens</Table.Th><Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {enderecadas.map((nota: any) => (
                  <Table.Tr key={nota.id}>
                    <Table.Td fw={500}>{nota.numero}</Table.Td>
                    <Table.Td>{nota.fornecedor || '—'}</Table.Td>
                    <Table.Td>{nota.itens?.length || 0}</Table.Td>
                    <Table.Td><Badge color="teal" variant="light">ENDEREÇADA</Badge></Table.Td>
                  </Table.Tr>
                ))}
                {enderecadas.length === 0 && (
                  <Table.Tr><Table.Td colSpan={4} className="text-center py-8 text-zinc-500">Nenhuma nota endereçada</Table.Td></Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Tabs.Panel>
        </Tabs>
      </Card>
    </div>
  )
}
