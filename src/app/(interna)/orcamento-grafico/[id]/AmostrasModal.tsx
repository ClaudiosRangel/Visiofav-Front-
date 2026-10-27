'use client'

/**
 * Modal de Aprovação de Amostra/Modelo (R5 — hand-off comercial).
 * Lista as rodadas de amostra de um orçamento, permite solicitar nova amostra
 * (DIGITAL/FISICA/FACA), avançar status, anexar prova e aprovar/reprovar.
 * Consome /orcamento-grafico/amostras* (backend pronto).
 */
import { useEffect, useState, useCallback } from 'react'
import {
  Modal, Stack, Group, Button, Select, Table, Badge, Text, Loader, Center,
  TextInput, Textarea, ActionIcon, Tooltip,
} from '@mantine/core'
import { IconPlus, IconCheck, IconX, IconTruckDelivery, IconPaperclip } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

interface Amostra {
  id: string
  tipo: string
  status: string
  rodada: number
  anexoUrl: string | null
  aprovadoPor: string | null
  aprovadoEm: string | null
  motivoReprova: string | null
  criadoEm: string
}

const STATUS_COR: Record<string, string> = {
  SOLICITADA: 'gray',
  EM_PRODUCAO_AMOSTRA: 'blue',
  ENVIADA_CLIENTE: 'yellow',
  APROVADA: 'green',
  REPROVADA: 'red',
}
const STATUS_LABEL: Record<string, string> = {
  SOLICITADA: 'Solicitada',
  EM_PRODUCAO_AMOSTRA: 'Em produção',
  ENVIADA_CLIENTE: 'Enviada ao cliente',
  APROVADA: 'Aprovada',
  REPROVADA: 'Reprovada',
}
const TIPO_LABEL: Record<string, string> = { DIGITAL: 'Digital', FISICA: 'Física', FACA: 'Faca' }

export default function AmostrasModal({
  opened,
  onClose,
  orcamentoId,
  onMudou,
}: {
  opened: boolean
  onClose: () => void
  orcamentoId: string
  onMudou?: () => void
}) {
  const [amostras, setAmostras] = useState<Amostra[]>([])
  const [loading, setLoading] = useState(false)
  const [novoTipo, setNovoTipo] = useState<string>('DIGITAL')
  const [processando, setProcessando] = useState(false)
  // Reprovação inline
  const [reprovandoId, setReprovandoId] = useState<string | null>(null)
  const [motivoReprova, setMotivoReprova] = useState('')

  const carregar = useCallback(async () => {
    if (!orcamentoId) return
    setLoading(true)
    try {
      const { data } = await api.get('/orcamento-grafico/amostras', { params: { orcamentoId } })
      setAmostras(Array.isArray(data) ? data : [])
    } catch {
      setAmostras([])
    } finally {
      setLoading(false)
    }
  }, [orcamentoId])

  useEffect(() => { if (opened) carregar() }, [opened, carregar])

  async function solicitar() {
    setProcessando(true)
    try {
      await api.post('/orcamento-grafico/amostras', { orcamentoId, tipo: novoTipo })
      notifications.show({ title: 'Amostra solicitada', message: `Nova rodada de amostra (${TIPO_LABEL[novoTipo]})`, color: 'green' })
      await carregar(); onMudou?.()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao solicitar', color: 'red' })
    } finally {
      setProcessando(false)
    }
  }

  async function avancar(id: string, status: string) {
    setProcessando(true)
    try {
      await api.patch(`/orcamento-grafico/amostras/${id}/status`, { status })
      await carregar(); onMudou?.()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao atualizar', color: 'red' })
    } finally {
      setProcessando(false)
    }
  }

  async function aprovar(id: string) {
    setProcessando(true)
    try {
      await api.post(`/orcamento-grafico/amostras/${id}/aprovar`, {})
      notifications.show({ title: 'Amostra aprovada', message: 'Produção liberada quanto à amostra.', color: 'green' })
      await carregar(); onMudou?.()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao aprovar', color: 'red' })
    } finally {
      setProcessando(false)
    }
  }

  async function reprovar(id: string) {
    if (!motivoReprova.trim()) {
      notifications.show({ title: 'Erro', message: 'Informe o motivo da reprovação.', color: 'red' })
      return
    }
    setProcessando(true)
    try {
      await api.post(`/orcamento-grafico/amostras/${id}/reprovar`, { motivoReprova: motivoReprova.trim() })
      notifications.show({ title: 'Amostra reprovada', message: 'Abra uma nova rodada para ajustar.', color: 'orange' })
      setReprovandoId(null); setMotivoReprova('')
      await carregar(); onMudou?.()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao reprovar', color: 'red' })
    } finally {
      setProcessando(false)
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Aprovação de Amostra / Modelo" size="xl">
      <Stack>
        {/* Nova amostra */}
        <Group align="flex-end">
          <Select
            label="Tipo de amostra"
            w={200}
            data={[
              { value: 'DIGITAL', label: 'Digital (prova de cor)' },
              { value: 'FISICA', label: 'Física (protótipo)' },
              { value: 'FACA', label: 'Faca / Gabarito' },
            ]}
            value={novoTipo}
            onChange={(v) => setNovoTipo(v || 'DIGITAL')}
          />
          <Button leftSection={<IconPlus size={16} />} onClick={solicitar} loading={processando}>
            Solicitar amostra
          </Button>
        </Group>

        {loading ? (
          <Center py="xl"><Loader /></Center>
        ) : amostras.length === 0 ? (
          <Text c="dimmed" ta="center" py="md">Nenhuma amostra solicitada ainda.</Text>
        ) : (
          <Table striped withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Rodada</Table.Th>
                <Table.Th>Tipo</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Aprovado por</Table.Th>
                <Table.Th>Ações</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {amostras.map((a) => (
                <Table.Tr key={a.id}>
                  <Table.Td>#{a.rodada}</Table.Td>
                  <Table.Td>{TIPO_LABEL[a.tipo] ?? a.tipo}</Table.Td>
                  <Table.Td>
                    <Badge color={STATUS_COR[a.status] ?? 'gray'} variant="light">
                      {STATUS_LABEL[a.status] ?? a.status}
                    </Badge>
                    {a.status === 'REPROVADA' && a.motivoReprova && (
                      <Text size="xs" c="red" mt={2}>{a.motivoReprova}</Text>
                    )}
                  </Table.Td>
                  <Table.Td>{a.aprovadoPor || '—'}</Table.Td>
                  <Table.Td>
                    {reprovandoId === a.id ? (
                      <Group gap={4} wrap="nowrap">
                        <TextInput
                          size="xs" placeholder="Motivo da reprovação"
                          value={motivoReprova}
                          onChange={(e) => setMotivoReprova(e.currentTarget.value)}
                          style={{ minWidth: 180 }}
                        />
                        <Button size="compact-xs" color="red" onClick={() => reprovar(a.id)} loading={processando}>OK</Button>
                        <Button size="compact-xs" variant="subtle" onClick={() => { setReprovandoId(null); setMotivoReprova('') }}>Cancelar</Button>
                      </Group>
                    ) : (a.status === 'APROVADA' || a.status === 'REPROVADA') ? (
                      <Text size="xs" c="dimmed">finalizada</Text>
                    ) : (
                      <Group gap={4} wrap="nowrap">
                        {a.status === 'SOLICITADA' && (
                          <Tooltip label="Marcar em produção">
                            <ActionIcon variant="light" color="blue" onClick={() => avancar(a.id, 'EM_PRODUCAO_AMOSTRA')}>
                              <IconTruckDelivery size={16} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        {a.status === 'EM_PRODUCAO_AMOSTRA' && (
                          <Tooltip label="Enviar ao cliente">
                            <ActionIcon variant="light" color="yellow" onClick={() => avancar(a.id, 'ENVIADA_CLIENTE')}>
                              <IconPaperclip size={16} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        <Tooltip label="Aprovar">
                          <ActionIcon variant="light" color="green" onClick={() => aprovar(a.id)}>
                            <IconCheck size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Reprovar">
                          <ActionIcon variant="light" color="red" onClick={() => setReprovandoId(a.id)}>
                            <IconX size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Stack>
    </Modal>
  )
}
