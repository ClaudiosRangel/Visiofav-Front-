'use client'

import { useEffect } from 'react'
import { Card, Group, Text, Table, Badge, Button, LoadingOverlay, SimpleGrid, ThemeIcon, Alert } from '@mantine/core'
import { IconRefresh, IconArrowRight, IconAlertCircle, IconCheck, IconPackage } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

export default function RessuprimentoPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - Ressuprimento' }, [])
  const queryClient = useQueryClient()

  const { data: response, isLoading, refetch } = useQuery<any>({
    queryKey: ['ressuprimento-pendentes'],
    queryFn: async () => { const { data } = await api.get('/ressuprimento/pendentes'); return data },
  })

  const executar = useMutation({
    mutationFn: async (item: any) => {
      if (!item.pulmao) throw new Error('Sem endereço de pulmão disponível')
      const qtd = Math.min(item.quantidadeRepor, item.pulmao.saldoDisponivel)
      const { data } = await api.post('/ressuprimento/executar', {
        produtoId: item.produtoId,
        enderecoOrigemId: item.pulmao.enderecoId,
        enderecoDestinoId: item.enderecoPickingId,
        quantidade: qtd,
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ressuprimento-pendentes'] })
      notifications.show({ title: '✅ Ressuprimento executado', message: 'Estoque transferido para picking', color: 'green' })
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' }) },
  })

  const pendentes = response?.data || []
  const saldoMinimo = response?.saldoMinimo || 10
  const pickingVazios = response?.pickingVazios || 0

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Ressuprimento</Text>
      <Text size="xl" fw={600} mb="lg">Ressuprimento de Picking</Text>

      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
        <Card>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Pendentes</Text>
              <Text size="xl" fw={700} c="red">{pendentes.length}</Text>
            </div>
            <ThemeIcon color="red" variant="light" size={48} radius="md"><IconAlertCircle size={24} /></ThemeIcon>
          </Group>
        </Card>
        <Card>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Picking Vazios</Text>
              <Text size="xl" fw={700} c="orange">{pickingVazios}</Text>
            </div>
            <ThemeIcon color="orange" variant="light" size={48} radius="md"><IconPackage size={24} /></ThemeIcon>
          </Group>
        </Card>
        <Card>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Saldo Mínimo</Text>
              <Text size="xl" fw={700}>{saldoMinimo}</Text>
              <Text size="xs" c="dimmed">Parâmetro WMS_PICKING_SALDO_MINIMO</Text>
            </div>
            <ThemeIcon color="blue" variant="light" size={48} radius="md"><IconCheck size={24} /></ThemeIcon>
          </Group>
        </Card>
      </SimpleGrid>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Group justify="space-between" mb="md">
          <Text fw={600}>Endereços de Picking Abaixo do Mínimo</Text>
          <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
        </Group>

        {pendentes.length === 0 && !isLoading && (
          <Alert icon={<IconCheck size={16} />} color="green" variant="light">
            Todos os endereços de picking estão com saldo acima do mínimo. Nenhum ressuprimento necessário.
          </Alert>
        )}

        {pendentes.length > 0 && (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Picking</Table.Th>
                <Table.Th>Produto</Table.Th>
                <Table.Th>Saldo Atual</Table.Th>
                <Table.Th>Mínimo</Table.Th>
                <Table.Th>Repor</Table.Th>
                <Table.Th>Pulmão</Table.Th>
                <Table.Th>Ação</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {pendentes.map((item: any, idx: number) => (
                <Table.Tr key={idx}>
                  <Table.Td className="font-mono" fw={500}>{item.enderecoPickingCompleto}</Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>{item.produto?.nome || '—'}</Text>
                    <Text size="xs" c="dimmed" className="font-mono">{item.produto?.codigo || ''}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Text fw={600} c="red">{item.saldoAtual}</Text>
                  </Table.Td>
                  <Table.Td>{item.saldoMinimo}</Table.Td>
                  <Table.Td fw={600} c="blue">{item.quantidadeRepor}</Table.Td>
                  <Table.Td>
                    {item.pulmao ? (
                      <div>
                        <Text size="sm" className="font-mono">{item.pulmao.enderecoCompleto}</Text>
                        <Text size="xs" c="dimmed">Disponível: {item.pulmao.saldoDisponivel}</Text>
                      </div>
                    ) : (
                      <Badge color="red" variant="light">Sem pulmão</Badge>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Button size="xs" variant="light" leftSection={<IconArrowRight size={14} />}
                      disabled={!item.pulmao}
                      onClick={() => executar.mutate(item)} loading={executar.isPending}>
                      Repor
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Card>
    </div>
  )
}
