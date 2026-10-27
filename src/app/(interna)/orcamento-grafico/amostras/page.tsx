'use client'

/**
 * Amostras / Modelos — fila do Comercial (R5, hand-off). Lista as amostras da
 * empresa (prova digital/física/faca), com contexto do orçamento/cliente, e
 * permite ao comercial avançar o status (produção → enviada), aprovar ou
 * reprovar (abre nova rodada). Consome:
 *   GET   /orcamento-grafico/amostras/empresa
 *   PATCH /orcamento-grafico/amostras/:id/status
 *   POST  /orcamento-grafico/amostras/:id/aprovar | /reprovar
 */
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Title, Stack, Group, Table, Badge, Text, Loader, Center, Button, Paper,
  SegmentedControl, Tooltip, Modal, Textarea,
} from '@mantine/core'
import { IconRefresh, IconExternalLink, IconCheck, IconX, IconSend } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

interface Amostra {
  id: string
  orcamentoId: string | null
  pedidoVendaId: string | null
  tipo: string
  status: string
  rodada: number
  anexoUrl: string | null
  aprovadoPor: string | null
  aprovadoEm: string | null
  motivoReprova: string | null
  criadoEm: string
  orcamentoNumero: number | null
  clienteNome: string | null
}

const STATUS_COR: Record<string, string> = {
  SOLICITADA: 'gray',
  EM_PRODUCAO_AMOSTRA: 'blue',
  ENVIADA_CLIENTE: 'indigo',
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

type Filtro = 'PENDENTES' | 'TODAS' | 'APROVADA' | 'REPROVADA'

export default function AmostrasPage() {
  const router = useRouter()
  useEffect(() => { document.title = 'Amostras / Modelos' }, [])

  const [amostras, setAmostras] = useState<Amostra[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>('PENDENTES')
  const [acao, setAcao] = useState<string | null>(null)
  const [reprovaId, setReprovaId] = useState<string | null>(null)
  const [motivoReprova, setMotivoReprova] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const params: Record<string, string> = {}
      if (filtro === 'PENDENTES') params.apenasPendentes = 'true'
      else if (filtro === 'APROVADA' || filtro === 'REPROVADA') params.status = filtro
      const { data } = await api.get('/orcamento-grafico/amostras/empresa', { params })
      setAmostras(Array.isArray(data) ? data : [])
    } catch {
      setAmostras([])
    } finally {
      setLoading(false)
    }
  }, [filtro])

  useEffect(() => { carregar() }, [carregar])

  async function avancar(id: string, status: 'EM_PRODUCAO_AMOSTRA' | 'ENVIADA_CLIENTE') {
    setAcao(id)
    try {
      await api.patch(`/orcamento-grafico/amostras/${id}/status`, { status })
      notifications.show({ message: 'Status atualizado.', color: 'green' })
      await carregar()
    } catch (err: any) {
      notifications.show({ message: err?.response?.data?.message || 'Falha', color: 'red' })
    } finally {
      setAcao(null)
    }
  }

  async function aprovar(id: string) {
    setAcao(id)
    try {
      await api.post(`/orcamento-grafico/amostras/${id}/aprovar`, {})
      notifications.show({ message: 'Amostra aprovada!', color: 'green' })
      await carregar()
    } catch (err: any) {
      notifications.show({ message: err?.response?.data?.message || 'Falha', color: 'red' })
    } finally {
      setAcao(null)
    }
  }

  async function confirmarReprova() {
    if (!reprovaId || !motivoReprova.trim()) return
    setAcao(reprovaId)
    try {
      await api.post(`/orcamento-grafico/amostras/${reprovaId}/reprovar`, { motivoReprova: motivoReprova.trim() })
      notifications.show({ message: 'Amostra reprovada.', color: 'orange' })
      setReprovaId(null)
      setMotivoReprova('')
      await carregar()
    } catch (err: any) {
      notifications.show({ message: err?.response?.data?.message || 'Falha', color: 'red' })
    } finally {
      setAcao(null)
    }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Amostras / Modelos</Title>
          <Text size="sm" c="dimmed">Aprovação de prova digital, física e faca antes de produzir a tiragem.</Text>
        </div>
        <Group gap="xs">
          <SegmentedControl
            value={filtro}
            onChange={(v) => setFiltro(v as Filtro)}
            data={[
              { label: 'Pendentes', value: 'PENDENTES' },
              { label: 'Aprovadas', value: 'APROVADA' },
              { label: 'Reprovadas', value: 'REPROVADA' },
              { label: 'Todas', value: 'TODAS' },
            ]}
          />
          <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={carregar}>Atualizar</Button>
        </Group>
      </Group>

      {loading ? (
        <Center py="xl"><Loader /></Center>
      ) : amostras.length === 0 ? (
        <Paper p="xl" withBorder><Text c="dimmed" ta="center">Nenhuma amostra nesta visão.</Text></Paper>
      ) : (
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Orçamento</Table.Th>
              <Table.Th>Cliente</Table.Th>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Rodada</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {amostras.map((a) => {
              const finalizada = a.status === 'APROVADA' || a.status === 'REPROVADA'
              return (
                <Table.Tr key={a.id}>
                  <Table.Td fw={600}>{a.orcamentoNumero ?? '—'}</Table.Td>
                  <Table.Td>{a.clienteNome || '—'}</Table.Td>
                  <Table.Td><Badge variant="light">{a.tipo}</Badge></Table.Td>
                  <Table.Td>{a.rodada}</Table.Td>
                  <Table.Td>
                    <Badge color={STATUS_COR[a.status] || 'gray'}>{STATUS_LABEL[a.status] || a.status}</Badge>
                    {a.motivoReprova && a.status === 'REPROVADA' && (
                      <Text size="xs" c="red">{a.motivoReprova}</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Group gap={6} wrap="nowrap">
                      {a.status === 'SOLICITADA' && (
                        <Tooltip label="Marcar em produção">
                          <Button size="compact-xs" variant="light" loading={acao === a.id}
                            onClick={() => avancar(a.id, 'EM_PRODUCAO_AMOSTRA')}>Produzir</Button>
                        </Tooltip>
                      )}
                      {a.status === 'EM_PRODUCAO_AMOSTRA' && (
                        <Tooltip label="Enviar ao cliente">
                          <Button size="compact-xs" variant="light" color="indigo" leftSection={<IconSend size={13} />}
                            loading={acao === a.id} onClick={() => avancar(a.id, 'ENVIADA_CLIENTE')}>Enviar</Button>
                        </Tooltip>
                      )}
                      {!finalizada && (
                        <>
                          <Tooltip label="Aprovar (em nome do cliente)">
                            <Button size="compact-xs" color="green" leftSection={<IconCheck size={13} />}
                              loading={acao === a.id} onClick={() => aprovar(a.id)}>Aprovar</Button>
                          </Tooltip>
                          <Tooltip label="Reprovar (abre nova rodada)">
                            <Button size="compact-xs" color="red" variant="light" leftSection={<IconX size={13} />}
                              onClick={() => setReprovaId(a.id)}>Reprovar</Button>
                          </Tooltip>
                        </>
                      )}
                      {a.orcamentoId && (
                        <Tooltip label="Abrir orçamento">
                          <Button size="compact-xs" variant="subtle" leftSection={<IconExternalLink size={13} />}
                            onClick={() => router.push(`/orcamento-grafico/${a.orcamentoId}`)}>Abrir</Button>
                        </Tooltip>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              )
            })}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={!!reprovaId} onClose={() => { setReprovaId(null); setMotivoReprova('') }} title="Reprovar amostra" centered>
        <Stack gap="md">
          <Textarea
            label="Motivo da reprovação"
            placeholder="Descreva o ajuste necessário (arte, cor, faca...)"
            value={motivoReprova}
            onChange={(e) => setMotivoReprova(e.currentTarget.value)}
            autosize minRows={3}
          />
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => { setReprovaId(null); setMotivoReprova('') }}>Cancelar</Button>
            <Button color="red" disabled={!motivoReprova.trim()} loading={!!acao} onClick={confirmarReprova}>Confirmar reprovação</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
