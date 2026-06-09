'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, Modal, TextInput, NumberInput, Select,
  ActionIcon, Tooltip, LoadingOverlay, Divider,
} from '@mantine/core'
import { IconPlus, IconTrash, IconX } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { portalApi } from '@/lib/portalApi'

const statusColors: Record<string, string> = {
  PENDENTE: 'orange', APROVADA: 'green', REJEITADA: 'red', EM_ANDAMENTO: 'blue', CONCLUIDA: 'teal',
}

interface ItemSolicitacao {
  produtoId: string | null
  quantidade: number | undefined
}

export default function PortalSolicitacoesPage() {
  useEffect(() => { document.title = 'Portal 3PL - Solicitações' }, [])
  const queryClient = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [itens, setItens] = useState<ItemSolicitacao[]>([{ produtoId: null, quantidade: undefined }])

  const { data: response, isLoading } = useQuery<any>({
    queryKey: ['portal-minhas-solicitacoes'],
    queryFn: async () => { const { data } = await portalApi.get('/portal/solicitacoes'); return data },
  })

  const { data: produtos } = useQuery<any>({
    queryKey: ['portal-meus-produtos'],
    queryFn: async () => { const { data } = await portalApi.get('/portal/produtos'); return data },
    enabled: modalOpen,
  })

  const criar = useMutation({
    mutationFn: async () => {
      const itensValidos = itens.filter(i => i.produtoId && i.quantidade && i.quantidade > 0)
      if (itensValidos.length === 0) throw new Error('Adicione pelo menos 1 item')
      const { data } = await portalApi.post('/portal/solicitacoes', { itens: itensValidos })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-minhas-solicitacoes'] })
      setModalOpen(false); setItens([{ produtoId: null, quantidade: undefined }])
      notifications.show({ title: 'Sucesso', message: 'Solicitação enviada', color: 'green' })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' })
    },
  })

  const cancelar = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await portalApi.post(`/portal/solicitacoes/${id}/cancelar`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-minhas-solicitacoes'] })
      notifications.show({ title: 'Cancelada', message: 'Solicitação cancelada', color: 'orange' })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao cancelar', color: 'red' })
    },
  })

  function addItem() {
    setItens([...itens, { produtoId: null, quantidade: undefined }])
  }

  function removeItem(index: number) {
    setItens(itens.filter((_, i) => i !== index))
  }

  function updateItem(index: number, field: keyof ItemSolicitacao, value: any) {
    const updated = [...itens]
    updated[index] = { ...updated[index], [field]: value }
    setItens(updated)
  }

  const produtoOptions = (produtos?.data || []).map((p: any) => ({
    value: p.id, label: `${p.codigo ? p.codigo + ' - ' : ''}${p.nome}`,
  }))

  const solicitacoes = response?.data || []

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Text size="xl" fw={600}>Minhas Solicitações</Text>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setModalOpen(true)}>
          Nova Solicitação
        </Button>
      </Group>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Número</Table.Th>
              <Table.Th>Itens</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Data</Table.Th>
              <Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {solicitacoes.map((s: any) => (
              <Table.Tr key={s.id}>
                <Table.Td className="font-mono" fw={500}>#{s.numero}</Table.Td>
                <Table.Td>{s.totalItens || s.itens?.length || 0}</Table.Td>
                <Table.Td>
                  <Badge color={statusColors[s.status] || 'gray'} variant="light">{s.status}</Badge>
                </Table.Td>
                <Table.Td>{s.createdAt ? new Date(s.createdAt).toLocaleDateString('pt-BR') : '—'}</Table.Td>
                <Table.Td>
                  {s.status === 'PENDENTE' && (
                    <Tooltip label="Cancelar solicitação">
                      <ActionIcon variant="light" color="red" onClick={() => {
                        if (confirm('Cancelar esta solicitação?')) cancelar.mutate(s.id)
                      }}>
                        <IconX size={16} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
            {solicitacoes.length === 0 && (
              <Table.Tr><Table.Td colSpan={5} className="text-center py-8 text-zinc-500">Nenhuma solicitação</Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      {/* Modal Nova Solicitação */}
      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="Nova Solicitação de Expedição" size="lg" centered>
        <Text size="sm" c="dimmed" mb="md">Selecione os produtos e quantidades desejadas:</Text>

        {itens.map((item, index) => (
          <Group key={index} mb="sm" align="flex-end">
            <Select
              label={index === 0 ? 'Produto' : undefined}
              placeholder="Selecione..."
              data={produtoOptions}
              value={item.produtoId}
              onChange={(v) => updateItem(index, 'produtoId', v)}
              searchable
              className="flex-1"
            />
            <NumberInput
              label={index === 0 ? 'Quantidade' : undefined}
              placeholder="Qtd"
              min={1}
              value={item.quantidade}
              onChange={(v) => updateItem(index, 'quantidade', typeof v === 'number' ? v : undefined)}
              className="w-28"
            />
            {itens.length > 1 && (
              <ActionIcon variant="light" color="red" onClick={() => removeItem(index)}>
                <IconTrash size={16} />
              </ActionIcon>
            )}
          </Group>
        ))}

        <Button variant="light" leftSection={<IconPlus size={14} />} size="xs" onClick={addItem} mt="sm">
          Adicionar Item
        </Button>

        <Divider my="md" />

        <Group justify="flex-end">
          <Button variant="default" onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button onClick={() => criar.mutate()} loading={criar.isPending}
            disabled={itens.every(i => !i.produtoId || !i.quantidade)}>
            Enviar Solicitação
          </Button>
        </Group>
      </Modal>
    </div>
  )
}
