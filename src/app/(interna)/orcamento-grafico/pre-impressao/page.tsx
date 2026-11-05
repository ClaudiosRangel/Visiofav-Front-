'use client'

/**
 * Board da Pré-Impressão (spec comercial-pre-impressao-board).
 * Lista os pedidos em EM_PRE_IMPRESSAO e, ao abrir um, mostra as 4 etapas
 * (Mockup → Arte → Padrão → Ficha Técnica) com ações de iniciar/concluir/voltar.
 * Consome /orcamento-grafico/pre-impressao/pedidos e /pedidos-proposta/:id/board.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  Title, Stack, Group, Paper, Text, Badge, Button, Loader, Center, Progress,
  Modal, Textarea, Tooltip,
} from '@mantine/core'
import { IconRefresh, IconLayoutColumns, IconPlayerPlay, IconCheck, IconArrowBackUp } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

interface ResumoPedido {
  pedidoId: string
  numero: number
  clienteNome: string | null
  produtoNome: string | null
  caminho: 'CONFERENCIA' | 'PARCIAL' | 'COMPLETA'
  concluidas: number
  totalRelevantes: number
  setorResponsavel: string | null
  tempoParadoMinutos: number | null
}

interface EtapaView {
  etapa: 'MOCKUP' | 'ARTE' | 'PADRAO' | 'FICHA_TECNICA'
  status: 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA'
  ordem: number
  relevante: boolean
  observacao: string | null
  dataInicio: string | null
  dataConclusao: string | null
}

const ETAPA_LABEL: Record<string, string> = {
  MOCKUP: 'Mockup', ARTE: 'Arte', PADRAO: 'Padrão', FICHA_TECNICA: 'Ficha Técnica',
}
const STATUS_CFG: Record<string, { color: string; label: string }> = {
  PENDENTE: { color: 'gray', label: 'Pendente' },
  EM_ANDAMENTO: { color: 'blue', label: 'Em andamento' },
  CONCLUIDA: { color: 'teal', label: 'Concluída' },
}
const CAMINHO_LABEL: Record<string, string> = {
  CONFERENCIA: 'Conferência (repetição)', PARCIAL: 'Parcial (alteração)', COMPLETA: 'Completa (produto novo)',
}

function fmtTempo(min: number | null): string {
  if (min == null) return '—'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} h`
  return `${Math.floor(h / 24)} d`
}

export default function PreImpressaoPage() {
  useEffect(() => { document.title = 'Pré-Impressão' }, [])
  const [lista, setLista] = useState<ResumoPedido[]>([])
  const [loading, setLoading] = useState(true)
  const [aberto, setAberto] = useState<ResumoPedido | null>(null)
  const [etapas, setEtapas] = useState<EtapaView[]>([])
  const [caminho, setCaminho] = useState<string>('')
  const [concluido, setConcluido] = useState(false)
  const [loadingBoard, setLoadingBoard] = useState(false)
  const [acao, setAcao] = useState(false)
  const [obsAlvo, setObsAlvo] = useState<{ etapa: string; status: string } | null>(null)
  const [obs, setObs] = useState('')

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/orcamento-grafico/pre-impressao/pedidos')
      setLista(Array.isArray(data) ? data : [])
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao carregar', color: 'red' })
      setLista([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const abrirBoard = useCallback(async (p: ResumoPedido) => {
    setAberto(p)
    setLoadingBoard(true)
    try {
      const { data } = await api.get(`/orcamento-grafico/pedidos-proposta/${p.pedidoId}/board`)
      setEtapas(data.etapas ?? [])
      setCaminho(data.caminho ?? '')
      setConcluido(!!data.concluido)
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao abrir board', color: 'red' })
    } finally {
      setLoadingBoard(false)
    }
  }, [])

  async function mudar(etapa: string, status: string, observacao?: string) {
    if (!aberto) return
    setAcao(true)
    try {
      await api.patch(`/orcamento-grafico/pedidos-proposta/${aberto.pedidoId}/board/${etapa}`, { status, observacao })
      await abrirBoard(aberto)
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao atualizar etapa', color: 'red' })
    } finally {
      setAcao(false)
    }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Pré-Impressão</Title>
          <Text size="sm" c="dimmed">Pedidos em pré-impressão: Mockup → Arte → Padrão → Ficha Técnica. {lista.length} pedido(s).</Text>
        </div>
        <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={carregar}>Atualizar</Button>
      </Group>

      {loading ? (
        <Center py="xl"><Loader /></Center>
      ) : lista.length === 0 ? (
        <Paper p="xl" withBorder><Text c="dimmed" ta="center">Nenhum pedido em pré-impressão.</Text></Paper>
      ) : (
        <Stack gap="sm">
          {lista.map((p) => {
            const pct = p.totalRelevantes > 0 ? Math.round((p.concluidas / p.totalRelevantes) * 100) : 0
            return (
              <Paper key={p.pedidoId} p="md" withBorder>
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                    <Text fw={700}>Pedido {p.numero}</Text>
                    <Text size="sm" c="dimmed" truncate="end">{p.clienteNome || '—'}</Text>
                    <Badge variant="light" color="grape">{CAMINHO_LABEL[p.caminho] || p.caminho}</Badge>
                  </Group>
                  <Group gap="md" wrap="nowrap">
                    <div style={{ width: 160 }}>
                      <Text size="xs" c="dimmed" ta="right">{p.concluidas}/{p.totalRelevantes} etapas</Text>
                      <Progress value={pct} color={pct === 100 ? 'teal' : 'blue'} />
                    </div>
                    <Text size="xs" c="dimmed">parado {fmtTempo(p.tempoParadoMinutos)}</Text>
                    <Button size="compact-sm" variant="light" leftSection={<IconLayoutColumns size={14} />}
                      onClick={() => abrirBoard(p)}>
                      Abrir board
                    </Button>
                  </Group>
                </Group>
              </Paper>
            )
          })}
        </Stack>
      )}

      {/* Board do pedido */}
      <Modal opened={!!aberto} onClose={() => setAberto(null)} size="xl"
        title={aberto ? `Pré-Impressão — Pedido ${aberto.numero} (${aberto.clienteNome || ''})` : ''}>
        {loadingBoard ? (
          <Center py="xl"><Loader /></Center>
        ) : (
          <Stack gap="md">
            <Group gap="xs">
              <Badge variant="light" color="grape">{CAMINHO_LABEL[caminho] || caminho}</Badge>
              {concluido && <Badge color="teal" leftSection={<IconCheck size={12} />}>Pré-impressão concluída</Badge>}
            </Group>
            <Group align="stretch" grow wrap="nowrap">
              {etapas.map((e) => {
                const cfg = STATUS_CFG[e.status]
                return (
                  <Paper key={e.etapa} p="sm" withBorder style={{ opacity: e.relevante ? 1 : 0.5 }}>
                    <Stack gap={6}>
                      <Group justify="space-between" gap={4}>
                        <Text fw={600} size="sm">{ETAPA_LABEL[e.etapa]}</Text>
                        {!e.relevante && <Tooltip label="Não exigida neste tipo de pedido"><Badge size="xs" variant="outline" color="gray">opc.</Badge></Tooltip>}
                      </Group>
                      <Badge color={cfg.color} variant="light">{cfg.label}</Badge>
                      {e.observacao && <Text size="xs" c="dimmed" fs="italic">“{e.observacao}”</Text>}
                      <Group gap={4} mt={4}>
                        {e.status !== 'EM_ANDAMENTO' && e.status !== 'CONCLUIDA' && (
                          <Button size="compact-xs" variant="light" color="blue" leftSection={<IconPlayerPlay size={12} />}
                            loading={acao} onClick={() => mudar(e.etapa, 'EM_ANDAMENTO')}>Iniciar</Button>
                        )}
                        {e.status !== 'CONCLUIDA' && (
                          <Button size="compact-xs" color="teal" leftSection={<IconCheck size={12} />}
                            loading={acao} onClick={() => { setObsAlvo({ etapa: e.etapa, status: 'CONCLUIDA' }); setObs('') }}>Concluir</Button>
                        )}
                        {e.status === 'CONCLUIDA' && (
                          <Button size="compact-xs" variant="subtle" color="orange" leftSection={<IconArrowBackUp size={12} />}
                            loading={acao} onClick={() => mudar(e.etapa, 'EM_ANDAMENTO')}>Voltar</Button>
                        )}
                      </Group>
                    </Stack>
                  </Paper>
                )
              })}
            </Group>
          </Stack>
        )}
      </Modal>

      {/* Observação ao concluir */}
      <Modal opened={!!obsAlvo} onClose={() => setObsAlvo(null)} title="Concluir etapa" centered>
        <Stack gap="md">
          <Text size="sm" c="dimmed">Observação (opcional) sobre a conclusão da etapa {obsAlvo ? ETAPA_LABEL[obsAlvo.etapa] : ''}.</Text>
          <Textarea minRows={3} value={obs} onChange={(e) => setObs(e.currentTarget.value)} placeholder="Ex.: arte aprovada internamente, aguardando cliente" />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setObsAlvo(null)}>Cancelar</Button>
            <Button color="teal" loading={acao} onClick={async () => {
              if (!obsAlvo) return
              await mudar(obsAlvo.etapa, obsAlvo.status, obs.trim() || undefined)
              setObsAlvo(null)
            }}>Concluir</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
