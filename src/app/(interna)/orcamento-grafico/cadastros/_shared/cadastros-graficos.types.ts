// ============================================================================
// Tipos dos cadastros gráficos do orçamento (produtos, planos, relações, etc.).
// Base da API: /orcamento-grafico/cadastros
// Obs.: campos Decimal do Prisma chegam como string no JSON → `Decimal`.
// ============================================================================

export type Decimal = number | string

export type SituacaoFiltro = 'ativo' | 'inativo' | 'todos'

export interface ListaPaginada<T> {
  total: number
  pagina: number
  limite: number
  itens: T[]
}

export interface PaginacaoParams {
  pagina?: number
  limite?: number
}

// ───────────────────────────── Produto ─────────────────────────────

export type ModoFormato = 'TRES_DIMENSOES' | 'DUAS_DIMENSOES' | 'ABERTO_FECHADO' | 'SANFONA_ABAS' | 'PAGINA'

export interface ProdutoGrafico {
  id: string
  empresaId: string
  codigo: string
  nome: string
  linhaProdutoId: string | null
  codigoOrigem: number | null
  status: boolean
  tributacao2026: string | null
  tributacao2027: string | null
  classificacaoFiscal: string | null
  fechamentoId: string | null
  baseUnidadePreco: string
  unidadeId: string | null
  prazoProducaoDias: number
  faturamentoMinimo: boolean
  valorFaturamentoMinimo: Decimal | null
  tipoCartucho: string | null
  modoFormato: ModoFormato
  formatoPadraoLargura: Decimal | null
  formatoPadraoAltura: Decimal | null
  exibeRestricoes: boolean
  exibeInformacoesComplementares: boolean
  semImpressao: boolean
  criadoEm?: string
  atualizadoEm?: string
}

export type ProdutoGraficoInput = Partial<
  Omit<ProdutoGrafico, 'id' | 'empresaId' | 'criadoEm' | 'atualizadoEm'>
> & { codigo: string; nome: string }

export interface ListaProdutosParams {
  situacao?: SituacaoFiltro
  busca?: string
  linhaProdutoId?: string
}

// ─────────────────────────── Tipo de Plano ───────────────────────────

export type CalculoAutomaticoFormato = 'SIM' | 'NAO' | 'OPCIONAL'
export type PrimeiraMedida = 'LF' | 'LFX2' | 'LOMBADA'
export type OcorrenciasPlano = 'UMA' | 'DUAS' | 'LIVRE'

export interface TipoPlanoGrafico {
  id: string
  empresaId: string
  codigo: string
  nome: string
  linhaProdutoId: string | null
  codigoOrigem: number | null
  fixo: boolean
  status: boolean
  miolo: boolean
  calculoAutomaticoFormato: CalculoAutomaticoFormato
  primeiraMedida: PrimeiraMedida
  somarOrelhas: boolean
  somarLombada: boolean
  ocorrencias: OcorrenciasPlano
  quebraPadrao: Decimal | null
  corteDuploMin: Decimal | null
  suportePadraoId: string | null
  gramaturaPadrao: Decimal | null
  montagemId: string | null
  usarPinca: boolean
  fibraDefault: string | null
  frenteIgualVerso: boolean
  caderno: boolean
  margem1Mm: Decimal
  margem2Mm: Decimal
  formato: string | null
  criadoEm?: string
  atualizadoEm?: string
}

export type TipoPlanoGraficoInput = Partial<
  Omit<TipoPlanoGrafico, 'id' | 'empresaId' | 'criadoEm' | 'atualizadoEm' | 'margem1Mm' | 'margem2Mm'>
> & { codigo: string; nome: string; margem1Mm?: number; margem2Mm?: number }

export type ListaTiposPlanoParams = ListaProdutosParams

// ───────────────────── Defaults do produto por plano ─────────────────────

export interface DefaultProdutoPlano {
  id: string
  empresaId: string
  produtoId: string
  tipoPlanoId: string
  semImpressao: boolean
  processoImpressaoId: string | null
  coberturaTintaId: string | null
  coresFrente: number
  coresVerso: number
  areaTintaPerc: Decimal
  fabricanteSuporte: string | null
  atividadesPreMarcadas: string[] | null
  tipoPlano?: Pick<TipoPlanoGrafico, 'id' | 'codigo' | 'nome' | 'fixo'>
}

export interface DefaultProdutoPlanoInput {
  semImpressao?: boolean
  processoImpressaoId?: string | null
  coberturaTintaId?: string | null
  coresFrente?: number
  coresVerso?: number
  areaTintaPerc?: number
  fabricanteSuporte?: string | null
  atividadesPreMarcadas?: string[]
}

// ───────────────────────────── Relações ─────────────────────────────

export type TipoRelacao =
  | 'PRODUTO'
  | 'PLANO'
  | 'ATIVIDADE'
  | 'ACONDICIONAMENTO'
  | 'MATERIAL'
  | 'SUPORTE'
  | 'CENTRO'
  | 'LINHA'
  | 'COBERTURA_TINTA'
  | 'ITEM_DIVERSO'
  | 'TINTA'
  | 'MATRIZ'

export interface RelacaoCadastroGrafico {
  id: string
  empresaId: string
  tipoOrigem: string
  idOrigem: string
  tipoDestino: string
  idDestino: string
  ordem: number | null
  padrao: boolean
  criadoEm?: string
}

export interface ListaRelacoesParams {
  tipoOrigem?: string
  idOrigem?: string
  tipoDestino?: string
}

export interface SalvarRelacoesInput {
  tipoOrigem: string
  idOrigem: string
  tipoDestino: string
  ids: string[]
  /** Subconjunto de `ids` marcado como padrão. Se omitido, preserva o valor atual. */
  padroes?: string[]
}

export interface VerificacaoRelacoes {
  total: number
  totalOrfas: number
  orfas: Pick<RelacaoCadastroGrafico, 'id' | 'tipoOrigem' | 'idOrigem' | 'tipoDestino' | 'idDestino'>[]
}

// ─────────────────────────── Itens Diversos ───────────────────────────

export type OrigemItemDiverso =
  | 'CENTRO_DE_CUSTO'
  | 'SERVICO_EXTERNO'
  | 'PRE_IMPRESSAO'
  | 'TINTA'
  | 'MATRIZ_IMPRESSAO'

export interface ItemDiversoGrafico {
  id: string
  empresaId: string
  codigoOrigem: number | null
  nome: string
  origem: OrigemItemDiverso
  automatico: boolean
  tipoCalculo: string | null
  aplicadoSobre: string | null
  quantidadeAceite: Decimal | null
  quantidadePorUnidade: Decimal | null
  quantidadeMinima: Decimal | null
  porCaderno: boolean
  custoInformado: Decimal | null
  calculoPorQtdCores: boolean
  acompanhaMontImpressao: boolean
  itemRevenda: boolean
  quebraPerc: Decimal | null
  textoProposta: string | null
  sigla: string | null
  pendenciaAutomaticaPcp: boolean
  status: boolean
  /** Presente no GET por id e nas gravações. */
  atividadeIds?: string[]
}

export type ItemDiversoGraficoInput = Partial<
  Omit<ItemDiversoGrafico, 'id' | 'empresaId' | 'nome' | 'origem'>
> & { nome: string; origem: OrigemItemDiverso }

export interface ListaItensDiversosParams extends PaginacaoParams {
  busca?: string
  origem?: string
  status?: SituacaoFiltro
}

// ─────────────────────────── Campos Livres ───────────────────────────

export type ProprietarioCampoLivre = 'SOLICITACAO' | 'PEDIDO' | 'RECUSA' | 'INSUMO'
export type TipoCampoLivre = 'TEXTO' | 'LISTA'

export interface CampoLivreOpcao {
  id?: string
  campoLivreId?: string
  valor: string
  padrao: boolean
  ordem: number
}

export interface CampoLivre {
  id: string
  empresaId: string
  proprietario: ProprietarioCampoLivre
  codigoOrigem: number | null
  nome: string
  tipo: TipoCampoLivre
  obrigatorio: boolean
  ordem: number
  status: boolean
  copiaParaPedidoCampoId: string | null
  opcoes: CampoLivreOpcao[]
}

export interface CampoLivreOpcaoInput {
  valor: string
  padrao?: boolean
  ordem?: number
}

export type CampoLivreInput = Partial<
  Omit<CampoLivre, 'id' | 'empresaId' | 'proprietario' | 'nome' | 'opcoes'>
> & {
  proprietario: ProprietarioCampoLivre
  nome: string
  /** Quando enviadas, substituem o conjunto de opções. */
  opcoes?: CampoLivreOpcaoInput[]
}

export interface ListaCamposLivresParams {
  proprietario?: ProprietarioCampoLivre
  status?: SituacaoFiltro
}

// ─────────────────── Ajustes de Produtividade ───────────────────

export type DadoAjustar = 'ACERTO' | 'PRODUCAO_HORA' | 'CONSUMO_MATERIAL' | 'INCONDICIONAL'
export type FuncaoAjuste = 'RESTRICAO_MANUAL' | 'ATIVIDADE' | 'FORMATO_PROCESSO'

export interface AjusteProdutividade {
  id: string
  empresaId: string
  acabamentoId: string
  centroProducaoId: string | null
  dadoAjustar: DadoAjustar
  funcao: FuncaoAjuste
  operador: string | null
  valor: string | null
  fator: Decimal
  fatorPositivo: boolean
  impedeMontagemCadernos: boolean
  restricaoId: string | null
  /** Só na visão de restrições automáticas. */
  tipoRestricao?: 'INCOMPATIVEL'
}

export type AjusteProdutividadeInput = Partial<
  Omit<AjusteProdutividade, 'id' | 'empresaId' | 'acabamentoId' | 'tipoRestricao' | 'fator'>
> & {
  acabamentoId: string
  dadoAjustar: DadoAjustar
  funcao: FuncaoAjuste
  fator?: number
}

export interface ListaAjustesParams extends PaginacaoParams {
  acabamentoId?: string
  centroProducaoId?: string
  dadoAjustar?: DadoAjustar
  funcao?: FuncaoAjuste
}

export interface RestricoesAutomaticas {
  total: number
  itens: AjusteProdutividade[]
}

// ───────────────────────────── Quebras ─────────────────────────────

export type TipoAtividadeQuebra = 'IMPRESSAO' | 'ACABAMENTO'

export interface QuebraGraficaLimite {
  id?: string
  quebraId?: string
  tiragemAte: number
  quebraPerc: Decimal
}

export interface QuebraGrafica {
  id: string
  empresaId: string
  codigoOrigem: number | null
  nome: string
  tipoAtividade: TipoAtividadeQuebra
  pedacosPorAcerto: Decimal | null
  pedacosPorPlano: Decimal | null
  pedacosPorTipoPlano: Decimal | null
  pedacosOcorrencias: Decimal | null
  pedacosMinimoPerc: Decimal | null
  interpolar: boolean
  status: boolean
  limites: QuebraGraficaLimite[]
}

export interface QuebraGraficaLimiteInput {
  tiragemAte: number
  quebraPerc: number
}

export type QuebraGraficaInput = Partial<
  Omit<QuebraGrafica, 'id' | 'empresaId' | 'nome' | 'limites'>
> & {
  nome: string
  /** Quando enviados, substituem o conjunto de limites. */
  limites?: QuebraGraficaLimiteInput[]
}

export interface ListaQuebrasParams {
  tipoAtividade?: TipoAtividadeQuebra
  busca?: string
  status?: SituacaoFiltro
}

// ───────────────────── Limites de Montagem ─────────────────────

export interface LimiteMontagem {
  id: string
  empresaId: string
  formatoFinalLargura: Decimal
  formatoFinalAltura: Decimal
  minimo: number
  maximo: number
}

export interface LimiteMontagemInput {
  formatoFinalLargura: number
  formatoFinalAltura: number
  minimo: number
  maximo: number
}

// ───────────────────────────── Parâmetros ─────────────────────────────

export interface DefinicaoParametro {
  chave: string
  descricao: string
  padrao: number
  min: number
  max: number
  inteiro: boolean
}

export interface Parametros {
  empresaId: string
  /** Chave sem prefixo `orc.` → valor numérico. */
  parametros: Record<string, number>
  definicoes: DefinicaoParametro[]
}

// ───────────────────────────── Catálogo ─────────────────────────────

/** Atividade (acabamento gráfico) conforme devolvida pelo catálogo. */
export interface AtividadeCatalogo {
  id: string
  codigo: string
  nome: string
  tipoAtividade: string | null
  planoProduto: string | null
  naturezaCusto: string | null
  exigeRestricao: boolean
  acondicionamento: boolean
  textoProposta: string | null
  exibirNomePlano: boolean
  ordem?: number | null
  padrao?: boolean
  [outros: string]: unknown
}

export interface CatalogoProduto {
  produto: ProdutoGrafico
  planos: Array<TipoPlanoGrafico & { ordem: number | null; padrao: boolean }>
  atividades: AtividadeCatalogo[]
  acondicionamento: AtividadeCatalogo[]
  itensDiversos: Array<ItemDiversoGrafico & { ordem: number | null; padrao: boolean }>
  defaults: DefaultProdutoPlano[]
}

export interface MaterialCatalogo {
  id: string
  nome: string
  [outros: string]: unknown
}

export interface AtividadeCatalogoPlano extends AtividadeCatalogo {
  preMarcada: boolean
  restricoes: Array<{ id: string; nome: string; [outros: string]: unknown }>
  materiais: Array<MaterialCatalogo & { ordem: number | null; padrao: boolean }>
}

export interface CatalogoPlano {
  plano: TipoPlanoGrafico
  defaultProduto: DefaultProdutoPlano | null
  atividades: AtividadeCatalogoPlano[]
  coberturas: Array<{ id: string; nome: string; ordem: number | null; padrao: boolean; [outros: string]: unknown }>
  suportes: Array<{ id: string; descricao: string; ordem: number | null; padrao: boolean; [outros: string]: unknown }>
  itensDiversosAutomaticos: Array<ItemDiversoGrafico & { ordem: number | null; padrao: boolean }>
}

// ───────────────────── Seleção de material do item ─────────────────────

export interface SelecaoMaterial {
  id: string
  itemId: string
  planoId: string | null
  acabamentoId: string
  materialId: string
  restricaoId: string | null
  tipoParam: number
  param1: number | null
  param2: number | null
  consumo: number | null
  unidadeConsumo: string | null
  valorUnitario: number | null
  custo: number
  aplicaNoPreco: boolean
  situacaoParametro: string
}

export interface SalvarSelecaoMaterialInput {
  itemId: string
  planoId?: string | null
  acabamentoId: string
  materialId: string
  restricaoId?: string | null
  tipoParam?: number
  param1?: number | null
  param2?: number | null
  gramaturaKgM2?: number | null
  pecasPorCaixa?: number | null
}

export interface SalvarSelecaoMaterialResposta {
  selecao: SelecaoMaterial
  motivo: string | null
  /** Resumo de custo por plano (somarCustoPlanos). */
  resumoCustos: unknown
}
