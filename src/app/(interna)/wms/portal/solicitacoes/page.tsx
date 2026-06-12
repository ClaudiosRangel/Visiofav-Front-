'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, LoadingOverlay, Select, ActionIcon, Tooltip, Textarea, Modal,
} from '@mantine/core'
import { IconCheck, IconX, IconSearch, IconFilter } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const statusColors: Record<string, string> = {
  PENDENTE: 'orange', APROVADA: 'green', REJEITADA: 'red', EM_ANDAMENTO: 'blue', CONCLUIDA: 'teal',
}

export default function PortalSolicitacoesPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Portal Solicitações' }, [])
  const queryClient = useQueryClient()

  const [filtroStatus, setFiltroStatus] = useState<string | null>(null)
  const [rejeicaoModal, setRejeicaoModal] = useState(false)
  const [rejeicaoId, setRejeicaoId] = useState<string | null>(null)
  const [motivoRejeicao, setMotivoRejeicao] = useState('')

  const { data: response, isLoading } = useQuery<any>({
    queryKey: ['portal-solicitacoes', filtroStatus],
    queryFn: async () => {
      const params = filtroStatus ? { status: filtroStatus } : {}
      const { data } = await api.get('/portal/admin/solicitacoes', { params })
      return data
    },
  })

  const aprovar = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/portal/admin/solicitacoes/${id}/aprovar`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-solicitacoes'] })
      notifications.show({ title: 'Aprovada', message: 'Solicitação aprovada com sucesso', color: 'green' })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao aprovar', color: 'red' })
    },
  })

  const rejeitar = useMutation({
    mutationFn: async () => {
      if (!rejeicaoId) return
      const { data } = await api.post(`/portal/admin/solicitacoes/${rejeicaoId}/rejeitar`, { motivo: motivoRejeicao })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-solicitacoes'] })
      setRejeicaoModal(false); setRejeicaoId(null); setMotivoRejeicao('')
      notifications.show({ title: 'Rejeitada', message: 'Solicitação rejeitada', color: 'orange' })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao rejeitar', color: 'red' })
    },
  })

  function abrirRejeicao(id: string) {
    setRejeicaoId(id)
    setMotivoRejeicao('')
    setRejeicaoModal(true)
  }

  const solicitacoes = response?.data || []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Portal 3PL / Solicitações</Text>
      <Text size="xl" fw={600} mb="lg">Solicitações de Expedição</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />

        <Group justify="space-between" mb="md">
          <Group>
            <IconFilter size={16} className="text-gray-400" />
            <Select
              placeholder="Filtrar por status"
              data={[
                { value: 'PENDENTE', label: 'Pendente' },
                { value: 'APROVADA', label: 'Aprovada' },
                { value: 'REJEITADA', label: 'Rejeitada' },
                { value: 'EM_ANDAMENTO', label: 'Em Andamento' },
                { value: 'CONCLUIDA', label: 'Concluída' },
              ]}
              value={filtroStatus}
              onChange={setFiltroStatus}
              clearable
              className="w-48"
            />
          </Group>
          <Text size="sm" c="dimmed">{solicitacoes.length} solicitação(ões)</Text>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Número</Table.Th>
              <Table.Th>Cliente</Table.Th>
              <Table.Th>Itens</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Data</Table.Th>
              <Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {solicitacoes.map((s: any) => (
              <Table.Tr key={s.id}>
                <Table.Td className="font-mono" fw={500}>#{s.numero}</Table.Td>
                <Table.Td>{s.cliente?.nome || '—'}</Table.Td>
                <Table.Td>{s.totalItens || s.itens?.length || 0}</Table.Td>
                <Table.Td>
                  <Badge color={statusColors[s.status] || 'gray'} variant="light">{s.status}</Badge>
                </Table.Td>
                <Table.Td>{s.createdAt ? new Date(s.createdAt).toLocaleDateString('pt-BR') : '—'}</Table.Td>
                <Table.Td>
                  {s.status === 'PENDENTE' && (
                    <Group gap={4}>
                      <Tooltip label="Aprovar">
                        <ActionIcon variant="light" color="green" onClick={() => {
                          if (confirm('Aprovar esta solicitação?')) aprovar.mutate(s.id)
                        }}>
                          <IconCheck size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Rejeitar">
                        <ActionIcon variant="light" color="red" onClick={() => abrirRejeicao(s.id)}>
                          <IconX size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
            {solicitacoes.length === 0 && (
              <Table.Tr><Table.Td colSpan={6} className="text-center py-8 text-zinc-500">Nenhuma solicitação encontrada</Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      {/* Modal Rejeição */}
      <Modal opened={rejeicaoModal} onClose={() => setRejeicaoModal(false)} title="Rejeitar Solicitação" centered>
        <Textarea
          label="Motivo da rejeição"
          placeholder="Informe o motivo..."
          value={motivoRejeicao}
          onChange={(e) => setMotivoRejeicao(e.currentTarget.value)}
          minRows={3}
          mb="md"
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setRejeicaoModal(false)}>Cancelar</Button>
          <Button color="red" onClick={() => rejeitar.mutate()} loading={rejeitar.isPending}>
            Confirmar Rejeição
          </Button>
        </Group>
      </Modal>
    </div>
  )
}
