'use client'

import { useState } from 'react'
import { Button, Card, Group, Text, TextInput, Table, Badge, ActionIcon, Tooltip, Modal } from '@mantine/core'
import { IconPlus, IconSearch, IconEdit, IconTrash, IconRefresh } from '@tabler/icons-react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'

const schema = z.object({ descricao: z.string().min(1, 'Descrição é obrigatória') })
type FormValues = z.infer<typeof schema>
const mockData = [
  { id: '1', codigo: 1, descricao: 'Estoque Próprio', status: true },
  { id: '2', codigo: 2, descricao: 'Estoque de Terceiros', status: true },
  { id: '3', codigo: 3, descricao: 'Estoque em Trânsito', status: true },
  { id: '4', codigo: 4, descricao: 'Estoque Consignado', status: false },
]

export default function TipoEstoquePage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<typeof mockData[0] | null>(null)
  const [search, setSearch] = useState('')
  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) })
  function handleNew() { setEditItem(null); reset({ descricao: '' }); setModalOpen(true) }
  function handleEdit(item: typeof mockData[0]) { setEditItem(item); reset({ descricao: item.descricao }); setModalOpen(true) }
  function onSubmit(data: FormValues) { console.log('Salvar:', data); setModalOpen(false) }
  const filtered = mockData.filter((d) => d.descricao.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Configurador / Tipo de Estoque</Text>
      <Text size="xl" fw={600} mb="lg">Tipo de Estoque</Text>
      <Card>
        <Group justify="space-between" mb="md">
          <TextInput placeholder="Pesquisar..." leftSection={<IconSearch size={16} />} value={search} onChange={(e) => setSearch(e.currentTarget.value)} className="w-72" />
          <Group><Button variant="default" leftSection={<IconRefresh size={16} />}>Atualizar</Button><Button leftSection={<IconPlus size={16} />} onClick={handleNew}>Novo</Button></Group>
        </Group>
        <Table striped highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th>Código</Table.Th><Table.Th>Descrição</Table.Th><Table.Th>Status</Table.Th><Table.Th className="w-24">Ações</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>{filtered.map((item) => (
            <Table.Tr key={item.id}><Table.Td>{item.codigo}</Table.Td><Table.Td>{item.descricao}</Table.Td>
              <Table.Td><Badge color={item.status ? 'green' : 'gray'}>{item.status ? 'Ativo' : 'Inativo'}</Badge></Table.Td>
              <Table.Td><Group gap={4}><Tooltip label="Editar"><ActionIcon variant="subtle" color="gray" onClick={() => handleEdit(item)}><IconEdit size={18} /></ActionIcon></Tooltip><Tooltip label="Excluir"><ActionIcon variant="subtle" color="red"><IconTrash size={18} /></ActionIcon></Tooltip></Group></Table.Td>
            </Table.Tr>))}</Table.Tbody>
        </Table>
      </Card>
      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Editar Tipo' : 'Novo Tipo'} centered closeOnClickOutside={false}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Controller name="descricao" control={control} render={({ field }) => (<TextInput label={<>Descrição <span style={{ color: 'red' }}>*</span></>} error={errors.descricao?.message} {...field} />)} />
          <Group justify="flex-end" mt="md"><Button variant="default" onClick={() => setModalOpen(false)}>Cancelar</Button><Button type="submit">Salvar</Button></Group>
        </form>
      </Modal>
    </div>
  )
}
