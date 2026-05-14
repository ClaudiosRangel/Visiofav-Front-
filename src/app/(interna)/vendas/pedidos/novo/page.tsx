'use client'

import { Suspense } from 'react'
import { Button, Card, Group, Text, Select, NumberInput, Table, ActionIcon, Tooltip, LoadingOverlay } from '@mantine/core'
import { IconPlus, IconTrash, IconArrowLeft } from '@tabler/icons-react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useRouter, useSearchParams } from 'next/navigation'

const formSchema = z.object({
  clienteId: z.string().min(1, 'Cliente é obrigatório'),
  vendedorId: z.string().optional(),
  tabelaPrecoId: z.string().min(1, 'Tabela de preço é obrigatória'),
  condicaoPagId: z.string().optional(),
  itens: z.array(z.object({
    produtoId: z.string().min(1, 'Produto é obrigatório'),
    quantidade: z.number().positive('Quantidade > 0'),
    unidade: z.string().optional(),
    precoUnitario: z.number().min(0).optional(),
    desconto: z.number().min(0).max(100).optional(),
  })).min(1, 'Pelo menos um item'),
})

type FormValues = z.infer<typeof formSchema>

export default function NovoPedidoVendaPage() {
  return (
    <Suspense fallback={<LoadingOverlay visible />}>
      <NovoPedidoVendaContent />
    </Suspense>
  )
}

function NovoPedidoVendaContent() {
  useModuloGuard('VENDAS')
  const router = useRouter()
  const searchParams = useSearchParams()
  const editId = searchParams.get('editId')
  const isEditing = !!editId

  const { control, handleSubmit, watch, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { clienteId: '', vendedorId: '', tabelaPrecoId: '', condicaoPagId: '', itens: [{ produtoId: '', quantidade: 1, unidade: '', precoUnitario: 0, desconto: 0 }] },
  })

  const { fields, append, remove, replace } = useFieldArray({ control, name: 'itens' })

  // Carregar pedido existente para edição
  const { data: pedidoExistente } = useQuery<any>({
    queryKey: ['pedido-venda-edit', editId],
    queryFn: async () => { const { data } = await api.get(`/pedidos-venda/${editId}`); return data },
    enabled: !!editId,
  })

  // Preencher formulário quando pedido carrega
  useEffect(() => {
    if (pedidoExistente && isEditing) {
      reset({
        clienteId: pedidoExistente.clienteId || '',
        vendedorId: pedidoExistente.vendedorId || '',
        tabelaPrecoId: pedidoExistente.tabelaPrecoId || '',
        condicaoPagId: '',
        itens: (pedidoExistente.itens || []).map((item: any) => ({
          produtoId: item.produtoId,
          quantidade: Number(item.quantidade),
          unidade: item.produto?.unidade || item.unidade || 'UN',
          precoUnitario: Number(item.precoFinal || item.precoBase || 0),
          desconto: 0,
        })),
      })
    }
  }, [pedidoExistente, isEditing, reset])

  const { data: clientesData } = useQuery<any>({ queryKey: ['clientes-select'], queryFn: async () => { const { data } = await api.get('/clientes', { params: { limit: 100, status: 'true' } }); return data } })
  const { data: vendedoresData } = useQuery<any>({ queryKey: ['vendedores-select'], queryFn: async () => { const { data } = await api.get('/vendedores', { params: { limit: 100, status: 'true' } }); return data } })
  const { data: tabelasData } = useQuery<any>({ queryKey: ['tabelas-preco-select'], queryFn: async () => { const { data } = await api.get('/tabelas-preco', { params: { limit: 50 } }); return data } })
  const { data: produtosData } = useQuery<any>({ queryKey: ['produtos-select'], queryFn: async () => { const { data } = await api.get('/produtos', { params: { limit: 200, status: 'true' } }); return data } })

  const tabelaPrecoId = watch('tabelaPrecoId')
  const tabelaSelecionada = (tabelasData?.data || []).find((t: any) => t.id === tabelaPrecoId)
  const condicaoOptions = (tabelaSelecionada?.condicoes || []).map((c: any) => ({
    value: c.id,
    label: `${c.formaPagamento} ${c.parcelas}x ${Number(c.percentual) > 0 ? '+' : ''}${Number(c.percentual).toFixed(1)}%`,
  }))

  const criar = useMutation({
    mutationFn: async (body: any) => {
      if (isEditing) {
        const { data } = await api.put(`/pedidos-venda/${editId}`, body)
        return data
      }
      const { data } = await api.post('/pedidos-venda', body)
      return data
    },
  })

  async function onSubmit(data: FormValues) {
    try {
      const payload: any = { clienteId: data.clienteId, tabelaPrecoId: data.tabelaPrecoId, itens: data.itens }
      if (data.vendedorId) payload.vendedorId = data.vendedorId
      if (data.condicaoPagId) payload.condicaoPagId = data.condicaoPagId
      await criar.mutateAsync(payload)
      notifications.show({ title: 'Sucesso', message: isEditing ? 'Pedido atualizado' : 'Pedido de venda criado', color: 'green' })
      router.push(isEditing ? `/vendas/pedidos/${editId}` : '/vendas/pedidos')
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' })
    }
  }

  const clienteOptions = (clientesData?.data || []).map((c: any) => ({ value: c.id, label: c.razaoSocial }))
  const vendedorOptions = (vendedoresData?.data || []).map((v: any) => ({ value: v.id, label: v.nome }))
  const tabelaOptions = (tabelasData?.data || []).filter((t: any) => t.status).map((t: any) => ({ value: t.id, label: t.nome }))
  const produtoOptions = (produtosData?.data || []).map((p: any) => ({ value: p.id, label: `${p.codigo} — ${p.nome}` }))

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Vendas / Pedidos / {isEditing ? 'Editar' : 'Novo'}</Text>
      <Group mb="lg">
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => router.push(isEditing ? `/vendas/pedidos/${editId}` : '/vendas/pedidos')}>Voltar</Button>
        <Text size="xl" fw={600}>{isEditing ? `Editar Pedido #${pedidoExistente?.numero || ''}` : 'Novo Pedido de Venda'}</Text>
      </Group>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card mb="md">
          <Text fw={500} mb="sm">Dados do Pedido</Text>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Controller name="clienteId" control={control} render={({ field }) => (
              <Select label={<>Cliente <span style={{ color: 'red' }}>*</span></>} data={clienteOptions} searchable error={errors.clienteId?.message} value={field.value} onChange={(v) => field.onChange(v || '')} />
            )} />
            <Controller name="vendedorId" control={control} render={({ field }) => (
              <Select label="Vendedor" data={vendedorOptions} searchable clearable value={field.value || null} onChange={(v) => field.onChange(v || '')} />
            )} />
            <Controller name="tabelaPrecoId" control={control} render={({ field }) => (
              <Select label={<>Tabela de Preço <span style={{ color: 'red' }}>*</span></>} data={tabelaOptions} error={errors.tabelaPrecoId?.message} value={field.value} onChange={(v) => field.onChange(v || '')} />
            )} />
            <Controller name="condicaoPagId" control={control} render={({ field }) => (
              <Select label="Condição de Pagamento" data={condicaoOptions} clearable disabled={!tabelaPrecoId} value={field.value || null} onChange={(v) => field.onChange(v || '')} />
            )} />
          </div>
        </Card>

        <Card mb="md">
          <Group justify="space-between" mb="sm">
            <Text fw={500}>Itens</Text>
            <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => append({ produtoId: '', quantidade: 1, unidade: '', precoUnitario: 0, desconto: 0 })}>Adicionar</Button>
          </Group>

          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Produto</Table.Th>
                <Table.Th className="w-24">Unidade</Table.Th>
                <Table.Th className="w-32">Quantidade</Table.Th>
                <Table.Th className="w-32">Preço Unit.</Table.Th>
                <Table.Th className="w-28">Desc. %</Table.Th>
                <Table.Th className="w-32">Valor Total</Table.Th>
                <Table.Th className="w-16"></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {fields.map((field, idx) => {
                const produtoId = watch(`itens.${idx}.produtoId`)
                const qtd = watch(`itens.${idx}.quantidade`) || 0
                const desc = watch(`itens.${idx}.desconto`) || 0
                const precoUnit = watch(`itens.${idx}.precoUnitario`) || 0
                const produtoSel = (produtosData?.data || []).find((p: any) => p.id === produtoId)
                const valorTotal = qtd * precoUnit * (1 - desc / 100)

                return (
                  <Table.Tr key={field.id}>
                    <Table.Td>
                      <Controller name={`itens.${idx}.produtoId`} control={control} render={({ field: f }) => (
                        <Select data={produtoOptions} searchable error={errors.itens?.[idx]?.produtoId?.message} value={f.value} onChange={(v) => { f.onChange(v || ''); const prod = (produtosData?.data || []).find((p: any) => p.id === v); if (prod) { control._formValues.itens[idx].unidade = prod.unidade || 'UN'; control._formValues.itens[idx].precoUnitario = Number(prod.precoBase) || 0 } }} size="xs" />
                      )} />
                    </Table.Td>
                    <Table.Td>
                      <Controller name={`itens.${idx}.unidade`} control={control} render={({ field: f }) => (
                        <Select data={['UN', 'KG', 'CX', 'PC', 'MT', 'LT', 'FD', 'SC'].map(u => ({ value: u, label: u }))} value={f.value || produtoSel?.unidade || 'UN'} onChange={(v) => f.onChange(v || 'UN')} size="xs" />
                      )} />
                    </Table.Td>
                    <Table.Td>
                      <Controller name={`itens.${idx}.quantidade`} control={control} render={({ field: f }) => (
                        <NumberInput min={0.0001} decimalScale={4} error={errors.itens?.[idx]?.quantidade?.message} value={f.value} onChange={(v) => f.onChange(typeof v === 'number' ? v : 0)} size="xs" />
                      )} />
                    </Table.Td>
                    <Table.Td>
                      <Controller name={`itens.${idx}.precoUnitario`} control={control} render={({ field: f }) => (
                        <NumberInput min={0} decimalScale={4} prefix="R$ " value={f.value || 0} onChange={(v) => f.onChange(typeof v === 'number' ? v : 0)} size="xs" />
                      )} />
                    </Table.Td>
                    <Table.Td>
                      <Controller name={`itens.${idx}.desconto`} control={control} render={({ field: f }) => (
                        <NumberInput min={0} max={100} decimalScale={2} suffix="%" value={f.value || 0} onChange={(v) => f.onChange(typeof v === 'number' ? v : 0)} size="xs" />
                      )} />
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" fw={600}>{valorTotal.toFixed(2)}</Text>
                    </Table.Td>
                    <Table.Td>
                      {fields.length > 1 && <Tooltip label="Remover"><ActionIcon variant="subtle" color="red" size="sm" onClick={() => remove(idx)}><IconTrash size={14} /></ActionIcon></Tooltip>}
                    </Table.Td>
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
          <Text size="sm" c="dimmed" mt="sm">Os preços são calculados com base na tabela de preço, condição e desconto informado.</Text>
        </Card>

        <Group justify="flex-end">
          <Button variant="default" onClick={() => router.push(isEditing ? `/vendas/pedidos/${editId}` : '/vendas/pedidos')}>Cancelar</Button>
          <Button type="submit" loading={criar.isPending}>{isEditing ? 'Salvar Alterações' : 'Criar Pedido'}</Button>
        </Group>
      </form>
    </div>
  )
}
