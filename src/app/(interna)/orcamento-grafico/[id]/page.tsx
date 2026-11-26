'use client'

/**
 * Tela_Orcamento — nível 1 da hierarquia Orçamento → Item → Plano.
 *
 * Cabeçalho (título "Orçamento {número}", Preview da ficha master e ações do orçamento), grid de
 * itens + painel "Dados do item" e abas Fechamento / Comissões (sempre montadas). Os dados do
 * item e do plano NÃO são editados aqui: duplo clique ou "Abrir item" levam para
 * `/orcamento-grafico/:id/itens/:itemId`.
 *
 * "Incluir item": DialogoLinhaProduto → Confirmar abre o item em branco
 * (`itens/novo?linha=<linhaProdutoId>`); Cancelar só fecha. "Localizar Cálculo" é a ação separada
 * que abre o SeletorCalculoPadrao sem filtro de linha.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  Alert, Badge, Center, Grid, Group, Loader, Modal, Paper, Stack, Tabs, Text, Button,
} from '@mantine/core'
import { IconAlertCircle, IconAlertTriangle, IconSearch, IconX } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'

import { api } from '@/lib/api'
import { useEmpresa } from '@/providers/EmpresaProvider'
import { StatusBadge } from '../page'
import SeletorCalculoPadrao from '../_calculo-padrao/SeletorCalculoPadrao'
import DialogoLinhaProduto, { type LinhaProdutoSelecionada } from '../DialogoLinhaProduto'
import RelatorioItem from './RelatorioItem'
import EncaixeArquivoModal from './EncaixeArquivoModal'
import EditarCabecalhoModal from './EditarCabecalhoModal'
import FechamentoOrcamento from './FechamentoOrcamento'
import { OpModalOpcoes, useEmissaoOp, type OpcoesEmissaoOp } from './EmitirOp'

import { useOrcamentoHierarquia } from './_hooks/useOrcamentoHierarquia'
import { useFechamentoTotalizador } from './_hooks/useFechamentoTotalizador'
import { useComissoes } from './_hooks/useComissoes'
import { useDadosItem } from './_hooks/useDadosItem'
import { EVENTO_ITEM_ALTERADO, consumirAlteracaoItem } from './_hooks/sinal-alteracao-item'
import type { ItemResumoDTO } from './_hooks/hierarquia.types'
import CabecalhoOrcamento from './_orcamento/CabecalhoOrcamento'
import PrazoDoOrcamento from './_orcamento/PrazoDoOrcamento'
import UltimoCalculoCliente from './_orcamento/UltimoCalculoCliente'
import GridItens from './_orcamento/GridItens'
import PainelDadosItem from './_orcamento/PainelDadosItem'
import AbaFechamento from './_orcamento/AbaFechamento'
import TiragensItemEditaveis from './_orcamento/TiragensItemEditaveis'
import AbaComissoes from './_orcamento/AbaComissoes'
import PreviewFichaMaster from './_orcamento/PreviewFichaMaster'
import AcoesOrcamento, { ExigeAmostraOrcamento } from './_orcamento/AcoesOrcamento'
import DetalheLegadoOrcamento from './_orcamento/DetalheLegadoOrcamento'
import FluxoPedidoBanner from '@/components/comercial/FluxoPedidoBanner'
import { formatarMoeda } from './_orcamento/formatadores'

// ============================================================================
// Tipos (apenas o que a Tela_Orcamento lê do GET /:id)
// ============================================================================

interface OrcamentoDetalhe {
  id: string
  numero: number
  versao: number
  serie?: string | null
  serieId?: string | null
  tipo?: string | null // NOVO | REPETICAO
  dataOrcamento?: string | null
  clienteId?: string | null
  clienteNome?: string | null
  vendedorId?: string | null
  tipoEmbalagem?: { codigo: string; descricao: string } | null
  medidas?: Record<string, number>
  resultadoCalculo?: any
  papelDescricao?: string | null
  gramatura?: number | null
  numCores: number
  cores?: any[] | null
  acabamentos?: any[] | null
  quantidade: number
  custoTotal?: number | string | null
  precoVenda?: number | string | null
  precoUnitario?: number | string | null
  margemReal?: number | string | null
  status: string
  exigeAmostra?: boolean | null
  validadeAte?: string | null
  motivoRecusa?: string | null
  aprovadoEm?: string | null
  variacoes?: Array<{ quantidade: number; precoUnitario: number; precoTotal: number }> | null
  observacoes?: string | null
  produtoNome?: string | null
  clienteObservacao?: string | null
  criadoEm: string
  atualizadoEm: string
  itens?: Array<{ id: string }> | null
  custoProducaoConsolidado?: number | string | null
  valorTotalConsolidado?: number | string | null
  calculoOrigem?: { id: string; numero: number | null; numeroCalcgraf: number | null } | null
  prazoPagamentoId?: string | null
  prazoPagamento?: string | null
  precisaRecalcular?: boolean
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleString('pt-BR')
}

// Intervalo mínimo entre atualizações disparadas por foco/visibilidade da janela.
const INTERVALO_MIN_ATUALIZACAO_MS = 1500

/**
 * Troca de empresa (Req 16.4–16.8): o conteúdo é remontado quando a empresa ativa muda
 * (`key`), o que zera todos os estados locais e refaz as leituras com o token novo.
 * Token e empresa vêm só do `api`/`useEmpresa` (sessão da aba, via `authStorage`).
 */
export default function OrcamentoDetalhePage() {
  const { empresa, loading } = useEmpresa()
  if (loading) return <Center py="xl"><Loader size="lg" /></Center>
  return <OrcamentoDetalheConteudo key={empresa?.id ?? 'sem-empresa'} />
}

function OrcamentoDetalheConteudo() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const id = params.id as string

  const [orcamento, setOrcamento] = useState<OrcamentoDetalhe | null>(null)
  const [loading, setLoading] = useState(true)
  // Falha de carga do orçamento (não 404): limpa a tela e oferece "Tentar novamente".
  const [erroCarga, setErroCarga] = useState<string | null>(null)

  // Seleção no grid de itens (alimenta o painel "Dados do item").
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null)

  // Modais por item: relatório, encaixe e emissão de OP.
  const [editarCabecalhoOpen, setEditarCabecalhoOpen] = useState(false)
  const [buscaCalcOpen, setBuscaCalcOpen] = useState(false)
  const [dialogoLinhaAberto, setDialogoLinhaAberto] = useState(false)
  const [itemRelatorio, setItemRelatorio] = useState<ItemResumoDTO | null>(null)
  const [encaixeItem, setEncaixeItem] = useState<ItemResumoDTO | null>(null)
  const [opModalOpen, setOpModalOpen] = useState(false)
  const [opAlvo, setOpAlvo] = useState<string | null>(null)
  const { emitindo, emitirItem } = useEmissaoOp(id)

  const hierarquia = useOrcamentoHierarquia(id)
  const fechamento = useFechamentoTotalizador(id)
  const comissoes = useComissoes(id)
  const dadosItem = useDadosItem(id, selecionadoId)

  useEffect(() => { document.title = 'Detalhe do Orçamento' }, [])

  // Auto-seleção: ao passar de vazia para com itens, seleciona o item de menor número.
  const tinhaItensRef = useRef<boolean | null>(null)
  // Também cobre a exclusão: sem seleção válida e com itens restantes, seleciona o menor número.
  useEffect(() => {
    const lista = hierarquia.dados
    if (!lista) return
    const temItens = lista.length > 0
    const selecaoValida = !!selecionadoId && lista.some((i) => i.id === selecionadoId)
    if (temItens && !selecaoValida) {
      const menor = lista.reduce((a, b) => (b.sequencia < a.sequencia ? b : a))
      setSelecionadoId(menor.id)
    }
    tinhaItensRef.current = temItens
  }, [hierarquia.dados, selecionadoId])

  const itemSelecionado = hierarquia.dados?.find((i) => i.id === selecionadoId) ?? null

  // Guarda de 404: volta para a lista com a notificação, uma única vez.
  const redirecionouRef = useRef(false)
  const voltarNaoEncontrado = useCallback(() => {
    if (redirecionouRef.current) return
    redirecionouRef.current = true
    notifications.show({ title: 'Erro', message: 'Registro não encontrado.', color: 'red' })
    router.replace('/orcamento-grafico')
  }, [router])

  // `silencioso` recarrega sem trocar a tela por "carregando" (voltar da tela do item, foco da janela).
  const carregar = useCallback(async (silencioso = false) => {
    if (!silencioso) {
      setLoading(true)
      setErroCarga(null)
    }
    try {
      const res = await api.get(`/orcamento-grafico/${id}`)
      setOrcamento(res.data)
      setErroCarga(null)
    } catch (err: any) {
      if (err?.response?.status === 404) {
        voltarNaoEncontrado()
        return
      }
      const mensagem = err?.response?.data?.message || 'Falha ao buscar orçamento'
      if (!silencioso) {
        // Carga inicial/recarga completa: não mantém dados anteriores na tela.
        setOrcamento(null)
        setErroCarga(mensagem)
      } else {
        notifications.show({ title: 'Erro ao carregar', message: mensagem, color: 'red' })
      }
    } finally {
      if (!silencioso) setLoading(false)
    }
  }, [id, voltarNaoEncontrado])

  useEffect(() => { carregar() }, [carregar])

  useEffect(() => {
    if (hierarquia.naoEncontrado || fechamento.naoEncontrado || comissoes.naoEncontrado) voltarNaoEncontrado()
  }, [hierarquia.naoEncontrado, fechamento.naoEncontrado, comissoes.naoEncontrado, voltarNaoEncontrado])

  // Recarrega orçamento + leituras da tela (itens, fechamento, comissões, dados do item).
  const recargas = useRef({
    itens: hierarquia.recarregar,
    fechamento: fechamento.notificarAlteracaoItem,
    comissoes: comissoes.recarregar,
    dadosItem: dadosItem.recarregar,
  })
  recargas.current = {
    itens: hierarquia.recarregar,
    fechamento: fechamento.notificarAlteracaoItem,
    comissoes: comissoes.recarregar,
    dadosItem: dadosItem.recarregar,
  }

  const atualizarTudo = useCallback(async () => {
    recargas.current.itens()
    recargas.current.fechamento()
    recargas.current.comissoes()
    recargas.current.dadosItem()
    await carregar(true)
  }, [carregar])

  // Último cálculo do cliente → item novo a partir dele (igual ao "Localizar Cálculo").
  const [usandoUltimo, setUsandoUltimo] = useState(false)
  const usarUltimoCalculo = async (calculoId: string, numero: number) => {
    setUsandoUltimo(true)
    try {
      await api.post(`/orcamento-grafico/${id}/itens/usar-calculo`, { calculoId })
      notifications.show({ title: 'Item criado', message: `Item criado a partir do cálculo ${numero}.`, color: 'green' })
      await atualizarTudo()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao usar o cálculo.', color: 'red' })
    } finally {
      setUsandoUltimo(false)
    }
  }

  // Item salvo na Tela_Item: sinal guardado (tela desmontada) ou evento (tela montada) → o
  // Fechamento recarrega pelo `notificarAlteracaoItem()` do hook.
  useEffect(() => {
    if (consumirAlteracaoItem(id)) recargas.current.fechamento()
    const aoAlterar = (e: Event) => {
      const alvo = (e as CustomEvent<{ orcamentoId?: string }>).detail?.orcamentoId
      if (alvo === id && consumirAlteracaoItem(id)) recargas.current.fechamento()
    }
    window.addEventListener(EVENTO_ITEM_ALTERADO, aoAlterar)
    return () => window.removeEventListener(EVENTO_ITEM_ALTERADO, aoAlterar)
  }, [id])

  // Ao voltar da tela do item (janela volta a ficar visível/focada), as leituras são refeitas.
  const ultimaAtualizacaoRef = useRef(Date.now())
  useEffect(() => {
    const aoVoltar = () => {
      if (document.visibilityState === 'hidden') return
      const agora = Date.now()
      if (agora - ultimaAtualizacaoRef.current < INTERVALO_MIN_ATUALIZACAO_MS) return
      ultimaAtualizacaoRef.current = agora
      void atualizarTudo()
    }
    window.addEventListener('focus', aoVoltar)
    document.addEventListener('visibilitychange', aoVoltar)
    return () => {
      window.removeEventListener('focus', aoVoltar)
      document.removeEventListener('visibilitychange', aoVoltar)
    }
  }, [atualizarTudo])

  // Compatibilidade: `?novoItem=1` abre o item em branco sem linha (o Produto usa a linha do
  // orçamento). O fluxo atual de "Incluir item" navega direto para `itens/novo?linha=...`.
  const novoItemTratadoRef = useRef(false)
  useEffect(() => {
    if (novoItemTratadoRef.current || loading || !orcamento) return
    if (searchParams.get('novoItem') === '1') {
      novoItemTratadoRef.current = true
      router.replace(`/orcamento-grafico/${id}/itens/novo`)
    }
  }, [searchParams, loading, orcamento, router, id])

  const podeEditarItens = orcamento?.status === 'RASCUNHO'

  const avisarSoRascunho = (acao: string) =>
    notifications.show({ title: 'Ação indisponível', message: `${acao} só é possível com o orçamento em rascunho.`, color: 'orange' })

  // ---------------------------------------------------------------------------
  // Handlers do grid de itens
  // ---------------------------------------------------------------------------

  const incluirItem = () => {
    if (!podeEditarItens) {
      avisarSoRascunho('Incluir item')
      return
    }
    setDialogoLinhaAberto(true)
  }

  /** Linha escolhida → tela do item em branco, com o Produto filtrado pela linha. */
  const abrirItemNovoComLinha = (linha: LinhaProdutoSelecionada) => {
    setDialogoLinhaAberto(false)
    router.push(`/orcamento-grafico/${id}/itens/novo?linha=${encodeURIComponent(linha.id)}`)
  }

  const copiarItem = async (item: ItemResumoDTO) => {
    if (!podeEditarItens) {
      avisarSoRascunho('Copiar item')
      throw new Error('somente-rascunho')
    }
    try {
      const { data } = await api.post(`/orcamento-grafico/${id}/itens/${item.id}/copiar`)
      notifications.show({
        title: 'Item copiado',
        message: `Item ${data?.sequencia ?? ''} criado com ${data?.planosCopiados ?? 0} plano(s).`,
        color: 'green',
      })
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao copiar o item', color: 'red' })
      throw err
    }
    await atualizarTudo()
  }

  const excluirItem = async (item: ItemResumoDTO) => {
    if (!podeEditarItens) {
      avisarSoRascunho('Excluir item')
      throw new Error('somente-rascunho')
    }
    try {
      await api.delete(`/orcamento-grafico/${id}/itens/${item.id}`)
      notifications.show({ title: 'Item removido', message: `Item #${item.sequencia} removido.`, color: 'orange' })
      // Limpa a seleção do item removido; o efeito de auto-seleção escolhe o menor restante.
      if (selecionadoId === item.id) setSelecionadoId(null)
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao remover item', color: 'red' })
      throw err
    }
    await atualizarTudo()
  }

  const abrirEmitirItem = (item: ItemResumoDTO) => {
    setOpAlvo(item.id)
    setOpModalOpen(true)
  }

  const confirmarEmissaoOp = async (opcoes: OpcoesEmissaoOp, emails: string[]) => {
    if (!opAlvo) return
    const ok = await emitirItem(opAlvo, opcoes, emails)
    if (ok) {
      setOpModalOpen(false)
      await atualizarTudo()
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return <Center py="xl"><Loader size="lg" /></Center>
  }

  if (erroCarga) {
    return (
      <Center py="xl">
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Erro ao carregar o orçamento">
          <Stack gap="xs" align="flex-start">
            <Text size="sm">{erroCarga}</Text>
            <Button variant="light" onClick={() => { void carregar() }}>Tentar novamente</Button>
          </Stack>
        </Alert>
      </Center>
    )
  }

  if (!orcamento) {
    return (
      <Center py="xl">
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Orçamento não encontrado">
          O orçamento solicitado não foi encontrado.
        </Alert>
      </Center>
    )
  }

  const semItens = !Array.isArray(orcamento.itens) || orcamento.itens.length === 0

  return (
    <Stack gap="md">
      <FluxoPedidoBanner orcamentoId={id} onChanged={atualizarTudo} />
      <CabecalhoOrcamento
        numero={orcamento.numero}
        serie={orcamento.serie}
        serieId={orcamento.serieId}
        dataOrcamento={orcamento.dataOrcamento}
        clienteNome={orcamento.clienteNome}
        onEditarCliente={podeEditarItens ? () => setEditarCabecalhoOpen(true) : undefined}
        prazo={
          <PrazoDoOrcamento
            orcamentoId={id}
            prazoPagamentoId={orcamento.prazoPagamentoId}
            prazoPagamento={orcamento.prazoPagamento}
            clienteId={orcamento.clienteId}
            editavel={podeEditarItens}
            calculado={Number(orcamento.valorTotalConsolidado ?? 0) > 0 || Number(orcamento.precoVenda ?? 0) > 0}
            onAlterado={() => { void atualizarTudo() }}
          />
        }
        aposCliente={
          podeEditarItens && orcamento.clienteId ? (
            <UltimoCalculoCliente clienteId={orcamento.clienteId} onUsar={(c) => void usarUltimoCalculo(c.id, c.numero)} usando={usandoUltimo} />
          ) : null
        }
        acoes={
          <>
            <PreviewFichaMaster orcamentoId={id} />
            {podeEditarItens && (
              <Button variant="light" leftSection={<IconSearch size={16} />} onClick={() => setBuscaCalcOpen(true)}>
                Localizar Cálculo
              </Button>
            )}
            <AcoesOrcamento orcamento={orcamento} onRecarregar={atualizarTudo} />
          </>
        }
      />

      {/* Situação do orçamento e totais consolidados */}
      <Paper withBorder p="md" radius="md">
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="lg">
          <Stack gap={4}>
            <Group gap="xs">
              <StatusBadge status={orcamento.status} />
              <Badge variant="outline">V{orcamento.versao}</Badge>
              {orcamento.tipo === 'REPETICAO' && <Badge color="violet" variant="light">Repetição</Badge>}
              {orcamento.precisaRecalcular && (
                <Badge color="orange" variant="light" data-testid="selo-precisa-recalcular">Precisa recalcular</Badge>
              )}
            </Group>
            {orcamento.precisaRecalcular && (
              <Text size="xs" c="orange">
                O prazo de pagamento mudou. Abra e salve cada item para recalcular antes de validar ou enviar a proposta.
              </Text>
            )}
            <Text size="xs" c="dimmed">
              Criado em {formatDateTime(orcamento.criadoEm)} · Atualizado em {formatDateTime(orcamento.atualizadoEm)}
            </Text>
            {orcamento.calculoOrigem && (
              <Text size="sm">
                <strong>Cálculo utilizado:</strong>{' '}
                nº {orcamento.calculoOrigem.numeroCalcgraf ?? orcamento.calculoOrigem.numero}
              </Text>
            )}
            {orcamento.validadeAte && (
              <Text size="sm"><strong>Validade:</strong> {formatDate(orcamento.validadeAte)}</Text>
            )}
            {orcamento.aprovadoEm && (
              <Text size="sm"><strong>Aprovado em:</strong> {formatDateTime(orcamento.aprovadoEm)}</Text>
            )}
          </Stack>
          <Stack gap={2} align="flex-end">
            <Text size="xs" c="dimmed">Custo de produção consolidado</Text>
            <Text size="sm" fw={600} c="red">{formatarMoeda(Number(orcamento.custoProducaoConsolidado ?? NaN))}</Text>
            <Text size="xs" c="dimmed">Valor total consolidado</Text>
            <Text size="lg" fw={700} c="green">{formatarMoeda(Number(orcamento.valorTotalConsolidado ?? NaN))}</Text>
          </Stack>
        </Group>
      </Paper>

      <ExigeAmostraOrcamento orcamento={orcamento} onRecarregar={atualizarTudo} />

      {orcamento.status === 'RECUSADO' && orcamento.motivoRecusa && (
        <Alert icon={<IconX size={16} />} color="red" title="Motivo da Recusa">
          {orcamento.motivoRecusa}
        </Alert>
      )}

      {/* Observação do cliente — alerta de atenção, não-bloqueante. */}
      {orcamento.clienteObservacao?.trim() && (
        <Alert icon={<IconAlertTriangle size={18} />} color="orange" variant="light" title="Observação do cliente">
          <Text size="sm" style={{ whiteSpace: 'pre-line' }}>{orcamento.clienteObservacao}</Text>
        </Alert>
      )}

      {/* Grid de itens + painel "Dados do item" */}
      <Grid gutter="md">
        <Grid.Col span={{ base: 12, lg: 8 }}>
          <Paper withBorder p="md" radius="md">
            <GridItens
              orcamentoId={id}
              itens={hierarquia.dados}
              carregando={hierarquia.carregando}
              erroCarga={hierarquia.erro}
              onTentarNovamente={hierarquia.recarregar}
              selecionadoId={selecionadoId}
              onSelecionar={setSelecionadoId}
              onIncluir={incluirItem}
              onCopiar={copiarItem}
              onExcluir={excluirItem}
              onRelatorio={(item) => setItemRelatorio(item)}
              onEncaixe={(item) => setEncaixeItem(item)}
              onEmitirOp={abrirEmitirItem}
            />
          </Paper>
        </Grid.Col>
        <Grid.Col span={{ base: 12, lg: 4 }}>
          <PainelDadosItem
            itemId={selecionadoId}
            tituloItem={itemSelecionado?.tipoProduto ?? null}
            dados={dadosItem.dados}
            carregando={dadosItem.carregando}
            erro={dadosItem.erro}
            onTentarNovamente={dadosItem.recarregar}
          />
        </Grid.Col>
      </Grid>

      {/* Fechamento e Comissões — as duas abas ficam sempre montadas. */}
      <Paper withBorder p="md" radius="md">
        <Tabs defaultValue="fechamento" keepMounted>
          <Tabs.List>
            <Tabs.Tab value="fechamento">Fechamento</Tabs.Tab>
            <Tabs.Tab value="comissoes">Comissões</Tabs.Tab>
          </Tabs.List>
          <Tabs.Panel value="fechamento" pt="md">
            <AbaFechamento
              dados={fechamento.dados}
              carregando={fechamento.carregando}
              erro={fechamento.erro}
              onTentarNovamente={fechamento.recarregar}
              edicao={
                (hierarquia.dados?.length ?? 0) > 0 ? (
                  <TiragensItemEditaveis
                    orcamentoId={id}
                    itens={hierarquia.dados ?? []}
                    itemInicialId={selecionadoId}
                    podeEditar={['RASCUNHO', 'ENVIADO'].includes(orcamento.status)}
                    onAlterado={() => { void atualizarTudo() }}
                  />
                ) : null
              }
              detalhe={
                <FechamentoOrcamento
                  orcamentoId={id}
                  resultado={orcamento.resultadoCalculo}
                  quantidade={orcamento.quantidade}
                  precoVendaConsolidado={orcamento.valorTotalConsolidado != null ? Number(orcamento.valorTotalConsolidado) : null}
                  custoProducaoConsolidado={orcamento.custoProducaoConsolidado != null ? Number(orcamento.custoProducaoConsolidado) : null}
                  podeEditar={['RASCUNHO', 'ENVIADO', 'APROVADO'].includes(orcamento.status)}
                  onRecalculado={() => { void atualizarTudo() }}
                />
              }
            />
          </Tabs.Panel>
          <Tabs.Panel value="comissoes" pt="md">
            <AbaComissoes
              dados={comissoes.dados}
              carregando={comissoes.carregando}
              erro={comissoes.erro}
              onTentarNovamente={comissoes.recarregar}
            />
          </Tabs.Panel>
        </Tabs>
      </Paper>

      {/* Orçamentos antigos sem itens: o detalhe do item único fica no cabeçalho. */}
      {semItens && <DetalheLegadoOrcamento orcamento={orcamento} />}

      {orcamento.observacoes && (
        <Paper p="md" withBorder>
          <Text fw={600} size="sm" mb="xs">Observações</Text>
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{orcamento.observacoes}</Text>
        </Paper>
      )}

      {/* Edição de cliente + vendedor (modal enxuto existente) */}
      <EditarCabecalhoModal
        opened={editarCabecalhoOpen}
        onClose={() => setEditarCabecalhoOpen(false)}
        orcamentoId={id}
        clienteId={orcamento.clienteId}
        clienteNome={orcamento.clienteNome}
        vendedorId={orcamento.vendedorId}
        onSalvo={atualizarTudo}
      />

      {/* Busca de cálculo da biblioteca → cria item a partir do cálculo */}
      <SeletorCalculoPadrao
        opened={buscaCalcOpen}
        onClose={() => setBuscaCalcOpen(false)}
        orcamentoId={id}
        linhaInicial={null}
        clienteInicial={orcamento.clienteId ? { nome: orcamento.clienteNome } : null}
        onUsado={atualizarTudo}
      />

      {/* "Incluir item": escolha da linha → tela do item em branco (Cancelar só fecha) */}
      <DialogoLinhaProduto
        opened={dialogoLinhaAberto}
        onConfirmar={abrirItemNovoComLinha}
        onCancelar={() => setDialogoLinhaAberto(false)}
      />

      {/* Upload + visualização do arquivo de encaixe (app externo) */}
      <EncaixeArquivoModal
        opened={!!encaixeItem}
        onClose={() => setEncaixeItem(null)}
        orcamentoId={id}
        itemId={encaixeItem?.id ?? null}
        itemDescricao={encaixeItem?.descricao}
      />

      {/* Modal de opções de emissão de OP */}
      <OpModalOpcoes
        opened={opModalOpen}
        onClose={() => setOpModalOpen(false)}
        titulo="Emitir OP"
        descricao="Emitir a Ordem de Produção para este item."
        loading={emitindo}
        onConfirmar={confirmarEmissaoOp}
      />

      {/* Relatório do item (pré-cálculo) */}
      <Modal
        opened={!!itemRelatorio}
        onClose={() => setItemRelatorio(null)}
        title={
          itemRelatorio
            ? `Relatório do item #${itemRelatorio.sequencia} — Orçamento #${orcamento.numero}`
            : 'Relatório do item'
        }
        size="xl"
      >
        {itemRelatorio && <RelatorioItem orcamentoId={id} itemId={itemRelatorio.id} />}
      </Modal>
    </Stack>
  )
}
