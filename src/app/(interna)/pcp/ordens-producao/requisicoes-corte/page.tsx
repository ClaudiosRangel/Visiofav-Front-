'use client'

/**
 * Requisições de Corte (RC) — tela do menu Ordem de Produção.
 *
 * A RC é CRIADA aqui (não mais no painel de Programação). Nasce em RASCUNHO e
 * segue os status da OP: RASCUNHO → PLANEJADA → PROGRAMADA → LIBERADA →
 * EM_PRODUCAO → CONCLUIDA (+ CANCELADA). Só aparece na fila da Programação
 * quando LIBERADA. Na criação escolhe-se a Cortadeira (centro) que vai entrar.
 *
 * Backend: /pcp/requisicoes-corte (CRUD) + /:id/status (transição administrativa).
 */

import { useEffect, useState, useCallback } from 'react'
import {
  Title, Stack, Group, Button, Text, Loader, Center, Paper, Table, Badge,
  ScrollArea, ActionIcon, Tooltip,
} from '@mantine/core'
import {
  IconPlus, IconTrash, IconPrinter, IconCircleCheck, IconRefresh,
} from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'
import { ModalNovaRequisicaoCorte } from '../ModalNovaRequisicaoCorte'

// ============================================================================
// Status (seguem a OP)
// ============================================================================
const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  RASCUNHO: { color: 'gray', label: 'Rascunho' },
  PLANEJADA: { color: 'blue', label: 'Planejada' },
  PROGRAMADA: { color: 'cyan', label: 'Programada' },
  LIBERADA: { color: 'teal', label: 'Liberada' },
  EM_PRODUCAO: { color: 'orange', label: 'Em Produção' },
  CONCLUIDA: { color: 'green', label: 'Concluída' },
  CANCELADA: { color: 'red', label: 'Cancelada' },
}

// Próximo status administrativo possível (fluxo linear até LIBERADA).
const PROXIMO_STATUS: Record<string, string | null> = {
  RASCUNHO: 'PLANEJADA',
  PLANEJADA: 'PROGRAMADA',
  PROGRAMADA: 'LIBERADA',
  LIBERADA: null, // a partir daqui o avanço é operacional (chão de fábrica)
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CONFIG[status] || { color: 'gray', label: status }
  return <Badge color={c.color} variant="light">{c.label}</Badge>
}

interface RC {
  id: string
  numero: string
  status: string
  requisitante: string
  fabricanteCartao: string
  nomeProduto: string
  centroProducaoId?: string | null
  dataSolicitacao?: string | null
  formatoCorte?: string | null
}

interface CentroOpt { value: string; label: string; codigo?: string }

export default function RequisicoesCortePage() {
  const [lista, setLista] = useState<RC[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  // Nomes de cortadeiras só para exibir a coluna "Cortadeira" na listagem.
  const [cortadeiras, setCortadeiras] = useState<CentroOpt[]>([])

  useEffect(() => { document.title = 'Requisições de Corte' }, [])

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/pcp/requisicoes-corte')
      setLista(Array.isArray(data) ? data : data?.data || [])
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao carregar requisições.', color: 'red' })
    } finally {
      setLoading(false)
    }
  }, [])

  // Carrega os nomes das cortadeiras para a coluna da tabela.
  const carregarCortadeiras = useCallback(async () => {
    try {
      const { data } = await api.get('/centros-producao', { params: { limit: 100, status: 'true' } })
      const centros = (data?.data || data || []) as any[]
      setCortadeiras(
        centros
          .filter((c) => /cortadeira/i.test(c?.tipoProcesso?.codigo || '') || /cortadeira/i.test(c?.descricao || ''))
          .map((c) => ({ value: c.id, label: `${c.codigo} - ${c.descricao}`, codigo: c.codigo })),
      )
    } catch {
      setCortadeiras([])
    }
  }, [])

  useEffect(() => { carregar(); carregarCortadeiras() }, [carregar, carregarCortadeiras])

  const abrirNova = () => setModalAberto(true)

  async function avancarStatus(rc: RC) {
    const prox = PROXIMO_STATUS[rc.status]
    if (!prox) return
    try {
      await api.patch(`/pcp/requisicoes-corte/${rc.id}/status`, { status: prox })
      notifications.show({ title: 'Status atualizado', message: `RC ${rc.numero}: ${STATUS_CONFIG[prox]?.label || prox}.`, color: 'green' })
      await carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao mudar status.', color: 'red' })
    }
  }

  async function cancelar(rc: RC) {
    if (!confirm(`Cancelar a Requisição de Corte ${rc.numero}?`)) return
    try {
      await api.patch(`/pcp/requisicoes-corte/${rc.id}/status`, { status: 'CANCELADA' })
      notifications.show({ title: 'RC cancelada', message: `Requisição ${rc.numero} cancelada.`, color: 'orange' })
      await carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao cancelar.', color: 'red' })
    }
  }

  async function excluir(rc: RC) {
    if (!confirm(`Excluir a Requisição de Corte ${rc.numero}? Esta ação é definitiva.`)) return
    try {
      await api.delete(`/pcp/requisicoes-corte/${rc.id}`)
      notifications.show({ title: 'RC excluída', message: `Requisição ${rc.numero} removida.`, color: 'green' })
      await carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao excluir.', color: 'red' })
    }
  }

  async function imprimir(rc: RC) {
    try {
      const pdf = await api.get(`/pcp/requisicoes-corte/${rc.id}/pdf`, { responseType: 'blob' })
      const url = URL.createObjectURL(new Blob([pdf.data], { type: 'application/pdf' }))
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao gerar PDF.', color: 'red' })
    }
  }

  const nomeCortadeira = (id?: string | null) => cortadeiras.find((c) => c.value === id)?.label ?? '—'
  const fmtData = (d?: string | null) => (d ? new Date(d).toLocaleDateString('pt-BR') : '—')

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Requisições de Corte</Title>
          <Text size="sm" c="dimmed">
            Criadas aqui (Ordem de Produção). Só entram na fila da Programação quando <strong>Liberadas</strong>.
          </Text>
        </div>
        <Group gap="xs">
          <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={carregar}>Atualizar</Button>
          <Button leftSection={<IconPlus size={16} />} onClick={abrirNova}>Nova Requisição de Corte</Button>
        </Group>
      </Group>

      <Paper withBorder p="md">
        {loading ? (
          <Center py="xl"><Loader /></Center>
        ) : lista.length === 0 ? (
          <Text ta="center" c="dimmed" py="md">Nenhuma requisição de corte. Use "Nova Requisição de Corte".</Text>
        ) : (
          <ScrollArea>
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nº</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Requisitante</Table.Th>
                  <Table.Th>Fabricante / Cartão</Table.Th>
                  <Table.Th>Produto</Table.Th>
                  <Table.Th>Cortadeira</Table.Th>
                  <Table.Th>Solicitação</Table.Th>
                  <Table.Th ta="center">Ações</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {lista.map((rc) => {
                  const prox = PROXIMO_STATUS[rc.status]
                  const terminal = rc.status === 'CONCLUIDA' || rc.status === 'CANCELADA'
                  return (
                    <Table.Tr key={rc.id}>
                      <Table.Td fw={600}>{rc.numero}</Table.Td>
                      <Table.Td><StatusBadge status={rc.status} /></Table.Td>
                      <Table.Td>{rc.requisitante}</Table.Td>
                      <Table.Td>{rc.fabricanteCartao}</Table.Td>
                      <Table.Td><Text size="sm" lineClamp={1}>{rc.nomeProduto}</Text></Table.Td>
                      <Table.Td><Text size="sm" c="dimmed">{nomeCortadeira(rc.centroProducaoId)}</Text></Table.Td>
                      <Table.Td>{fmtData(rc.dataSolicitacao)}</Table.Td>
                      <Table.Td>
                        <Group gap={4} justify="center" wrap="nowrap">
                          {prox && (
                            <Tooltip label={`Avançar para ${STATUS_CONFIG[prox]?.label || prox}`}>
                              <Button size="xs" variant="light" color="teal" leftSection={<IconCircleCheck size={14} />} onClick={() => avancarStatus(rc)}>
                                {STATUS_CONFIG[prox!]?.label}
                              </Button>
                            </Tooltip>
                          )}
                          <Tooltip label="Imprimir (1ª via)">
                            <ActionIcon variant="subtle" color="blue" onClick={() => imprimir(rc)}><IconPrinter size={16} /></ActionIcon>
                          </Tooltip>
                          {!terminal && (
                            <Tooltip label="Cancelar">
                              <ActionIcon variant="subtle" color="orange" onClick={() => cancelar(rc)}><IconCircleCheck size={16} style={{ transform: 'rotate(45deg)' }} /></ActionIcon>
                            </Tooltip>
                          )}
                          <Tooltip label="Excluir">
                            <ActionIcon variant="subtle" color="red" onClick={() => excluir(rc)}><IconTrash size={16} /></ActionIcon>
                          </Tooltip>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  )
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        )}
      </Paper>

      {/* Modal compartilhado (mesmo usado pelo botão da tela de Ordens de Produção). */}
      <ModalNovaRequisicaoCorte opened={modalAberto} onClose={() => setModalAberto(false)} onCriada={carregar} />
    </Stack>
  )
}
