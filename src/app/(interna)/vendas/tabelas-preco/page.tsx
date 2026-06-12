'use client'

import { useState, useEffect } from 'react'
import {
  Button, Card, Group, Text, TextInput, NumberInput, Select, Table, Badge,
  ActionIcon, Tooltip, Modal, LoadingOverlay, Pagination,
} from '@mantine/core'
import { IconPlus, IconSearch, IconEdit, IconRefresh, IconTrash } from '@tabler/icons-react'
import { useForm, Controller, useFieldArray } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const FORMAS_PAGAMENTO = [
  { value: 'DINHEIRO', label: 'Dinheiro' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'CARTAO_CREDITO', label: 'Cartão de Crédito' },
  { value: 'CARTAO_DEBITO', label: 'Cartão de Débito' },
  { value: 'PIX', label: 'PIX' },
  { value: 'CHEQUE', label: 'Cheque' },
  { value: 'CREDITO_LOJA', label: 'Crédito Loja' },
]

const condicaoSchema = z.object({
  formaPagamento: z.string().min(1, 'Forma é obrigatória'),
  parcelas: z.number().int().positive('Mínimo 1'),
  percentual: z.number().min(-100).max(100),
})

const formSchema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório').max(100),
  condicoes: z.array(condicaoSchema).min(1, 'Pelo menos uma condição'),
})

type FormValues = z.infer<typeof formSchema>

export default function TabelasPrecoPage() {
  useModuloGuard('VENDAS')
  useEffect(() => { document.title = 'Vizor - Vendas - Tabelas de Preço' }, [])
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [page, setPage] = useState(1)
  const limit = 20

  const { data: response, isLoading, refetch } = useQuery<any>({
    queryKey: ['tabelas-preco', { page, limit }],
    queryFn: async () => { const { data } = await api.get('/tabelas-preco', { params: { page, limit } }); return data },
  })

  const criar = useMutation({
    mutationFn: async (body: FormValues) => { const { data } = await api.post('/tabelas-preco', body); return data },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tabelas-preco'] }),
  })

  const atualizar = useMutation({
    mutationFn: async ({ id, ...body }: FormValues & { id: string }) => { const { data } = await api.put(`/tabelas-preco/${id}`, body); return data },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['tabelas-preco'] }),
  })

  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { nome: '', condicoes: [{ formaPagamento: '', parcelas: 1, percentual: 0 }] },
  })

  const { fields, append, remove } = useFieldArray({ control, name: 'condicoes' })

  function handleNew() {
    setEditItem(null)
    reset({ nome: '', condicoes: [{ formaPagamento: '', parcelas: 1, percentual: 0 }] })
    setModalOpen(true)
  }

  function handleEdit(item: any) {
    setEditItem(item)
    reset({
      nome: item.nome,
      condicoes: item.condicoes.map((c: any) => ({
        formaPagamento: c.formaPagamento,
        parcelas: c.parcelas,
        percentual: Number(c.percentual),
      })),
    })
    setModalOpen(true)
  }

  async function onSubmit(data: FormValues) {
    try {
      if (editItem) {
        await atualizar.mutateAsync({ id: editItem.id, ...data })
      } else {
        await criar.mutateAsync(data)
      }
      notifications.show({ title: 'Sucesso', message: editItem ? 'Tabela atualizada' : 'Tabela criada', color: 'green' })
      setModalOpen(false)
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao salvar', color: 'red' })
    }
  }

  const items = response?.data || []
  const total = response?.total || 0
  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Vendas / Tabelas de Preço</Text>
      <Text size="xl" fw={600} mb="lg">Tabelas de Preço</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Group justify="flex-end" mb="md">
          <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
          <Button leftSection={<IconPlus size={16} />} onClick={handleNew}>Nova Tabela</Button>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nome</Table.Th>
              <Table.Th>Condições</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th className="w-20">Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td fw={500}>{item.nome}</Table.Td>
                <Table.Td>
                  {item.condicoes?.map((c: any, i: number) => (
                    <Badge key={i} variant="light" mr={4} mb={2}>
                      {c.formaPagamento} {c.parcelas}x {Number(c.percentual) > 0 ? '+' : ''}{Number(c.percentual).toFixed(1)}%
                    </Badge>
                  ))}
                </Table.Td>
                <Table.Td><Badge color={item.status ? 'green' : 'gray'}>{item.status ? 'Ativa' : 'Inativa'}</Badge></Table.Td>
                <Table.Td>
                  <Tooltip label="Editar">
                    <ActionIcon variant="subtle" color="gray" onClick={() => handleEdit(item)}><IconEdit size={18} /></ActionIcon>
                  </Tooltip>
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && items.length === 0 && (
              <Table.Tr><Table.Td colSpan={4} className="text-center py-8 text-zinc-500">Nenhuma tabela de preço</Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>

        {totalPages > 1 && <Group justify="center" mt="md"><Pagination total={totalPages} value={page} onChange={setPage} /></Group>}
      </Card>

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Editar Tabela' : 'Nova Tabela'} size="xl" centered closeOnClickOutside={false}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Controller name="nome" control={control} render={({ field }) => (
            <TextInput label={<>Nome <span style={{ color: 'red' }}>*</span></>} error={errors.nome?.message} mb="md" {...field} />
          )} />

          <Group justify="space-between" mb="sm">
            <Text fw={500}>Condições de Pagamento</Text>
            <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => append({ formaPagamento: '', parcelas: 1, percentual: 0 })}>
              Adicionar
            </Button>
          </Group>

          <Table striped mb="md">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Forma</Table.Th>
                <Table.Th className="w-28">Parcelas</Table.Th>
                <Table.Th className="w-36">% Acréscimo/Desconto</Table.Th>
                <Table.Th className="w-12"></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {fields.map((field, idx) => (
                <Table.Tr key={field.id}>
                  <Table.Td>
                    <Controller name={`condicoes.${idx}.formaPagamento`} control={control} render={({ field: f }) => (
                      <Select data={FORMAS_PAGAMENTO} error={errors.condicoes?.[idx]?.formaPagamento?.message} value={f.value} onChange={(v) => f.onChange(v || '')} size="xs" />
                    )} />
                  </Table.Td>
                  <Table.Td>
                    <Controller name={`condicoes.${idx}.parcelas`} control={control} render={({ field: f }) => (
                      <NumberInput min={1} error={errors.condicoes?.[idx]?.parcelas?.message} value={f.value} onChange={(v) => f.onChange(typeof v === 'number' ? v : 1)} size="xs" />
                    )} />
                  </Table.Td>
                  <Table.Td>
                    <Controller name={`condicoes.${idx}.percentual`} control={control} render={({ field: f }) => (
                      <NumberInput min={-100} max={100} decimalScale={2} suffix="%" error={errors.condicoes?.[idx]?.percentual?.message} value={f.value} onChange={(v) => f.onChange(typeof v === 'number' ? v : 0)} size="xs" />
                    )} />
                  </Table.Td>
                  <Table.Td>
                    {fields.length > 1 && (
                      <ActionIcon variant="subtle" color="red" size="sm" onClick={() => remove(idx)}><IconTrash size={14} /></ActionIcon>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          <Group justify="flex-end">
            <Button variant="default" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={criar.isPending || atualizar.isPending}>Salvar</Button>
          </Group>
        </form>
      </Modal>
    </div>
  )
}
