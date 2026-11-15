/**
 * catalogo-puro — funções PURAS (sem React, sem rede, sem banco) do catálogo no
 * editor do item. Fase 2 (spec orcamento-grafico-catalogo-no-editor).
 *
 * Regras centrais: defaults só em campo vazio (idempotente), atividades na ordem
 * do catálogo, linhas de seleção de material espelhando o back
 * (`refletirSelecoesNoJson`) e sugestão de itens diversos sem duplicar.
 */

import type {
  DefaultProdutoPlano,
  ItemDiversoGrafico,
  TipoPlanoGrafico,
} from '../../../cadastros/_shared/cadastros-graficos.types'
import type { MaterialAcabamentoItem } from '../../../novo/page'

// ============================================================================
// Utilitários
// ============================================================================

/** Normaliza texto: sem acento, minúsculo, espaços colapsados. */
export function normalizarTexto(s: string | null | undefined): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function vazio(v: unknown): boolean {
  return v === undefined || v === null || (typeof v === 'string' && v.trim() === '')
}

// ============================================================================
// 2.2 — Defaults só em campos vazios
// ============================================================================

/** Campos do item (plano fixo) que os defaults do produto podem preencher. */
export interface CamposDefaultItem {
  processoImpressao?: string | null
  coberturaTintaTexto?: string | null
  fabricante?: string | null
}

/** Nomes resolvidos fora daqui (o default só traz ids de processo e cobertura). */
export interface NomesDefault {
  processoImpressao?: string | null
  coberturaTinta?: string | null
}

/**
 * Preenche SOMENTE campos vazios do item com os defaults do produto×plano fixo.
 * Nunca sobrescreve; idempotente. Não toca na lista de cores (Req 5.4).
 */
export function aplicarDefaultsEmVazios<T extends CamposDefaultItem>(
  form: T,
  padrao: Pick<DefaultProdutoPlano, 'fabricanteSuporte'> | null | undefined,
  nomes: NomesDefault = {},
): T {
  if (!padrao) return form
  const proximo: T = { ...form }
  if (vazio(proximo.processoImpressao) && !vazio(nomes.processoImpressao)) {
    proximo.processoImpressao = nomes.processoImpressao as string
  }
  if (vazio(proximo.coberturaTintaTexto) && !vazio(nomes.coberturaTinta)) {
    proximo.coberturaTintaTexto = nomes.coberturaTinta as string
  }
  if (vazio(proximo.fabricante) && !vazio(padrao.fabricanteSuporte)) {
    proximo.fabricante = padrao.fabricanteSuporte as string
  }
  return proximo
}

/** Campos de um plano (modal) que o tipo de plano e o default podem preencher. */
export interface CamposDefaultPlano {
  nome?: string | null
  numCores?: number | null
  suporteId?: string | null
  gramatura?: number | string | null
}

/**
 * Defaults do plano: nome (nome do tipo), número de cores (frente + verso do
 * default), suporte e gramatura padrão do tipo. Só aplica em campo vazio E não
 * tocado pelo usuário (`camposTocados`). Idempotente.
 */
export function aplicarDefaultsEmPlano<T extends CamposDefaultPlano>(
  plano: T,
  tipo: Pick<TipoPlanoGrafico, 'nome' | 'suportePadraoId' | 'gramaturaPadrao'> | null | undefined,
  padrao?: Pick<DefaultProdutoPlano, 'coresFrente' | 'coresVerso'> | null,
  camposTocados: ReadonlySet<string> = new Set(),
): T {
  if (!tipo) return plano
  const proximo: T = { ...plano }
  if (!camposTocados.has('nome') && vazio(proximo.nome) && !vazio(tipo.nome)) {
    proximo.nome = tipo.nome
  }
  if (!camposTocados.has('numCores') && padrao) {
    const total = Number(padrao.coresFrente ?? 0) + Number(padrao.coresVerso ?? 0)
    // `numCores` do formulário nasce com valor padrão (não é "escolha do usuário"):
    // só a marca `camposTocados` o protege.
    if (total > 0) proximo.numCores = total
  }
  if (!camposTocados.has('suporteId') && vazio(proximo.suporteId) && !vazio(tipo.suportePadraoId)) {
    proximo.suporteId = tipo.suportePadraoId as string
  }
  if (!camposTocados.has('gramatura')) {
    const atual = Number(proximo.gramatura ?? 0)
    const padraoG = Number(tipo.gramaturaPadrao ?? 0)
    if ((!atual || atual <= 0) && padraoG > 0) proximo.gramatura = padraoG
  }
  return proximo
}

/**
 * Defaults só valem para item NOVO ou item salvo sem produto. Item puxado do
 * acervo e item salvo que já tem produto nunca reaplicam (Req 5.5, 5.6).
 */
export function deveAplicarDefaults(item: {
  calculoGraficoOrigemId?: string | null
  produtoGraficoIdSalvo?: string | null
}): boolean {
  if (item.calculoGraficoOrigemId) return false
  if (item.produtoGraficoIdSalvo) return false
  return true
}

// ============================================================================
// 2.3 — Atividades do catálogo
// ============================================================================

export interface AtividadeComOrdem {
  id: string
  nome?: string | null
  ordem?: number | null
}

/** Ordena por `ordem` (nulos por último) e depois por nome; estável. */
export function ordenarPorCatalogo<T extends AtividadeComOrdem>(lista: readonly T[]): T[] {
  return lista
    .map((item, i) => ({ item, i }))
    .sort((a, b) => {
      const oa = a.item.ordem ?? Number.POSITIVE_INFINITY
      const ob = b.item.ordem ?? Number.POSITIVE_INFINITY
      if (oa !== ob) return oa < ob ? -1 : 1
      if (oa === Number.POSITIVE_INFINITY) {
        const na = normalizarTexto(a.item.nome)
        const nb = normalizarTexto(b.item.nome)
        if (na !== nb) return na < nb ? -1 : 1
      }
      return a.i - b.i
    })
    .map((x) => x.item)
}

/** Une listas de atividades do catálogo sem repetir id (a primeira ocorrência vence). */
export function unirAtividades<T extends { id: string }>(...listas: ReadonlyArray<readonly T[]>): T[] {
  const vistos = new Set<string>()
  const saida: T[] = []
  for (const lista of listas) {
    for (const a of lista) {
      if (vistos.has(a.id)) continue
      vistos.add(a.id)
      saida.push(a)
    }
  }
  return saida
}

/**
 * Id do tipo de plano fixo do produto: (1) tipo com `fixo = true`; (2) o único
 * tipo permitido; (3) null quando há vários não fixos.
 */
export function planoFixoDoCatalogo(
  catalogo: { planos: ReadonlyArray<{ id: string; fixo?: boolean | null }> } | null | undefined,
): string | null {
  const planos = catalogo?.planos ?? []
  const fixo = planos.find((p) => p.fixo === true)
  if (fixo) return fixo.id
  if (planos.length === 1) return planos[0].id
  return null
}

export interface AtividadesAgrupadas<T> {
  planoProduto: T[]
  acondicionamento: T[]
  foraDoCatalogo: T[]
  /** Atividades do catálogo ausentes do cadastro carregado (limite de página). */
  naoExibidas: number
}

/**
 * Casa o cadastro de acabamentos com as atividades do catálogo por `id` e devolve
 * os grupos na ordem do catálogo. `marcadasIds` mantém visíveis, no grupo "fora do
 * catálogo", as atividades já marcadas que o catálogo não prevê (Req 6.4).
 */
export function filtrarOrdenarAtividades<T extends { id: string }>(
  cadastro: readonly T[],
  catalogo: {
    atividades: readonly AtividadeComOrdem[]
    acondicionamento: readonly AtividadeComOrdem[]
  },
  marcadasIds: readonly string[] = [],
): AtividadesAgrupadas<T> {
  const porId = new Map(cadastro.map((c) => [c.id, c]))
  const idsAcond = new Set(catalogo.acondicionamento.map((a) => a.id))
  // Acondicionamento tem grupo próprio: não repete na lista de atividades.
  const atividades = ordenarPorCatalogo(unirAtividades(catalogo.atividades)).filter((a) => !idsAcond.has(a.id))
  const acond = ordenarPorCatalogo(unirAtividades(catalogo.acondicionamento))

  let naoExibidas = 0
  const resolver = (lista: readonly AtividadeComOrdem[]): T[] => {
    const saida: T[] = []
    for (const a of lista) {
      const c = porId.get(a.id)
      if (c) saida.push(c)
      else naoExibidas += 1
    }
    return saida
  }

  const planoProduto = resolver(atividades)
  const acondicionamento = resolver(acond)

  const idsCatalogo = new Set<string>([...atividades.map((a) => a.id), ...acond.map((a) => a.id)])
  const foraDoCatalogo: T[] = []
  const vistos = new Set<string>()
  for (const id of marcadasIds) {
    if (idsCatalogo.has(id) || vistos.has(id)) continue
    vistos.add(id)
    const c = porId.get(id)
    if (c) foraDoCatalogo.push(c)
  }

  return { planoProduto, acondicionamento, foraDoCatalogo, naoExibidas }
}

/**
 * Atividades a pré-marcar (de `atividadesPreMarcadas` do default). Só devolve
 * algo quando o item ainda não tem nenhuma marcação (Req 6.3). Mantém a ordem
 * dos ids do default e ignora os que não estão no cadastro.
 */
export function preMarcarAtividades<T extends { id: string }>(
  acabamentosRicos: ReadonlyArray<unknown> | null | undefined,
  preMarcadas: ReadonlyArray<string> | null | undefined,
  cadastro: readonly T[],
): T[] {
  if ((acabamentosRicos?.length ?? 0) > 0) return []
  if (!preMarcadas || preMarcadas.length === 0) return []
  const porId = new Map(cadastro.map((c) => [c.id, c]))
  const saida: T[] = []
  const vistos = new Set<string>()
  for (const id of preMarcadas) {
    if (vistos.has(id)) continue
    vistos.add(id)
    const c = porId.get(id)
    if (c) saida.push(c)
  }
  return saida
}

// ============================================================================
// 2.4 — Material: tipoParam e linhas de seleção
// ============================================================================

export interface MaterialParaTipoParam {
  tipoParam?: number | null
  tipoMaterial?: string | null
  unidadeCusto?: string | null
}

/**
 * `tipoParam` do material: o campo do cadastro quando existir; senão o mapa
 * PROVISÓRIO e conservador do design 6.3 (o que for incerto cai em informativo).
 */
export function tipoParamDoMaterial(material: MaterialParaTipoParam | null | undefined): number {
  if (!material) return 2
  if (material.tipoParam !== undefined && material.tipoParam !== null) return Number(material.tipoParam)
  const tipo = (material.tipoMaterial ?? '').toUpperCase()
  const unidade = (material.unidadeCusto ?? '').toUpperCase()
  switch (tipo) {
    case 'ACONDICIONAMENTO':
      return 0
    case 'REVESTIMENTO_KG':
      return 1
    case 'PROPORCIONAL_TIRAGEM':
      return 4
    case 'COLA':
    case 'FITA':
      return 3
    case 'OUTRO':
      return unidade === 'M2' ? 1 : 2
    default:
      return 2
  }
}

/** Linha de seleção (mesmo shape que o back reflete no Json do item). */
export interface LinhaSelecao {
  selecaoId: string
  materialId: string
  nome: string
  valorUnitario: number | null
  consumo: number | null
  aplicaNoPreco: boolean
}

export const ORIGEM_SELECAO = 'SELECAO'

/**
 * Reconstrói `materiaisAcabamento`: mantém as linhas manuais e substitui TODAS as
 * de seleção. Espelha `refletirSelecoesNoJson` do back (ordem por `selecaoId`).
 */
export function mesclarLinhasSelecao(
  existentes: ReadonlyArray<MaterialAcabamentoItem> | null | undefined,
  selecoes: ReadonlyArray<LinhaSelecao>,
): MaterialAcabamentoItem[] {
  const manuais = (existentes ?? []).filter((l) => l && l.origem !== ORIGEM_SELECAO)
  const ordenadas = [...selecoes].sort((a, b) => a.selecaoId.localeCompare(b.selecaoId))
  const linhas: MaterialAcabamentoItem[] = ordenadas.map((s) => ({
    materialAcabamentoId: s.materialId,
    nome: s.nome,
    computarCusto: s.aplicaNoPreco === true,
    valorUnitario: s.valorUnitario ?? 0,
    quantidade: s.consumo ?? 0,
    origem: ORIGEM_SELECAO,
    selecaoId: s.selecaoId,
  }))
  return [...manuais, ...linhas]
}

// ============================================================================
// 2.5 — Itens diversos automáticos sugeridos
// ============================================================================

export interface SugestaoItemDiverso {
  /** Id do cadastro de itens diversos (chave de lista). */
  origemId: string
  descricao: string
  quantidade: number
  valor: number
  fixo: boolean
  /** Sem custo cadastrado: o usuário precisa informar o valor. */
  semCusto: boolean
}

/**
 * Converte os itens diversos automáticos em sugestões no formato do formulário
 * (`{ descricao, quantidade, valor, fixo }`), sem repetir descrição (normalizada,
 * sem acento e sem diferença de caixa) já presente nos itens atuais nem entre si.
 */
export function sugerirItensDiversos(
  automaticos: ReadonlyArray<
    Pick<ItemDiversoGrafico, 'id' | 'nome' | 'tipoCalculo' | 'quantidadePorUnidade' | 'custoInformado'>
  > | null | undefined,
  itensAtuais: ReadonlyArray<{ descricao?: string | null }> | null | undefined,
): SugestaoItemDiverso[] {
  const usados = new Set((itensAtuais ?? []).map((i) => normalizarTexto(i.descricao)).filter(Boolean))
  const saida: SugestaoItemDiverso[] = []
  for (const a of automaticos ?? []) {
    const chave = normalizarTexto(a.nome)
    if (!chave || usados.has(chave)) continue
    usados.add(chave)
    const quantidade = Number(a.quantidadePorUnidade) > 0 ? Number(a.quantidadePorUnidade) : 1
    const valor = Number(a.custoInformado) > 0 ? Number(a.custoInformado) : 0
    saida.push({
      origemId: a.id,
      descricao: a.nome,
      quantidade,
      valor,
      fixo: a.tipoCalculo !== 'TIRAGEM',
      semCusto: valor <= 0,
    })
  }
  return saida
}

// ============================================================================
// 4.4–4.8 — Apoio ao fluxo de seleção de material no editor
// ============================================================================

/** Chave estável de uma seleção (atividade + plano; plano nulo = item). */
export function chaveSelecao(acabamentoId: string, planoId?: string | null): string {
  return `${acabamentoId}|${planoId ?? ''}`
}

/** Ids das atividades a pré-marcar: as marcadas no plano do catálogo + as do default do produto. */
export function idsPreMarcados(
  planoFixo: { atividades: ReadonlyArray<{ id: string; preMarcada?: boolean }> } | null | undefined,
  defaultProduto: { atividadesPreMarcadas?: string[] | null } | null | undefined,
): string[] {
  const ids: string[] = []
  for (const a of planoFixo?.atividades ?? []) if (a.preMarcada) ids.push(a.id)
  for (const id of defaultProduto?.atividadesPreMarcadas ?? []) ids.push(id)
  return Array.from(new Set(ids))
}

export interface CamposParametroMaterial {
  param1?: string
  param2?: string
  gramaturaKgM2?: boolean
  pecasPorCaixa?: boolean
}

/** Campos de parâmetro exibidos por `tipoParam` (0 caixa, 1 cobertura, 4 proporcional; 2 e 3 informativos). */
export function camposParametroMaterial(tipoParam: number, unidadeCusto?: string | null): CamposParametroMaterial {
  switch (tipoParam) {
    case 0:
      return { pecasPorCaixa: true }
    case 1:
      return {
        param1: '% frente',
        param2: '% verso',
        gramaturaKgM2: (unidadeCusto ?? '').toUpperCase() === 'KG',
      }
    case 4:
      return { param1: 'Quantidade por peça' }
    default:
      return {}
  }
}

/** Valores iniciais dos parâmetros ao escolher um material. */
export function paramsPadraoMaterial(tipoParam: number): { param1: number | null; param2: number | null } {
  if (tipoParam === 1) return { param1: 100, param2: 0 }
  if (tipoParam === 4) return { param1: 1, param2: null }
  return { param1: null, param2: null }
}

/** Material pré-selecionado de uma atividade: o padrão ou o único permitido. */
export function materialPadraoDaAtividade<T extends { id: string; padrao?: boolean }>(
  materiais: ReadonlyArray<T> | null | undefined,
): T | null {
  const lista = materiais ?? []
  return lista.find((m) => m.padrao) ?? (lista.length === 1 ? lista[0] : null)
}

export interface ErroSelecaoMaterial {
  mensagem: string
  /** Nomes dos materiais permitidos (quando a API respondeu 422). */
  permitidos: string[]
}

/** Lê o erro da API de seleção (422 traz `permitidos`). Nunca lança. */
export function erroDaSelecao(err: unknown, padrao = 'Não foi possível gravar a escolha de material.'): ErroSelecaoMaterial {
  const e = err as {
    response?: { status?: number; data?: { message?: string; permitidos?: Array<{ nome?: string }> } }
  }
  const dados = e?.response?.data
  const permitidos = Array.isArray(dados?.permitidos)
    ? dados!.permitidos!.map((p) => p?.nome ?? '').filter(Boolean)
    : []
  return { mensagem: dados?.message || padrao, permitidos }
}

export interface SelecaoParaLinha {
  id: string
  materialId: string
  valorUnitario: number | null
  consumo: number | null
  aplicaNoPreco: boolean
}

/** Converte as seleções gravadas em linhas de `materiaisAcabamento` (nome pelo que já existe ou pelo catálogo). */
export function selecoesParaLinhas(
  selecoes: ReadonlyArray<SelecaoParaLinha>,
  linhasAtuais: ReadonlyArray<MaterialAcabamentoItem> | null | undefined,
  nomeDoMaterial: (materialId: string) => string | null | undefined,
): LinhaSelecao[] {
  const nomePorSelecao = new Map(
    (linhasAtuais ?? []).filter((l) => l.selecaoId).map((l) => [l.selecaoId as string, l.nome ?? '']),
  )
  return selecoes.map((s) => ({
    selecaoId: s.id,
    materialId: s.materialId,
    nome: nomePorSelecao.get(s.id) || nomeDoMaterial(s.materialId) || 'Material',
    valorUnitario: s.valorUnitario,
    consumo: s.consumo,
    aplicaNoPreco: s.aplicaNoPreco,
  }))
}
