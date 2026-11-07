'use client'

/**
 * Detalhe do Pedido/Proposta — status fiel (spec comercial-pedido-status-fiel).
 * Linha do tempo + ações: transições permitidas, devolver para setor, correção
 * de tipo, registro manual de aprovação de arte, edição das Respostas_Pedido.
 * Tudo aditivo: consome as rotas /pedidos-proposta/:id/* novas; degrada sem erro
 * quando a API não traz os campos novos.
 */
import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Title, Stack, Group, Paper, Text, Badge, Button, Loader, Center, Timeline,
  Select, Textarea, Modal, Divider, Tooltip, Alert, CopyButton, Anchor, Tabs,
} from '@mantine/core'
import PedidoPropostaForm from '../PedidoPropostaForm'
import {
  IconArrowBack, IconArrowRight, IconArrowBackUp, IconHistory, IconEdit,
  IconCircleCheck, IconAlertTriangle, IconLink, IconCopy, IconCheck, IconRefresh,
} from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

const STATUS_MACRO_CONFIG: Record<string, { color: string; label: string }> = {
  RECEBIDO: { color: 'gray', label: 'Recebido' },
  EM_PRE_IMPRESSAO: { color: 'blue', label: 'Em pré-impressão' },
  EM_ORCAMENTO: { color: 'cyan', label: 'Em orçamento' },
  EM_APROVACAO: { color: 'grape', label: 'Em aprovação' },
  APROVADO: { color: 'teal', label: 'Aprovado' },
  EM_PRODUCAO: { color: 'indigo', label: 'Em produção' },
  FATURADO: { color: 'green', label: 'Faturado' },
  PERDIDO: { color: 'red', label: 'Perdido' },
  CANCELADO: { color: 'dark', label: 'Cancelado' },
}

const SITUACAO_LABEL: Record<string, string> = {
  TRIAGEM: 'Triagem',
  PRE_IMPRESSAO_EM_ANDAMENTO: 'Pré-impressão em andamento',
  PRE_IMPRESSAO_AGUARDA_INFO: 'Aguardando informação',
  ORCAMENTO_EM_ANDAMENTO: 'Orçamento em andamento',
  PROPOSTA_ENVIADA_AGUARDA_CLIENTE: 'Proposta enviada (aguarda cliente)',
  APROVACAO_ARTE_PENDENTE: 'Aprovação de arte pendente',
  PROVA_PENDENTE: 'Prova pendente',
  APROVADO: 'Aprovado',
  EM_PRODUCAO: 'Em produção',
  FATURADO: 'Faturado',
  PERDIDO: 'Perdido',
  CANCELADO: 'Cancelado',
}

const SETOR_LABEL: Record<string, string> = {
  PRE_IMPRESSAO: 'Pré-impressão', ORCAMENTO: 'Orçamento', COMERCIAL: 'Comercial',
  REPRESENTANTE: 'Representante', CLIENTE: 'Cliente',
}

const TIPO_DERIVADO_LABEL: Record<string, string> = {
  REPETICAO: 'Repetição', ALTERACAO: 'Alteração', PRODUTO_NOVO: 'Produto novo',
}

interface Evento {
  id: string
  tipoEvento?: string | null
  origem?: string | null
  usuarioId?: string | null
  motivo?: string | null
  setorOrigem?: string | null
  setorDestino?: string | null
  situacaoAnterior?: string | null
  situacaoNova?: string | null
  estadoAnterior?: string | null
  estadoNovo?: string | null
  criadoEm: string
}

interface Situacao {
  situacaoInterna: string
  statusMacro: string
  setorResponsavel?: string | null
  rodada: number
  tempoParadoMinutos?: number | null
}

interface TransicoesResp {
  situacaoAtual: string
  avanco: string[]
  retorno: string[]
}

function fmt(d: string): string {
  return new Date(d).toLocaleString('pt-BR')
}

export default function DetalhePedidoStatusPage() {
  const router = useRouter()
  const params = useParams()
  const id = params?.id as string

  // Aba inicial: ?aba=dados abre direto a edição dos campos do pedido.
  const [aba, setAba] = useState<string>('andamento')
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('aba') === 'dados') setAba('dados')
  }, [])
  const [situacao, setSituacao] = useState<Situacao | null>(null)
  const [transicoes, setTransicoes] = useState<TransicoesResp | null>(null)
  const [eventos, setEventos] = useState<Evento[]>([])
  const [pedido, setPedido] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [acao, setAcao] = useState(false)

  const [devolverSetor, setDevolverSetor] = useState<string | null>(null)
  const [devolverMotivo, setDevolverMotivo] = useState('')
  const [modalDevolver, setModalDevolver] = useState(false)

  // Links de aprovação de arte do cliente (spec comercial-aprovacao-arte-cliente)
  const [links, setLinks] = useState<Array<{ id: string; tokenAbreviado: string; status: string; estado: string; expiraEm: string; decididoEm: string | null; decididoNome: string | null; url: string }>>([])
  const [gerandoLink, setGerandoLink] = useState(false)

  const carregarLinks = useCallback(async () => {
    try {
      const { data } = await api.get(`/orcamento-grafico/pedidos-proposta/${id}/link-aprovacao`)
      setLinks(Array.isArray(data) ? data : [])
    } catch { setLinks([]) }
  }, [id])

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const [sit, tr, lt, det] = await Promise.all([
        api.get(`/orcamento-grafico/pedidos-proposta/${id}/situacao`).then((r) => r.data).catch(() => null),
        api.get(`/orcamento-grafico/pedidos-proposta/${id}/transicoes`).then((r) => r.data).catch(() => null),
        api.get(`/orcamento-grafico/pedidos-proposta/${id}/linha-do-tempo`, { params: { size: 200 } }).then((r) => r.data).catch(() => null),
        api.get(`/orcamento-grafico/pedidos-proposta/${id}`).then((r) => r.data).catch(() => null),
      ])
      setSituacao(sit)
      setTransicoes(tr)
      setEventos(lt?.itens ?? [])
      setPedido(det)
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao carregar', color: 'red' })
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { carregar() }, [carregar])
  useEffect(() => { carregarLinks() }, [carregarLinks])
  useEffect(() => { document.title = `Pedido ${pedido?.numero ?? ''}` }, [pedido])

  async function gerarLinkAprovacao(novo = false) {
    setGerandoLink(true)
    try {
      await api.post(`/orcamento-grafico/pedidos-proposta/${id}/link-aprovacao`, {}, { params: novo ? { novo: 1 } : {} })
      await carregarLinks()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao gerar o link', color: 'red' })
    } finally {
      setGerandoLink(false)
    }
  }

  async function transicionar(destino: string, motivo?: string) {
    setAcao(true)
    try {
      await api.post(`/orcamento-grafico/pedidos-proposta/${id}/transicao`, { destino, motivo })
      notifications.show({ title: 'Transição aplicada', message: SITUACAO_LABEL[destino] ?? destino, color: 'green' })
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Não foi possível', message: err?.response?.data?.message || 'Falha na transição', color: 'red' })
    } finally {
      setAcao(false)
    }
  }

  async function devolver() {
    if (!devolverSetor || devolverMotivo.trim().length < 5) return
    setAcao(true)
    try {
      await api.post(`/orcamento-grafico/pedidos-proposta/${id}/devolver`, {
        setorDestino: devolverSetor, motivo: devolverMotivo.trim(),
      })
      notifications.show({ title: 'Devolvido', message: `Para ${SETOR_LABEL[devolverSetor] ?? devolverSetor}.`, color: 'green' })
      setModalDevolver(false); setDevolverSetor(null); setDevolverMotivo('')
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Não foi possível devolver', message: err?.response?.data?.message || 'Falha', color: 'red' })
    } finally {
      setAcao(false)
    }
  }

  if (loading) return <Center py="xl"><Loader /></Center>

  const temStatusFiel = !!situacao?.statusMacro
  const macro = situacao?.statusMacro
  const macroCfg = macro ? STATUS_MACRO_CONFIG[macro] : null

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group gap="xs">
          <Button variant="subtle" leftSection={<IconArrowBack size={16} />} onClick={() => router.push('/orcamento-grafico/pedidos')}>
            Voltar
          </Button>
          <Title order={3}>Pedido / Proposta nº {pedido?.numero ?? '—'}</Title>
        </Group>
        {pedido?.orcamentoGraficoId && (
          <Button variant="light" leftSection={<IconEdit size={16} />} onClick={() => router.push(`/orcamento-grafico/${pedido.orcamentoGraficoId}`)}>
            Abrir orçamento vinculado
          </Button>
        )}
      </Group>

      <Tabs value={aba} onChange={(v) => setAba(v || 'andamento')} keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="andamento">Andamento</Tabs.Tab>
          <Tabs.Tab value="dados" leftSection={<IconEdit size={14} />}>Dados do pedido (editar)</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="dados" pt="md">
          <PedidoPropostaForm pedidoId={id} />
        </Tabs.Panel>

        <Tabs.Panel value="andamento" pt="md">
      <Stack gap="md">
      {!temStatusFiel && (
        <Alert color="gray" icon={<IconAlertTriangle size={16} />}>
          Este pedido ainda não tem o status detalhado disponível.
        </Alert>
      )}

      {temStatusFiel && (
        <Paper p="md" withBorder>
          <Group gap="xl" wrap="wrap">
            <div>
              <Text size="xs" c="dimmed">Status macro</Text>
              <Badge size="lg" color={macroCfg?.color || 'gray'}>{macroCfg?.label || macro}</Badge>
            </div>
            <div>
              <Text size="xs" c="dimmed">Situação interna</Text>
              <Text fw={500}>{SITUACAO_LABEL[situacao!.situacaoInterna] || situacao!.situacaoInterna}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Com quem está</Text>
              <Text fw={500}>{situacao?.setorResponsavel ? (SETOR_LABEL[situacao.setorResponsavel] || situacao.setorResponsavel) : '—'}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Tempo parado</Text>
              <Text fw={500}>{situacao?.tempoParadoMinutos == null ? '—' : `${situacao.tempoParadoMinutos} min`}</Text>
            </div>
            <div>
              <Text size="xs" c="dimmed">Rodada</Text>
              <Badge variant="light" color={situacao!.rodada > 1 ? 'orange' : 'gray'}>{situacao!.rodada}ª</Badge>
            </div>
            {pedido?.tipoPedidoDerivado && (
              <div>
                <Text size="xs" c="dimmed">Classificação</Text>
                <Group gap={4}>
                  <Text fw={500}>{TIPO_DERIVADO_LABEL[pedido.tipoPedidoDerivado] || pedido.tipoPedidoDerivado}</Text>
                  {pedido.classificacaoAConfirmar && <Badge variant="light" color="yellow">revisar</Badge>}
                  {pedido.tipoPedidoDivergente && <Badge variant="light" color="orange">divergente</Badge>}
                </Group>
              </div>
            )}
          </Group>
        </Paper>
      )}

      {temStatusFiel && transicoes && (
        <Paper p="md" withBorder>
          <Text fw={600} mb="xs">Ações</Text>
          <Group gap="xs" wrap="wrap">
            {transicoes.avanco.map((dest) => {
              const encerrar = dest === 'PERDIDO' || dest === 'CANCELADO'
              return (
                <Button
                  key={dest}
                  size="compact-sm"
                  color={encerrar ? (dest === 'PERDIDO' ? 'orange' : 'red') : 'blue'}
                  variant={encerrar ? 'light' : 'filled'}
                  leftSection={<IconArrowRight size={14} />}
                  loading={acao}
                  onClick={() => {
                    if (encerrar) {
                      const motivo = window.prompt(`Motivo para ${SITUACAO_LABEL[dest]} (mín. 5 caracteres):`) || ''
                      if (motivo.trim().length >= 5) transicionar(dest, motivo.trim())
                    } else {
                      transicionar(dest)
                    }
                  }}
                >
                  {SITUACAO_LABEL[dest] || dest}
                </Button>
              )
            })}
            {transicoes.retorno.length > 0 && (
              <Tooltip label="Devolver para um setor anterior">
                <Button size="compact-sm" variant="light" color="grape" leftSection={<IconArrowBackUp size={14} />}
                  onClick={() => setModalDevolver(true)}>
                  Devolver para…
                </Button>
              </Tooltip>
            )}
            {transicoes.avanco.length === 0 && transicoes.retorno.length === 0 && (
              <Text size="sm" c="dimmed">Nenhuma ação disponível (pedido finalizado).</Text>
            )}
          </Group>
        </Paper>
      )}

      {/* Pós-aprovação da arte: se há cálculo/orçamento, direciona para validar/conferir */}
      {pedido?.aprovacaoArteEm && pedido?.orcamentoGraficoId && (
        <Alert color="cyan" icon={<IconCircleCheck size={16} />}
          title="Arte aprovada — conferir/validar o cálculo">
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm">
              A arte foi aprovada pelo cliente e existe um orçamento vinculado. Prossiga para conferir e validar o cálculo.
            </Text>
            <Button size="compact-sm" color="cyan"
              onClick={() => router.push(`/orcamento-grafico/${pedido.orcamentoGraficoId}`)}>
              Conferir / validar cálculo
            </Button>
          </Group>
        </Alert>
      )}

      {/* Aprovação de arte do cliente (link que expira) */}
      <Paper p="md" withBorder>
        <Group justify="space-between" mb="sm">
          <Group gap="xs"><IconLink size={18} /><Text fw={600}>Aprovação de arte do cliente</Text></Group>
          <Group gap="xs">
            <Button size="compact-sm" variant="light" leftSection={<IconLink size={14} />} loading={gerandoLink}
              onClick={() => gerarLinkAprovacao(false)}>
              Gerar link
            </Button>
            {links.some((l) => l.estado === 'PENDENTE') && (
              <Button size="compact-sm" variant="subtle" color="gray" leftSection={<IconRefresh size={14} />} loading={gerandoLink}
                onClick={() => gerarLinkAprovacao(true)}>
                Gerar novo
              </Button>
            )}
          </Group>
        </Group>
        <Text size="xs" c="dimmed" mb="sm">
          Gere o link e envie ao cliente (WhatsApp/e-mail). Ele aprova ou pede ajuste pela página pública. O link expira em 7 dias.
        </Text>
        {links.length === 0 ? (
          <Text size="sm" c="dimmed">Nenhum link gerado ainda.</Text>
        ) : (
          <Stack gap="xs">
            {links.map((l) => {
              const cor = l.estado === 'APROVADA' ? 'green' : l.estado === 'AJUSTE_SOLICITADO' ? 'orange'
                : l.estado === 'EXPIRADO' ? 'red' : l.estado === 'CANCELADO' ? 'gray' : 'blue'
              const label = l.estado === 'APROVADA' ? 'Aprovada pelo cliente' : l.estado === 'AJUSTE_SOLICITADO' ? 'Ajuste solicitado'
                : l.estado === 'EXPIRADO' ? 'Expirado' : l.estado === 'CANCELADO' ? 'Cancelado' : 'Aguardando cliente'
              return (
                <Group key={l.id} gap="xs" wrap="nowrap" justify="space-between">
                  <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                    <Badge color={cor}>{label}</Badge>
                    <Anchor href={l.url} target="_blank" size="sm" truncate="end" style={{ maxWidth: 340 }}>{l.url}</Anchor>
                    {l.decididoNome && <Text size="xs" c="dimmed">por {l.decididoNome}</Text>}
                  </Group>
                  {l.estado === 'PENDENTE' && (
                    <CopyButton value={l.url}>
                      {({ copied, copy }) => (
                        <Button size="compact-xs" variant="light" color={copied ? 'teal' : 'blue'}
                          leftSection={copied ? <IconCheck size={13} /> : <IconCopy size={13} />} onClick={copy}>
                          {copied ? 'Copiado' : 'Copiar'}
                        </Button>
                      )}
                    </CopyButton>
                  )}
                </Group>
              )
            })}
          </Stack>
        )}
      </Paper>

      <Paper p="md" withBorder>
        <Group gap="xs" mb="sm"><IconHistory size={18} /><Text fw={600}>Linha do tempo</Text></Group>
        {eventos.length === 0 ? (
          <Text size="sm" c="dimmed">Sem eventos registrados.</Text>
        ) : (
          <Timeline active={eventos.length} bulletSize={18} lineWidth={2}>
            {eventos.map((e) => (
              <Timeline.Item key={e.id} bullet={<IconCircleCheck size={12} />} title={e.tipoEvento || `${e.estadoAnterior} → ${e.estadoNovo}`}>
                <Text size="xs" c="dimmed">{fmt(e.criadoEm)} · {e.origem || e.usuarioId || 'sistema'}</Text>
                {(e.situacaoAnterior || e.situacaoNova) && (
                  <Text size="sm">
                    {SITUACAO_LABEL[e.situacaoAnterior || ''] || e.situacaoAnterior || '—'}
                    {' → '}
                    {SITUACAO_LABEL[e.situacaoNova || ''] || e.situacaoNova || '—'}
                  </Text>
                )}
                {(e.setorOrigem || e.setorDestino) && (
                  <Text size="xs" c="dimmed">
                    {SETOR_LABEL[e.setorOrigem || ''] || e.setorOrigem || '—'} → {SETOR_LABEL[e.setorDestino || ''] || e.setorDestino || '—'}
                  </Text>
                )}
                {e.motivo && <Text size="sm" fs="italic">“{e.motivo}”</Text>}
              </Timeline.Item>
            ))}
          </Timeline>
        )}
      </Paper>
      </Stack>
        </Tabs.Panel>
      </Tabs>

      <Modal opened={modalDevolver} onClose={() => setModalDevolver(false)} title="Devolver para setor" centered>
        <Stack gap="md">
          <Select
            label="Setor de destino" placeholder="Escolha o setor" withAsterisk
            data={(transicoes?.retorno ?? []).map((sit) => {
              // mapeia situação de retorno → setor (aproximação p/ rótulo)
              const setor = sit.startsWith('PRE_IMPRESSAO') ? 'PRE_IMPRESSAO'
                : sit.startsWith('ORCAMENTO') ? 'ORCAMENTO'
                  : sit.startsWith('PROPOSTA') ? 'CLIENTE' : 'COMERCIAL'
              return { value: setor, label: SETOR_LABEL[setor] }
            }).filter((v, i, arr) => arr.findIndex((x) => x.value === v.value) === i)}
            value={devolverSetor} onChange={setDevolverSetor}
          />
          <Textarea label="Motivo" withAsterisk placeholder="Explique por que está devolvendo (mín. 5 caracteres)"
            minRows={3} value={devolverMotivo} onChange={(e) => setDevolverMotivo(e.currentTarget.value)} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setModalDevolver(false)}>Cancelar</Button>
            <Button color="grape" loading={acao} disabled={!devolverSetor || devolverMotivo.trim().length < 5} onClick={devolver}>
              Devolver
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
