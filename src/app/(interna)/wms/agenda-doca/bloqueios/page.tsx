'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Button, Modal, TextInput, Select, Stack,
  LoadingOverlay, ActionIcon, Pagination,
} from '@mantine/core'
import { DateTimePicker } from '@mantine/dates'
import { IconLock, IconPlus, IconTrash, IconArrowLeft } from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import Link from 'next/link'

export default function BloqueiosDocaPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Bloqueios de Doca' }, [])

  const queryClient = useQueryClient()
  const [createModal, setCreateModal] = useState(false)
  const [page, setPage] = useState(1)
  const [form, setForm] = useState({ docaId: '', dataInicio: null as Date | null, dataFim: null as Date | null, motivo: '' })

  const { data: docasResp } = useQuery<any>({
    queryKey: ['docas-list'],
    queryFn: async () => { const { data } = await api.get('/agenda-doca/timeline', { params: { data: new Date().toISOString().split('T')[0] } }); return data },
  })

  const { data: bloqueiosResp, isLoading } = useQuery<any>({
    queryKey: ['bloqueios-doca', page],
    queryFn: async () => { const { data } = await api.get('/agenda-doca/bloqueios', { params: { page, limit: 20 } }); return data },
  })

  const docas = docasResp?.docas || []
  const bloqueios = bloqueiosResp?.data || bloqueiosResp || []
  const totalPages = Math.ceil((bloqueiosResp?.total || 0) / 20)

  const criarBloqueio = useMutation({
    mutationFn: async (payload: any) => {
      await api.post('/agenda-doca/bloqueios', payload)
    },
    onSuccess: () => {
      notifications.show({ title: 'Sucesso', message: 'Bloqueio criado', color: 'green' })
      queryClient.invalidateQueries({ queryKey: ['bloqueios-doca'] })
      setCreateModal(false)
      setForm({ docaId: '', dataInicio: null, dataFim: null, motivo: '' })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' })
    },
  })

  const removerBloqueio = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/agenda-doca/bloqueios/${id}`)
    },
    onSuccess: () => {
      notifications.show({ title: 'Sucesso', message: 'Bloqueio removido', color: 'green' })
      queryClient.invalidateQueries({ queryKey: ['bloqueios-doca'] })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' })
    },
  })

  function handleCreate() {
    if (!form.docaId || !form.dataInicio || !form.dataFim || !form.motivo) {
      notifications.show({ title: 'Atenção', message: 'Preencha todos os campos', color: 'yellow' })
      return
    }
    criarBloqueio.mutate({
      docaId: form.docaId,
      dataInicio: form.dataInicio.toISOString(),
      dataFim: form.dataFim.toISOString(),
      motivo: form.motivo,
    })
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Recebimento / Agenda de Docas / Bloqueios</Text>

      <Group justify="space-between" mb="lg">
        <Group>
          <Button component={Link} href="/wms/agenda-doca" variant="subtle" leftSection={<IconArrowLeft size={16} />}>
            Voltar
          </Button>
          <Text size="xl" fw={600}>Bloqueios de Doca</Text>
        </Group>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setCreateModal(true)}>
          Novo Bloqueio
        </Button>
      </Group>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Doca</Table.Th>
              <Table.Th>Início</Table.Th>
              <Table.Th>Fim</Table.Th>
              <Table.Th>Motivo</Table.Th>
              <Table.Th>Criado em</Table.Th>
              <Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(Array.isArray(bloqueios) ? bloqueios : []).map((b: any) => (
              <Table.Tr key={b.id}>
                <Table.Td>{b.doca?.nome || b.docaId?.slice(0, 8) || '—'}</Table.Td>
                <Table.Td>
                  {b.dataInicio ? new Date(b.dataInicio).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                </Table.Td>
                <Table.Td>
                  {b.dataFim ? new Date(b.dataFim).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                </Table.Td>
                <Table.Td>{b.motivo}</Table.Td>
                <Table.Td>
                  {b.criadoEm ? new Date(b.criadoEm).toLocaleDateString('pt-BR') : '—'}
                </Table.Td>
                <Table.Td>
                  <ActionIcon variant="light" color="red" onClick={() => removerBloqueio.mutate(b.id)}>
                    <IconTrash size={16} />
                  </ActionIcon>
                </Table.Td>
              </Table.Tr>
            ))}
            {bloqueios.length === 0 && !isLoading && (
              <Table.Tr>
                <Table.Td colSpan={6} className="text-center py-8 text-zinc-500">
                  Nenhum bloqueio cadastrado
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

      {/* Create Modal */}
      <Modal opened={createModal} onClose={() => setCreateModal(false)} title="Novo Bloqueio de Doca" size="md">
        <Stack gap="sm">
          <Select
            label="Doca"
            placeholder="Selecione a doca"
            value={form.docaId}
            onChange={(v) => setForm({ ...form, docaId: v || '' })}
            data={docas.map((d: any) => ({ value: d.id, label: d.nome || d.codigo || d.id }))}
          />
          <DateTimePicker
            label="Data/Hora Início"
            value={form.dataInicio}
            onChange={(v) => setForm({ ...form, dataInicio: v })}
            valueFormat="DD/MM/YYYY HH:mm"
          />
          <DateTimePicker
            label="Data/Hora Fim"
            value={form.dataFim}
            onChange={(v) => setForm({ ...form, dataFim: v })}
            valueFormat="DD/MM/YYYY HH:mm"
          />
          <TextInput
            label="Motivo"
            placeholder="Motivo do bloqueio"
            value={form.motivo}
            onChange={(e) => setForm({ ...form, motivo: e.currentTarget.value })}
          />
          <Group justify="flex-end" mt="md">
            <Button variant="light" onClick={() => setCreateModal(false)}>Cancelar</Button>
            <Button onClick={handleCreate} loading={criarBloqueio.isPending}>Criar Bloqueio</Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  )
}
