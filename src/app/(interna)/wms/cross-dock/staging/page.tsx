'use client'

import { useState, useEffect } from 'react'
import {
  Button, Card, Group, Text, TextInput, Table, Badge, ActionIcon,
  Tooltip, Modal, NumberInput, LoadingOverlay, Switch,
} from '@mantine/core'
import { IconPlus, IconSearch, IconEdit, IconRefresh } from '@tabler/icons-react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const schema = z.object({
  nome: z.string().min(1, 'Obrigatório'),
  enderecoId: z.string().min(1, 'Obrigatório'),
  docaId: z.string().min(1, 'Obrigatório'),
  capacidade: z.number().min(1, 'Mínimo 1').max(100, 'Máximo 100'),
})

type FormValues = z.infer<typeof schema>

export default function StagingAreasPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Staging Areas' }, [])

  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [search, setSearch] = useState('')

  const { data: response, isLoading, refetch } = useQuery<any>({
    queryKey: ['staging-areas', search],
    queryFn: async () => {
      const params: any = {}
      if (search) params.search = search
      const { data } = await api.get('/cross-dock/staging-areas', { params })
      return data
    },
  })

  const criar = useMutation({
    mutationFn: async (data: FormValues) => {
      const { data: resp } = await api.post('/cross-dock/staging-areas', data)
      return resp
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staging-areas'] })
      notifications.show({ title: 'Sucesso', message: 'Staging area criada', color: 'green' })
      setModalOpen(false)
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao salvar', color: 'red' })
    },
  })

  const atualizar = useMutation({
    mutationFn: async ({ id, ...data }: FormValues & { id: string }) => {
      const { data: resp } = await api.put(`/cross-dock/staging-areas/${id}`, data)
      return resp
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staging-areas'] })
      notifications.show({ title: 'Sucesso', message: 'Staging area atualizada', color: 'green' })
      setModalOpen(false)
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao salvar', color: 'red' })
    },
  })

  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { nome: '', enderecoId: '', docaId: '', capacidade: 100 },
  })

  function handleNew() {
    setEditItem(null)
    reset({ nome: '', enderecoId: '', docaId: '', capacidade: 100 })
    setModalOpen(true)
  }

  function handleEdit(item: any) {
    setEditItem(item)
    reset({
      nome: item.nome,
      enderecoId: item.enderecoId,
      docaId: item.docaId,
      capacidade: item.capacidade,
    })
    setModalOpen(true)
  }

  async function onSubmit(data: FormValues) {
    if (editItem) {
      atualizar.mutate({ id: editItem.id, ...data })
    } else {
      criar.mutate(data)
    }
  }

  const items = Array.isArray(response) ? response : (response?.data || [])

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Expedição / Cross-Docking / Staging Areas</Text>
      <Text size="xl" fw={600} mb="lg">Staging Areas</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Group justify="space-between" mb="md">
          <TextInput
            placeholder="Pesquisar..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            className="w-72"
          />
          <Group>
            <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>
              Atualizar
            </Button>
            <Button leftSection={<IconPlus size={16} />} onClick={handleNew}>
              Nova Staging Area
            </Button>
          </Group>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nome</Table.Th>
              <Table.Th>Endereço ID</Table.Th>
              <Table.Th>Doca ID</Table.Th>
              <Table.Th>Capacidade</Table.Th>
              <Table.Th>Ocupação Atual</Table.Th>
              <Table.Th>Ativo</Table.Th>
              <Table.Th className="w-20">Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td fw={500}>{item.nome}</Table.Td>
                <Table.Td className="font-mono text-sm">{item.enderecoId}</Table.Td>
                <Table.Td className="font-mono text-sm">{item.docaId}</Table.Td>
                <Table.Td>{item.capacidade}%</Table.Td>
                <Table.Td>
                  <Badge
                    variant="light"
                    color={
                      (item.ocupacaoAtual || 0) >= 90 ? 'red' :
                      (item.ocupacaoAtual || 0) >= 70 ? 'yellow' : 'green'
                    }
                  >
                    {item.ocupacaoAtual ?? 0}%
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge color={item.ativo ? 'green' : 'gray'}>
                    {item.ativo ? 'Ativo' : 'Inativo'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Tooltip label="Editar">
                    <ActionIcon variant="subtle" color="gray" onClick={() => handleEdit(item)}>
                      <IconEdit size={18} />
                    </ActionIcon>
                  </Tooltip>
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && items.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={7} className="text-center py-8 text-zinc-500">
                  Nenhuma staging area cadastrada
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editItem ? 'Editar Staging Area' : 'Nova Staging Area'}
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
                  placeholder="Ex: Staging Doca 01"
                  error={errors.nome?.message}
                  {...field}
                />
              )}
            />
            <div className="flex gap-4 w-full">
              <Controller
                name="enderecoId"
                control={control}
                render={({ field }) => (
                  <TextInput
                    label={<>Endereço ID <span style={{ color: 'red' }}>*</span></>}
                    placeholder="ID do endereço"
                    error={errors.enderecoId?.message}
                    className="w-6/12"
                    {...field}
                  />
                )}
              />
              <Controller
                name="docaId"
                control={control}
                render={({ field }) => (
                  <TextInput
                    label={<>Doca ID <span style={{ color: 'red' }}>*</span></>}
                    placeholder="ID da doca de saída"
                    error={errors.docaId?.message}
                    className="w-6/12"
                    {...field}
                  />
                )}
              />
            </div>
            <Controller
              name="capacidade"
              control={control}
              render={({ field }) => (
                <NumberInput
                  label={<>Capacidade (%) <span style={{ color: 'red' }}>*</span></>}
                  placeholder="100"
                  min={1}
                  max={100}
                  error={errors.capacidade?.message}
                  {...field}
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
    </div>
  )
}
