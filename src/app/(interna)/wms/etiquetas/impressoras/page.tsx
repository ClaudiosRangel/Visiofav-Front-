'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, Modal, TextInput, Select,
  NumberInput, Stack, LoadingOverlay, ActionIcon, Pagination,
} from '@mantine/core'
import {
  IconPlus, IconEdit, IconTestPipe, IconPrinter,
} from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const STATUS_COLORS: Record<string, string> = {
  ONLINE: 'green',
  OFFLINE: 'red',
  ERRO: 'orange',
}

const MODELO_OPTIONS = [
  { value: 'ZEBRA', label: 'Zebra' },
  { value: 'ELGIN', label: 'Elgin' },
  { value: 'GENERICA', label: 'Genérica' },
]

export default function ImpressorasPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - Impressoras de Rede' }, [])

  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)

  const [form, setForm] = useState({
    nome: '',
    modelo: '',
    ip: '',
    porta: 9100,
    localizacao: '',
  })

  const { data: resp, isLoading } = useQuery<any>({
    queryKey: ['etiquetas-zpl-impressoras', page],
    queryFn: async () => {
      const { data } = await api.get('/etiquetas-zpl/impressoras', { params: { page, limit: 20 } })
      return data
    },
  })

  const impressoras = resp?.data || resp || []
  const total = resp?.total || 0
  const totalPages = Math.ceil(total / 20)

  const salvar = useMutation({
    mutationFn: async (payload: any) => {
      if (editItem) {
        await api.put(`/etiquetas-zpl/impressoras/${editItem.id}`, payload)
      } else {
        await api.post('/etiquetas-zpl/impressoras', payload)
      }
    },
    onSuccess: () => {
      notifications.show({ title: 'Sucesso', message: editItem ? 'Impressora atualizada' : 'Impressora cadastrada', color: 'green' })
      queryClient.invalidateQueries({ queryKey: ['etiquetas-zpl-impressoras'] })
      closeModal()
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' })
    },
  })

  const testar = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/etiquetas-zpl/impressoras/${id}/testar`)
      return data
    },
    onSuccess: (data) => {
      const status = data?.status || data?.resultado
      if (status === 'ONLINE' || data?.sucesso) {
        notifications.show({ title: 'Teste OK', message: 'Impressora online e respondendo', color: 'green' })
      } else {
        notifications.show({ title: 'Teste', message: `Status: ${status || 'Verifique a conexão'}`, color: 'orange' })
      }
      queryClient.invalidateQueries({ queryKey: ['etiquetas-zpl-impressoras'] })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Falha no teste', message: err?.response?.data?.message || 'Impressora não respondeu', color: 'red' })
    },
  })

  function openCreate() {
    setEditItem(null)
    setForm({ nome: '', modelo: '', ip: '', porta: 9100, localizacao: '' })
    setModalOpen(true)
  }

  function openEdit(impressora: any) {
    setEditItem(impressora)
    setForm({
      nome: impressora.nome || '',
      modelo: impressora.modelo || '',
      ip: impressora.ip || '',
      porta: impressora.porta || 9100,
      localizacao: impressora.localizacao || '',
    })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditItem(null)
  }

  function handleSave() {
    if (!form.nome || !form.modelo || !form.ip) {
      notifications.show({ title: 'Atenção', message: 'Preencha nome, modelo e IP', color: 'yellow' })
      return
    }
    salvar.mutate(form)
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Etiquetas ZPL / Impressoras</Text>

      <Group justify="space-between" mb="lg">
        <Text size="xl" fw={600}>Impressoras de Rede</Text>
        <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>
          Nova Impressora
        </Button>
      </Group>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nome</Table.Th>
              <Table.Th>Modelo</Table.Th>
              <Table.Th>IP:Porta</Table.Th>
              <Table.Th>Localização</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Último Check</Table.Th>
              <Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(Array.isArray(impressoras) ? impressoras : []).map((imp: any) => (
              <Table.Tr key={imp.id}>
                <Table.Td fw={500}>{imp.nome}</Table.Td>
                <Table.Td>{imp.modelo}</Table.Td>
                <Table.Td className="font-mono">{imp.ip}:{imp.porta}</Table.Td>
                <Table.Td>{imp.localizacao || '—'}</Table.Td>
                <Table.Td>
                  <Badge variant="filled" color={STATUS_COLORS[imp.status] || 'gray'} size="sm">
                    {imp.status || 'OFFLINE'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {imp.ultimoCheck
                    ? new Date(imp.ultimoCheck).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                    : '—'}
                </Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <ActionIcon variant="light" onClick={() => openEdit(imp)} title="Editar">
                      <IconEdit size={16} />
                    </ActionIcon>
                    <ActionIcon
                      variant="light"
                      color="teal"
                      onClick={() => testar.mutate(imp.id)}
                      loading={testar.isPending}
                      title="Testar conexão"
                    >
                      <IconTestPipe size={16} />
                    </ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {impressoras.length === 0 && !isLoading && (
              <Table.Tr>
                <Table.Td colSpan={7} className="text-center py-8 text-zinc-500">
                  Nenhuma impressora cadastrada
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>

        {totalPages > 1 && (
          <Group justify="center" mt="md">
            <Pagination value={page} onChange={setPage} total={totalPages} />
          </Group>
        )}
      </Card>

      {/* Create/Edit Modal */}
      <Modal opened={modalOpen} onClose={closeModal} title={editItem ? 'Editar Impressora' : 'Nova Impressora'} size="md">
        <Stack gap="sm">
          <TextInput
            label="Nome"
            placeholder="Nome da impressora"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.currentTarget.value })}
          />
          <Select
            label="Modelo"
            placeholder="Selecione o modelo"
            data={MODELO_OPTIONS}
            value={form.modelo}
            onChange={(v) => setForm({ ...form, modelo: v || '' })}
          />
          <Group grow>
            <TextInput
              label="IP"
              placeholder="192.168.1.100"
              value={form.ip}
              onChange={(e) => setForm({ ...form, ip: e.currentTarget.value })}
            />
            <NumberInput
              label="Porta"
              value={form.porta}
              onChange={(v) => setForm({ ...form, porta: typeof v === 'number' ? v : 9100 })}
              min={1}
              max={65535}
            />
          </Group>
          <TextInput
            label="Localização"
            placeholder="Ex: Setor A, Doca 3"
            value={form.localizacao}
            onChange={(e) => setForm({ ...form, localizacao: e.currentTarget.value })}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={closeModal}>Cancelar</Button>
            <Button onClick={handleSave} loading={salvar.isPending}>
              {editItem ? 'Salvar' : 'Cadastrar'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  )
}
