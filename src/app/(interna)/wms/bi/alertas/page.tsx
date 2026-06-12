'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, Select, LoadingOverlay,
} from '@mantine/core'
import { IconCheck } from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { notifications } from '@mantine/notifications'

const TIPO_COLORS: Record<string, string> = {
  CORRELACAO: 'grape',
  ANOMALIA: 'red',
}

const SEVERIDADE_COLORS: Record<string, string> = {
  BAIXA: 'blue',
  MEDIA: 'yellow',
  ALTA: 'orange',
  CRITICA: 'red',
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'ABERTO', label: 'Aberto' },
  { value: 'RESOLVIDO', label: 'Resolvido' },
]

export default function BiAlertasPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Alertas Inteligentes' }, [])

  const queryClient = useQueryClient()
  const [statusFiltro, setStatusFiltro] = useState('')

  const { data: resp, isLoading } = useQuery<any>({
    queryKey: ['bi-alertas', statusFiltro],
    queryFn: async () => {
      const params: any = {}
      if (statusFiltro) params.status = statusFiltro
      const { data } = await api.get('/bi/alertas', { params })
      return data
    },
  })

  const resolver = useMutation({
    mutationFn: async (id: string) => {
      await api.post(`/bi/alertas/${id}/resolver`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bi-alertas'] })
      notifications.show({ title: 'Sucesso', message: 'Alerta resolvido', color: 'green' })
    },
    onError: () => {
      notifications.show({ title: 'Erro', message: 'Falha ao resolver alerta', color: 'red' })
    },
  })

  const alertas = resp?.data || resp || []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / BI Avançado / Alertas</Text>
      <Text size="xl" fw={600} mb="lg">Alertas Inteligentes</Text>

      <Card withBorder mb="md">
        <Group>
          <Select
            label="Status"
            data={STATUS_OPTIONS}
            value={statusFiltro}
            onChange={(v) => setStatusFiltro(v || '')}
            w={200}
            clearable
          />
        </Group>
      </Card>

      <Card withBorder pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Mensagem</Table.Th>
              <Table.Th>Severidade</Table.Th>
              <Table.Th>Data</Table.Th>
              <Table.Th>Ação</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(Array.isArray(alertas) ? alertas : []).map((alerta: any) => (
              <Table.Tr key={alerta.id}>
                <Table.Td>
                  <Badge color={TIPO_COLORS[alerta.tipo] || 'gray'} variant="filled">
                    {alerta.tipo}
                  </Badge>
                </Table.Td>
                <Table.Td maw={400}>{alerta.mensagem}</Table.Td>
                <Table.Td>
                  <Badge color={SEVERIDADE_COLORS[alerta.severidade] || 'gray'} variant="light">
                    {alerta.severidade}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {alerta.criadoEm
                    ? new Date(alerta.criadoEm).toLocaleDateString('pt-BR', {
                        day: '2-digit', month: '2-digit', year: '2-digit',
                        hour: '2-digit', minute: '2-digit',
                      })
                    : '—'}
                </Table.Td>
                <Table.Td>
                  {alerta.status === 'ABERTO' ? (
                    <Button
                      size="xs"
                      variant="light"
                      color="green"
                      leftSection={<IconCheck size={14} />}
                      onClick={() => resolver.mutate(alerta.id)}
                      loading={resolver.isPending}
                    >
                      Resolver
                    </Button>
                  ) : (
                    <Badge variant="light" color="green">Resolvido</Badge>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
            {(!Array.isArray(alertas) || alertas.length === 0) && !isLoading && (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed" ta="center" py="sm">Nenhum alerta encontrado</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </div>
  )
}
