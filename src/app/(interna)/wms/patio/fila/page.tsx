'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, Modal, NumberInput,
  Textarea, LoadingOverlay,
} from '@mantine/core'
import { IconListNumbers, IconArrowUp } from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const TIPO_LABELS: Record<string, string> = {
  CARGA: 'Carga',
  DESCARGA: 'Descarga',
}

function calcTempoFila(entradaEm: string): string {
  const diffMs = Date.now() - new Date(entradaEm).getTime()
  const h = Math.floor(diffMs / (1000 * 60 * 60))
  const m = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60))
  return `${h}h${m.toString().padStart(2, '0')}m`
}

function prioridadeColor(prioridade: number): string {
  if (prioridade >= 8) return 'red'
  if (prioridade >= 5) return 'orange'
  if (prioridade >= 3) return 'yellow'
  return 'gray'
}

export default function PatioFilaPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - Pátio - Fila' }, [])

  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [selectedVeiculo, setSelectedVeiculo] = useState<any>(null)
  const [novaPrioridade, setNovaPrioridade] = useState<number | ''>(5)
  const [justificativa, setJustificativa] = useState('')
  const [erro, setErro] = useState<string | null>(null)

  const { data: fila, isLoading } = useQuery<any[]>({
    queryKey: ['patio-fila'],
    queryFn: async () => {
      const { data } = await api.get('/patio/fila')
      return data?.data || data || []
    },
    refetchInterval: 15000,
  })

  const mutationPrioridade = useMutation({
    mutationFn: async () => {
      await api.put(`/patio/veiculos/${selectedVeiculo.id}/prioridade`, {
        prioridade: novaPrioridade,
        justificativa,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['patio-fila'] })
      setModalOpen(false)
      setSelectedVeiculo(null)
      setNovaPrioridade(5)
      setJustificativa('')
      setErro(null)
    },
    onError: (err: any) => {
      setErro(err?.response?.data?.message || 'Erro ao alterar prioridade')
    },
  })

  const handleAlterarPrioridade = (veiculo: any) => {
    setSelectedVeiculo(veiculo)
    setNovaPrioridade(veiculo.prioridade || 5)
    setJustificativa('')
    setErro(null)
    setModalOpen(true)
  }

  const handleConfirmar = () => {
    if (!justificativa.trim()) {
      setErro('Justificativa é obrigatória')
      return
    }
    mutationPrioridade.mutate()
  }

  const items = fila || []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Pátio / Fila</Text>
      <Group justify="space-between" mb="lg">
        <Text size="xl" fw={600}>Fila do Pátio</Text>
        <Badge size="lg" variant="light" color="blue">
          <IconListNumbers size={14} style={{ marginRight: 4 }} />
          {items.length} veículo(s)
        </Badge>
      </Group>

      <Card pos="relative" withBorder>
        <LoadingOverlay visible={isLoading} />
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Pos.</Table.Th>
              <Table.Th>Placa</Table.Th>
              <Table.Th>Motorista</Table.Th>
              <Table.Th>Tipo Operação</Table.Th>
              <Table.Th>Prioridade</Table.Th>
              <Table.Th>Tempo na Fila</Table.Th>
              <Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((v: any, index: number) => (
              <Table.Tr key={v.id}>
                <Table.Td>
                  <Badge variant="filled" color="blue" size="lg">{index + 1}</Badge>
                </Table.Td>
                <Table.Td className="font-mono">{v.placa}</Table.Td>
                <Table.Td>{v.motoristaNome || '—'}</Table.Td>
                <Table.Td>
                  <Badge variant="light" color="violet">
                    {TIPO_LABELS[v.tipoOperacao] || v.tipoOperacao}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge variant="filled" color={prioridadeColor(v.prioridade)}>
                    {v.prioridade || 0}
                  </Badge>
                </Table.Td>
                <Table.Td>{v.entradaEm ? calcTempoFila(v.entradaEm) : '—'}</Table.Td>
                <Table.Td>
                  <Button
                    variant="subtle"
                    size="xs"
                    leftSection={<IconArrowUp size={14} />}
                    onClick={() => handleAlterarPrioridade(v)}
                  >
                    Prioridade
                  </Button>
                </Table.Td>
              </Table.Tr>
            ))}
            {items.length === 0 && !isLoading && (
              <Table.Tr>
                <Table.Td colSpan={7} className="text-center py-8 text-zinc-500">
                  Fila vazia — nenhum veículo aguardando
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      {/* Modal Alterar Prioridade */}
      <Modal
        opened={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Alterar Prioridade"
        centered
      >
        {selectedVeiculo && (
          <div>
            <Text size="sm" c="dimmed" mb="md">
              Veículo: <strong>{selectedVeiculo.placa}</strong> — {selectedVeiculo.motoristaNome}
            </Text>

            <NumberInput
              label="Nova Prioridade"
              description="Quanto maior, mais prioritário (1-10)"
              min={1}
              max={10}
              value={novaPrioridade}
              onChange={(val) => setNovaPrioridade(val as number)}
              mb="md"
            />

            <Textarea
              label="Justificativa"
              placeholder="Motivo da alteração (obrigatório)"
              value={justificativa}
              onChange={(e) => setJustificativa(e.currentTarget.value)}
              required
              minRows={3}
              mb="md"
              error={erro || undefined}
            />

            <Group justify="flex-end">
              <Button variant="default" onClick={() => setModalOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleConfirmar}
                loading={mutationPrioridade.isPending}
              >
                Confirmar
              </Button>
            </Group>
          </div>
        )}
      </Modal>
    </div>
  )
}
