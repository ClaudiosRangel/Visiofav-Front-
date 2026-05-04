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
  Badge,
  ActionIcon,
  Tooltip,
  Modal,
  Textarea,
  LoadingOverlay,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { IconArrowLeft, IconPlus, IconTrash, IconCheck, IconX } from '@tabler/icons-react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useRouter, useParams } from 'next/navigation'

const statusColors: Record<string, string> = {
  RASCUNHO: 'gray',
  CONFIRMADO: 'blue',
  RECEBIDO: 'green',
  CANCELADO: 'red',
}

const itemSchema = z.object({
  produtoId: z.string().min(1, 'Produto é obrigatório'),
  quantidade: z.number().positive('Quantidade deve ser maior que zero'),
  precoUnitario: z.number().positive('Preço deve ser maior que zero'),
  classificacao: z.enum(['REVENDA', 'MATERIA_PRIMA']),
})

const editSchema = z.object({
  fornecedorId: z.string().min(1, 'Fornecedor é obrigatório'),
  vendedorId: z.string().optional(),
  dataEntrega: z.date().nullable().optional(),
  itens: z.array(itemSchema).min(1, 'Pelo menos um item é obrigatório'),
})

type EditFormValues = z.infer<typeof editSchema>

export default function DetalhePedidoCompraPage() {
  useModuloGuard('COMPRAS')

  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const queryClient = useQueryClient()

  const [cancelModalOpen, setCancelModalOpen] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [isEditing, setIsEditing] = useState(false)

  const { data: pedido, isLoading } = useQuery<any>({
    queryKey: ['pedido-compra', id],
    queryFn: async () => {
      const { data } = await api.get(`/pedidos-compra/${id}`)
      return data
    },
  })

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

  const { control, handleSubmit, watch, reset, formState: { errors } } = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'itens' })
  const itensWatch = watch('itens')

  const atualizar = useMutation({
    mutationFn: async (body: any) => {
      const { data } = await api.put(`/pedidos-compra/${id}`, body)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedido-compra', id] })
      queryClient.invalidateQueries({ queryKey: ['pedidos-compra'] })
      setIsEditing(false)
      notifications.show({ title: 'Sucesso', message: 'Pedido atualizado', color: 'green' })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao atualizar', color: 'red' })
    },
  })

  const confirmar = useMutation({
    mutationFn: async () => {
      const { data } = await api.patch(`/pedidos-compra/${id}/confirmar`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedido-compra', id] })
      queryClient.invalidateQueries({ queryKey: ['pedidos-compra'] })
      notifications.show({ title: 'Sucesso', message: 'Pedido confirmado', color: 'green' })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao confirmar', color: 'red' })
    },
  })

  const cancelarMut = useMutation({
    mutationFn: async (motivo: string) => {
      const { data } = await api.patch(`/pedidos-compra/${id}/cancelar`, { motivo })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedido-compra', id] })
      queryClient.invalidateQueries({ queryKey: ['pedidos-compra'] })
      setCancelModalOpen(false)
      setMotivo('')
      notifications.show({ title: 'Sucesso', message: 'Pedido cancelado', color: 'green' })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao cancelar', color: 'red' })
    },
  })

  function startEditing() {
    if (!pedido) return
    reset({
      fornecedorId: pedido.fornecedor?.id || pedido.fornecedorId,
      vendedorId: pedido.vendedor?.id || pedido.vendedorId || '',
      dataEntrega: pedido.dataEntrega ? new Date(pedido.dataEntrega) : null,
      itens: pedido.itens.map((item: any) => ({
        produtoId: item.produto?.id || item.produtoId,
        quantidade: Number(item.quantidade),
        precoUnitario: Number(item.precoUnitario),
        classificacao: item.classificacao,
      })),
    })
    setIsEditing(true)
  }

  async function onSubmitEdit(data: EditFormValues) {
    const payload: any = {
      fornecedorId: data.fornecedorId,
      vendedorId: data.vendedorId || null,
      dataEntrega: data.dataEntrega ? data.dataEntrega.toISOString() : null,
      itens: data.itens.map((item) => ({
        produtoId: item.produtoId,
        quantidade: item.quantidade,
        precoUnitario: item.precoUnitario,
        classificacao: item.classificacao,
      })),
    }
    atualizar.mutate(payload)
  }

  function handleConfirmar() {
    if (!confirm('Deseja confirmar este pedido?')) return
    confirmar.mutate()
  }

  function handleCancelar() {
    if (motivo.length < 10) {
      notifications.show({ title: 'Erro', message: 'Motivo deve ter no mínimo 10 caracteres', color: 'red' })
      return
    }
    cancelarMut.mutate(motivo)
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

  const calcItemTotal = (idx: number) => {
    const item = itensWatch?.[idx]
    if (!item) return 0
    return Number(((item.quantidade || 0) * (item.precoUnitario || 0)).toFixed(2))
  }

  const editGrandTotal = (itensWatch || []).reduce((sum: number, _: any, idx: number) => sum + calcItemTotal(idx), 0)

  if (isLoading) {
    return (
      <Card pos="relative" mih={200}>
        <LoadingOverlay visible />
      </Card>
    )
  }

  if (!pedido) {
    return (
      <div>
        <Text size="xl" fw={600}>Pedido não encontrado</Text>
        <Button mt="md" onClick={() => router.push('/compras/pedidos')}>Voltar</Button>
      </div>
    )
  }

  const isRascunho = pedido.status === 'RASCUNHO'
  const canCancel = ['RASCUNHO', 'CONFIRMADO'].includes(pedido.status)

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Compras / Pedidos / #{pedido.numero}</Text>
      <Group mb="lg">
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => router.push('/compras/pedidos')}>
          Voltar
        </Button>
        <Text size="xl" fw={600}>Pedido #{pedido.numero}</Text>
        <Badge color={statusColors[pedido.status] || 'gray'} size="lg">
          {pedido.status}
        </Badge>
      </Group>

      {/* View mode */}
      {!isEditing && (
        <>
          <Card mb="md">
            <Text fw={500} mb="sm">Dados do Pedido</Text>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Text size="sm" c="dimmed">Fornecedor</Text>
                <Text>{pedido.fornecedor?.nomeFantasia || pedido.fornecedor?.razaoSocial}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">Vendedor</Text>
                <Text>{pedido.vendedor?.nome || '—'}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">Data de Entrega</Text>
                <Text>
                  {pedido.dataEntrega
                    ? new Date(pedido.dataEntrega).toLocaleDateString('pt-BR')
                    : '—'}
                </Text>
              </div>
            </div>
          </Card>

          <Card mb="md">
            <Text fw={500} mb="sm">Itens</Text>
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Produto</Table.Th>
                  <Table.Th>Quantidade</Table.Th>
                  <Table.Th>Preço Unitário</Table.Th>
                  <Table.Th>Classificação</Table.Th>
                  <Table.Th>Total</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {pedido.itens.map((item: any) => (
                  <Table.Tr key={item.id}>
                    <Table.Td>{item.produto?.nome || item.produtoId}</Table.Td>
                    <Table.Td>{Number(item.quantidade)}</Table.Td>
                    <Table.Td>
                      {Number(item.precoUnitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={item.classificacao === 'REVENDA' ? 'blue' : 'orange'}>
                        {item.classificacao === 'REVENDA' ? 'Revenda' : 'Matéria Prima'}
                      </Badge>
                    </Table.Td>
                    <Table.Td fw={500}>
                      {Number(item.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            <Group justify="flex-end" mt="md">
              <Text size="lg" fw={600}>
                Total: {Number(pedido.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </Text>
            </Group>
          </Card>

          {pedido.motivoCancelamento && (
            <Card mb="md">
              <Text fw={500} mb="sm">Motivo do Cancelamento</Text>
              <Text>{pedido.motivoCancelamento}</Text>
            </Card>
          )}

          <Group justify="flex-end">
            {isRascunho && (
              <>
                <Button variant="default" onClick={startEditing}>
                  Editar
                </Button>
                <Button color="blue" leftSection={<IconCheck size={16} />} onClick={handleConfirmar}>
                  Confirmar
                </Button>
              </>
            )}
            {canCancel && (
              <Button color="red" variant="light" leftSection={<IconX size={16} />} onClick={() => setCancelModalOpen(true)}>
                Cancelar Pedido
              </Button>
            )}
          </Group>
        </>
      )}

      {/* Edit mode */}
      {isEditing && (
        <form onSubmit={handleSubmit(onSubmitEdit)}>
          <Card mb="md">
            <Text fw={500} mb="sm">Dados do Pedido</Text>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Controller
                name="fornecedorId"
                control={control}
                render={({ field }) => (
                  <Select
                    label={<>Fornecedor <span style={{ color: 'red' }}>*</span></>}
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
                Total: {editGrandTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </Text>
            </Group>
          </Card>

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setIsEditing(false)}>
              Cancelar Edição
            </Button>
            <Button type="submit" loading={atualizar.isPending}>
              Salvar Alterações
            </Button>
          </Group>
        </form>
      )}

      {/* Cancel Modal */}
      <Modal
        opened={cancelModalOpen}
        onClose={() => { setCancelModalOpen(false); setMotivo('') }}
        title="Cancelar Pedido"
        centered
      >
        <Textarea
          label="Motivo do cancelamento"
          description="Mínimo de 10 caracteres"
          placeholder="Informe o motivo do cancelamento..."
          minRows={3}
          value={motivo}
          onChange={(e) => setMotivo(e.currentTarget.value)}
          error={motivo.length > 0 && motivo.length < 10 ? 'Mínimo de 10 caracteres' : undefined}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => { setCancelModalOpen(false); setMotivo('') }}>
            Voltar
          </Button>
          <Button
            color="red"
            onClick={handleCancelar}
            loading={cancelarMut.isPending}
            disabled={motivo.length < 10}
          >
            Confirmar Cancelamento
          </Button>
        </Group>
      </Modal>
    </div>
  )
}
