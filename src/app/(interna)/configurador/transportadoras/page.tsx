'use client'

import { useState } from 'react'
import { Button, Card, Group, Text, TextInput, Table, Badge, ActionIcon, Tooltip, Modal, LoadingOverlay } from '@mantine/core'
import { IconPlus, IconSearch, IconEdit, IconTrash, IconRefresh } from '@tabler/icons-react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { notifications } from '@mantine/notifications'
import { transportadorasCrud } from '@/data/hooks/useCrudGenerico'

const schema = z.object({ razaoSocial: z.string().min(1, 'Obrigatório'), cnpj: z.string().optional(), telefone: z.string().optional() })
type FormValues = z.infer<typeof schema>

export default function TransportadorasPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [search, setSearch] = useState('')
  const { data: response, isLoading, refetch } = transportadorasCrud.useListar({ search: search || undefined })
  const criar = transportadorasCrud.useCriar()
  const atualizar = transportadorasCrud.useAtualizar()
  const excluir = transportadorasCrud.useExcluir()
  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) })

  function handleNew() { setEditItem(null); reset({ razaoSocial: '' }); setModalOpen(true) }
  function handleEdit(item: any) { setEditItem(item); reset({ razaoSocial: item.razaoSocial, cnpj: item.cnpj || '', telefone: item.telefone || '' }); setModalOpen(true) }
  async function onSubmit(data: FormValues) { try { if (editItem) { await atualizar.mutateAsync({ id: editItem.id, ...data }) } else { await criar.mutateAsync(data as any) }; notifications.show({ title: 'Sucesso', message: editItem ? 'Atualizado' : 'Criado', color: 'green' }); setModalOpen(false) } catch { notifications.show({ title: 'Erro', message: 'Falha', color: 'red' }) } }
  async function handleDelete(id: string, desc: string) { if (!confirm(`Excluir "${desc}"?`)) return; try { await excluir.mutateAsync(id); notifications.show({ title: 'Sucesso', message: 'Excluído', color: 'green' }) } catch { notifications.show({ title: 'Erro', message: 'Falha', color: 'red' }) } }
  const items = response?.data || []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Configurador / Transportadoras</Text>
      <Text size="xl" fw={600} mb="lg">Transportadoras</Text>
      <Card pos="relative"><LoadingOverlay visible={isLoading} />
        <Group justify="space-between" mb="md"><TextInput placeholder="Pesquisar..." leftSection={<IconSearch size={16} />} value={search} onChange={(e) => setSearch(e.currentTarget.value)} className="w-72" /><Group><Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button><Button leftSection={<IconPlus size={16} />} onClick={handleNew}>Novo</Button></Group></Group>
        <Table striped highlightOnHover><Table.Thead><Table.Tr><Table.Th>Código</Table.Th><Table.Th>Razão Social</Table.Th><Table.Th>CNPJ</Table.Th><Table.Th>Telefone</Table.Th><Table.Th>Status</Table.Th><Table.Th className="w-24">Ações</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>{items.map((item: any) => (<Table.Tr key={item.id}><Table.Td>{item.codigo}</Table.Td><Table.Td>{item.razaoSocial}</Table.Td><Table.Td className="text-sm text-zinc-500">{item.cnpj || '-'}</Table.Td><Table.Td>{item.telefone || '-'}</Table.Td><Table.Td><Badge color={item.status ? 'green' : 'gray'}>{item.status ? 'Ativo' : 'Inativo'}</Badge></Table.Td><Table.Td><Group gap={4}><Tooltip label="Editar"><ActionIcon variant="subtle" color="gray" onClick={() => handleEdit(item)}><IconEdit size={18} /></ActionIcon></Tooltip><Tooltip label="Excluir"><ActionIcon variant="subtle" color="red" onClick={() => handleDelete(item.id, item.razaoSocial)}><IconTrash size={18} /></ActionIcon></Tooltip></Group></Table.Td></Table.Tr>))}
            {!isLoading && items.length === 0 && <Table.Tr><Table.Td colSpan={6} className="text-center py-8 text-zinc-500">Nenhum registro</Table.Td></Table.Tr>}</Table.Tbody>
        </Table>
      </Card>
      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Editar Transportadora' : 'Nova Transportadora'} centered closeOnClickOutside={false}>
        <form onSubmit={handleSubmit(onSubmit)}><div className="flex flex-col gap-4"><Controller name="razaoSocial" control={control} render={({ field }) => (<TextInput label={<>Razão Social <span style={{ color: 'red' }}>*</span></>} error={errors.razaoSocial?.message} {...field} />)} /><div className="flex gap-4 w-full"><Controller name="cnpj" control={control} render={({ field }) => (<TextInput label="CNPJ" className="w-6/12" {...field} />)} /><Controller name="telefone" control={control} render={({ field }) => (<TextInput label="Telefone" className="w-6/12" {...field} />)} /></div></div><Group justify="flex-end" mt="md"><Button variant="default" onClick={() => setModalOpen(false)}>Cancelar</Button><Button type="submit" loading={criar.isPending || atualizar.isPending}>Salvar</Button></Group></form>
      </Modal>
    </div>
  )
}
