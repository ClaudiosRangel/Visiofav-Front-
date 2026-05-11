'use client'

import { useState } from 'react'
import { Button, Card, Group, Text, TextInput, Table, Badge, ActionIcon, Tooltip, Modal, Select, NumberInput, LoadingOverlay } from '@mantine/core'
import { IconPlus, IconSearch, IconEdit, IconTrash, IconRefresh, IconStack2 } from '@tabler/icons-react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { notifications } from '@mantine/notifications'
import { estruturasCrud } from '@/data/hooks/useCrudGenerico'
import CapacidadeNivelPanel from './CapacidadeNivelPanel'

const schema = z.object({
  descricao: z.string().min(1, 'Descrição é obrigatória'),
  tipo: z.string().min(1, 'Tipo é obrigatório'),
  capacidade: z.number().optional().nullable(),
  largura: z.number().optional().nullable(),
  altura: z.number().optional().nullable(),
  comprimento: z.number().optional().nullable(),
})
type FormValues = z.infer<typeof schema>

const TIPOS = [
  { value: 'PORTA_PALETE', label: 'Porta Palete' }, { value: 'BLOCADO', label: 'Blocado' },
  { value: 'DRIVE_IN', label: 'Drive-In' }, { value: 'DRIVE_THROUGH', label: 'Drive-Through' },
  { value: 'FLOW_RACK', label: 'Flow Rack' }, { value: 'CANTILEVER', label: 'Cantilever' },
  { value: 'MEZANINO', label: 'Mezanino' }, { value: 'PRATELEIRA', label: 'Prateleira' },
]

export default function EstruturasPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [capacidadeItem, setCapacidadeItem] = useState<{ id: string; descricao: string } | null>(null)

  const { data: response, isLoading, refetch } = estruturasCrud.useListar({ search: search || undefined })
  const criar = estruturasCrud.useCriar()
  const atualizar = estruturasCrud.useAtualizar()
  const excluir = estruturasCrud.useExcluir()
  const { control, handleSubmit, reset, watch, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const largura = watch('largura')
  const altura = watch('altura')
  const comprimento = watch('comprimento')
  const cubagem = (largura && altura && comprimento) ? Number((largura * altura * comprimento).toFixed(6)) : null

  function handleNew() {
    setEditItem(null)
    reset({ descricao: '', tipo: '', capacidade: null, largura: null, altura: null, comprimento: null })
    setModalOpen(true)
  }
  function handleEdit(item: any) {
    setEditItem(item)
    reset({
      descricao: item.descricao,
      tipo: item.tipo,
      capacidade: item.capacidade ? Number(item.capacidade) : null,
      largura: item.largura ? Number(item.largura) : null,
      altura: item.altura ? Number(item.altura) : null,
      comprimento: item.comprimento ? Number(item.comprimento) : null,
    })
    setModalOpen(true)
  }
  async function onSubmit(data: FormValues) {
    try {
      const payload: any = { ...data }
      // Include cubagem auto-calculated from dimensions
      if (data.largura && data.altura && data.comprimento) {
        payload.cubagem = data.largura * data.altura * data.comprimento
      }
      if (editItem) { await atualizar.mutateAsync({ id: editItem.id, ...payload }) } else { await criar.mutateAsync(payload as any) }
      notifications.show({ title: 'Sucesso', message: editItem ? 'Atualizado' : 'Criado', color: 'green' }); setModalOpen(false)
    } catch { notifications.show({ title: 'Erro', message: 'Falha ao salvar', color: 'red' }) }
  }
  async function handleDelete(id: string, desc: string) {
    if (!confirm(`Excluir "${desc}"?`)) return
    try { await excluir.mutateAsync(id); notifications.show({ title: 'Sucesso', message: 'Excluído', color: 'green' }) } catch { notifications.show({ title: 'Erro', message: 'Falha', color: 'red' }) }
  }
  const items = response?.data || []
  const getTipoLabel = (tipo: string) => TIPOS.find((t) => t.value === tipo)?.label || tipo

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Configurador / Estruturas</Text>
      <Text size="xl" fw={600} mb="lg">Estrutura Física</Text>
      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Group justify="space-between" mb="md">
          <TextInput placeholder="Pesquisar..." leftSection={<IconSearch size={16} />} value={search} onChange={(e) => setSearch(e.currentTarget.value)} className="w-72" />
          <Group><Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button><Button leftSection={<IconPlus size={16} />} onClick={handleNew}>Novo</Button></Group>
        </Group>
        <Table striped highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th>Código</Table.Th><Table.Th>Descrição</Table.Th><Table.Th>Tipo</Table.Th><Table.Th>Status</Table.Th><Table.Th className="w-32">Ações</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>{items.map((item: any) => (
            <Table.Tr key={item.id}><Table.Td>{item.codigo}</Table.Td><Table.Td>{item.descricao}</Table.Td>
              <Table.Td><Badge color="primary" variant="light">{getTipoLabel(item.tipo)}</Badge></Table.Td>
              <Table.Td><Badge color={item.status ? 'green' : 'gray'}>{item.status ? 'Ativo' : 'Inativo'}</Badge></Table.Td>
              <Table.Td><Group gap={4}><Tooltip label="Capacidade por Nível"><ActionIcon variant="subtle" color="blue" onClick={() => setCapacidadeItem({ id: item.id, descricao: item.descricao })}><IconStack2 size={18} /></ActionIcon></Tooltip><Tooltip label="Editar"><ActionIcon variant="subtle" color="gray" onClick={() => handleEdit(item)}><IconEdit size={18} /></ActionIcon></Tooltip><Tooltip label="Excluir"><ActionIcon variant="subtle" color="red" onClick={() => handleDelete(item.id, item.descricao)}><IconTrash size={18} /></ActionIcon></Tooltip></Group></Table.Td>
            </Table.Tr>))}
            {!isLoading && items.length === 0 && <Table.Tr><Table.Td colSpan={5} className="text-center py-8 text-zinc-500">Nenhum registro</Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>
      </Card>

      {capacidadeItem && (
        <div className="mt-4">
          <CapacidadeNivelPanel
            estruturaId={capacidadeItem.id}
            estruturaDescricao={capacidadeItem.descricao}
            onClose={() => setCapacidadeItem(null)}
          />
        </div>
      )}
      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Editar Estrutura' : 'Nova Estrutura'} centered closeOnClickOutside={false} size="lg">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-4">
            <Controller name="descricao" control={control} render={({ field }) => (<TextInput label={<>Descrição <span style={{ color: 'red' }}>*</span></>} error={errors.descricao?.message} {...field} />)} />
            <Controller name="tipo" control={control} render={({ field }) => (<Select label={<>Tipo <span style={{ color: 'red' }}>*</span></>} data={TIPOS} error={errors.tipo?.message} {...field} />)} />
            <Text size="sm" fw={600} mt="xs">Capacidade</Text>
            <Controller name="capacidade" control={control} render={({ field }) => (
              <NumberInput label="Capacidade (kg)" decimalScale={3} min={0} {...field} value={field.value ?? ''} onChange={(v) => field.onChange(v === '' ? null : v)} />
            )} />
            <Text size="sm" fw={600} mt="xs">Dimensões</Text>
            <div className="flex gap-4 w-full">
              <Controller name="largura" control={control} render={({ field }) => (
                <NumberInput label="Largura (m)" className="w-4/12" decimalScale={3} min={0} {...field} value={field.value ?? ''} onChange={(v) => field.onChange(v === '' ? null : v)} />
              )} />
              <Controller name="altura" control={control} render={({ field }) => (
                <NumberInput label="Altura (m)" className="w-4/12" decimalScale={3} min={0} {...field} value={field.value ?? ''} onChange={(v) => field.onChange(v === '' ? null : v)} />
              )} />
              <Controller name="comprimento" control={control} render={({ field }) => (
                <NumberInput label="Comprimento (m)" className="w-4/12" decimalScale={3} min={0} {...field} value={field.value ?? ''} onChange={(v) => field.onChange(v === '' ? null : v)} />
              )} />
            </div>
            <NumberInput label="Cubagem (m³)" decimalScale={6} readOnly value={cubagem ?? ''} variant="filled" description="Calculado automaticamente (largura × altura × comprimento)" />
          </div>
          <Group justify="flex-end" mt="md"><Button variant="default" onClick={() => setModalOpen(false)}>Cancelar</Button><Button type="submit" loading={criar.isPending || atualizar.isPending}>Salvar</Button></Group>
        </form>
      </Modal>
    </div>
  )
}
