'use client'

import { useEffect, useState } from 'react'
import { Title, Stack, Table, Group, Badge, Text, Loader, Center, Collapse, UnstyledButton, Card, ScrollArea, Button, Modal, NumberInput, Select, Textarea, Progress, ActionIcon, Tabs, TextInput } from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { IconChevronDown, IconChevronRight, IconPlayerPlay, IconPlayerPause, IconCheck, IconClipboardCheck, IconAlertTriangle, IconCut, IconGripVertical, IconSearch, IconFileText, IconPlus, IconArrowRight, IconX, IconPrinter } from '@tabler/icons-react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'
import { SortableCentroItem } from '@/components/pcp/SortableCentroItem'
import { useCentrosOrdenacao } from '@/hooks/useCentrosOrdenacao'

const PRIORIDADE_COLORS: Record<string, string> = { BAIXA: 'gray', NORMAL: 'blue', ALTA: 'orange', URGENTE: 'red' }
const STATUS_COLORS: Record<string, string> = { PENDENTE: 'gray', EM_ANDAMENTO: 'blue', PAUSADA: 'orange', CONCLUIDA: 'green' }

/**
 * Retorna a categoria/aba de um centro com base no campo tipoMaquina (determinístico).
 * Centros com tipoMaquina null retornam 'outros' e aparecem somente na aba "Todos".
 */
function getCategoriaCentro(tipoMaquina: string | null | undefined): string {
  if (!tipoMaquina) return 'outros'
  if (tipoMaquina === 'CORTADEIRA') return 'cortadeira'
  if (tipoMaquina === 'IMPRESSAO') return 'impressao'
  if (['ACABAMENTO', 'COLAGEM', 'VERNIZ'].includes(tipoMaquina)) return 'acabamento'
  return 'outros'
}

function getRowBackground(etapa: any): string | undefined {
  if (etapa.status === 'CONCLUIDA') return 'var(--mantine-color-green-0)'
  if (etapa.status === 'EM_ANDAMENTO') return 'var(--mantine-color-yellow-0)'
  if (etapa.status === 'PAUSADA') return 'var(--mantine-color-orange-0)'
  // Atrasada: entrega < hoje e não concluída
  if (etapa.dataEntrega && new Date(etapa.dataEntrega) < new Date() && etapa.status !== 'CONCLUIDA') {
    return 'var(--mantine-color-red-0)'
  }
  if (etapa.status === 'PENDENTE') return 'var(--mantine-color-gray-0)'
  return undefined
}

function SortableRow({ etapa, children, background, highlighted }: { etapa: { id: string }; children: React.ReactNode; background?: string; highlighted?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: etapa.id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
    opacity: isDragging ? 0.5 : 1,
    background: highlighted ? 'var(--mantine-color-yellow-2)' : (background || undefined),
    animation: highlighted ? 'flash-highlight 2s ease-out' : undefined,
  }

  return (
    <Table.Tr ref={setNodeRef} style={style} {...attributes} data-etapa-id={etapa.id}>
      <Table.Td style={{ width: 30, cursor: 'grab' }} {...listeners}>
        <IconGripVertical size={14} color="gray" />
      </Table.Td>
      {children}
    </Table.Tr>
  )
}

export default function ProgramacaoPage() {
  useEffect(() => { document.title = 'PCP - Painel Operacional' }, [])

  const [painel, setPainel] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [abertos, setAbertos] = useState<Record<string, boolean>>({})
  const [activeTab, setActiveTab] = useState<string>('todos')
  // Filtros
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string | null>(null)
  const [filtroPrioridade, setFiltroPrioridade] = useState<string | null>(null)
  const [filtroGrupo, setFiltroGrupo] = useState<string | null>(null)
  const [filtroDataRange, setFiltroDataRange] = useState<[Date | null, Date | null]>([null, null])
  // Modais
  const [modalApontar, setModalApontar] = useState<{ etapaId: string; opNumero: number; descricao: string } | null>(null)
  const [modalPausar, setModalPausar] = useState<{ etapaId: string; opNumero: number } | null>(null)
  const [modalDesmembrar, setModalDesmembrar] = useState<{ etapaId: string; opNumero: number; quantidade: number; descricao: string } | null>(null)
  const [formApontar, setFormApontar] = useState({ quantidadeProduzida: 0, quantidadePerda: 0, motivoPerda: '', observacao: '' })
  const [formPausar, setFormPausar] = useState({ motivoParada: 'ACERTO_MAQUINA', observacao: '' })
  const [formDesmembrar, setFormDesmembrar] = useState<Array<{ centroProducaoId: string; quantidade: number }>>([{ centroProducaoId: '', quantidade: 0 }, { centroProducaoId: '', quantidade: 0 }])
  const [centrosDisponiveis, setCentrosDisponiveis] = useState<any[]>([])
  const [editingObs, setEditingObs] = useState<{ id: string; value: string } | null>(null)
  const [editingGrupo, setEditingGrupo] = useState<string | null>(null) // centroId being renamed
  // Mover OS para outro grupo
  const [modalMover, setModalMover] = useState<{ etapaId: string; opNumero: number; centroAtualId: string; centroDescricao: string } | null>(null)
  // Postergar data de entrega
  const [modalPostData, setModalPostData] = useState<{ opId: string; opNumero: number; dataAtual: string } | null>(null)
  const [novaDataEntrega, setNovaDataEntrega] = useState<Date | null>(null)
  // Feature 4: Localizar OS
  const [highlightedEtapa, setHighlightedEtapa] = useState<string | null>(null)
  // Feature 5a: Novo Grupo (Centro)
  const [modalNovoGrupo, setModalNovoGrupo] = useState(false)
  const [formNovoGrupo, setFormNovoGrupo] = useState({ descricao: '', tipo: '' })
  // Feature 5b: Adicionar OS manual
  const [modalAdicionarOS, setModalAdicionarOS] = useState<{ centroId: string; centroDescricao: string } | null>(null)
  const [formAdicionarOS, setFormAdicionarOS] = useState({ opNumero: 0, descricao: '' })
  const [opEncontrada, setOpEncontrada] = useState<any>(null)
  const [buscandoOp, setBuscandoOp] = useState(false)
  async function carregar() {
    setLoading(true)
    try {
      const [painelRes, centrosRes] = await Promise.all([
        api.get('/pcp/programacao/painel'),
        api.get('/centros-producao', { params: { limit: 50, status: 'true' } }),
      ])
      setPainel(painelRes.data)
      setCentrosDisponiveis((centrosRes.data.data || []).map((c: any) => ({ value: c.id, label: `${c.codigo} - ${c.descricao}` })))
      const ab: Record<string, boolean> = {}
      for (const c of (painelRes.data.centros || [])) { if (c.resumo.total > 0) ab[c.centro.id] = true }
      setAbertos(ab)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor)
  )

  // Centros reordering mutation
  const ordenacaoMutation = useCentrosOrdenacao()

  function handleCentroDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = centrosFiltrados.findIndex((c: any) => c.centro.id === active.id)
    const newIndex = centrosFiltrados.findIndex((c: any) => c.centro.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    // Calculate new order
    const novaOrdem = arrayMove(centrosFiltrados, oldIndex, newIndex)

    // Build mutation payload with sequential positions
    const itens = novaOrdem.map((c: any, index: number) => ({
      id: c.centro.id,
      posicao: index,
    }))

    // Optimistic local update on painel.centros
    setPainel((prev: any) => {
      if (!prev) return prev
      const centrosAtualizados = prev.centros.map((c: any) => {
        const item = itens.find((i: any) => i.id === c.centro.id)
        if (item) return { ...c, centro: { ...c.centro, posicao: item.posicao } }
        return c
      })
      // Re-sort centros by posicao
      centrosAtualizados.sort((a: any, b: any) => {
        const posA = a.centro.posicao ?? 0
        const posB = b.centro.posicao ?? 0
        if (posA !== posB) return posA - posB
        return (a.centro.codigo || '').localeCompare(b.centro.codigo || '')
      })
      return { ...prev, centros: centrosAtualizados }
    })

    // Persist via API
    ordenacaoMutation.mutate(itens, {
      onError: () => {
        // Rollback: reload from server
        carregar()
      },
    })
  }

  async function handleDragEnd(centroId: string, event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    // Find the centro's etapas in current state
    const centroData = painel.centros.find((c: any) => c.centro.id === centroId)
    if (!centroData) return

    const oldIndex = centroData.etapas.findIndex((e: any) => e.id === active.id)
    const newIndex = centroData.etapas.findIndex((e: any) => e.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    // Optimistic update
    const novaOrdem = arrayMove(centroData.etapas, oldIndex, newIndex)
    setPainel((prev: any) => {
      if (!prev) return prev
      const centros = prev.centros.map((c: any) =>
        c.centro.id === centroId ? { ...c, etapas: novaOrdem } : c
      )
      return { ...prev, centros }
    })

    // Persist
    try {
      await api.patch('/pcp/etapas/reordenar', {
        centroProducaoId: centroId,
        etapaIds: novaOrdem.map((e: any) => e.id),
      })
    } catch (err: any) {
      notifications.show({ title: 'Erro ao reordenar', message: err?.response?.data?.message || 'Falha ao salvar ordem', color: 'red' })
      carregar() // Revert on error
    }
  }

  function toggleCentro(id: string) { setAbertos(prev => ({ ...prev, [id]: !prev[id] })) }

  async function iniciarEtapa(etapaId: string) {
    try {
      await api.patch(`/pcp/etapas/${etapaId}/iniciar`, {})
      notifications.show({ title: 'Etapa iniciada', message: '', color: 'green' })
      carregar()
    } catch (err: any) { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) }
  }

  async function concluirEtapa(etapaId: string) {
    try {
      await api.patch(`/pcp/etapas/${etapaId}/concluir`, {})
      notifications.show({ title: 'Etapa concluída', message: '', color: 'green' })
      carregar()
    } catch (err: any) { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) }
  }

  async function enviarApontamento() {
    if (!modalApontar) return
    try {
      await api.post(`/pcp/etapas/${modalApontar.etapaId}/apontar`, {
        quantidadeProduzida: formApontar.quantidadeProduzida,
        quantidadePerda: formApontar.quantidadePerda,
        motivoPerda: formApontar.motivoPerda || undefined,
        observacao: formApontar.observacao || undefined,
      })
      notifications.show({ title: 'Apontamento registrado', message: `+${formApontar.quantidadeProduzida} produzidas`, color: 'green' })
      setModalApontar(null)
      setFormApontar({ quantidadeProduzida: 0, quantidadePerda: 0, motivoPerda: '', observacao: '' })
      carregar()
    } catch (err: any) { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) }
  }

  async function enviarPausa() {
    if (!modalPausar) return
    try {
      await api.patch(`/pcp/etapas/${modalPausar.etapaId}/pausar`, {
        motivoParada: formPausar.motivoParada,
        observacao: formPausar.observacao || undefined,
      })
      notifications.show({ title: 'Etapa pausada', message: formPausar.motivoParada, color: 'orange' })
      setModalPausar(null)
      setFormPausar({ motivoParada: 'ACERTO_MAQUINA', observacao: '' })
      carregar()
    } catch (err: any) { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) }
  }

  async function enviarDesmembramento() {
    if (!modalDesmembrar) return
    const partesValidas = formDesmembrar.filter(p => p.centroProducaoId && p.quantidade > 0)
    if (partesValidas.length < 2) {
      notifications.show({ title: 'Erro', message: 'Informe pelo menos 2 partes com centro e quantidade', color: 'red' })
      return
    }
    try {
      await api.post(`/pcp/etapas/${modalDesmembrar.etapaId}/desmembrar`, { partes: partesValidas })
      notifications.show({ title: 'Etapa desmembrada', message: `Dividida em ${partesValidas.length} partes`, color: 'green' })
      setModalDesmembrar(null)
      setFormDesmembrar([{ centroProducaoId: '', quantidade: 0 }, { centroProducaoId: '', quantidade: 0 }])
      carregar()
    } catch (err: any) { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) }
  }

  async function salvarObservacao(etapaId: string, valor: string) {
    try {
      await api.patch(`/pcp/etapas/${etapaId}/observacao`, { observacaoOperador: valor })
      setPainel((prev: any) => {
        if (!prev) return prev
        const centros = prev.centros.map((c: any) => ({
          ...c,
          etapas: c.etapas.map((e: any) => e.id === etapaId ? { ...e, observacaoOperador: valor } : e)
        }))
        const aguardandoCartao = (prev.aguardandoCartao || []).map((item: any) =>
          item.id === etapaId ? { ...item, observacaoOperador: valor } : item
        )
        return { ...prev, centros, aguardandoCartao }
      })
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: 'Falha ao salvar observação', color: 'red' })
    }
    setEditingObs(null)
  }

  async function postergarEntrega(opId: string, novaData: string) {
    try {
      // Adiciona horário meio-dia para evitar problema de timezone
      await api.patch('/pcp/programacao/postergar-entrega', { opId, novaDataEntrega: `${novaData}T12:00:00` })
      notifications.show({ title: 'Entrega postergada', message: `Nova data: ${novaData.split('-').reverse().join('/')}`, color: 'orange' })
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' })
    }
  }

  async function excluirEtapa(etapaId: string, isDesmembramento: boolean) {
    const msg = isDesmembramento
      ? 'Reverter desmembramento? A quantidade será somada na etapa irmã.'
      : 'Excluir este lançamento manual da fila?'
    if (!confirm(msg)) return
    try {
      if (isDesmembramento) {
        await api.delete(`/pcp/etapas/${etapaId}/reverter-desmembramento`)
        notifications.show({ title: 'Desmembramento revertido', message: 'Quantidade devolvida', color: 'green' })
      } else {
        await api.delete(`/pcp/etapas/${etapaId}`)
        notifications.show({ title: 'Lançamento excluído', message: 'Etapa removida da fila', color: 'green' })
      }
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao excluir', color: 'red' })
    }
  }

  async function reverterDesmembramento(etapaId: string) {
    if (!confirm('Reverter desmembramento? A quantidade será somada de volta na etapa irmã.')) return
    try {
      await api.delete(`/pcp/etapas/${etapaId}/reverter-desmembramento`)
      notifications.show({ title: 'Desmembramento revertido', message: 'Quantidade devolvida à etapa restante', color: 'green' })
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao reverter', color: 'red' })
    }
  }

  async function moverEtapaParaGrupo(etapaId: string, novoCentroId: string) {
    try {
      await api.patch(`/pcp/etapas/${etapaId}/mover`, { centroProducaoId: novoCentroId })
      notifications.show({ title: 'OS movida', message: 'OS transferida para o novo grupo', color: 'green' })
      setModalMover(null)
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao mover', color: 'red' })
    }
  }

  async function renomearGrupo(centroId: string, novaDescricao: string) {
    try {
      // Busca dados atuais do centro para enviar todos os campos obrigatórios
      const centroAtual = painel.centros.find((c: any) => c.centro.id === centroId)?.centro
      await api.put(`/centros-producao/${centroId}`, {
        codigo: centroAtual?.codigo || novaDescricao.substring(0, 20).toUpperCase().replace(/\s+/g, '_'),
        descricao: novaDescricao,
        tipo: centroAtual?.tipo || 'MAQUINA',
      })
      notifications.show({ title: 'Grupo renomeado', message: `Renomeado para "${novaDescricao}"`, color: 'green' })
      setEditingGrupo(null)
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao renomear', color: 'red' })
    }
  }

  async function verPdfOp(opId: string) {
    try {
      const res = await api.get(`/ordens-producao/${opId}/pdf`, { responseType: 'blob' })
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch (err: any) {
      notifications.show({ title: 'PDF não disponível', message: 'PDF não encontrado para esta OP', color: 'orange' })
    }
  }

  async function liberarProducao(opId: string) {
    try {
      // Marca material como recebido — remove "encomendado" das observações da OP
      await api.patch(`/ordens-producao/${opId}`, {
        observacoes: painel.aguardandoCartao?.find((i: any) => i.opId === opId)?.observacoes?.replace(/\[Bobina\].*encomendad[oa].*\n?/gi, '') || undefined,
      })
      notifications.show({ title: 'Material recebido', message: 'Cartão recebido — OS liberada do aguardo', color: 'green' })
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao liberar', color: 'red' })
    }
  }

  // Feature 4: Localizar OS — when busca is a pure number and user presses Enter
  function localizarOS() {
    if (!painel || !busca.trim()) return
    const numero = busca.trim()
    // Search all centros (unfiltered) for the OS number
    for (const centro of painel.centros) {
      const etapa = centro.etapas.find((e: any) => String(e.opNumero) === numero)
      if (etapa) {
        // Expand this centro
        setAbertos(prev => ({ ...prev, [centro.centro.id]: true }))
        // Switch to the correct tab
        const categoriaCentro = getCategoriaCentro(centro.centro.tipoMaquina)
        if (activeTab !== 'todos' && activeTab !== categoriaCentro) {
          setActiveTab('todos')
        }
        // Highlight the row
        setHighlightedEtapa(etapa.id)
        // Scroll to the row after a brief delay to allow expansion
        setTimeout(() => {
          const row = document.querySelector(`[data-etapa-id="${etapa.id}"]`)
          if (row) row.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }, 200)
        // Clear highlight after 2.5 seconds
        setTimeout(() => setHighlightedEtapa(null), 2500)
        return
      }
    }
    notifications.show({ title: 'OS não encontrada', message: `Nenhuma OS #${numero} encontrada no painel`, color: 'orange' })
  }

  // Feature 5a: Criar novo grupo (centro de produção)
  async function criarNovoGrupo() {
    if (!formNovoGrupo.descricao.trim()) {
      notifications.show({ title: 'Erro', message: 'Informe o nome do grupo', color: 'red' })
      return
    }
    if (!formNovoGrupo.tipo) {
      notifications.show({ title: 'Erro', message: 'Selecione a aba', color: 'red' })
      return
    }
    // Mapear aba para tipoMaquina
    const tipoMaquinaMap: Record<string, string> = { cortadeira: 'CORTADEIRA', impressao: 'IMPRESSAO', acabamento: 'ACABAMENTO' }
    const tipoMaquina = tipoMaquinaMap[formNovoGrupo.tipo] || null
    const descricao = formNovoGrupo.descricao.trim()
    // Verificar se já existe grupo com mesma descrição
    const grupoExistente = painel?.centros?.find((c: any) =>
      c.centro.descricao.toLowerCase() === descricao.toLowerCase()
    )
    if (grupoExistente) {
      notifications.show({ title: 'Grupo já existe', message: `Já existe um grupo "${descricao}"`, color: 'orange' })
      return
    }
    try {
      await api.post('/centros-producao', {
        codigo: descricao.substring(0, 20).toUpperCase().replace(/\s+/g, '_'),
        descricao,
        tipo: 'MAQUINA',
        tipoMaquina,
        status: true,
      })
      notifications.show({ title: 'Grupo criado', message: `"${descricao}" criado com sucesso`, color: 'green' })
      setModalNovoGrupo(false)
      setFormNovoGrupo({ descricao: '', tipo: '' })
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao criar grupo', color: 'red' })
    }
  }

  // Feature 5b: Buscar OP para adicionar manualmente
  async function buscarOpParaAdicionar() {
    if (!formAdicionarOS.opNumero) return
    setBuscandoOp(true)
    setOpEncontrada(null)
    try {
      const res = await api.get('/ordens-producao', { params: { search: String(formAdicionarOS.opNumero), limit: 1 } })
      const ops = res.data.data || res.data || []
      if (ops.length > 0) {
        setOpEncontrada(ops[0])
      } else {
        notifications.show({ title: 'OP não encontrada', message: `Nenhuma OP #${formAdicionarOS.opNumero}`, color: 'orange' })
      }
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: 'Falha ao buscar OP', color: 'red' })
    } finally { setBuscandoOp(false) }
  }

  async function confirmarAdicionarOS() {
    if (!modalAdicionarOS || !formAdicionarOS.opNumero) return
    try {
      await api.post('/pcp/etapas/adicionar-manual', {
        opNumero: formAdicionarOS.opNumero,
        centroProducaoId: modalAdicionarOS.centroId,
        descricao: formAdicionarOS.descricao || undefined,
      })
      notifications.show({ title: 'OS adicionada', message: `OP #${formAdicionarOS.opNumero} adicionada à fila`, color: 'green' })
      setModalAdicionarOS(null)
      setFormAdicionarOS({ opNumero: 0, descricao: '' })
      setOpEncontrada(null)
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao adicionar OS', color: 'red' })
    }
  }

  if (loading) return <Center py="xl"><Loader /></Center>
  if (!painel) return <Text c="red" ta="center">Erro ao carregar painel</Text>

  // OPs que já aparecem no "Aguardando Cartão" — não repetir nos grupos abaixo
  const opsAguardandoCartao = new Set(
    (painel.aguardandoCartao || []).map((item: any) => item.opNumero)
  )

  // Filtra itens aguardandoCartao pelo tipoMaquina da primeira etapa conforme aba ativa
  const aguardandoCartaoFiltrado = (painel.aguardandoCartao || []).filter((item: any) => {
    if (activeTab === 'todos') return true
    return getCategoriaCentro(item.tipoMaquina) === activeTab
  })
  const mostrarAguardandoCartao = aguardandoCartaoFiltrado.length > 0

  const centrosFiltrados = (activeTab === 'todos'
    ? painel.centros
    : painel.centros.filter((c: any) => getCategoriaCentro(c.centro.tipoMaquina) === activeTab)
  ).filter((c: any) => {
    if (filtroGrupo) return c.centro.id === filtroGrupo
    return true
  }).map((c: any) => {
    let etapas = c.etapas
    if (busca) {
      const buscaLower = busca.toLowerCase()
      etapas = etapas.filter((e: any) =>
        String(e.opNumero).includes(busca) ||
        e.descricao?.toLowerCase().includes(buscaLower) ||
        e.observacoes?.toLowerCase().includes(buscaLower) ||
        e.materialPrincipal?.toLowerCase().includes(buscaLower)
      )
    }
    if (filtroStatus) {
      etapas = etapas.filter((e: any) => e.status === filtroStatus)
    }
    if (filtroPrioridade) {
      etapas = etapas.filter((e: any) => e.prioridade === filtroPrioridade)
    }
    if (filtroDataRange[0]) {
      etapas = etapas.filter((e: any) => e.dataEntrega && new Date(e.dataEntrega) >= filtroDataRange[0]!)
    }
    if (filtroDataRange[1]) {
      etapas = etapas.filter((e: any) => e.dataEntrega && new Date(e.dataEntrega) <= filtroDataRange[1]!)
    }
    return { ...c, etapas }
  }).filter((c: any) => {
    // Só ocultar grupos vazios quando há filtro de busca/status/prioridade/data ativo
    if (busca || filtroStatus || filtroPrioridade || filtroGrupo || filtroDataRange[0] || filtroDataRange[1]) {
      return c.etapas.length > 0
    }
    return true // Sem filtro: mostrar todos os grupos (inclusive vazios)
  })

  return (
    <Stack gap="md">
      <Title order={3}>Painel Operacional — Programação por Centro</Title>
      <Text size="sm" c="dimmed">Controle em tempo real: inicie, aponte produção, registre paradas e conclua etapas.</Text>

      <Group justify="space-between" align="flex-end">
        <Tabs value={activeTab} onChange={(value) => setActiveTab(value || 'todos')} style={{ flex: 1 }}>
          <Tabs.List>
            <Tabs.Tab value="todos">Todos</Tabs.Tab>
            <Tabs.Tab value="cortadeira">Cortadeira</Tabs.Tab>
            <Tabs.Tab value="impressao">Impressão</Tabs.Tab>
            <Tabs.Tab value="acabamento">Acabamento</Tabs.Tab>
          </Tabs.List>
        </Tabs>
        <Button size="xs" variant="light" leftSection={<IconPrinter size={14} />} onClick={() => window.print()} className="no-print">
          Imprimir
        </Button>
        <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => {
          // Pre-selecionar tipoMaquina com base na aba ativa (Req 7.1–7.4)
          const preSelectTipo = activeTab !== 'todos' ? activeTab : ''
          setFormNovoGrupo({ descricao: '', tipo: preSelectTipo })
          setModalNovoGrupo(true)
        }}>
          Novo Grupo
        </Button>
      </Group>

      <Group gap="sm" wrap="wrap">
        <TextInput
          placeholder="Localizar OS / Buscar..."
          leftSection={<IconSearch size={16} />}
          value={busca}
          onChange={(e) => setBusca(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') localizarOS() }}
          style={{ flex: 1, minWidth: 200 }}
          size="sm"
        />
        <DatePickerInput
          type="range"
          placeholder="Período entrega"
          value={filtroDataRange}
          onChange={(val) => setFiltroDataRange(val)}
          clearable
          size="sm"
          style={{ minWidth: 220 }}
          valueFormat="DD/MM/YYYY"
        />
        <Select
          placeholder="Status"
          data={[
            { value: 'PENDENTE', label: 'Pendente' },
            { value: 'EM_ANDAMENTO', label: 'Em Andamento' },
            { value: 'PAUSADA', label: 'Pausada' },
          ]}
          value={filtroStatus}
          onChange={setFiltroStatus}
          clearable
          size="sm"
          style={{ minWidth: 140 }}
        />
        <Select
          placeholder="Prioridade"
          data={[
            { value: 'BAIXA', label: 'Baixa' },
            { value: 'NORMAL', label: 'Normal' },
            { value: 'ALTA', label: 'Alta' },
            { value: 'URGENTE', label: 'Urgente' },
          ]}
          value={filtroPrioridade}
          onChange={setFiltroPrioridade}
          clearable
          size="sm"
          style={{ minWidth: 140 }}
        />
        <Select
          placeholder="Grupo"
          data={(painel?.centros || []).map((c: any) => ({ value: c.centro.id, label: c.centro.descricao }))}
          value={filtroGrupo}
          onChange={setFiltroGrupo}
          clearable
          searchable
          size="sm"
          style={{ minWidth: 180 }}
        />
      </Group>

      {/* Seção AGUARDANDO CARTÃO — filtrada por tipoMaquina conforme aba ativa */}
      {mostrarAguardandoCartao && (
        <Card withBorder padding="xs" style={{ borderColor: 'var(--mantine-color-yellow-5)', background: 'var(--mantine-color-yellow-0)' }}>
          <Text fw={700} size="lg" c="orange" mb="xs">AGUARDANDO CARTÃO</Text>
          <Table striped highlightOnHover style={{ minWidth: 800, fontSize: '11px' }}>
            <Table.Thead>
              <Table.Tr style={{ fontSize: '11px' }}>
                <Table.Th>OS</Table.Th>
                <Table.Th>Cliente</Table.Th>
                <Table.Th>Produto</Table.Th>
                <Table.Th>Qtd</Table.Th>
                <Table.Th>Cartão</Table.Th>
                <Table.Th>Gramatura</Table.Th>
                <Table.Th>Formato</Table.Th>
                <Table.Th>KG</Table.Th>
                <Table.Th>Entrega</Table.Th>
                <Table.Th>Acomp.</Table.Th>
                <Table.Th>Ações</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {aguardandoCartaoFiltrado.map((item: any) => (
                <Table.Tr key={item.opNumero}>
                  <Table.Td fw={700}>{item.opNumero}</Table.Td>
                  <Table.Td>{item.cliente || '—'}</Table.Td>
                  <Table.Td>{item.produto || '—'}</Table.Td>
                  <Table.Td>{item.quantidade?.toLocaleString('pt-BR')} {item.unidade}</Table.Td>
                  <Table.Td>
                    <Text size="sm">{item.materialPrincipal || '—'}</Text>
                    {item.bobinas?.length > 0 && (
                      <Stack gap={2} mt={4}>
                        {item.bobinas.map((b: any, i: number) => (
                          <Text key={i} size="xs" c={b.status === 'ENCOMENDADO' ? 'red' : 'green'}>
                            {b.status === 'ENCOMENDADO' ? '⏳' : '✓'} {b.descricao} ({b.kg.toLocaleString('pt-BR')} kg)
                          </Text>
                        ))}
                      </Stack>
                    )}
                  </Table.Td>
                  <Table.Td>{item.gramatura || '—'}</Table.Td>
                  <Table.Td>{item.formato || '—'}</Table.Td>
                  <Table.Td>
                    {item.kgEstoque > 0 && <Text size="xs" c="green">✓ {item.kgEstoque.toLocaleString('pt-BR')} kg estoque</Text>}
                    {item.kgEncomendado > 0 && <Text size="xs" c="red">⏳ {item.kgEncomendado.toLocaleString('pt-BR')} kg encomendado</Text>}
                  </Table.Td>
                  <Table.Td>{item.dataEntrega ? new Date(item.dataEntrega).toLocaleDateString('pt-BR') : '—'}</Table.Td>
                  <Table.Td style={{ minWidth: 150 }}>
                    {editingObs?.id === item.id ? (
                      <TextInput
                        size="xs"
                        value={editingObs.value}
                        onChange={(e) => setEditingObs({ id: item.id, value: e.currentTarget.value })}
                        onBlur={() => salvarObservacao(item.id, editingObs.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') salvarObservacao(item.id, editingObs.value); if (e.key === 'Escape') setEditingObs(null) }}
                        autoFocus
                        placeholder="Acompanhamento..."
                      />
                    ) : (
                      <Text
                        size="sm"
                        style={{ cursor: 'pointer', minHeight: 20 }}
                        onClick={() => setEditingObs({ id: item.id, value: item.observacaoOperador || '' })}
                        c={item.observacaoOperador ? undefined : 'dimmed'}
                      >
                        {item.observacaoOperador || 'Clique para editar'}
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      <Button size="compact-xs" color="green" variant="light" onClick={() => liberarProducao(item.opId)}>
                        Cartão Recebido
                      </Button>
                      <ActionIcon color="gray" variant="light" size="sm" onClick={() => verPdfOp(item.opId)} title="Ver PDF">
                        <IconFileText size={14} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          <Text size="xs" c="dimmed" mt="xs">OPs com material (cartão/bobina) marcado como "encomendado" no PDF da OS</Text>
        </Card>
      )}

      {/* Indicador de salvamento da reordenação de centros */}
      {ordenacaoMutation.isPending && (
        <Group gap="xs" justify="center">
          <Loader size="xs" />
          <Text size="xs" c="dimmed">Salvando ordem...</Text>
        </Group>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCentroDragEnd}>
        <SortableContext items={centrosFiltrados.map((c: any) => c.centro.id)} strategy={verticalListSortingStrategy}>
          <div style={{ opacity: ordenacaoMutation.isPending ? 0.7 : 1, transition: 'opacity 0.2s' }}>
          {centrosFiltrados.map((centro: any) => (
            <SortableCentroItem key={centro.centro.id} id={centro.centro.id}>
            <Card withBorder padding="xs">
          <Group justify="space-between" py={4} px={8}>
            <Group gap="sm" style={{ flex: 1 }}>
              <UnstyledButton onClick={() => toggleCentro(centro.centro.id)}>
                {abertos[centro.centro.id] ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
              </UnstyledButton>
              {editingGrupo === centro.centro.id ? (
                <Select
                  size="xs"
                  data={centrosDisponiveis}
                  searchable
                  value={centro.centro.id}
                  onChange={(val) => {
                    if (val && val !== centro.centro.id) {
                      // Pega a descrição do centro selecionado
                      const selected = centrosDisponiveis.find((c: any) => c.value === val)
                      const novaDescricao = selected?.label?.split(' - ').slice(1).join(' - ') || ''
                      if (novaDescricao) renomearGrupo(centro.centro.id, novaDescricao)
                    }
                    setEditingGrupo(null)
                  }}
                  onBlur={() => setEditingGrupo(null)}
                  onDropdownClose={() => setEditingGrupo(null)}
                  autoFocus
                  defaultDropdownOpened
                  style={{ minWidth: 280 }}
                  placeholder="Selecione..."
                  nothingFoundMessage="Nenhum centro encontrado"
                  allowDeselect={false}
                />
              ) : (
                <Text fw={700} c="teal" style={{ cursor: 'pointer' }} onClick={() => setEditingGrupo(centro.centro.id)}>
                  {centro.centro.descricao}
                </Text>
              )}
            </Group>
            <Group gap="xs">
              {centro.resumo.emAndamento > 0 && <Badge color="blue" size="sm">{centro.resumo.emAndamento} em andamento</Badge>}
              {centro.resumo.pausadas > 0 && <Badge color="orange" size="sm">{centro.resumo.pausadas} pausadas</Badge>}
              <Badge color="gray" size="sm">{centro.resumo.pendentes} pendentes</Badge>
              <ActionIcon color="teal" variant="light" size="sm" onClick={() => setModalAdicionarOS({ centroId: centro.centro.id, centroDescricao: centro.centro.descricao })} title="Adicionar OS">
                <IconPlus size={14} />
              </ActionIcon>
            </Group>
          </Group>

          <Collapse in={!!abertos[centro.centro.id]}>
            {centro.etapas.length === 0 ? (
              <Text size="sm" c="dimmed" ta="center" py="sm">Nenhuma OP na fila</Text>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => handleDragEnd(centro.centro.id, event)}>
                <SortableContext items={centro.etapas.map((e: any) => e.id)} strategy={verticalListSortingStrategy}>
                  <ScrollArea>
                    <Table striped highlightOnHover mt="xs" style={{ tableLayout: 'auto', fontSize: '11px' }}>
                      <Table.Thead>
                        <Table.Tr style={{ fontSize: '11px' }}>
                          <Table.Th style={{ width: 30 }}></Table.Th>
                          <Table.Th>OP</Table.Th>
                          <Table.Th>Cliente</Table.Th>
                          <Table.Th>Produto</Table.Th>
                          <Table.Th>Operação</Table.Th>
                          <Table.Th>Tir.</Table.Th>
                          <Table.Th>Material</Table.Th>
                          <Table.Th>Gram.</Table.Th>
                          <Table.Th>Fmt.</Table.Th>
                          <Table.Th>KG</Table.Th>
                          <Table.Th>Qtd</Table.Th>
                          <Table.Th>Prod.</Table.Th>
                          <Table.Th>Perda</Table.Th>
                          <Table.Th>%</Table.Th>
                          <Table.Th>Entrega</Table.Th>
                          <Table.Th>Prio.</Table.Th>
                          <Table.Th>Status</Table.Th>
                          <Table.Th>Acomp.</Table.Th>
                          <Table.Th>Ações</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {centro.etapas.map((etapa: any) => (
                          <SortableRow key={etapa.id} etapa={etapa} background={getRowBackground(etapa)} highlighted={highlightedEtapa === etapa.id}>
                            <Table.Td fw={600}>
                              {etapa.opNumero}
                              {etapa.materialEncomendado && <Text size="xs" c="red" fw={700}>* Aguardando restante cartão</Text>}
                            </Table.Td>
                            <Table.Td title={etapa.clienteNome || etapa.observacoes?.match(/\[Cliente\]\s*(.+)/)?.[1] || ''}><Text size="sm" style={{ wordBreak: 'break-word' }}>{etapa.clienteNome || etapa.observacoes?.match(/\[Cliente\]\s*(.+)/)?.[1] || '—'}</Text></Table.Td>
                            <Table.Td title={etapa.produtoNome || etapa.observacoes?.match(/\[Produto\]\s*(.+)/)?.[1] || ''}><Text size="sm" style={{ wordBreak: 'break-word' }}>{etapa.produtoNome || etapa.observacoes?.match(/\[Produto\]\s*(.+)/)?.[1] || '—'}</Text></Table.Td>
                            <Table.Td><Text size="sm" style={{ wordBreak: 'break-word' }}>{etapa.descricao}</Text></Table.Td>
                            <Table.Td>{etapa.tiragem ? etapa.tiragem.toLocaleString('pt-BR') : '—'}</Table.Td>
                            <Table.Td><Text size="sm" style={{ wordBreak: 'break-word' }}>{etapa.materialPrincipal || '—'}</Text></Table.Td>
                            <Table.Td>{etapa.gramatura || '—'}</Table.Td>
                            <Table.Td>{etapa.formato || '—'}</Table.Td>
                            <Table.Td>{etapa.pesoKg ? `${etapa.pesoKg.toLocaleString('pt-BR')} kg` : '—'}</Table.Td>
                            <Table.Td>{etapa.quantidade.toLocaleString('pt-BR')} {etapa.unidade}</Table.Td>
                            <Table.Td fw={600} c="green">{etapa.quantidadeProduzida.toLocaleString('pt-BR')}</Table.Td>
                            <Table.Td>{etapa.quantidadePerda > 0 ? <Text c="red" size="sm">{etapa.quantidadePerda}</Text> : '—'}</Table.Td>
                            <Table.Td w={100}><Progress value={etapa.percentual} size="lg" color={etapa.percentual >= 100 ? 'green' : 'blue'} /><Text size="xs" ta="center">{etapa.percentual}%</Text></Table.Td>
                            <Table.Td style={{ minWidth: 100 }}>
                              {etapa.dataEntrega ? (
                                <Group gap={4} wrap="nowrap">
                                  <Text size="sm" style={{ cursor: 'pointer' }} onClick={() => setModalPostData({ opId: etapa.opId, opNumero: etapa.opNumero, dataAtual: etapa.dataEntrega })}>
                                    {new Date(etapa.dataEntrega).toLocaleDateString('pt-BR')}
                                  </Text>
                                  {etapa.vezesPostergada === 0 && <Text size="sm">🟢</Text>}
                                  {etapa.vezesPostergada === 1 && <Text size="sm">🟡</Text>}
                                  {etapa.vezesPostergada >= 2 && <Text size="sm">🔴</Text>}
                                </Group>
                              ) : '—'}
                            </Table.Td>
                            <Table.Td>
                              <Badge
                                color={PRIORIDADE_COLORS[etapa.prioridade]}
                                size="sm"
                                variant={etapa.prioridade === 'URGENTE' ? 'filled' : 'light'}
                                style={{ cursor: 'pointer' }}
                                onClick={() => {
                                  const opcoes = ['BAIXA', 'NORMAL', 'ALTA', 'URGENTE']
                                  const atual = opcoes.indexOf(etapa.prioridade)
                                  const nova = opcoes[(atual + 1) % opcoes.length]
                                  api.patch(`/ordens-producao/${etapa.opId}`, { prioridade: nova }).then(() => carregar())
                                }}
                                title="Clique para alterar prioridade"
                              >
                                {etapa.prioridade}
                              </Badge>
                            </Table.Td>
                            <Table.Td style={{ minWidth: 90 }}><Badge color={STATUS_COLORS[etapa.status]} size="sm" style={{ whiteSpace: 'nowrap' }}>{etapa.status === 'EM_ANDAMENTO' ? 'ANDAMENTO' : etapa.status}</Badge></Table.Td>
                            <Table.Td style={{ minWidth: 150 }}>
                              {editingObs?.id === etapa.id ? (
                                <TextInput
                                  size="xs"
                                  value={editingObs.value}
                                  onChange={(e) => setEditingObs({ id: etapa.id, value: e.currentTarget.value })}
                                  onBlur={() => salvarObservacao(etapa.id, editingObs.value)}
                                  onKeyDown={(e) => { if (e.key === 'Enter') salvarObservacao(etapa.id, editingObs.value); if (e.key === 'Escape') setEditingObs(null) }}
                                  autoFocus
                                  placeholder="Status..."
                                />
                              ) : (
                                <Text
                                  size="sm"
                                  style={{ cursor: 'pointer', minHeight: 20 }}
                                  onClick={() => setEditingObs({ id: etapa.id, value: etapa.observacaoOperador || '' })}
                                  c={etapa.observacaoOperador ? undefined : 'dimmed'}
                                >
                                  {etapa.observacaoOperador || 'Clique para editar'}
                                </Text>
                              )}
                            </Table.Td>
                            <Table.Td>
                              <Group gap={2} wrap="nowrap">
                                <ActionIcon color="gray" variant="light" size="sm" onClick={() => verPdfOp(etapa.opId)} title="Ver PDF da OP">
                                  <IconFileText size={14} />
                                </ActionIcon>
                                <ActionIcon color="indigo" variant="light" size="sm" onClick={() => setModalMover({ etapaId: etapa.id, opNumero: etapa.opNumero, centroAtualId: centro.centro.id, centroDescricao: centro.centro.descricao })} title="Mover para outro grupo">
                                  <IconArrowRight size={14} />
                                </ActionIcon>
                                {etapa.status === 'PENDENTE' && (
                                  <>
                                    <ActionIcon color="green" variant="light" size="sm" onClick={() => iniciarEtapa(etapa.id)} title="Iniciar">
                                      <IconPlayerPlay size={14} />
                                    </ActionIcon>
                                    <ActionIcon color="violet" variant="light" size="sm" onClick={() => { setModalDesmembrar({ etapaId: etapa.id, opNumero: etapa.opNumero, quantidade: etapa.quantidade, descricao: etapa.descricao }); setFormDesmembrar([{ centroProducaoId: '', quantidade: Math.floor(etapa.quantidade / 2) }, { centroProducaoId: '', quantidade: Math.ceil(etapa.quantidade / 2) }]) }} title="Desmembrar">
                                      <IconCut size={14} />
                                    </ActionIcon>
                                  </>
                                )}
                                {etapa.status === 'PAUSADA' && (
                                  <ActionIcon color="green" variant="light" size="sm" onClick={() => iniciarEtapa(etapa.id)} title="Retomar">
                                    <IconPlayerPlay size={14} />
                                  </ActionIcon>
                                )}
                                {etapa.status === 'EM_ANDAMENTO' && (
                                  <>
                                    <ActionIcon color="blue" variant="light" size="sm" onClick={() => setModalApontar({ etapaId: etapa.id, opNumero: etapa.opNumero, descricao: etapa.descricao })} title="Apontar Produção">
                                      <IconClipboardCheck size={14} />
                                    </ActionIcon>
                                    <ActionIcon color="orange" variant="light" size="sm" onClick={() => setModalPausar({ etapaId: etapa.id, opNumero: etapa.opNumero })} title="Pausar">
                                      <IconPlayerPause size={14} />
                                    </ActionIcon>
                                    <ActionIcon color="green" variant="light" size="sm" onClick={() => concluirEtapa(etapa.id)} title="Concluir">
                                      <IconCheck size={14} />
                                    </ActionIcon>
                                  </>
                                )}
                                {(etapa.isDesmembramento || etapa.isManual) && etapa.status === 'PENDENTE' && (
                                  <ActionIcon color="red" variant="light" size="sm" onClick={() => excluirEtapa(etapa.id, etapa.isDesmembramento)} title={etapa.isDesmembramento ? 'Reverter desmembramento' : 'Excluir lançamento manual'}>
                                    <IconX size={14} />
                                  </ActionIcon>
                                )}
                              </Group>
                            </Table.Td>
                          </SortableRow>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </ScrollArea>
                </SortableContext>
              </DndContext>
            )}
          </Collapse>
        </Card>
            </SortableCentroItem>
      ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Modal: Apontar Produção */}
      <Modal opened={!!modalApontar} onClose={() => setModalApontar(null)} title={`Apontar Produção — OP #${modalApontar?.opNumero}`} centered>
        <Stack gap="md">
          <Text size="sm" c="dimmed">{modalApontar?.descricao}</Text>
          <Group grow>
            <NumberInput label="Quantidade Produzida" value={formApontar.quantidadeProduzida} onChange={(v) => setFormApontar({ ...formApontar, quantidadeProduzida: typeof v === 'number' ? v : 0 })} min={0} />
            <NumberInput label="Quantidade Perda" value={formApontar.quantidadePerda} onChange={(v) => setFormApontar({ ...formApontar, quantidadePerda: typeof v === 'number' ? v : 0 })} min={0} />
          </Group>
          {formApontar.quantidadePerda > 0 && (
            <Select label="Motivo da Perda" data={['ACERTO', 'REFUGO', 'DEFEITO', 'APARA']} value={formApontar.motivoPerda} onChange={(v) => setFormApontar({ ...formApontar, motivoPerda: v || '' })} />
          )}
          <Textarea label="Observação" value={formApontar.observacao} onChange={(e) => setFormApontar({ ...formApontar, observacao: e.currentTarget.value })} />
          <Button onClick={enviarApontamento} fullWidth>Registrar Apontamento</Button>
        </Stack>
      </Modal>

      {/* Modal: Pausar Etapa */}
      <Modal opened={!!modalPausar} onClose={() => setModalPausar(null)} title={`Pausar Etapa — OP #${modalPausar?.opNumero}`} centered>
        <Stack gap="md">
          <Select label="Motivo da Parada" data={[
            { value: 'MANUTENCAO', label: 'Manutenção' },
            { value: 'FALTA_MATERIAL', label: 'Falta de Material' },
            { value: 'ACERTO_MAQUINA', label: 'Acerto de Máquina' },
            { value: 'TROCA_TURNO', label: 'Troca de Turno' },
            { value: 'OUTRO', label: 'Outro' },
          ]} value={formPausar.motivoParada} onChange={(v) => setFormPausar({ ...formPausar, motivoParada: v || 'OUTRO' })} />
          <Textarea label="Observação" placeholder="Descreva o motivo" value={formPausar.observacao} onChange={(e) => setFormPausar({ ...formPausar, observacao: e.currentTarget.value })} />
          <Button color="orange" onClick={enviarPausa} fullWidth leftSection={<IconAlertTriangle size={16} />}>Registrar Parada</Button>
        </Stack>
      </Modal>

      {/* Modal: Desmembrar Etapa */}
      <Modal opened={!!modalDesmembrar} onClose={() => setModalDesmembrar(null)} title={`Desmembrar — OP #${modalDesmembrar?.opNumero}`} centered size="lg">
        <Stack gap="md">
          <Text size="sm" c="dimmed">{modalDesmembrar?.descricao} — Total: <strong>{modalDesmembrar?.quantidade?.toLocaleString('pt-BR')} un</strong></Text>
          <Text size="xs" c="orange">A soma das partes deve ser igual à quantidade total ({modalDesmembrar?.quantidade?.toLocaleString('pt-BR')})</Text>

          {formDesmembrar.map((parte, idx) => (
            <Group key={idx} grow>
              <Select
                label={`Parte ${idx + 1} — Centro`}
                data={centrosDisponiveis}
                value={parte.centroProducaoId}
                onChange={(v) => { const novo = [...formDesmembrar]; novo[idx].centroProducaoId = v || ''; setFormDesmembrar(novo) }}
                searchable
                placeholder="Selecione a máquina"
              />
              <NumberInput
                label="Quantidade"
                value={parte.quantidade}
                onChange={(v) => { const novo = [...formDesmembrar]; novo[idx].quantidade = typeof v === 'number' ? v : 0; setFormDesmembrar(novo) }}
                min={1}
              />
            </Group>
          ))}

          <Group justify="space-between">
            <Button variant="light" size="xs" onClick={() => setFormDesmembrar([...formDesmembrar, { centroProducaoId: '', quantidade: 0 }])}>
              + Adicionar Parte
            </Button>
            <Text size="sm" fw={600} c={formDesmembrar.reduce((a, p) => a + p.quantidade, 0) === modalDesmembrar?.quantidade ? 'green' : 'red'}>
              Soma: {formDesmembrar.reduce((a, p) => a + p.quantidade, 0).toLocaleString('pt-BR')} / {modalDesmembrar?.quantidade?.toLocaleString('pt-BR')}
            </Text>
          </Group>

          <Button color="violet" onClick={enviarDesmembramento} fullWidth leftSection={<IconCut size={16} />} disabled={formDesmembrar.reduce((a, p) => a + p.quantidade, 0) !== modalDesmembrar?.quantidade}>
            Desmembrar Etapa
          </Button>
        </Stack>
      </Modal>

      {/* Modal: Novo Grupo (Feature 5a) */}
      <Modal opened={modalNovoGrupo} onClose={() => setModalNovoGrupo(false)} title="Novo Grupo" centered>
        <Stack gap="md">
          <Select
            label="Aba"
            placeholder="Selecione a aba onde o grupo aparecerá"
            data={[
              { value: 'cortadeira', label: 'Cortadeira' },
              { value: 'impressao', label: 'Impressão' },
              { value: 'acabamento', label: 'Acabamento' },
            ]}
            value={formNovoGrupo.tipo}
            onChange={(v) => setFormNovoGrupo({ ...formNovoGrupo, tipo: v || '' })}
            required
          />
          <TextInput
            label="Nome do Grupo"
            placeholder="Ex: Cortadeira Doin MC"
            value={formNovoGrupo.descricao}
            onChange={(e) => setFormNovoGrupo({ ...formNovoGrupo, descricao: e.currentTarget.value })}
            required
          />
          <Text size="xs" c="dimmed">O grupo será criado vazio. Use o botão "+" para adicionar OS existentes.</Text>
          <Button onClick={criarNovoGrupo} fullWidth leftSection={<IconPlus size={16} />}>
            Criar Grupo
          </Button>
        </Stack>
      </Modal>

      {/* Modal: Adicionar OS manualmente (Feature 5b) */}
      <Modal opened={!!modalAdicionarOS} onClose={() => { setModalAdicionarOS(null); setOpEncontrada(null); setFormAdicionarOS({ opNumero: 0, descricao: '' }) }} title={`Adicionar OS — ${modalAdicionarOS?.centroDescricao}`} centered>
        <Stack gap="md">
          <Group grow align="flex-end">
            <NumberInput
              label="Número da OS"
              placeholder="Ex: 2849"
              value={formAdicionarOS.opNumero || ''}
              onChange={(v) => setFormAdicionarOS({ ...formAdicionarOS, opNumero: typeof v === 'number' ? v : 0 })}
              min={1}
            />
            <Button variant="light" onClick={buscarOpParaAdicionar} loading={buscandoOp}>
              Buscar
            </Button>
          </Group>

          {opEncontrada && (
            <Card withBorder padding="sm">
              <Text size="sm" fw={600}>OP #{opEncontrada.numero}</Text>
              <Text size="xs" c="dimmed">Produto: {opEncontrada.produto?.nome || opEncontrada.produtoId}</Text>
              <Text size="xs" c="dimmed">Quantidade: {Number(opEncontrada.quantidade).toLocaleString('pt-BR')} {opEncontrada.unidadeMedida}</Text>
              {opEncontrada.cliente && <Text size="xs" c="dimmed">Cliente: {opEncontrada.cliente.razaoSocial || opEncontrada.clienteId}</Text>}
            </Card>
          )}

          <Textarea
            label="Descrição da etapa (opcional)"
            placeholder="Ex: Corte adicional"
            value={formAdicionarOS.descricao}
            onChange={(e) => setFormAdicionarOS({ ...formAdicionarOS, descricao: e.currentTarget.value })}
          />

          <Button onClick={confirmarAdicionarOS} fullWidth disabled={!opEncontrada} leftSection={<IconPlus size={16} />}>
            Adicionar à Fila
          </Button>
        </Stack>
      </Modal>

      {/* Modal: Postergar Data de Entrega */}
      <Modal opened={!!modalPostData} onClose={() => { setModalPostData(null); setNovaDataEntrega(null) }} title={`Postergar Entrega — OS #${modalPostData?.opNumero}`} centered>
        <Stack gap="md">
          <Text size="sm" c="dimmed">Data atual: <strong>{modalPostData?.dataAtual ? new Date(modalPostData.dataAtual).toLocaleDateString('pt-BR') : '—'}</strong></Text>
          <DatePickerInput
            label="Nova data de entrega"
            value={novaDataEntrega}
            onChange={setNovaDataEntrega}
            valueFormat="DD/MM/YYYY"
            placeholder="Selecione a nova data"
            clearable
          />
          <Button
            fullWidth
            color="orange"
            disabled={!novaDataEntrega}
            onClick={() => {
              if (novaDataEntrega && modalPostData) {
                const y = novaDataEntrega.getFullYear()
                const m = String(novaDataEntrega.getMonth() + 1).padStart(2, '0')
                const d = String(novaDataEntrega.getDate()).padStart(2, '0')
                postergarEntrega(modalPostData.opId, `${y}-${m}-${d}`)
                setModalPostData(null)
                setNovaDataEntrega(null)
              }
            }}
          >
            Confirmar Postergação
          </Button>
        </Stack>
      </Modal>

      {/* Modal: Mover OS para outro grupo */}
      <Modal opened={!!modalMover} onClose={() => setModalMover(null)} title={`Mover OS #${modalMover?.opNumero} para outro grupo`} centered>
        <Stack gap="md">
          <Text size="sm" c="dimmed">Selecione o grupo de destino (mesma aba):</Text>
          <Select
            data={centrosDisponiveis.filter((c: any) => {
              if (c.value === modalMover?.centroAtualId) return false
              // Filtrar pela mesma categoria — baseado no tipoMaquina do centro atual
              const centroAtual = painel?.centros?.find((ct: any) => ct.centro.id === modalMover?.centroAtualId)
              if (centroAtual) {
                const categoriaAtual = getCategoriaCentro(centroAtual.centro.tipoMaquina)
                // Buscar tipoMaquina do centro opção pelo ID
                const centroOpcao = painel?.centros?.find((ct: any) => ct.centro.id === c.value)
                const categoriaOpcao = centroOpcao ? getCategoriaCentro(centroOpcao.centro.tipoMaquina) : 'outros'
                return categoriaOpcao === categoriaAtual
              }
              return true
            })}
            searchable
            placeholder="Selecione o grupo destino..."
            onChange={(val) => { if (val && modalMover) moverEtapaParaGrupo(modalMover.etapaId, val) }}
            nothingFoundMessage="Nenhum grupo encontrado na mesma aba"
          />
        </Stack>
      </Modal>

      {/* CSS for flash highlight animation + print styles */}
      <style>{`
        @keyframes flash-highlight {
          0% { background-color: var(--mantine-color-yellow-3); }
          100% { background-color: transparent; }
        }
        @media print {
          /* Esconder sidebar, header, filtros e botões de ação */
          nav, header, aside, .mantine-AppShell-navbar, .mantine-AppShell-header,
          .no-print, [class*="AppShell-navbar"], [class*="AppShell-header"] {
            display: none !important;
          }
          /* Expandir conteúdo principal */
          .mantine-AppShell-main, main {
            padding: 0 !important;
            margin: 0 !important;
          }
          /* Esconder grip de drag, filtros e botões de ação nas linhas */
          td:first-child, th:first-child,
          td:last-child, th:last-child {
            display: none !important;
          }
          /* Ajustar tamanho da fonte para impressão */
          table { font-size: 9px !important; }
          th, td { padding: 2px 4px !important; }
          /* Forçar todas as seções abertas */
          [data-mantine-collapse] { display: block !important; height: auto !important; overflow: visible !important; }
          /* Remover scroll */
          * { overflow: visible !important; }
          /* Orientação paisagem */
          @page { size: landscape; margin: 8mm; }
        }
      `}</style>
    </Stack>
  )
}
