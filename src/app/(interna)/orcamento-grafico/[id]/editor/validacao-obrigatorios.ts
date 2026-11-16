/**
 * validacao-obrigatorios — função PURA (sem React, rede ou banco) da validação prévia
 * ao salvar o item (spec orcamento-grafico-fase3-produto-embalagem, Req 4.8).
 */

export interface CamposObrigatoriosParaSalvar {
  tipoEmbalagemId?: string | null
  gramatura?: number | string | null
  precoKg?: number | string | null
}

export const NOME_TIPO_EMBALAGEM = 'Tipo de Embalagem'
export const NOME_GRAMATURA = 'Gramatura'
export const NOME_PRECO_KG = 'Preço por kg'

function positivo(v: unknown): boolean {
  if (v === undefined || v === null || (typeof v === 'string' && v.trim() === '')) return false
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) && n > 0
}

/**
 * Devolve, nesta ordem, os nomes dos campos que faltam: Tipo de Embalagem (vazio),
 * Gramatura (não maior que 0) e Preço por kg (não maior que 0). Lista vazia = pode salvar.
 */
export function validarObrigatoriosParaSalvar(form: CamposObrigatoriosParaSalvar): string[] {
  const faltam: string[] = []
  const tipo = form.tipoEmbalagemId
  if (tipo === undefined || tipo === null || (typeof tipo === 'string' && tipo.trim() === '')) {
    faltam.push(NOME_TIPO_EMBALAGEM)
  }
  if (!positivo(form.gramatura)) faltam.push(NOME_GRAMATURA)
  if (!positivo(form.precoKg)) faltam.push(NOME_PRECO_KG)
  return faltam
}
