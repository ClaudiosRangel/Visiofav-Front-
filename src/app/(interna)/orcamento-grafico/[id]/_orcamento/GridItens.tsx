'use client'

/**
 * GridItens — "Itens do Orçamento" (nível 1 da hierarquia). Uma linha por item:
 * item | Cálculo | Linha de Produto | Tipo de Produto | Tiragens | Descrição | Status.
 *
 * Padrão de grid do projeto (`mantine-datatable`, mesma aparência do `DataTablePadrao`): busca,
 * ordenação por coluna, paginação e contador. O `DataTablePadrao` não repassa seleção/clique de
 * linha, por isso o `DataTable` é usado direto com a mesma configuração visual.
 *
 * Seleção atualiza o painel de dados (não abre o item); duplo clique ou "Abrir item" abre a
 * tela do item. Copiar e excluir são feitos por handlers do pai (promessas); falha mostra
 * mensagem da operação e mantém a lista como estava.
 */

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ActionIcon, Alert, Anchor, Badge, Button, Group, Menu, Modal, Paper, Skeleton, Stack, Text, TextInput, Tooltip,
} from '@mantine/core'
import {
  IconAlertCircle, IconCopy, IconDots, IconExternalLink, IconPlus, IconSearch, IconTrash,
} from '@tabler/icons-react'
import { DataTable, type DataTableColumn, type DataTableSortStatus } from 'mantine-datatable'

import type { ItemResumoDTO } from '../_hooks/hierarquia.types'
import { formatarTiragens, pluralizar } from './formatadores'

const TAMANHO_PAGINA = 15

export interface GridItensProps {
  orcamentoId: string
  /** `null` enquanto a primeira carga não terminou. */
  itens: ItemResumoDTO[] | null
  carregando?: boolean
  /** Erro da carga/recarga (a lista anterior, se houver, continua exibida). */
  erroCarga?: string | null
  onTentarNovamente?: () => void

  selecionadoId: string | null
  onSelecionar: (itemId: string | null) => void

  onIncluir: () => void
  /** Padrão: `router.push` para `/orcamento-grafico/:id/itens/:itemId`. */
  onAbrir?: (item: ItemResumoDTO) => void
  /** Deve rejeitar em caso de falha; o grid mostra a mensagem e mantém a lista. */
  onCopiar: (item: ItemResumoDTO) => Promise<void>
  onExcluir: (item: ItemResumoDTO) => Promise<void>

  /** Menu "Mais ações": cada entrada só aparece quando o handler é informado. */
  onRelatorio?: (item: ItemResumoDTO) => void
  onEncaixe?: (item: ItemResumoDTO) => void
  onEmitirOp?: (item: ItemResumoDTO) => void
}

function corDoStatus(status: string): string {
  const s = status.trim().toLowerCase()
  if (s === 'liberado') return 'green'
  if (s === 'pendente') return 'yellow'
  return 'gray'
}

function textoBusca(i: ItemResumoDTO): string {
  return [i.sequencia, i.calculo, i.linhaProduto, i.tipoProduto, formatarTiragens(i.tiragens), i.descricao, i.status, i.op?.numero]
    .filter((v) => v != null)
    .join(' ')
    .toLowerCase()
}

function valorOrdenacao(i: ItemResumoDTO, coluna: string): number | string {
  switch (coluna) {
    case 'sequencia': return i.sequencia
    case 'calculo': return i.calculo ?? -1
    case 'tiragens': return i.tiragens[0] ?? -1
    case 'linhaProduto': return i.linhaProduto ?? ''
    case 'tipoProduto': return i.tipoProduto ?? ''
    case 'descricao': return i.descricao ?? ''
    case 'status': return i.status
    default: return i.sequencia
  }
}

function ordenar(itens: ItemResumoDTO[], sort: DataTableSortStatus<ItemResumoDTO>): ItemResumoDTO[] {
  const col = String(sort.columnAccessor)
  const sinal = sort.direction === 'asc' ? 1 : -1
  return [...itens].sort((a, b) => {
    const va = valorOrdenacao(a, col)
    const vb = valorOrdenacao(b, col)
    const cmp =
      typeof va === 'number' && typeof vb === 'number'
        ? va - vb
        : String(va).localeCompare(String(vb), 'pt-BR', { numeric: true })
    return (cmp || a.sequencia - b.sequencia) * sinal
  })
}

export default function GridItens({
  orcamentoId,
  itens,
  carregando = false,
  erroCarga,
  onTentarNovamente,
  selecionadoId,
  onSelecionar,
  onIncluir,
  onAbrir,
  onCopiar,
  onExcluir,
  onRelatorio,
  onEncaixe,
  onEmitirOp,
}: GridItensProps) {
  const router = useRouter()

  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)
  const [sort, setSort] = useState<DataTableSortStatus<ItemResumoDTO>>({ columnAccessor: 'sequencia', direction: 'asc' })
  const [excluindo, setExcluindo] = useState<ItemResumoDTO | null>(null)
  const [operando, setOperando] = useState<'copiar' | 'excluir' | null>(null)
  const [erroOperacao, setErroOperacao] = useState<string | null>(null)

  const lista = itens ?? []
  const selecionado = useMemo(() => lista.find((i) => i.id === selecionadoId) ?? null, [lista, selecionadoId])

  const visiveis = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    const filtrados = termo ? lista.filter((i) => textoBusca(i).includes(termo)) : lista
    return ordenar(filtrados, sort)
  }, [lista, busca, sort])

  const paginados = useMemo(() => {
    const de = (pagina - 1) * TAMANHO_PAGINA
    return visiveis.slice(de, de + TAMANHO_PAGINA)
  }, [visiveis, pagina])

  useEffect(() => { setPagina(1) }, [busca])

  // Item removido da lista (excluído, recarga): o painel volta ao estado sem seleção.
  useEffect(() => {
    if (itens && selecionadoId && !itens.some((i) => i.id === selecionadoId)) onSelecionar(null)
  }, [itens, selecionadoId, onSelecionar])

  const hrefDoItem = (item: ItemResumoDTO) => `/orcamento-grafico/${orcamentoId}/itens/${item.id}`

  // Prefetch da rota do item selecionado: a abertura chega em até 2 s.
  useEffect(() => {
    if (!selecionado) return
    try {
      router.prefetch(hrefDoItem(selecionado))
    } catch {
      /* prefetch é só otimização */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selecionado?.id])

  function abrir(item: ItemResumoDTO) {
    if (onAbrir) onAbrir(item)
    else router.push(hrefDoItem(item))
  }

  async function copiar(item: ItemResumoDTO) {
    setErroOperacao(null)
    setOperando('copiar')
    try {
      await onCopiar(item)
    } catch {
      setErroOperacao('Não foi possível copiar o item. A lista de itens foi mantida como estava.')
    } finally {
      setOperando(null)
    }
  }

  async function confirmarExclusao() {
    const alvo = excluindo
    if (!alvo) return
    setErroOperacao(null)
    setOperando('excluir')
    try {
      await onExcluir(alvo)
      setExcluindo(null)
    } catch {
      setExcluindo(null)
      setErroOperacao('Não foi possível excluir o item. A lista de itens foi mantida como estava.')
    } finally {
      setOperando(null)
    }
  }

  const colunas: DataTableColumn<ItemResumoDTO>[] = [
    { accessor: 'sequencia', title: 'Item', sortable: true, width: 70, textAlign: 'right' },
    {
      accessor: 'calculo',
      title: 'Cálculo',
      sortable: true,
      width: 100,
      textAlign: 'right',
      render: (i) => (i.calculo != null ? String(i.calculo) : '—'),
    },
    { accessor: 'linhaProduto', title: 'Linha de Produto', sortable: true, render: (i) => i.linhaProduto ?? '—' },
    { accessor: 'tipoProduto', title: 'Tipo de Produto', sortable: true, render: (i) => i.tipoProduto ?? '—' },
    {
      accessor: 'tiragens',
      title: 'Tiragens',
      sortable: true,
      width: 150,
      render: (i) => <Text size="sm" style={{ whiteSpace: 'nowrap' }}>{formatarTiragens(i.tiragens)}</Text>,
    },
    {
      accessor: 'descricao',
      title: 'Descrição',
      sortable: true,
      render: (i) => (
        <Text size="sm" lineClamp={2} title={i.descricao ?? undefined}>
          {i.descricao ?? '—'}
        </Text>
      ),
    },
    {
      accessor: 'status',
      title: 'Status',
      sortable: true,
      width: 130,
      render: (i) => (
        <Stack gap={2} align="flex-start">
          <Badge variant="light" color={corDoStatus(i.status)}>{i.status}</Badge>
          {i.op ? (
            <Anchor component={Link} href={`/pcp/ordens-producao/${i.op.id}`} size="xs" onClick={(e) => e.stopPropagation()}>
              OP: {i.op.numero}
            </Anchor>
          ) : i.pedido ? (
            <Anchor component={Link} href={`/vendas/pedidos/${i.pedido.id}`} size="xs" onClick={(e) => e.stopPropagation()}>
              Ped: {i.pedido.numero}
            </Anchor>
          ) : null}
        </Stack>
      ),
    },
  ]

  const semSelecao = !selecionado
  const ocupado = operando !== null
  const temMaisAcoes = !!(onRelatorio || onEncaixe || onEmitirOp)
  const vazio = !!itens && itens.length === 0 && !erroCarga
  const primeiraCarga = itens === null && carregando

  return (
    <Stack gap="sm">
      <Group justify="space-between" wrap="wrap">
        <Text fw={600}>Itens do orçamento</Text>
        <Group gap="xs">
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={onIncluir} disabled={ocupado}>
            Incluir item
          </Button>
          <Button
            size="xs"
            variant="default"
            leftSection={<IconExternalLink size={14} />}
            disabled={semSelecao || ocupado}
            onClick={() => selecionado && abrir(selecionado)}
          >
            Abrir item
          </Button>
          <Button
            size="xs"
            variant="default"
            leftSection={<IconCopy size={14} />}
            disabled={semSelecao || ocupado}
            loading={operando === 'copiar'}
            onClick={() => selecionado && copiar(selecionado)}
          >
            Copiar item
          </Button>
          <Button
            size="xs"
            variant="light"
            color="red"
            leftSection={<IconTrash size={14} />}
            disabled={semSelecao || ocupado}
            onClick={() => selecionado && setExcluindo(selecionado)}
          >
            Excluir item
          </Button>
          {temMaisAcoes && (
            <Menu position="bottom-end" withinPortal>
              <Menu.Target>
                <Tooltip label="Mais ações">
                  <ActionIcon variant="default" size="lg" aria-label="Mais ações" disabled={semSelecao || ocupado}>
                    <IconDots size={16} />
                  </ActionIcon>
                </Tooltip>
              </Menu.Target>
              <Menu.Dropdown>
                {onRelatorio && (
                  <Menu.Item onClick={() => selecionado && onRelatorio(selecionado)}>Relatório do item</Menu.Item>
                )}
                {onEncaixe && (
                  <Menu.Item onClick={() => selecionado && onEncaixe(selecionado)}>Encaixe</Menu.Item>
                )}
                {onEmitirOp && (
                  <Menu.Item onClick={() => selecionado && onEmitirOp(selecionado)}>Emitir OP</Menu.Item>
                )}
              </Menu.Dropdown>
            </Menu>
          )}
        </Group>
      </Group>

      {erroCarga && (
        <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />} title="Não foi possível carregar os itens">
          <Group justify="space-between" wrap="nowrap">
            <Text size="sm">{erroCarga}{itens ? ' A lista exibida pode estar desatualizada.' : ''}</Text>
            {onTentarNovamente && (
              <Button size="xs" variant="default" onClick={onTentarNovamente}>Tentar novamente</Button>
            )}
          </Group>
        </Alert>
      )}

      {erroOperacao && (
        <Alert
          color="red"
          variant="light"
          icon={<IconAlertCircle size={16} />}
          withCloseButton
          onClose={() => setErroOperacao(null)}
        >
          {erroOperacao}
        </Alert>
      )}

      {primeiraCarga ? (
        <Stack gap="xs">
          <Skeleton height={36} />
          <Skeleton height={36} />
          <Skeleton height={36} />
        </Stack>
      ) : vazio ? (
        <Paper withBorder p="xl" radius="md">
          <Stack align="center" gap="xs">
            <Text fw={500}>Este orçamento ainda não tem itens.</Text>
            <Text size="sm" c="dimmed">Inclua o primeiro item para começar a especificar o produto.</Text>
            <Button leftSection={<IconPlus size={16} />} onClick={onIncluir}>Incluir item</Button>
          </Stack>
        </Paper>
      ) : (
        <Stack gap="xs">
          <Group justify="space-between">
            <TextInput
              placeholder="Buscar item..."
              leftSection={<IconSearch size={16} />}
              value={busca}
              onChange={(e) => setBusca(e.currentTarget.value)}
              w={320}
            />
            <Text size="xs" c="dimmed">
              {visiveis.length} {pluralizar(visiveis.length, 'item', 'itens')}
            </Text>
          </Group>
          <DataTable<ItemResumoDTO>
            withTableBorder
            striped
            highlightOnHover
            minHeight={160}
            fetching={carregando}
            records={paginados}
            totalRecords={visiveis.length}
            recordsPerPage={TAMANHO_PAGINA}
            page={pagina}
            onPageChange={setPagina}
            sortStatus={sort}
            onSortStatusChange={setSort}
            idAccessor="id"
            columns={colunas}
            noRecordsText="Nenhum item encontrado"
            onRowClick={({ record }) => onSelecionar(record.id)}
            onRowDoubleClick={({ record }) => abrir(record)}
            rowStyle={(record) => ({
              cursor: 'pointer',
              backgroundColor: record.id === selecionadoId ? 'var(--mantine-color-blue-light)' : undefined,
              fontWeight: record.id === selecionadoId ? 600 : undefined,
              boxShadow: record.id === selecionadoId ? 'inset 3px 0 0 var(--mantine-color-blue-filled)' : undefined,
            })}
          />
        </Stack>
      )}

      <Modal
        opened={!!excluindo}
        onClose={() => !ocupado && setExcluindo(null)}
        title="Excluir item"
        centered
        size="sm"
      >
        <Stack gap="md">
          <Text size="sm">
            Excluir o item {excluindo?.sequencia}
            {excluindo?.descricao ? ` (${excluindo.descricao})` : ''}? Esta ação remove também os planos do item.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setExcluindo(null)} disabled={ocupado}>Cancelar</Button>
            <Button color="red" onClick={confirmarExclusao} loading={operando === 'excluir'}>Confirmar</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
