'use client'

import { useState } from 'react'
import {
  Button,
  Card,
  Group,
  Text,
  Select,
  NumberInput,
  Table,
  ActionIcon,
  Tooltip,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { IconPlus, IconTrash, IconArrowLeft } from '@tabler/icons-react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useRouter } from 'next/navigation'

const itemSchema = z.object({
  produtoId: z.string().min(1, 'Produto é obrigatório'),
  quantidade: z.number().positive('Quantidade deve ser maior que zero'),
  precoUnitario: z.number().positive('Preço deve ser maior que zero'),
  classificacao: z.enum(['REVENDA', 'MATERIA_PRIMA']),
})

const formSchema = z.object({
  fornecedorId: z.string().min(1, 'Fornecedor é obrigatório'),
  vendedorId: z.string().optional(),
  dataEntrega: z.date().nullable().optional(),
  itens: z.array(itemSchema).min(1, 'Pelo menos um item é obrigatório'),
})

type FormValues = z.infer<typeof formSchema>

export default function NovoPedidoCompraPage() {
  useModuloGuard('COMPRAS')

  const router = useRouter()

  const { control, handleSubmit, watch, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fornecedorId: '',
      vendedorId: '',
      dataEntrega: null,
      itens: [{ produtoId: '', quantidade: 1, precoUnitario: 0, classificacao: 'REVENDA' }],
    },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'itens' })
  const itensWatch = watch('itens')

  // Fetch fornecedores
  const { data: fornecedoresData } = useQuery<{ data: { id: string; razaoSocial: string }[]; total: number }>({
    queryKey: ['fornecedores-select'],
    queryFn: async () => {
      const { data } = await api.get('/fornecedores', { params: { limit: 100, status: 'true' } })
      return data
    },
    staleTime: 1000 * 60 * 10,
  })

  // Fetch vendedores
  const { data: vendedoresData } = useQuery<{ data: { id: string; nome: string }[]; total: number }>({
    queryKey: ['vendedores-select'],
    queryFn: async () => {
      const { data } = await api.get('/vendedores', { params: { limit: 100, status: 'true' } })
      return data
    },
    staleTime: 1000 * 60 * 10,
  })

  // Fetch produtos
  const { data: produtosData } = useQuery<{ data: { id: string; nome: string; codigo: string }[]; total: number }>({
    queryKey: ['produtos-select'],
    queryFn: async () => {
      const { data } = await api.get('/produtos', { params: { limit: 200, status: 'true' } })
      return data
    },
    staleTime: 1000 * 60 * 10,
  })

  const criar = useMutation({
    mutationFn: async (body: any) => {
      const { data } = await api.post('/pedidos-compra', body)
      return data
    },
  })

  async function onSubmit(data: FormValues) {
    try {
      const payload: any = {
        fornecedorId: data.fornecedorId,
        itens: data.itens.map((item) => ({
          produtoId: item.produtoId,
          quantidade: item.quantidade,
          precoUnitario: item.precoUnitario,
          classificacao: item.classificacao,
        })),
      }
      if (data.vendedorId) payload.vendedorId = data.vendedorId
      if (data.dataEntrega) payload.dataEntrega = data.dataEntrega.toISOString()

      await criar.mutateAsync(payload)
      notifications.show({ title: 'Sucesso', message: 'Pedido de compra criado', color: 'green' })
      router.push('/compras/pedidos')
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Falha ao criar pedido'
      notifications.show({ title: 'Erro', message: msg, color: 'red' })
    }
  }

  const fornecedorOptions = (fornecedoresData?.data || []).map((f) => ({
    value: f.id,
    label: f.razaoSocial,
  }))

  const vendedorOptions = (vendedoresData?.data || []).map((v) => ({
    value: v.id,
    label: v.nome,
  }))

  const produtoOptions = (produtosData?.data || []).map((p) => ({
    value: p.id,
    label: `${p.codigo} — ${p.nome}`,
  }))

  // Calculate totals
  const calcItemTotal = (idx: number) => {
    const item = itensWatch?.[idx]
    if (!item) return 0
    return Number(((item.quantidade || 0) * (item.precoUnitario || 0)).toFixed(2))
  }

  const grandTotal = (itensWatch || []).reduce((sum, _, idx) => sum + calcItemTotal(idx), 0)

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Compras / Pedidos / Novo</Text>
      <Group mb="lg">
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => router.push('/compras/pedidos')}>
          Voltar
        </Button>
        <Text size="xl" fw={600}>Novo Pedido de Compra</Text>
      </Group>

      <form onSubmit={handleSubmit(onSubmit)}>
        <Card mb="md">
          <Text fw={500} mb="sm">Dados do Pedido</Text>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Controller
              name="fornecedorId"
              control={control}
              render={({ field }) => (
                <Select
                  label={<>Fornecedor <span style={{ color: 'red' }}>*</span></>}
                  placeholder="Selecione o fornecedor"
                  data={fornecedorOptions}
                  searchable
                  error={errors.fornecedorId?.message}
                  value={field.value}
                  onChange={(val) => field.onChange(val || '')}
                />
              )}
            />
            <Controller
              name="vendedorId"
              control={control}
              render={({ field }) => (
                <Select
                  label="Vendedor"
                  placeholder="Selecione o vendedor (opcional)"
                  data={vendedorOptions}
                  searchable
                  clearable
                  value={field.value || null}
                  onChange={(val) => field.onChange(val || '')}
                />
              )}
            />
            <Controller
              name="dataEntrega"
              control={control}
              render={({ field }) => (
                <DateInput
                  label="Data de Entrega"
                  placeholder="Selecione a data"
                  clearable
                  value={field.value}
                  onChange={field.onChange}
                />
              )}
            />
          </div>
        </Card>

        <Card mb="md">
          <Group justify="space-between" mb="sm">
            <Text fw={500}>Itens</Text>
            <Button
              size="xs"
              variant="light"
              leftSection={<IconPlus size={14} />}
              onClick={() => append({ produtoId: '', quantidade: 1, precoUnitario: 0, classificacao: 'REVENDA' })}
            >
              Adicionar Item
            </Button>
          </Group>

          {errors.itens?.message && (
            <Text c="red" size="sm" mb="sm">{errors.itens.message}</Text>
          )}

          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Produto</Table.Th>
                <Table.Th className="w-32">Quantidade</Table.Th>
                <Table.Th className="w-40">Preço Unitário</Table.Th>
                <Table.Th className="w-44">Classificação</Table.Th>
                <Table.Th className="w-32">Total</Table.Th>
                <Table.Th className="w-16"></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {fields.map((field, idx) => (
                <Table.Tr key={field.id}>
                  <Table.Td>
                    <Controller
                      name={`itens.${idx}.produtoId`}
                      control={control}
                      render={({ field: f }) => (
                        <Select
                          placeholder="Selecione"
                          data={produtoOptions}
                          searchable
                          error={errors.itens?.[idx]?.produtoId?.message}
                          value={f.value}
                          onChange={(val) => f.onChange(val || '')}
                          size="xs"
                        />
                      )}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Controller
                      name={`itens.${idx}.quantidade`}
                      control={control}
                      render={({ field: f }) => (
                        <NumberInput
                          min={0.0001}
                          decimalScale={4}
                          error={errors.itens?.[idx]?.quantidade?.message}
                          value={f.value}
                          onChange={(val) => f.onChange(typeof val === 'string' ? parseFloat(val) || 0 : val)}
                          size="xs"
                        />
                      )}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Controller
                      name={`itens.${idx}.precoUnitario`}
                      control={control}
                      render={({ field: f }) => (
                        <NumberInput
                          min={0.0001}
                          decimalScale={4}
                          prefix="R$ "
                          error={errors.itens?.[idx]?.precoUnitario?.message}
                          value={f.value}
                          onChange={(val) => f.onChange(typeof val === 'string' ? parseFloat(val) || 0 : val)}
                          size="xs"
                        />
                      )}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Controller
                      name={`itens.${idx}.classificacao`}
                      control={control}
                      render={({ field: f }) => (
                        <Select
                          data={[
                            { value: 'REVENDA', label: 'Revenda' },
                            { value: 'MATERIA_PRIMA', label: 'Matéria Prima' },
                          ]}
                          value={f.value}
                          onChange={(val) => f.onChange(val || 'REVENDA')}
                          size="xs"
                        />
                      )}
                    />
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {calcItemTotal(idx).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    {fields.length > 1 && (
                      <Tooltip label="Remover">
                        <ActionIcon variant="subtle" color="red" size="sm" onClick={() => remove(idx)}>
                          <IconTrash size={14} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          <Group justify="flex-end" mt="md">
            <Text size="lg" fw={600}>
              Total: {grandTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </Text>
          </Group>
        </Card>

        <Group justify="flex-end">
          <Button variant="default" onClick={() => router.push('/compras/pedidos')}>
            Cancelar
          </Button>
          <Button type="submit" loading={criar.isPending}>
            Criar Pedido
          </Button>
        </Group>
      </form>
    </div>
  )
}
