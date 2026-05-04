'use client'

import { useState, useEffect } from 'react'
import {
  Button, Card, Group, Text, TextInput, NumberInput, Select, Table, Badge,
  ActionIcon, Tooltip, Modal, LoadingOverlay, Pagination, Textarea, TagsInput,
} from '@mantine/core'
import { IconPlus, IconRefresh, IconX, IconFileText } from '@tabler/icons-react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const statusColors: Record<string, string> = { PENDENTE: 'gray', AUTORIZADO: 'green', REJEITADO: 'red', CANCELADO: 'orange' }

const formSchema = z.object({
  remetenteId: z.string().min(1, 'Remetente é obrigatório'),
  destinatarioId: z.string().min(1, 'Destinatário é obrigatório'),
  descricaoCarga: z.string().min(1).max(300),
  valorCarga: z.number().positive(),
  valorFrete: z.number().positive(),
  chavesNfeRef: z.array(z.string()).optional(),
})

type FormValues = z.infer<typeof formSchema>

export default function CtePage() {
  useModuloGuard('CTE')
  useEffect(() => { document.title = 'VisioFab - Fiscal - CT-e' }, [])
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [page, setPage] = useState(1)
  const limit = 20

  const { data: response, isLoading, refetch } = useQuery<any>({
    queryKey: ['cte', { page, limit }],
    queryFn: async () => { const { data } = await api.get('/cte', { params: { page, limit } }); return data },
  })

  const { data: clientesData } = useQuery<any>({ queryKey: ['clientes-select'], queryFn: async () => { const { data } = await api.get('/clientes', { params: { limit: 100 } }); return data } })
  const { data: fornecedoresData } = useQuery<any>({ queryKey: ['fornecedores-select'], queryFn: async () => { const { data } = await api.get('/fornecedores', { params: { limit: 100 } }); return data } })

  const participantes = [
    ...(clientesData?.data || []).map((c: any) => ({ value: c.id, label: `[C] ${c.razaoSocial}` })),
    ...(fornecedoresData?.data || []).map((f: any) => ({ value: f.id, label: `[F] ${f.razaoSocial}` })),
  ]

  const criar = useMutation({
    mutationFn: async (body: FormValues) => { const { data } = await api.post('/cte', body); return data },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['cte'] }); setModalOpen(false); notifications.show({ title: 'Sucesso', message: 'CT-e emitido', color: 'green' }) },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) },
  })

  const cancelar = useMutation({
    mutationFn: async (id: string) => {
      const justificativa = prompt('Justificativa (mín. 15 caracteres):')
      if (!justificativa || justificativa.length < 15) throw new Error('Justificativa deve ter no mínimo 15 caracteres')
      const { data } = await api.post(`/cte/${id}/cancelar`, { justificativa })
      return data
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['cte'] }); notifications.show({ title: 'Sucesso', message: 'CT-e cancelado', color: 'green' }) },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' }) },
  })

  const { control, handleSubmit, formState: { errors }, reset } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { remetenteId: '', destinatarioId: '', descricaoCarga: '', valorCarga: 0, valorFrete: 0, chavesNfeRef: [] },
  })

  const items = response?.data || []
  const total = response?.total || 0
  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Fiscal / CT-e</Text>
      <Text size="xl" fw={600} mb="lg">Conhecimento de Transporte Eletrônico</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Group justify="flex-end" mb="md">
          <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
          <Button leftSection={<IconPlus size={16} />} onClick={() => { reset(); setModalOpen(true) }}>Emitir CT-e</Button>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Número</Table.Th>
              <Table.Th>Série</Table.Th>
              <Table.Th>Descrição Carga</Table.Th>
              <Table.Th>Valor Frete</Table.Th>
              <Table.Th>NF-e Ref.</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th className="w-24">Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td fw={500}>{item.numero}</Table.Td>
                <Table.Td>{item.serie}</Table.Td>
                <Table.Td>{item.descricaoCarga}</Table.Td>
                <Table.Td>{Number(item.valorFrete).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
                <Table.Td>{item.nfesReferencia?.length || 0}</Table.Td>
                <Table.Td><Badge color={statusColors[item.status] || 'gray'}>{item.status}</Badge></Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    {item.status === 'AUTORIZADO' && <Tooltip label="Cancelar"><ActionIcon variant="subtle" color="red" onClick={() => cancelar.mutate(item.id)}><IconX size={18} /></ActionIcon></Tooltip>}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && items.length === 0 && <Table.Tr><Table.Td colSpan={7} className="text-center py-8 text-zinc-500">Nenhum CT-e emitido</Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>
        {totalPages > 1 && <Group justify="center" mt="md"><Pagination total={totalPages} value={page} onChange={setPage} /></Group>}
      </Card>

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="Emitir CT-e" size="lg" centered closeOnClickOutside={false}>
        <form onSubmit={handleSubmit((data) => criar.mutate(data))}>
          <div className="flex flex-col gap-4">
            <Controller name="remetenteId" control={control} render={({ field }) => (
              <Select label="Remetente *" data={participantes} searchable error={errors.remetenteId?.message} value={field.value} onChange={(v) => field.onChange(v || '')} />
            )} />
            <Controller name="destinatarioId" control={control} render={({ field }) => (
              <Select label="Destinatário *" data={participantes} searchable error={errors.destinatarioId?.message} value={field.value} onChange={(v) => field.onChange(v || '')} />
            )} />
            <Controller name="descricaoCarga" control={control} render={({ field }) => (
              <TextInput label="Descrição da Carga *" error={errors.descricaoCarga?.message} {...field} />
            )} />
            <div className="grid grid-cols-2 gap-4">
              <Controller name="valorCarga" control={control} render={({ field }) => (
                <NumberInput label="Valor da Carga *" prefix="R$ " decimalScale={2} error={errors.valorCarga?.message} value={field.value} onChange={(v) => field.onChange(typeof v === 'number' ? v : 0)} />
              )} />
              <Controller name="valorFrete" control={control} render={({ field }) => (
                <NumberInput label="Valor do Frete *" prefix="R$ " decimalScale={2} error={errors.valorFrete?.message} value={field.value} onChange={(v) => field.onChange(typeof v === 'number' ? v : 0)} />
              )} />
            </div>
            <Controller name="chavesNfeRef" control={control} render={({ field }) => (
              <TagsInput label="Chaves NF-e de Referência" placeholder="Cole a chave de 44 dígitos e pressione Enter" value={field.value || []} onChange={field.onChange} />
            )} />
          </div>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={criar.isPending}>Emitir</Button>
          </Group>
        </form>
      </Modal>
    </div>
  )
}
