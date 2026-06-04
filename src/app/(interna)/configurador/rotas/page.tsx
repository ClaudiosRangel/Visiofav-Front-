'use client'

import { useState } from 'react'
import {
  Card, Table, Badge, Button, Modal, TextInput, Select, Group, Text,
  LoadingOverlay, ActionIcon, Tooltip,
} from '@mantine/core'
import { IconPlus, IconEdit, IconTrash, IconRefresh, IconMap } from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { CoberturaRotaModal } from '@/components/geo/CoberturaRotaModal'
import { CoberturaConsolidadaModal } from '@/components/geo/CoberturaConsolidadaModal'

const schema = z.object({
  codigo: z.string().min(1, 'Código é obrigatório').max(20),
  descricao: z.string().min(1, 'Descrição é obrigatória').max(200),
  transportadoraId: z.string().nullable().optional(),
})

type FormValues = z.infer<typeof schema>

export default function RotasPage() {
  useModuloGuard('WMS')

  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [coberturaRota, setCoberturaRota] = useState<{ id: string; descricao: string } | null>(null)
  const [coberturaConsolidadaOpen, setCoberturaConsolidadaOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data: response, isLoading } = useQuery<any>({
    queryKey: ['rotas', { status: statusFilter }],
    queryFn: async () => {
      const params: Record<string, any> = {}
      if (statusFilter !== null) params.status = statusFilter
      const { data } = await api.get('/rotas', { params })
      return data
    },
  })

  const { data: transportadoras } = useQuery<any>({
    queryKey: ['transportadoras'],
    queryFn: async () => {
      const { data } = await api.get('/transportadoras')
      return data
    },
  })

  const criar = useMutation({
    mutationFn: async (body: FormValues) => {
      const { data } = await api.post('/rotas', body)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rotas'] }),
  })

  const atualizar = useMutation({
    mutationFn: async ({ id, ...body }: FormValues & { id: string }) => {
      const { data } = await api.put(`/rotas/${id}`, body)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rotas'] }),
  })

  const desativar = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.patch(`/rotas/${id}/desativar`)
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['rotas'] }),
  })

  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  function handleNew() {
    setEditItem(null)
    reset({ codigo: '', descricao: '', transportadoraId: null })
    setModalOpen(true)
  }

  function handleEdit(item: any) {
    setEditItem(item)
    reset({
      codigo: item.codigo,
      descricao: item.descricao,
      transportadoraId: item.transportadoraId || null,
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
        message: editItem ? 'Rota atualizada' : 'Rota criada',
        color: 'green',
      })
      setModalOpen(false)
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Falha ao salvar'
      notifications.show({ title: 'Erro', message: msg, color: 'red' })
    }
  }

  async function handleDesativar(id: string, desc: string) {
    if (!confirm(`Deseja desativar a rota "${desc}"?`)) return
    try {
      await desativar.mutateAsync(id)
      notifications.show({ title: 'Sucesso', message: 'Rota desativada', color: 'green' })
    } catch {
      notifications.show({ title: 'Erro', message: 'Falha ao desativar', color: 'red' })
    }
  }

  const items = response?.data || []
  const transportadoraOptions = (transportadoras?.data || []).map((t: any) => ({
    value: t.id,
    label: t.razaoSocial,
  }))

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Configurador / Rotas</Text>
      <Text size="xl" fw={600} mb="lg">Rotas</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Group justify="space-between" mb="md">
          <Group>
            <Select
              placeholder="Filtrar por status"
              clearable
              data={[
                { value: 'true', label: 'Ativo' },
                { value: 'false', label: 'Inativo' },
              ]}
              value={statusFilter}
              onChange={setStatusFilter}
              className="w-48"
            />
          </Group>
          <Group>
            <Button
              variant="default"
              leftSection={<IconMap size={16} />}
              onClick={() => setCoberturaConsolidadaOpen(true)}
            >
              Cobertura Consolidada
            </Button>
            <Button
              variant="default"
              leftSection={<IconRefresh size={16} />}
              onClick={() => queryClient.invalidateQueries({ queryKey: ['rotas'] })}
            >
              Atualizar
            </Button>
            <Button leftSection={<IconPlus size={16} />} onClick={handleNew}>
              Nova Rota
            </Button>
          </Group>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Código</Table.Th>
              <Table.Th>Descrição</Table.Th>
              <Table.Th>Transportadora</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th className="w-24">Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td>{item.codigo}</Table.Td>
                <Table.Td>{item.descricao}</Table.Td>
                <Table.Td>{item.transportadora?.razaoSocial || '-'}</Table.Td>
                <Table.Td>
                  <Badge color={item.status ? 'green' : 'gray'}>
                    {item.status ? 'Ativo' : 'Inativo'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <Tooltip label="Ver Cobertura">
                      <ActionIcon variant="subtle" color="blue" onClick={() => setCoberturaRota({ id: item.id, descricao: item.descricao })}>
                        <IconMap size={18} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Editar">
                      <ActionIcon variant="subtle" color="gray" onClick={() => handleEdit(item)}>
                        <IconEdit size={18} />
                      </ActionIcon>
                    </Tooltip>
                    {item.status && (
                      <Tooltip label="Desativar">
                        <ActionIcon variant="subtle" color="red" onClick={() => handleDesativar(item.id, item.descricao)}>
                          <IconTrash size={18} />
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
                  Nenhuma rota encontrada
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editItem ? 'Editar Rota' : 'Nova Rota'}
        centered
        closeOnClickOutside={false}
      >
        <form onSubmit={handleSubmit(onSubmit)}>
          {/* MAIN FIELDS - Always visible at top */}
          <div className="flex flex-col gap-4 mb-4">
            <Controller
              name="codigo"
              control={control}
              render={({ field }) => (
                <TextInput
                  label={<>Código <span style={{ color: 'red' }}>*</span></>}
                  error={errors.codigo?.message}
                  disabled={!!editItem}
                  {...field}
                />
              )}
            />
            <Controller
              name="descricao"
              control={control}
              render={({ field }) => (
                <TextInput
                  label={<>Descrição <span style={{ color: 'red' }}>*</span></>}
                  error={errors.descricao?.message}
                  {...field}
                />
              )}
            />
          </div>

          {/* SECONDARY FIELDS - Dados */}
          <div className="flex flex-col gap-4">
            <Controller
              name="transportadoraId"
              control={control}
              render={({ field }) => (
                <Select
                  label="Transportadora"
                  placeholder="Selecione..."
                  clearable
                  searchable
                  data={transportadoraOptions}
                  value={field.value || null}
                  onChange={field.onChange}
                />
              )}
            />
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

      <CoberturaRotaModal
        opened={!!coberturaRota}
        onClose={() => setCoberturaRota(null)}
        rotaId={coberturaRota?.id ?? ''}
        rotaDescricao={coberturaRota?.descricao ?? ''}
      />

      <CoberturaConsolidadaModal
        opened={coberturaConsolidadaOpen}
        onClose={() => setCoberturaConsolidadaOpen(false)}
      />
    </div>
  )
}
