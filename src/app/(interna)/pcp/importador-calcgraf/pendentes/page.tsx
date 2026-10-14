'use client'

import { useEffect, useState } from 'react'
import {
  Title, Stack, Table, Group, Button, Badge, Text, Loader, Center,
  Alert, ActionIcon,
} from '@mantine/core'
import { IconRefresh, IconCheck, IconX, IconAlertCircle } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

/**
 * Alterações pendentes do agente Importador de OP do Calcgraf.
 * Spec: VisioFab.Wms.Back/.kiro/specs/importador-op-calcgraf (Tarefa 13 / Req 3.2, 5.2).
 *
 * Lista as `AlteracaoOpPendente` com status PENDENTE: OPs que mudaram no
 * Calcgraf mas já têm produção no Vizor — por isso não são aplicadas
 * automaticamente e exigem revisão manual aqui.
 *
 * API (base NEXT_PUBLIC_API_URL já inclui /api → paths relativos sem /api):
 *   GET  /pcp/alteracoes-op-pendentes?status=PENDENTE  → { data, total }
 *   POST /pcp/alteracoes-op-pendentes/:id/aplicar
 *   POST /pcp/alteracoes-op-pendentes/:id/descartar
 *
 * Padrão PCP: `api` direto + useState (sem hooks dedicados).
 */

interface OrdemProducaoResumo {
  numero: number
  referenciaExterna: string | null
  status: string
  cliente: string | null
  produto: string | null
}

interface AlteracaoPendente {
  id: string
  numeroOrigem: string | number
  ordemProducaoId: string
  status: string
  criadoEm: string
  ordemProducao: OrdemProducaoResumo
}

const STATUS_OP_COLORS: Record<string, string> = {
  RASCUNHO: 'gray',
  PLANEJADA: 'blue',
  PROGRAMADA: 'cyan',
  LIBERADA: 'teal',
  EM_PRODUCAO: 'yellow',
  CONCLUIDA: 'green',
  CANCELADA: 'red',
}

export default function AlteracoesPendentesPage() {
  useEffect(() => {
    document.title = 'PCP - Alterações Pendentes (Calcgraf)'
  }, [])

  const [data, setData] = useState<AlteracaoPendente[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  // Guarda o id em processamento para desabilitar os botões daquela linha.
  const [processando, setProcessando] = useState<string | null>(null)

  async function carregar() {
    setLoading(true)
    setErro(null)
    try {
      const res = await api.get('/pcp/alteracoes-op-pendentes', { params: { status: 'PENDENTE' } })
      setData(Array.isArray(res.data?.data) ? res.data.data : [])
    } catch (err: any) {
      setErro(err?.response?.data?.message || 'Falha ao carregar as alterações pendentes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  async function aplicar(p: AlteracaoPendente) {
    const ok = window.confirm(
      `Aplicar a alteração do Calcgraf à OP ${p.ordemProducao.numero} (origem ${p.numeroOrigem})?\n\n` +
        'Os dados da OP serão sobrescritos com o conteúdo do Calcgraf, mesmo havendo produção. Esta ação não pode ser desfeita.',
    )
    if (!ok) return
    setProcessando(p.id)
    try {
      await api.post(`/pcp/alteracoes-op-pendentes/${p.id}/aplicar`)
      notifications.show({ title: 'Alteração aplicada', message: `OP ${p.ordemProducao.numero} atualizada.`, color: 'green' })
      await carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao aplicar a alteração.', color: 'red' })
    } finally {
      setProcessando(null)
    }
  }

  async function descartar(p: AlteracaoPendente) {
    const ok = window.confirm(
      `Descartar a alteração do Calcgraf para a OP ${p.ordemProducao.numero} (origem ${p.numeroOrigem})?\n\n` +
        'A OP permanece como está no Vizor. A pendência será marcada como descartada.',
    )
    if (!ok) return
    setProcessando(p.id)
    try {
      await api.post(`/pcp/alteracoes-op-pendentes/${p.id}/descartar`)
      notifications.show({ title: 'Alteração descartada', message: `Pendência da OP ${p.ordemProducao.numero} descartada.`, color: 'blue' })
      await carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao descartar a alteração.', color: 'red' })
    } finally {
      setProcessando(null)
    }
  }

  const fmtData = (v: string) => (v ? new Date(v).toLocaleString('pt-BR') : '—')

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Alterações Pendentes (Calcgraf)</Title>
          <Text size="sm" c="dimmed">
            OPs que mudaram no Calcgraf mas já têm produção no Vizor. Revise cada
            alteração e decida aplicar (sobrescreve a OP) ou descartar.
          </Text>
        </div>
        <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={carregar} loading={loading}>
          Atualizar
        </Button>
      </Group>

      {erro && (
        <Alert color="red" icon={<IconAlertCircle size={16} />} title="Erro ao carregar">
          {erro}
        </Alert>
      )}

      {loading ? (
        <Center py="xl"><Loader /></Center>
      ) : data.length === 0 ? (
        <Center py="xl">
          <Text c="dimmed">Nenhuma alteração pendente de revisão.</Text>
        </Center>
      ) : (
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>OP</Table.Th>
              <Table.Th>Cliente</Table.Th>
              <Table.Th>Produto</Table.Th>
              <Table.Th>Nº Origem (Calcgraf)</Table.Th>
              <Table.Th>Status OP</Table.Th>
              <Table.Th>Detectada em</Table.Th>
              <Table.Th ta="right">Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {data.map((p) => (
              <Table.Tr key={p.id}>
                <Table.Td>
                  <Text fw={600}>Nº {p.ordemProducao.numero}</Text>
                  {p.ordemProducao.referenciaExterna && (
                    <Text size="xs" c="dimmed">Ref.: {p.ordemProducao.referenciaExterna}</Text>
                  )}
                </Table.Td>
                <Table.Td>{p.ordemProducao.cliente || '—'}</Table.Td>
                <Table.Td>{p.ordemProducao.produto || '—'}</Table.Td>
                <Table.Td>{p.numeroOrigem}</Table.Td>
                <Table.Td>
                  <Badge color={STATUS_OP_COLORS[p.ordemProducao.status] || 'gray'} variant="light">
                    {p.ordemProducao.status}
                  </Badge>
                </Table.Td>
                <Table.Td>{fmtData(p.criadoEm)}</Table.Td>
                <Table.Td>
                  <Group gap={4} justify="flex-end" wrap="nowrap">
                    <Button
                      size="xs"
                      color="green"
                      leftSection={<IconCheck size={14} />}
                      loading={processando === p.id}
                      disabled={processando !== null && processando !== p.id}
                      onClick={() => aplicar(p)}
                    >
                      Aplicar
                    </Button>
                    <Button
                      size="xs"
                      variant="light"
                      color="red"
                      leftSection={<IconX size={14} />}
                      loading={processando === p.id}
                      disabled={processando !== null && processando !== p.id}
                      onClick={() => descartar(p)}
                    >
                      Descartar
                    </Button>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Stack>
  )
}
