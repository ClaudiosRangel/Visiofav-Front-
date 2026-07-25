'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  Box, Card, Stack, Group, Text, Badge, ActionIcon, Tooltip, ScrollArea, Divider,
  SimpleGrid, UnstyledButton, TextInput, Collapse,
} from '@mantine/core'
import {
  IconFileText, IconRefresh, IconArrowRight, IconX, IconPlayerPlay, IconPlayerPause,
  IconCheck, IconChevronDown, IconChevronRight, IconTruck,
} from '@tabler/icons-react'

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

function StatusDot({ status }: { status: string }) {
  return <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_DOT[status] || '#adb5bd', display: 'inline-block', flexShrink: 0 }} />
}

interface EtapaSelecionada {
  opId: string
}

interface AguardandoSelecionado {
  item: any
}

type Selecao = { tipo: 'etapa'; opId: string } | { tipo: 'aguardando'; item: any } | null

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
  excluirEtapa: (etapaId: string, isDesmembramento: boolean) => void
  excluirOpAvulsa: (opId: string, referencia: string) => void
  liberarProducao: (opId: string) => void
}

/**
 * Layout "Detalhado" (mestre-detalhe) do painel de Programação — segunda
 * visualização da mesma tela, alternativa ao layout "Grid" (tabelas por
 * centro). Mantém os mesmos dados/filtros/ações já existentes na página;
 * só muda a apresentação: lista compacta à esquerda + painel de detalhe
 * único à direita, evitando repetir a mesma informação da OP em cada aba.
 *
 * A lista à esquerda respeita os filtros ativos (busca/status/prioridade/
 * data/aba), mas o painel de detalhe sempre monta o "Controle de Etapas"
 * a partir de `painel.centros` SEM filtro — assim, ao selecionar uma OS na
 * aba "Cortadeira", o detalhe ainda mostra as etapas de Impressão/
 * Acabamento da mesma OP, exatamente como no layout Grid (onde cada etapa
 * aparece na tabela do seu próprio centro).
 */
export default function VisaoDetalhadaProgramacao({
  painel, centrosFiltrados, aguardandoCartaoFiltrado, highlightedEtapa,
  editingObs, setEditingObs, salvarObservacao,
  iniciarEtapa, abrirFinalizarEtapa, setModalPausar, verPdfOp, reextrairPdf,
  setModalMover, excluirEtapa, excluirOpAvulsa, liberarProducao,
}: Props) {
  const [selecao, setSelecao] = useState<Selecao>(null)
  const [especificacaoAberta, setEspecificacaoAberta] = useState(true)

  // Índice OP → todas as suas etapas (todos os centros, sem filtro de aba),
  // para o painel de detalhe sempre mostrar o fluxo completo da OP.
  const mapaEtapasPorOp = useMemo(() => {
    const mapa = new Map<string, { base: any; etapas: any[] }>()
    for (const centro of painel?.centros || []) {
      for (const etapa of centro.etapas) {
        if (!mapa.has(etapa.opId)) mapa.set(etapa.opId, { base: etapa, etapas: [] })
        mapa.get(etapa.opId)!.etapas.push({ ...etapa, centroDescricao: centro.centro.descricao, centroId: centro.centro.id })
      }
    }
    for (const v of mapa.values()) v.etapas.sort((a, b) => a.sequencia - b.sequencia)
    return mapa
  }, [painel])

  // Seleção automática do primeiro item ao entrar na visão ou quando a
  // seleção atual sai da lista filtrada (ex: OS foi concluída/removida).
  useEffect(() => {
    const aindaExiste = selecao?.tipo === 'etapa'
      ? centrosFiltrados.some((c: any) => c.etapas.some((e: any) => e.opId === selecao.opId))
      : selecao?.tipo === 'aguardando'
        ? aguardandoCartaoFiltrado.some((i: any) => i.id === selecao.item.id)
        : false

    if (aindaExiste) return

    const primeiraAguardando = aguardandoCartaoFiltrado[0]
    const primeiroCentroComEtapa = centrosFiltrados.find((c: any) => c.etapas.length > 0)
    if (primeiraAguardando) setSelecao({ tipo: 'aguardando', item: primeiraAguardando })
    else if (primeiroCentroComEtapa) setSelecao({ tipo: 'etapa', opId: primeiroCentroComEtapa.etapas[0].opId })
    else setSelecao(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centrosFiltrados, aguardandoCartaoFiltrado])

  const detalheOp = selecao?.tipo === 'etapa' ? mapaEtapasPorOp.get(selecao.opId) : null
  const baseOp = detalheOp?.base

  return (
    <Group align="flex-start" gap="md" wrap="nowrap" style={{ minHeight: 500 }}>
      {/* Coluna principal — lista mestre, mesma estrutura de grupos do Grid */}
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
                return (
                  <UnstyledButton
                    key={item.id}
                    onClick={() => setSelecao({ tipo: 'aguardando', item })}
                    style={{
                      display: 'block', width: '100%', padding: '8px 12px',
                      background: ativo ? 'var(--mantine-color-orange-1)' : undefined,
                      borderLeft: ativo ? '3px solid var(--mantine-color-orange-6)' : '3px solid transparent',
                    }}
                  >
                    <Group gap={6} wrap="nowrap">
                      <StatusDot status="PAUSADA" />
                      <Box style={{ minWidth: 0, flex: 1 }}>
                        <Text size="sm" fw={600} truncate>{item.opNumero} — {item.cliente || '—'}</Text>
                        <Text size="xs" c="dimmed" truncate>{item.produto || 'Aguardando material'}</Text>
                      </Box>
                    </Group>
                  </UnstyledButton>
                )
              })}
              <Divider />
            </Box>
          )}

          {centrosFiltrados.map((centro: any) => (
            <Box key={centro.centro.id}>
              <Group justify="space-between" px="sm" py={6} style={{ background: 'var(--mantine-color-gray-0)', position: 'sticky', top: 0, zIndex: 1 }}>
                <Text size="xs" fw={700} c="teal" truncate>{centro.centro.descricao}</Text>
                <Group gap={4}>
                  {centro.resumo.emAndamento > 0 && <Badge size="xs" color="blue">{centro.resumo.emAndamento}</Badge>}
                  {centro.resumo.pausadas > 0 && <Badge size="xs" color="orange">{centro.resumo.pausadas}</Badge>}
                  <Badge size="xs" color="gray" variant="light">{centro.resumo.pendentes}</Badge>
                </Group>
              </Group>
              {centro.etapas.length === 0 ? (
                <Text size="xs" c="dimmed" ta="center" py="xs">Nenhuma OP na fila</Text>
              ) : (
                centro.etapas.map((etapa: any) => {
                  const ativo = selecao?.tipo === 'etapa' && selecao.opId === etapa.opId
                  const destacar = highlightedEtapa === etapa.id
                  return (
                    <UnstyledButton
                      key={etapa.id}
                      onClick={() => setSelecao({ tipo: 'etapa', opId: etapa.opId })}
                      style={{
                        display: 'block', width: '100%', padding: '8px 12px',
                        background: destacar ? 'var(--mantine-color-yellow-2)' : (ativo ? 'var(--mantine-color-teal-0)' : (etapa.isAvulsa ? 'var(--mantine-color-pink-0)' : undefined)),
                        borderLeft: ativo ? '3px solid var(--mantine-color-teal-6)' : '3px solid transparent',
                        borderBottom: '1px solid var(--mantine-color-gray-1)',
                      }}
                    >
                      <Group gap={6} wrap="nowrap">
                        <StatusDot status={etapa.status} />
                        <Box style={{ minWidth: 0, flex: 1 }}>
                          <Group gap={4} wrap="nowrap">
                            <Text size="sm" fw={600} truncate>{etapa.opNumero} — {etapa.clienteNome || '—'}</Text>
                            {etapa.isAvulsa && <Badge color="pink" size="xs">AVULSA</Badge>}
                          </Group>
                          <Text size="xs" c="dimmed" truncate>{etapa.produtoNome || etapa.descricao}</Text>
                        </Box>
                        <Text size="9px" fw={700} c={STATUS_DOT[etapa.status]} style={{ whiteSpace: 'nowrap' }}>
                          {STATUS_LABEL[etapa.status] || etapa.status}
                        </Text>
                      </Group>
                    </UnstyledButton>
                  )
                })
              )}
            </Box>
          ))}
        </ScrollArea>
      </Card>

      {/* Painel de detalhe — informação única da OP + controle de todas as etapas */}
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
              <Group gap={4} wrap="nowrap">
                <Tooltip label="Ver PDF da OP">
                  <ActionIcon variant="light" color="gray" onClick={() => verPdfOp(baseOp.opId)}><IconFileText size={16} /></ActionIcon>
                </Tooltip>
                <Tooltip label="Re-extrair Matriz/Formato do PDF">
                  <ActionIcon variant="light" color="cyan" onClick={() => reextrairPdf(baseOp.opId, baseOp.opNumero)}><IconRefresh size={16} /></ActionIcon>
                </Tooltip>
                {baseOp.isAvulsa && (
                  <Tooltip label="Excluir OP avulsa">
                    <ActionIcon variant="light" color="red" onClick={() => excluirOpAvulsa(baseOp.opId, baseOp.opNumero)}><IconX size={16} /></ActionIcon>
                  </Tooltip>
                )}
              </Group>
            </Group>

            <Divider />

            {/* Especificação — dado único da OP, mostrado uma única vez (não repete por etapa) */}
            <UnstyledButton onClick={() => setEspecificacaoAberta((v) => !v)} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {especificacaoAberta ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
              <Text size="sm" fw={600}>Detalhes da Especificação</Text>
            </UnstyledButton>
            <Collapse in={especificacaoAberta}>
              <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="sm">
                {baseOp.tipoOp && <div><Text size="xs" c="dimmed">Tipo OP</Text><Text size="sm" fw={600}>{baseOp.tipoOp}</Text></div>}
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

            <Stack gap="xs">
              {detalheOp.etapas.map((etapa: any, idx: number) => (
                <Card key={etapa.id} withBorder padding="sm" radius="sm" style={{ borderLeft: `3px solid ${STATUS_DOT[etapa.status]}` }}>
                  <Group justify="space-between" wrap="nowrap" align="flex-start">
                    <Group gap={8} wrap="nowrap" style={{ minWidth: 0, flex: 1 }}>
                      <Text size="sm" fw={700} c="dimmed">{idx + 1}.</Text>
                      <Box style={{ minWidth: 0 }}>
                        <Text size="sm" fw={600} truncate>{etapa.centroDescricao}</Text>
                        <Badge size="xs" color={STATUS_DOT[etapa.status]} variant="light" mt={2}>{STATUS_LABEL[etapa.status] || etapa.status}</Badge>
                      </Box>
                    </Group>

                    <Group gap={4} wrap="nowrap">
                      {etapa.status === 'PENDENTE' && (
                        <Tooltip label="Iniciar">
                          <ActionIcon color="green" variant="light" size="sm" onClick={() => iniciarEtapa(etapa.id)}><IconPlayerPlay size={14} /></ActionIcon>
                        </Tooltip>
                      )}
                      {etapa.status === 'PAUSADA' && (
                        <Tooltip label="Retomar">
                          <ActionIcon color="green" variant="light" size="sm" onClick={() => iniciarEtapa(etapa.id)}><IconPlayerPlay size={14} /></ActionIcon>
                        </Tooltip>
                      )}
                      {etapa.status === 'EM_ANDAMENTO' && (
                        <>
                          <Tooltip label="Pausar">
                            <ActionIcon color="orange" variant="light" size="sm" onClick={() => setModalPausar({ etapaId: etapa.id, opNumero: etapa.opNumero })}><IconPlayerPause size={14} /></ActionIcon>
                          </Tooltip>
                          <Tooltip label="Concluir">
                            <ActionIcon color="green" variant="light" size="sm" onClick={() => abrirFinalizarEtapa(etapa)}><IconCheck size={14} /></ActionIcon>
                          </Tooltip>
                        </>
                      )}
                      <Tooltip label="Mover para outro grupo">
                        <ActionIcon color="indigo" variant="light" size="sm" onClick={() => setModalMover({ etapaId: etapa.id, opNumero: etapa.opNumero, centroAtualId: etapa.centroId, centroDescricao: etapa.centroDescricao })}><IconArrowRight size={14} /></ActionIcon>
                      </Tooltip>
                      {(etapa.isDesmembramento || etapa.isManual) && etapa.status === 'PENDENTE' && (
                        <Tooltip label={etapa.isDesmembramento ? 'Reverter desmembramento' : 'Excluir lançamento manual'}>
                          <ActionIcon color="red" variant="light" size="sm" onClick={() => excluirEtapa(etapa.id, etapa.isDesmembramento)}><IconX size={14} /></ActionIcon>
                        </Tooltip>
                      )}
                    </Group>
                  </Group>

                  {editingObs && editingObs.id === etapa.id ? (
                    <TextInput
                      size="xs"
                      mt={6}
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
                      mt={6}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setEditingObs({ id: etapa.id, value: etapa.observacaoOperador || '' })}
                    >
                      {etapa.observacaoOperador || 'Clique para adicionar acompanhamento'}
                    </Text>
                  )}
                </Card>
              ))}
            </Stack>
          </Stack>
        ) : (
          <Text c="dimmed" ta="center" py="xl">Selecione uma OS na lista ao lado para ver os detalhes.</Text>
        )}
      </Card>
    </Group>
  )
}
