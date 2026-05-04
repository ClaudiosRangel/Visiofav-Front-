'use client'

import { useState } from 'react'
import { Button, Card, Group, Text, TextInput, Table, Badge, ActionIcon, Tooltip, Modal, Select, NumberInput, LoadingOverlay } from '@mantine/core'
import { IconPlus, IconSearch, IconEdit, IconTrash, IconRefresh } from '@tabler/icons-react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { notifications } from '@mantine/notifications'
import { useVeiculos, useCriarVeiculo, useAtualizarVeiculo, useExcluirVeiculo } from '@/data/hooks/useVeiculo'
import { tiposCarroceriaCrud } from '@/data/hooks/useCrudGenerico'

const schema = z.object({ descricao: z.string().min(1, 'Obrigatório'), placa: z.string().min(1, 'Obrigatório'), marca: z.string().optional(), modelo: z.string().optional(), ano: z.number().optional(), tipoCarroceriaId: z.string().optional() })
type FormValues = z.infer<typeof schema>

export default function VeiculosPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [search, setSearch] = useState('')

  const { data: response, isLoading, refetch } = useVeiculos({ search: search || undefined })
  const { data: tiposResp } = tiposCarroceriaCrud.useListar({ limit: 100 })
  const criar = useCriarVeiculo()
  const atualizar = useAtualizarVeiculo()
  const excluir = useExcluirVeiculo()
  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const tipoOptions = (tiposResp?.data || []).map((t: any) => ({ value: t.id, label: t.descricao }))

  function handleNew() { setEditItem(null); reset({ descricao: '', placa: '' }); setModalOpen(true) }
  function handleEdit(item: any) { setEditItem(item); reset({ descricao: item.descricao, placa: item.placa, marca: item.marca || '', modelo: item.modelo || '', ano: item.ano || undefined, tipoCarroceriaId: item.tipoCarroceriaId || '' }); setModalOpen(true) }
  async function onSubmit(data: FormValues) {
    try {
      if (editItem) { await atualizar.mutateAsync({ id: editItem.id, ...data }) } else { await criar.mutateAsync(data) }
      notifications.show({ title: 'Sucesso', message: editItem ? 'Atualizado' : 'Criado', color: 'green' }); setModalOpen(false)
    } catch { notifications.show({ title: 'Erro', message: 'Falha ao salvar', color: 'red' }) }
  }
  async function handleDelete(id: string, desc: string) {
    if (!confirm(`Excluir "${desc}"?`)) return
    try { await excluir.mutateAsync(id); notifications.show({ title: 'Sucesso', message: 'Excluído', color: 'green' }) } catch { notifications.show({ title: 'Erro', message: 'Falha', color: 'red' }) }
  }
  const items = response?.data || []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Configurador / Veículos</Text>
      <Text size="xl" fw={600} mb="lg">Veículos</Text>
      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Group justify="space-between" mb="md">
          <TextInput placeholder="Pesquisar por descrição ou placa..." leftSection={<IconSearch size={16} />} value={search} onChange={(e) => setSearch(e.currentTarget.value)} className="w-80" />
          <Group><Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button><Button leftSection={<IconPlus size={16} />} onClick={handleNew}>Novo</Button></Group>
        </Group>
        <Table striped highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th>Código</Table.Th><Table.Th>Descrição</Table.Th><Table.Th>Placa</Table.Th><Table.Th>Marca/Modelo</Table.Th><Table.Th>Ano</Table.Th><Table.Th>Carroceria</Table.Th><Table.Th>Status</Table.Th><Table.Th className="w-24">Ações</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>{items.map((item: any) => (
            <Table.Tr key={item.id}><Table.Td>{item.codigo}</Table.Td><Table.Td>{item.descricao}</Table.Td>
              <Table.Td><Text fw={500} ff="monospace">{item.placa}</Text></Table.Td>
              <Table.Td className="text-sm text-zinc-500">{item.marca} {item.modelo}</Table.Td>
              <Table.Td>{item.ano}</Table.Td>
              <Table.Td>{item.tipoCarroceria && <Badge color="primary" variant="light">{item.tipoCarroceria.descricao}</Badge>}</Table.Td>
              <Table.Td><Badge color={item.status ? 'green' : 'gray'}>{item.status ? 'Ativo' : 'Inativo'}</Badge></Table.Td>
              <Table.Td><Group gap={4}><Tooltip label="Editar"><ActionIcon variant="subtle" color="gray" onClick={() => handleEdit(item)}><IconEdit size={18} /></ActionIcon></Tooltip><Tooltip label="Excluir"><ActionIcon variant="subtle" color="red" onClick={() => handleDelete(item.id, item.descricao)}><IconTrash size={18} /></ActionIcon></Tooltip></Group></Table.Td>
            </Table.Tr>))}
            {!isLoading && items.length === 0 && <Table.Tr><Table.Td colSpan={8} className="text-center py-8 text-zinc-500">Nenhum registro</Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>
      </Card>
      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Editar Veículo' : 'Novo Veículo'} size="lg" centered closeOnClickOutside={false}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-4">
            <Controller name="descricao" control={control} render={({ field }) => (<TextInput label={<>Descrição <span style={{ color: 'red' }}>*</span></>} error={errors.descricao?.message} {...field} />)} />
            <div className="flex gap-4 w-full">
              <Controller name="placa" control={control} render={({ field }) => (<TextInput label={<>Placa <span style={{ color: 'red' }}>*</span></>} error={errors.placa?.message} className="w-4/12" {...field} />)} />
              <Controller name="marca" control={control} render={({ field }) => (<TextInput label="Marca" className="w-4/12" {...field} />)} />
              <Controller name="modelo" control={control} render={({ field }) => (<TextInput label="Modelo" className="w-4/12" {...field} />)} />
            </div>
            <div className="flex gap-4 w-full">
              <Controller name="ano" control={control} render={({ field }) => (<NumberInput label="Ano" className="w-4/12" min={1990} max={2030} {...field} />)} />
              <Controller name="tipoCarroceriaId" control={control} render={({ field }) => (<Select label="Tipo Carroceria" data={tipoOptions} className="w-8/12" clearable searchable {...field} />)} />
            </div>
          </div>
          <Group justify="flex-end" mt="md"><Button variant="default" onClick={() => setModalOpen(false)}>Cancelar</Button><Button type="submit" loading={criar.isPending || atualizar.isPending}>Salvar</Button></Group>
        </form>
      </Modal>
    </div>
  )
}
