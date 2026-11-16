'use client'

/**
 * PlanosDoItem — editor dos "Planos do Cálculo" de UM item de orçamento gráfico
 * (Task 11 da spec orcamento-grafico-op-relatorio-paridade; Req 4.1, 4.2, 5.6).
 *
 * Um item pode ter vários planos (ex.: TAMPA, CAIXA, BOLSA / FRENTE+COSTA), cada
 * um com formato/cores/suporte/máquina próprios. O custo do item é a soma dos
 * planos (reconsolidação feita no backend a cada mutation).
 *
 * Rotas (prefixo /orcamento-grafico, via @/lib/api):
 *   POST   /:id/itens/:itemId/planos            → cria plano (201 + plano)
 *   PUT    /:id/itens/:itemId/planos/:planoId    → edita (mesmo body) + recálculo
 *   DELETE /:id/itens/:itemId/planos/:planoId    → remove
 *   POST   /:id/itens/:itemId/planos/:planoId/calcular → recalcula
 *
 * NÃO existe rota GET dedicada de planos e o GET /:id do orçamento ainda não
 * traz `itens[].planos`. Então a lista é mantida em estado local: hidratada do
 * campo `planosIniciais` (quando o backend passar a devolvê-lo no item) e
 * atualizada a partir do retorno de cada mutation. Após qualquer mutation o
 * componente chama `onChanged()` para a página recarregar o GET do orçamento
 * (totais do item/orçamento reconsolidados).
 */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import {
  Stack, Group, Button, Text, Table, Modal, TextInput, NumberInput, Select,
  Loader, ActionIcon, Tooltip, ScrollArea, Badge, Paper, SimpleGrid, Collapse, Alert,
} from '@mantine/core'
import {
  IconPlus, IconEdit, IconTrash, IconCalculator, IconArrowRight, IconHistory,
  IconChevronDown, IconChevronRight, IconX, IconAlertTriangle,
} from '@tabler/icons-react'
import { useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'
import { useCatalogoItem, type UseCatalogoItemResultado } from './editor/catalogo/useCatalogoItem'
import {
  aplicarDefaultsEmPlano, preMarcarAtividades, chaveSelecao, erroDaSelecao,
  type ErroSelecaoMaterial,
} from './editor/catalogo/catalogo-puro'
import SeletorMaterialAtividade from './editor/catalogo/SeletorMaterialAtividade'
import {
  deveExibirSeletorNoPlano, mesclarSelecoesPorPlano, type SelecaoDoPlano,
} from './editor/catalogo/selecoes-por-plano-puro'
import { executarPasse, type FalhaSelecao, type ItemDoPasse } from './editor/catalogo/passe-selecao-puro'
import type { SelecaoPendente } from './editor/catalogo/catalogo.types'
import {
  sugerirSuporteGramatura, sugerirPrecoKg, filtrarCandidatosPapel,
  type MotivoAvisoPreco, type PapelComPreco,
} from './editor/sugestoes'
import { selecaoMaterialApi, mensagemErroApi } from '../cadastros/_shared/cadastros-graficos.api'
import type { CatalogoPlano, SelecaoMaterial } from '../cadastros/_shared/cadastros-graficos.types'

// ============================================================================
// Tipos
// ============================================================================

export interface PlanoCalculo {
  id: string
  sequencia: number
  nome: string
  suporteId?: string | null
  suporteProducaoId?: string | null
  gramatura?: number | string | null
  formatoLarguraMm: number | string
  formatoAlturaMm: number | string
  numCores: number
  maquinaId?: string | null
  montagemLinhas?: number | string | null
  montagemColunas?: number | string | null
  custoSuporte?: number | string | null
  custoImpressao?: number | string | null
  custoAcabamento?: number | string | null
  /** Rótulo "X → Y" quando o suporte de produção difere do orçado (null = sem troca). */
  rotuloTrocaSuporte?: string | null
  /** Fase 2 — tipo de plano do catálogo (null/ausente = plano sem tipo, como antes). */
  tipoPlanoId?: string | null
  /** Atividades marcadas do plano (JSON do back). Só `acabamentoId` e `nome` são lidos aqui. */
  acabamentosRicos?: Array<{ acabamentoId?: string; nome?: string; [outros: string]: unknown }> | null
}

/** Registro do histórico de trocas de suporte (GET .../historico-troca-suporte). */
export interface TrocaSuporte {
  id: string
  itemId: string
  planoId?: string | null
  suporteAnteriorId?: string | null
  suporteNovoId?: string | null
  suporteAnteriorNome?: string | null
  suporteNovoNome?: string | null
  usuarioId?: string | null
  trocadoEm: string
}

interface Props {
  orcamentoId: string
  itemId: string
  /** Planos vindos do GET do orçamento (quando disponível). Semeia o estado. */
  planosIniciais?: PlanoCalculo[] | null
  /** Suporte de produção já definido no nível do item (quando sem planos). */
  suporteProducaoItemInicial?: string | null
  /** Rótulo de troca no nível do item ("X → Y") vindo do GET, quando houver. */
  rotuloTrocaItemInicial?: string | null
  /**
   * Fase 2 — Produto Gráfico do item. Sem ele o modal fica idêntico ao atual; com ele a
   * tarefa 4.9 liga o seletor de tipo de plano, os defaults e as atividades do catálogo.
   */
  produtoGraficoId?: string | null
  /**
   * Fase 3 — catálogo já carregado pelo editor (uma instância de `useCatalogoItem` por sessão).
   * Sem ele o componente cria o seu, como antes.
   */
  catalogoCompartilhado?: UseCatalogoItemResultado
  /** Item puxado do acervo: seleção de material é só informativa e não sugere suporte/preço. */
  itemPuxado?: boolean
  /** Edição permitida apenas em rascunho (mesma regra dos itens). */
  podeEditar: boolean
  /** Chamado após cada mutation para a página recarregar o orçamento. */
  onChanged: () => void
}

// Formulário do plano (campos do planoBodySchema do backend).
interface PlanoForm {
  nome: string
  suporteId: string | null
  gramatura: number | ''
  /** Fase 3 — preço do papel (R$/kg) do plano; vazio = usa o preço do item. */
  precoKg: number | ''
  formatoLarguraMm: number | ''
  formatoAlturaMm: number | ''
  numCores: number | ''
  maquinaId: string | null
  montagemLinhas: number | ''
  montagemColunas: number | ''
  /** Fase 2 — tipo de plano do catálogo (só usado quando há produto gráfico no item). */
  tipoPlanoId: string | null
  /** Atividades marcadas do plano: as pré-marcadas do tipo (plano novo) ou as já gravadas (edição). */
  atividadesPreMarcadas: { acabamentoId: string; nome: string }[]
}

const FORM_VAZIO: PlanoForm = {
  nome: '',
  suporteId: null,
  gramatura: '',
  precoKg: '',
  formatoLarguraMm: '',
  formatoAlturaMm: '',
  numCores: 4,
  maquinaId: null,
  montagemLinhas: '',
  montagemColunas: '',
  tipoPlanoId: null,
  atividadesPreMarcadas: [],
}

// ============================================================================
// Formatadores
// ============================================================================

function toNum(val: number | string | null | undefined): number {
  if (val == null) return 0
  const n = typeof val === 'string' ? parseFloat(val) : val
  return isNaN(n) ? 0 : n
}

function formatCurrency(val: number | string | null | undefined): string {
  const num = toNum(val)
  return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Custo total do plano = suporte + impressão + acabamento. */
function custoTotalPlano(p: PlanoCalculo): number {
  return toNum(p.custoSuporte) + toNum(p.custoImpressao) + toNum(p.custoAcabamento)
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR')
}

// ============================================================================
// Componente
// ============================================================================

/** Id provisório do plano ainda não salvo (chave das escolhas de material pendentes). */
const PLANO_TEMP = '__plano-novo__'

export default function PlanosDoItem({ orcamentoId, itemId, planosIniciais, suporteProducaoItemInicial, rotuloTrocaItemInicial, produtoGraficoId, catalogoCompartilhado, itemPuxado, podeEditar, onChanged }: Props) {
  const [planos, setPlanos] = useState<PlanoCalculo[]>(planosIniciais ?? [])

  // ----- Fase 2/3: catálogo do Produto Gráfico (sem produto = nenhuma chamada, modal como antes) -----
  // Com `catalogoCompartilhado` o componente não cria consulta própria (o hook recebe null).
  const catalogoProprio = useCatalogoItem(catalogoCompartilhado ? null : produtoGraficoId)
  const catalogoItem = catalogoCompartilhado ?? catalogoProprio

  // ----- Fase 3: escolha de material por atividade dentro do modal de plano -----
  /** Catálogo do tipo de plano mostrado no modal (null = ainda não carregado ou falhou). */
  const [catalogoPlanoAtual, setCatalogoPlanoAtual] = useState<CatalogoPlano | null>(null)
  const [falhaCatalogoPlano, setFalhaCatalogoPlano] = useState(false)
  const catalogoPlanoTokenRef = useRef(0)
  /** Escolhas do modal ainda não gravadas (chave `acabamentoId|planoId`; plano novo usa PLANO_TEMP). */
  const [escolhas, setEscolhas] = useState<SelecaoDoPlano[]>([])
  /** Seleções já gravadas do plano em edição. */
  const [gravadasPlano, setGravadasPlano] = useState<SelecaoMaterial[]>([])
  /** Atividades cujo material o usuário limpou (a remoção roda ao salvar o plano). */
  const [materiaisLimpos, setMateriaisLimpos] = useState<string[]>([])
  const [falhasSel, setFalhasSel] = useState<FalhaSelecao[]>([])
  const [errosSel, setErrosSel] = useState<Record<string, ErroSelecaoMaterial>>({})
  /** Atividade marcada foi removida num plano existente: o PUT precisa reenviar a lista. */
  const marcadasAlteradasRef = useRef(false)
  /** O plano mudou no servidor e a página ainda não recarregou (adiado enquanto o modal fica aberto). */
  const recarregarAoFecharRef = useRef(false)

  // ----- Fase 3: preço do papel sugerido pelo suporte + gramatura -----
  const [avisoPreco, setAvisoPreco] = useState<MotivoAvisoPreco | 'FALHA' | null>(null)
  const papeisPorSuporteRef = useRef<Map<string, PapelComPreco[]>>(new Map())
  const autoPrecoRef = useRef<number | null>(null)
  const precoTokenRef = useRef(0)
  const tiposDoCatalogo = catalogoItem.catalogo?.produto.planos ?? []
  const usaTipoPlano = !!produtoGraficoId && tiposDoCatalogo.length > 0
  /** Campos que o usuário mexeu no modal: defaults do tipo nunca os sobrescrevem. */
  const camposTocados = useRef<Set<string>>(new Set())
  /** Valores aplicados automaticamente pelo tipo anterior (trocar de tipo os substitui). */
  const autoAplicados = useRef<Partial<Record<'nome' | 'suporteId' | 'gramatura', unknown>>>({})
  const tipoEscolhidoRef = useRef<string | null>(null)
  const [carregandoTipo, setCarregandoTipo] = useState(false)
  /** Suportes permitidos pelo tipo escolhido (vazio = sem restrição). */
  const [suportesDoTipo, setSuportesDoTipo] = useState<{ value: string; label: string }[]>([])

  // Re-semeia quando o pai recarrega e passa novos planos (ex.: após onChanged).
  useEffect(() => {
    if (planosIniciais) setPlanos(planosIniciais)
  }, [planosIniciais])

  // ----- Suporte de produção: lista completa de suportes (sempre carregada) -----
  // Diferente da busca server-side do modal, aqui precisamos da lista disponível
  // para os Selects inline de cada linha (plano e nível de item), fora do modal.
  const [suportesProducao, setSuportesProducao] = useState<{ value: string; label: string }[]>([])
  const [trocandoSuporte, setTrocandoSuporte] = useState<string | null>(null)

  useEffect(() => {
    api.get('/orcamento-grafico/suportes', { params: { limit: 200 } })
      .then(({ data }) => {
        const items = (Array.isArray(data) ? data : data.data || []).map((s: any) => ({
          value: s.id,
          label: s.descricao || s.codigo || s.id,
        }))
        setSuportesProducao(items)
      })
      .catch(() => setSuportesProducao([]))
  }, [])

  // ----- Suporte de produção no nível do ITEM (quando não há planos) -----
  const [suporteProducaoItem, setSuporteProducaoItem] = useState<string | null>(suporteProducaoItemInicial ?? null)
  const [rotuloTrocaItem, setRotuloTrocaItem] = useState<string | null>(rotuloTrocaItemInicial ?? null)
  const [trocandoItem, setTrocandoItem] = useState(false)

  // Re-semeia o suporte/rótulo do item quando o pai recarrega.
  useEffect(() => {
    setSuporteProducaoItem(suporteProducaoItemInicial ?? null)
    setRotuloTrocaItem(rotuloTrocaItemInicial ?? null)
  }, [suporteProducaoItemInicial, rotuloTrocaItemInicial])

  // ----- Histórico de trocas de suporte (accordion por item) -----
  const [historicoAberto, setHistoricoAberto] = useState(false)
  const [historico, setHistorico] = useState<TrocaSuporte[]>([])
  const [historicoCarregado, setHistoricoCarregado] = useState(false)
  const [loadingHistorico, setLoadingHistorico] = useState(false)

  // Modal de form (novo/editar)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<PlanoCalculo | null>(null)
  const [form, setForm] = useState<PlanoForm>(FORM_VAZIO)
  const formRef = useRef<PlanoForm>(form)
  formRef.current = form
  const [salvando, setSalvando] = useState(false)

  // Remoção / recálculo
  const [planoParaRemover, setPlanoParaRemover] = useState<PlanoCalculo | null>(null)
  const [removendo, setRemovendo] = useState(false)
  const [recalculandoId, setRecalculandoId] = useState<string | null>(null)

  // ----- Fontes de dados dos Selects (suportes + máquinas de impressão) -----
  const [suportes, setSuportes] = useState<{ value: string; label: string }[]>([])
  const [termoSuporte, setTermoSuporte] = useState('')
  const [debouncedSuporte] = useDebouncedValue(termoSuporte, 300)
  const [loadingSuportes, setLoadingSuportes] = useState(false)

  const [maquinas, setMaquinas] = useState<{ value: string; label: string }[]>([])

  // Busca de suportes server-side (mesmo padrão do StepPapel).
  useEffect(() => {
    if (!modalAberto) return
    const termo = debouncedSuporte.trim()
    setLoadingSuportes(true)
    api.get('/orcamento-grafico/suportes', {
      params: { limit: 50, ...(termo.length >= 2 ? { busca: termo } : {}) },
    })
      .then(({ data }) => {
        const items = (Array.isArray(data) ? data : data.data || []).map((s: any) => ({
          value: s.id,
          label: s.descricao,
        }))
        setSuportes(items)
      })
      .catch(() => setSuportes([]))
      .finally(() => setLoadingSuportes(false))
  }, [debouncedSuporte, modalAberto])

  // Máquinas de impressão (centros de produção do tipo IMPRESSAO) — igual StepRevisao.
  useEffect(() => {
    if (!modalAberto) return
    api.get('/centros-producao', { params: { limit: 100 } })
      .then(({ data }) => {
        const items = (data.data || data || [])
          .filter((c: any) => c?.tipoProcesso?.codigo === 'IMPRESSAO' || /impress/i.test(c?.tipoProcesso?.descricao || ''))
          .map((c: any) => ({ value: c.id, label: `${c.codigo} - ${c.descricao}` }))
        setMaquinas(items)
      })
      .catch(() => setMaquinas([]))
  }, [modalAberto])

  // Nome amigável do suporte para a coluna da tabela.
  const nomeSuporte = useCallback((id?: string | null): string => {
    if (!id) return '—'
    return suportes.find(s => s.value === id)?.label ?? '—'
  }, [suportes])

  // ----- Fase 3: estado das escolhas de material do modal -----
  const zerarSelecoesDoModal = () => {
    catalogoPlanoTokenRef.current += 1
    precoTokenRef.current += 1
    setCatalogoPlanoAtual(null)
    setFalhaCatalogoPlano(false)
    setEscolhas([])
    setGravadasPlano([])
    setMateriaisLimpos([])
    setFalhasSel([])
    setErrosSel({})
    setAvisoPreco(null)
    autoPrecoRef.current = null
    marcadasAlteradasRef.current = false
  }

  /** Consulta o catálogo do tipo (cache do editor) e guarda para os seletores do modal. */
  const carregarCatalogoDoPlano = async (tipoId: string | null) => {
    const token = ++catalogoPlanoTokenRef.current
    setFalhaCatalogoPlano(false)
    if (!tipoId || !produtoGraficoId) {
      setCatalogoPlanoAtual(null)
      return null
    }
    const encontrado = await catalogoItem.carregarPlano(tipoId)
    if (token !== catalogoPlanoTokenRef.current) return null
    setCatalogoPlanoAtual(encontrado)
    setFalhaCatalogoPlano(!encontrado)
    return encontrado
  }

  /** Relê as seleções gravadas do item e guarda as do plano informado. */
  const recarregarGravadas = async (planoId: string) => {
    try {
      const lista = await selecaoMaterialApi.listar(itemId)
      setGravadasPlano((Array.isArray(lista) ? lista : []).filter(s => s.planoId === planoId))
    } catch {
      // Sem a lista o seletor só perde o resumo de custo; não bloqueia o modal.
    }
  }

  const fecharModal = () => {
    setModalAberto(false)
    if (recarregarAoFecharRef.current) {
      recarregarAoFecharRef.current = false
      onChanged()
    }
  }

  // ----- Abertura do form -----
  const abrirNovo = () => {
    camposTocados.current = new Set()
    autoAplicados.current = {}
    tipoEscolhidoRef.current = null
    zerarSelecoesDoModal()
    setSuportesDoTipo([])
    setEditando(null)
    setForm(FORM_VAZIO)
    setTermoSuporte('')
    setModalAberto(true)
  }

  const abrirEdicao = (p: PlanoCalculo) => {
    // Plano existente: trocar o tipo nunca altera valores já gravados.
    camposTocados.current = new Set(['nome', 'numCores', 'suporteId', 'gramatura', 'precoKg', 'atividadesPreMarcadas'])
    autoAplicados.current = {}
    tipoEscolhidoRef.current = null
    zerarSelecoesDoModal()
    setSuportesDoTipo([])
    setEditando(p)
    const marcadas = (p.acabamentosRicos ?? [])
      .filter((a): a is { acabamentoId: string; nome?: string } => typeof a?.acabamentoId === 'string')
      .map(a => ({ acabamentoId: a.acabamentoId, nome: a.nome ?? 'Atividade' }))
    if (produtoGraficoId && p.tipoPlanoId) {
      void carregarCatalogoDoPlano(p.tipoPlanoId)
      void recarregarGravadas(p.id)
    }
    setForm({
      nome: p.nome,
      suporteId: p.suporteId ?? null,
      gramatura: p.gramatura != null ? toNum(p.gramatura) : '',
      precoKg: '',
      formatoLarguraMm: toNum(p.formatoLarguraMm),
      formatoAlturaMm: toNum(p.formatoAlturaMm),
      numCores: p.numCores,
      maquinaId: p.maquinaId ?? null,
      montagemLinhas: p.montagemLinhas != null ? toNum(p.montagemLinhas) : '',
      montagemColunas: p.montagemColunas != null ? toNum(p.montagemColunas) : '',
      tipoPlanoId: p.tipoPlanoId ?? null,
      atividadesPreMarcadas: produtoGraficoId ? marcadas : [],
    })
    // Garante que o suporte selecionado apareça como option mesmo sem busca.
    if (p.suporteId) {
      setSuportes(prev => prev.some(s => s.value === p.suporteId)
        ? prev
        : [{ value: p.suporteId!, label: p.nome }, ...prev])
    }
    setTermoSuporte('')
    setModalAberto(true)
  }

  // ----- Fase 2: campos tocados e escolha do tipo de plano -----
  const marcarTocado = (campo: string) => {
    camposTocados.current.add(campo)
  }

  const escolherTipo = async (tipoId: string | null) => {
    tipoEscolhidoRef.current = tipoId
    setForm(f => ({ ...f, tipoPlanoId: tipoId }))
    // Outro tipo, outras atividades: as escolhas de material do tipo anterior não valem mais.
    setEscolhas([])
    setFalhasSel([])
    setErrosSel({})
    setCatalogoPlanoAtual(null)
    setFalhaCatalogoPlano(false)
    if (!tipoId) {
      catalogoPlanoTokenRef.current += 1
      setSuportesDoTipo([])
      return
    }
    setCarregandoTipo(true)
    const catalogoPlano = await catalogoItem.carregarPlano(tipoId)
    // O usuário trocou de tipo enquanto consultava: descarta a resposta antiga.
    if (tipoEscolhidoRef.current !== tipoId) return
    setCarregandoTipo(false)
    catalogoPlanoTokenRef.current += 1
    setCatalogoPlanoAtual(catalogoPlano)
    setFalhaCatalogoPlano(!catalogoPlano)
    if (!catalogoPlano) {
      setSuportesDoTipo([])
      notifications.show({
        title: 'Catálogo indisponível',
        message: 'Não foi possível carregar os padrões deste tipo de plano. Preencha os campos manualmente.',
        color: 'yellow',
      })
      return
    }

    // Suportes permitidos: ids da relação PLANO→SUPORTE são os mesmos do seletor (suporte_grafico).
    // Lista vazia no catálogo = sem restrição.
    setSuportesDoTipo(catalogoPlano.suportes.map(s => ({ value: s.id, label: s.descricao })))

    const tocados = camposTocados.current
    const auto = autoAplicados.current
    const f = formRef.current
    {
      // Valores que o tipo anterior preencheu (e o usuário não tocou) são liberados antes de aplicar o novo.
      const base: PlanoForm = { ...f }
      if (!tocados.has('nome') && auto.nome !== undefined && base.nome === auto.nome) base.nome = ''
      if (!tocados.has('suporteId') && auto.suporteId !== undefined && base.suporteId === auto.suporteId) base.suporteId = null
      if (!tocados.has('gramatura') && auto.gramatura !== undefined && base.gramatura === auto.gramatura) base.gramatura = ''

      // Nome e nº de cores seguem o default do tipo; suporte e gramatura passam por
      // `sugerirSuporteGramatura` (Req 4.3 e 4.7), por isso entram como "tocados" aqui.
      const tocadosSemSugestao = new Set<string>(Array.from(tocados))
      tocadosSemSugestao.add('suporteId')
      tocadosSemSugestao.add('gramatura')
      const aplicado = aplicarDefaultsEmPlano(
        {
          nome: base.nome,
          numCores: base.numCores === '' ? null : base.numCores,
          suporteId: base.suporteId,
          gramatura: base.gramatura === '' ? null : base.gramatura,
        },
        catalogoPlano.plano,
        catalogoPlano.defaultProduto,
        tocadosSemSugestao,
      )
      const proximo: PlanoForm = {
        ...base,
        nome: aplicado.nome ?? '',
        numCores: aplicado.numCores ?? '',
        suporteId: aplicado.suporteId ?? null,
        gramatura: aplicado.gramatura == null || aplicado.gramatura === '' ? '' : Number(aplicado.gramatura),
      }
      // Suporte e gramatura padrão do tipo: só campos vazios, nunca em item puxado.
      const sugerido = sugerirSuporteGramatura({
        itemNovo: true,
        itemPuxado: !!itemPuxado,
        itemSalvo: false,
        planoFixo: {
          suportePadraoId: catalogoPlano.plano.suportePadraoId ?? null,
          gramaturaPadrao: catalogoPlano.plano.gramaturaPadrao != null ? Number(catalogoPlano.plano.gramaturaPadrao) : null,
        },
        suporteAtual: proximo.suporteId,
        gramaturaAtual: proximo.gramatura === '' ? null : Number(proximo.gramatura),
      })
      if (!tocados.has('suporteId') && sugerido.suporteId !== undefined) proximo.suporteId = sugerido.suporteId
      if (!tocados.has('gramatura') && sugerido.gramatura !== undefined) proximo.gramatura = sugerido.gramatura
      if (!tocados.has('nome') && proximo.nome !== base.nome) auto.nome = proximo.nome
      if (!tocados.has('suporteId') && proximo.suporteId !== base.suporteId) auto.suporteId = proximo.suporteId
      if (!tocados.has('gramatura') && proximo.gramatura !== base.gramatura) auto.gramatura = proximo.gramatura

      // Atividades do tipo pré-marcadas (só plano novo; se o usuário já removeu alguma, não repõe).
      if (!editando && !tocados.has('atividadesPreMarcadas')) {
        const ids = catalogoPlano.atividades.filter(a => a.preMarcada).map(a => a.id)
        proximo.atividadesPreMarcadas = preMarcarAtividades([], ids, catalogoPlano.atividades)
          .map(a => ({ acabamentoId: a.id, nome: a.nome }))
      }
      setForm({ ...proximo, tipoPlanoId: tipoId })
    }
  }

  // Opções do seletor de suporte: restritas ao tipo (quando ele define suportes), sempre com o valor atual.
  const restringeSuporte = suportesDoTipo.length > 0
  const opcoesSuporte = useMemo(() => {
    const base = restringeSuporte ? suportesDoTipo : suportes
    if (form.suporteId && !base.some(s => s.value === form.suporteId)) {
      const rotulo = suportesProducao.find(s => s.value === form.suporteId)?.label
        ?? suportes.find(s => s.value === form.suporteId)?.label
        ?? 'Suporte selecionado'
      return [{ value: form.suporteId, label: rotulo }, ...base]
    }
    return base
  }, [restringeSuporte, suportesDoTipo, suportes, suportesProducao, form.suporteId])

  // ----- Fase 3: preço por kg do papel a partir de suporte + gramatura (Req 4.4, 4.5, 4.10) -----
  const [gramaturaDebounced] = useDebouncedValue(form.gramatura, 500)

  useEffect(() => {
    if (!modalAberto || !produtoGraficoId || editando) return
    const suporteId = form.suporteId
    const gramatura = gramaturaDebounced === '' ? null : Number(gramaturaDebounced)
    const atual = formRef.current.precoKg
    const veioDaSugestao = autoPrecoRef.current !== null && atual === autoPrecoRef.current
    if (camposTocados.current.has('precoKg')) return
    const token = ++precoTokenRef.current

    const limparSugestaoAntiga = () => {
      if (veioDaSugestao) {
        autoPrecoRef.current = null
        setForm(f => (f.precoKg === atual ? { ...f, precoKg: '' } : f))
      }
    }
    if (!suporteId || !(Number(gramatura) > 0)) {
      setAvisoPreco(null)
      limparSugestaoAntiga()
      return
    }

    ;(async () => {
      let papeis = papeisPorSuporteRef.current.get(suporteId)
      if (!papeis) {
        try {
          const coletados: PapelComPreco[] = []
          for (let pagina = 1; pagina <= 5; pagina += 1) {
            const { data } = await api.get('/orcamento-grafico/precos-mp', {
              params: { tipo: 'PAPEL', suporteId, comPreco: 'true', limit: 100, page: pagina },
            })
            const lista: any[] = Array.isArray(data) ? data : data?.data || []
            coletados.push(...lista.map((m: any) => ({
              id: m.id,
              suporteId: m.suporteId ?? suporteId,
              gramatura: m.gramatura,
              precoUnitario: m.precoUnitario,
            })))
            if (Array.isArray(data) || pagina >= (data?.totalPages ?? 1)) break
          }
          papeis = coletados
          papeisPorSuporteRef.current.set(suporteId, papeis)
        } catch {
          if (token !== precoTokenRef.current) return
          limparSugestaoAntiga()
          setAvisoPreco('FALHA')
          return
        }
      }
      if (token !== precoTokenRef.current) return

      const precoVazio = !(Number(atual) > 0) || veioDaSugestao
      const sugestao = sugerirPrecoKg({
        itemNovo: true,
        itemPuxado: !!itemPuxado,
        itemSalvo: false,
        suporteId,
        gramatura,
        precoKgAtual: precoVazio ? null : Number(atual),
        candidatos: filtrarCandidatosPapel(papeis, suporteId, gramatura),
      })
      if (sugestao.acao === 'APLICAR') {
        autoPrecoRef.current = sugestao.precoKg
        setAvisoPreco(null)
        setForm(f => (f.precoKg === atual ? { ...f, precoKg: sugestao.precoKg } : f))
      } else if (sugestao.acao === 'AVISO') {
        limparSugestaoAntiga()
        setAvisoPreco(sugestao.motivo)
      } else {
        setAvisoPreco(null)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modalAberto, produtoGraficoId, editando, form.suporteId, gramaturaDebounced, itemPuxado])

  const textoAvisoPreco =
    avisoPreco === 'SEM_PAPEL' ? 'Preço do papel não encontrado no cadastro para este suporte e gramatura. Informe o valor.'
    : avisoPreco === 'MAIS_DE_UM' ? 'Mais de um papel encontrado para este suporte e gramatura. Informe o preço.'
    : avisoPreco === 'FALHA' ? 'Não foi possível consultar o cadastro de preços de papel. Informe o preço manualmente.'
    : null

  // ----- Fase 3: seletores de material por atividade marcada -----
  const tipoDoModal = form.tipoPlanoId
  const ehPlanoFixo = !!tipoDoModal && tipoDoModal === catalogoItem.catalogo?.planoFixoId
  const planoChave = editando?.id ?? PLANO_TEMP
  const atividadesComSeletor = useMemo(() => {
    if (!produtoGraficoId || !catalogoPlanoAtual || catalogoItem.erro) return []
    return form.atividadesPreMarcadas
      .map(m => ({ marcada: m, atividade: catalogoPlanoAtual.atividades.find(a => a.id === m.acabamentoId) }))
      .filter(x => !!x.atividade && deveExibirSeletorNoPlano({
        temProduto: !!produtoGraficoId,
        atividadeMarcada: true,
        materiais: x.atividade!.materiais,
        planoFixo: ehPlanoFixo,
      }))
  }, [produtoGraficoId, catalogoPlanoAtual, catalogoItem.erro, form.atividadesPreMarcadas, ehPlanoFixo])

  const puxado = itemPuxado ?? gravadasPlano.some(s => s.aplicaNoPreco === false)

  const nomeDaAtividade = (acabamentoId: string): string =>
    form.atividadesPreMarcadas.find(a => a.acabamentoId === acabamentoId)?.nome
    ?? catalogoPlanoAtual?.atividades.find(a => a.id === acabamentoId)?.nome
    ?? 'Atividade sem nome'

  const esquecerFalha = (chave: string) => {
    setFalhasSel(prev => prev.filter(f => f.chave !== chave))
    setErrosSel(prev => {
      if (!(chave in prev)) return prev
      const { [chave]: _descartado, ...resto } = prev
      return resto
    })
  }

  const escolherMaterial = (acabamentoId: string, escolha: Omit<SelecaoPendente, 'acabamentoId'>) => {
    setEscolhas(prev => mesclarSelecoesPorPlano(prev, {
      tipo: 'escolher',
      selecao: { ...escolha, acabamentoId, planoId: planoChave, materialId: escolha.materialId },
    }))
    setMateriaisLimpos(prev => prev.filter(id => id !== acabamentoId))
    esquecerFalha(chaveSelecao(acabamentoId, planoChave))
  }

  const limparMaterial = (acabamentoId: string) => {
    setEscolhas(prev => mesclarSelecoesPorPlano(prev, { tipo: 'remover', acabamentoId, planoId: planoChave }))
    if (gravadasPlano.some(s => s.acabamentoId === acabamentoId)) {
      setMateriaisLimpos(prev => (prev.includes(acabamentoId) ? prev : [...prev, acabamentoId]))
    }
    esquecerFalha(chaveSelecao(acabamentoId, planoChave))
  }

  const desmarcarAtividade = (acabamentoId: string) => {
    marcarTocado('atividadesPreMarcadas')
    if (editando) marcadasAlteradasRef.current = true
    setForm(f => ({
      ...f,
      atividadesPreMarcadas: f.atividadesPreMarcadas.filter(x => x.acabamentoId !== acabamentoId),
    }))
    setEscolhas(prev => mesclarSelecoesPorPlano(prev, { tipo: 'desmarcar', acabamentoId, planoId: planoChave }))
    esquecerFalha(chaveSelecao(acabamentoId, planoChave))
  }

  // ----- Montagem do payload (planoBodySchema) -----
  function montarPayload(): Record<string, unknown> | null {
    if (!form.nome.trim()) {
      notifications.show({ title: 'Validação', message: 'Informe o nome do plano.', color: 'red' })
      return null
    }
    if (!form.formatoLarguraMm || !form.formatoAlturaMm) {
      notifications.show({ title: 'Validação', message: 'Informe a largura e a altura do formato (mm).', color: 'red' })
      return null
    }
    if (usaTipoPlano && !editando && !form.tipoPlanoId) {
      notifications.show({ title: 'Validação', message: 'Selecione o tipo de plano.', color: 'red' })
      return null
    }
    return {
      // Fase 2: só viaja com produto + catálogo com tipos; sem eles o payload é o de sempre.
      ...(usaTipoPlano ? { tipoPlanoId: form.tipoPlanoId } : {}),
      // Atividades pré-marcadas do tipo: só em plano novo.
      ...(usaTipoPlano && !editando && form.atividadesPreMarcadas.length > 0
        ? { acabamentosRicos: form.atividadesPreMarcadas }
        : {}),
      // Plano existente: só reenvia a lista quando o usuário desmarcou alguma atividade
      // (reaproveita as linhas gravadas, sem inventar campos).
      ...(usaTipoPlano && editando && marcadasAlteradasRef.current
        ? {
            acabamentosRicos: (editando.acabamentosRicos ?? []).filter(
              a => typeof a?.acabamentoId === 'string'
                && form.atividadesPreMarcadas.some(m => m.acabamentoId === a.acabamentoId),
            ),
          }
        : {}),
      nome: form.nome.trim(),
      suporteId: form.suporteId || undefined,
      gramatura: form.gramatura !== '' && Number(form.gramatura) > 0 ? Number(form.gramatura) : undefined,
      precoKgPapel: form.precoKg !== '' && Number(form.precoKg) > 0 ? Number(form.precoKg) : undefined,
      formatoLarguraMm: Number(form.formatoLarguraMm),
      formatoAlturaMm: Number(form.formatoAlturaMm),
      numCores: form.numCores === '' ? 0 : Number(form.numCores),
      maquinaId: form.maquinaId || undefined,
      montagemLinhas: form.montagemLinhas !== '' ? Number(form.montagemLinhas) : undefined,
      montagemColunas: form.montagemColunas !== '' ? Number(form.montagemColunas) : undefined,
    }
  }

  // ----- Salvar (POST ou PUT) -----
  const salvar = async () => {
    const payload = montarPayload()
    if (!payload) return
    setSalvando(true)
    let planoSalvo: PlanoCalculo
    try {
      if (editando) {
        const { data } = await api.put(
          `/orcamento-grafico/${orcamentoId}/itens/${itemId}/planos/${editando.id}`,
          payload,
        )
        planoSalvo = data
        setPlanos(prev => prev.map(p => (p.id === editando.id ? data : p)))
        notifications.show({ title: 'Plano atualizado', message: 'Plano recalculado e item reconsolidado.', color: 'green' })
      } else {
        const { data } = await api.post(
          `/orcamento-grafico/${orcamentoId}/itens/${itemId}/planos`,
          payload,
        )
        planoSalvo = data
        setPlanos(prev => [...prev, data])
        // Daqui em diante o modal edita este plano: "Salvar"/"Tentar novamente" faz PUT e nunca cria outro.
        setEditando(data)
        notifications.show({ title: 'Plano criado', message: 'Plano calculado e item reconsolidado.', color: 'green' })
      }
    } catch (err: any) {
      notifications.show({
        title: 'Erro ao salvar plano',
        message: err?.response?.data?.message || 'Falha ao salvar o plano.',
        color: 'red',
      })
      setSalvando(false)
      return
    }

    // ----- Fase 3: grava as escolhas de material do plano após o sucesso do POST/PUT -----
    try {
      const planoId = planoSalvo.id
      const marcadasIds = new Set(form.atividadesPreMarcadas.map(a => a.acabamentoId))
      // Escolhas feitas com o plano ainda sem id passam a apontar para o id definitivo.
      let aGravar = mesclarSelecoesPorPlano(escolhas, { tipo: 'salvarPlano', planoIdTemporario: PLANO_TEMP, planoId })
      aGravar = aGravar.filter(e => marcadasIds.has(e.acabamentoId) && e.planoId === planoId)
      const comEscolha = new Set(aGravar.map(e => e.acabamentoId))
      const aRemover = gravadasPlano.filter(
        s => !comEscolha.has(s.acabamentoId) && (!marcadasIds.has(s.acabamentoId) || materiaisLimpos.includes(s.acabamentoId)),
      )

      if (produtoGraficoId && (aGravar.length > 0 || aRemover.length > 0)) {
        const errosDoPasse: Record<string, ErroSelecaoMaterial> = {}
        const rejeitadas = new Set<string>()
        const guardarErro = (chave: string, err: unknown) => {
          errosDoPasse[chave] = erroDaSelecao(err, mensagemErroApi(err, 'Não foi possível gravar a escolha de material.'))
          if ((err as { response?: { status?: number } })?.response?.status === 422) rejeitadas.add(chave)
        }
        const itens: ItemDoPasse[] = [
          ...aRemover.map((s): ItemDoPasse => {
            const chave = chaveSelecao(s.acabamentoId, planoId)
            return {
              chave,
              atividadeNome: nomeDaAtividade(s.acabamentoId),
              executar: async (signal) => {
                try { await selecaoMaterialApi.remover(itemId, s.acabamentoId, planoId, signal) } catch (err) { guardarErro(chave, err); throw err }
              },
            }
          }),
          ...aGravar.map((e): ItemDoPasse => {
            const chave = chaveSelecao(e.acabamentoId, planoId)
            return {
              chave,
              atividadeNome: nomeDaAtividade(e.acabamentoId),
              executar: async (signal) => {
                try {
                  await selecaoMaterialApi.salvar({
                    itemId,
                    planoId,
                    acabamentoId: e.acabamentoId,
                    materialId: e.materialId,
                    restricaoId: (e.restricaoId as string | null | undefined) ?? null,
                    tipoParam: e.tipoParam as number | undefined,
                    param1: (e.param1 as number | null | undefined) ?? null,
                    param2: (e.param2 as number | null | undefined) ?? null,
                    gramaturaKgM2: (e.gramaturaKgM2 as number | null | undefined) ?? null,
                    pecasPorCaixa: (e.pecasPorCaixa as number | null | undefined) ?? null,
                  }, signal)
                } catch (err) { guardarErro(chave, err); throw err }
              },
            }
          }),
        ]
        const resultado = await executarPasse(itens, {
          mensagemDoErro: (err) => mensagemErroApi(err, 'Não foi possível gravar a escolha de material.'),
        })
        await recarregarGravadas(planoId)
        setMateriaisLimpos([])

        if (resultado.falhas.length > 0) {
          const falhas = resultado.falhas.map(f => {
            const permitidos = errosDoPasse[f.chave]?.permitidos ?? []
            return permitidos.length > 0 ? { ...f, mensagem: `${f.mensagem} Permitidos: ${permitidos.join(', ')}.` } : f
          })
          const chavesComFalha = new Set(falhas.map(f => f.chave))
          setFalhasSel(falhas)
          setErrosSel(errosDoPasse)
          // Escolhas gravadas saem do rascunho; as que falharam ficam para a nova tentativa.
          // Em 422 a escolha rejeitada é descartada e a seleção anterior permanece.
          setEscolhas(
            aGravar.filter(e => {
              const chave = chaveSelecao(e.acabamentoId, planoId)
              return chavesComFalha.has(chave) && !rejeitadas.has(chave)
            }),
          )
          recarregarAoFecharRef.current = true
          notifications.show({
            title: 'Plano salvo, escolhas de material pendentes',
            message: `${falhas.length === 1 ? '1 escolha de material não foi gravada' : `${falhas.length} escolhas de material não foram gravadas`}. Veja o aviso no modal.`,
            color: 'yellow',
          })
          setSalvando(false)
          return
        }
        setEscolhas([])
      }
      setFalhasSel([])
      setErrosSel({})
      recarregarAoFecharRef.current = false
      setModalAberto(false)
      onChanged()
    } finally {
      setSalvando(false)
    }
  }

  // ----- Remover (DELETE) -----
  const confirmarRemocao = async () => {
    if (!planoParaRemover) return
    setRemovendo(true)
    try {
      await api.delete(`/orcamento-grafico/${orcamentoId}/itens/${itemId}/planos/${planoParaRemover.id}`)
      setPlanos(prev => prev.filter(p => p.id !== planoParaRemover.id))
      notifications.show({ title: 'Plano removido', message: 'Item reconsolidado.', color: 'orange' })
      setPlanoParaRemover(null)
      onChanged()
    } catch (err: any) {
      notifications.show({
        title: 'Erro ao remover',
        message: err?.response?.data?.message || 'Falha ao remover o plano.',
        color: 'red',
      })
    } finally {
      setRemovendo(false)
    }
  }

  // ----- Recalcular (POST .../calcular) -----
  const recalcular = async (p: PlanoCalculo) => {
    setRecalculandoId(p.id)
    try {
      const payload = {
        nome: p.nome,
        suporteId: p.suporteId || undefined,
        gramatura: p.gramatura != null && toNum(p.gramatura) > 0 ? toNum(p.gramatura) : undefined,
        formatoLarguraMm: toNum(p.formatoLarguraMm),
        formatoAlturaMm: toNum(p.formatoAlturaMm),
        numCores: p.numCores,
        maquinaId: p.maquinaId || undefined,
        montagemLinhas: p.montagemLinhas != null ? toNum(p.montagemLinhas) : undefined,
        montagemColunas: p.montagemColunas != null ? toNum(p.montagemColunas) : undefined,
      }
      const { data } = await api.post(
        `/orcamento-grafico/${orcamentoId}/itens/${itemId}/planos/${p.id}/calcular`,
        payload,
      )
      const planoAtualizado: PlanoCalculo = data?.plano ?? data
      setPlanos(prev => prev.map(x => (x.id === p.id ? { ...x, ...planoAtualizado } : x)))
      notifications.show({ title: 'Plano recalculado', message: 'Item reconsolidado.', color: 'green' })
      onChanged()
    } catch (err: any) {
      notifications.show({
        title: 'Erro ao recalcular',
        message: err?.response?.data?.message || 'Falha ao recalcular o plano.',
        color: 'red',
      })
    } finally {
      setRecalculandoId(null)
    }
  }

  // ----- Trocar suporte de produção de um PLANO -----
  const trocarSuportePlano = async (plano: PlanoCalculo, suporteProducaoId: string | null) => {
    if (!suporteProducaoId) return
    setTrocandoSuporte(plano.id)
    try {
      const { data } = await api.patch(
        `/orcamento-grafico/${orcamentoId}/itens/${itemId}/planos/${plano.id}/suporte-producao`,
        { suporteProducaoId },
      )
      setPlanos(prev => prev.map(p => (p.id === plano.id
        ? { ...p, suporteProducaoId: data?.suporteNovoId ?? suporteProducaoId, rotuloTrocaSuporte: data?.rotuloTrocaSuporte ?? null }
        : p)))
      // Nova troca registrada → invalida histórico para recarregar ao abrir.
      setHistoricoCarregado(false)
      notifications.show({
        title: 'Suporte de produção atualizado',
        message: data?.rotuloTrocaSuporte
          ? `Troca registrada: ${data.rotuloTrocaSuporte}`
          : 'Suporte de produção igual ao orçado.',
        color: 'green',
      })
    } catch (err: any) {
      notifications.show({
        title: 'Erro ao trocar suporte',
        message: err?.response?.data?.message || 'Falha ao atualizar o suporte de produção.',
        color: 'red',
      })
    } finally {
      setTrocandoSuporte(null)
    }
  }

  // ----- Trocar suporte de produção no nível do ITEM (sem planos) -----
  const trocarSuporteItem = async (suporteProducaoId: string | null) => {
    if (!suporteProducaoId) return
    setTrocandoItem(true)
    try {
      const { data } = await api.patch(
        `/orcamento-grafico/${orcamentoId}/itens/${itemId}/suporte-producao`,
        { suporteProducaoId },
      )
      setSuporteProducaoItem(data?.suporteNovoId ?? suporteProducaoId)
      setRotuloTrocaItem(data?.rotuloTrocaSuporte ?? null)
      setHistoricoCarregado(false)
      notifications.show({
        title: 'Suporte de produção atualizado',
        message: data?.rotuloTrocaSuporte
          ? `Troca registrada: ${data.rotuloTrocaSuporte}`
          : 'Suporte de produção igual ao orçado.',
        color: 'green',
      })
    } catch (err: any) {
      notifications.show({
        title: 'Erro ao trocar suporte',
        message: err?.response?.data?.message || 'Falha ao atualizar o suporte de produção.',
        color: 'red',
      })
    } finally {
      setTrocandoItem(false)
    }
  }

  // ----- Histórico de trocas de suporte (carrega ao abrir) -----
  const toggleHistorico = async () => {
    const abrindo = !historicoAberto
    setHistoricoAberto(abrindo)
    if (abrindo && !historicoCarregado) {
      setLoadingHistorico(true)
      try {
        const { data } = await api.get(
          `/orcamento-grafico/${orcamentoId}/itens/${itemId}/historico-troca-suporte`,
        )
        setHistorico(Array.isArray(data) ? data : data?.data || [])
        setHistoricoCarregado(true)
      } catch (err: any) {
        notifications.show({
          title: 'Erro ao carregar histórico',
          message: err?.response?.data?.message || 'Falha ao buscar o histórico de trocas.',
          color: 'red',
        })
        setHistorico([])
      } finally {
        setLoadingHistorico(false)
      }
    }
  }

  const totalPlanos = planos.reduce((s, p) => s + custoTotalPlano(p), 0)
  const planosOrdenados = [...planos].sort((a, b) => a.sequencia - b.sequencia)

  return (
    <Stack gap="xs">
      <Group justify="space-between">
        <Text fw={600} size="sm">Planos do Cálculo</Text>
        {podeEditar && (
          <Button size="xs" variant="light" leftSection={<IconPlus size={14} />} onClick={abrirNovo}>
            Novo plano
          </Button>
        )}
      </Group>

      <ScrollArea>
        <Table striped highlightOnHover withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={50}>Seq.</Table.Th>
              <Table.Th>Nome</Table.Th>
              <Table.Th>Suporte orçado</Table.Th>
              <Table.Th w={260}>Suporte de produção</Table.Th>
              <Table.Th>Formato (L×A)</Table.Th>
              <Table.Th ta="center">Cores</Table.Th>
              <Table.Th ta="right">Custo do plano</Table.Th>
              <Table.Th w={120} ta="center">Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {planosOrdenados.map((p) => (
              <Table.Tr key={p.id}>
                <Table.Td fw={600}>{p.sequencia}</Table.Td>
                <Table.Td>{p.nome}</Table.Td>
                <Table.Td>
                  <Text size="sm" c={p.suporteId ? undefined : 'dimmed'}>{nomeSuporte(p.suporteId)}</Text>
                </Table.Td>
                <Table.Td>
                  <Stack gap={4}>
                    <Select
                      size="xs"
                      placeholder="Selecione o suporte"
                      data={suportesProducao}
                      value={p.suporteProducaoId ?? p.suporteId ?? null}
                      onChange={(v) => trocarSuportePlano(p, v)}
                      disabled={!podeEditar || trocandoSuporte === p.id}
                      rightSection={trocandoSuporte === p.id ? <Loader size={12} /> : undefined}
                      searchable
                      comboboxProps={{ withinPortal: true }}
                    />
                    {p.rotuloTrocaSuporte && (
                      <Badge
                        color="orange"
                        variant="light"
                        size="sm"
                        leftSection={<IconArrowRight size={11} />}
                      >
                        Suporte alterado na produção: {p.rotuloTrocaSuporte}
                      </Badge>
                    )}
                  </Stack>
                </Table.Td>
                <Table.Td>
                  {toNum(p.formatoLarguraMm).toLocaleString('pt-BR')} × {toNum(p.formatoAlturaMm).toLocaleString('pt-BR')} mm
                </Table.Td>
                <Table.Td ta="center">
                  <Badge variant="light" color="blue">{p.numCores}</Badge>
                </Table.Td>
                <Table.Td ta="right" fw={600}>{formatCurrency(custoTotalPlano(p))}</Table.Td>
                <Table.Td>
                  <Group gap={4} justify="center">
                    <Tooltip label="Recalcular plano">
                      <ActionIcon
                        variant="subtle"
                        color="teal"
                        loading={recalculandoId === p.id}
                        onClick={() => recalcular(p)}
                      >
                        <IconCalculator size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label={podeEditar ? 'Editar plano' : 'Edição só em rascunho'}>
                      <ActionIcon variant="subtle" color="blue" onClick={() => abrirEdicao(p)} disabled={!podeEditar}>
                        <IconEdit size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label={podeEditar ? 'Remover plano' : 'Remoção só em rascunho'}>
                      <ActionIcon
                        variant="subtle"
                        color="red"
                        onClick={() => setPlanoParaRemover(p)}
                        disabled={!podeEditar}
                      >
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {planosOrdenados.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={8}>
                  <Text ta="center" c="dimmed" py="sm" size="sm">
                    Nenhum plano neste item.{podeEditar ? ' Use "Novo plano" para adicionar.' : ''}
                  </Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
          {planosOrdenados.length > 0 && (
            <Table.Tfoot>
              <Table.Tr>
                <Table.Td colSpan={6} ta="right" fw={700}>Total dos planos</Table.Td>
                <Table.Td ta="right" fw={700} c="red">{formatCurrency(totalPlanos)}</Table.Td>
                <Table.Td />
              </Table.Tr>
            </Table.Tfoot>
          )}
        </Table>
      </ScrollArea>

      {/* =================================================================== */}
      {/* Suporte de produção no NÍVEL DO ITEM (quando o item não tem planos)  */}
      {/* =================================================================== */}
      {planosOrdenados.length === 0 && (
        <Paper p="sm" withBorder radius="sm">
          <Group gap="sm" align="flex-end" wrap="wrap">
            <Select
              label="Suporte de produção (item)"
              description="Suporte efetivamente usado na produção deste item"
              placeholder="Selecione o suporte"
              data={suportesProducao}
              value={suporteProducaoItem}
              onChange={trocarSuporteItem}
              disabled={!podeEditar || trocandoItem}
              rightSection={trocandoItem ? <Loader size={12} /> : undefined}
              searchable
              comboboxProps={{ withinPortal: true }}
              w={300}
            />
            {rotuloTrocaItem && (
              <Badge
                color="orange"
                variant="light"
                size="lg"
                leftSection={<IconArrowRight size={13} />}
              >
                Suporte alterado na produção: {rotuloTrocaItem}
              </Badge>
            )}
          </Group>
        </Paper>
      )}

      {/* =================================================================== */}
      {/* Histórico de trocas de suporte (sempre visível, carrega ao abrir)    */}
      {/* =================================================================== */}
      <Paper withBorder radius="sm">
        <Group
          justify="space-between"
          p="xs"
          style={{ cursor: 'pointer' }}
          onClick={toggleHistorico}
        >
          <Group gap={6}>
            <IconHistory size={16} />
            <Text size="sm" fw={600}>Histórico de trocas de suporte</Text>
          </Group>
          {historicoAberto ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
        </Group>
        <Collapse in={historicoAberto}>
          <div style={{ padding: 'var(--mantine-spacing-xs)' }}>
            {loadingHistorico ? (
              <Group justify="center" py="sm"><Loader size="sm" /></Group>
            ) : historico.length === 0 ? (
              <Text ta="center" c="dimmed" py="sm" size="sm">Nenhuma troca registrada</Text>
            ) : (
              <ScrollArea>
                <Table striped withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Data</Table.Th>
                      <Table.Th>Suporte anterior</Table.Th>
                      <Table.Th>Suporte novo</Table.Th>
                      <Table.Th>Usuário</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {historico.map((h) => (
                      <Table.Tr key={h.id}>
                        <Table.Td>{formatDateTime(h.trocadoEm)}</Table.Td>
                        <Table.Td>
                          <Text size="sm" c={h.suporteAnteriorNome ? undefined : 'dimmed'}>
                            {h.suporteAnteriorNome || '—'}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4} wrap="nowrap">
                            <IconArrowRight size={13} />
                            <Text size="sm">{h.suporteNovoNome || '—'}</Text>
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c={h.usuarioId ? undefined : 'dimmed'}>{h.usuarioId || '—'}</Text>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            )}
          </div>
        </Collapse>
      </Paper>

      {/* Modal de form (novo/editar plano) */}
      <Modal
        opened={modalAberto}
        onClose={fecharModal}
        title={editando ? `Editar Plano #${editando.sequencia}` : 'Novo Plano'}
        size="lg"
        centered
      >
        <Stack gap="md">
          {usaTipoPlano && (
            <Select
              label="Tipo de plano"
              placeholder="Selecione o tipo de plano"
              description={editando ? undefined : 'Preenche os padrões do tipo nos campos que você ainda não alterou.'}
              data={tiposDoCatalogo.map(t => ({ value: t.id, label: t.nome }))}
              value={form.tipoPlanoId}
              onChange={escolherTipo}
              required={!editando}
              clearable={!!editando}
              searchable
              rightSection={carregandoTipo ? <Loader size={14} /> : undefined}
              comboboxProps={{ withinPortal: true }}
            />
          )}
          {!!produtoGraficoId && catalogoItem.carregando && (
            <Group gap="xs"><Loader size={12} /><Text size="xs" c="dimmed">Carregando tipos de plano do produto...</Text></Group>
          )}
          {!!produtoGraficoId && !catalogoItem.carregando && catalogoItem.erro && (
            <Text size="xs" c="dimmed">{catalogoItem.erro} Preencha os campos manualmente.</Text>
          )}

          <TextInput
            label="Nome do plano"
            placeholder="Ex.: TAMPA, CAIXA, FRENTE"
            value={form.nome}
            onChange={(e) => { marcarTocado('nome'); setForm(f => ({ ...f, nome: e.currentTarget.value })) }}
            required
            maxLength={60}
          />

          {usaTipoPlano && form.atividadesPreMarcadas.length > 0 && (
            <Stack gap={4}>
              <Text size="sm" fw={500}>
                {editando ? 'Atividades do plano' : 'Atividades do tipo (pré-marcadas)'}
              </Text>
              <Group gap={6}>
                {form.atividadesPreMarcadas.map(a => (
                  <Badge
                    key={a.acabamentoId}
                    variant="light"
                    rightSection={
                      <ActionIcon
                        size="xs"
                        variant="transparent"
                        aria-label={`Remover ${a.nome}`}
                        disabled={salvando}
                        onClick={() => desmarcarAtividade(a.acabamentoId)}
                      >
                        <IconX size={10} />
                      </ActionIcon>
                    }
                  >
                    {a.nome}
                  </Badge>
                ))}
              </Group>
            </Stack>
          )}

          {!!produtoGraficoId && !catalogoItem.erro && falhaCatalogoPlano && (
            <Text size="xs" c="dimmed">
              Não foi possível carregar os materiais permitidos deste plano. As escolhas de material ficam
              indisponíveis; o restante do plano continua normal.
            </Text>
          )}

          {atividadesComSeletor.length > 0 && (
            <Stack gap="xs">
              <Text size="sm" fw={500}>Material das atividades</Text>
              {atividadesComSeletor.map(({ marcada, atividade }) => {
                const chave = chaveSelecao(marcada.acabamentoId, planoChave)
                const rascunho = escolhas.find(e => chaveSelecao(e.acabamentoId, e.planoId) === chave)
                const gravada = gravadasPlano.find(s => s.acabamentoId === marcada.acabamentoId)
                const naoGravada = falhasSel.some(f => f.chave === chave)
                return (
                  <Paper key={marcada.acabamentoId} p="xs" withBorder radius="sm">
                    <Stack gap={4}>
                      <Group gap="xs">
                        <Text size="sm" fw={600}>{marcada.nome}</Text>
                        {naoGravada && <Badge size="xs" color="red" variant="light">não gravada</Badge>}
                        {gravada && !rascunho && !naoGravada && <Badge size="xs" color="green" variant="light">gravada</Badge>}
                        {rascunho && !naoGravada && <Badge size="xs" color="gray" variant="light">pendente</Badge>}
                      </Group>
                      <SeletorMaterialAtividade
                        atividade={atividade!}
                        selecao={rascunho ? undefined : gravada}
                        pendente={rascunho as unknown as SelecaoPendente | undefined}
                        rotuloPendente="Será gravado ao salvar o plano"
                        erro={errosSel[chave] ?? null}
                        itemPuxado={puxado}
                        ocupado={false}
                        disabled={salvando}
                        onEscolher={(escolha) => escolherMaterial(marcada.acabamentoId, escolha)}
                        onLimpar={() => limparMaterial(marcada.acabamentoId)}
                      />
                    </Stack>
                  </Paper>
                )
              })}
            </Stack>
          )}

          {falhasSel.length > 0 && (
            <Alert
              color="red"
              variant="light"
              icon={<IconAlertTriangle size={16} />}
              title={falhasSel.length === 1
                ? 'O plano foi salvo, mas 1 escolha de material não foi gravada'
                : `O plano foi salvo, mas ${falhasSel.length} escolhas de material não foram gravadas`}
            >
              <Stack gap={4}>
                {falhasSel.map(f => (
                  <Text key={f.chave} size="xs">
                    <b>{f.atividadeNome}</b>: {f.mensagem}
                  </Text>
                ))}
                <Text size="xs" c="dimmed">Use "Tentar novamente" para reenviar sem criar outro plano.</Text>
              </Stack>
            </Alert>
          )}

          <Select
            label="Suporte (Papel/Cartão)"
            placeholder="Digite para buscar (ex.: Duplex 280)"
            data={opcoesSuporte}
            value={form.suporteId}
            onChange={(v) => { marcarTocado('suporteId'); setForm(f => ({ ...f, suporteId: v })) }}
            searchable
            searchValue={termoSuporte}
            onSearchChange={setTermoSuporte}
            filter={restringeSuporte ? undefined : ({ options }) => options}
            rightSection={loadingSuportes ? <Loader size={14} /> : null}
            nothingFoundMessage={
              restringeSuporte ? 'Nenhum suporte do tipo encontrado' :
              loadingSuportes ? 'Buscando...' :
              termoSuporte.trim().length < 2 ? 'Digite ao menos 2 letras' :
              'Nenhum suporte encontrado'
            }
            comboboxProps={{ withinPortal: true }}
            clearable
          />

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <NumberInput
              label="Formato largura"
              placeholder="mm"
              suffix=" mm"
              value={form.formatoLarguraMm}
              onChange={(v) => setForm(f => ({ ...f, formatoLarguraMm: typeof v === 'number' ? v : '' }))}
              min={0}
              required
            />
            <NumberInput
              label="Formato altura"
              placeholder="mm"
              suffix=" mm"
              value={form.formatoAlturaMm}
              onChange={(v) => setForm(f => ({ ...f, formatoAlturaMm: typeof v === 'number' ? v : '' }))}
              min={0}
              required
            />
            <NumberInput
              label="Nº de cores"
              value={form.numCores}
              onChange={(v) => { marcarTocado('numCores'); setForm(f => ({ ...f, numCores: typeof v === 'number' ? v : '' })) }}
              min={0}
              max={12}
            />
          </SimpleGrid>

          <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
            <NumberInput
              label="Gramatura"
              description="Opcional (g/m²)"
              placeholder="Ex.: 300"
              suffix=" g/m²"
              value={form.gramatura}
              onChange={(v) => { marcarTocado('gramatura'); setForm(f => ({ ...f, gramatura: typeof v === 'number' ? v : '' })) }}
              min={0}
              max={2000}
            />
            {!!produtoGraficoId && (
              <NumberInput
                label="Preço do papel"
                description={textoAvisoPreco ?? 'Opcional (R$/kg). Vazio usa o preço do item.'}
                placeholder="R$/kg"
                prefix="R$ "
                suffix="/kg"
                decimalScale={4}
                value={form.precoKg}
                onChange={(v) => { marcarTocado('precoKg'); setForm(f => ({ ...f, precoKg: typeof v === 'number' ? v : '' })) }}
                min={0}
                styles={textoAvisoPreco ? { description: { color: 'var(--mantine-color-yellow-light-color)' } } : undefined}
              />
            )}
            <NumberInput
              label="Montagem (linhas)"
              placeholder="Opcional"
              value={form.montagemLinhas}
              onChange={(v) => setForm(f => ({ ...f, montagemLinhas: typeof v === 'number' ? v : '' }))}
              min={1}
            />
            <NumberInput
              label="Montagem (colunas)"
              placeholder="Opcional"
              value={form.montagemColunas}
              onChange={(v) => setForm(f => ({ ...f, montagemColunas: typeof v === 'number' ? v : '' }))}
              min={1}
            />
          </SimpleGrid>

          <Select
            label="Máquina de impressão"
            placeholder="Opcional — padrão do item"
            data={maquinas}
            value={form.maquinaId}
            onChange={(v) => setForm(f => ({ ...f, maquinaId: v }))}
            searchable
            clearable
            comboboxProps={{ withinPortal: true }}
          />

          {editando && (
            <Paper p="xs" withBorder bg="var(--mantine-color-gray-light)">
              <Group gap="lg">
                <Text size="xs" c="dimmed">Suporte: {formatCurrency(editando.custoSuporte)}</Text>
                <Text size="xs" c="dimmed">Impressão: {formatCurrency(editando.custoImpressao)}</Text>
                <Text size="xs" c="dimmed">Acabamento: {formatCurrency(editando.custoAcabamento)}</Text>
                <Text size="xs" fw={600}>Total: {formatCurrency(custoTotalPlano(editando))}</Text>
              </Group>
            </Paper>
          )}

          <Group justify="flex-end">
            <Button variant="default" onClick={fecharModal} disabled={salvando}>
              {falhasSel.length > 0 ? 'Fechar' : 'Cancelar'}
            </Button>
            <Button onClick={salvar} loading={salvando}>
              {falhasSel.length > 0 ? 'Tentar novamente' : editando ? 'Salvar plano' : 'Adicionar plano'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Confirmação de remoção */}
      <Modal
        opened={!!planoParaRemover}
        onClose={() => setPlanoParaRemover(null)}
        title="Remover Plano"
        centered
      >
        <Stack gap="md">
          <Text size="sm">
            Remover o plano #{planoParaRemover?.sequencia} ({planoParaRemover?.nome})?
            O custo do item será reconsolidado.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setPlanoParaRemover(null)} disabled={removendo}>
              Cancelar
            </Button>
            <Button color="red" onClick={confirmarRemocao} loading={removendo}>
              Remover
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
