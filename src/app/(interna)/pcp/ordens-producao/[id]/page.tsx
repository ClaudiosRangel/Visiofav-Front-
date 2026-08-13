'use client'

import { useEffect, useState } from 'react'
import { Title, Stack, Card, Group, Badge, Text, Table, Tabs, Button, Loader, Center, Divider, Timeline, NumberInput, ActionIcon, Tooltip, Modal, TextInput, Select } from '@mantine/core'
import { IconArrowLeft, IconPackage, IconRoute, IconClipboardCheck, IconTruck, IconPalette, IconFileTypePdf, IconPencil, IconCheck, IconX, IconPlus } from '@tabler/icons-react'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

const STATUS_COLORS: Record<string, string> = {
  RASCUNHO: 'gray', PLANEJADA: 'blue', PROGRAMADA: 'indigo', LIBERADA: 'cyan', EM_PRODUCAO: 'orange', CONCLUIDA: 'green', CANCELADA: 'red',
}
const PRIORIDADE_COLORS: Record<string, string> = { BAIXA: 'gray', NORMAL: 'blue', ALTA: 'orange', URGENTE: 'red' }

export default function DetalheOpPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()

  const [op, setOp] = useState<any>(null)
  const [variacoes, setVariacoes] = useState<any[]>([])
  const [programacoes, setProgramacoes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  // Edição manual da quantidade produzida — usado principalmente em OPs
  // antigas que foram concluídas antes de existir a propagação automática
  // da quantidade apontada nas etapas (ficaram com %Concluído travado em 0%).
  const [editandoQtdProduzida, setEditandoQtdProduzida] = useState(false)
  const [qtdProduzidaInput, setQtdProduzidaInput] = useState<number | ''>(0)
  const [salvandoQtdProduzida, setSalvandoQtdProduzida] = useState(false)
  // Edição do nome do produto (tag [Produto] nas observações)
  const [editandoProdutoNome, setEditandoProdutoNome] = useState(false)
  const [produtoNomeInput, setProdutoNomeInput] = useState('')
  // Criar etapa manualmente na OP visualizada (aba Etapas)
  const [modalNovaEtapa, setModalNovaEtapa] = useState(false)
  const [centrosDisponiveis, setCentrosDisponiveis] = useState<any[]>([])
  const [formNovaEtapa, setFormNovaEtapa] = useState<{ descricao: string; centroProducaoId: string | null; tempoSetupMinutos: number | ''; tempoOperacaoMinutos: number | ''; tempoEsperaMinutos: number | '' }>({
    descricao: '', centroProducaoId: null, tempoSetupMinutos: 0, tempoOperacaoMinutos: 0, tempoEsperaMinutos: 0,
  })
  const [salvandoNovaEtapa, setSalvandoNovaEtapa] = useState(false)
  // Modal de cancelamento — pede motivo obrigatório antes de enviar
  const [modalCancelar, setModalCancelar] = useState(false)
  const [motivoCancelamento, setMotivoCancelamento] = useState('')
  // Edição da quantidade da OP
  const [editandoQuantidade, setEditandoQuantidade] = useState(false)
  const [quantidadeInput, setQuantidadeInput] = useState<number | ''>(0)
  const [salvandoQuantidade, setSalvandoQuantidade] = useState(false)
  // Edição da data de entrega prevista
  const [editandoEntrega, setEditandoEntrega] = useState(false)
  const [entregaInput, setEntregaInput] = useState('')
  const [salvandoEntrega, setSalvandoEntrega] = useState(false)
  // Modal de cancelamento forçado (EM_PRODUCAO/CONCLUIDA) — exige admin
  const [modalCancelarForcado, setModalCancelarForcado] = useState(false)
  const [formCancelarForcado, setFormCancelarForcado] = useState({ motivoCancelamento: '', emailAdmin: '', senhaAdmin: '' })
  const [salvandoCancelarForcado, setSalvandoCancelarForcado] = useState(false)

  useEffect(() => { document.title = 'PCP - Detalhe OP' }, [])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      api.get(`/ordens-producao/${id}`),
      api.get(`/ordens-producao/${id}/variacoes`).catch(() => ({ data: { variacoes: [] } })),
      api.get(`/ordens-producao/${id}/programacao-entrega`).catch(() => ({ data: { programacoes: [] } })),
    ]).then(([opRes, varRes, progRes]) => {
      setOp(opRes.data)
      setVariacoes(varRes.data.variacoes || [])
      setProgramacoes(progRes.data.programacoes || [])
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) return <Center py="xl"><Loader /></Center>
  if (!op) return <Text c="red" ta="center" py="xl">OP não encontrada</Text>

  async function salvarQtdProduzida() {
    const valor = typeof qtdProduzidaInput === 'number' ? qtdProduzidaInput : 0
    setSalvandoQtdProduzida(true)
    try {
      const res = await api.patch(`/ordens-producao/${id}/quantidade-produzida`, { quantidadeProduzida: valor })
      setOp((prev: any) => ({ ...prev, ...res.data }))
      setEditandoQtdProduzida(false)
      notifications.show({ title: 'Quantidade produzida atualizada', message: `${res.data.percentualConcluido}% concluído`, color: 'green' })
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao salvar', color: 'red' })
    } finally {
      setSalvandoQtdProduzida(false)
    }
  }

  async function salvarProdutoNome() {
    const novoNome = produtoNomeInput.trim()
    if (!novoNome) return
    try {
      // Atualiza a tag [Produto] nas observações da OP
      let obs = op.observacoes || ''
      if (obs.includes('[Produto]')) {
        obs = obs.replace(/\[Produto\]\s*.+?(?:\n|$)/, `[Produto] ${novoNome}\n`)
      } else {
        obs = `[Produto] ${novoNome}\n${obs}`
      }
      await api.patch(`/ordens-producao/${id}`, { observacoes: obs.trim() })
      setOp((prev: any) => ({ ...prev, observacoes: obs.trim(), produtoNome: novoNome }))
      setEditandoProdutoNome(false)
      notifications.show({ title: 'Produto atualizado', message: novoNome, color: 'green' })
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao salvar', color: 'red' })
    }
  }

  async function salvarQuantidade() {
    const valor = typeof quantidadeInput === 'number' ? quantidadeInput : 0
    if (valor <= 0) {
      setEditandoQuantidade(false)
      return
    }
    setSalvandoQuantidade(true)
    try {
      await api.patch(`/ordens-producao/${id}`, { quantidade: valor })
      setOp((prev: any) => ({ ...prev, quantidade: valor }))
      setEditandoQuantidade(false)
      notifications.show({ title: 'Quantidade atualizada', message: `Nova quantidade: ${valor.toLocaleString('pt-BR')}`, color: 'green' })
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao salvar', color: 'red' })
    } finally {
      setSalvandoQuantidade(false)
    }
  }

  async function salvarEntrega() {
    if (!entregaInput) {
      setEditandoEntrega(false)
      return
    }
    setSalvandoEntrega(true)
    try {
      await api.patch(`/ordens-producao/${id}`, { dataEntregaPrevista: `${entregaInput}T12:00:00` })
      setOp((prev: any) => ({ ...prev, dataEntregaPrevista: `${entregaInput}T12:00:00` }))
      setEditandoEntrega(false)
      notifications.show({ title: 'Entrega atualizada', message: `Nova data: ${entregaInput.split('-').reverse().join('/')}`, color: 'green' })
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao salvar', color: 'red' })
    } finally {
      setSalvandoEntrega(false)
    }
  }

  function abrirModalNovaEtapa() {
    setFormNovaEtapa({ descricao: '', centroProducaoId: null, tempoSetupMinutos: 0, tempoOperacaoMinutos: 0, tempoEsperaMinutos: 0 })
    setModalNovaEtapa(true)
    if (centrosDisponiveis.length === 0) {
      api.get('/centros-producao', { params: { limit: 100, status: 'true' } })
        .then((res) => {
          const lista = (res.data.data || res.data).map((c: any) => ({ value: c.id, label: `${c.codigo} - ${c.descricao}` }))
          setCentrosDisponiveis(lista)
        })
        .catch(() => notifications.show({ title: 'Erro', message: 'Falha ao carregar centros de produção', color: 'red' }))
    }
  }

  async function salvarNovaEtapa() {
    if (!formNovaEtapa.descricao.trim()) {
      notifications.show({ title: 'Erro', message: 'Informe a descrição da operação', color: 'red' })
      return
    }
    setSalvandoNovaEtapa(true)
    try {
      const res = await api.post(`/ordens-producao/${id}/etapas`, {
        descricao: formNovaEtapa.descricao.trim(),
        centroProducaoId: formNovaEtapa.centroProducaoId || undefined,
        tempoSetupMinutos: typeof formNovaEtapa.tempoSetupMinutos === 'number' ? formNovaEtapa.tempoSetupMinutos : 0,
        tempoOperacaoMinutos: typeof formNovaEtapa.tempoOperacaoMinutos === 'number' ? formNovaEtapa.tempoOperacaoMinutos : 0,
        tempoEsperaMinutos: typeof formNovaEtapa.tempoEsperaMinutos === 'number' ? formNovaEtapa.tempoEsperaMinutos : 0,
      })
      setOp((prev: any) => ({ ...prev, etapas: [...(prev.etapas || []), res.data] }))
      notifications.show({ title: 'Etapa criada', message: `"${formNovaEtapa.descricao.trim()}" adicionada à OP`, color: 'green' })
      setModalNovaEtapa(false)
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao criar etapa', color: 'red' })
    } finally {
      setSalvandoNovaEtapa(false)
    }
  }

  async function alterarStatus(novoStatus: string) {
    // Se for cancelar, abre modal pedindo o motivo em vez de enviar direto
    if (novoStatus === 'CANCELADA') {
      setMotivoCancelamento('')
      setModalCancelar(true)
      return
    }
    try {
      const res = await api.patch(`/ordens-producao/${id}/status`, { status: novoStatus })
      setOp((prev: any) => ({
        ...prev,
        ...res.data,
        logs: [
          { id: `temp-${Date.now()}`, statusAnterior: prev.status, statusNovo: novoStatus, criadoEm: new Date().toISOString(), observacao: null },
          ...(prev.logs || []),
        ],
      }))
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro ao alterar status')
    }
  }

  async function confirmarCancelamento() {
    if (motivoCancelamento.trim().length < 10) {
      notifications.show({ title: 'Motivo obrigatório', message: 'Informe o motivo do cancelamento (mínimo 10 caracteres)', color: 'red' })
      return
    }
    try {
      const res = await api.patch(`/ordens-producao/${id}/status`, {
        status: 'CANCELADA',
        motivoCancelamento: motivoCancelamento.trim(),
      })
      setOp((prev: any) => ({
        ...prev,
        ...res.data,
        logs: [
          { id: `temp-${Date.now()}`, statusAnterior: prev.status, statusNovo: 'CANCELADA', criadoEm: new Date().toISOString(), observacao: motivoCancelamento.trim() },
          ...(prev.logs || []),
        ],
      }))
      setModalCancelar(false)
      notifications.show({ title: 'OP cancelada', message: `OP #${op.referenciaExterna || op.numero} foi cancelada`, color: 'red' })
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao cancelar', color: 'red' })
    }
  }

  async function cancelarForcado() {
    if (formCancelarForcado.motivoCancelamento.trim().length < 10) {
      notifications.show({ title: 'Motivo obrigatório', message: 'Informe o motivo (mínimo 10 caracteres)', color: 'red' })
      return
    }
    if (!formCancelarForcado.emailAdmin || !formCancelarForcado.senhaAdmin) {
      notifications.show({ title: 'Credenciais obrigatórias', message: 'Informe email e senha do administrador', color: 'red' })
      return
    }
    setSalvandoCancelarForcado(true)
    try {
      await api.patch(`/ordens-producao/${id}/cancelar-forcado`, formCancelarForcado)
      setOp((prev: any) => ({
        ...prev,
        status: 'CANCELADA',
        motivoCancelamento: formCancelarForcado.motivoCancelamento.trim(),
        logs: [
          { id: `temp-${Date.now()}`, statusAnterior: prev.status, statusNovo: 'CANCELADA', criadoEm: new Date().toISOString(), observacao: `Cancelamento forçado: ${formCancelarForcado.motivoCancelamento.trim()}` },
          ...(prev.logs || []),
        ],
      }))
      setModalCancelarForcado(false)
      setFormCancelarForcado({ motivoCancelamento: '', emailAdmin: '', senhaAdmin: '' })
      notifications.show({ title: 'OP cancelada', message: `OP #${op.referenciaExterna || op.numero} foi cancelada (forçado)`, color: 'red' })
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao cancelar', color: 'red' })
    } finally {
      setSalvandoCancelarForcado(false)
    }
  }

  const transicoesPermitidas: Record<string, string[]> = {
    RASCUNHO: ['PLANEJADA', 'CANCELADA'],
    PLANEJADA: ['PROGRAMADA', 'CANCELADA'],
    PROGRAMADA: ['LIBERADA', 'CANCELADA'],
    LIBERADA: ['EM_PRODUCAO', 'CANCELADA'],
    EM_PRODUCAO: ['CONCLUIDA'],
    CONCLUIDA: [],
    CANCELADA: [],
  }

  const botoesStatus: Record<string, { label: string; color: string }> = {
    PLANEJADA: { label: '→ Planejar', color: 'blue' },
    PROGRAMADA: { label: '→ Programar', color: 'indigo' },
    LIBERADA: { label: '→ Liberar', color: 'cyan' },
    EM_PRODUCAO: { label: '→ Iniciar Produção', color: 'orange' },
    CONCLUIDA: { label: '→ Concluir', color: 'green' },
    CANCELADA: { label: '✕ Cancelar', color: 'red' },
  }

  const proximosStatus = transicoesPermitidas[op.status] || []

  return (
    <Stack gap="md">
      <Group>
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => router.push('/pcp/ordens-producao')}>Voltar</Button>
        <Title order={3}>OP #{op.referenciaExterna || op.numero}</Title>
        <Badge color={STATUS_COLORS[op.status]} size="lg">{op.status}</Badge>
        <Badge color={PRIORIDADE_COLORS[op.prioridade]} variant="light">{op.prioridade}</Badge>
        <Text size="sm" c="dimmed">{op.percentualConcluido}% concluído</Text>
        {op.origemImportacao === 'PDF_GPRINT' && (
          <Button
            size="xs"
            variant="light"
            color="red"
            leftSection={<IconFileTypePdf size={14} />}
            onClick={() => {
              const token = localStorage.getItem('visiofab-wms-token')
              const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api'
              window.open(`${apiUrl}/pcp/op-pdf/${id}?token=${token}`, '_blank')
            }}
          >
            Ver PDF
          </Button>
        )}
      </Group>

      {/* Botões de transição de status */}
      {proximosStatus.length > 0 && (
        <Group gap="xs">
          {proximosStatus.map((s) => {
            const config = botoesStatus[s]
            return config ? (
              <Button key={s} size="xs" color={config.color} variant={s === 'CANCELADA' ? 'outline' : 'filled'} onClick={() => alterarStatus(s)}>
                {config.label}
              </Button>
            ) : null
          })}
        </Group>
      )}

      {/* Botão de cancelamento forçado para EM_PRODUCAO/CONCLUIDA (exige admin) */}
      {(op.status === 'EM_PRODUCAO' || op.status === 'CONCLUIDA') && (
        <Group gap="xs">
          <Button size="xs" color="red" variant="outline" onClick={() => setModalCancelarForcado(true)}>
            ✕ Cancelar OP (requer admin)
          </Button>
        </Group>
      )}

      {/* Cabeçalho */}
      <Card withBorder>
        <Group grow>
          <div>
            <Text size="xs" c="dimmed">Produto</Text>
            {editandoProdutoNome ? (
              <Group gap={4} wrap="nowrap">
                <input
                  type="text"
                  value={produtoNomeInput}
                  onChange={(e) => setProdutoNomeInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') salvarProdutoNome(); if (e.key === 'Escape') setEditandoProdutoNome(false) }}
                  autoFocus
                  style={{ flex: 1, padding: '4px 8px', border: '1px solid #dee2e6', borderRadius: 4, fontSize: 13 }}
                />
                <ActionIcon size="sm" color="green" variant="light" onClick={salvarProdutoNome} title="Salvar">
                  <IconCheck size={14} />
                </ActionIcon>
                <ActionIcon size="sm" color="gray" variant="light" onClick={() => setEditandoProdutoNome(false)} title="Cancelar">
                  <IconX size={14} />
                </ActionIcon>
              </Group>
            ) : (
              <Group gap={4} wrap="nowrap">
                <Text fw={600}>{op.produtoNome || op.produtoId}</Text>
                <Tooltip label="Editar nome do produto">
                  <ActionIcon size="sm" variant="subtle" color="gray" onClick={() => { setProdutoNomeInput(op.produtoNome || ''); setEditandoProdutoNome(true) }}>
                    <IconPencil size={14} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            )}
          </div>
          <div>
            <Text size="xs" c="dimmed">Quantidade</Text>
            {editandoQuantidade ? (
              <Group gap={4} wrap="nowrap">
                <NumberInput
                  size="xs"
                  value={quantidadeInput}
                  onChange={(v) => setQuantidadeInput(typeof v === 'number' ? v : '')}
                  min={1}
                  autoFocus
                  w={120}
                  disabled={salvandoQuantidade}
                  onKeyDown={(e) => { if (e.key === 'Enter') salvarQuantidade(); if (e.key === 'Escape') setEditandoQuantidade(false) }}
                />
                <ActionIcon size="sm" color="green" variant="light" onClick={salvarQuantidade} loading={salvandoQuantidade} title="Salvar">
                  <IconCheck size={14} />
                </ActionIcon>
                <ActionIcon size="sm" color="gray" variant="light" onClick={() => setEditandoQuantidade(false)} disabled={salvandoQuantidade} title="Cancelar">
                  <IconX size={14} />
                </ActionIcon>
              </Group>
            ) : (
              <Group gap={4} wrap="nowrap">
                <Text fw={600}>{Number(op.quantidade).toLocaleString('pt-BR')} {op.unidadeMedida}{Number(op.quantidadeExcedente) > 0 ? ` (+${Number(op.quantidadeExcedente)} excedente)` : ''}</Text>
                <Tooltip label="Editar quantidade">
                  <ActionIcon size="sm" variant="subtle" color="gray" onClick={() => { setQuantidadeInput(Number(op.quantidade) || 0); setEditandoQuantidade(true) }}>
                    <IconPencil size={14} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            )}
          </div>
          <div>
            <Text size="xs" c="dimmed">Quantidade Produzida</Text>
            {editandoQtdProduzida ? (
              <Group gap={4} wrap="nowrap">
                <NumberInput
                  size="xs"
                  value={qtdProduzidaInput}
                  onChange={(v) => setQtdProduzidaInput(typeof v === 'number' ? v : '')}
                  min={0}
                  autoFocus
                  w={110}
                  disabled={salvandoQtdProduzida}
                  onKeyDown={(e) => { if (e.key === 'Enter') salvarQtdProduzida(); if (e.key === 'Escape') setEditandoQtdProduzida(false) }}
                />
                <ActionIcon size="sm" color="green" variant="light" onClick={salvarQtdProduzida} loading={salvandoQtdProduzida} title="Salvar">
                  <IconCheck size={14} />
                </ActionIcon>
                <ActionIcon size="sm" color="gray" variant="light" onClick={() => setEditandoQtdProduzida(false)} disabled={salvandoQtdProduzida} title="Cancelar">
                  <IconX size={14} />
                </ActionIcon>
              </Group>
            ) : (
              <Group gap={4} wrap="nowrap">
                <Text fw={600} c={Number(op.quantidadeProduzida) > 0 ? 'green' : undefined}>
                  {Number(op.quantidadeProduzida) > 0 ? `${Number(op.quantidadeProduzida).toLocaleString('pt-BR')} ${op.unidadeMedida}` : '—'}
                </Text>
                <Tooltip label="Registrar/corrigir quantidade produzida">
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    color="gray"
                    onClick={() => { setQtdProduzidaInput(Number(op.quantidadeProduzida) || 0); setEditandoQtdProduzida(true) }}
                  >
                    <IconPencil size={14} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            )}
          </div>
          <div>
            <Text size="xs" c="dimmed">Entrega Prevista</Text>
            {editandoEntrega ? (
              <Group gap={4} wrap="nowrap">
                <input
                  type="date"
                  value={entregaInput}
                  onChange={(e) => setEntregaInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') salvarEntrega(); if (e.key === 'Escape') setEditandoEntrega(false) }}
                  autoFocus
                  disabled={salvandoEntrega}
                  style={{ padding: '4px 8px', border: '1px solid #dee2e6', borderRadius: 4, fontSize: 13 }}
                />
                <ActionIcon size="sm" color="green" variant="light" onClick={salvarEntrega} loading={salvandoEntrega} title="Salvar">
                  <IconCheck size={14} />
                </ActionIcon>
                <ActionIcon size="sm" color="gray" variant="light" onClick={() => setEditandoEntrega(false)} disabled={salvandoEntrega} title="Cancelar">
                  <IconX size={14} />
                </ActionIcon>
              </Group>
            ) : (
              <Group gap={4} wrap="nowrap">
                <Text fw={600}>{op.dataEntregaPrevista ? new Date(op.dataEntregaPrevista).toLocaleDateString('pt-BR') : '—'}</Text>
                <Tooltip label="Editar data de entrega">
                  <ActionIcon size="sm" variant="subtle" color="gray" onClick={() => { setEntregaInput(op.dataEntregaPrevista ? new Date(op.dataEntregaPrevista).toISOString().split('T')[0] : ''); setEditandoEntrega(true) }}>
                    <IconPencil size={14} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            )}
          </div>
          <div><Text size="xs" c="dimmed">Cliente</Text><Text fw={600}>{op.clienteNome || '—'}</Text></div>
          <div>
            <Text size="xs" c="dimmed">Prog. Entrega</Text>
            {programacoes.length > 0 ? (
              <Text fw={600} c="teal">
                {new Date(programacoes.sort((a: any, b: any) => new Date(b.dataEntrega).getTime() - new Date(a.dataEntrega).getTime())[0].dataEntrega).toLocaleDateString('pt-BR')}
                {programacoes.length > 1 && <Text span size="xs" c="dimmed"> (+{programacoes.length - 1})</Text>}
              </Text>
            ) : (
              <Text fw={600} c="dimmed">—</Text>
            )}
          </div>
          <div><Text size="xs" c="dimmed">Lote</Text><Text fw={600}>{op.lote || '—'}</Text></div>
          <div><Text size="xs" c="dimmed">Cor</Text><Text fw={600}>{op.cor || '—'}</Text></div>
        </Group>
        {op.observacoes && <Text size="sm" c="dimmed" mt="sm">{op.observacoes}</Text>}
      </Card>

      <Tabs defaultValue="etapas">
        <Tabs.List>
          <Tabs.Tab value="etapas" leftSection={<IconRoute size={16} />}>Etapas ({op.etapas?.length || 0})</Tabs.Tab>
          <Tabs.Tab value="materiais" leftSection={<IconPackage size={16} />}>Materiais ({op.itens?.length || 0})</Tabs.Tab>
          <Tabs.Tab value="variacoes" leftSection={<IconPalette size={16} />}>Variações ({variacoes.length})</Tabs.Tab>
          <Tabs.Tab value="entregas" leftSection={<IconTruck size={16} />}>Entregas ({programacoes.length})</Tabs.Tab>
          <Tabs.Tab value="historico" leftSection={<IconClipboardCheck size={16} />}>Histórico</Tabs.Tab>
        </Tabs.List>

        {/* ABA ETAPAS */}
        <Tabs.Panel value="etapas" pt="md">
          <Group justify="flex-end" mb="sm">
            <Button
              size="xs"
              variant="light"
              leftSection={<IconPlus size={14} />}
              onClick={abrirModalNovaEtapa}
              disabled={['CONCLUIDA', 'CANCELADA'].includes(op.status)}
            >
              Nova Etapa
            </Button>
          </Group>
          {op.etapas?.length > 0 ? (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Seq</Table.Th>
                  <Table.Th>Operação</Table.Th>
                  <Table.Th>Centro</Table.Th>
                  <Table.Th>Setup (min)</Table.Th>
                  <Table.Th>Operação (min)</Table.Th>
                  <Table.Th>Espera (min)</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {op.etapas.map((etapa: any) => (
                  <Table.Tr key={etapa.id}>
                    <Table.Td>{etapa.sequencia}</Table.Td>
                    <Table.Td>{etapa.descricao}</Table.Td>
                    <Table.Td>{etapa.centroProducao?.descricao || '—'}</Table.Td>
                    <Table.Td>{Number(etapa.tempoSetupMinutos)}</Table.Td>
                    <Table.Td>{Number(etapa.tempoOperacaoCalculado)}</Table.Td>
                    <Table.Td>{Number(etapa.tempoEsperaMinutos)}</Table.Td>
                    <Table.Td><Badge size="sm" color={etapa.status === 'PENDENTE' ? 'gray' : etapa.status === 'EM_ANDAMENTO' ? 'orange' : 'green'}>{etapa.status}</Badge></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : <Text c="dimmed" ta="center">Nenhuma etapa</Text>}
        </Tabs.Panel>

        {/* ABA MATERIAIS */}
        <Tabs.Panel value="materiais" pt="md">
          {op.itens?.length > 0 ? (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Material</Table.Th>
                  <Table.Th>Quantidade</Table.Th>
                  <Table.Th>Unidade</Table.Th>
                  <Table.Th>Liberado</Table.Th>
                  <Table.Th>Consumido</Table.Th>
                  <Table.Th>Perda</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {op.itens.map((item: any) => (
                  <Table.Tr key={item.id}>
                    <Table.Td>{item.descricaoProduto}</Table.Td>
                    <Table.Td fw={600}>{Number(item.quantidade)}</Table.Td>
                    <Table.Td>{item.unidadeMedida}</Table.Td>
                    <Table.Td>{Number(item.quantidadeLiberada)}</Table.Td>
                    <Table.Td>{Number(item.quantidadeConsumida)}</Table.Td>
                    <Table.Td>{Number(item.quantidadePerda) > 0 ? <Badge color="red" size="sm">{Number(item.quantidadePerda)}</Badge> : '0'}</Table.Td>
                    <Table.Td><Badge size="sm" color={item.status === 'PENDENTE' ? 'gray' : 'green'}>{item.status}</Badge></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : <Text c="dimmed" ta="center">Nenhum material</Text>}
        </Tabs.Panel>

        {/* ABA VARIAÇÕES */}
        <Tabs.Panel value="variacoes" pt="md">
          {variacoes.length > 0 ? (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Seq</Table.Th>
                  <Table.Th>Código</Table.Th>
                  <Table.Th>Descrição</Table.Th>
                  <Table.Th>Cor</Table.Th>
                  <Table.Th>Quantidade</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {variacoes.map((v: any) => (
                  <Table.Tr key={v.id}>
                    <Table.Td>{v.sequencia}</Table.Td>
                    <Table.Td fw={600}>{v.codigoProduto}</Table.Td>
                    <Table.Td>{v.descricao}</Table.Td>
                    <Table.Td><Badge variant="light">{v.cor || '—'}</Badge></Table.Td>
                    <Table.Td fw={600}>{Number(v.quantidade)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : <Text c="dimmed" ta="center">Nenhuma variação</Text>}
        </Tabs.Panel>

        {/* ABA ENTREGAS */}
        <Tabs.Panel value="entregas" pt="md">
          {programacoes.length > 0 ? (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Data Entrega</Table.Th>
                  <Table.Th>Quantidade</Table.Th>
                  <Table.Th>Pedido</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {programacoes.map((p: any) => (
                  <Table.Tr key={p.id}>
                    <Table.Td>{new Date(p.dataEntrega).toLocaleDateString('pt-BR')}</Table.Td>
                    <Table.Td fw={600}>{Number(p.quantidade)}</Table.Td>
                    <Table.Td>{p.codigoPedido || '—'}</Table.Td>
                    <Table.Td><Badge color={p.status === 'EXPEDIDO' ? 'green' : p.status === 'PRODUZIDO' ? 'blue' : 'gray'}>{p.status}</Badge></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : <Text c="dimmed" ta="center">Nenhuma entrega programada</Text>}
        </Tabs.Panel>

        {/* ABA HISTÓRICO */}
        <Tabs.Panel value="historico" pt="md">
          {op.logs?.length > 0 ? (
            <Timeline active={op.logs.length - 1} bulletSize={20} lineWidth={2}>
              {op.logs.map((log: any) => (
                <Timeline.Item key={log.id} title={`${log.statusAnterior || '—'} → ${log.statusNovo}`}>
                  <Text size="xs" c="dimmed">{new Date(log.criadoEm).toLocaleString('pt-BR')}</Text>
                  {log.observacao && <Text size="sm">{log.observacao}</Text>}
                </Timeline.Item>
              ))}
            </Timeline>
          ) : <Text c="dimmed" ta="center">Nenhum registro</Text>}
        </Tabs.Panel>
      </Tabs>

      {/* Modal: Nova Etapa (criação manual na OP visualizada) */}
      <Modal opened={modalNovaEtapa} onClose={() => setModalNovaEtapa(false)} title="Nova Etapa" centered>
        <Stack gap="md">
          <TextInput
            label="Operação"
            placeholder="Ex: Verniz UV, Laminação, Corte manual..."
            value={formNovaEtapa.descricao}
            onChange={(e) => setFormNovaEtapa({ ...formNovaEtapa, descricao: e.currentTarget.value })}
            autoFocus
            required
          />
          <Select
            label="Centro (opcional)"
            placeholder="Selecione um centro de produção..."
            data={centrosDisponiveis}
            value={formNovaEtapa.centroProducaoId}
            onChange={(v) => setFormNovaEtapa({ ...formNovaEtapa, centroProducaoId: v })}
            searchable
            clearable
          />
          <Text size="xs" c="dimmed">
            Se um centro for selecionado, a etapa entra na fila do Painel de Programação.
          </Text>
          <Group grow>
            <NumberInput
              label="Setup (min)"
              value={formNovaEtapa.tempoSetupMinutos}
              onChange={(v) => setFormNovaEtapa({ ...formNovaEtapa, tempoSetupMinutos: typeof v === 'number' ? v : '' })}
              min={0}
            />
            <NumberInput
              label="Operação (min)"
              value={formNovaEtapa.tempoOperacaoMinutos}
              onChange={(v) => setFormNovaEtapa({ ...formNovaEtapa, tempoOperacaoMinutos: typeof v === 'number' ? v : '' })}
              min={0}
            />
            <NumberInput
              label="Espera (min)"
              value={formNovaEtapa.tempoEsperaMinutos}
              onChange={(v) => setFormNovaEtapa({ ...formNovaEtapa, tempoEsperaMinutos: typeof v === 'number' ? v : '' })}
              min={0}
            />
          </Group>
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={() => setModalNovaEtapa(false)} disabled={salvandoNovaEtapa}>Cancelar</Button>
            <Button onClick={salvarNovaEtapa} loading={salvandoNovaEtapa}>Criar Etapa</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal: Cancelar OP — pede motivo obrigatório */}
      <Modal opened={modalCancelar} onClose={() => setModalCancelar(false)} title="Cancelar Ordem de Produção" centered>
        <Stack gap="sm">
          <Text size="sm">Informe o motivo do cancelamento da OP #{op?.referenciaExterna || op?.numero}:</Text>
          <div>
            <input
              type="text"
              placeholder="Motivo do cancelamento (mínimo 10 caracteres)"
              value={motivoCancelamento}
              onChange={(e) => setMotivoCancelamento(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #dee2e6', borderRadius: 4, fontSize: 14 }}
            />
            {motivoCancelamento.length > 0 && motivoCancelamento.length < 10 && (
              <Text size="xs" c="red" mt={4}>{10 - motivoCancelamento.length} caractere(s) restante(s)</Text>
            )}
          </div>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setModalCancelar(false)}>Voltar</Button>
            <Button color="red" onClick={confirmarCancelamento} disabled={motivoCancelamento.trim().length < 10}>Confirmar Cancelamento</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal: Cancelar forçado (EM_PRODUCAO/CONCLUIDA) — exige admin */}
      {modalCancelarForcado && (
        <Modal opened onClose={() => { setModalCancelarForcado(false); setFormCancelarForcado({ motivoCancelamento: '', emailAdmin: '', senhaAdmin: '' }) }} title="Cancelar OP (Forçado)" centered>
          <Stack gap="sm">
            <Text size="sm" c="dimmed">Esta OP está em {op?.status}. O cancelamento forçado requer autorização de administrador.</Text>
            <div>
              <Text size="sm" fw={500} mb={4}>Motivo do cancelamento (mín. 10 caracteres)</Text>
              <input
                type="text"
                placeholder="Descreva o motivo"
                value={formCancelarForcado.motivoCancelamento}
                onChange={(e) => setFormCancelarForcado(prev => ({ ...prev, motivoCancelamento: e.target.value }))}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #dee2e6', borderRadius: 4, fontSize: 14 }}
              />
            </div>
            <div>
              <Text size="sm" fw={500} mb={4}>Usuário (admin)</Text>
              <input
                type="text"
                placeholder="Email do administrador"
                value={formCancelarForcado.emailAdmin}
                onChange={(e) => setFormCancelarForcado(prev => ({ ...prev, emailAdmin: e.target.value }))}
                autoComplete="nope"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #dee2e6', borderRadius: 4, fontSize: 14 }}
              />
            </div>
            <div>
              <Text size="sm" fw={500} mb={4}>Senha</Text>
              <input
                type="text"
                placeholder="Senha do administrador"
                value={formCancelarForcado.senhaAdmin}
                onChange={(e) => setFormCancelarForcado(prev => ({ ...prev, senhaAdmin: e.target.value }))}
                autoComplete="nope"
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #dee2e6', borderRadius: 4, fontSize: 14, WebkitTextSecurity: 'disc' } as any}
              />
            </div>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => setModalCancelarForcado(false)}>Voltar</Button>
              <Button color="red" loading={salvandoCancelarForcado} onClick={cancelarForcado} disabled={formCancelarForcado.motivoCancelamento.trim().length < 10 || !formCancelarForcado.emailAdmin || !formCancelarForcado.senhaAdmin}>
                Confirmar Cancelamento
              </Button>
            </Group>
          </Stack>
        </Modal>
      )}
    </Stack>
  )
}
