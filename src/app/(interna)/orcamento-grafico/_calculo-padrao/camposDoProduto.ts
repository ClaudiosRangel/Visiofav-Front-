/**
 * camposDoProduto — função PURA (sem React, sem rede, sem efeito colateral) que, dado o
 * cadastro do Produto Gráfico, seus defaults e os tipos de plano permitidos, devolve os
 * campos visíveis do cálculo e os valores iniciais.
 *
 * Tudo vem do cadastro: nunca compara nome/código de produto ou de linha. Reaproveita
 * `resolverLayoutItem` e `resolverPadroesIniciais` (mesma regra do editor do item).
 */

import type {
  AtividadeCatalogo,
  DefaultProdutoPlano,
  ProdutoGrafico,
  TipoPlanoGrafico,
} from '../cadastros/_shared/cadastros-graficos.types'
import { entradaLayoutDoCatalogo } from '../[id]/_layout/entrada-layout'
import {
  resolverLayoutItem,
  resolverPadroesIniciais,
  type LayoutItem,
  type ModoFormato,
  type PadroesIniciais,
} from '../[id]/_layout/resolver-layout-item'

/** Cadastro do produto como usado pela função (subconjunto de `ProdutoGrafico`). */
export type ProdutoGraficoCadastro = Pick<
  ProdutoGrafico,
  | 'modoFormato'
  | 'formatoPadraoLargura'
  | 'formatoPadraoAltura'
  | 'exibeRestricoes'
  | 'exibeInformacoesComplementares'
  | 'semImpressao'
> &
  Partial<Pick<ProdutoGrafico, 'id' | 'possuiAlturaTampa'>>

export type TipoPlanoPermitido = TipoPlanoGrafico

export interface FormatoPadrao {
  largura: number
  altura: number
}

export interface CamposDoProduto {
  /** Plano único (algum tipo permitido é `fixo`) ou multi-plano (grid de planos). */
  estrutura: LayoutItem['estrutura']
  planoUnico: boolean
  tipoPlanoFixoId: string | null
  /** Grid "Tipos de Plano" visível (multi-plano). */
  gridPlanos: boolean
  /** Modo de formato do cadastro; null quando ausente/desconhecido. */
  modoFormato: ModoFormato | null
  cadastroCompleto: boolean
  motivoIncompleto: LayoutItem['motivoIncompleto']
  /** Campos de formato e de plano único visíveis (ordem do layout). */
  layout: LayoutItem
  exibeRestricoes: boolean
  exibeInformacoesComplementares: boolean
  semImpressao: boolean
  impressaoVisivel: boolean
  /** Formato padrão do cadastro (só quando largura e altura > 0). */
  formatoPadrao: FormatoPadrao | null
  /** Valores iniciais: cores, processo, cobertura, fabricante e atividades pré-marcadas. */
  padroes: PadroesIniciais
}

const MODOS: ReadonlySet<string> = new Set<ModoFormato>([
  'TRES_DIMENSOES',
  'DUAS_DIMENSOES',
  'ABERTO_FECHADO',
  'SANFONA_ABAS',
  'PAGINA',
])

/**
 * Escolhe o default que vale para o item: plano único → default do tipo fixo;
 * multi-plano → o único default existente (se houver mais de um, nenhum é assumido).
 */
function escolherDefault(
  defaults: ReadonlyArray<DefaultProdutoPlano>,
  tipoFixoId: string | null,
): DefaultProdutoPlano | null {
  if (tipoFixoId !== null) return defaults.find((d) => d.tipoPlanoId === tipoFixoId) ?? null
  return defaults.length === 1 ? defaults[0] : null
}

export function camposDoProduto(
  produto: ProdutoGraficoCadastro,
  defaults: ReadonlyArray<DefaultProdutoPlano> | null | undefined,
  tiposPlano: ReadonlyArray<TipoPlanoPermitido> | null | undefined,
  atividadesDoCatalogo?: ReadonlyArray<Pick<AtividadeCatalogo, 'id'> & { preMarcada?: boolean }> | null,
): CamposDoProduto {
  const tipos = tiposPlano ?? []
  const entrada = entradaLayoutDoCatalogo({
    produto: produto as ProdutoGrafico,
    planos: tipos.map((t) => ({ ...t, ordem: null, padrao: false })),
  })
  const layout = resolverLayoutItem(entrada)

  const padroes = resolverPadroesIniciais({
    default: escolherDefault(defaults ?? [], layout.tipoPlanoFixoId),
    atividadesDoCatalogo: atividadesDoCatalogo ?? null,
  })

  const modo = produto.modoFormato as string | null | undefined
  return {
    estrutura: layout.estrutura,
    planoUnico: layout.estrutura === 'PLANO_UNICO',
    tipoPlanoFixoId: layout.tipoPlanoFixoId,
    gridPlanos: layout.gridPlanos,
    modoFormato: modo && MODOS.has(modo) ? (modo as ModoFormato) : null,
    cadastroCompleto: layout.cadastroCompleto,
    motivoIncompleto: layout.motivoIncompleto,
    layout,
    exibeRestricoes: produto.exibeRestricoes === true,
    exibeInformacoesComplementares: layout.informacoesComplementaresVisiveis,
    semImpressao: produto.semImpressao === true,
    impressaoVisivel: layout.impressaoVisivel,
    formatoPadrao: layout.formato.padrao,
    padroes,
  }
}
