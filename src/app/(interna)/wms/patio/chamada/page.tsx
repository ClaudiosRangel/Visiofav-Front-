'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Select, Button, Table, Badge, Alert,
  LoadingOverlay, SimpleGrid, ThemeIcon,
} from '@mantine/core'
import {
  IconSpeakerphone, IconCheck, IconX, IconTruck,
} from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const STATUS_CHAMADA_COLORS: Record<string, string> = {
  PENDENTE: 'yellow',
  ATENDIDA: 'green',
  CANCELADA: 'red',
}

const STATUS_CHAMADA_LABELS: Record<string, string> = {
  PENDENTE: 'Pendente',
  ATENDIDA: 'Atendida',
  CANCELADA: 'Cancelada',
}

export default function PatioChamadaPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Pátio - Chamada' }, [])

  const queryClient = useQueryClient()
  const [docaId, setDocaId] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)

  const { data: docas } = useQuery<any[]>({
    queryKey: ['docas-select'],
    queryFn: async () => {
      const { data } = await api.get('/docas')
      return (data?.data || data || []).map((d: any) => ({
        value: String(d.id),
        label: d.nome || `Doca ${d.numero || d.id}`,
      }))
    },
  })

  const { data: sugestao, isLoading: loadingSugestao } = useQuery<any>({
    queryKey: ['patio-sugestao', docaId],
    queryFn: async () => {
      if (!docaId) return null
      const { data } = await api.get(`/patio/sugestao/${docaId}`)
      return data
    },
    enabled: !!docaId,
  })

  const { data: chamadas, isLoading: loadingChamadas } = useQuery<any[]>({
    queryKey: ['patio-chamadas'],
    queryFn: async () => {
      const { data } = await api.get('/patio/chamadas', { params: { status: 'PENDENTE' } })
      return data?.data || data || []
    },
    refetchInterval: 10000,
  })

  const mutationChamar = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/patio/chamadas', {
        docaId: docaId,
        veiculoId: sugestao?.veiculoId || sugestao?.id,
      })
      return data
    },
    onSuccess: () => {
      setMensagem({ tipo: 'success', texto: 'Chamada realizada com sucesso!' })
      queryClient.invalidateQueries({ queryKey: ['patio-chamadas'] })
      queryClient.invalidateQueries({ queryKey: ['patio-sugestao'] })
    },
    onError: (err: any) => {
      setMensagem({ tipo: 'error', texto: err?.response?.data?.message || 'Erro ao realizar chamada' })
    },
  })

  const mutationAtender = useMutation({
    mutationFn: async (chamadaId: number) => {
      await api.put(`/patio/chamadas/${chamadaId}/atender`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patio-chamadas'] })
      queryClient.invalidateQueries({ queryKey: ['patio-veiculos'] })
    },
  })

  const mutationCancelar = useMutation({
    mutationFn: async (chamadaId: number) => {
      await api.put(`/patio/chamadas/${chamadaId}/cancelar`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patio-chamadas'] })
    },
  })

  const chamadasAtivas = chamadas || []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Pátio / Chamada</Text>
      <Text size="xl" fw={600} mb="lg">Chamada de Doca</Text>

      {mensagem && (
        <Alert
          color={mensagem.tipo === 'success' ? 'green' : 'red'}
          icon={mensagem.tipo === 'success' ? <IconCheck size={16} /> : <IconX size={16} />}
          mb="md"
          withCloseButton
          onClose={() => setMensagem(null)}
        >
          {mensagem.texto}
        </Alert>
      )}

      {/* Dock Selection and Suggestion */}
      <SimpleGrid cols={{ base: 1, md: 2 }} mb="lg">
        <Card withBorder padding="lg">
          <Text fw={600} mb="md">Selecionar Doca</Text>
          <Select
            label="Doca"
            placeholder="Selecione a doca"
            data={docas || []}
            value={docaId}
            onChange={setDocaId}
            searchable
            clearable
            mb="md"
          />

          {docaId && sugestao && (
            <Card withBorder bg="blue.0" padding="md" mb="md">
              <Group gap="sm" mb="xs">
                <ThemeIcon size="md" variant="light" color="blue">
                  <IconTruck size={16} />
                </ThemeIcon>
                <Text fw={600} size="sm">Veículo Sugerido</Text>
              </Group>
              <Text size="sm">Placa: <strong className="font-mono">{sugestao.placa}</strong></Text>
              <Text size="sm">Motorista: {sugestao.motoristaNome}</Text>
              <Text size="sm">Tipo: {sugestao.tipoOperacao}</Text>
              <Text size="sm">Prioridade: {sugestao.prioridade}</Text>
            </Card>
          )}

          {docaId && !sugestao && !loadingSugestao && (
            <Text size="sm" c="dimmed">Nenhum veículo sugerido para esta doca</Text>
          )}

          <Button
            leftSection={<IconSpeakerphone size={18} />}
            onClick={() => mutationChamar.mutate()}
            loading={mutationChamar.isPending}
            disabled={!docaId || !sugestao}
            fullWidth
            mt="md"
          >
            Chamar Veículo
          </Button>
        </Card>

        <Card withBorder padding="lg">
          <Text fw={600} mb="md">Chamadas Ativas ({chamadasAtivas.length})</Text>
          <LoadingOverlay visible={loadingChamadas} />
          {chamadasAtivas.length === 0 ? (
            <Text size="sm" c="dimmed">Nenhuma chamada ativa no momento</Text>
          ) : (
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Placa</Table.Th>
                  <Table.Th>Doca</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Ações</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {chamadasAtivas.map((c: any) => (
                  <Table.Tr key={c.id}>
                    <Table.Td className="font-mono">{c.placa || c.veiculo?.placa}</Table.Td>
                    <Table.Td>{c.docaNome || c.doca?.nome || `Doca ${c.docaId}`}</Table.Td>
                    <Table.Td>
                      <Badge color={STATUS_CHAMADA_COLORS[c.status] || 'gray'} variant="light">
                        {STATUS_CHAMADA_LABELS[c.status] || c.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Button
                          size="xs"
                          color="green"
                          variant="light"
                          leftSection={<IconCheck size={14} />}
                          onClick={() => mutationAtender.mutate(c.id)}
                          loading={mutationAtender.isPending}
                        >
                          Atender
                        </Button>
                        <Button
                          size="xs"
                          color="red"
                          variant="light"
                          leftSection={<IconX size={14} />}
                          onClick={() => mutationCancelar.mutate(c.id)}
                          loading={mutationCancelar.isPending}
                        >
                          Cancelar
                        </Button>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Card>
      </SimpleGrid>
    </div>
  )
}
