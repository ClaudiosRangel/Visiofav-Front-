/**
 * Helper PURO de pré-visualização de faixa de margem (gross-up).
 *
 * Feature: orcamento-grafico-experiencia-calcgraf (Tarefa 2.3)
 * Property 7: Pré-visualização de faixa de margem é pura e não persiste.
 * _Requirements: 7.4, 7.5_
 *
 * Esta função NÃO usa React, NÃO faz I/O e NÃO persiste nada. Serve apenas para
 * PRÉ-VISUALIZAR, na seção Fechamento do Editor de Item, como ficaria o
 * fechamento (valor total/unitário e contribuição marginal) ao selecionar uma
 * faixa de margem alternativa — sem alterar o valor consolidado já gravado.
 *
 * Fórmula de formação de preço do módulo (gross-up / divisor único), idêntica à
 * `formarPrecoVenda` do backend:
 *
 *   valorTotal = base / (1 − margemPct/100 − cevPct/100)
 *
 * onde `base` é o custo (custo de produção/total) e os percentuais são a margem
 * de lucro e o CEV (custos diretos de venda: ICMS, PIS/COFINS, comissões,
 * juros). O divisor `(1 − margem% − CEV%)` é o fator de gross-up.
 *
 * Derivações:
 *   - valorUnitario           = valorTotal / quantidade
 *   - contribuicaoMarginalValor = valorTotal − custosVariaveis  (quando houver)
 *   - contribuicaoMarginalPerc  = CM$ / valorTotal × 100
 *
 * Guardas de segurança (nunca lança):
 *   - divisor `(1 − margem% − CEV%) <= 0` → retorna valores zerados
 *   - quantidade `<= 0` → valorUnitario = 0
 *   - entradas não finitas (NaN/Infinity) → tratadas como 0
 */

export interface PreviewFaixaMargemParams {
  /** Custo base (custo de produção/total) sobre o qual o gross-up é aplicado. */
  base: number
  /** Margem de lucro em pontos percentuais (ex.: 30 = 30%). */
  margemPct: number
  /** CEV (custos diretos de venda) em pontos percentuais (ex.: 21.25 = 21,25%). */
  cevPct: number
  /** Tiragem/quantidade do item, usada para derivar o valor unitário. */
  quantidade: number
  /**
   * Custos variáveis do item (para a contribuição marginal). Opcional: quando
   * ausente, a CM não é derivada (mantém a consistência com o resto do módulo,
   * que só expõe CM quando os dados existem).
   */
  custosVariaveis?: number
}

export interface PreviewFaixaMargemResultado {
  /** Valor total (gross-up), arredondado a 2 casas (padrão monetário). */
  valorTotal: number
  /** Valor unitário = valorTotal / quantidade, arredondado a 4 casas. */
  valorUnitario: number
  /** Contribuição marginal em R$ (só quando `custosVariaveis` é informado). */
  contribuicaoMarginalValor?: number
  /** Contribuição marginal em % sobre o valor total (só quando aplicável). */
  contribuicaoMarginalPerc?: number
}

/** Número finito seguro: NaN/Infinity/undefined viram 0. */
function finito(n: number | undefined): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : 0
}

/** Arredonda para `casas` casas decimais de forma estável (meio p/ cima). */
function arredondar(valor: number, casas: number): number {
  if (!Number.isFinite(valor)) return 0
  const f = 10 ** casas
  return Math.round((valor + Number.EPSILON) * f) / f
}

const RESULTADO_SEGURO: PreviewFaixaMargemResultado = {
  valorTotal: 0,
  valorUnitario: 0,
}

/**
 * Pré-visualiza o fechamento por faixa de margem aplicando o gross-up.
 * Função PURA — mesma entrada sempre produz a mesma saída; não persiste nada.
 */
export function previewFaixaMargem(
  params: PreviewFaixaMargemParams,
): PreviewFaixaMargemResultado {
  const base = finito(params.base)
  const margemPct = finito(params.margemPct)
  const cevPct = finito(params.cevPct)
  const quantidade = finito(params.quantidade)

  // Fator de gross-up: (1 − margem% − CEV%). Se <= 0, não há preço válido.
  const divisor = 1 - margemPct / 100 - cevPct / 100
  if (divisor <= 0) {
    return { ...RESULTADO_SEGURO }
  }

  const valorTotalBruto = base / divisor
  const valorTotal = arredondar(valorTotalBruto, 2)

  const valorUnitario =
    quantidade > 0 ? arredondar(valorTotalBruto / quantidade, 4) : 0

  const resultado: PreviewFaixaMargemResultado = { valorTotal, valorUnitario }

  // Contribuição marginal: só quando os custos variáveis existirem (consistente
  // com o resto do módulo, que expõe CM$ = valorTotal − custosVariaveis).
  if (params.custosVariaveis != null) {
    const custosVariaveis = finito(params.custosVariaveis)
    const cmValor = valorTotalBruto - custosVariaveis
    resultado.contribuicaoMarginalValor = arredondar(cmValor, 2)
    resultado.contribuicaoMarginalPerc =
      valorTotalBruto > 0 ? arredondar((cmValor / valorTotalBruto) * 100, 2) : 0
  }

  return resultado
}
