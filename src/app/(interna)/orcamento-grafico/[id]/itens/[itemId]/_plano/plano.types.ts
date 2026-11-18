/**
 * Tipos dos planos do item multi-plano (Fase 3 da hierarquia Orçamento → Item → Plano).
 *
 * `PlanoLeitura` é o formato de `GET /orcamento-grafico/:id/itens/:itemId/planos` (e do plano
 * único `.../planos/:planoId`). Decimais chegam como texto.
 * `EspecificacaoPlanoV1` é o Json `especificacao` (decisão D1): campos do plano sem coluna própria,
 * fora do cálculo (o motor não lê).
 */

export type Decimalish = number | string | null

export interface LinhaAcabamentoPlano {
  acabamentoId?: string
  nome?: string
  restricaoAcabamentoId?: string
  restricaoNome?: string | null
  [outros: string]: unknown
}

export interface CorPlano {
  nome: string
  tipo: 'CMYK' | 'PANTONE'
  coberturaPercent: number
  precoKg: number
  rendimentoM2Kg?: number
}

export interface PlanoLeitura {
  id: string
  sequencia: number
  nome: string
  tipoPlanoId: string | null
  suporteId: string | null
  suporteProducaoId: string | null
  gramatura: Decimalish
  formatoLarguraMm: Decimalish
  formatoAlturaMm: Decimalish
  numCores: number | null
  cores: CorPlano[] | null
  maquinaId: string | null
  acabamentosRicos: LinhaAcabamentoPlano[] | null
  custoSuporte: Decimalish
  custoImpressao: Decimalish
  custoAcabamento: Decimalish
  especificacao: EspecificacaoPlanoV1 | null
}

export interface DimensoesAberto {
  largura: number | null
  altura: number | null
}

export interface DimensoesFinal {
  comprimento: number | null
  largura: number | null
  altura: number | null
  alturaTampa: number | null
}

export interface BlocoSuporteEspec {
  fabricante: string | null
  suporteId: string | null
  /** Nome do suporte no momento da escolha (só para exibir ao reabrir a Tela_Plano). */
  suporteNome?: string | null
  fornecido: boolean
}

export interface EspecificacaoPlanoV1 {
  versao: 1
  ocorrencias?: number | null
  /** null = usa a tiragem do item. */
  tiragem?: number | null
  /** Montagem digitada, ex.: `2x2`. */
  montagem?: string | null
  /** Corte digitado (texto livre, ex.: `650 x 1225`). */
  corte?: string | null
  formatoAberto?: DimensoesAberto | null
  formatoFinal?: DimensoesFinal | null
  /** `NxM` (frente x verso). A coluna `numCores` guarda N + M. */
  cores?: string | null
  processoImpressao?: string | null
  coberturaTinta?: number | null
  capaExterna?: (BlocoSuporteEspec & { fibra: string | null }) | null
  microondulado?: (BlocoSuporteEspec & { sentidoOnda: string | null; ajusteCorteMicro: number | null }) | null
  capaInterna?:
    | (BlocoSuporteEspec & { cores: string | null; processoImpressao: string | null; coberturaTinta: number | null })
    | null
  /** Suporte do plano quando o tipo não prevê nenhuma capa nem microondulado. */
  suportePrincipal?: BlocoSuporteEspec | null
  [outros: string]: unknown
}

/** Id da rota para plano novo. */
export const ID_PLANO_NOVO = 'novo'
