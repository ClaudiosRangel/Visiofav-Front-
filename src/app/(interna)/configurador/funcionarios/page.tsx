'use client'

import { useState } from 'react'
import { Button, Card, Group, Text, TextInput, Table, Badge, ActionIcon, Tooltip, Modal, Select, LoadingOverlay } from '@mantine/core'
import { IconPlus, IconSearch, IconEdit, IconTrash, IconRefresh } from '@tabler/icons-react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { notifications } from '@mantine/notifications'
import { useFuncionarios, useCriarFuncionario, useAtualizarFuncionario, useExcluirFuncionario } from '@/data/hooks/useFuncionario'
import { useCentrosDistribuicao } from '@/data/hooks/useCentroDistribuicao'

const schema = z.object({ nome: z.string().min(1, 'Nome é obrigatório'), matricula: z.string().optional(), tipo: z.string().min(1, 'Tipo é obrigatório'), centroDistribuicaoId: z.string().min(1, 'CD é obrigatório') })
type FormValues = z.infer<typeof schema>

const TIPOS = [{ value: 'OPERADOR', label: 'Operador' }, { value: 'CONFERENTE', label: 'Conferente' }, { value: 'LIDER', label: 'Líder' }, { value: 'SUPERVISOR', label: 'Supervisor' }]

export default function FuncionariosPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [search, setSearch] = useState('')

  const { data: response, isLoading, refetch } = useFuncionarios({ search: search || undefined })
  const { data: cdsResp } = useCentrosDistribuicao({ limit: 100 })
  const criar = useCriarFuncionario()
  const atualizar = useAtualizarFuncionario()
  const excluir = useExcluirFuncionario()
  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const cdOptions = (cdsResp?.data || []).map((c: any) => ({ value: c.id, label: c.nome || c.descricao || c.codigo || '' }))

  function handleNew() { setEditItem(null); reset({ nome: '', matricula: '', tipo: '', centroDistribuicaoId: cdOptions[0]?.value || '' }); setModalOpen(true) }
  function handleEdit(item: any) { setEditItem(item); reset({ nome: item.nome, matricula: item.matricula || '', tipo: item.tipo, centroDistribuicaoId: item.centroDistribuicaoId }); setModalOpen(true) }
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
      <Text size="xs" c="dimmed" mb={4}>Início / Configurador / Funcionários</Text>
      <Text size="xl" fw={600} mb="lg">Funcionários</Text>
      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Group justify="space-between" mb="md">
          <TextInput placeholder="Pesquisar..." leftSection={<IconSearch size={16} />} value={search} onChange={(e) => setSearch(e.currentTarget.value)} className="w-72" />
          <Group><Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button><Button leftSection={<IconPlus size={16} />} onClick={handleNew}>Novo</Button></Group>
        </Group>
        <Table striped highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th>Código</Table.Th><Table.Th>Nome</Table.Th><Table.Th>Matrícula</Table.Th><Table.Th>Tipo</Table.Th><Table.Th>Presente</Table.Th><Table.Th>Status</Table.Th><Table.Th className="w-24">Ações</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>{items.map((item: any) => (
            <Table.Tr key={item.id}><Table.Td>{item.codigo}</Table.Td><Table.Td>{item.nome}</Table.Td><Table.Td>{item.matricula}</Table.Td>
              <Table.Td><Badge color="primary" variant="light">{TIPOS.find(t => t.value === item.tipo)?.label || item.tipo}</Badge></Table.Td>
              <Table.Td><Badge color={item.presente ? 'green' : 'gray'} variant="dot">{item.presente ? 'Sim' : 'Não'}</Badge></Table.Td>
              <Table.Td><Badge color={item.status ? 'green' : 'gray'}>{item.status ? 'Ativo' : 'Inativo'}</Badge></Table.Td>
              <Table.Td><Group gap={4}><Tooltip label="Editar"><ActionIcon variant="subtle" color="gray" onClick={() => handleEdit(item)}><IconEdit size={18} /></ActionIcon></Tooltip><Tooltip label="Excluir"><ActionIcon variant="subtle" color="red" onClick={() => handleDelete(item.id, item.nome)}><IconTrash size={18} /></ActionIcon></Tooltip></Group></Table.Td>
            </Table.Tr>))}
            {!isLoading && items.length === 0 && <Table.Tr><Table.Td colSpan={7} className="text-center py-8 text-zinc-500">Nenhum registro</Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>
      </Card>
      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Editar Funcionário' : 'Novo Funcionário'} centered closeOnClickOutside={false}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-4">
            <Controller name="centroDistribuicaoId" control={control} render={({ field }) => (<Select label={<>CD <span style={{ color: 'red' }}>*</span></>} data={cdOptions} error={errors.centroDistribuicaoId?.message} searchable value={field.value || null} onChange={field.onChange} />)} />
            <Controller name="nome" control={control} render={({ field }) => (<TextInput label={<>Nome <span style={{ color: 'red' }}>*</span></>} error={errors.nome?.message} {...field} />)} />
            <div className="flex gap-4 w-full">
              <Controller name="matricula" control={control} render={({ field }) => (<TextInput label="Matrícula" className="w-6/12" {...field} />)} />
              <Controller name="tipo" control={control} render={({ field }) => (<Select label={<>Tipo <span style={{ color: 'red' }}>*</span></>} data={TIPOS} error={errors.tipo?.message} className="w-6/12" {...field} />)} />
            </div>
          </div>
          <Group justify="flex-end" mt="md"><Button variant="default" onClick={() => setModalOpen(false)}>Cancelar</Button><Button type="submit" loading={criar.isPending || atualizar.isPending}>Salvar</Button></Group>
        </form>
      </Modal>
    </div>
  )
}
