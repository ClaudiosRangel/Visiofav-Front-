'use client'

import { useState } from 'react'
import { Button, Card, Group, Text, TextInput, Table, Badge, ActionIcon, Tooltip, Modal, LoadingOverlay, Code } from '@mantine/core'
import { IconPlus, IconRefresh, IconTrash, IconRefreshDot } from '@tabler/icons-react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const schema = z.object({ nome: z.string().min(1, 'Nome é obrigatório').max(100) })

export default function ApiKeysPage() {
  useModuloGuard('WMS')
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [novaChave, setNovaChave] = useState<{ chave: string; secret: string } | null>(null)

  const { data: keys, isLoading, refetch } = useQuery<any[]>({
    queryKey: ['api-keys'],
    queryFn: async () => { const { data } = await api.get('/api-keys'); return data },
  })

  const criar = useMutation({
    mutationFn: async (body: { nome: string }) => { const { data } = await api.post('/api-keys', body); return data },
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ['api-keys'] }); setModalOpen(false); setNovaChave({ chave: data.chave, secret: data.secret }) },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) },
  })

  const revogar = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/api-keys/${id}`) },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['api-keys'] }); notifications.show({ title: 'Sucesso', message: 'API Key revogada', color: 'green' }) },
  })

  const regenerar = useMutation({
    mutationFn: async (id: string) => { const { data } = await api.post(`/api-keys/${id}/regenerar`); return data },
    onSuccess: (data) => { queryClient.invalidateQueries({ queryKey: ['api-keys'] }); setNovaChave({ chave: data.chave, secret: data.secret }) },
  })

  const { control, handleSubmit, reset, formState: { errors } } = useForm({ resolver: zodResolver(schema) })

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Configurador / Integração / API Keys</Text>
      <Text size="xl" fw={600} mb="lg">API Keys</Text>

      {novaChave && (
        <Card mb="md" withBorder style={{ borderColor: 'var(--mantine-color-green-6)' }}>
          <Text fw={600} c="green" mb="sm">Nova API Key criada — copie agora, não será exibida novamente!</Text>
          <Text size="sm" mb={4}>Chave:</Text><Code block mb="sm">{novaChave.chave}</Code>
          <Text size="sm" mb={4}>Secret (para webhooks):</Text><Code block mb="sm">{novaChave.secret}</Code>
          <Button size="xs" variant="light" onClick={() => setNovaChave(null)}>Fechar</Button>
        </Card>
      )}

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Group justify="flex-end" mb="md">
          <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
          <Button leftSection={<IconPlus size={16} />} onClick={() => { reset({ nome: '' }); setModalOpen(true) }}>Nova API Key</Button>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th>Nome</Table.Th><Table.Th>Chave</Table.Th><Table.Th>Expira</Table.Th><Table.Th>Status</Table.Th><Table.Th className="w-24">Ações</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>
            {(keys || []).map((k: any) => (
              <Table.Tr key={k.id}>
                <Table.Td fw={500}>{k.nome}</Table.Td>
                <Table.Td><Code>{k.chave}</Code></Table.Td>
                <Table.Td>{k.expiraEm ? new Date(k.expiraEm).toLocaleDateString('pt-BR') : 'Sem expiração'}</Table.Td>
                <Table.Td><Badge color={k.revogada ? 'red' : 'green'}>{k.revogada ? 'Revogada' : 'Ativa'}</Badge></Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    {!k.revogada && <Tooltip label="Regenerar"><ActionIcon variant="subtle" color="blue" onClick={() => { if (confirm('Regenerar?')) regenerar.mutate(k.id) }}><IconRefreshDot size={18} /></ActionIcon></Tooltip>}
                    {!k.revogada && <Tooltip label="Revogar"><ActionIcon variant="subtle" color="red" onClick={() => { if (confirm('Revogar?')) revogar.mutate(k.id) }}><IconTrash size={18} /></ActionIcon></Tooltip>}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && (!keys || keys.length === 0) && <Table.Tr><Table.Td colSpan={5} className="text-center py-8 text-zinc-500">Nenhuma API Key</Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>
      </Card>

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="Nova API Key" centered>
        <form onSubmit={handleSubmit((data) => criar.mutate(data as any))}>
          <Controller name="nome" control={control} render={({ field }) => <TextInput label="Nome *" error={errors.nome?.message} mb="md" {...field} />} />
          <Group justify="flex-end"><Button variant="default" onClick={() => setModalOpen(false)}>Cancelar</Button><Button type="submit" loading={criar.isPending}>Criar</Button></Group>
        </form>
      </Modal>
    </div>
  )
}
