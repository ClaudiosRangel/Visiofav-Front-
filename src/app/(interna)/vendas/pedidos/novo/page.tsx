'use client'

import { Button, Card, Group, Text, Select, NumberInput, Table, ActionIcon, Tooltip } from '@mantine/core'
import { IconPlus, IconTrash, IconArrowLeft } from '@tabler/icons-react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useRouter } from 'next/navigation'

const formSchema = z.object({
  clienteId: z.string().min(1, 'Cliente é obrigatório'),
  vendedorId: z.string().optional(),
  tabelaPrecoId: z.string().min(1, 'Tabela de preço é obrigatória'),
  condicaoPagId: z.string().optional(),
  itens: z.array(z.object({
    produtoId: z.string().min(1, 'Produto é obrigatório'),
    quantidade: z.number().positive('Quantidade > 0'),
  })).min(1, 'Pelo menos um item'),
})

type FormValues = z.infer<typeof formSchema>

export default function NovoPedidoVendaPage() {
  useModuloGuard('VENDAS')
  const router = useRouter()

  const { control, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { clienteId: '', vendedorId: '', tabelaPrecoId: '', condicaoPagId: '', itens: [{ produtoId: '', quantidade: 1 }] },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'itens' })

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
    mutationFn: async (body: any) => { const { data } = await api.post('/pedidos-venda', body); return data },
  })

  async function onSubmit(data: FormValues) {
    try {
      const payload: any = { clienteId: data.clienteId, tabelaPrecoId: data.tabelaPrecoId, itens: data.itens }
      if (data.vendedorId) payload.vendedorId = data.vendedorId
      if (data.condicaoPagId) payload.condicaoPagId = data.condicaoPagId
      await criar.mutateAsync(payload)
      notifications.show({ title: 'Sucesso', message: 'Pedido de venda criado', color: 'green' })
      router.push('/vendas/pedidos')
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
      <Text size="xs" c="dimmed" mb={4}>Início / Vendas / Pedidos / Novo</Text>
      <Group mb="lg">
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => router.push('/vendas/pedidos')}>Voltar</Button>
        <Text size="xl" fw={600}>Novo Pedido de Venda</Text>
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
            <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => append({ produtoId: '', quantidade: 1 })}>Adicionar</Button>
          </Group>

          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Produto</Table.Th>
                <Table.Th className="w-40">Quantidade</Table.Th>
                <Table.Th className="w-16"></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {fields.map((field, idx) => (
                <Table.Tr key={field.id}>
                  <Table.Td>
                    <Controller name={`itens.${idx}.produtoId`} control={control} render={({ field: f }) => (
                      <Select data={produtoOptions} searchable error={errors.itens?.[idx]?.produtoId?.message} value={f.value} onChange={(v) => f.onChange(v || '')} size="xs" />
                    )} />
                  </Table.Td>
                  <Table.Td>
                    <Controller name={`itens.${idx}.quantidade`} control={control} render={({ field: f }) => (
                      <NumberInput min={0.0001} decimalScale={4} error={errors.itens?.[idx]?.quantidade?.message} value={f.value} onChange={(v) => f.onChange(typeof v === 'number' ? v : 0)} size="xs" />
                    )} />
                  </Table.Td>
                  <Table.Td>
                    {fields.length > 1 && <Tooltip label="Remover"><ActionIcon variant="subtle" color="red" size="sm" onClick={() => remove(idx)}><IconTrash size={14} /></ActionIcon></Tooltip>}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          <Text size="sm" c="dimmed" mt="sm">Os preços serão calculados automaticamente com base na tabela de preço e condição selecionadas.</Text>
        </Card>

        <Group justify="flex-end">
          <Button variant="default" onClick={() => router.push('/vendas/pedidos')}>Cancelar</Button>
          <Button type="submit" loading={criar.isPending}>Criar Pedido</Button>
        </Group>
      </form>
    </div>
  )
}
