'use client'

import { useState } from 'react'
import { Button, Card, Group, Text, TextInput, Table, Badge, ActionIcon, Tooltip, Modal, LoadingOverlay } from '@mantine/core'
import { IconPlus, IconSearch, IconEdit, IconTrash, IconRefresh } from '@tabler/icons-react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { notifications } from '@mantine/notifications'
import { tiposCarroceriaCrud } from '@/data/hooks/useCrudGenerico'

const schema = z.object({ descricao: z.string().min(1, 'Obrigatório') })
type FormValues = z.infer<typeof schema>

export default function TipoCarroceriaPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [search, setSearch] = useState('')
  const { data: response, isLoading, refetch } = tiposCarroceriaCrud.useListar({ search: search || undefined })
  const criar = tiposCarroceriaCrud.useCriar()
  const atualizar = tiposCarroceriaCrud.useAtualizar()
  const excluir = tiposCarroceriaCrud.useExcluir()
  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) })

  function handleNew() { setEditItem(null); reset({ descricao: '' }); setModalOpen(true) }
  function handleEdit(item: any) { setEditItem(item); reset({ descricao: item.descricao }); setModalOpen(true) }
  async function onSubmit(data: FormValues) { try { if (editItem) { await atualizar.mutateAsync({ id: editItem.id, ...data }) } else { await criar.mutateAsync(data as any) }; notifications.show({ title: 'Sucesso', message: editItem ? 'Atualizado' : 'Criado', color: 'green' }); setModalOpen(false) } catch { notifications.show({ title: 'Erro', message: 'Falha', color: 'red' }) } }
  async function handleDelete(id: string, desc: string) { if (!confirm(`Excluir "${desc}"?`)) return; try { await excluir.mutateAsync(id); notifications.show({ title: 'Sucesso', message: 'Excluído', color: 'green' }) } catch { notifications.show({ title: 'Erro', message: 'Falha', color: 'red' }) } }
  const items = response?.data || []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Configurador / Tipo Carroceria</Text>
      <Text size="xl" fw={600} mb="lg">Tipo de Carroceria</Text>
      <Card pos="relative"><LoadingOverlay visible={isLoading} />
        <Group justify="space-between" mb="md"><TextInput placeholder="Pesquisar..." leftSection={<IconSearch size={16} />} value={search} onChange={(e) => setSearch(e.currentTarget.value)} className="w-72" /><Group><Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button><Button leftSection={<IconPlus size={16} />} onClick={handleNew}>Novo</Button></Group></Group>
        <Table striped highlightOnHover><Table.Thead><Table.Tr><Table.Th>Código</Table.Th><Table.Th>Descrição</Table.Th><Table.Th>Status</Table.Th><Table.Th className="w-24">Ações</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>{items.map((item: any) => (<Table.Tr key={item.id}><Table.Td>{item.codigo}</Table.Td><Table.Td>{item.descricao}</Table.Td><Table.Td><Badge color={item.status ? 'green' : 'gray'}>{item.status ? 'Ativo' : 'Inativo'}</Badge></Table.Td><Table.Td><Group gap={4}><Tooltip label="Editar"><ActionIcon variant="subtle" color="gray" onClick={() => handleEdit(item)}><IconEdit size={18} /></ActionIcon></Tooltip><Tooltip label="Excluir"><ActionIcon variant="subtle" color="red" onClick={() => handleDelete(item.id, item.descricao)}><IconTrash size={18} /></ActionIcon></Tooltip></Group></Table.Td></Table.Tr>))}
            {!isLoading && items.length === 0 && <Table.Tr><Table.Td colSpan={4} className="text-center py-8 text-zinc-500">Nenhum registro</Table.Td></Table.Tr>}</Table.Tbody>
        </Table>
      </Card>
      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Editar Tipo' : 'Novo Tipo'} centered closeOnClickOutside={false}>
        <form onSubmit={handleSubmit(onSubmit)}><Controller name="descricao" control={control} render={({ field }) => (<TextInput label={<>Descrição <span style={{ color: 'red' }}>*</span></>} error={errors.descricao?.message} {...field} />)} /><Group justify="flex-end" mt="md"><Button variant="default" onClick={() => setModalOpen(false)}>Cancelar</Button><Button type="submit" loading={criar.isPending || atualizar.isPending}>Salvar</Button></Group></form>
      </Modal>
    </div>
  )
}
