'use client'

import { useState } from 'react'
import {
  Button, Card, Group, Text, TextInput, NumberInput, Select, Table,
  ActionIcon, Tooltip, Modal, LoadingOverlay, Pagination,
} from '@mantine/core'
import { IconSearch, IconEdit, IconRefresh } from '@tabler/icons-react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const fiscalSchema = z.object({
  ncm: z.string().max(8).optional(),
  cfopEstadual: z.string().max(4).optional(),
  cfopInterest: z.string().max(4).optional(),
  cst: z.string().max(3).optional(),
  csosn: z.string().max(4).optional(),
  aliqICMS: z.number().min(0).max(100).optional(),
  aliqIPI: z.number().min(0).max(100).optional(),
  cstPIS: z.string().max(2).optional(),
  aliqPIS: z.number().min(0).max(100).optional(),
  cstCOFINS: z.string().max(2).optional(),
  aliqCOFINS: z.number().min(0).max(100).optional(),
  origemProd: z.number().int().min(0).max(8).optional(),
  cEAN: z.string().max(14).optional(),
})

type FiscalValues = z.infer<typeof fiscalSchema>

export default function TributacaoPage() {
  useModuloGuard('VENDAS')
  const queryClient = useQueryClient()
  const [editModal, setEditModal] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20

  const { data: response, isLoading, refetch } = useQuery<any>({
    queryKey: ['produtos-fiscal', { busca: search, page, limit }],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit }
      if (search) params.busca = search
      const { data } = await api.get('/produtos', { params })
      return data
    },
  })

  const atualizar = useMutation({
    mutationFn: async ({ id, ...body }: FiscalValues & { id: string }) => {
      const { data } = await api.put(`/produtos/${id}`, body)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['produtos-fiscal'] })
      setEditModal(null)
      notifications.show({ title: 'Sucesso', message: 'Dados fiscais atualizados', color: 'green' })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' })
    },
  })

  const { control, handleSubmit, reset, formState: { errors } } = useForm<FiscalValues>({
    resolver: zodResolver(fiscalSchema),
  })

  function handleEdit(produto: any) {
    setEditModal(produto)
    reset({
      ncm: produto.ncm || '',
      cfopEstadual: produto.cfopEstadual || '',
      cfopInterest: produto.cfopInterest || '',
      cst: produto.cst || '',
      csosn: produto.csosn || '',
      aliqICMS: Number(produto.aliqICMS) || 0,
      aliqIPI: Number(produto.aliqIPI) || 0,
      cstPIS: produto.cstPIS || '',
      aliqPIS: Number(produto.aliqPIS) || 0,
      cstCOFINS: produto.cstCOFINS || '',
      aliqCOFINS: Number(produto.aliqCOFINS) || 0,
      origemProd: produto.origemProd || 0,
      cEAN: produto.cEAN || '',
    })
  }

  const items = response?.data || []
  const total = response?.total || 0
  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Configurador / Tributação</Text>
      <Text size="xl" fw={600} mb="lg">Configuração Fiscal dos Produtos</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Group justify="space-between" mb="md">
          <TextInput placeholder="Buscar produto..." leftSection={<IconSearch size={16} />} value={search} onChange={(e) => { setSearch(e.currentTarget.value); setPage(1) }} className="w-72" />
          <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Código</Table.Th>
              <Table.Th>Produto</Table.Th>
              <Table.Th>NCM</Table.Th>
              <Table.Th>CFOP</Table.Th>
              <Table.Th>CST/CSOSN</Table.Th>
              <Table.Th>ICMS %</Table.Th>
              <Table.Th>PIS %</Table.Th>
              <Table.Th>COFINS %</Table.Th>
              <Table.Th className="w-16">Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td className="font-mono text-sm">{item.codigo}</Table.Td>
                <Table.Td>{item.nome}</Table.Td>
                <Table.Td className="font-mono">{item.ncm || '—'}</Table.Td>
                <Table.Td className="font-mono">{item.cfopEstadual || '—'}</Table.Td>
                <Table.Td className="font-mono">{item.cst || item.csosn || '—'}</Table.Td>
                <Table.Td>{Number(item.aliqICMS).toFixed(2)}</Table.Td>
                <Table.Td>{Number(item.aliqPIS).toFixed(2)}</Table.Td>
                <Table.Td>{Number(item.aliqCOFINS).toFixed(2)}</Table.Td>
                <Table.Td>
                  <Tooltip label="Editar fiscal"><ActionIcon variant="subtle" color="gray" onClick={() => handleEdit(item)}><IconEdit size={18} /></ActionIcon></Tooltip>
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && items.length === 0 && <Table.Tr><Table.Td colSpan={9} className="text-center py-8 text-zinc-500">Nenhum produto</Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>
        {totalPages > 1 && <Group justify="center" mt="md"><Pagination total={totalPages} value={page} onChange={setPage} /></Group>}
      </Card>

      <Modal opened={!!editModal} onClose={() => setEditModal(null)} title={`Dados Fiscais — ${editModal?.nome}`} size="xl" centered closeOnClickOutside={false}>
        <form onSubmit={handleSubmit((data) => atualizar.mutate({ id: editModal.id, ...data }))}>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Controller name="ncm" control={control} render={({ field }) => <TextInput label="NCM" maxLength={8} {...field} />} />
            <Controller name="cEAN" control={control} render={({ field }) => <TextInput label="EAN/GTIN" maxLength={14} {...field} />} />
            <Controller name="origemProd" control={control} render={({ field }) => (
              <Select label="Origem" data={[{ value: '0', label: '0 - Nacional' }, { value: '1', label: '1 - Estrangeira (importação direta)' }, { value: '2', label: '2 - Estrangeira (mercado interno)' }]} value={String(field.value ?? 0)} onChange={(v) => field.onChange(parseInt(v || '0'))} />
            )} />
            <Controller name="cfopEstadual" control={control} render={({ field }) => <TextInput label="CFOP Estadual" maxLength={4} placeholder="5102" {...field} />} />
            <Controller name="cfopInterest" control={control} render={({ field }) => <TextInput label="CFOP Interestadual" maxLength={4} placeholder="6102" {...field} />} />
            <Controller name="cst" control={control} render={({ field }) => <TextInput label="CST ICMS" maxLength={3} placeholder="00" {...field} />} />
            <Controller name="csosn" control={control} render={({ field }) => <TextInput label="CSOSN" maxLength={4} placeholder="102" {...field} />} />
            <Controller name="aliqICMS" control={control} render={({ field }) => <NumberInput label="Alíq. ICMS %" min={0} max={100} decimalScale={2} value={field.value} onChange={(v) => field.onChange(typeof v === 'number' ? v : 0)} />} />
            <Controller name="aliqIPI" control={control} render={({ field }) => <NumberInput label="Alíq. IPI %" min={0} max={100} decimalScale={2} value={field.value} onChange={(v) => field.onChange(typeof v === 'number' ? v : 0)} />} />
            <Controller name="cstPIS" control={control} render={({ field }) => <TextInput label="CST PIS" maxLength={2} placeholder="01" {...field} />} />
            <Controller name="aliqPIS" control={control} render={({ field }) => <NumberInput label="Alíq. PIS %" min={0} max={100} decimalScale={2} value={field.value} onChange={(v) => field.onChange(typeof v === 'number' ? v : 0)} />} />
            <Controller name="cstCOFINS" control={control} render={({ field }) => <TextInput label="CST COFINS" maxLength={2} placeholder="01" {...field} />} />
            <Controller name="aliqCOFINS" control={control} render={({ field }) => <NumberInput label="Alíq. COFINS %" min={0} max={100} decimalScale={2} value={field.value} onChange={(v) => field.onChange(typeof v === 'number' ? v : 0)} />} />
          </div>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setEditModal(null)}>Cancelar</Button>
            <Button type="submit" loading={atualizar.isPending}>Salvar</Button>
          </Group>
        </form>
      </Modal>
    </div>
  )
}
