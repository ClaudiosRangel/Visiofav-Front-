'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, TextInput, Modal,
  ActionIcon, Tooltip, SimpleGrid, ThemeIcon, Textarea,
} from '@mantine/core'
import {
  IconArrowsExchange, IconPlus, IconPlayerPlay,
  IconX, IconCheck, IconClock,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const statusCores: Record<string, string> = {
  PENDENTE: 'orange', EM_ANDAMENTO: 'blue', CONCLUIDA: 'green', CANCELADA: 'red',
}

export default function MudancasPickingPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Mudança de Picking' }, [])
  const queryClient = useQueryClient()

  const [criarModal, setCriarModal] = useState(false)
  const [produtoId, setProdutoId] = useState('')
  const [enderecoOrigemId, setEnderecoOrigemId] = useState('')
  const [enderecoDestinoId, setEnderecoDestinoId] = useState('')
  const [observacao, setObservacao] = useState('')

  // Listar mudanças
  const { data: mudancas = [] } = useQuery<any[]>({
    queryKey: ['mudancas-picking'],
    queryFn: async () => { const { data } = await api.get('/bloqueio-wms/picking/mudancas'); return data },
  })

  // Criar mudança
  const criarMudanca = useMutation({
    mutationFn: async () => {
      const body: any = { produtoId, enderecoOrigemId, enderecoDestinoId }
      if (observacao) body.observacao = observacao
      const { data } = await api.post('/bloqueio-wms/picking/mudanca', body)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mudancas-picking'] })
      setCriarModal(false)
      setProdutoId(''); setEnderecoOrigemId(''); setEnderecoDestinoId(''); setObservacao('')
      notifications.show({ title: '✅ Mudança solicitada', message: 'Endereço de origem bloqueado até conclusão', color: 'green' })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' })
    },
  })

  // Executar mudança
  const executarMudanca = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/bloqueio-wms/picking/mudanca/${id}/executar`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mudancas-picking'] })
      notifications.show({ title: '✅ Mudança executada', message: 'Estoque transferido e endereços atualizados', color: 'green' })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' })
    },
  })

  // Cancelar mudança
  const cancelarMudanca = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/bloqueio-wms/picking/mudanca/${id}/cancelar`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mudancas-picking'] })
      notifications.show({ title: 'Mudança cancelada', message: 'Endereço de origem desbloqueado', color: 'orange' })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' })
    },
  })

  const pendentes = mudancas.filter((m: any) => m.status === 'PENDENTE' || m.status === 'EM_ANDAMENTO')
  const concluidas = mudancas.filter((m: any) => m.status === 'CONCLUIDA')

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Picking / Mudanças</Text>
      <Group justify="space-between" mb="lg">
        <Text size="xl" fw={600}>Mudança de Picking (DE/PARA)</Text>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCriarModal(true)}>
          Nova Mudança
        </Button>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="lg">
        <Card withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Pendentes</Text>
              <Text size="xl" fw={700} c="orange">{pendentes.length}</Text>
            </div>
            <ThemeIcon color="orange" variant="light" size={40} radius="md"><IconClock size={20} /></ThemeIcon>
          </Group>
        </Card>
        <Card withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Concluídas</Text>
              <Text size="xl" fw={700} c="green">{concluidas.length}</Text>
            </div>
            <ThemeIcon color="green" variant="light" size={40} radius="md"><IconCheck size={20} /></ThemeIcon>
          </Group>
        </Card>
        <Card withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Total</Text>
              <Text size="xl" fw={700}>{mudancas.length}</Text>
            </div>
            <ThemeIcon color="blue" variant="light" size={40} radius="md"><IconArrowsExchange size={20} /></ThemeIcon>
          </Group>
        </Card>
      </SimpleGrid>

      <Card>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Produto</Table.Th>
              <Table.Th>Origem</Table.Th>
              <Table.Th>Destino</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Qtd Transferida</Table.Th>
              <Table.Th>Solicitado em</Table.Th>
              <Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {mudancas.map((m: any) => (
              <Table.Tr key={m.id}>
                <Table.Td className="font-mono text-xs">{m.produtoId?.slice(0, 8)}...</Table.Td>
                <Table.Td className="font-mono text-xs">{m.enderecoOrigemId?.slice(0, 8)}...</Table.Td>
                <Table.Td className="font-mono text-xs">{m.enderecoDestinoId?.slice(0, 8)}...</Table.Td>
                <Table.Td><Badge color={statusCores[m.status] || 'gray'}>{m.status}</Badge></Table.Td>
                <Table.Td>{m.quantidadeTransferida ? Number(m.quantidadeTransferida) : '—'}</Table.Td>
                <Table.Td>{new Date(m.solicitadoEm).toLocaleString('pt-BR')}</Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    {(m.status === 'PENDENTE' || m.status === 'EM_ANDAMENTO') && (
                      <>
                        <Tooltip label="Executar mudança">
                          <ActionIcon color="green" variant="light" onClick={() => executarMudanca.mutate(m.id)}>
                            <IconPlayerPlay size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Cancelar">
                          <ActionIcon color="red" variant="light" onClick={() => cancelarMudanca.mutate(m.id)}>
                            <IconX size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {mudancas.length === 0 && (
              <Table.Tr><Table.Td colSpan={7} className="text-center py-8 text-zinc-500">Nenhuma mudança registrada</Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      {/* Modal Nova Mudança */}
      <Modal opened={criarModal} onClose={() => setCriarModal(false)} title="Nova Mudança de Picking" centered>
        <TextInput label="ID do Produto" value={produtoId} onChange={(e) => setProdutoId(e.target.value)} mb="sm" required
          placeholder="UUID do produto" />
        <TextInput label="Endereço Origem (ID)" value={enderecoOrigemId} onChange={(e) => setEnderecoOrigemId(e.target.value)} mb="sm" required
          placeholder="UUID do endereço de picking atual" />
        <TextInput label="Endereço Destino (ID)" value={enderecoDestinoId} onChange={(e) => setEnderecoDestinoId(e.target.value)} mb="sm" required
          placeholder="UUID do novo endereço de picking" />
        <Textarea label="Observação (opcional)" value={observacao} onChange={(e) => setObservacao(e.target.value)} mb="sm"
          placeholder="Motivo da mudança (sazonalidade, reorganização, etc.)" />
        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => setCriarModal(false)}>Cancelar</Button>
          <Button leftSection={<IconArrowsExchange size={16} />}
            onClick={() => criarMudanca.mutate()} loading={criarMudanca.isPending}
            disabled={!produtoId || !enderecoOrigemId || !enderecoDestinoId}>
            Solicitar Mudança
          </Button>
        </Group>
      </Modal>
    </div>
  )
}
