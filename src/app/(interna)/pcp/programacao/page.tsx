'use client'

import { useEffect, useState } from 'react'
import { Title, Stack, Table, Group, Badge, Text, Loader, Center, Collapse, UnstyledButton, Card, ScrollArea, Button, Modal, NumberInput, Select, Textarea, Progress, ActionIcon, Tabs, TextInput, SegmentedControl, Autocomplete, Box, FileButton, Image, Checkbox } from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { IconChevronDown, IconChevronRight, IconPlayerPlay, IconPlayerPause, IconCheck, IconClipboardCheck, IconAlertTriangle, IconCut, IconGripVertical, IconSearch, IconFileText, IconPlus, IconArrowRight, IconX, IconPrinter, IconRefresh, IconCamera, IconSettings } from '@tabler/icons-react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'
import { SortableCentroItem } from '@/components/pcp/SortableCentroItem'
import VisaoDetalhadaProgramacao from '@/components/pcp/VisaoDetalhadaProgramacao'
import { useCentrosOrdenacao } from '@/hooks/useCentrosOrdenacao'
import { IconLayoutGrid, IconListDetails } from '@tabler/icons-react'

const PRIORIDADE_COLORS: Record<string, string> = { BAIXA: 'gray', NORMAL: 'blue', ALTA: 'orange', URGENTE: 'red' }
const STATUS_COLORS: Record<string, string> = { PENDENTE: 'gray', EM_ANDAMENTO: 'blue', PAUSADA: 'orange', CONCLUIDA: 'green' }

/**
 * Retorna a aba de um centro com base no código do Tipo de Processo
 * cadastrado (cadastro dinâmico em PCP → Cadastros → Tipo de Processo,
 * substitui o antigo enum fixo tipoMaquina). Cada Tipo de Processo ativo
 * gera sua própria aba — o código do tipo (ex: "CORTADEIRA") é usado como
 * chave da aba. Centro sem tipo de processo (não deveria ocorrer, já que o
 * campo é obrigatório) cai em 'outros' como salvaguarda.
 */
function getCategoriaCentro(tipoProcessoCodigo: string | null | undefined): string {
  return tipoProcessoCodigo?.toLowerCase() || 'outros'
}

/**
 * Regra de negócio confirmada pelo usuário: só as máquinas de Colagem/
 * Coladeira contam a produção em "embalagem" (unidade fechada, unitário) —
 * todas as outras (Impressão, Cortadeira, demais Acabamentos) contam em
 * "folhas" (tiragem). Usado no modal de Apontar/Finalizar Etapa para rotular
 * corretamente o campo de quantidade produzida.
 */
function unidadeContagem(tipoProcessoCodigo: string | null | undefined): { label: string; placeholder: string } {
  if (tipoProcessoCodigo === 'COLAGEM') return { label: 'Quantidade Produzida (embalagem)', placeholder: 'Un. de embalagem' }
  return { label: 'Quantidade Produzida (folhas)', placeholder: 'Tiragem em folhas' }
}

function getRowBackground(etapa: any, usaCoresStatus: boolean = true): string | undefined {
  // OP avulsa tem prioridade visual sobre as cores de status — precisa ser
  // reconhecida de imediato, independente do estágio da produção, e NÃO é
  // afetada pela flag "usaCoresStatusProgramacao" (Configuração PCP).
  if (etapa.isAvulsa) return 'var(--mantine-color-pink-light)'
  if (!usaCoresStatus) return undefined
  // Usa os tokens "-light" (overlay semi-transparente) em vez dos swatches
  // sólidos "-0": os swatches são fixos independente do tema, o que deixava
  // as linhas claras demais no tema escuro. Os tokens "-light" se adaptam
  // automaticamente entre claro/escuro.
  if (etapa.status === 'CONCLUIDA') return 'var(--mantine-color-green-light)'
  if (etapa.status === 'EM_ANDAMENTO') return 'var(--mantine-color-yellow-light)'
  if (etapa.status === 'PAUSADA') return 'var(--mantine-color-orange-light)'
  // Atrasada: entrega < hoje e não concluída
  if (etapa.dataEntrega && new Date(etapa.dataEntrega) < new Date() && etapa.status !== 'CONCLUIDA') {
    return 'var(--mantine-color-red-light)'
  }
  if (etapa.status === 'PENDENTE') return 'var(--mantine-color-gray-light)'
  return undefined
}

function SortableRow({ etapa, children, background, highlighted, selected, onToggleSelect }: { etapa: { id: string }; children: React.ReactNode; background?: string; highlighted?: boolean; selected?: boolean; onToggleSelect?: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: etapa.id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
    opacity: isDragging ? 0.5 : 1,
    background: highlighted ? 'var(--mantine-color-yellow-light-hover)' : (background || undefined),
    animation: highlighted ? 'flash-highlight 2s ease-out' : undefined,
  }

  return (
    <Table.Tr ref={setNodeRef} style={style} {...attributes} data-etapa-id={etapa.id}>
      <Table.Td style={{ width: 30, cursor: 'grab' }} {...listeners}>
        <IconGripVertical size={14} color="gray" />
      </Table.Td>
      <Table.Td style={{ width: 30, padding: '0 4px' }} onClick={(e) => { e.stopPropagation(); onToggleSelect?.() }}>
        <input type="checkbox" checked={!!selected} onChange={() => onToggleSelect?.()} style={{ cursor: 'pointer', width: 14, height: 14 }} />
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
  // Aba ativa no Modelo 1 (Grid) — chave é o código do Tipo de Processo em
  // minúsculas (ex: 'cortadeira'), gerado dinamicamente a partir do cadastro
  // (ver tiposProcesso). Valor inicial ajustado para o primeiro tipo
  // cadastrado assim que a lista carrega (useEffect abaixo).
  const [activeTab, setActiveTab] = useState<string>('')
  // Layout da tela: "grid" (tabelas por centro, padrão atual) ou "detalhado"
  // (lista mestre + painel de detalhe único, evita repetir a mesma OP em
  // várias linhas/abas). Persistido para lembrar a preferência do usuário.
  const [layoutView, setLayoutView] = useState<'grid' | 'detalhado'>(() => {
    if (typeof window === 'undefined') return 'grid'
    return (localStorage.getItem('pcp-programacao-layout') as 'grid' | 'detalhado') || 'grid'
  })
  function alterarLayoutView(valor: 'grid' | 'detalhado') {
    setLayoutView(valor)
    localStorage.setItem('pcp-programacao-layout', valor)
  }

  // Configurador de colunas de impressão por tipo de processo.
  // Cada tipo de processo pode ter um subconjunto de colunas selecionadas
  // para aparecer na impressão. Salvo em localStorage.
  const COLUNAS_DISPONIVEIS = [
    { id: 'os', label: 'OS' },
    { id: 'cliente', label: 'Cliente' },
    { id: 'produto', label: 'Produto' },
    { id: 'tipoOp', label: 'Tipo OP' },
    { id: 'quantidade', label: 'Qtd' },
    { id: 'tiragem', label: 'Tiragem' },
    { id: 'entrega', label: 'Entrega' },
    { id: 'material', label: 'Material/Cartão' },
    { id: 'gramatura', label: 'Gramatura' },
    { id: 'formato', label: 'Formato' },
    { id: 'matriz', label: 'Matriz' },
    { id: 'cores', label: 'Cores' },
    { id: 'pantone01', label: 'Pantone 1' },
    { id: 'pantone02', label: 'Pantone 2' },
    { id: 'pantone03', label: 'Pantone 3' },
    { id: 'kg', label: 'KG' },
    { id: 'prioridade', label: 'Prioridade' },
    { id: 'observacao', label: 'Acompanhamento' },
  ]
  const COLUNAS_DEFAULT_CORTADEIRA = ['os', 'cliente', 'produto', 'quantidade', 'tiragem', 'entrega', 'material', 'gramatura', 'formato', 'kg']
  const COLUNAS_DEFAULT_OUTROS = ['os', 'cliente', 'produto', 'tipoOp', 'quantidade', 'tiragem', 'entrega', 'material', 'gramatura', 'formato', 'matriz', 'cores', 'pantone01', 'pantone02', 'pantone03', 'kg']

  const [colunasImpressao, setColunasImpressao] = useState<Record<string, string[]>>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const salvo = localStorage.getItem('pcp-colunas-impressao')
      return salvo ? JSON.parse(salvo) : {}
    } catch { return {} }
  })
  const [modalColunasImpressao, setModalColunasImpressao] = useState(false)
  const [colunasEditando, setColunasEditando] = useState<Record<string, string[]>>({})

  function getColunasParaProcesso(tipoProcessoCodigo: string): string[] {
    const key = tipoProcessoCodigo.toLowerCase()
    if (colunasImpressao[key]) return colunasImpressao[key]
    return key === 'cortadeira' ? COLUNAS_DEFAULT_CORTADEIRA : COLUNAS_DEFAULT_OUTROS
  }

  function abrirConfigColunas() {
    // Inicializa o estado de edição com as colunas atuais de cada tipo de processo
    const edit: Record<string, string[]> = {}
    for (const tp of tiposProcesso) {
      const key = tp.codigo.toLowerCase()
      edit[key] = colunasImpressao[key] || (key === 'cortadeira' ? COLUNAS_DEFAULT_CORTADEIRA : COLUNAS_DEFAULT_OUTROS)
    }
    setColunasEditando(edit)
    setModalColunasImpressao(true)
  }

  function salvarConfigColunas() {
    setColunasImpressao(colunasEditando)
    localStorage.setItem('pcp-colunas-impressao', JSON.stringify(colunasEditando))
    setModalColunasImpressao(false)
    notifications.show({ title: 'Colunas salvas', message: 'Configuração de impressão atualizada', color: 'green' })
  }

  function toggleColunaEditando(tipoKey: string, colunaId: string) {
    setColunasEditando(prev => {
      const atual = prev[tipoKey] || []
      const nova = atual.includes(colunaId) ? atual.filter(c => c !== colunaId) : [...atual, colunaId]
      return { ...prev, [tipoKey]: nova }
    })
  }
  // Filtros
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string | null>(null)
  const [filtroPrioridade, setFiltroPrioridade] = useState<string | null>(null)
  const [filtroGrupo, setFiltroGrupo] = useState<string | null>(null)
  const [filtroDataRange, setFiltroDataRange] = useState<[Date | null, Date | null]>([null, null])
  // Modais
  // `finalizando`: quando true, o modal foi aberto pelo botão "Finalizar" —
  // ao salvar, registra o apontamento E conclui a etapa em seguida (a etapa
  // sai da fila do grupo), em vez de só registrar produção parcial.
  // tipoProcessoCodigo do centro da etapa — define a unidade de contagem
  // exibida no modal: máquinas de Colagem/Coladeira contam em "embalagem"
  // (unitário), as demais em "folhas/tiragem" (regra de negócio confirmada
  // pelo usuário).
  const [modalApontar, setModalApontar] = useState<{ etapaId: string; opNumero: number; descricao: string; finalizando?: boolean; quantidadeEtapa?: number; jaProduzido?: number; tipoProcessoCodigo?: string | null } | null>(null)
  // Foto anexada pelo operador como evidência da contagem produzida (opcional)
  const [fotoApontar, setFotoApontar] = useState<File | null>(null)
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
  // Trava de duplo clique/duplo submit no botão "Adicionar à Fila"
  const [salvandoAdicionarOS, setSalvandoAdicionarOS] = useState(false)
  const [opEncontrada, setOpEncontrada] = useState<any>(null)
  const [buscandoOp, setBuscandoOp] = useState(false)
  // OP Avulsa: aba do modal (existente vs avulsa) e, dentro de avulsa, o modo
  // (herdar de uma OP já cadastrada vs escolher produto/cliente livremente)
  const [tabAdicionarOS, setTabAdicionarOS] = useState<'existente' | 'avulsa'>('existente')
  const [modoAvulsa, setModoAvulsa] = useState<'herdar' | 'livre'>('herdar')
  const [formAvulsaOrigem, setFormAvulsaOrigem] = useState({ opNumero: 0, quantidade: 0, descricao: '' })
  const [opOrigemEncontrada, setOpOrigemEncontrada] = useState<any>(null)
  const [buscandoOpOrigem, setBuscandoOpOrigem] = useState(false)
  // clienteNome guarda o texto digitado/selecionado; clienteId só é preenchido
  // quando o nome bate com um cliente cadastrado formalmente (ver handler do Select)
  const [formAvulsaLivre, setFormAvulsaLivre] = useState<{ produtoId: string | null; produtoNome: string | null; clienteId: string | null; clienteNome: string | null; quantidade: number; descricao: string }>({ produtoId: null, produtoNome: null, clienteId: null, clienteNome: null, quantidade: 0, descricao: '' })
  const [produtosDisponiveis, setProdutosDisponiveis] = useState<any[]>([])
  const [clientesDisponiveis, setClientesDisponiveis] = useState<any[]>([])
  const [salvandoAvulsa, setSalvandoAvulsa] = useState(false)
  // Configuração de empresa (Configuração PCP) que habilita/desabilita as
  // cores de status na fila, nos dois layouts (Grid e Detalhado). A cor de
  // OP Avulsa nunca é afetada por essa flag — ver getRowBackground. Default
  // true enquanto a configuração real não carrega, para não gerar "flash"
  // de cores desabilitadas na primeira renderização.
  const [usaCoresStatus, setUsaCoresStatus] = useState(true)
  // Tipos de Processo ATIVOS cadastrados (PCP → Cadastros → Tipo de
  // Processo), ordenados por posição — cada um gera uma aba no painel,
  // substituindo a lista fixa (Cortadeira/Impressão/Acabamento/Outros) que
  // existia antes no código.
  const [tiposProcesso, setTiposProcesso] = useState<any[]>([])

  // Etapas concluídas (visualização por processo com opção de retornar)
  const [mostrarConcluidas, setMostrarConcluidas] = useState(false)
  const [etapasConcluidas, setEtapasConcluidas] = useState<any[]>([])
  const [loadingConcluidas, setLoadingConcluidas] = useState(false)
  const [modalRetornar, setModalRetornar] = useState<{ etapaId: string; opNumero: string } | null>(null)
  const [formRetornar, setFormRetornar] = useState({ emailAdmin: '', senhaAdmin: '' })
  const [salvandoRetornar, setSalvandoRetornar] = useState(false)

  // Seleção múltipla de etapas para ações em lote
  const [selectedEtapas, setSelectedEtapas] = useState<Set<string>>(new Set())
  const [acaoLoteLoading, setAcaoLoteLoading] = useState(false)
  const [modalMoverLote, setModalMoverLote] = useState(false)
  const [centroDestinoLote, setCentroDestinoLote] = useState<string | null>(null)

  function toggleSelectEtapa(etapaId: string) {
    setSelectedEtapas(prev => {
      const next = new Set(prev)
      if (next.has(etapaId)) next.delete(etapaId)
      else next.add(etapaId)
      return next
    })
  }

  function toggleSelectAllCentro(centroId: string) {
    const centro = painel?.centros?.find((c: any) => c.centro.id === centroId)
    if (!centro) return
    const etapaIds = centro.etapas.map((e: any) => e.id)
    setSelectedEtapas(prev => {
      const next = new Set(prev)
      const allSelected = etapaIds.every((id: string) => next.has(id))
      if (allSelected) {
        etapaIds.forEach((id: string) => next.delete(id))
      } else {
        etapaIds.forEach((id: string) => next.add(id))
      }
      return next
    })
  }

  function limparSelecao() { setSelectedEtapas(new Set()) }

  async function acaoLoteIniciar() {
    setAcaoLoteLoading(true)
    let sucesso = 0
    for (const etapaId of selectedEtapas) {
      try {
        await api.patch(`/pcp/etapas/${etapaId}/iniciar`, {})
        sucesso++
      } catch { /* ignora falhas individuais */ }
    }
    notifications.show({ title: 'Lote concluído', message: `${sucesso} etapa(s) iniciada(s)`, color: 'green' })
    limparSelecao()
    setAcaoLoteLoading(false)
    // Recarrega silenciosamente
    try { const { data } = await api.get('/pcp/programacao/painel'); setPainel(data) } catch {}
  }

  async function acaoLoteFinalizar() {
    if (!confirm(`Finalizar ${selectedEtapas.size} etapa(s) selecionada(s)?`)) return
    setAcaoLoteLoading(true)
    let sucesso = 0
    for (const etapaId of selectedEtapas) {
      try {
        await api.patch(`/pcp/etapas/${etapaId}/concluir`, {})
        sucesso++
      } catch { /* ignora falhas individuais */ }
    }
    notifications.show({ title: 'Lote concluído', message: `${sucesso} etapa(s) finalizada(s)`, color: 'green' })
    limparSelecao()
    setAcaoLoteLoading(false)
    try { const { data } = await api.get('/pcp/programacao/painel'); setPainel(data) } catch {}
  }

  async function acaoLoteMover() {
    if (!centroDestinoLote) return
    setAcaoLoteLoading(true)
    let sucesso = 0
    for (const etapaId of selectedEtapas) {
      try {
        await api.patch(`/pcp/etapas/${etapaId}/mover`, { centroProducaoId: centroDestinoLote })
        sucesso++
      } catch { /* ignora falhas individuais */ }
    }
    notifications.show({ title: 'Lote concluído', message: `${sucesso} etapa(s) movida(s)`, color: 'green' })
    limparSelecao()
    setModalMoverLote(false)
    setCentroDestinoLote(null)
    setAcaoLoteLoading(false)
    try { const { data } = await api.get('/pcp/programacao/painel'); setPainel(data) } catch {}
  }

  async function acaoLoteReextrair() {
    if (!confirm(`Re-extrair PDF de ${selectedEtapas.size} OP(s) selecionada(s)?`)) return
    setAcaoLoteLoading(true)
    // Coletar opIds únicos das etapas selecionadas
    const opIds = new Set<string>()
    for (const centro of (painel?.centros || [])) {
      for (const etapa of centro.etapas) {
        if (selectedEtapas.has(etapa.id) && etapa.opId) opIds.add(etapa.opId)
      }
    }
    let sucesso = 0
    for (const opId of opIds) {
      try {
        await api.post('/pcp/programacao/reextrair-pdf', { opId })
        sucesso++
      } catch { /* ignora falhas individuais */ }
    }
    notifications.show({ title: 'Lote concluído', message: `${sucesso} OP(s) re-extraída(s)`, color: 'green' })
    limparSelecao()
    setAcaoLoteLoading(false)
    try { const { data } = await api.get('/pcp/programacao/painel'); setPainel(data) } catch {}
  }

  async function carregarConcluidas(tipoProcessoId?: string) {
    setLoadingConcluidas(true)
    try {
      const params: any = { limite: 50 }
      // Buscar o tipoProcessoId a partir da aba ativa
      if (tipoProcessoId) {
        params.tipoProcessoId = tipoProcessoId
      } else if (activeTab && tiposProcesso.length > 0) {
        const tp = tiposProcesso.find((t: any) => t.codigo.toLowerCase() === activeTab)
        if (tp) params.tipoProcessoId = tp.id
      }
      const { data } = await api.get('/pcp/programacao/concluidas', { params })
      setEtapasConcluidas(data)
    } catch {
      notifications.show({ title: 'Erro', message: 'Falha ao carregar concluídas', color: 'red' })
    } finally {
      setLoadingConcluidas(false)
    }
  }

  // Recarrega concluídas ao trocar de aba, se o painel de concluídas estiver aberto
  useEffect(() => {
    if (mostrarConcluidas && activeTab) carregarConcluidas()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])

  async function retornarEtapa() {
    if (!modalRetornar) return
    setSalvandoRetornar(true)
    try {
      await api.patch(`/pcp/etapas/${modalRetornar.etapaId}/retornar`, formRetornar)
      notifications.show({ title: 'Sucesso', message: `OS ${modalRetornar.opNumero} retornada à fila`, color: 'green' })
      const etapaRetornada = modalRetornar.etapaId
      setModalRetornar(null)
      setFormRetornar({ emailAdmin: '', senhaAdmin: '' })
      // Remove da lista de concluídas
      setEtapasConcluidas(prev => prev.filter((e: any) => e.id !== etapaRetornada))
      // Recarrega o painel completo silenciosamente (sem mostrar loading)
      // para que a etapa retornada apareça com todos os dados corretos
      try {
        const { data } = await api.get('/pcp/programacao/painel')
        setPainel(data)
      } catch { /* silencioso — dados aparecem na próxima recarga manual */ }
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao retornar etapa', color: 'red' })
    } finally {
      setSalvandoRetornar(false)
    }
  }

  async function carregar() {
    setLoading(true)
    try {
      const [painelRes, centrosRes, tiposRes] = await Promise.all([
        api.get('/pcp/programacao/painel'),
        api.get('/centros-producao', { params: { limit: 50, status: 'true' } }),
        api.get('/tipos-processo', { params: { status: 'true' } }),
      ])
      setPainel(painelRes.data)
      setCentrosDisponiveis((centrosRes.data.data || []).map((c: any) => ({ value: c.id, label: `${c.codigo} - ${c.descricao}` })))
      setTiposProcesso(tiposRes.data.data || [])
      const ab: Record<string, boolean> = {}
      for (const c of (painelRes.data.centros || [])) { if (c.resumo.total > 0) ab[c.centro.id] = true }
      setAbertos(ab)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [])

  useEffect(() => {
    api.get('/pcp/configuracao')
      .then((res) => setUsaCoresStatus(res.data?.configuracao?.usaCoresStatusProgramacao ?? true))
      .catch(() => {}) // Falha silenciosa: mantém o default (cores habilitadas)
  }, [])

  // Define a aba inicial como o primeiro Tipo de Processo cadastrado, assim
  // que a lista carrega — só na primeira carga (activeTab ainda vazio), para
  // não sobrescrever a escolha do usuário em cargas subsequentes (carregar()
  // é chamado novamente após ações como criar/mover/reordenar).
  useEffect(() => {
    if (!activeTab && tiposProcesso.length > 0) {
      setActiveTab(tiposProcesso[0].codigo.toLowerCase())
    }
  }, [tiposProcesso, activeTab])

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

  // Reordena a fila de um centro via API — usada pelo drag-and-drop da lista
  // mestre do layout Detalhado (VisaoDetalhadaProgramacao). O estado otimista
  // e o rollback em caso de erro são tratados dentro do próprio componente;
  // aqui só persiste no backend e recarrega o painel ao final para manter
  // `painel.centros` (fonte de verdade de ambos os layouts) sincronizado.
  async function reordenarFilaCentro(centroId: string, etapaIds: string[], etapaMovidaId?: string) {
    await api.patch('/pcp/etapas/reordenar', { centroProducaoId: centroId, etapaIds, etapaMovidaId })
    await carregar()
  }

  // Cicla a prioridade da OP (BAIXA→NORMAL→ALTA→URGENTE→BAIXA) — mesma lógica
  // já usada inline no clique da célula "Prio." do modelo Impressão/Acabamento
  // do Grid, extraída aqui para ser reaproveitada pelo layout Detalhado.
  function alterarPrioridade(opId: string, prioridadeAtual: string) {
    const opcoes = ['BAIXA', 'NORMAL', 'ALTA', 'URGENTE']
    const atual = opcoes.indexOf(prioridadeAtual)
    const nova = opcoes[(atual + 1) % opcoes.length]
    api.patch(`/ordens-producao/${opId}`, { prioridade: nova }).then(() => {
      // Atualização otimista: atualiza a prioridade de todas as etapas
      // dessa OP no painel local, sem recarregar tudo (preserva ordem da fila)
      setPainel((prev: any) => {
        if (!prev) return prev
        return {
          ...prev,
          centros: prev.centros.map((c: any) => ({
            ...c,
            etapas: c.etapas.map((e: any) =>
              e.opId === opId ? { ...e, prioridade: nova } : e
            ),
          })),
        }
      })
    }).catch(() => {
      notifications.show({ title: 'Erro', message: 'Falha ao alterar prioridade', color: 'red' })
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

    // Persist — active.id é a etapa que o usuário efetivamente arrastou;
    // só ela é marcada como ordemManual=true no backend (posição fixa,
    // sobrepõe os critérios automáticos de nº OP → data de entrega).
    try {
      await api.patch('/pcp/etapas/reordenar', {
        centroProducaoId: centroId,
        etapaIds: novaOrdem.map((e: any) => e.id),
        etapaMovidaId: String(active.id),
      })
    } catch (err: any) {
      notifications.show({ title: 'Erro ao reordenar', message: err?.response?.data?.message || 'Falha ao salvar ordem', color: 'red' })
      carregar() // Revert on error
    }
  }

  function toggleCentro(id: string) { setAbertos(prev => ({ ...prev, [id]: !prev[id] })) }

  // Atualiza campos de UMA etapa específica dentro de `painel.centros`, sem
  // recarregar o painel inteiro do backend — usado por ações rápidas
  // (iniciar/pausar) que não devem causar loading global, recolapsar grupos
  // que o usuário abriu/fechou manualmente, nem reordenar a fila (a busca
  // completa do painel pode vir em ordem levemente diferente a cada chamada).
  // `carregar()` continua sendo usado só onde a ação de fato precisa de dados
  // recalculados no servidor (nova etapa, conclusão que afeta a fila, etc.).
  function atualizarEtapaLocal(etapaId: string, patch: Record<string, any>) {
    setPainel((prev: any) => {
      if (!prev) return prev
      return {
        ...prev,
        centros: prev.centros.map((c: any) => {
          const etapas = c.etapas.map((e: any) => (e.id === etapaId ? { ...e, ...patch } : e))
          if (etapas === c.etapas) return c // etapa não pertence a este centro — nada mudou
          // Recalcula o resumo (badges "X em andamento"/"X pausadas"/"X pendentes"
          // no cabeçalho do grupo) para refletir a mudança de status, com a
          // mesma regra usada no backend (GET /programacao/painel).
          const resumo = {
            emAndamento: etapas.filter((e: any) => e.status === 'EM_ANDAMENTO').length,
            pausadas: etapas.filter((e: any) => e.status === 'PAUSADA').length,
            pendentes: etapas.filter((e: any) => e.status === 'PENDENTE').length,
            total: etapas.length,
          }
          return { ...c, etapas, resumo }
        }),
      }
    })
  }

  async function iniciarEtapa(etapaId: string) {
    try {
      await api.patch(`/pcp/etapas/${etapaId}/iniciar`, {})
      notifications.show({ title: 'Etapa iniciada', message: '', color: 'green' })
      atualizarEtapaLocal(etapaId, { status: 'EM_ANDAMENTO' })
    } catch (err: any) { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) }
  }

  // Abre o modal de apontamento em modo "finalizar": o usuário registra a
  // quantidade produzida final e, ao confirmar, a etapa é apontada e
  // concluída na sequência (continua saindo da fila do grupo, como antes).
  function abrirFinalizarEtapa(etapa: any, tipoProcessoCodigo?: string | null) {
    // Finaliza direto sem pedir apontamento — a quantidade produzida é
    // registrada como o saldo restante automaticamente (produção completa).
    concluirEtapaDireta(etapa.id, etapa.opNumero)
  }

  async function concluirEtapaDireta(etapaId: string, opNumero?: number) {
    try {
      await api.patch(`/pcp/etapas/${etapaId}/concluir`, {})
      notifications.show({ title: 'Etapa finalizada', message: `OS ${opNumero || ''} concluída`, color: 'green' })
      // Atualização otimista: remove a etapa concluída da fila
      setPainel((prev: any) => {
        if (!prev) return prev
        const centros = prev.centros.map((c: any) => {
          const novasEtapas = c.etapas.filter((e: any) => e.id !== etapaId)
          if (novasEtapas.length === c.etapas.length) return c
          return {
            ...c,
            etapas: novasEtapas,
            resumo: {
              emAndamento: novasEtapas.filter((e: any) => e.status === 'EM_ANDAMENTO').length,
              pausadas: novasEtapas.filter((e: any) => e.status === 'PAUSADA').length,
              pendentes: novasEtapas.filter((e: any) => e.status === 'PENDENTE').length,
              total: novasEtapas.length,
            },
          }
        })
        return { ...prev, centros }
      })
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao concluir', color: 'red' })
    }
  }

  async function enviarApontamento() {
    if (!modalApontar) return
    try {
      if (formApontar.quantidadeProduzida > 0 || formApontar.quantidadePerda > 0) {
        if (fotoApontar) {
          // Com foto: envia multipart/form-data (arquivo + campos juntos).
          const formData = new FormData()
          formData.append('quantidadeProduzida', String(formApontar.quantidadeProduzida))
          formData.append('quantidadePerda', String(formApontar.quantidadePerda))
          if (formApontar.motivoPerda) formData.append('motivoPerda', formApontar.motivoPerda)
          if (formApontar.observacao) formData.append('observacao', formApontar.observacao)
          formData.append('foto', fotoApontar)
          await api.post(`/pcp/etapas/${modalApontar.etapaId}/apontar`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
          })
        } else {
          await api.post(`/pcp/etapas/${modalApontar.etapaId}/apontar`, {
            quantidadeProduzida: formApontar.quantidadeProduzida,
            quantidadePerda: formApontar.quantidadePerda,
            motivoPerda: formApontar.motivoPerda || undefined,
            observacao: formApontar.observacao || undefined,
          })
        }
      }

      if (modalApontar.finalizando) {
        await api.patch(`/pcp/etapas/${modalApontar.etapaId}/concluir`, {})
        notifications.show({ title: 'Etapa finalizada', message: `Quantidade produzida registrada: ${(modalApontar.jaProduzido || 0) + formApontar.quantidadeProduzida}`, color: 'green' })
      } else {
        notifications.show({ title: 'Apontamento registrado', message: `+${formApontar.quantidadeProduzida} produzidas`, color: 'green' })
      }

      setModalApontar(null)
      setFormApontar({ quantidadeProduzida: 0, quantidadePerda: 0, motivoPerda: '', observacao: '' })
      setFotoApontar(null)

      if (modalApontar.finalizando) {
        // Atualização otimista: remove a etapa concluída da fila sem
        // recarregar o painel inteiro (evita loading/spinner e reordenação).
        const etapaId = modalApontar.etapaId
        setPainel((prev: any) => {
          if (!prev) return prev
          const centros = prev.centros.map((c: any) => {
            const novasEtapas = c.etapas.filter((e: any) => e.id !== etapaId)
            if (novasEtapas.length === c.etapas.length) return c
            return {
              ...c,
              etapas: novasEtapas,
              resumo: {
                emAndamento: novasEtapas.filter((e: any) => e.status === 'EM_ANDAMENTO').length,
                pausadas: novasEtapas.filter((e: any) => e.status === 'PAUSADA').length,
                pendentes: novasEtapas.filter((e: any) => e.status === 'PENDENTE').length,
                total: novasEtapas.length,
              },
            }
          })
          return { ...prev, centros }
        })
      } else {
        // Apontamento parcial (não finalizou): atualiza quantidade local
        atualizarEtapaLocal(modalApontar.etapaId, {
          quantidadeProduzida: (modalApontar.jaProduzido || 0) + formApontar.quantidadeProduzida,
        })
      }
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
      atualizarEtapaLocal(modalPausar.etapaId, { status: 'PAUSADA' })
      setModalPausar(null)
      setFormPausar({ motivoParada: 'ACERTO_MAQUINA', observacao: '' })
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
      // Atualização otimista: atualiza a data de entrega de todas as etapas
      // dessa OP no painel local, sem recarregar tudo (preserva ordem da fila)
      setPainel((prev: any) => {
        if (!prev) return prev
        return {
          ...prev,
          centros: prev.centros.map((c: any) => ({
            ...c,
            etapas: c.etapas.map((e: any) =>
              e.opId === opId ? { ...e, dataEntrega: `${novaData}T12:00:00` } : e
            ),
          })),
        }
      })
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
      // Atualização otimista: move a etapa do centro antigo para o novo sem
      // recarregar o painel inteiro (evita loading/spinner e reordenação).
      setPainel((prev: any) => {
        if (!prev) return prev
        let etapaMovida: any = null
        const centros = prev.centros.map((c: any) => {
          const idx = c.etapas.findIndex((e: any) => e.id === etapaId)
          if (idx === -1) return c
          etapaMovida = c.etapas[idx]
          const novasEtapas = c.etapas.filter((_: any, i: number) => i !== idx)
          return {
            ...c,
            etapas: novasEtapas,
            resumo: {
              emAndamento: novasEtapas.filter((e: any) => e.status === 'EM_ANDAMENTO').length,
              pausadas: novasEtapas.filter((e: any) => e.status === 'PAUSADA').length,
              pendentes: novasEtapas.filter((e: any) => e.status === 'PENDENTE').length,
              total: novasEtapas.length,
            },
          }
        })
        if (etapaMovida) {
          const centrosComNovo = centros.map((c: any) => {
            if (c.centro.id !== novoCentroId) return c
            const novasEtapas = [...c.etapas, etapaMovida]
            return {
              ...c,
              etapas: novasEtapas,
              resumo: {
                emAndamento: novasEtapas.filter((e: any) => e.status === 'EM_ANDAMENTO').length,
                pausadas: novasEtapas.filter((e: any) => e.status === 'PAUSADA').length,
                pendentes: novasEtapas.filter((e: any) => e.status === 'PENDENTE').length,
                total: novasEtapas.length,
              },
            }
          })
          return { ...prev, centros: centrosComNovo }
        }
        return { ...prev, centros }
      })
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

  async function reextrairPdf(opId: string, opNumero: string | number) {
    try {
      const res = await api.post('/pcp/programacao/reextrair-pdf', { opId })
      const { matriz, formato, tipoOp, materiaisAtualizados, totalMateriais, avisos } = res.data
      const partes = [
        tipoOp && `Tipo: ${tipoOp}`,
        matriz && `Matriz: ${matriz}`,
        formato && `Formato: ${formato}`,
        materiaisAtualizados && `${totalMateriais} material(is) atualizado(s)`,
      ].filter(Boolean)
      notifications.show({
        title: `OP #${opNumero} atualizada`,
        message: partes.length > 0 ? partes.join(' | ') : 'Nenhuma informação nova encontrada no PDF',
        color: partes.length > 0 ? 'green' : 'orange',
      })
      if (avisos?.length > 0) {
        notifications.show({ title: 'Atenção', message: avisos.join(' '), color: 'yellow' })
      }
      // Não faz carregar() — mantém a ordem das OPs na tela (mesmo
      // comportamento do iniciar). Os dados extraídos são metadados
      // (tipo, matriz, formato, materiais) que não afetam a fila.
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao re-extrair PDF', color: 'red' })
    }
  }

  async function liberarProducao(opId: string) {
    try {
      // Marca material como recebido — remove "encomendado" das observações da OP
      await api.patch(`/ordens-producao/${opId}`, {
        observacoes: painel.aguardandoCartao?.find((i: any) => i.opId === opId)?.observacoes?.replace(/\[Bobina\].*encomendad[oa].*\n?/gi, '') || undefined,
      })
      notifications.show({ title: 'Material recebido', message: 'Cartão recebido — OS liberada do aguardo', color: 'green' })
      // Atualização otimista: remove do quadro "Aguardando Cartão" sem
      // recarregar o painel inteiro (evita loading/spinner e reordenação).
      setPainel((prev: any) => {
        if (!prev) return prev
        return {
          ...prev,
          aguardandoCartao: (prev.aguardandoCartao || []).filter((i: any) => i.opId !== opId),
        }
      })
      // Recarrega em background (sem loading) para que a OP apareça nos
      // centros normais com dados corretos do servidor.
      api.get('/pcp/programacao/painel').then((res) => {
        setPainel((prev: any) => {
          if (!prev) return prev
          // Preserva a ordem local dos centros, apenas atualiza etapas e aguardandoCartao
          const centrosMap = new Map(res.data.centros.map((c: any) => [c.centro.id, c]))
          const centros = prev.centros.map((c: any) => {
            const atualizado = centrosMap.get(c.centro.id)
            return atualizado || c
          })
          return { ...prev, centros, aguardandoCartao: res.data.aguardandoCartao || [] }
        })
      }).catch(() => {})
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
        const categoriaCentro = getCategoriaCentro(centro.centro.tipoProcesso?.codigo)
        if (layoutView === 'grid' && activeTab !== categoriaCentro) {
          setActiveTab(categoriaCentro)
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
      notifications.show({ title: 'Erro', message: 'Selecione o Tipo de Processo', color: 'red' })
      return
    }
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
        tipoProcessoId: formNovoGrupo.tipo,
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
    // Guarda contra duplo clique/duplo submit — sem isso, cliques rápidos
    // repetidos no botão (ou double-submit de rede) criavam duas etapas
    // idênticas para a mesma OP no mesmo centro (bug real encontrado na
    // OP 2898, grupo "Serviços Manuais - Produção").
    if (!modalAdicionarOS || !formAdicionarOS.opNumero || salvandoAdicionarOS) return
    setSalvandoAdicionarOS(true)
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
    } finally {
      setSalvandoAdicionarOS(false)
    }
  }

  // OP Avulsa — carrega produtos/clientes disponíveis para o modo "livre"
  function carregarProdutosEClientes() {
    if (produtosDisponiveis.length === 0) {
      api.get('/produtos', { params: { limit: 200, status: 'true' } })
        .then((res) => setProdutosDisponiveis((res.data.data || res.data || []).map((p: any) => ({ value: p.id, label: `${p.codigo} - ${p.nome}` }))))
        .catch(() => {})
    }
    if (clientesDisponiveis.length === 0) {
      // Combina cadastro formal + nomes extraídos de OPs (a maioria não tem
      // cliente cadastrado, só o nome em texto vindo do PDF importado)
      api.get('/ordens-producao/clientes-distintos')
        .then((res) => setClientesDisponiveis((res.data.data || []).map((c: any) => ({ value: c.nome, label: c.nome, clienteId: c.clienteId }))))
        .catch(() => {})
    }
  }

  // OP Avulsa — modo "herdar": busca a OP de origem pelo número, para copiar produto/cliente
  async function buscarOpOrigemAvulsa() {
    if (!formAvulsaOrigem.opNumero) return
    setBuscandoOpOrigem(true)
    setOpOrigemEncontrada(null)
    try {
      const res = await api.get('/ordens-producao', { params: { numero: formAvulsaOrigem.opNumero, limit: 1 } })
      const ops = res.data.data || res.data || []
      if (ops.length > 0) {
        setOpOrigemEncontrada(ops[0])
      } else {
        notifications.show({ title: 'OP não encontrada', message: `Nenhuma OP #${formAvulsaOrigem.opNumero}`, color: 'orange' })
      }
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: 'Falha ao buscar OP', color: 'red' })
    } finally { setBuscandoOpOrigem(false) }
  }

  function fecharModalAdicionarOS() {
    setModalAdicionarOS(null)
    setTabAdicionarOS('existente')
    setModoAvulsa('herdar')
    setFormAdicionarOS({ opNumero: 0, descricao: '' })
    setOpEncontrada(null)
    setFormAvulsaOrigem({ opNumero: 0, quantidade: 0, descricao: '' })
    setOpOrigemEncontrada(null)
    setFormAvulsaLivre({ produtoId: null, produtoNome: null, clienteId: null, clienteNome: null, quantidade: 0, descricao: '' })
  }

  // OP Avulsa — cria a OP (AV-1, AV-2...) já na fila do centro, herdando de
  // uma OP existente ou com produto/cliente escolhidos livremente
  async function confirmarAdicionarAvulsa() {
    if (!modalAdicionarOS) return

    const quantidade = modoAvulsa === 'herdar' ? formAvulsaOrigem.quantidade : formAvulsaLivre.quantidade
    if (!quantidade || quantidade <= 0) {
      notifications.show({ title: 'Informe a quantidade', message: 'Quantidade deve ser maior que zero', color: 'orange' })
      return
    }
    if (modoAvulsa === 'herdar' && !opOrigemEncontrada) {
      notifications.show({ title: 'Busque a OP de origem', message: 'Informe o número e clique em Buscar', color: 'orange' })
      return
    }

    const produtoId = modoAvulsa === 'herdar' ? opOrigemEncontrada?.produtoId : formAvulsaLivre.produtoId
    const clienteId = modoAvulsa === 'herdar' ? opOrigemEncontrada?.clienteId : formAvulsaLivre.clienteId
    // Nome livre do cliente: no modo "herdar", a OP de origem pode não ter
    // clienteId real, só o nome extraído do PDF (clienteNome computado pelo
    // backend); no modo "livre", vem do Autocomplete digitado.
    const clienteNomeLivre = modoAvulsa === 'herdar'
      ? (!clienteId ? opOrigemEncontrada?.clienteNome : undefined)
      : (!clienteId ? formAvulsaLivre.clienteNome : undefined)
    // Nome livre do produto: só existe no modo "livre" quando o usuário
    // digitou um texto que não corresponde a nenhum produto cadastrado.
    const produtoNomeLivre = modoAvulsa === 'livre' && !produtoId ? formAvulsaLivre.produtoNome : undefined
    const descricao = modoAvulsa === 'herdar' ? formAvulsaOrigem.descricao : formAvulsaLivre.descricao

    setSalvandoAvulsa(true)
    try {
      const res = await api.post('/pcp/etapas/adicionar-avulsa', {
        centroProducaoId: modalAdicionarOS.centroId,
        produtoId: produtoId || undefined,
        produtoNomeLivre: produtoNomeLivre || undefined,
        clienteId: clienteId || undefined,
        clienteNomeLivre: clienteNomeLivre || undefined,
        quantidade,
        descricao: descricao || undefined,
      })
      notifications.show({ title: 'OP avulsa criada', message: `${res.data.referenciaAvulsa} adicionada à fila`, color: 'green' })
      fecharModalAdicionarOS()
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao criar OP avulsa', color: 'red' })
    } finally { setSalvandoAvulsa(false) }
  }

  // OP Avulsa — exclui a qualquer momento (sem as restrições de OP normal)
  async function excluirOpAvulsa(opId: string, referencia: string) {
    if (!confirm(`Excluir a OP avulsa ${referencia}? Esta ação não pode ser desfeita.`)) return
    try {
      await api.delete(`/pcp/ordens-avulsas/${opId}`)
      notifications.show({ title: 'OP avulsa excluída', message: referencia, color: 'green' })
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao excluir', color: 'red' })
    }
  }

  function imprimirRelatorio() {
    if (!painel) return
    const centrosParaImprimir = centrosFiltrados.filter((c: any) => c.etapas.length > 0)
    if (centrosParaImprimir.length === 0) {
      notifications.show({ title: 'Nada para imprimir', message: 'Nenhuma OS encontrada nos filtros atuais', color: 'orange' })
      return
    }

    // Mapa de coluna → { header, align, render }
    const colDefs: Record<string, { header: string; align?: string; render: (e: any) => string }> = {
      os: { header: 'OS', render: (e) => `<td class="bold">${e.opNumero}</td>` },
      cliente: { header: 'Cliente', render: (e) => `<td>${e.clienteNome || '—'}</td>` },
      produto: { header: 'Produto', render: (e) => `<td>${e.produtoNome || '—'}</td>` },
      tipoOp: { header: 'Tipo OP', render: (e) => `<td>${e.tipoOp || '—'}</td>` },
      quantidade: { header: 'Qtd', align: 'right', render: (e) => `<td class="right">${e.quantidade?.toLocaleString('pt-BR') || '—'}</td>` },
      tiragem: { header: 'Tiragem', align: 'right', render: (e) => `<td class="right">${e.tiragem ? e.tiragem.toLocaleString('pt-BR') : '—'}</td>` },
      entrega: { header: 'Entrega', render: (e) => `<td>${e.dataEntrega ? new Date(e.dataEntrega).toLocaleDateString('pt-BR') : '—'}</td>` },
      material: { header: 'Material/Cartão', render: (e) => `<td>${e.materialPrincipal || '—'}</td>` },
      gramatura: { header: 'Gramatura', render: (e) => `<td>${e.gramatura || '—'}</td>` },
      formato: { header: 'Formato', render: (e) => `<td>${e.formato || '—'}</td>` },
      matriz: { header: 'Matriz', render: (e) => `<td>${e.matriz || '—'}</td>` },
      cores: { header: 'Cores', align: 'center', render: (e) => `<td class="center">${e.qtdCores || '—'}</td>` },
      pantone01: { header: 'Pantone 1', render: (e) => `<td>${e.pantone01 || '—'}</td>` },
      pantone02: { header: 'Pantone 2', render: (e) => `<td>${e.pantone02 || '—'}</td>` },
      pantone03: { header: 'Pantone 3', render: (e) => `<td>${e.pantone03 || '—'}</td>` },
      kg: { header: 'KG', align: 'right', render: (e) => `<td class="right">${e.pesoKg ? e.pesoKg.toLocaleString('pt-BR') : '—'}</td>` },
      prioridade: { header: 'Prioridade', render: (e) => `<td>${e.prioridade || '—'}</td>` },
      observacao: { header: 'Acompanhamento', render: (e) => `<td>${e.observacaoOperador || '—'}</td>` },
    }

    let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Programação de Produção</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 11px; margin: 10mm; }
      h1 { text-align: center; font-size: 16px; margin: 0 0 5px; text-transform: uppercase; }
      h2 { text-align: center; font-size: 14px; margin: 20px 0 8px; font-weight: bold; border-bottom: 2px solid #000; padding-bottom: 4px; }
      table { width: 100%; border-collapse: collapse; margin-bottom: 10px; }
      th { background: #f0f0f0; border: 1px solid #ccc; padding: 3px 5px; font-size: 10px; text-align: left; white-space: nowrap; }
      td { border: 1px solid #ddd; padding: 3px 5px; font-size: 10px; vertical-align: top; }
      .total-row { font-weight: bold; background: #ffffcc; }
      .total-row td { border-top: 2px solid #000; }
      .right { text-align: right; }
      .center { text-align: center; }
      .bold { font-weight: bold; }
      @media print { @page { size: landscape; margin: 8mm; } }
    </style></head><body>`

    centrosParaImprimir.forEach((centro: any) => {
      const tipoProcessoCodigo = centro.centro.tipoProcesso?.codigo || 'outros'
      const colunas = getColunasParaProcesso(tipoProcessoCodigo)

      html += `<h2>${centro.centro.descricao.toUpperCase()}</h2>`
      html += `<table><thead><tr>`
      for (const colId of colunas) {
        const def = colDefs[colId]
        if (!def) continue
        const alignClass = def.align === 'right' ? ' class="right"' : def.align === 'center' ? ' class="center"' : ''
        html += `<th${alignClass}>${def.header}</th>`
      }
      html += `</tr></thead><tbody>`

      let totalTiragem = 0
      for (const e of centro.etapas) {
        totalTiragem += (e.tiragem || 0)
        html += `<tr>`
        for (const colId of colunas) {
          const def = colDefs[colId]
          if (!def) continue
          html += def.render(e)
        }
        html += `</tr>`
      }

      // Linha de total (tiragem, se a coluna estiver ativa)
      const idxTiragem = colunas.indexOf('tiragem')
      if (idxTiragem >= 0) {
        html += `<tr class="total-row">`
        for (let i = 0; i < colunas.length; i++) {
          if (i === idxTiragem) {
            html += `<td class="right">${totalTiragem.toLocaleString('pt-BR')}</td>`
          } else if (i === idxTiragem - 1) {
            html += `<td class="right">Total:</td>`
          } else {
            html += `<td></td>`
          }
        }
        html += `</tr>`
      }

      html += `</tbody></table>`
      html += `<div style="font-size:9px;color:#666;margin-top:2px;">${centro.etapas.length} OS(s) pendentes</div>`
    })

    html += `<div style="margin-top:20px;font-size:9px;color:#999;text-align:center;">Impresso em ${new Date().toLocaleString('pt-BR')}</div>`
    html += '</body></html>'

    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
      setTimeout(() => {
        printWindow.print()
        printWindow.close()
      }, 500)
    }
  }

  if (loading) return <Center py="xl"><Loader /></Center>
  if (!painel) return <Text c="red" ta="center">Erro ao carregar painel</Text>

  // Filtra itens aguardandoCartao pelo tipoMaquina da primeira etapa conforme
  // aba ativa. No layout Detalhado, activeTab fica travado em 'todos' (a
  // categorização por aba passa a ser feita dentro do próprio painel de
  // detalhe, por OP selecionada) — mantido aqui só para esse caso.
  const aguardandoCartaoFiltrado = (painel.aguardandoCartao || []).filter((item: any) => {
    if (layoutView === 'detalhado') return true
    return getCategoriaCentro(item.tipoProcessoCodigo) === activeTab
  })
  const mostrarAguardandoCartao = aguardandoCartaoFiltrado.length > 0

  const centrosFiltrados = (layoutView === 'detalhado'
    ? painel.centros
    : painel.centros.filter((c: any) => getCategoriaCentro(c.centro.tipoProcesso?.codigo) === activeTab)
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
        e.materialPrincipal?.toLowerCase().includes(buscaLower) ||
        e.clienteNome?.toLowerCase().includes(buscaLower) ||
        e.produtoNome?.toLowerCase().includes(buscaLower)
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

      {/* Legenda de cores — mesmo código de cores usado em getRowBackground,
          válido para os dois layouts (Grid e Detalhado). As cores de status
          podem ser desabilitadas em Configuração PCP (usaCoresStatus) — a de
          OP Avulsa é sempre exibida, independente dessa flag. */}
      <Group gap="md" wrap="wrap">
        {usaCoresStatus && (
          <>
            <Group gap={6} wrap="nowrap"><Box style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--mantine-color-gray-light)', border: '1px solid var(--mantine-color-gray-5)' }} /><Text size="xs" c="dimmed">Pendente</Text></Group>
            <Group gap={6} wrap="nowrap"><Box style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--mantine-color-yellow-light)', border: '1px solid var(--mantine-color-yellow-6)' }} /><Text size="xs" c="dimmed">Em andamento</Text></Group>
            <Group gap={6} wrap="nowrap"><Box style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--mantine-color-orange-light)', border: '1px solid var(--mantine-color-orange-6)' }} /><Text size="xs" c="dimmed">Pausada</Text></Group>
            <Group gap={6} wrap="nowrap"><Box style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--mantine-color-green-light)', border: '1px solid var(--mantine-color-green-6)' }} /><Text size="xs" c="dimmed">Concluída</Text></Group>
            <Group gap={6} wrap="nowrap"><Box style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--mantine-color-red-light)', border: '1px solid var(--mantine-color-red-6)' }} /><Text size="xs" c="dimmed">Atrasada</Text></Group>
          </>
        )}
        <Group gap={6} wrap="nowrap"><Box style={{ width: 10, height: 10, borderRadius: 2, background: 'var(--mantine-color-pink-light)', border: '1px solid var(--mantine-color-pink-6)' }} /><Text size="xs" c="dimmed">OP Avulsa</Text></Group>
      </Group>

      <Group justify="space-between" align="flex-end">
        {/* No layout Detalhado, o filtro por estágio passa a ser feito DENTRO
            do painel de detalhe (abas Cortadeira/Impressão/Acabamento por OP
            selecionada) — as abas do topo ficam redundantes e são ocultadas
            (centrosFiltrados usa layoutView, não activeTab, nesse caso). Ao
            voltar para o Grid, as abas voltam a aparecer, mantendo a última
            aba selecionada. */}
        {layoutView === 'grid' ? (
          <Tabs value={activeTab} onChange={(value) => setActiveTab(value || tiposProcesso[0]?.codigo.toLowerCase() || 'outros')} style={{ flex: 1 }}>
            <Tabs.List>
              {/* Abas geradas dinamicamente a partir do cadastro Tipo de
                  Processo (PCP → Cadastros → Tipo de Processo), na ordem de
                  posição definida lá — substitui a lista fixa que existia
                  antes no código. */}
              {tiposProcesso.map((tp) => (
                <Tabs.Tab key={tp.id} value={tp.codigo.toLowerCase()}>{tp.descricao}</Tabs.Tab>
              ))}
            </Tabs.List>
          </Tabs>
        ) : (
          <div style={{ flex: 1 }} />
        )}
        <SegmentedControl
          size="xs"
          value={layoutView}
          onChange={(v) => {
            const novoValor = v as 'grid' | 'detalhado'
            alterarLayoutView(novoValor)
          }}
          className="no-print"
          data={[
            { value: 'grid', label: (<Group gap={4} wrap="nowrap"><IconLayoutGrid size={14} /><span>Grid</span></Group>) as any },
            { value: 'detalhado', label: (<Group gap={4} wrap="nowrap"><IconListDetails size={14} /><span>Detalhado</span></Group>) as any },
          ]}
        />
        <Button size="xs" variant="light" leftSection={<IconPrinter size={14} />} onClick={() => imprimirRelatorio()} className="no-print">
          Imprimir
        </Button>
        <Button
          size="xs"
          variant={mostrarConcluidas ? 'filled' : 'light'}
          color={mostrarConcluidas ? 'green' : 'gray'}
          onClick={() => {
            const novo = !mostrarConcluidas
            setMostrarConcluidas(novo)
            if (novo) carregarConcluidas()
          }}
          className="no-print"
        >
          Concluídas
        </Button>
        <ActionIcon size="sm" variant="subtle" onClick={() => abrirConfigColunas()} title="Configurar colunas de impressão" className="no-print">
          <IconSettings size={14} />
        </ActionIcon>
        <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={() => {
          // Pre-seleciona o Tipo de Processo correspondente à aba ativa,
          // buscando pelo código (ex: aba 'cortadeira' → tipo com código
          // 'CORTADEIRA'). Se não encontrar (aba 'outros' ou tipo inativo),
          // deixa em branco para seleção manual.
          const tipoDaAba = tiposProcesso.find((t) => t.codigo.toLowerCase() === activeTab)
          setFormNovoGrupo({ descricao: '', tipo: tipoDaAba?.id || '' })
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

      {layoutView === 'detalhado' ? (
        <VisaoDetalhadaProgramacao
          painel={painel}
          usaCoresStatus={usaCoresStatus}
          centrosFiltrados={centrosFiltrados}
          aguardandoCartaoFiltrado={aguardandoCartaoFiltrado}
          highlightedEtapa={highlightedEtapa}
          editingObs={editingObs}
          setEditingObs={setEditingObs}
          salvarObservacao={salvarObservacao}
          iniciarEtapa={iniciarEtapa}
          abrirFinalizarEtapa={abrirFinalizarEtapa}
          setModalPausar={setModalPausar}
          verPdfOp={verPdfOp}
          reextrairPdf={reextrairPdf}
          setModalMover={setModalMover}
          setModalDesmembrar={setModalDesmembrar}
          setFormDesmembrar={setFormDesmembrar}
          setModalApontar={setModalApontar}
          excluirEtapa={excluirEtapa}
          excluirOpAvulsa={excluirOpAvulsa}
          liberarProducao={liberarProducao}
          reordenarFilaCentro={reordenarFilaCentro}
          abrirAdicionarOS={(centroId, centroDescricao) => { setModalAdicionarOS({ centroId, centroDescricao }); carregarProdutosEClientes() }}
          setModalPostData={setModalPostData}
          alterarPrioridade={alterarPrioridade}
          handleCentroDragEnd={handleCentroDragEnd}
          centroSensors={sensors}
        />
      ) : (
      <>
      {/* Seção AGUARDANDO CARTÃO — filtrada por tipoMaquina conforme aba ativa */}
      {mostrarAguardandoCartao && (
        <Card withBorder padding="xs" style={{ borderColor: 'var(--mantine-color-yellow-5)', background: 'var(--mantine-color-yellow-light)' }}>
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

      {/* Barra de ações em lote (aparece quando há etapas selecionadas) */}
      {selectedEtapas.size > 0 && (
        <Card withBorder padding="xs" mb="sm" style={{ background: 'var(--mantine-color-blue-light)', position: 'sticky', top: 0, zIndex: 10 }}>
          <Group justify="space-between">
            <Group gap="sm">
              <Text size="sm" fw={600}>{selectedEtapas.size} etapa(s) selecionada(s)</Text>
              <Button size="compact-xs" variant="subtle" onClick={limparSelecao}>Limpar</Button>
            </Group>
            <Group gap="xs">
              <Button size="compact-xs" color="green" loading={acaoLoteLoading} onClick={acaoLoteIniciar}>
                Iniciar
              </Button>
              <Button size="compact-xs" color="teal" loading={acaoLoteLoading} onClick={acaoLoteFinalizar}>
                Finalizar
              </Button>
              <Button size="compact-xs" color="blue" loading={acaoLoteLoading} onClick={() => setModalMoverLote(true)}>
                Mover p/ Grupo
              </Button>
              <Button size="compact-xs" color="cyan" loading={acaoLoteLoading} onClick={acaoLoteReextrair}>
                Re-extrair PDF
              </Button>
            </Group>
          </Group>
        </Card>
      )}

      {/* Painel de etapas concluídas (por processo/aba ativa) */}
      {mostrarConcluidas && (
        <Card withBorder padding="md" mb="md">
          <Group justify="space-between" mb="sm">
            <Text fw={600} size="sm">Etapas Concluídas — {tiposProcesso.find((t: any) => t.codigo.toLowerCase() === activeTab)?.descricao || activeTab}</Text>
            <Button size="compact-xs" variant="subtle" color="gray" onClick={() => setMostrarConcluidas(false)}>Fechar</Button>
          </Group>
          {loadingConcluidas ? (
            <Center py="md"><Loader size="sm" /></Center>
          ) : etapasConcluidas.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="md">Nenhuma etapa concluída encontrada para este processo</Text>
          ) : (
            <Table striped highlightOnHover fontSize="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>OS</Table.Th>
                  <Table.Th>Cliente</Table.Th>
                  <Table.Th>Produto</Table.Th>
                  <Table.Th>Etapa</Table.Th>
                  <Table.Th>Qtd</Table.Th>
                  <Table.Th>Produzido</Table.Th>
                  <Table.Th>Centro</Table.Th>
                  <Table.Th>Concluída em</Table.Th>
                  <Table.Th>Ação</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {etapasConcluidas.map((ec: any) => (
                  <Table.Tr key={ec.id}>
                    <Table.Td fw={500}>{ec.opNumero}</Table.Td>
                    <Table.Td>{ec.cliente || '—'}</Table.Td>
                    <Table.Td>{ec.produto || '—'}</Table.Td>
                    <Table.Td>{ec.descricao}</Table.Td>
                    <Table.Td>{ec.quantidade?.toLocaleString('pt-BR')}</Table.Td>
                    <Table.Td>{ec.quantidadeProduzida?.toLocaleString('pt-BR')}</Table.Td>
                    <Table.Td>{ec.centroDescricao}</Table.Td>
                    <Table.Td>{ec.dataFimReal ? new Date(ec.dataFimReal).toLocaleDateString('pt-BR') : '—'}</Table.Td>
                    <Table.Td>
                      <Button
                        size="compact-xs"
                        variant="light"
                        color="orange"
                        onClick={() => setModalRetornar({ etapaId: ec.id, opNumero: ec.opNumero })}
                      >
                        Retornar
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Card>
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
              {/* Totalizador de Tiragem do grupo — soma da coluna Tiragem de
                  todas as etapas visíveis (já filtradas por busca/status/etc,
                  igual ao total exibido no relatório impresso). */}
              {(() => {
                const totalTiragem = centro.etapas.reduce((acc: number, e: any) => acc + (e.tiragem || 0), 0)
                return totalTiragem > 0 ? (
                  <Badge color="yellow" variant="light" size="sm">Tiragem: {totalTiragem.toLocaleString('pt-BR')}</Badge>
                ) : null
              })()}
              {centro.resumo.emAndamento > 0 && <Badge color="blue" size="sm">{centro.resumo.emAndamento} em andamento</Badge>}
              {centro.resumo.pausadas > 0 && <Badge color="orange" size="sm">{centro.resumo.pausadas} pausadas</Badge>}
              <Badge color="gray" size="sm">{centro.resumo.pendentes} pendentes</Badge>
              <ActionIcon color="teal" variant="light" size="sm" onClick={() => { setModalAdicionarOS({ centroId: centro.centro.id, centroDescricao: centro.centro.descricao }); carregarProdutosEClientes() }} title="Adicionar OS">
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
                    {getCategoriaCentro(centro.centro.tipoProcesso?.codigo) === 'cortadeira' ? (
                    /* ===== MODELO CORTADEIRA ===== */
                    <Table striped highlightOnHover mt="xs" style={{ tableLayout: 'auto', fontSize: '11px' }}>
                      <Table.Thead>
                        <Table.Tr style={{ fontSize: '10px' }}>
                          <Table.Th style={{ width: 30 }}></Table.Th>
                          <Table.Th style={{ width: 30, padding: '0 4px' }}>
                            <input type="checkbox" onChange={() => toggleSelectAllCentro(centro.centro.id)} checked={centro.etapas.length > 0 && centro.etapas.every((e: any) => selectedEtapas.has(e.id))} style={{ cursor: 'pointer', width: 14, height: 14 }} />
                          </Table.Th>
                          <Table.Th style={{ minWidth: 200 }}>OS / Cliente / Produto</Table.Th>
                          <Table.Th>Qtd</Table.Th>
                          <Table.Th>Tiragem</Table.Th>
                          <Table.Th>Entrega</Table.Th>
                          <Table.Th>Cartão</Table.Th>
                          <Table.Th>Gramatura</Table.Th>
                          <Table.Th>Formato</Table.Th>
                          <Table.Th>KG</Table.Th>
                          <Table.Th>Acomp.</Table.Th>
                          <Table.Th>Ações</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {centro.etapas.map((etapa: any) => (
                          <SortableRow key={etapa.id} etapa={etapa} background={getRowBackground(etapa, usaCoresStatus)} highlighted={highlightedEtapa === etapa.id} selected={selectedEtapas.has(etapa.id)} onToggleSelect={() => toggleSelectEtapa(etapa.id)}>
                            <Table.Td style={{ minWidth: 200 }}>
                              <Group gap={4} wrap="nowrap">
                                <Text size="sm" fw={700} style={{ lineHeight: 1.2 }}>
                                  {etapa.opNumero} — {etapa.clienteNome || '—'}
                                </Text>
                                {etapa.isAvulsa && <Badge color="pink" size="xs">AVULSA</Badge>}
                              </Group>
                              <Text size="xs" fw={600} c="dimmed" style={{ lineHeight: 1.2 }}>
                                {etapa.produtoNome || '—'}
                              </Text>
                            </Table.Td>
                            <Table.Td>{etapa.quantidade.toLocaleString('pt-BR')}</Table.Td>
                            <Table.Td>{etapa.tiragem ? etapa.tiragem.toLocaleString('pt-BR') : '—'}</Table.Td>
                            <Table.Td>
                              {etapa.dataEntrega ? (
                                <Text size="sm" style={{ cursor: 'pointer' }} onClick={() => setModalPostData({ opId: etapa.opId, opNumero: etapa.opNumero, dataAtual: etapa.dataEntrega })}>
                                  {new Date(etapa.dataEntrega).toLocaleDateString('pt-BR')}
                                </Text>
                              ) : '—'}
                            </Table.Td>
                            <Table.Td><Text size="sm" style={{ wordBreak: 'break-word' }}>{etapa.materialPrincipal || '—'}</Text></Table.Td>
                            <Table.Td>{etapa.gramatura || '—'}</Table.Td>
                            <Table.Td>{etapa.formato || '—'}</Table.Td>
                            <Table.Td>{etapa.pesoKg ? etapa.pesoKg.toLocaleString('pt-BR') : '—'}</Table.Td>
                            <Table.Td style={{ minWidth: 130 }}>
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
                                <ActionIcon color="cyan" variant="light" size="sm" onClick={() => reextrairPdf(etapa.opId, etapa.opNumero)} title="Re-extrair Matriz/Formato do PDF">
                                  <IconRefresh size={14} />
                                </ActionIcon>
                                <ActionIcon color="indigo" variant="light" size="sm" onClick={() => setModalMover({ etapaId: etapa.id, opNumero: etapa.opNumero, centroAtualId: centro.centro.id, centroDescricao: centro.centro.descricao })} title="Mover para outro grupo">
                                  <IconArrowRight size={14} />
                                </ActionIcon>
                                {etapa.status === 'PENDENTE' && (
                                  <ActionIcon color="green" variant="light" size="sm" onClick={() => iniciarEtapa(etapa.id)} title="Iniciar">
                                    <IconPlayerPlay size={14} />
                                  </ActionIcon>
                                )}
                                {etapa.status === 'PAUSADA' && (
                                  <ActionIcon color="green" variant="light" size="sm" onClick={() => iniciarEtapa(etapa.id)} title="Retomar">
                                    <IconPlayerPlay size={14} />
                                  </ActionIcon>
                                )}
                                {etapa.status === 'EM_ANDAMENTO' && (
                                  <>
                                    <ActionIcon color="orange" variant="light" size="sm" onClick={() => setModalPausar({ etapaId: etapa.id, opNumero: etapa.opNumero })} title="Parar">
                                      <IconPlayerPause size={14} />
                                    </ActionIcon>
                                    <ActionIcon color="green" variant="light" size="sm" onClick={() => abrirFinalizarEtapa(etapa, centro.centro.tipoProcesso?.codigo)} title="Finalizar">
                                      <IconCheck size={14} />
                                    </ActionIcon>
                                  </>
                                )}
                                {(etapa.isDesmembramento || etapa.isManual) && etapa.status === 'PENDENTE' && (
                                  <ActionIcon color="red" variant="light" size="sm" onClick={() => excluirEtapa(etapa.id, etapa.isDesmembramento)} title={etapa.isDesmembramento ? 'Reverter desmembramento' : 'Excluir lançamento manual'}>
                                    <IconX size={14} />
                                  </ActionIcon>
                                )}
                                {etapa.isAvulsa && (
                                  <ActionIcon color="red" variant="light" size="sm" onClick={() => excluirOpAvulsa(etapa.opId, etapa.opNumero)} title="Excluir OP avulsa">
                                    <IconX size={14} />
                                  </ActionIcon>
                                )}
                              </Group>
                            </Table.Td>
                          </SortableRow>
                        ))}
                      </Table.Tbody>
                    </Table>
                    ) : (
                    /* ===== MODELO IMPRESSÃO / ACABAMENTO ===== */
                    <Table striped highlightOnHover mt="xs" style={{ tableLayout: 'auto', fontSize: '11px' }}>
                      {(() => {
                        const temApontamento = centro.etapas.some((e: any) => e.quantidadeProduzida > 0 || e.quantidadePerda > 0)
                        return (<>
                      <Table.Thead>
                        <Table.Tr style={{ fontSize: '10px' }}>
                          <Table.Th style={{ width: 30 }}></Table.Th>
                          <Table.Th style={{ width: 30, padding: '0 4px' }}>
                            <input type="checkbox" onChange={() => toggleSelectAllCentro(centro.centro.id)} checked={centro.etapas.length > 0 && centro.etapas.every((e: any) => selectedEtapas.has(e.id))} style={{ cursor: 'pointer', width: 14, height: 14 }} />
                          </Table.Th>
                          <Table.Th style={{ minWidth: 200 }}>OP / Cliente / Produto</Table.Th>
                          <Table.Th>Tipo OP</Table.Th>
                          <Table.Th>Tir.</Table.Th>
                          <Table.Th>Material</Table.Th>
                          <Table.Th>Gram.</Table.Th>
                          <Table.Th>Fmt.</Table.Th>
                          <Table.Th>KG</Table.Th>
                          <Table.Th>Qtd</Table.Th>
                          {temApontamento && <Table.Th>Prod.</Table.Th>}
                          {temApontamento && <Table.Th>Perda</Table.Th>}
                          {temApontamento && <Table.Th>%</Table.Th>}
                          <Table.Th>Entrega</Table.Th>
                          <Table.Th>Prio.</Table.Th>
                          <Table.Th>Status</Table.Th>
                          <Table.Th>Matriz</Table.Th>
                          <Table.Th>Cores</Table.Th>
                          <Table.Th>Pantone 1</Table.Th>
                          <Table.Th>Pantone 2</Table.Th>
                          <Table.Th>Pantone 3</Table.Th>
                          <Table.Th>Acomp.</Table.Th>
                          <Table.Th>Ações</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {centro.etapas.map((etapa: any) => (
                          <SortableRow key={etapa.id} etapa={etapa} background={getRowBackground(etapa, usaCoresStatus)} highlighted={highlightedEtapa === etapa.id} selected={selectedEtapas.has(etapa.id)} onToggleSelect={() => toggleSelectEtapa(etapa.id)}>
                            <Table.Td style={{ minWidth: 200 }}>
                              <Group gap={4} wrap="nowrap">
                                <Text size="sm" fw={700} style={{ lineHeight: 1.2 }}>
                                  {etapa.opNumero} — {etapa.clienteNome || etapa.observacoes?.match(/\[Cliente\]\s*(.+)/)?.[1] || '—'}
                                </Text>
                                {etapa.isAvulsa && <Badge color="pink" size="xs">AVULSA</Badge>}
                              </Group>
                              <Text size="xs" fw={600} c="dimmed" style={{ lineHeight: 1.2 }}>
                                {etapa.produtoNome || etapa.observacoes?.match(/\[Produto\]\s*(.+)/)?.[1] || ''}
                              </Text>
                              {etapa.materialEncomendado && <Text size="xs" c="red" fw={700}>* Aguardando restante cartão</Text>}
                            </Table.Td>
                            <Table.Td><Text size="xs" fw={600} c={etapa.tipoOp?.includes('NOVO') ? 'green' : etapa.tipoOp?.includes('REPETI') ? 'blue' : etapa.tipoOp?.includes('ALTERA') ? 'orange' : etapa.tipoOp?.includes('PILOTO') ? 'violet' : 'gray'} style={{ whiteSpace: 'nowrap', fontSize: '10px' }}>{etapa.tipoOp || '—'}</Text></Table.Td>
                            <Table.Td>{etapa.tiragem ? etapa.tiragem.toLocaleString('pt-BR') : '—'}</Table.Td>
                            <Table.Td><Text size="sm" style={{ wordBreak: 'break-word' }}>{etapa.materialPrincipal || '—'}</Text></Table.Td>
                            <Table.Td>{etapa.gramatura || '—'}</Table.Td>
                            <Table.Td>{etapa.formato || '—'}</Table.Td>
                            <Table.Td>{etapa.pesoKg ? `${etapa.pesoKg.toLocaleString('pt-BR')} kg` : '—'}</Table.Td>
                            <Table.Td>{etapa.quantidade.toLocaleString('pt-BR')} {etapa.unidade}</Table.Td>
                            {temApontamento && <Table.Td fw={600} c="green">{etapa.quantidadeProduzida.toLocaleString('pt-BR')}</Table.Td>}
                            {temApontamento && <Table.Td>{etapa.quantidadePerda > 0 ? <Text c="red" size="sm">{etapa.quantidadePerda}</Text> : '—'}</Table.Td>}
                            {temApontamento && <Table.Td w={100}><Progress value={etapa.percentual} size="lg" color={etapa.percentual >= 100 ? 'green' : 'blue'} /><Text size="xs" ta="center">{etapa.percentual}%</Text></Table.Td>}
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
                              <Text size="xs" fw={600} c={PRIORIDADE_COLORS[etapa.prioridade]} style={{ whiteSpace: 'nowrap', fontSize: '10px', cursor: 'pointer' }}
                                onClick={() => {
                                  const opcoes = ['BAIXA', 'NORMAL', 'ALTA', 'URGENTE']
                                  const atual = opcoes.indexOf(etapa.prioridade)
                                  const nova = opcoes[(atual + 1) % opcoes.length]
                                  api.patch(`/ordens-producao/${etapa.opId}`, { prioridade: nova }).then(() => carregar())
                                }}
                                title="Clique para alterar prioridade"
                              >
                                {etapa.prioridade}
                              </Text>
                            </Table.Td>
                            <Table.Td><Text size="xs" fw={600} c={STATUS_COLORS[etapa.status]} style={{ whiteSpace: 'nowrap', fontSize: '10px' }}>{etapa.status === 'EM_ANDAMENTO' ? 'EM ANDAMENTO' : etapa.status}</Text></Table.Td>
                            <Table.Td><Text size="xs" fw={500}>{etapa.matriz || '—'}</Text></Table.Td>
                            <Table.Td><Text size="xs" fw={600} c="indigo">{etapa.qtdCores || '—'}</Text></Table.Td>
                            <Table.Td><Text size="xs" style={{ whiteSpace: 'nowrap' }}>{etapa.pantone01 || '—'}</Text></Table.Td>
                            <Table.Td><Text size="xs" style={{ whiteSpace: 'nowrap' }}>{etapa.pantone02 || '—'}</Text></Table.Td>
                            <Table.Td><Text size="xs" style={{ whiteSpace: 'nowrap' }}>{etapa.pantone03 || '—'}</Text></Table.Td>
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
                                <ActionIcon color="cyan" variant="light" size="sm" onClick={() => reextrairPdf(etapa.opId, etapa.opNumero)} title="Re-extrair Matriz/Formato do PDF">
                                  <IconRefresh size={14} />
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
                                    <ActionIcon color="blue" variant="light" size="sm" onClick={() => setModalApontar({ etapaId: etapa.id, opNumero: etapa.opNumero, descricao: etapa.descricao, tipoProcessoCodigo: centro.centro.tipoProcesso?.codigo })} title="Apontar Produção">
                                      <IconClipboardCheck size={14} />
                                    </ActionIcon>
                                    <ActionIcon color="orange" variant="light" size="sm" onClick={() => setModalPausar({ etapaId: etapa.id, opNumero: etapa.opNumero })} title="Pausar">
                                      <IconPlayerPause size={14} />
                                    </ActionIcon>
                                    <ActionIcon color="green" variant="light" size="sm" onClick={() => abrirFinalizarEtapa(etapa, centro.centro.tipoProcesso?.codigo)} title="Concluir">
                                      <IconCheck size={14} />
                                    </ActionIcon>
                                  </>
                                )}
                                {(etapa.isDesmembramento || etapa.isManual) && etapa.status === 'PENDENTE' && (
                                  <ActionIcon color="red" variant="light" size="sm" onClick={() => excluirEtapa(etapa.id, etapa.isDesmembramento)} title={etapa.isDesmembramento ? 'Reverter desmembramento' : 'Excluir lançamento manual'}>
                                    <IconX size={14} />
                                  </ActionIcon>
                                )}
                                {etapa.isAvulsa && (
                                  <ActionIcon color="red" variant="light" size="sm" onClick={() => excluirOpAvulsa(etapa.opId, etapa.opNumero)} title="Excluir OP avulsa">
                                    <IconX size={14} />
                                  </ActionIcon>
                                )}
                              </Group>
                            </Table.Td>
                          </SortableRow>
                        ))}
                      </Table.Tbody>
                      </>)
                      })()}
                    </Table>
                    )}
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
      </>
      )}

      {/* Modal: Apontar Produção (também usado ao Finalizar a etapa) */}
      <Modal opened={!!modalApontar} onClose={() => { setModalApontar(null); setFotoApontar(null) }} title={modalApontar?.finalizando ? `Finalizar Etapa — OP #${modalApontar?.opNumero}` : `Apontar Produção — OP #${modalApontar?.opNumero}`} centered>
        <Stack gap="md">
          <Text size="sm" c="dimmed">{modalApontar?.descricao}</Text>
          {modalApontar?.finalizando && (
            <Text size="xs" c="orange">Informe a quantidade produzida antes de finalizar. Ao confirmar, a etapa sai da fila deste grupo.</Text>
          )}
          <Group grow>
            <NumberInput
              label={unidadeContagem(modalApontar?.tipoProcessoCodigo).label}
              placeholder={unidadeContagem(modalApontar?.tipoProcessoCodigo).placeholder}
              value={formApontar.quantidadeProduzida}
              onChange={(v) => setFormApontar({ ...formApontar, quantidadeProduzida: typeof v === 'number' ? v : 0 })}
              min={0}
            />
            <NumberInput label="Quantidade Perda" value={formApontar.quantidadePerda} onChange={(v) => setFormApontar({ ...formApontar, quantidadePerda: typeof v === 'number' ? v : 0 })} min={0} />
          </Group>
          {modalApontar?.finalizando && !!modalApontar?.quantidadeEtapa && (
            <Group justify="space-between">
              <Text size="xs" c="dimmed">Total já produzido: {(modalApontar.jaProduzido || 0).toLocaleString('pt-BR')} de {modalApontar.quantidadeEtapa.toLocaleString('pt-BR')}</Text>
              <Text size="xs" fw={700} c={((modalApontar.jaProduzido || 0) + formApontar.quantidadeProduzida) >= modalApontar.quantidadeEtapa ? 'green' : 'orange'}>
                {Math.min(100, Math.round((((modalApontar.jaProduzido || 0) + formApontar.quantidadeProduzida) / modalApontar.quantidadeEtapa) * 100))}% concluído
              </Text>
            </Group>
          )}
          {formApontar.quantidadePerda > 0 && (
            <Select label="Motivo da Perda" data={['ACERTO', 'REFUGO', 'DEFEITO', 'APARA']} value={formApontar.motivoPerda} onChange={(v) => setFormApontar({ ...formApontar, motivoPerda: v || '' })} />
          )}
          <Textarea label="Observação" value={formApontar.observacao} onChange={(e) => setFormApontar({ ...formApontar, observacao: e.currentTarget.value })} />

          {/* Foto da contagem produzida (opcional) — evidência visual anexada
              ao apontamento, ex: foto do contador da máquina ou da pilha de
              folhas/embalagens contadas. */}
          <Stack gap={4}>
            <Text size="sm" fw={500}>Foto da contagem (opcional)</Text>
            {fotoApontar ? (
              <Group gap="xs" align="flex-start">
                <Image src={URL.createObjectURL(fotoApontar)} alt="Foto da contagem" w={90} h={90} fit="cover" radius="md" style={{ border: '1px solid var(--mantine-color-gray-4)' }} />
                <ActionIcon size="sm" variant="light" color="red" onClick={() => setFotoApontar(null)} title="Remover foto">
                  <IconX size={14} />
                </ActionIcon>
              </Group>
            ) : (
              <FileButton onChange={setFotoApontar} accept="image/png,image/jpeg,image/webp">
                {(props) => (
                  <Button size="xs" variant="light" leftSection={<IconCamera size={14} />} {...props}>
                    Anexar foto
                  </Button>
                )}
              </FileButton>
            )}
          </Stack>

          <Button onClick={enviarApontamento} fullWidth color={modalApontar?.finalizando ? 'green' : 'blue'}>
            {modalApontar?.finalizando ? 'Confirmar e Finalizar' : 'Registrar Apontamento'}
          </Button>
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
            label="Tipo de Processo"
            placeholder="Selecione o Tipo de Processo (define a aba onde o grupo aparecerá)"
            data={tiposProcesso.map((tp) => ({ value: tp.id, label: tp.descricao }))}
            value={formNovoGrupo.tipo}
            onChange={(v) => setFormNovoGrupo({ ...formNovoGrupo, tipo: v || '' })}
            required
            nothingFoundMessage="Nenhum tipo cadastrado — cadastre em Cadastros → Tipo de Processo"
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

      {/* Modal: Adicionar OS manualmente (Feature 5b) + OP Avulsa */}
      <Modal opened={!!modalAdicionarOS} onClose={fecharModalAdicionarOS} title={`Adicionar OS — ${modalAdicionarOS?.centroDescricao}`} centered size="md">
        <Tabs value={tabAdicionarOS} onChange={(v) => setTabAdicionarOS(v as any)}>
          <Tabs.List mb="md">
            <Tabs.Tab value="existente">OS Existente</Tabs.Tab>
            <Tabs.Tab value="avulsa">OP Avulsa</Tabs.Tab>
          </Tabs.List>

          {/* Aba: vincular OS/OP já cadastrada */}
          <Tabs.Panel value="existente">
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

              <Button onClick={confirmarAdicionarOS} fullWidth disabled={!opEncontrada || salvandoAdicionarOS} loading={salvandoAdicionarOS} leftSection={<IconPlus size={16} />}>
                Adicionar à Fila
              </Button>
            </Stack>
          </Tabs.Panel>

          {/* Aba: OP Avulsa (AV-1, AV-2...) — sem número de fábrica, pode ser excluída a qualquer momento */}
          <Tabs.Panel value="avulsa">
            <Stack gap="md">
              <Text size="xs" c="dimmed">
                Cria uma OP sem número de fábrica (referência AV-1, AV-2...), útil para retrabalhos, testes ou
                lançamentos que não vieram de um PDF. Pode ser excluída a qualquer momento.
              </Text>

              <SegmentedControl
                value={modoAvulsa}
                onChange={(v) => setModoAvulsa(v as any)}
                data={[
                  { value: 'herdar', label: 'A partir de uma OP' },
                  { value: 'livre', label: 'Sem OP existente' },
                ]}
                fullWidth
              />

              {modoAvulsa === 'herdar' ? (
                <>
                  <Group grow align="flex-end">
                    <NumberInput
                      label="Número da OP de origem"
                      placeholder="Ex: 2881"
                      value={formAvulsaOrigem.opNumero || ''}
                      onChange={(v) => setFormAvulsaOrigem({ ...formAvulsaOrigem, opNumero: typeof v === 'number' ? v : 0 })}
                      min={1}
                    />
                    <Button variant="light" onClick={buscarOpOrigemAvulsa} loading={buscandoOpOrigem}>
                      Buscar
                    </Button>
                  </Group>

                  {opOrigemEncontrada && (
                    <Card withBorder padding="sm" bg="pink.0">
                      <Text size="sm" fw={600}>OP #{opOrigemEncontrada.referenciaExterna || opOrigemEncontrada.numero}</Text>
                      <Text size="xs" c="dimmed">Produto: {opOrigemEncontrada.produtoNome || opOrigemEncontrada.produto?.nome || opOrigemEncontrada.produtoId || 'Não vinculado'}</Text>
                      <Text size="xs" c="dimmed">Cliente: {opOrigemEncontrada.clienteNome || opOrigemEncontrada.cliente?.razaoSocial || 'Não vinculado'}</Text>
                      <Text size="xs" c="dimmed">A avulsa herdará este produto e cliente.</Text>
                    </Card>
                  )}

                  <NumberInput
                    label="Quantidade"
                    placeholder="Quantidade desta OP avulsa"
                    value={formAvulsaOrigem.quantidade || ''}
                    onChange={(v) => setFormAvulsaOrigem({ ...formAvulsaOrigem, quantidade: typeof v === 'number' ? v : 0 })}
                    min={0.01}
                    max={99_999_999}
                    thousandSeparator="."
                    decimalSeparator=","
                  />

                  <Textarea
                    label="Descrição (opcional)"
                    placeholder="Ex: Retrabalho, teste de material..."
                    value={formAvulsaOrigem.descricao}
                    onChange={(e) => setFormAvulsaOrigem({ ...formAvulsaOrigem, descricao: e.currentTarget.value })}
                  />
                </>
              ) : (
                <>
                  <Autocomplete
                    label="Produto (opcional)"
                    placeholder="Buscar produto cadastrado ou digitar descrição livre..."
                    data={produtosDisponiveis.map((p) => p.label)}
                    value={formAvulsaLivre.produtoNome || ''}
                    onChange={(nome) => {
                      const encontrado = produtosDisponiveis.find((p) => p.label.toLowerCase() === nome.toLowerCase())
                      setFormAvulsaLivre({ ...formAvulsaLivre, produtoNome: nome || null, produtoId: encontrado?.value ?? null })
                    }}
                  />
                  <Autocomplete
                    label="Cliente (opcional)"
                    placeholder="Buscar ou digitar nome do cliente..."
                    data={clientesDisponiveis.map((c) => c.label)}
                    value={formAvulsaLivre.clienteNome || ''}
                    onChange={(nome) => {
                      const encontrado = clientesDisponiveis.find((c) => c.label.toLowerCase() === nome.toLowerCase())
                      setFormAvulsaLivre({ ...formAvulsaLivre, clienteNome: nome || null, clienteId: encontrado?.clienteId ?? null })
                    }}
                  />
                  <NumberInput
                    label="Quantidade"
                    placeholder="Quantidade desta OP avulsa"
                    value={formAvulsaLivre.quantidade || ''}
                    onChange={(v) => setFormAvulsaLivre({ ...formAvulsaLivre, quantidade: typeof v === 'number' ? v : 0 })}
                    min={0.01}
                    max={99_999_999}
                    thousandSeparator="."
                    decimalSeparator=","
                  />
                  <Textarea
                    label="Descrição (opcional)"
                    placeholder="Ex: Retrabalho, teste de material..."
                    value={formAvulsaLivre.descricao}
                    onChange={(e) => setFormAvulsaLivre({ ...formAvulsaLivre, descricao: e.currentTarget.value })}
                  />
                </>
              )}

              <Button onClick={confirmarAdicionarAvulsa} fullWidth color="pink" loading={salvandoAvulsa} leftSection={<IconPlus size={16} />}>
                Criar OP Avulsa
              </Button>
            </Stack>
          </Tabs.Panel>
        </Tabs>
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

      {/* Modal: Retornar etapa concluída à fila (requer senha admin) */}
      {modalRetornar && (
      <Modal opened onClose={() => { setModalRetornar(null); setFormRetornar({ emailAdmin: '', senhaAdmin: '' }) }} title={`Retornar OS #${modalRetornar.opNumero} à fila`} centered>
        <div onSubmit={(e) => { e.preventDefault(); retornarEtapa() }}>
        <Stack gap="md">
          <Text size="sm" c="dimmed">Esta ação retorna a etapa concluída para status PENDENTE. Requer autorização de um administrador.</Text>
          <div>
            <Text size="sm" fw={500} mb={4}>Usuário (email do administrador)</Text>
            <input
              type="text"
              placeholder="Digite o email"
              value={formRetornar.emailAdmin}
              onChange={(e) => setFormRetornar(prev => ({ ...prev, emailAdmin: e.target.value }))}
              autoComplete="nope"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #dee2e6', borderRadius: 4, fontSize: 14 }}
            />
          </div>
          <div>
            <Text size="sm" fw={500} mb={4}>Código de autorização</Text>
            <input
              type="text"
              placeholder="Digite a senha"
              value={formRetornar.senhaAdmin}
              onChange={(e) => setFormRetornar(prev => ({ ...prev, senhaAdmin: e.target.value }))}
              autoComplete="nope"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #dee2e6', borderRadius: 4, fontSize: 14, WebkitTextSecurity: 'disc' } as any}
            />
          </div>
          <Button
            fullWidth
            color="orange"
            loading={salvandoRetornar}
            disabled={!formRetornar.emailAdmin || !formRetornar.senhaAdmin}
            onClick={retornarEtapa}
          >
            Confirmar Retorno
          </Button>
        </Stack>
        </div>
      </Modal>
      )}

      {/* Modal: Mover em lote para outro grupo */}
      <Modal opened={modalMoverLote} onClose={() => { setModalMoverLote(false); setCentroDestinoLote(null) }} title={`Mover ${selectedEtapas.size} etapa(s) para outro grupo`} centered>
        <Stack gap="md">
          <Text size="sm" c="dimmed">Selecione o grupo de destino:</Text>
          <Select
            data={centrosDisponiveis}
            value={centroDestinoLote}
            onChange={setCentroDestinoLote}
            searchable
            placeholder="Selecione o grupo destino..."
          />
          <Button
            fullWidth
            color="blue"
            loading={acaoLoteLoading}
            disabled={!centroDestinoLote}
            onClick={acaoLoteMover}
          >
            Confirmar Mover
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
              // Filtrar pela mesma categoria — baseado no Tipo de Processo do centro atual
              const centroAtual = painel?.centros?.find((ct: any) => ct.centro.id === modalMover?.centroAtualId)
              if (centroAtual) {
                const categoriaAtual = getCategoriaCentro(centroAtual.centro.tipoProcesso?.codigo)
                // Buscar Tipo de Processo do centro opção pelo ID
                const centroOpcao = painel?.centros?.find((ct: any) => ct.centro.id === c.value)
                const categoriaOpcao = centroOpcao ? getCategoriaCentro(centroOpcao.centro.tipoProcesso?.codigo) : 'outros'
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

      {/* Modal — Configurar colunas de impressão por tipo de processo */}
      <Modal opened={modalColunasImpressao} onClose={() => setModalColunasImpressao(false)} title="Configurar Colunas de Impressão" size="lg">
        <Stack gap="md">
          <Text size="sm" c="dimmed">Selecione as colunas que deseja exibir na impressão para cada tipo de processo.</Text>
          <Tabs defaultValue={tiposProcesso[0]?.codigo?.toLowerCase()}>
            <Tabs.List>
              {tiposProcesso.map((tp: any) => (
                <Tabs.Tab key={tp.codigo} value={tp.codigo.toLowerCase()}>{tp.descricao}</Tabs.Tab>
              ))}
            </Tabs.List>
            {tiposProcesso.map((tp: any) => {
              const key = tp.codigo.toLowerCase()
              return (
                <Tabs.Panel key={tp.codigo} value={key} pt="sm">
                  <Group gap="xs" wrap="wrap">
                    {COLUNAS_DISPONIVEIS.map(col => (
                      <Checkbox
                        key={col.id}
                        label={col.label}
                        size="xs"
                        checked={(colunasEditando[key] || []).includes(col.id)}
                        onChange={() => toggleColunaEditando(key, col.id)}
                      />
                    ))}
                  </Group>
                </Tabs.Panel>
              )
            })}
          </Tabs>
          <Group justify="flex-end">
            <Button variant="subtle" onClick={() => setModalColunasImpressao(false)}>Cancelar</Button>
            <Button onClick={salvarConfigColunas}>Salvar</Button>
          </Group>
        </Stack>
      </Modal>

      {/* CSS for flash highlight animation + print styles */}
      <style>{`
        @keyframes flash-highlight {
          0% { background-color: var(--mantine-color-yellow-light-hover); }
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
