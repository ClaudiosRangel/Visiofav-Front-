'use client'

import { useState } from 'react'
import { Button, Card, Group, Text, TextInput, Table, Badge, ActionIcon, Tooltip, Modal, Select, NumberInput, LoadingOverlay } from '@mantine/core'
import { IconPlus, IconSearch, IconEdit, IconTrash, IconRefresh } from '@tabler/icons-react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { notifications } from '@mantine/notifications'
import { useDocas, useCriarDoca, useAtualizarDoca, useExcluirDoca } from '@/data/hooks/useDoca'
import { useDepositos } from '@/data/hooks/useDeposito'
import { useCentrosDistribuicao } from '@/data/hooks/useCentroDistribuicao'

const schema = z.object({ descricao: z.string().min(1, 'Obrigatório'), centroDistribuicaoId: z.string().min(1, 'Obrigatório'), depositoId: z.string().min(1, 'Obrigatório'), tipo: z.string().min(1, 'Obrigatório'), comprimentoMax: z.number().optional() })
type FormValues = z.infer<typeof schema>

const estadoColor: Record<string, string> = { LIVRE: 'green', OCUPADA: 'blue', MANUTENCAO: 'red' }

export default function DocasPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [search, setSearch] = useState('')

  const { data: response, isLoading, refetch } = useDocas({ search: search || undefined })
  const { data: cdsResp } = useCentrosDistribuicao({ limit: 100 })
  const { data: depsResp } = useDepositos({ limit: 100 })
  const criar = useCriarDoca()
  const atualizar = useAtualizarDoca()
  const excluir = useExcluirDoca()
  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({ resolver: zodResolver(schema) })

  const cdOptions = (cdsResp?.data || []).map((c: any) => ({ value: c.id, label: c.nome || c.descricao || c.codigo || '—' }))
  const depOptions = (depsResp?.data || []).map((d: any) => ({ value: d.id, label: d.descricao || '—' }))

  function handleNew() { setEditItem(null); reset({ descricao: '', centroDistribuicaoId: cdOptions[0]?.value || '', depositoId: '', tipo: '' }); setModalOpen(true) }
  function handleEdit(item: any) { setEditItem(item); reset({ descricao: item.descricao, centroDistribuicaoId: item.centroDistribuicaoId, depositoId: item.depositoId, tipo: item.tipo, comprimentoMax: item.comprimentoMax || 0 }); setModalOpen(true) }
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
      <Text size="xs" c="dimmed" mb={4}>Início / Configurador / Docas</Text>
      <Text size="xl" fw={600} mb="lg">Docas</Text>
      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Group justify="space-between" mb="md">
          <TextInput placeholder="Pesquisar..." leftSection={<IconSearch size={16} />} value={search} onChange={(e) => setSearch(e.currentTarget.value)} className="w-72" />
          <Group><Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button><Button leftSection={<IconPlus size={16} />} onClick={handleNew}>Novo</Button></Group>
        </Group>
        <Table striped highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th>Código</Table.Th><Table.Th>Descrição</Table.Th><Table.Th>Depósito</Table.Th><Table.Th>Tipo</Table.Th><Table.Th>Estado</Table.Th><Table.Th>Status</Table.Th><Table.Th className="w-24">Ações</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>{items.map((item: any) => (
            <Table.Tr key={item.id}><Table.Td>{item.codigo}</Table.Td><Table.Td>{item.descricao}</Table.Td>
              <Table.Td className="text-sm text-zinc-500">{item.deposito?.descricao}</Table.Td>
              <Table.Td><Badge color="primary" variant="light">{item.tipo}</Badge></Table.Td>
              <Table.Td><Badge color={estadoColor[item.estado] || 'gray'} variant="light">{item.estado}</Badge></Table.Td>
              <Table.Td><Badge color={item.status ? 'green' : 'gray'}>{item.status ? 'Ativo' : 'Inativo'}</Badge></Table.Td>
              <Table.Td><Group gap={4}><Tooltip label="Editar"><ActionIcon variant="subtle" color="gray" onClick={() => handleEdit(item)}><IconEdit size={18} /></ActionIcon></Tooltip><Tooltip label="Excluir"><ActionIcon variant="subtle" color="red" onClick={() => handleDelete(item.id, item.descricao)}><IconTrash size={18} /></ActionIcon></Tooltip></Group></Table.Td>
            </Table.Tr>))}
            {!isLoading && items.length === 0 && <Table.Tr><Table.Td colSpan={7} className="text-center py-8 text-zinc-500">Nenhum registro</Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>
      </Card>
      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Editar Doca' : 'Nova Doca'} centered closeOnClickOutside={false}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-4">
            <Controller name="descricao" control={control} render={({ field }) => (<TextInput label={<>Descrição <span style={{ color: 'red' }}>*</span></>} error={errors.descricao?.message} {...field} />)} />
            <div className="flex gap-4 w-full">
              <Controller name="centroDistribuicaoId" control={control} render={({ field }) => (<Select label={<>CD <span style={{ color: 'red' }}>*</span></>} data={cdOptions} error={errors.centroDistribuicaoId?.message} className="w-6/12" searchable {...field} />)} />
              <Controller name="depositoId" control={control} render={({ field }) => (<Select label={<>Depósito <span style={{ color: 'red' }}>*</span></>} data={depOptions} error={errors.depositoId?.message} className="w-6/12" searchable {...field} />)} />
            </div>
            <div className="flex gap-4 w-full">
              <Controller name="tipo" control={control} render={({ field }) => (<Select label={<>Tipo <span style={{ color: 'red' }}>*</span></>} data={[{ value: 'ENTRADA', label: 'Entrada' }, { value: 'SAIDA', label: 'Saída' }, { value: 'MISTA', label: 'Mista' }]} error={errors.tipo?.message} className="w-6/12" {...field} />)} />
              <Controller name="comprimentoMax" control={control} render={({ field }) => (<NumberInput label="Comprimento Máx. (m)" className="w-6/12" min={0} decimalScale={2} {...field} />)} />
            </div>
          </div>
          <Group justify="flex-end" mt="md"><Button variant="default" onClick={() => setModalOpen(false)}>Cancelar</Button><Button type="submit" loading={criar.isPending || atualizar.isPending}>Salvar</Button></Group>
        </form>
      </Modal>
    </div>
  )
}
