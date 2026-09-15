'use client'

import { useState, useEffect } from 'react'
import {
  Button, Card, Group, Text, TextInput, NumberInput, Select, Table, Badge,
  ActionIcon, Tooltip, Modal, LoadingOverlay, Pagination, Checkbox,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { IconPlus, IconRefresh, IconCash, IconX, IconArrowBackUp, IconChecks } from '@tabler/icons-react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { notifications } from '@mantine/notifications'
import { modals } from '@mantine/modals'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { titulosApi } from '@/hooks/financeiro/useFinanceiroApi'
import { DocumentoFinanceiroForm } from '@/components/financeiro/DocumentoFinanceiroForm'

const FORMAS = [
  { value: 'DINHEIRO', label: 'Dinheiro' }, { value: 'BOLETO', label: 'Boleto' },
  { value: 'PIX', label: 'PIX' }, { value: 'CARTAO_CREDITO', label: 'Cartão Crédito' },
  { value: 'CHEQUE', label: 'Cheque' }, { value: 'TRANSFERENCIA', label: 'Transferência' },
]

const statusColors: Record<string, string> = { ABERTA: 'blue', PAGA: 'green', VENCIDA: 'red' }

const criarSchema = z.object({
  descricao: z.string().min(1, 'Obrigatório').max(300),
  valor: z.number().positive('Valor > 0'),
  dataVencimento: z.date({ required_error: 'Obrigatório' }),
  fornecedorId: z.string().optional(),
  formaPagamento: z.string().optional(),
})

const pagarSchema = z.object({
  valorPago: z.number().positive('Valor > 0'),
  formaPagamento: z.string().min(1, 'Obrigatório'),
})

type CriarValues = z.infer<typeof criarSchema>
type PagarValues = z.infer<typeof pagarSchema>

export default function ContasPagarPage() {
  useModuloGuard('FINANCEIRO')
  useEffect(() => { document.title = 'Vizor - Financeiro - Contas a Pagar' }, [])
  const queryClient = useQueryClient()
  const [criarModal, setCriarModal] = useState(false)
  const [docFormOpen, setDocFormOpen] = useState(false)
  const [pagarModal, setPagarModal] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [selecionados, setSelecionados] = useState<string[]>([])
  const [loteModal, setLoteModal] = useState(false)
  const [loteForma, setLoteForma] = useState<string | null>('PIX')
  const limit = 20

  const { data: response, isLoading, refetch } = useQuery<any>({
    queryKey: ['contas-pagar', { status: statusFilter, page, limit }],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit }
      if (statusFilter) params.status = statusFilter
      const { data } = await api.get('/contas-pagar', { params })
      return data
    },
  })

  const { data: fornecedoresData } = useQuery<any>({
    queryKey: ['fornecedores-select'],
    queryFn: async () => { const { data } = await api.get('/fornecedores', { params: { limit: 100, status: 'true' } }); return data },
  })

  const criar = useMutation({
    mutationFn: async (body: any) => { const { data } = await api.post('/contas-pagar', body); return data },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contas-pagar'] }); setCriarModal(false); notifications.show({ title: 'Sucesso', message: 'Conta criada', color: 'green' }) },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) },
  })

  const pagar = useMutation({
    mutationFn: async ({ id, ...body }: PagarValues & { id: string }) => { const { data } = await api.patch(`/contas-pagar/${id}/pagar`, body); return data },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contas-pagar'] }); setPagarModal(null); notifications.show({ title: 'Sucesso', message: 'Pagamento registrado', color: 'green' }) },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) },
  })

  const cancelar = useMutation({
    mutationFn: (id: string) => titulosApi.cancelarPagar(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contas-pagar'] }); notifications.show({ color: 'green', message: 'Título cancelado' }) },
    onError: (e: any) => notifications.show({ color: 'red', message: e?.response?.data?.message || 'Falha' }),
  })
  const estornar = useMutation({
    mutationFn: (id: string) => titulosApi.estornarPagar(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['contas-pagar'] }); notifications.show({ color: 'green', message: 'Pagamento estornado' }) },
    onError: (e: any) => notifications.show({ color: 'red', message: e?.response?.data?.message || 'Falha' }),
  })
  const baixarLote = useMutation({
    mutationFn: () => titulosApi.baixarLotePagar({ ids: selecionados, formaPagamento: loteForma }),
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ['contas-pagar'] })
      setLoteModal(false); setSelecionados([])
      notifications.show({ color: 'green', message: `${r.sucesso.length} pago(s), ${r.ignorados.length} ignorado(s)` })
    },
    onError: (e: any) => notifications.show({ color: 'red', message: e?.response?.data?.message || 'Falha' }),
  })

  const criarForm = useForm<CriarValues>({ resolver: zodResolver(criarSchema) })
  const pagarForm = useForm<PagarValues>({ resolver: zodResolver(pagarSchema) })

  const items = response?.data || []
  const total = response?.total || 0
  const totalPages = Math.ceil(total / limit)
  const fornecedorOptions = (fornecedoresData?.data || []).map((f: any) => ({ value: f.id, label: f.razaoSocial }))

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Financeiro / Contas a Pagar</Text>
      <Text size="xl" fw={600} mb="lg">Contas a Pagar</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Group justify="space-between" mb="md">
          <Select placeholder="Status" data={[{ value: 'ABERTA', label: 'Aberta' }, { value: 'PAGA', label: 'Paga' }, { value: 'VENCIDA', label: 'Vencida' }]} value={statusFilter} onChange={(v) => { setStatusFilter(v); setPage(1) }} clearable className="w-40" />
          <Group>
            {selecionados.length > 0 && (
              <Button color="green" leftSection={<IconChecks size={16} />} onClick={() => setLoteModal(true)}>Pagar {selecionados.length} selecionado(s)</Button>
            )}
            <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
            <Button leftSection={<IconPlus size={16} />} onClick={() => setDocFormOpen(true)}>Nova Conta</Button>
          </Group>
        </Group>

        <DocumentoFinanceiroForm tipo="pagar" opened={docFormOpen} onClose={() => setDocFormOpen(false)} onSaved={() => queryClient.invalidateQueries({ queryKey: ['contas-pagar'] })} />

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={40} />
              <Table.Th>Descrição</Table.Th>
              <Table.Th>Fornecedor</Table.Th>
              <Table.Th>Valor</Table.Th>
              <Table.Th>Vencimento</Table.Th>
              <Table.Th>Parcela</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th className="w-20">Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any) => {
              const aberto = item.status === 'ABERTA'
              const pago = item.status === 'PAGA'
              const cancelado = item.status === 'CANCELADA'
              return (
              <Table.Tr key={item.id}>
                <Table.Td>
                  {aberto && (
                    <Checkbox
                      checked={selecionados.includes(item.id)}
                      onChange={(e) => setSelecionados((s) => e.currentTarget.checked ? [...s, item.id] : s.filter((x) => x !== item.id))}
                    />
                  )}
                </Table.Td>
                <Table.Td>{item.descricao}</Table.Td>
                <Table.Td>{item.fornecedor?.nomeFantasia || item.fornecedor?.razaoSocial || '—'}</Table.Td>
                <Table.Td>{Number(item.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
                <Table.Td>{new Date(item.dataVencimento).toLocaleDateString('pt-BR')}</Table.Td>
                <Table.Td>{item.totalParcelas > 1 ? `${item.parcela}/${item.totalParcelas}` : '—'}</Table.Td>
                <Table.Td><Badge color={cancelado ? 'gray' : (statusColors[item.statusCalculado] || 'gray')}>{cancelado ? 'CANCELADA' : item.statusCalculado}</Badge></Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    {!pago && !cancelado && (
                      <Tooltip label="Registrar pagamento">
                        <ActionIcon variant="subtle" color="green" onClick={() => { pagarForm.reset({ valorPago: Number(item.valor), formaPagamento: '' }); setPagarModal(item.id) }}>
                          <IconCash size={18} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                    {pago && (
                      <Tooltip label="Estornar pagamento">
                        <ActionIcon variant="subtle" color="orange" onClick={() => modals.openConfirmModal({ title: 'Estornar', children: <Text size="sm">Estornar o pagamento deste título?</Text>, labels: { confirm: 'Estornar', cancel: 'Cancelar' }, confirmProps: { color: 'orange' }, onConfirm: () => estornar.mutate(item.id) })}>
                          <IconArrowBackUp size={18} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                    {aberto && (
                      <Tooltip label="Cancelar título">
                        <ActionIcon variant="subtle" color="red" onClick={() => modals.openConfirmModal({ title: 'Cancelar', children: <Text size="sm">Cancelar este título?</Text>, labels: { confirm: 'Cancelar título', cancel: 'Voltar' }, confirmProps: { color: 'red' }, onConfirm: () => cancelar.mutate(item.id) })}>
                          <IconX size={18} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
              )
            })}
            {!isLoading && items.length === 0 && <Table.Tr><Table.Td colSpan={8} className="text-center py-8 text-zinc-500">Nenhuma conta a pagar</Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>
        {totalPages > 1 && <Group justify="center" mt="md"><Pagination total={totalPages} value={page} onChange={setPage} /></Group>}
      </Card>

      {/* Modal Criar */}
      <Modal opened={criarModal} onClose={() => setCriarModal(false)} title="Nova Conta a Pagar" centered>
        <form onSubmit={criarForm.handleSubmit((data) => criar.mutate({ ...data, dataVencimento: data.dataVencimento.toISOString() }))}>
          <Controller name="descricao" control={criarForm.control} render={({ field }) => <TextInput label="Descrição *" error={criarForm.formState.errors.descricao?.message} mb="sm" {...field} />} />
          <Controller name="valor" control={criarForm.control} render={({ field }) => <NumberInput label="Valor *" prefix="R$ " decimalScale={2} error={criarForm.formState.errors.valor?.message} mb="sm" value={field.value} onChange={(v) => field.onChange(typeof v === 'number' ? v : 0)} />} />
          <Controller name="dataVencimento" control={criarForm.control} render={({ field }) => <DateInput label="Vencimento *" error={criarForm.formState.errors.dataVencimento?.message} mb="sm" value={field.value} onChange={field.onChange} />} />
          <Controller name="fornecedorId" control={criarForm.control} render={({ field }) => <Select label="Fornecedor" data={fornecedorOptions} searchable clearable mb="sm" value={field.value || null} onChange={(v) => field.onChange(v || undefined)} />} />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setCriarModal(false)}>Cancelar</Button>
            <Button type="submit" loading={criar.isPending}>Salvar</Button>
          </Group>
        </form>
      </Modal>

      {/* Modal Pagar */}
      <Modal opened={!!pagarModal} onClose={() => setPagarModal(null)} title="Registrar Pagamento" centered>
        <form onSubmit={pagarForm.handleSubmit((data) => pagar.mutate({ id: pagarModal!, ...data }))}>
          <Controller name="valorPago" control={pagarForm.control} render={({ field }) => <NumberInput label="Valor Pago *" prefix="R$ " decimalScale={2} error={pagarForm.formState.errors.valorPago?.message} mb="sm" value={field.value} onChange={(v) => field.onChange(typeof v === 'number' ? v : 0)} />} />
          <Controller name="formaPagamento" control={pagarForm.control} render={({ field }) => <Select label="Forma de Pagamento *" data={FORMAS} error={pagarForm.formState.errors.formaPagamento?.message} mb="sm" value={field.value} onChange={(v) => field.onChange(v || '')} />} />
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setPagarModal(null)}>Cancelar</Button>
            <Button type="submit" loading={pagar.isPending} color="green">Confirmar Pagamento</Button>
          </Group>
        </form>
      </Modal>

      {/* Modal Baixa em Lote */}
      <Modal opened={loteModal} onClose={() => setLoteModal(false)} title={`Pagar ${selecionados.length} título(s) em lote`} centered>
        <Select label="Forma de pagamento" data={FORMAS} value={loteForma} onChange={setLoteForma} mb="md" />
        <Text size="sm" c="dimmed" mb="md">Cada título será pago pelo seu valor total. Títulos já pagos ou cancelados são ignorados.</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setLoteModal(false)}>Cancelar</Button>
          <Button color="green" loading={baixarLote.isPending} onClick={() => baixarLote.mutate()}>Confirmar</Button>
        </Group>
      </Modal>
    </div>
  )
}
