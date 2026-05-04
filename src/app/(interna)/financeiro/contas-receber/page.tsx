'use client'

import { useState, useEffect } from 'react'
import {
  Button, Card, Group, Text, TextInput, NumberInput, Select, Table, Badge,
  ActionIcon, Tooltip, Modal, LoadingOverlay, Pagination,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { IconPlus, IconRefresh, IconCash } from '@tabler/icons-react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const FORMAS = [
  { value: 'DINHEIRO', label: 'Dinheiro' }, { value: 'BOLETO', label: 'Boleto' },
  { value: 'PIX', label: 'PIX' }, { value: 'CARTAO_CREDITO', label: 'Cartão Crédito' },
  { value: 'CHEQUE', label: 'Cheque' }, { value: 'TRANSFERENCIA', label: 'Transferência' },
]

const statusColors: Record<string, string> = { ABERTA: 'blue', RECEBIDA: 'green', VENCIDA: 'red' }

const criarSchema = z.object({
  descricao: z.string().min(1, 'Obrigatório').max(300),
  valor: z.number().positive('Valor > 0'),
  dataVencimento: z.date({ required_error: 'Obrigatório' }),
  clienteId: z.string().optional(),
  formaPagamento: z.string().optional(),
})

const receberSchema = z.object({
  valorRecebido: z.number().positive('Valor > 0'),
  formaPagamento: z.string().min(1, 'Obrigatório'),
})

type CriarValues = z.infer<typeof criarSchema>
type ReceberValues = z.infer<typeof receberSchema>

export default function ContasReceberPage() {
  useModuloGuard('FINANCEIRO')
  useEffect(() => { document.title = 'VisioFab - Financeiro - Contas a Receber' }, [])
  const queryClient = useQueryClient()
  const [criarModal, setCriarModal] = useState(false)
  const [receberModal, setReceberModal] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const limit = 20

  const { data: response, isLoading, refetch } = useQuery<any>({
    queryKey: ['contas-receber', { status: statusFilter, page, limit }],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit }
      if (statusFilter) params.status = statusFilter
      const { data } = await api.get('/contas-receber', { params })
      return data
    },
  })

  const { data: clientesData } = useQuery<any>({
    queryKey: ['clientes-select'],
    queryFn: async () => { const { data } = await api.get('/clientes', { params: { limit: 100, status: 'true' } }); return data },
  })

  const criar = useMutation({
    mutationFn: async (body: any) => { const { data } = await api.post('/contas-receber', body); return data },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contas-receber'] }); setCriarModal(false); notifications.show({ title: 'Sucesso', message: 'Conta criada', color: 'green' }) },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) },
  })

  const receber = useMutation({
    mutationFn: async ({ id, ...body }: ReceberValues & { id: string }) => { const { data } = await api.patch(`/contas-receber/${id}/receber`, body); return data },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contas-receber'] }); setReceberModal(null); notifications.show({ title: 'Sucesso', message: 'Recebimento registrado', color: 'green' }) },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) },
  })

  const criarForm = useForm<CriarValues>({ resolver: zodResolver(criarSchema) })
  const receberForm = useForm<ReceberValues>({ resolver: zodResolver(receberSchema) })

  const items = response?.data || []
  const total = response?.total || 0
  const totalPages = Math.ceil(total / limit)
  const clienteOptions = (clientesData?.data || []).map((c: any) => ({ value: c.id, label: c.razaoSocial }))

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Financeiro / Contas a Receber</Text>
      <Text size="xl" fw={600} mb="lg">Contas a Receber</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Group justify="space-between" mb="md">
          <Select placeholder="Status" data={[{ value: 'ABERTA', label: 'Aberta' }, { value: 'RECEBIDA', label: 'Recebida' }, { value: 'VENCIDA', label: 'Vencida' }]} value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1) }} clearable className="w-40" />
          <Group>
            <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
            <Button leftSection={<IconPlus size={16} />} onClick={() => { criarForm.reset({ descricao: '', valor: undefined as any, dataVencimento: undefined as any }); setCriarModal(true) }}>Nova Conta</Button>
          </Group>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Descrição</Table.Th>
              <Table.Th>Cliente</Table.Th>
              <Table.Th>Valor</Table.Th>
              <Table.Th>Vencimento</Table.Th>
              <Table.Th>Parcela</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th className="w-20">Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td>{item.descricao}</Table.Td>
                <Table.Td>{item.cliente?.nomeFantasia || item.cliente?.razaoSocial || '—'}</Table.Td>
                <Table.Td>{Number(item.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
                <Table.Td>{new Date(item.dataVencimento).toLocaleDateString('pt-BR')}</Table.Td>
                <Table.Td>{item.totalParcelas > 1 ? `${item.parcela}/${item.totalParcelas}` : '—'}</Table.Td>
                <Table.Td><Badge color={statusColors[item.statusCalculado] || 'gray'}>{item.statusCalculado}</Badge></Table.Td>
                <Table.Td>
                  {item.statusCalculado !== 'RECEBIDA' && (
                    <Tooltip label="Registrar recebimento">
                      <ActionIcon variant="subtle" color="green" onClick={() => { receberForm.reset({ valorRecebido: Number(item.valor), formaPagamento: '' }); setReceberModal(item.id) }}>
                        <IconCash size={18} />
                      </ActionIcon>
                    </Tooltip>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && items.length === 0 && <Table.Tr><Table.Td colSpan={7} className="text-center py-8 text-zinc-500">Nenhuma conta a receber</Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>
        {totalPages > 1 && <Group justify="center" mt="md"><Pagination total={totalPages} value={page} onChange={setPage} /></Group>}
      </Card>

      {/* Modal Criar */}
      <Modal opened={criarModal} onClose={() => setCriarModal(false)} title="Nova Conta a Receber" centered>
        <form onSubmit={criarForm.handleSubmit((data) => criar.mutate({ ...data, dataVencimento: data.dataVencimento.toISOString() }))}>
          <Controller name="descricao" control={criarForm.control} render={({ field }) => <TextInput label="Descrição *" error={criarForm.formState.errors.descricao?.message} mb="sm" {...field} />} />
          <Controller name="valor" control={criarForm.control} render={({ field }) => <NumberInput label="Valor *" prefix="R$ " decimalScale={2} error={criarForm.formState.errors.valor?.message} mb="sm" value={field.value} onChange={(v) => field.onChange(typeof v === 'number' ? v : 0)} />} />
          <Controller name="dataVencimento" control={criarForm.control} render={({ field }) => <DateInput label="Vencimento *" error={criarForm.formState.errors.dataVencimento?.message} mb="sm" value={field.value} onChange={field.onChange} />} />
          <Controller name="clienteId" control={criarForm.control} render={({ field }) => <Select label="Cliente" data={clienteOptions} searchable clearable mb="sm" value={field.value || null} onChange={(v) => field.onChange(v || undefined)} />} />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setCriarModal(false)}>Cancelar</Button>
            <Button type="submit" loading={criar.isPending}>Salvar</Button>
          </Group>
        </form>
      </Modal>

      {/* Modal Receber */}
      <Modal opened={!!receberModal} onClose={() => setReceberModal(null)} title="Registrar Recebimento" centered>
        <form onSubmit={receberForm.handleSubmit((data) => receber.mutate({ id: receberModal!, ...data }))}>
          <Controller name="valorRecebido" control={receberForm.control} render={({ field }) => <NumberInput label="Valor Recebido *" prefix="R$ " decimalScale={2} error={receberForm.formState.errors.valorRecebido?.message} mb="sm" value={field.value} onChange={(v) => field.onChange(typeof v === 'number' ? v : 0)} />} />
          <Controller name="formaPagamento" control={receberForm.control} render={({ field }) => <Select label="Forma de Pagamento *" data={FORMAS} error={receberForm.formState.errors.formaPagamento?.message} mb="sm" value={field.value} onChange={(v) => field.onChange(v || '')} />} />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setReceberModal(null)}>Cancelar</Button>
            <Button type="submit" loading={receber.isPending} color="green">Confirmar Recebimento</Button>
          </Group>
        </form>
      </Modal>
    </div>
  )
}
