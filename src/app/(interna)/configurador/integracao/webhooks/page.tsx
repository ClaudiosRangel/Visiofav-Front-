'use client'

import { useState } from 'react'
import { Button, Card, Group, Text, TextInput, Select, Table, Badge, ActionIcon, Tooltip, Modal, LoadingOverlay, MultiSelect, Chip } from '@mantine/core'
import { IconPlus, IconRefresh, IconTrash, IconEdit, IconHistory, IconPlayerPlay } from '@tabler/icons-react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const EVENTOS = [
  { value: 'nota.recebida', label: 'Nota Recebida' },
  { value: 'nota.divergente', label: 'Nota Divergente' },
  { value: 'separacao.iniciada', label: 'Separação Iniciada' },
  { value: 'separacao.concluida', label: 'Separação Concluída' },
  { value: 'expedicao.carregada', label: 'Expedição Carregada' },
  { value: 'estoque.atualizado', label: 'Estoque Atualizado' },
]

const schema = z.object({ url: z.string().url('URL inválida'), eventos: z.array(z.string()).min(1, 'Selecione ao menos um evento') })

export default function WebhooksPage() {
  useModuloGuard('WMS')
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [entregasModal, setEntregasModal] = useState<string | null>(null)

  const { data: webhooks, isLoading, refetch } = useQuery<any[]>({
    queryKey: ['webhooks'],
    queryFn: async () => { const { data } = await api.get('/webhooks'); return data },
  })

  const { data: entregas } = useQuery<any[]>({
    queryKey: ['webhook-entregas', entregasModal],
    queryFn: async () => { if (!entregasModal) return []; const { data } = await api.get(`/webhooks/${entregasModal}/entregas`); return data },
    enabled: !!entregasModal,
  })

  const criar = useMutation({
    mutationFn: async (body: any) => { const { data } = await api.post('/webhooks', body); return data },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['webhooks'] }); setModalOpen(false); notifications.show({ title: 'Sucesso', message: 'Webhook criado', color: 'green' }) },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) },
  })

  const remover = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/webhooks/${id}`) },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['webhooks'] }); notifications.show({ title: 'Sucesso', message: 'Webhook removido', color: 'green' }) },
  })

  const reenviar = useMutation({
    mutationFn: async (id: string) => { await api.post(`/webhooks/entregas/${id}/reenviar`) },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['webhook-entregas'] }); notifications.show({ title: 'Sucesso', message: 'Reenvio iniciado', color: 'green' }) },
  })

  const { control, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(schema) })

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Configurador / Integração / Webhooks</Text>
      <Text size="xl" fw={600} mb="lg">Webhooks</Text>

      <Card pos="relative" mb="md">
        <LoadingOverlay visible={isLoading} />
        <Group justify="flex-end" mb="md">
          <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
          <Button leftSection={<IconPlus size={16} />} onClick={() => { setEditItem(null); reset({ url: '', eventos: [] }); setModalOpen(true) }}>Novo Webhook</Button>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th>URL</Table.Th><Table.Th>Eventos</Table.Th><Table.Th>Status</Table.Th><Table.Th className="w-32">Ações</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>
            {(webhooks || []).map((w: any) => (
              <Table.Tr key={w.id}>
                <Table.Td><Text size="sm" className="font-mono">{w.url}</Text></Table.Td>
                <Table.Td>{w.eventos.split(',').map((e: string) => <Badge key={e} variant="light" mr={4} mb={2} size="sm">{e.trim()}</Badge>)}</Table.Td>
                <Table.Td><Badge color={w.ativo ? 'green' : 'gray'}>{w.ativo ? 'Ativo' : 'Inativo'}</Badge></Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <Tooltip label="Histórico"><ActionIcon variant="subtle" color="blue" onClick={() => setEntregasModal(w.id)}><IconHistory size={18} /></ActionIcon></Tooltip>
                    <Tooltip label="Remover"><ActionIcon variant="subtle" color="red" onClick={() => { if (confirm('Remover?')) remover.mutate(w.id) }}><IconTrash size={18} /></ActionIcon></Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && (!webhooks || webhooks.length === 0) && <Table.Tr><Table.Td colSpan={4} className="text-center py-8 text-zinc-500">Nenhum webhook</Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>
      </Card>

      {/* Modal Criar */}
      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="Novo Webhook" centered>
        <form onSubmit={handleSubmit((data) => criar.mutate(data))}>
          <Controller name="url" control={control} render={({ field }) => <TextInput label="URL *" placeholder="https://..." error={errors.url?.message as string} mb="sm" {...field} />} />
          <Controller name="eventos" control={control} render={({ field }) => <MultiSelect label="Eventos *" data={EVENTOS} error={errors.eventos?.message as string} mb="md" value={field.value} onChange={field.onChange} />} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setModalOpen(false)}>Cancelar</Button><Button type="submit" loading={criar.isPending}>Criar</Button></Group>
        </form>
      </Modal>

      {/* Modal Entregas */}
      <Modal opened={!!entregasModal} onClose={() => setEntregasModal(null)} title="Histórico de Entregas" size="xl" centered>
        <Table striped>
          <Table.Thead><Table.Tr><Table.Th>Evento</Table.Th><Table.Th>Status HTTP</Table.Th><Table.Th>Tentativas</Table.Th><Table.Th>Sucesso</Table.Th><Table.Th>Data</Table.Th><Table.Th className="w-16"></Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>
            {(entregas || []).map((e: any) => (
              <Table.Tr key={e.id}>
                <Table.Td><Badge variant="light" size="sm">{e.evento}</Badge></Table.Td>
                <Table.Td>{e.statusHttp || '—'}</Table.Td>
                <Table.Td>{e.tentativas}</Table.Td>
                <Table.Td><Badge color={e.sucesso ? 'green' : 'red'}>{e.sucesso ? 'Sim' : 'Não'}</Badge></Table.Td>
                <Table.Td>{new Date(e.criadoEm).toLocaleString('pt-BR')}</Table.Td>
                <Table.Td>{!e.sucesso && <Tooltip label="Reenviar"><ActionIcon variant="subtle" color="blue" size="sm" onClick={() => reenviar.mutate(e.id)}><IconPlayerPlay size={14} /></ActionIcon></Tooltip>}</Table.Td>
              </Table.Tr>
            ))}
            {(!entregas || entregas.length === 0) && <Table.Tr><Table.Td colSpan={6} className="text-center py-4 text-zinc-500">Nenhuma entrega</Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>
      </Modal>
    </div>
  )
}
