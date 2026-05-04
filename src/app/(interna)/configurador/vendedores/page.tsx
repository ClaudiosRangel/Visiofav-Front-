'use client'

import { useState } from 'react'
import {
  Button,
  Card,
  Group,
  Text,
  TextInput,
  NumberInput,
  Table,
  Badge,
  ActionIcon,
  Tooltip,
  Modal,
  LoadingOverlay,
  Select,
  Pagination,
} from '@mantine/core'
import {
  IconPlus,
  IconSearch,
  IconEdit,
  IconBan,
  IconRefresh,
} from '@tabler/icons-react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

interface Vendedor {
  id: string
  nome: string
  cpf: string
  comissao: number | string
  status: boolean
  criadoEm: string
  atualizadoEm: string
}

interface VendedoresResponse {
  data: Vendedor[]
  total: number
}

const schema = z.object({
  nome: z.string().min(1, 'Nome é obrigatório').max(150, 'Máximo 150 caracteres'),
  cpf: z.string().min(1, 'CPF é obrigatório'),
  comissao: z.number({ required_error: 'Comissão é obrigatória' }).min(0, 'Mínimo 0').max(100, 'Máximo 100'),
})

type FormValues = z.infer<typeof schema>

export default function VendedoresPage() {
  useModuloGuard('VENDAS')

  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Vendedor | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const limit = 20

  const { data: response, isLoading, refetch } = useQuery<VendedoresResponse>({
    queryKey: ['vendedores', { busca: search || undefined, status: statusFilter || undefined, page, limit }],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit }
      if (search) params.busca = search
      if (statusFilter) params.status = statusFilter
      const { data } = await api.get('/vendedores', { params })
      return data
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  })

  const criar = useMutation({
    mutationFn: async (body: FormValues) => {
      const { data } = await api.post('/vendedores', body)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendedores'] }),
  })

  const atualizar = useMutation({
    mutationFn: async ({ id, ...body }: FormValues & { id: string }) => {
      const { data } = await api.put(`/vendedores/${id}`, body)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendedores'] }),
  })

  const inativar = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/vendedores/${id}/inativar`)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['vendedores'] }),
  })

  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  function handleNew() {
    setEditItem(null)
    reset({ nome: '', cpf: '', comissao: 0 })
    setModalOpen(true)
  }

  function handleEdit(item: Vendedor) {
    setEditItem(item)
    reset({
      nome: item.nome,
      cpf: item.cpf,
      comissao: Number(item.comissao),
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
      notifications.show({
        title: 'Sucesso',
        message: editItem ? 'Vendedor atualizado' : 'Vendedor criado',
        color: 'green',
      })
      setModalOpen(false)
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Falha ao salvar'
      notifications.show({ title: 'Erro', message: msg, color: 'red' })
    }
  }

  async function handleInativar(item: Vendedor) {
    if (!confirm(`Deseja inativar o vendedor "${item.nome}"?`)) return
    try {
      await inativar.mutateAsync(item.id)
      notifications.show({ title: 'Sucesso', message: 'Vendedor inativado', color: 'green' })
    } catch {
      notifications.show({ title: 'Erro', message: 'Falha ao inativar', color: 'red' })
    }
  }

  const items = response?.data || []
  const total = response?.total || 0
  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Configurador / Vendedores</Text>
      <Text size="xl" fw={600} mb="lg">Vendedores</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />

        <Group justify="space-between" mb="md">
          <Group>
            <TextInput
              placeholder="Pesquisar por nome..."
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => { setSearch(e.currentTarget.value); setPage(1) }}
              className="w-72"
            />
            <Select
              placeholder="Status"
              data={[
                { value: 'true', label: 'Ativo' },
                { value: 'false', label: 'Inativo' },
              ]}
              value={statusFilter}
              onChange={(val) => { setStatusFilter(val); setPage(1) }}
              clearable
              className="w-40"
            />
          </Group>
          <Group>
            <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>
              Atualizar
            </Button>
            <Button leftSection={<IconPlus size={16} />} onClick={handleNew}>
              Novo
            </Button>
          </Group>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nome</Table.Th>
              <Table.Th>CPF</Table.Th>
              <Table.Th>Comissão (%)</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th className="w-24">Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item) => (
              <Table.Tr key={item.id}>
                <Table.Td>{item.nome}</Table.Td>
                <Table.Td className="text-sm text-zinc-500">{item.cpf}</Table.Td>
                <Table.Td>{Number(item.comissao).toFixed(2)}</Table.Td>
                <Table.Td>
                  <Badge color={item.status ? 'green' : 'gray'}>
                    {item.status ? 'Ativo' : 'Inativo'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <Tooltip label="Editar">
                      <ActionIcon variant="subtle" color="gray" onClick={() => handleEdit(item)}>
                        <IconEdit size={18} />
                      </ActionIcon>
                    </Tooltip>
                    {item.status && (
                      <Tooltip label="Inativar">
                        <ActionIcon variant="subtle" color="red" onClick={() => handleInativar(item)}>
                          <IconBan size={18} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && items.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={5} className="text-center py-8 text-zinc-500">
                  Nenhum vendedor encontrado
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>

        {totalPages > 1 && (
          <Group justify="center" mt="md">
            <Pagination total={totalPages} value={page} onChange={setPage} />
          </Group>
        )}
      </Card>

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editItem ? 'Editar Vendedor' : 'Novo Vendedor'}
        size="lg"
        centered
        closeOnClickOutside={false}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-4">
            <Controller
              name="nome"
              control={control}
              render={({ field }) => (
                <TextInput
                  label={<>Nome <span style={{ color: 'red' }}>*</span></>}
                  error={errors.nome?.message}
                  maxLength={150}
                  {...field}
                />
              )}
            />
            <div className="flex gap-4 w-full">
              <Controller
                name="cpf"
                control={control}
                render={({ field }) => (
                  <TextInput
                    label={<>CPF <span style={{ color: 'red' }}>*</span></>}
                    error={errors.cpf?.message}
                    className="w-6/12"
                    {...field}
                  />
                )}
              />
              <Controller
                name="comissao"
                control={control}
                render={({ field }) => (
                  <NumberInput
                    label={<>Comissão (%) <span style={{ color: 'red' }}>*</span></>}
                    error={errors.comissao?.message}
                    min={0}
                    max={100}
                    decimalScale={2}
                    className="w-6/12"
                    value={field.value}
                    onChange={(val) => field.onChange(typeof val === 'string' ? parseFloat(val) || 0 : val)}
                  />
                )}
              />
            </div>
          </div>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" loading={criar.isPending || atualizar.isPending}>
              Salvar
            </Button>
          </Group>
        </form>
      </Modal>
    </div>
  )
}
