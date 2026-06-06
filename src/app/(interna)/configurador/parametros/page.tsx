'use client'

import { useState } from 'react'
import { Button, Card, Group, Text, TextInput, Table, ActionIcon, Tooltip, Modal, LoadingOverlay } from '@mantine/core'
import { IconSearch, IconEdit, IconRefresh } from '@tabler/icons-react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

const schema = z.object({ valor: z.string().optional() })
type FormValues = z.infer<typeof schema>

export default function ParametrosPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [search, setSearch] = useState('')

  const { data: response, isLoading, refetch } = useQuery<{ data: any[] }>({
    queryKey: ['parametros', search],
    queryFn: async () => { const { data } = await api.get('/parametros', { params: { search: search || undefined } }); return data },
    staleTime: 1000 * 60 * 5,
  })

  const qc = useQueryClient()
  const atualizar = useMutation({
    mutationFn: async ({ id, valor }: { id: string; valor?: string }) => { const { data } = await api.put(`/parametros/${id}`, { valor }); return data },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['parametros'] }),
  })

  const { control, handleSubmit, reset } = useForm<FormValues>({ resolver: zodResolver(schema) })

  function handleEdit(item: any) { setEditItem(item); reset({ valor: item.valor || '' }); setModalOpen(true) }
  async function onSubmit(data: FormValues) {
    try { await atualizar.mutateAsync({ id: editItem.id, valor: data.valor }); notifications.show({ title: 'Sucesso', message: 'Parâmetro atualizado', color: 'green' }); setModalOpen(false) }
    catch { notifications.show({ title: 'Erro', message: 'Falha', color: 'red' }) }
  }

  const items = response?.data || []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Configurador / Parâmetros</Text>
      <Text size="xl" fw={600} mb="lg">Parâmetros do Sistema</Text>
      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Group justify="space-between" mb="md">
          <TextInput placeholder="Pesquisar por nome ou descrição..." leftSection={<IconSearch size={16} />} value={search} onChange={(e) => setSearch(e.currentTarget.value)} className="w-96" />
          <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
        </Group>
        <Table striped highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th>Parâmetro</Table.Th><Table.Th>Descrição</Table.Th><Table.Th>Valor</Table.Th><Table.Th>Padrão</Table.Th><Table.Th className="w-16">Ações</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>{items.map((item: any) => (
            <Table.Tr key={item.id}>
              <Table.Td><Text fw={500} ff="monospace" size="sm">{item.nome}</Text></Table.Td>
              <Table.Td className="text-sm">{item.descricao}</Table.Td>
              <Table.Td><Text fw={600} c="primary">{item.valor}</Text></Table.Td>
              <Table.Td className="text-sm text-zinc-500">{item.valorDefault}</Table.Td>
              <Table.Td><Tooltip label="Editar"><ActionIcon variant="subtle" color="gray" onClick={() => handleEdit(item)}><IconEdit size={18} /></ActionIcon></Tooltip></Table.Td>
            </Table.Tr>))}
            {!isLoading && items.length === 0 && <Table.Tr><Table.Td colSpan={5} className="text-center py-8 text-zinc-500">Nenhum parâmetro</Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>
      </Card>

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="Editar Parâmetro" centered closeOnClickOutside={false}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-3 mb-4">
            <Text size="sm"><Text span fw={600}>Parâmetro:</Text> {editItem?.nome}</Text>
            <Text size="sm"><Text span fw={600}>Descrição:</Text> {editItem?.descricao}</Text>
            <Text size="sm"><Text span fw={600}>Valor padrão:</Text> {editItem?.valorDefault}</Text>
          </div>
          <Controller name="valor" control={control} render={({ field }) => (<TextInput label="Valor" {...field} />)} />
          <Group justify="flex-end" mt="md"><Button variant="default" onClick={() => setModalOpen(false)}>Cancelar</Button><Button type="submit" loading={atualizar.isPending}>Salvar</Button></Group>
        </form>
      </Modal>
    </div>
  )
}
