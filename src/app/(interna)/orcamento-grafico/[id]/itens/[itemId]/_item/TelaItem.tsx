'use client'

/**
 * TelaItem — nível 2 da hierarquia Orçamento → Item → Plano (Fase 2).
 *
 * Título "Item — {produto}", migalhas (Orçamento nº → Item) e os blocos montados pelo cadastro do
 * Produto Gráfico (`useLayoutItem`):
 *  - plano único: Produto (BlocoComum + BlocoFormato), Impressão e suporte (BlocoPlanoUnico),
 *    Acabamento do plano (BlocoAcabamento), Produto final (AcabamentosDeProduto,
 *    AcondicionamentoBloco, ComplementosDoItem, MargemDoItem), Estrutura de custo e o aviso de
 *    planos legados;
 *  - multi-plano: os mesmos sem os blocos do plano; no lugar deles, o Grid de Planos
 *    ("Tipos de Plano": incluir, copiar, excluir, reordenar, desfazer). Item novo: aviso para
 *    salvar antes.
 *
 * Gravação e cálculo seguem o editor atual, sem mudar o custo:
 *  - Salvar: `montarPayloadItem` (itemFormShared, sem alteração) + campos informativos por fora
 *    (`montarPayloadTelaItem`), PUT do item (POST no item novo). Plano único grava nas colunas
 *    achatadas; o payload nunca leva `planos`, então nenhum `PlanoCalculoGrafico` é criado.
 *  - Calcular: item salvo usa a rota ancorada `POST /:id/itens/:itemId/calcular` (a mesma do
 *    editor atual); item ainda não criado usa `POST /orcamento-grafico/calcular`, como o editor.
 *  - Erro de validação ou do servidor: nada é gravado e os valores digitados ficam na tela, com a
 *    mensagem "campo: motivo".
 *
 * `itemId = 'novo'`: item em branco. A Linha de Produto escolhida em "Incluir item" (`?linha=`,
 * prop `linhaProdutoIdNovo`) filtra o combobox de Produto, que já vem aberto, e dá o título da tela.
 * Escolhido o Produto, os blocos são montados pelo cadastro (`useLayoutItem`). O primeiro Salvar
 * cria o item (POST) e a tela passa para a URL do id criado.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Alert, Anchor, Breadcrumbs, Button, Center, Group, Loader, Modal, Paper, Skeleton, Stack, Table, Text, ThemeIcon, Title,
} from '@mantine/core'
import { IconAlertCircle, IconArrowLeft, IconCalculator, IconDeviceFloppy, IconInfoCircle, IconLayoutList, IconPlus, IconRuler } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'

import { api } from '@/lib/api'
import type { WizardFormData } from '../../../../novo/page'
import StepMedidas from '../../../../novo/StepMedidas'
import StepPapel, { aplicarSuporteNcCriado } from '../../../../novo/StepPapel'
import { INITIAL_ITEM } from '../../../itemFormShared'
import { useLayoutItem } from '../../../_hooks/useLayoutItem'
import { useTiposProduto } from '../../../_hooks/useOpcoesBlocoComum'
import { notificarAlteracaoItem } from '../../../_hooks/sinal-alteracao-item'
import { reaplicarLayoutAoTrocarProduto } from '../../../_layout/reaplicar-layout'
import PreviewFichaMaster from '../../../_orcamento/PreviewFichaMaster'
import { useCatalogoItem } from '../../../editor/catalogo/useCatalogoItem'
import { useSelecaoMaterial } from '../../../editor/catalogo/useSelecaoMaterial'
import PainelSelecoesNaoGravadas from '../../../editor/catalogo/PainelSelecoesNaoGravadas'
import type { ProdutoEscolhido } from '../../../editor/catalogo/SeletorProdutoGrafico'
import { deveAplicarDefaults, type NomesDefault } from '../../../editor/catalogo/catalogo-puro'
import { decidirModoSalvar, registrarItemCriado } from '../../../editor/modo-salvar-puro'
import { validarObrigatoriosParaSalvar } from '../../../editor/validacao-obrigatorios'
import { AVISO_LISTA_INCOMPLETA, useTodosAcabamentos } from '../../../editor/useTodosAcabamentos'
import { useCamposLivresSugestao } from '../../../editor/useCamposLivresSugestao'
import type { KpisCalculo } from '../../../editor/useCalculoAoVivo'
import { resolverPadroesIniciais } from '../../../_layout/resolver-layout-item'
import { itemParaEditar, type ItemParaEditarHierarquia } from '../itemParaEditar'
import AcabamentosDeProduto from './AcabamentosDeProduto'
import AcondicionamentoBloco from './AcondicionamentoBloco'
import AvisoPlanosLegados from './AvisoPlanosLegados'
import BlocoAcabamento from './BlocoAcabamento'
import BlocoComum from './BlocoComum'
import BlocoEstruturaCusto from './BlocoEstruturaCusto'
import BlocoFormato from './BlocoFormato'
import { MEDIDAS_DO_FORMATO, medidasDoFormato } from './formato-item'
import BlocoPlanoUnico from './BlocoPlanoUnico'
import GridPlanos from './GridPlanos'
import ComplementosDoItem, { type ValorComplementosItem } from './ComplementosDoItem'
import MargemDoItem from './MargemDoItem'
import { aplicarPreMarcadas, type AtividadeCadastro } from './acabamento-item'
import { numeroParaTexto, type ValorFormato } from './formato-item'
import { aplicarPadroesNoValor, leituraCalculada } from './plano-unico-item'
import {
  aplicarTipoDoProduto,
  estadoInicialTelaItem,
  formEfetivo,
  mensagemErroServidor,
  montarPayloadCalculoTelaItem,
  montarPayloadTelaItem,
  payloadVariosPlanos,
  semPapelEmVariosPlanos,
  textoErrosValidacao,
  validarTelaItem,
  type EstadoTelaItem,
} from './tela-item'
import { useGuardaSaida } from './useGuardaSaida'

export const ID_ITEM_NOVO = 'novo'

interface OrcamentoParaItem {
  id: string
  numero: number
  status: string
  produtoNome?: string | null
  observacoes?: string | null
  imagemFaca?: string | null
  imagemProdutoUrl?: string | null
  linhaProdutoId?: string | null
  tipoEmbalagem?: { codigo: string; descricao: string } | null
  itens?: Array<Record<string, any>> | null
}

export interface TelaItemProps {
  orcamentoId: string
  itemId: string
  /**
   * Item novo: Linha de Produto escolhida no diálogo "Incluir item" (`?linha=`). Filtra o combobox
   * de Produto (no lugar da linha do orçamento) e dá o título da tela. Ignorada em item existente.
   */
  linhaProdutoIdNovo?: string | null
}

function numero(v: unknown): number | null {
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function kpisDe(dados: Record<string, unknown> | null | undefined): KpisCalculo | null {
  if (!dados) return null
  return {
    custoTotal: numero(dados.custoProducao) ?? numero(dados.custoTotal),
    precoVenda: numero(dados.precoVenda),
    margem: numero(dados.margemReal),
    precoUnitario: numero(dados.precoUnitario),
  }
}

/** Composto do reaplicar (números) de volta para texto do formulário. */
function formatoComTexto(form: Record<string, unknown>, base: ValorFormato): ValorFormato {
  const saida = { ...base } as Record<string, unknown>
  for (const chave of Object.keys(base)) {
    const v = form[chave]
    if (v && typeof v === 'object') {
      const par = v as { largura?: unknown; altura?: unknown }
      saida[chave] = {
        largura: typeof par.largura === 'number' ? numeroParaTexto(par.largura) : String(par.largura ?? ''),
        altura: typeof par.altura === 'number' ? numeroParaTexto(par.altura) : String(par.altura ?? ''),
      }
    } else if (v !== undefined) {
      saida[chave] = typeof v === 'number' ? numeroParaTexto(v) : v
    }
  }
  return saida as ValorFormato
}

export default function TelaItem({ orcamentoId, itemId, linhaProdutoIdNovo = null }: TelaItemProps) {
  const routerInstavel = useRouter()
  // Referência estável: a identidade do router não pode refazer a carga do item.
  const routerRef = useRef(routerInstavel)
  routerRef.current = routerInstavel
  const router = useMemo(
    () => ({
      push: (url: string) => routerRef.current.push(url),
      replace: (url: string) => routerRef.current.replace(url),
    }),
    [],
  )
  const novo = itemId === ID_ITEM_NOVO
  const linhaNovo = novo ? linhaProdutoIdNovo : null

  // Nome da Linha de Produto do item novo (título da tela), pela mesma rota do diálogo de linha.
  const [linhaNovoNome, setLinhaNovoNome] = useState<string | null>(null)
  useEffect(() => {
    setLinhaNovoNome(null)
    if (!linhaNovo) return
    let cancelado = false
    api
      .get('/orcamento-grafico/linhas-produto')
      .then(({ data }) => {
        if (cancelado) return
        const lista: Array<{ id?: unknown; nome?: unknown }> = Array.isArray(data) ? data : data?.data ?? []
        const achada = lista.find((l) => String(l.id) === linhaNovo)
        setLinhaNovoNome(achada?.nome ? String(achada.nome) : null)
      })
      .catch(() => {
        // Sem o nome, o título fica o padrão do item novo.
      })
    return () => {
      cancelado = true
    }
  }, [linhaNovo])

  const [orcamento, setOrcamento] = useState<OrcamentoParaItem | null>(null)
  const [itemCarregado, setItemCarregado] = useState<ItemParaEditarHierarquia | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [inicial, setInicial] = useState<EstadoTelaItem | null>(null)
  const [estado, setEstado] = useState<EstadoTelaItem | null>(null)
  const [sujo, setSujo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [calculando, setCalculando] = useState(false)
  const [erroAcao, setErroAcao] = useState<string | null>(null)
  const [validarVazios, setValidarVazios] = useState(false)
  const [resultadoCalculado, setResultadoCalculado] = useState<Record<string, unknown> | null>(null)
  const [itemIdCriado, setItemIdCriado] = useState<string | null>(null)
  const [ocultosAposTroca, setOcultosAposTroca] = useState<string[]>([])
  const [processoPre, setProcessoPre] = useState<string | null>(null)
  const [tentandoNovamente, setTentandoNovamente] = useState(false)

  // ---------------------------------------------------------------------------
  // Carga: o item vem do GET /:id (mesma hidratação do editor atual).
  // ---------------------------------------------------------------------------

  const voltouRef = useRef(false)
  const voltarNaoEncontrado = useCallback(
    (destino: string) => {
      if (voltouRef.current) return
      voltouRef.current = true
      notifications.show({ title: 'Erro', message: 'Registro não encontrado.', color: 'red' })
      router.replace(destino)
    },
    [router],
  )

  const carregar = useCallback(async () => {
    try {
      const res = await api.get(`/orcamento-grafico/${orcamentoId}`)
      const dados = res.data as OrcamentoParaItem
      const bruto = novo ? null : (dados.itens ?? []).find((i) => i.id === itemId) ?? null
      if (!novo && !bruto) {
        voltarNaoEncontrado(`/orcamento-grafico/${orcamentoId}`)
        return
      }
      const item = bruto ? itemParaEditar(bruto, dados.tipoEmbalagem) : null
      const estadoInicial = estadoInicialTelaItem(item, {
        orcamentoId,
        observacoesOrcamento: dados.observacoes,
        imagemFacaOrcamento: dados.imagemFaca,
        imagemProdutoOrcamento: dados.imagemProdutoUrl,
      })
      setOrcamento(dados)
      setItemCarregado(item)
      setInicial(estadoInicial)
      setEstado(estadoInicial)
      setSujo(false)
      setResultadoCalculado(null)
      setOcultosAposTroca([])
    } catch (err: any) {
      if (err?.response?.status === 404) {
        voltarNaoEncontrado('/orcamento-grafico')
        return
      }
      notifications.show({ title: 'Erro ao carregar', message: mensagemErroServidor(err, 'Falha ao buscar o item'), color: 'red' })
    } finally {
      setCarregando(false)
    }
  }, [orcamentoId, itemId, novo, voltarNaoEncontrado])

  useEffect(() => {
    setCarregando(true)
    carregar()
  }, [carregar])

  // ---------------------------------------------------------------------------
  // Atualizações de estado (as do usuário marcam a tela como alterada).
  // ---------------------------------------------------------------------------

  const alterar = useCallback((mudar: (e: EstadoTelaItem) => EstadoTelaItem, doUsuario = true) => {
    setEstado((atual) => (atual ? mudar(atual) : atual))
    if (doUsuario) setSujo(true)
  }, [])

  const atualizarForm = useCallback(
    (parcial: Partial<WizardFormData>) => alterar((e) => ({ ...e, form: { ...e.form, ...parcial } })),
    [alterar],
  )
  // Mudanças feitas pela seleção de material (gravações e releituras do hook) não marcam a tela.
  const atualizarFormInterno = useCallback(
    (parcial: Partial<WizardFormData>) => alterar((e) => ({ ...e, form: { ...e.form, ...parcial } }), false),
    [alterar],
  )

  const form = estado?.form ?? null
  const produtoGraficoId = form?.produtoGraficoId ?? null

  // ---------------------------------------------------------------------------
  // Cadastro do produto: layout, catálogo, listas de apoio.
  // ---------------------------------------------------------------------------

  const layoutItem = useLayoutItem(produtoGraficoId)
  const layout = layoutItem.layout
  const catalogoItem = useCatalogoItem(produtoGraficoId)
  const catalogo = catalogoItem.catalogo

  const idItemAtual = decidirModoSalvar(itemCarregado?.id, itemIdCriado).itemId
  const selecao = useSelecaoMaterial({
    itemId: idItemAtual,
    itemPuxado: !!itemCarregado?.calculoGraficoOrigemId,
    formData: form ?? INITIAL_ITEM,
    updateForm: atualizarFormInterno,
    catalogo,
  })

  const idsAtividadesCatalogo = useMemo(
    () => [...(catalogo?.produto.atividades ?? []).map((a) => a.id), ...(catalogo?.produto.acondicionamento ?? []).map((a) => a.id)],
    [catalogo],
  )
  const todosAcabamentos = useTodosAcabamentos(idsAtividadesCatalogo)
  const avisoListaAcabamentos = todosAcabamentos.erro ? `${AVISO_LISTA_INCOMPLETA} ${todosAcabamentos.erro}` : null
  const camposLivresSugestao = useCamposLivresSugestao(form?.camposLivres)
  const tiposProduto = useTiposProduto()

  // Tipo de embalagem completo (com os parâmetros de medida) para o bloco de medidas de cálculo.
  // Não entra no payload (o payload só leva `tipoEmbalagemId`).
  const tipoEmbalagemIdEfetivo = estado?.comum.tipoEmbalagemId ?? null
  useEffect(() => {
    if (!tipoEmbalagemIdEfetivo) return
    const tipo = tiposProduto.tipos.find((t) => t.id === tipoEmbalagemIdEfetivo)
    if (!tipo) return
    setEstado((atual) => {
      if (!atual) return atual
      const corrente = atual.form.tipoEmbalagem as { id?: string; parametros?: unknown } | null
      if (corrente && corrente.id === tipo.id && Array.isArray(corrente.parametros)) return atual
      return { ...atual, form: { ...atual.form, tipoEmbalagem: tipo as any } }
    })
  }, [tipoEmbalagemIdEfetivo, tiposProduto.tipos])

  // Troca de produto: guarda o pedido e reaplica o layout quando o cadastro novo chegar.
  const trocaPendenteRef = useRef<string | null>(null)
  const trocarProduto = useCallback(
    (produto: ProdutoEscolhido | null) => {
      trocaPendenteRef.current = produto?.id ?? null
      setOcultosAposTroca([])
      if (produto) {
        atualizarForm({ produtoGraficoId: produto.id, _produtoGraficoNome: produto.nome, _catalogoAplicadoEm: null })
      } else {
        atualizarForm({
          produtoGraficoId: itemCarregado?.produtoGraficoId ? null : undefined,
          _produtoGraficoNome: null,
          _catalogoAplicadoEm: null,
        })
      }
    },
    [atualizarForm, itemCarregado?.produtoGraficoId],
  )

  useEffect(() => {
    if (!layout || !trocaPendenteRef.current || trocaPendenteRef.current !== produtoGraficoId) return
    trocaPendenteRef.current = null
    setEstado((atual) => {
      if (!atual) return atual
      const vocab: Record<string, unknown> = {
        ...atual.formato,
        cores: atual.planoUnico.cores,
        processoImpressao: atual.planoUnico.processoImpressao,
        coberturaTinta: atual.planoUnico.coberturaTintaTexto,
        fabricante: atual.planoUnico.fabricante,
        fornecido: atual.planoUnico.fornecido,
        microondulado: atual.planoUnico.microondulado,
        fibra: atual.planoUnico.fibra,
        ajusteCorteMicro: atual.planoUnico.ajusteCorteMicro,
      }
      const { form: novoVocab, ocultos } = reaplicarLayoutAoTrocarProduto(vocab, layout)
      setOcultosAposTroca(ocultos)
      return { ...atual, formato: formatoComTexto(novoVocab, atual.formato) }
    })
  }, [layout, produtoGraficoId])

  // Padrões do cadastro (item novo, uma vez por produto, só campos vazios): processo, cobertura,
  // fabricante e cores do plano implícito + atividades pré-marcadas.
  useEffect(() => {
    if (!catalogo || !form) return
    const produtoId = catalogo.produto.produto.id
    if (form.produtoGraficoId !== produtoId || form._catalogoAplicadoEm) return
    const padrao = catalogo.planoFixo?.defaultProduto ?? null
    const aplicar = deveAplicarDefaults({
      calculoGraficoOrigemId: itemCarregado?.calculoGraficoOrigemId ?? null,
      produtoGraficoIdSalvo: itemCarregado?.produtoGraficoId === produtoId ? produtoId : null,
    })
    let cancelado = false
    ;(async () => {
      const nomes: NomesDefault = {}
      if (padrao) {
        nomes.coberturaTinta = catalogo.planoFixo?.coberturas.find((c) => c.id === padrao.coberturaTintaId)?.nome ?? null
        if (padrao.processoImpressaoId) {
          try {
            const { data } = await api.get('/orcamento-grafico/processos-impressao', { params: { situacao: 'todas' } })
            const lista: Array<{ id: string; nome: string }> = Array.isArray(data) ? data : data?.data ?? []
            nomes.processoImpressao = lista.find((p) => p.id === padrao.processoImpressaoId)?.nome ?? null
          } catch {
            // Sem o nome do processo o campo fica como está.
          }
        }
      }
      if (cancelado) return
      setProcessoPre(nomes.processoImpressao ?? null)
      const padroes = resolverPadroesIniciais({ default: padrao, atividadesDoCatalogo: catalogo.planoFixo?.atividades ?? null })
      setEstado((atual) => {
        if (!atual || atual.form.produtoGraficoId !== produtoId || atual.form._catalogoAplicadoEm) return atual
        let proximo = atual
        if (aplicar && padrao) {
          proximo = { ...proximo, planoUnico: aplicarPadroesNoValor(proximo.planoUnico, padroes, nomes) }
          const cadastro = (catalogo.planoFixo?.atividades ?? []) as unknown as AtividadeCadastro[]
          const pre = aplicarPreMarcadas(proximo.form.acabamentosRicos, padroes.atividadesPreMarcadas, cadastro)
          if (pre.marcadas.length > 0) proximo = { ...proximo, form: { ...proximo.form, acabamentosRicos: pre.acabamentosRicos } }
        }
        // Tipo de Produto: o Calcgraf preenche o Tipo com o do produto escolhido. Só em item novo (mesma
        // regra dos padrões), só se estiver vazio, e nunca sobrescreve uma escolha do usuário.
        if (aplicar) {
          proximo = { ...proximo, comum: aplicarTipoDoProduto(proximo.comum, catalogo.produto.produto.tipoEmbalagemId) }
        }
        return { ...proximo, form: { ...proximo.form, _catalogoAplicadoEm: new Date().toISOString() } }
      })
    })()
    return () => {
      cancelado = true
    }
  }, [catalogo, form?.produtoGraficoId, form?._catalogoAplicadoEm, itemCarregado?.calculoGraficoOrigemId, itemCarregado?.produtoGraficoId])

  // ---------------------------------------------------------------------------
  // Derivados
  // ---------------------------------------------------------------------------

  const formFinal = useMemo(
    () => (estado && inicial ? formEfetivo(estado, inicial, layout) : null),
    [estado, inicial, layout],
  )

  const resultado = (resultadoCalculado ?? (itemCarregado?.resultadoCalculo as Record<string, unknown> | null) ?? null)
  const baseCusto = useMemo(() => {
    if (!resultado) return null
    const cp = Number(resultado.custoProducao)
    if (Number.isFinite(cp) && cp > 0) return cp
    const ct = Number(resultado.custoTotal)
    return Number.isFinite(ct) && ct > 0 ? ct : null
  }, [resultado])
  const cevPct = resultado && Number.isFinite(Number(resultado.cevPerc)) ? Number(resultado.cevPerc) : null
  const margemAtualPct = resultado && Number.isFinite(Number(resultado.margemReal)) ? Number(resultado.margemReal) : null
  const cmPerc =
    resultado && Number.isFinite(Number(resultado.contribuicaoMarginalPerc)) ? Number(resultado.contribuicaoMarginalPerc) : null

  const atividadesDoPlano = useMemo<AtividadeCadastro[]>(() => {
    const doPlano = catalogo?.planoFixo?.atividades ?? null
    const porId = new Map(todosAcabamentos.acabamentos.map((a) => [a.id, a]))
    if (doPlano && doPlano.length > 0) {
      return doPlano.map((a) => ({ ...(a as object), ...(porId.get(a.id) ?? {}) }) as unknown as AtividadeCadastro)
    }
    return todosAcabamentos.acabamentos as unknown as AtividadeCadastro[]
  }, [catalogo, todosAcabamentos.acabamentos])

  const produtoNome =
    layoutItem.produto?.produto.nome ||
    form?._produtoGraficoNome ||
    orcamento?.produtoNome ||
    orcamento?.tipoEmbalagem?.descricao ||
    null
  const titulo = novo && !itemIdCriado ? linhaNovoNome ?? 'Novo item' : `Item — ${produtoNome ?? '—'}`
  useEffect(() => {
    document.title = titulo
  }, [titulo])

  const guarda = useGuardaSaida(sujo, (destino) => router.push(destino))

  // ---------------------------------------------------------------------------
  // Ações
  // ---------------------------------------------------------------------------

  // O bloco Formato alimenta as medidas do cálculo (L/A/P): o usuário digita as medidas uma vez só.
  const formatoAtual = estado?.formato
  const parametrosTipo = form?.tipoEmbalagem?.parametros
  useEffect(() => {
    if (!formatoAtual || !parametrosTipo) return
    const novas = medidasDoFormato(formatoAtual, parametrosTipo.map((p: { nome: string }) => p.nome))
    const atual = (form?.medidas ?? {}) as Record<string, number>
    if (Object.entries(novas).some(([k, v]) => atual[k] !== v)) atualizarForm({ medidas: { ...atual, ...novas } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formatoAtual, parametrosTipo])
  const medidasExtras = (parametrosTipo ?? []).filter(
    (p: { nome: string }) => !MEDIDAS_DO_FORMATO.includes(p.nome.trim().toUpperCase()),
  ).length

  const validar = (): boolean => {
    if (!estado || !formFinal) return false
    setValidarVazios(true)
    const erros = validarTelaItem(estado, layout, { exigirFormato: !itemCarregado })
    if (erros.length > 0) {
      setErroAcao(textoErrosValidacao(erros))
      return false
    }
    // Vários planos sem papel no item: gramatura e preço do papel ficam em cada plano.
    const faltam = validarObrigatoriosParaSalvar(
      semPapelEmVariosPlanos(layout, formFinal) ? { ...formFinal, gramatura: 1, precoKg: 1 } : formFinal,
    )
    if (faltam.length > 0) {
      setErroAcao(`Faltam: ${faltam.join(', ')}.`)
      return false
    }
    setErroAcao(null)
    return true
  }

  const enviarItem = (formEnvio: WizardFormData, id: string | null) => {
    const base = montarPayloadTelaItem(estado as EstadoTelaItem, inicial as EstadoTelaItem, layout, formEnvio)
    const payload = semPapelEmVariosPlanos(layout, formEnvio) ? payloadVariosPlanos(base, formEnvio.produtoGraficoId) : base
    return id
      ? api.put(`/orcamento-grafico/${orcamentoId}/itens/${id}`, payload)
      : api.post(`/orcamento-grafico/${orcamentoId}/itens`, payload)
  }

  const concluirSalvar = async (criadoAgora: string | null, editando: boolean, destino?: (id: string) => string) => {
    notificarAlteracaoItem(orcamentoId)
    selecao.zerarSujo()
    setSujo(false)
    notifications.show(
      editando
        ? { title: 'Item atualizado', message: 'Item recalculado e salvo.', color: 'green' }
        : { title: 'Item adicionado', message: 'Novo item calculado e salvo.', color: 'green' },
    )
    if (criadoAgora) {
      router.replace(destino ? destino(criadoAgora) : `/orcamento-grafico/${orcamentoId}/itens/${criadoAgora}`)
      return
    }
    await carregar()
  }

  /** `destino`: para onde ir depois de criar o item (ex.: abrir a inclusão do 1º plano). */
  const salvar = async (destino?: (id: string) => string) => {
    if (!estado || !formFinal || salvando) return
    if (!validar()) return
    setSalvando(true)
    try {
      const modo = decidirModoSalvar(itemCarregado?.id, itemIdCriado)
      const resposta = await enviarItem(formFinal, modo.itemId)
      const idSalvo = modo.itemId ?? ((resposta?.data?.id as string | undefined) ?? null)
      const criadoAgora = !modo.itemId && idSalvo ? idSalvo : null
      if (criadoAgora) setItemIdCriado((atual) => registrarItemCriado(atual, criadoAgora))

      if (idSalvo && (formFinal._selecoesPendentes?.length ?? 0) > 0) {
        const passe = await selecao.aplicarPendentes(idSalvo, { timeoutMs: 30_000 })
        if (!passe.podeRecalcular) {
          const n = passe.resultado.falhas.length
          setErroAcao(`Item salvo, mas ${n} escolha${n > 1 ? 's' : ''} de material não ${n > 1 ? 'foram gravadas' : 'foi gravada'}. Use "Tentar novamente".`)
          return
        }
        if (passe.linhas) await enviarItem({ ...formFinal, materiaisAcabamento: passe.linhas }, idSalvo)
      }
      await concluirSalvar(criadoAgora, modo.isEditing, destino)
    } catch (err) {
      // Nada gravado do lado da tela: os valores digitados continuam como estão.
      setErroAcao(mensagemErroServidor(err, 'Não foi possível salvar o item.'))
      notifications.show({ title: 'Erro ao salvar item', message: mensagemErroServidor(err, 'Falha ao salvar o item do orçamento.'), color: 'red' })
    } finally {
      setSalvando(false)
    }
  }

  const tentarNovamentePasse = async () => {
    if (!idItemAtual || !formFinal) return
    setTentandoNovamente(true)
    try {
      const passe = await selecao.tentarNovamente(idItemAtual, { timeoutMs: 30_000 })
      if (!passe.podeRecalcular) return
      await enviarItem({ ...formFinal, materiaisAcabamento: passe.linhas ?? formFinal.materiaisAcabamento }, idItemAtual)
      setErroAcao(null)
      await concluirSalvar(null, true)
    } catch (err) {
      setErroAcao(mensagemErroServidor(err, 'Não foi possível salvar o item.'))
    } finally {
      setTentandoNovamente(false)
    }
  }

  const calcular = async () => {
    if (!formFinal || calculando) return
    if (!validar()) return
    setCalculando(true)
    try {
      // Item salvo: rota ancorada do item (a mesma do editor atual). Nunca a genérica.
      const rota = idItemAtual
        ? `/orcamento-grafico/${orcamentoId}/itens/${idItemAtual}/calcular`
        : '/orcamento-grafico/calcular'
      const variosPlanos = semPapelEmVariosPlanos(layout, formFinal)
      if (variosPlanos && !idItemAtual) {
        setErroAcao('Salve o item e inclua os planos para calcular.')
        return
      }
      const baseCalc = montarPayloadCalculoTelaItem(formFinal)
      const resp = await api.post(rota, variosPlanos ? payloadVariosPlanos(baseCalc, formFinal.produtoGraficoId) : baseCalc)
      setResultadoCalculado((resp.data?.resultado ?? resp.data) as Record<string, unknown>)
    } catch (err) {
      setErroAcao(mensagemErroServidor(err, 'Não foi possível calcular o item.'))
    } finally {
      setCalculando(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (carregando) {
    return (
      <Center py="xl">
        <Loader size="lg" />
      </Center>
    )
  }

  if (!orcamento || !estado || !form) {
    return (
      <Center py="xl">
        <Alert icon={<IconAlertCircle size={16} />} color="red" title="Item não encontrado">
          Não foi possível carregar o item solicitado.
        </Alert>
      </Center>
    )
  }

  const urlOrcamento = `/orcamento-grafico/${orcamentoId}`
  const podeEditar = orcamento.status === 'RASCUNHO'
  const estrutura = layout?.estrutura ?? null
  const ocupado = salvando || calculando
  const { montagem, formatoCorte } = leituraCalculada(formFinal ?? form)
  const kpis = kpisDe(resultado)
  const planosPersistidos = Array.isArray(itemCarregado?.planos) ? itemCarregado!.planos!.length : 0

  const valorComplementos: ValorComplementosItem = {
    ...estado.complementos,
    itensDiversos: form.itensDiversos,
    itensFornecidos: form.itensFornecidos,
    camposLivres: form.camposLivres,
  }

  const cabecalho = (
    <Stack gap="xs">
      <Breadcrumbs>
        <Anchor component={Link} href={urlOrcamento} size="sm">
          Orçamento nº {orcamento.numero}
        </Anchor>
        <Text size="sm">Item</Text>
      </Breadcrumbs>
      <Group justify="space-between" align="center" wrap="wrap" gap="sm">
        <Title order={3} data-testid="tela-item-titulo">
          {titulo}
        </Title>
        {podeEditar && (
          <Group gap="xs">
            <PreviewFichaMaster orcamentoId={orcamentoId} tamanhoBotao="sm" />
            <Button
              variant="light"
              size="sm"
              leftSection={<IconCalculator size={16} />}
              onClick={calcular}
              loading={calculando}
              disabled={ocupado && !calculando}
            >
              Calcular
            </Button>
            <Button
              size="sm"
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={() => void salvar()}
              loading={salvando}
              disabled={ocupado && !salvando}
            >
              Salvar
            </Button>
          </Group>
        )}
      </Group>
    </Stack>
  )

  if (!podeEditar) {
    return (
      <Stack gap="md">
        {cabecalho}
        <Alert color="orange" variant="light" icon={<IconAlertCircle size={16} />} title="Edição indisponível">
          <Stack gap="xs" align="flex-start">
            <Text size="sm">A edição de itens só é possível com o orçamento em rascunho.</Text>
            <Button size="xs" variant="default" leftSection={<IconArrowLeft size={14} />} onClick={() => router.push(urlOrcamento)}>
              Voltar ao orçamento
            </Button>
          </Stack>
        </Alert>
      </Stack>
    )
  }

  const blocosPlano =
    estrutura === 'PLANO_UNICO' && layout ? (
      <>
        <BlocoPlanoUnico
          value={estado.planoUnico}
          onChange={(p) => alterar((e) => ({ ...e, planoUnico: { ...e.planoUnico, ...p } }))}
          layout={layout}
          montagem={montagem}
          formatoCorte={formatoCorte}
          suporte={<StepPapel formData={form} updateForm={atualizarForm} />}
          processoPre={processoPre}
          orcamentoId={orcamentoId}
          onSuporteNcCriado={(r) => atualizarForm(aplicarSuporteNcCriado(r))}
          disabled={ocupado}
        />
        <BlocoAcabamento
          atividades={atividadesDoPlano}
          value={{ acabamentosRicos: form.acabamentosRicos }}
          onChange={(p) => atualizarForm(p)}
          layout={layout}
          catalogoDoPlano={catalogo?.planoFixo ?? null}
          selecao={selecao}
          carregandoLista={todosAcabamentos.carregando}
          avisoLista={avisoListaAcabamentos}
          onTentarNovamente={todosAcabamentos.tentarNovamente}
          disabled={ocupado}
        />
        <AvisoPlanosLegados estrutura="PLANO_UNICO" planosPersistidos={planosPersistidos} />
      </>
    ) : estrutura === 'MULTI_PLANO' ? (
      <Paper withBorder radius="md" p="lg" shadow="xs" data-testid="tipos-de-plano">
        {idItemAtual ? (
          <GridPlanos
            orcamentoId={orcamentoId}
            itemId={idItemAtual}
            navegar={guarda.navegar}
            onAlterado={() => notificarAlteracaoItem(orcamentoId)}
            disabled={ocupado}
          />
        ) : (
          <Stack gap="md">
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon variant="light" color="indigo" size={32} radius="md">
                <IconLayoutList size={18} stroke={1.5} />
              </ThemeIcon>
              <Title order={5}>Tipos de Plano</Title>
            </Group>
            <Table withTableBorder data-testid="tipos-de-plano-item-novo">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nome</Table.Th>
                  <Table.Th>Suporte</Table.Th>
                  <Table.Th>Cores</Table.Th>
                  <Table.Th>Formato</Table.Th>
                  <Table.Th>Acabamento</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text size="sm" c="dimmed" ta="center">Nenhum plano. Ao incluir o primeiro, o item é salvo.</Text>
                  </Table.Td>
                </Table.Tr>
              </Table.Tbody>
            </Table>
            <Group justify="flex-end">
              <Button
                size="xs"
                leftSection={<IconPlus size={14} />}
                loading={salvando}
                disabled={ocupado}
                onClick={() => void salvar((novoId) => `/orcamento-grafico/${orcamentoId}/itens/${novoId}/planos/novo`)}
              >
                Incluir plano
              </Button>
            </Group>
          </Stack>
        )}
      </Paper>
    ) : layoutItem.carregando ? (
      <Skeleton height={120} radius="md" />
    ) : !produtoGraficoId ? (
      // Item sem produto do cadastro (itens antigos e item novo antes da escolha): sem layout não
      // há como saber se é plano único; o papel do item continua editável como no editor atual.
      <Paper withBorder radius="md" p="lg" shadow="xs" data-testid="papel-sem-produto">
        <Stack gap="md">
          <Title order={5}>Papel / Cartão</Title>
          <StepPapel formData={form} updateForm={atualizarForm} />
        </Stack>
      </Paper>
    ) : null

  return (
    <Stack gap="md" data-testid="tela-item" data-estrutura={estrutura ?? 'SEM_LAYOUT'}>
      {cabecalho}

      {erroAcao && (
        <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />} title="Não foi possível concluir" data-testid="tela-item-erro">
          {erroAcao}
        </Alert>
      )}

      {ocultosAposTroca.length > 0 && (
        <Alert color="blue" variant="light" icon={<IconInfoCircle size={16} />} data-testid="tela-item-ocultos">
          O novo produto não usa alguns campos preenchidos. Eles ficam guardados na tela, mas não serão gravados.
        </Alert>
      )}

      {!produtoGraficoId && (
        <Alert color="yellow" variant="light" icon={<IconInfoCircle size={16} />} data-testid="tela-item-sem-produto">
          {novo
            ? 'Escolha o Produto; os campos do formato, do plano e dos acabamentos são montados pelo cadastro dele.'
            : 'Este item não tem produto do cadastro. Use "Trocar produto" para escolher; os campos do formato e do plano dependem dele.'}
        </Alert>
      )}

      <PainelSelecoesNaoGravadas
        falhas={selecao.falhasPasse}
        onTentarNovamente={tentarNovamentePasse}
        carregando={tentandoNovamente}
      />

      <BlocoComum
        value={estado.comum}
        onChange={(p) => alterar((e) => ({ ...e, comum: { ...e.comum, ...p } }))}
        produtoNome={produtoNome}
        trocaProduto={{
          produtoGraficoId: form.produtoGraficoId,
          linhaProdutoId: linhaNovo ?? orcamento.linhaProdutoId ?? null,
          catalogo: catalogoItem,
          onChange: trocarProduto,
          // Item novo: o combobox de Produto já vem aberto (é o primeiro passo do item em branco).
          abertoInicial: novo,
        }}
        validarVazios={validarVazios}
        disabled={ocupado}
      />

      <BlocoFormato
        layout={layout}
        value={estado.formato}
        onChange={(p) => alterar((e) => ({ ...e, formato: { ...e.formato, ...p } }))}
        validarVazios={validarVazios && !itemCarregado}
        disabled={ocupado}
        carregando={layoutItem.carregando}
        erroLayout={layoutItem.erro}
        onTentarNovamente={layoutItem.tentarNovamente}
      />

      {/* Comprimento/Largura/Altura vêm do bloco Formato; aqui só se o tipo pedir outras medidas. */}
      {(!form.tipoEmbalagem || medidasExtras > 0) && (
        <Paper withBorder radius="md" p="lg" shadow="xs" data-testid="medidas-calculo">
          <Stack gap="md">
            <Group gap="sm" wrap="nowrap">
              <ThemeIcon variant="light" color="teal" size={32} radius="md">
                <IconRuler size={18} stroke={1.5} />
              </ThemeIcon>
              <Title order={5}>Medidas de cálculo</Title>
            </Group>
            <StepMedidas formData={form} updateForm={atualizarForm} />
          </Stack>
        </Paper>
      )}

      {blocosPlano}

      <AcabamentosDeProduto
        value={form}
        onChange={atualizarForm}
        catalogo={catalogo}
        selecao={selecao}
        acabamentosExternos={todosAcabamentos.acabamentos}
        avisoLista={avisoListaAcabamentos}
        onTentarNovamente={todosAcabamentos.tentarNovamente}
        carregandoLista={todosAcabamentos.carregando}
      />

      <AcondicionamentoBloco
        value={estado.acondicionamento}
        onChange={(p) => alterar((e) => ({ ...e, acondicionamento: { ...e.acondicionamento, ...p } }))}
        opcoes={(catalogo?.produto.acondicionamento ?? []).map((a) => ({ id: a.id, nome: a.nome }))}
        carregando={catalogoItem.carregando}
        disabled={ocupado}
      />

      <ComplementosDoItem
        value={valorComplementos}
        onChange={(p) => {
          const { itensDiversos, itensFornecidos, camposLivres, ...textos } = p
          alterar((e) => ({
            ...e,
            complementos: { ...e.complementos, ...textos },
            form: {
              ...e.form,
              ...(itensDiversos !== undefined ? { itensDiversos } : {}),
              ...(itensFornecidos !== undefined ? { itensFornecidos } : {}),
              ...(camposLivres !== undefined ? { camposLivres } : {}),
            },
          }))
        }}
        layout={layout}
        catalogo={catalogo}
        sugestoesRotulos={camposLivresSugestao.rotulos}
        opcoesPorRotulo={camposLivresSugestao.opcoesPorRotulo}
        obrigatorios={camposLivresSugestao.obrigatorios}
        avisoCamposLivres={camposLivresSugestao.aviso}
        disabled={ocupado}
      />

      <MargemDoItem
        formData={formFinal ?? form}
        updateForm={atualizarForm}
        baseCusto={baseCusto}
        cevPct={cevPct}
        margemAtualPct={margemAtualPct}
        contribuicaoMarginalPerc={cmPerc}
      />

      <BlocoEstruturaCusto resultadoCalculo={resultado} kpis={kpis} calculando={calculando} />

      <Group justify="flex-start">
        <Button variant="default" leftSection={<IconArrowLeft size={14} />} onClick={() => guarda.navegar(urlOrcamento)}>
          Voltar ao orçamento
        </Button>
      </Group>

      <Modal
        opened={guarda.destinoPendente !== null}
        onClose={guarda.cancelar}
        title="Sair sem salvar?"
        centered
      >
        <Stack gap="md">
          <Text size="sm">Há alterações neste item que ainda não foram salvas. Se sair agora, elas serão perdidas.</Text>
          <Group justify="flex-end" gap="xs">
            <Button variant="default" onClick={guarda.cancelar}>
              Continuar editando
            </Button>
            <Button color="red" onClick={guarda.confirmar}>
              Sair sem salvar
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
