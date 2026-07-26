'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Box, Card, Stack, Group, Text, Badge, ActionIcon, Tooltip, ScrollArea, Divider,
  SimpleGrid, UnstyledButton, TextInput, Collapse, Tabs, Progress,
} from '@mantine/core'
import {
  IconFileText, IconRefresh, IconArrowRight, IconX, IconPlayerPlay, IconPlayerPause,
  IconCheck, IconChevronDown, IconChevronRight, IconTruck, IconCut, IconClipboardCheck,
  IconGripVertical, IconPlus,
} from '@tabler/icons-react'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { notifications } from '@mantine/notifications'

const STATUS_DOT: Record<string, string> = {
  PENDENTE: '#adb5bd',
  EM_ANDAMENTO: '#228be6',
  PAUSADA: '#f59f00',
  CONCLUIDA: '#2f9e44',
}

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: 'AGUARDANDO',
  EM_ANDAMENTO: 'EM PRODUÇÃO',
  PAUSADA: 'EM PAUSA',
  CONCLUIDA: 'CONCLUÍDA',
}

const PRIORIDADE_COLORS: Record<string, string> = { BAIXA: 'gray', NORMAL: 'blue', ALTA: 'orange', URGENTE: 'red' }

const CATEGORIAS_ORDEM: Array<{ key: string; label: string }> = [
  { key: 'cortadeira', label: 'Cortadeira' },
  { key: 'impressao', label: 'Impressão' },
  { key: 'acabamento', label: 'Acabamento' },
  { key: 'outros', label: 'Outros' },
]

/**
 * Categoriza um centro pelo `tipoMaquina` — cópia local da mesma função já
 * usada em page.tsx (getCategoriaCentro). Duplicada propositalmente: este
 * componente não deve importar/alterar nada do módulo do Modelo 1 (Grid),
 * para garantir que mudanças no Modelo 2 (Detalhado) nunca afetem o Modelo 1.
 */
function getCategoriaCentro(tipoMaquina: string | null | undefined): string {
  if (!tipoMaquina) return 'outros'
  if (tipoMaquina === 'CORTADEIRA') return 'cortadeira'
  if (tipoMaquina === 'IMPRESSAO') return 'impressao'
  if (['ACABAMENTO', 'COLAGEM', 'VERNIZ'].includes(tipoMaquina)) return 'acabamento'
  return 'outros'
}

/** Cor do texto do Tipo OP na lista mestre — mesmo critério de cores já usado no Modelo 1 (Grid). */
function corTipoOp(tipoOp?: string | null): string {
  if (!tipoOp) return 'dimmed'
  if (tipoOp.includes('NOVO')) return 'green'
  if (tipoOp.includes('REPETI')) return 'blue'
  if (tipoOp.includes('ALTERA')) return 'orange'
  if (tipoOp.includes('PILOTO')) return 'violet'
  return 'gray'
}

/** Fallback para itens "Aguardando Cartão", que não trazem `tipoOp` pronto do backend. */
function extrairTipoOpDeObs(obs?: string | null): string | null {
  if (!obs) return null
  const m = obs.match(/\[TipoOp\]\s*(.+?)(?:\n|$)/i)
  return m ? m[1].trim() : null
}

/** Cor de fundo da linha na lista mestre — cópia local da mesma função
 * (getRowBackground) já usada nas linhas do Modelo 1 (Grid), para manter o
 * mesmo código de cores por status/atraso/avulsa. */
function getRowBackground(etapa: any): string | undefined {
  if (etapa.isAvulsa) return 'var(--mantine-color-pink-0)'
  if (etapa.status === 'CONCLUIDA') return 'var(--mantine-color-green-0)'
  if (etapa.status === 'EM_ANDAMENTO') return 'var(--mantine-color-yellow-0)'
  if (etapa.status === 'PAUSADA') return 'var(--mantine-color-orange-0)'
  if (etapa.dataEntrega && new Date(etapa.dataEntrega) < new Date() && etapa.status !== 'CONCLUIDA') {
    return 'var(--mantine-color-red-0)'
  }
  if (etapa.status === 'PENDENTE') return 'var(--mantine-color-gray-0)'
  return undefined
}

type Selecao = { tipo: 'etapa'; opId: string } | { tipo: 'aguardando'; item: any } | null

/** Linha arrastável da lista mestre — mesmo padrão visual de drag do Grid
 * (ícone de grip à esquerda), usando dnd-kit para reordenar a fila. */
function LinhaArrastavel({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
    opacity: isDragging ? 0.5 : 1,
  }
  return (
    <Box ref={setNodeRef} style={style} {...attributes}>
      <Group gap={0} wrap="nowrap" align="stretch">
        <Box {...listeners} style={{ cursor: 'grab', display: 'flex', alignItems: 'center', padding: '0 4px', color: 'var(--mantine-color-gray-5)' }}>
          <IconGripVertical size={14} />
        </Box>
        <Box style={{ flex: 1, minWidth: 0 }}>{children}</Box>
      </Group>
    </Box>
  )
}

interface Props {
  painel: any
  centrosFiltrados: any[]
  aguardandoCartaoFiltrado: any[]
  highlightedEtapa: string | null
  editingObs: { id: string; value: string } | null
  setEditingObs: (v: { id: string; value: string } | null) => void
  salvarObservacao: (etapaId: string, valor: string) => void
  iniciarEtapa: (etapaId: string) => void
  abrirFinalizarEtapa: (etapa: any) => void
  setModalPausar: (v: { etapaId: string; opNumero: number } | null) => void
  verPdfOp: (opId: string) => void
  reextrairPdf: (opId: string, opNumero: string | number) => void
  setModalMover: (v: { etapaId: string; opNumero: number; centroAtualId: string; centroDescricao: string }) => void
  setModalDesmembrar: (v: { etapaId: string; opNumero: number; quantidade: number; descricao: string }) => void
  setFormDesmembrar: (v: Array<{ centroProducaoId: string; quantidade: number }>) => void
  setModalApontar: (v: { etapaId: string; opNumero: number; descricao: string }) => void
  setModalPostData: (v: { opId: string; opNumero: number; dataAtual: string }) => void
  alterarPrioridade: (opId: string, prioridadeAtual: string) => void
  excluirEtapa: (etapaId: string, isDesmembramento: boolean) => void
  excluirOpAvulsa: (opId: string, referencia: string) => void
  liberarProducao: (opId: string) => void
  /** Reordena a fila de um centro (mesma rota PATCH /pcp/etapas/reordenar já usada pelo Grid). */
  reordenarFilaCentro: (centroId: string, etapaIds: string[]) => Promise<void>
  /** Abre o modal "Adicionar OS" para um centro específico — mesma ação do botão "+" do Grid. */
  abrirAdicionarOS: (centroId: string, centroDescricao: string) => void
}

/**
 * Layout "Detalhado" (mestre-detalhe) do painel de Programação — segunda
 * visualização da mesma tela, alternativa ao layout "Grid" (tabelas por
 * centro). Mantém os mesmos dados/filtros/ações já existentes na página;
 * só muda a apresentação:
 *
 * - Lista mestre (esquerda): plana, sem agrupar por centro/máquina — mostra
 *   apenas Nº OP, Cliente, Produto, e o Tipo OP no lugar do status.
 * - Painel de detalhe (direita): especificação da OP uma única vez, e as
 *   etapas organizadas em abas Cortadeira/Impressão/Acabamento (mesma
 *   categorização usada nas abas do Modelo 1), cada aba mostrando Qtd,
 *   Produzido, Perda, Progresso, acompanhamento e as ações completas.
 *
 * O painel de detalhe monta o "Controle de Etapas" a partir de
 * `painel.centros` SEM filtro — assim, mesmo com um filtro de aba/busca
 * ativo na lista mestre, o detalhe sempre mostra o fluxo completo da OP em
 * todos os centros por onde ela passa.
 */
export default function VisaoDetalhadaProgramacao({
  painel, centrosFiltrados, aguardandoCartaoFiltrado, highlightedEtapa,
  editingObs, setEditingObs, salvarObservacao,
  iniciarEtapa, abrirFinalizarEtapa, setModalPausar, verPdfOp, reextrairPdf,
  setModalMover, setModalDesmembrar, setFormDesmembrar, setModalApontar, setModalPostData, alterarPrioridade,
  excluirEtapa, excluirOpAvulsa, liberarProducao,
  reordenarFilaCentro, abrirAdicionarOS,
}: Props) {
  const [selecao, setSelecao] = useState<Selecao>(null)
  const [especificacaoAberta, setEspecificacaoAberta] = useState(true)
  const [abaCategoria, setAbaCategoria] = useState<string | null>(null)
  // Grupos/centros abertos na lista mestre — mesmo padrão do Modelo 1
  // (Grid): abre automaticamente os centros que têm etapas na fila.
  const [abertos, setAbertos] = useState<Record<string, boolean>>({})
  // Ordem otimista por centro (drag-and-drop) — sobrepõe as etapas de um
  // centro específico enquanto o usuário reordena, revertendo se a chamada
  // à API falhar. Chaveado por centroId (cada centro tem sua própria fila).
  const [ordemOtimistaPorCentro, setOrdemOtimistaPorCentro] = useState<Record<string, any[]>>({})

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  )

  // Índice OP → todas as suas etapas (todos os centros, sem filtro de aba),
  // guardando também o tipoMaquina do centro de cada etapa para categorizar
  // nas abas Cortadeira/Impressão/Acabamento do painel de detalhe.
  const mapaEtapasPorOp = useMemo(() => {
    const mapa = new Map<string, { base: any; etapas: any[] }>()
    for (const centro of painel?.centros || []) {
      for (const etapa of centro.etapas) {
        if (!mapa.has(etapa.opId)) mapa.set(etapa.opId, { base: etapa, etapas: [] })
        mapa.get(etapa.opId)!.etapas.push({
          ...etapa,
          centroDescricao: centro.centro.descricao,
          centroId: centro.centro.id,
          centroTipoMaquina: centro.centro.tipoMaquina,
        })
      }
    }
    for (const v of mapa.values()) v.etapas.sort((a, b) => a.sequencia - b.sequencia)
    return mapa
  }, [painel])

  // Lista mestre agrupada por centro — mesmo agrupamento usado no Modelo 1
  // (Grid): cada centro/máquina é uma seção colapsável com suas OS dentro,
  // na ordem de fila já vinda do backend (ou a ordem otimista local, se o
  // usuário estiver arrastando). Uma OP com etapas em mais de um centro
  // aparece uma vez em cada centro por onde passa — igual ao Grid.
  const centrosComEtapas = useMemo(
    () => centrosFiltrados.map((c: any) => ({
      ...c,
      etapas: ordemOtimistaPorCentro[c.centro.id] || c.etapas,
    })),
    [centrosFiltrados, ordemOtimistaPorCentro],
  )

  // Todas as etapas (de todos os centros filtrados), usada para a seleção
  // automática e para localizar a etapa/OP atualmente selecionada.
  const todasEtapasFiltradas = useMemo(
    () => centrosComEtapas.flatMap((c: any) => c.etapas),
    [centrosComEtapas],
  )

  // Abre automaticamente os centros que têm etapas na fila (mesmo padrão do
  // Grid, que abre por padrão os grupos com `resumo.total > 0`).
  useEffect(() => {
    setAbertos((prev) => {
      const novo = { ...prev }
      let mudou = false
      for (const c of centrosFiltrados) {
        if (c.etapas.length > 0 && novo[c.centro.id] === undefined) {
          novo[c.centro.id] = true
          mudou = true
        }
      }
      return mudou ? novo : prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centrosFiltrados])

  function toggleCentro(id: string) {
    setAbertos((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // Seleção automática do primeiro item ao entrar na visão ou quando a
  // seleção atual sai da lista filtrada (ex: OS foi concluída/removida).
  useEffect(() => {
    const aindaExiste = selecao?.tipo === 'etapa'
      ? todasEtapasFiltradas.some((e: any) => e.opId === selecao.opId)
      : selecao?.tipo === 'aguardando'
        ? aguardandoCartaoFiltrado.some((i: any) => i.id === selecao.item.id)
        : false

    if (aindaExiste) return

    if (aguardandoCartaoFiltrado[0]) setSelecao({ tipo: 'aguardando', item: aguardandoCartaoFiltrado[0] })
    else if (todasEtapasFiltradas[0]) setSelecao({ tipo: 'etapa', opId: todasEtapasFiltradas[0].opId })
    else setSelecao(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todasEtapasFiltradas, aguardandoCartaoFiltrado])


  const detalheOp = selecao?.tipo === 'etapa' ? mapaEtapasPorOp.get(selecao.opId) : null
  const baseOp = detalheOp?.base

  // Descarta a ordem otimista sempre que o painel recarrega do backend
  // (novo apontamento, nova filtragem etc.) — evita a lista "congelar" numa
  // ordem antiga depois de qualquer outra ação que dispare `carregar()`.
  useEffect(() => { setOrdemOtimistaPorCentro({}) }, [centrosFiltrados])

  // Reordena a fila dentro de um único centro — mesma lógica de
  // `handleDragEnd` do Grid, só que aplicada ao estado local deste
  // componente (o Grid guarda a ordem otimista em `painel`, este guarda em
  // `ordemOtimistaPorCentro` para não interferir em nada do Modelo 1).
  async function handleDragEndCentro(centroId: string, event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const centro = centrosComEtapas.find((c: any) => c.centro.id === centroId)
    if (!centro) return

    const oldIndex = centro.etapas.findIndex((e: any) => e.id === active.id)
    const newIndex = centro.etapas.findIndex((e: any) => e.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const novaOrdem = arrayMove(centro.etapas, oldIndex, newIndex)
    setOrdemOtimistaPorCentro((prev) => ({ ...prev, [centroId]: novaOrdem }))

    try {
      await reordenarFilaCentro(centroId, novaOrdem.map((e: any) => e.id))
    } catch {
      setOrdemOtimistaPorCentro((prev) => {
        const { [centroId]: _removido, ...resto } = prev
        return resto
      })
    }
  }

  // Agrupa as etapas da OP selecionada pela mesma categoria usada nas abas
  // do Modelo 1 (Cortadeira/Impressão/Acabamento/Outros).
  const etapasPorCategoria = useMemo(() => {
    const mapa: Record<string, any[]> = { cortadeira: [], impressao: [], acabamento: [], outros: [] }
    for (const etapa of detalheOp?.etapas || []) {
      mapa[getCategoriaCentro(etapa.centroTipoMaquina)].push(etapa)
    }
    return mapa
  }, [detalheOp])

  const categoriasPresentes = CATEGORIAS_ORDEM.filter((c) => etapasPorCategoria[c.key]?.length > 0)

  // Resumo (em andamento/pausadas/pendentes) de cada centro, direto de
  // `painel.centros` — mesmo dado exibido no cabeçalho de cada grupo no
  // Grid (Modelo 1), agora replicado por etapa dentro das abas do detalhe.
  const resumoPorCentroId = useMemo(() => {
    const mapa = new Map<string, { emAndamento: number; pausadas: number; pendentes: number }>()
    for (const centro of painel?.centros || []) {
      mapa.set(centro.centro.id, centro.resumo)
    }
    return mapa
  }, [painel])

  // Ao trocar a OP selecionada, volta a aba de categoria para a primeira disponível.
  useEffect(() => {
    setAbaCategoria(categoriasPresentes[0]?.key || null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecao])

  return (
    <Group align="flex-start" gap="md" wrap="nowrap" style={{ minHeight: 500 }}>
      {/* Coluna principal — lista mestre agrupada por centro/máquina, no
          mesmo formato do Modelo 1 (Grid): cada grupo é uma seção
          colapsável, com badge de pendentes e a fila de OS dentro. */}
      <Card withBorder padding={0} style={{ width: 380, flexShrink: 0, overflow: 'hidden' }}>
        <ScrollArea h={640} type="auto">
          {aguardandoCartaoFiltrado.length > 0 && (
            <Box>
              <Group justify="space-between" px="sm" py={6} style={{ background: 'var(--mantine-color-yellow-0)' }}>
                <Text size="xs" fw={700} c="orange">AGUARDANDO CARTÃO</Text>
                <Badge size="xs" color="orange" variant="light">{aguardandoCartaoFiltrado.length}</Badge>
              </Group>
              {aguardandoCartaoFiltrado.map((item: any) => {
                const ativo = selecao?.tipo === 'aguardando' && selecao.item.id === item.id
                const tipoOp = extrairTipoOpDeObs(item.observacoes)
                return (
                  <UnstyledButton
                    key={item.id}
                    onClick={() => setSelecao({ tipo: 'aguardando', item })}
                    style={{
                      display: 'block', width: '100%', padding: '8px 12px',
                      background: ativo ? 'var(--mantine-color-orange-1)' : undefined,
                      borderLeft: ativo ? '3px solid var(--mantine-color-orange-6)' : '3px solid transparent',
                      borderBottom: '1px solid var(--mantine-color-gray-1)',
                    }}
                  >
                    <Group justify="space-between" wrap="nowrap" gap={6}>
                      <Box style={{ minWidth: 0, flex: 1 }}>
                        <Text size="sm" fw={600} truncate>{item.opNumero} — {item.cliente || '—'}</Text>
                        <Text size="xs" c="dimmed" truncate>{item.produto || 'Aguardando material'}</Text>
                      </Box>
                      {tipoOp && <Text size="9px" fw={700} c={corTipoOp(tipoOp)} style={{ whiteSpace: 'nowrap' }}>{tipoOp}</Text>}
                    </Group>
                  </UnstyledButton>
                )
              })}
              <Divider />
            </Box>
          )}

          {centrosComEtapas.length === 0 ? (
            <Text size="sm" c="dimmed" ta="center" py="lg">Nenhuma OS encontrada com os filtros atuais</Text>
          ) : (
            centrosComEtapas.map((centro: any) => {
              const aberto = !!abertos[centro.centro.id]
              return (
                <Box key={centro.centro.id}>
                  <UnstyledButton
                    onClick={() => toggleCentro(centro.centro.id)}
                    style={{ display: 'block', width: '100%', padding: '8px 12px', background: 'var(--mantine-color-gray-0)', borderBottom: '1px solid var(--mantine-color-gray-2)' }}
                  >
                    <Group justify="space-between" wrap="nowrap" gap={6}>
                      <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
                        {aberto ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                        <Text size="sm" fw={700} c="teal" truncate>{centro.centro.descricao}</Text>
                      </Group>
                      <Badge size="xs" color="gray">{centro.etapas.length} pendentes</Badge>
                    </Group>
                  </UnstyledButton>
                  <Collapse in={aberto}>
                    {centro.etapas.length === 0 ? (
                      <Text size="xs" c="dimmed" ta="center" py="sm">Nenhuma OP na fila</Text>
                    ) : (
                      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(event) => handleDragEndCentro(centro.centro.id, event)}>
                        <SortableContext items={centro.etapas.map((e: any) => e.id)} strategy={verticalListSortingStrategy}>
                          {centro.etapas.map((etapa: any) => {
                            const ativo = selecao?.tipo === 'etapa' && selecao.opId === etapa.opId
                            const destacar = highlightedEtapa === etapa.id
                            return (
                              <LinhaArrastavel key={etapa.id} id={etapa.id}>
                                <UnstyledButton
                                  onClick={() => setSelecao({ tipo: 'etapa', opId: etapa.opId })}
                                  style={{
                                    display: 'block', width: '100%', padding: '8px 12px 8px 0',
                                    background: destacar ? 'var(--mantine-color-yellow-2)' : (ativo ? 'var(--mantine-color-teal-0)' : getRowBackground(etapa)),
                                    borderLeft: ativo ? '3px solid var(--mantine-color-teal-6)' : '3px solid transparent',
                                    borderBottom: '1px solid var(--mantine-color-gray-1)',
                                  }}
                                >
                                  <Group justify="space-between" wrap="nowrap" gap={6}>
                                    <Box style={{ minWidth: 0, flex: 1 }}>
                                      <Group gap={4} wrap="nowrap">
                                        <Text size="sm" fw={600} truncate>{etapa.opNumero} — {etapa.clienteNome || '—'}</Text>
                                        {etapa.isAvulsa && <Badge color="pink" size="xs">AVULSA</Badge>}
                                      </Group>
                                      <Text size="xs" c="dimmed" truncate>{etapa.produtoNome || etapa.descricao}</Text>
                                    </Box>
                                    <Text size="9px" fw={700} c={corTipoOp(etapa.tipoOp)} style={{ whiteSpace: 'nowrap' }}>
                                      {etapa.tipoOp || '—'}
                                    </Text>
                                  </Group>
                                </UnstyledButton>
                              </LinhaArrastavel>
                            )
                          })}
                        </SortableContext>
                      </DndContext>
                    )}
                  </Collapse>
                </Box>
              )
            })
          )}
        </ScrollArea>
      </Card>

      {/* Painel de detalhe — especificação única + etapas em abas por estágio */}
      <Card withBorder padding="md" style={{ flex: 1, minWidth: 0 }}>
        {selecao?.tipo === 'aguardando' ? (
          <Stack gap="sm">
            <Group justify="space-between">
              <div>
                <Text fw={700} size="lg">OS {selecao.item.opNumero} — {selecao.item.cliente || '—'}</Text>
                <Text size="sm" c="dimmed">{selecao.item.produto || '—'}</Text>
              </div>
              <ActionIcon variant="light" color="gray" onClick={() => verPdfOp(selecao.item.opId)} title="Ver PDF da OP">
                <IconFileText size={16} />
              </ActionIcon>
            </Group>
            <Divider label="Aguardando material" labelPosition="left" />
            <SimpleGrid cols={3}>
              <div><Text size="xs" c="dimmed">Quantidade</Text><Text fw={600}>{selecao.item.quantidade?.toLocaleString('pt-BR')} {selecao.item.unidade}</Text></div>
              <div><Text size="xs" c="dimmed">Gramatura</Text><Text fw={600}>{selecao.item.gramatura || '—'}</Text></div>
              <div><Text size="xs" c="dimmed">Formato</Text><Text fw={600}>{selecao.item.formato || '—'}</Text></div>
              <div><Text size="xs" c="dimmed">Entrega</Text><Text fw={600}>{selecao.item.dataEntrega ? new Date(selecao.item.dataEntrega).toLocaleDateString('pt-BR') : '—'}</Text></div>
            </SimpleGrid>
            {selecao.item.bobinas?.length > 0 && (
              <Stack gap={4}>
                <Text size="xs" fw={600} c="dimmed">Bobinas</Text>
                {selecao.item.bobinas.map((b: any, i: number) => (
                  <Text key={i} size="sm" c={b.status === 'ENCOMENDADO' ? 'red' : 'green'}>
                    {b.status === 'ENCOMENDADO' ? '⏳' : '✓'} {b.descricao} ({b.kg.toLocaleString('pt-BR')} kg)
                  </Text>
                ))}
              </Stack>
            )}
            <Group justify="flex-end" mt="md">
              <UnstyledButton
                onClick={() => liberarProducao(selecao.item.opId)}
                style={{ background: 'var(--mantine-color-green-6)', color: 'white', padding: '8px 16px', borderRadius: 6, fontSize: 13, fontWeight: 600 }}
              >
                <Group gap={6}><IconTruck size={14} /> Cartão Recebido</Group>
              </UnstyledButton>
            </Group>
          </Stack>
        ) : baseOp && detalheOp ? (
          <Stack gap="sm">
            <Group justify="space-between" wrap="nowrap" align="flex-start">
              <div style={{ minWidth: 0 }}>
                <Group gap={6} wrap="nowrap">
                  <Text fw={700} size="lg" truncate>OP {baseOp.opNumero} — {baseOp.clienteNome || '—'}</Text>
                  {baseOp.isAvulsa && <Badge color="pink" size="sm">AVULSA</Badge>}
                  <Badge size="sm" color={PRIORIDADE_COLORS[baseOp.prioridade]} variant="light">{baseOp.prioridade}</Badge>
                </Group>
                <Text size="sm" c="dimmed" truncate>{baseOp.produtoNome || baseOp.descricao}</Text>
              </div>
              {baseOp.isAvulsa && (
                <Tooltip label="Excluir OP avulsa">
                  <ActionIcon variant="light" color="red" onClick={() => excluirOpAvulsa(baseOp.opId, baseOp.opNumero)}><IconX size={16} /></ActionIcon>
                </Tooltip>
              )}
            </Group>

            <Divider />

            {/* Especificação — dado único da OP, mostrado uma única vez (não repete por etapa) */}
            <UnstyledButton onClick={() => setEspecificacaoAberta((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {especificacaoAberta ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
              <Text size="sm" fw={600}>Detalhes da Especificação</Text>
            </UnstyledButton>
            <Collapse in={especificacaoAberta}>
              <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
                {baseOp.tipoOp && <div><Text size="xs" c="dimmed">Tipo OP</Text><Text size="sm" fw={600} c={corTipoOp(baseOp.tipoOp)}>{baseOp.tipoOp}</Text></div>}
                {!!baseOp.tiragem && <div><Text size="xs" c="dimmed">Tiragem</Text><Text size="sm" fw={600}>{baseOp.tiragem.toLocaleString('pt-BR')}</Text></div>}
                <div><Text size="xs" c="dimmed">Entrega</Text><Text size="sm" fw={600}>{baseOp.dataEntrega ? new Date(baseOp.dataEntrega).toLocaleDateString('pt-BR') : '—'}</Text></div>
                <div><Text size="xs" c="dimmed">Quantidade</Text><Text size="sm" fw={600}>{baseOp.quantidade?.toLocaleString('pt-BR')} {baseOp.unidade}</Text></div>
                {baseOp.materialPrincipal && <div><Text size="xs" c="dimmed">Cartão/Material</Text><Text size="sm" fw={600}>{baseOp.materialPrincipal}</Text></div>}
                {baseOp.gramatura && <div><Text size="xs" c="dimmed">Gramatura</Text><Text size="sm" fw={600}>{baseOp.gramatura}</Text></div>}
                {baseOp.formato && <div><Text size="xs" c="dimmed">Formato</Text><Text size="sm" fw={600}>{baseOp.formato}</Text></div>}
                {!!baseOp.pesoKg && <div><Text size="xs" c="dimmed">KG</Text><Text size="sm" fw={600}>{baseOp.pesoKg.toLocaleString('pt-BR')} kg</Text></div>}
                {baseOp.matriz && <div><Text size="xs" c="dimmed">Matriz</Text><Text size="sm" fw={600}>{baseOp.matriz}</Text></div>}
                {baseOp.qtdCores && <div><Text size="xs" c="dimmed">Cores</Text><Text size="sm" fw={600} c="indigo">{baseOp.qtdCores}</Text></div>}
                {baseOp.pantone01 && <div><Text size="xs" c="dimmed">Pantone 1</Text><Text size="sm" fw={600}>{baseOp.pantone01}</Text></div>}
                {baseOp.pantone02 && <div><Text size="xs" c="dimmed">Pantone 2</Text><Text size="sm" fw={600}>{baseOp.pantone02}</Text></div>}
                {baseOp.pantone03 && <div><Text size="xs" c="dimmed">Pantone 3</Text><Text size="sm" fw={600}>{baseOp.pantone03}</Text></div>}
              </SimpleGrid>
            </Collapse>

            <Divider label="Controle de Etapas" labelPosition="left" mt="xs" />

            {categoriasPresentes.length === 0 ? (
              <Text size="sm" c="dimmed" ta="center" py="md">Nenhuma etapa cadastrada para esta OP</Text>
            ) : (
              <Tabs value={abaCategoria} onChange={setAbaCategoria}>
                <Tabs.List>
                  {categoriasPresentes.map((cat) => (
                    <Tabs.Tab key={cat.key} value={cat.key}>{cat.label}</Tabs.Tab>
                  ))}
                </Tabs.List>

                {categoriasPresentes.map((cat) => (
                  <Tabs.Panel key={cat.key} value={cat.key} pt="sm">
                    <Stack gap="xs">
                      {etapasPorCategoria[cat.key].map((etapa: any) => (
                        <Card key={etapa.id} withBorder padding="sm" radius="sm" style={{ borderLeft: `3px solid ${STATUS_DOT[etapa.status]}` }}>
                          <Group justify="space-between" wrap="nowrap" align="flex-start">
                            <Box style={{ minWidth: 0 }}>
                              <Group gap={6} wrap="wrap">
                                <Text size="sm" fw={600} truncate>{etapa.centroDescricao}</Text>
                                {/* Resumo da fila do centro (quantas etapas em cada status) — mesma
                                    informação exibida no cabeçalho de cada grupo no Grid. */}
                                {(() => {
                                  const resumo = resumoPorCentroId.get(etapa.centroId)
                                  if (!resumo) return null
                                  return (
                                    <Group gap={4} wrap="nowrap">
                                      {resumo.emAndamento > 0 && <Badge color="blue" size="xs">{resumo.emAndamento} em andamento</Badge>}
                                      {resumo.pausadas > 0 && <Badge color="orange" size="xs">{resumo.pausadas} pausadas</Badge>}
                                      <Badge color="gray" size="xs">{resumo.pendentes} pendentes</Badge>
                                    </Group>
                                  )
                                })()}
                              </Group>
                              <Badge size="xs" color={STATUS_DOT[etapa.status]} variant="light" mt={2}>{STATUS_LABEL[etapa.status] || etapa.status}</Badge>
                            </Box>

                            <Group gap={4} wrap="nowrap">
                              <Tooltip label="Adicionar OS a este grupo">
                                <ActionIcon color="teal" variant="light" size="sm" onClick={() => abrirAdicionarOS(etapa.centroId, etapa.centroDescricao)}><IconPlus size={14} /></ActionIcon>
                              </Tooltip>
                              <Tooltip label="Ver PDF da OP">
                                <ActionIcon color="gray" variant="light" size="sm" onClick={() => verPdfOp(baseOp.opId)}><IconFileText size={14} /></ActionIcon>
                              </Tooltip>
                              <Tooltip label="Re-extrair Matriz/Formato do PDF">
                                <ActionIcon color="cyan" variant="light" size="sm" onClick={() => reextrairPdf(baseOp.opId, baseOp.opNumero)}><IconRefresh size={14} /></ActionIcon>
                              </Tooltip>
                              <Tooltip label="Mover para outro grupo">
                                <ActionIcon color="indigo" variant="light" size="sm" onClick={() => setModalMover({ etapaId: etapa.id, opNumero: etapa.opNumero, centroAtualId: etapa.centroId, centroDescricao: etapa.centroDescricao })}><IconArrowRight size={14} /></ActionIcon>
                              </Tooltip>
                              {etapa.status === 'PENDENTE' && (
                                <>
                                  <Tooltip label="Iniciar">
                                    <ActionIcon color="green" variant="light" size="sm" onClick={() => iniciarEtapa(etapa.id)}><IconPlayerPlay size={14} /></ActionIcon>
                                  </Tooltip>
                                  <Tooltip label="Desmembrar">
                                    <ActionIcon
                                      color="violet"
                                      variant="light"
                                      size="sm"
                                      onClick={() => {
                                        setModalDesmembrar({ etapaId: etapa.id, opNumero: etapa.opNumero, quantidade: etapa.quantidade, descricao: etapa.descricao })
                                        setFormDesmembrar([
                                          { centroProducaoId: '', quantidade: Math.floor(etapa.quantidade / 2) },
                                          { centroProducaoId: '', quantidade: Math.ceil(etapa.quantidade / 2) },
                                        ])
                                      }}
                                    >
                                      <IconCut size={14} />
                                    </ActionIcon>
                                  </Tooltip>
                                </>
                              )}
                              {etapa.status === 'PAUSADA' && (
                                <Tooltip label="Retomar">
                                  <ActionIcon color="green" variant="light" size="sm" onClick={() => iniciarEtapa(etapa.id)}><IconPlayerPlay size={14} /></ActionIcon>
                                </Tooltip>
                              )}
                              {etapa.status === 'EM_ANDAMENTO' && (
                                <>
                                  <Tooltip label="Apontar Produção">
                                    <ActionIcon color="blue" variant="light" size="sm" onClick={() => setModalApontar({ etapaId: etapa.id, opNumero: etapa.opNumero, descricao: etapa.descricao })}><IconClipboardCheck size={14} /></ActionIcon>
                                  </Tooltip>
                                  <Tooltip label="Pausar">
                                    <ActionIcon color="orange" variant="light" size="sm" onClick={() => setModalPausar({ etapaId: etapa.id, opNumero: etapa.opNumero })}><IconPlayerPause size={14} /></ActionIcon>
                                  </Tooltip>
                                  <Tooltip label="Concluir">
                                    <ActionIcon color="green" variant="light" size="sm" onClick={() => abrirFinalizarEtapa(etapa)}><IconCheck size={14} /></ActionIcon>
                                  </Tooltip>
                                </>
                              )}
                              {(etapa.isDesmembramento || etapa.isManual) && etapa.status === 'PENDENTE' && (
                                <Tooltip label={etapa.isDesmembramento ? 'Reverter desmembramento' : 'Excluir lançamento manual'}>
                                  <ActionIcon color="red" variant="light" size="sm" onClick={() => excluirEtapa(etapa.id, etapa.isDesmembramento)}><IconX size={14} /></ActionIcon>
                                </Tooltip>
                              )}
                            </Group>
                          </Group>

                          {/* Métricas — colunas que ficavam ocultas/condicionais no Grid (Prod./Perda/%), sempre visíveis aqui */}
                          <Group gap="lg" mt={8} wrap="wrap">
                            <div>
                              <Text size="10px" c="dimmed">Qtd</Text>
                              <Text size="sm" fw={600}>{Number(etapa.quantidade).toLocaleString('pt-BR')} {etapa.unidade}</Text>
                            </div>
                            <div>
                              <Text size="10px" c="dimmed">Produzido</Text>
                              <Text size="sm" fw={600} c={Number(etapa.quantidadeProduzida) > 0 ? 'green' : undefined}>{Number(etapa.quantidadeProduzida).toLocaleString('pt-BR')}</Text>
                            </div>
                            <div>
                              <Text size="10px" c="dimmed">Perda</Text>
                              <Text size="sm" fw={600} c={Number(etapa.quantidadePerda) > 0 ? 'red' : undefined}>{Number(etapa.quantidadePerda).toLocaleString('pt-BR')}</Text>
                            </div>
                            <div style={{ minWidth: 130, flex: 1 }}>
                              <Group justify="space-between" gap={4}>
                                <Text size="10px" c="dimmed">Progresso</Text>
                                <Text size="10px" fw={700}>{etapa.percentual}%</Text>
                              </Group>
                              <Progress value={etapa.percentual} size="sm" color={etapa.percentual >= 100 ? 'green' : 'blue'} />
                            </div>
                          </Group>

                          {/* Entrega/Prioridade/Matriz/Cores/Pantones — mesmas colunas do modelo
                              Impressão/Acabamento do Grid, não existem no modelo Cortadeira. */}
                          {cat.key !== 'cortadeira' && (
                            <Group gap="lg" mt={8} wrap="wrap">
                              <div>
                                <Text size="10px" c="dimmed">Entrega</Text>
                                {etapa.dataEntrega ? (
                                  <Group gap={4} wrap="nowrap">
                                    <Text
                                      size="sm"
                                      fw={600}
                                      style={{ cursor: 'pointer' }}
                                      onClick={() => setModalPostData({ opId: etapa.opId, opNumero: etapa.opNumero, dataAtual: etapa.dataEntrega })}
                                      title="Clique para postergar a entrega"
                                    >
                                      {new Date(etapa.dataEntrega).toLocaleDateString('pt-BR')}
                                    </Text>
                                    {etapa.vezesPostergada === 0 && <Text size="sm">🟢</Text>}
                                    {etapa.vezesPostergada === 1 && <Text size="sm">🟡</Text>}
                                    {etapa.vezesPostergada >= 2 && <Text size="sm">🔴</Text>}
                                  </Group>
                                ) : <Text size="sm" fw={600}>—</Text>}
                              </div>
                              <div>
                                <Text size="10px" c="dimmed">Prioridade</Text>
                                <Text
                                  size="sm"
                                  fw={600}
                                  c={PRIORIDADE_COLORS[etapa.prioridade]}
                                  style={{ cursor: 'pointer' }}
                                  onClick={() => alterarPrioridade(etapa.opId, etapa.prioridade)}
                                  title="Clique para alterar prioridade"
                                >
                                  {etapa.prioridade}
                                </Text>
                              </div>
                              <div>
                                <Text size="10px" c="dimmed">Matriz</Text>
                                <Text size="sm" fw={600}>{etapa.matriz || '—'}</Text>
                              </div>
                              <div>
                                <Text size="10px" c="dimmed">Cores</Text>
                                <Text size="sm" fw={600} c="indigo">{etapa.qtdCores || '—'}</Text>
                              </div>
                              <div>
                                <Text size="10px" c="dimmed">Pantone 1</Text>
                                <Text size="sm" fw={600}>{etapa.pantone01 || '—'}</Text>
                              </div>
                              <div>
                                <Text size="10px" c="dimmed">Pantone 2</Text>
                                <Text size="sm" fw={600}>{etapa.pantone02 || '—'}</Text>
                              </div>
                              <div>
                                <Text size="10px" c="dimmed">Pantone 3</Text>
                                <Text size="sm" fw={600}>{etapa.pantone03 || '—'}</Text>
                              </div>
                            </Group>
                          )}

                          {editingObs && editingObs.id === etapa.id ? (
                            <TextInput
                              size="xs"
                              mt={8}
                              placeholder="Acompanhamento..."
                              value={editingObs.value}
                              onChange={(e) => setEditingObs({ id: etapa.id, value: e.currentTarget.value })}
                              onBlur={() => salvarObservacao(etapa.id, editingObs!.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') salvarObservacao(etapa.id, editingObs!.value); if (e.key === 'Escape') setEditingObs(null) }}
                              autoFocus
                            />
                          ) : (
                            <Text
                              size="xs"
                              c={etapa.observacaoOperador ? undefined : 'dimmed'}
                              mt={8}
                              style={{ cursor: 'pointer' }}
                              onClick={() => setEditingObs({ id: etapa.id, value: etapa.observacaoOperador || '' })}
                            >
                              {etapa.observacaoOperador || 'Clique para adicionar acompanhamento'}
                            </Text>
                          )}
                        </Card>
                      ))}
                    </Stack>
                  </Tabs.Panel>
                ))}
              </Tabs>
            )}
          </Stack>
        ) : (
          <Text c="dimmed" ta="center" py="xl">Selecione uma OS na lista ao lado para ver os detalhes.</Text>
        )}
      </Card>
    </Group>
  )
}
