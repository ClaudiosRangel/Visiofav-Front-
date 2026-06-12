'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, Select, LoadingOverlay,
  ActionIcon, Tooltip,
} from '@mantine/core'
import { IconRefresh, IconCheck, IconX } from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { notifications } from '@mantine/notifications'

const PRIORIDADE_COLORS: Record<string, string> = {
  ALTA: 'red',
  MEDIA: 'yellow',
  BAIXA: 'blue',
}

const STATUS_OPTIONS = [
  { value: '', label: 'Todos' },
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'APLICADO', label: 'Aplicado' },
  { value: 'REJEITADO', label: 'Rejeitado' },
]

const PRIORIDADE_OPTIONS = [
  { value: '', label: 'Todas' },
  { value: 'ALTA', label: 'Alta' },
  { value: 'MEDIA', label: 'Média' },
  { value: 'BAIXA', label: 'Baixa' },
]

export default function SlottingSugestoesPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Sugestões de Slotting' }, [])

  const queryClient = useQueryClient()
  const [statusFiltro, setStatusFiltro] = useState('')
  const [prioridadeFiltro, setPrioridadeFiltro] = useState('')

  const { data: resp, isLoading } = useQuery<any>({
    queryKey: ['demanda-slotting', statusFiltro, prioridadeFiltro],
    queryFn: async () => {
      const params: any = {}
      if (statusFiltro) params.status = statusFiltro
      if (prioridadeFiltro) params.prioridade = prioridadeFiltro
      const { data } = await api.get('/demanda/slotting/sugestoes', { params })
      return data
    },
  })

  const gerarSugestoes = useMutation({
    mutationFn: async () => { await api.post('/demanda/slotting/gerar') },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demanda-slotting'] })
      notifications.show({ title: 'Sucesso', message: 'Sugestões geradas com sucesso', color: 'green' })
    },
    onError: () => {
      notifications.show({ title: 'Erro', message: 'Falha ao gerar sugestões', color: 'red' })
    },
  })

  const aplicar = useMutation({
    mutationFn: async (id: string) => { await api.post(`/demanda/slotting/sugestoes/${id}/aplicar`) },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demanda-slotting'] })
      notifications.show({ title: 'Sucesso', message: 'Sugestão aplicada', color: 'green' })
    },
    onError: () => {
      notifications.show({ title: 'Erro', message: 'Falha ao aplicar sugestão', color: 'red' })
    },
  })

  const rejeitar = useMutation({
    mutationFn: async (id: string) => { await api.post(`/demanda/slotting/sugestoes/${id}/rejeitar`) },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demanda-slotting'] })
      notifications.show({ title: 'Rejeitado', message: 'Sugestão rejeitada', color: 'orange' })
    },
    onError: () => {
      notifications.show({ title: 'Erro', message: 'Falha ao rejeitar sugestão', color: 'red' })
    },
  })

  const items = resp?.data || resp || []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Demanda / Sugestões de Slotting</Text>

      <Group justify="space-between" mb="lg">
        <Text size="xl" fw={600}>Sugestões de Slotting</Text>
        <Button
          leftSection={<IconRefresh size={16} />}
          loading={gerarSugestoes.isPending}
          onClick={() => gerarSugestoes.mutate()}
        >
          Gerar Sugestões
        </Button>
      </Group>

      <Card withBorder mb="md">
        <Group>
          <Select
            label="Status"
            data={STATUS_OPTIONS}
            value={statusFiltro}
            onChange={(v) => setStatusFiltro(v || '')}
            w={180}
            clearable
          />
          <Select
            label="Prioridade"
            data={PRIORIDADE_OPTIONS}
            value={prioridadeFiltro}
            onChange={(v) => setPrioridadeFiltro(v || '')}
            w={180}
            clearable
          />
        </Group>
      </Card>

      <Card withBorder pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Produto</Table.Th>
              <Table.Th>Endereço Atual</Table.Th>
              <Table.Th>Endereço Sugerido</Table.Th>
              <Table.Th>Score</Table.Th>
              <Table.Th>Prioridade</Table.Th>
              <Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td>{item.produtoNome || item.sku}</Table.Td>
                <Table.Td>{item.enderecoAtual}</Table.Td>
                <Table.Td fw={500} c="blue">{item.enderecoSugerido}</Table.Td>
                <Table.Td>{item.score?.toFixed(2)}</Table.Td>
                <Table.Td>
                  <Badge color={PRIORIDADE_COLORS[item.prioridade] || 'gray'} variant="light">
                    {item.prioridade}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {item.status === 'PENDENTE' ? (
                    <Group gap={4}>
                      <Tooltip label="Aplicar">
                        <ActionIcon
                          color="green"
                          variant="light"
                          onClick={() => aplicar.mutate(item.id)}
                          loading={aplicar.isPending}
                        >
                          <IconCheck size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Rejeitar">
                        <ActionIcon
                          color="red"
                          variant="light"
                          onClick={() => rejeitar.mutate(item.id)}
                          loading={rejeitar.isPending}
                        >
                          <IconX size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  ) : (
                    <Badge variant="light" color={item.status === 'APLICADO' ? 'green' : 'gray'}>
                      {item.status}
                    </Badge>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
            {items.length === 0 && !isLoading && (
              <Table.Tr>
                <Table.Td colSpan={6}>
                  <Text c="dimmed" ta="center" py="sm">Nenhuma sugestão encontrada</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </div>
  )
}
