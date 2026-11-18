/**
 * validar-faixa — validadores numéricos PUROS do Orçamento Gráfico (hierarquia
 * Item/Plano). Trabalham sobre a STRING digitada (vírgula ou ponto como separador
 * decimal) e contam casas decimais pelos dígitos digitados, sem aritmética de ponto
 * flutuante. A comparação com os limites é feita em inteiros escalados (BigInt).
 *
 * Formatos aceitos: `12`, `12,5`, `12.5`, `,5`, `5,`, sinal `+`/`-` e o formato
 * pt-BR com milhar quando AMBOS os separadores aparecem (`99.999,99`). Um único
 * separador é sempre decimal (`1.234` = 1,234 = 3 casas). `-0` vale 0.
 */

export interface EspecFaixa {
  min: number
  max: number
  minExclusivo?: boolean
  maxExclusivo?: boolean
  /** Máximo de casas decimais permitidas (0 = inteiro). */
  casas: number
}

export type MotivoFaixa = 'VAZIO' | 'NAO_NUMERICO' | 'ABAIXO' | 'ACIMA' | 'CASAS'
export type ResultadoFaixa = { ok: true; valor: number } | { ok: false; motivo: MotivoFaixa }

interface NumeroTexto {
  negativo: boolean
  inteiro: string
  fracao: string
}

const RE_PTBR_MILHAR = /^[+-]?\d{1,3}(\.\d{3})+,\d*$/
const RE_NUMERO = /^([+-]?)(\d*)(?:[.,](\d*))?$/

function lerNumero(entrada: string | number | null | undefined): NumeroTexto | 'VAZIO' | 'NAO_NUMERICO' {
  if (entrada === null || entrada === undefined) return 'VAZIO'
  let texto: string
  if (typeof entrada === 'number') {
    if (!Number.isFinite(entrada)) return 'NAO_NUMERICO'
    texto = String(entrada)
  } else {
    texto = entrada.trim()
  }
  if (texto === '') return 'VAZIO'
  if (RE_PTBR_MILHAR.test(texto)) texto = texto.replace(/\./g, '')
  const m = RE_NUMERO.exec(texto)
  if (!m) return 'NAO_NUMERICO'
  const inteiro = m[2] ?? ''
  const fracao = m[3] ?? ''
  if (inteiro === '' && fracao === '') return 'NAO_NUMERICO'
  return { negativo: m[1] === '-', inteiro: inteiro === '' ? '0' : inteiro, fracao }
}

/** Escala um limite numérico para inteiro com `casas` casas, sem somar floats. */
function escalarLimite(valor: number, casas: number): bigint {
  const t = valor.toFixed(casas)
  return BigInt(t.replace('.', ''))
}

export function validarFaixa(entrada: string | number | null | undefined, spec: EspecFaixa): ResultadoFaixa {
  const n = lerNumero(entrada)
  if (n === 'VAZIO') return { ok: false, motivo: 'VAZIO' }
  if (n === 'NAO_NUMERICO') return { ok: false, motivo: 'NAO_NUMERICO' }

  if (n.fracao.length > spec.casas) return { ok: false, motivo: 'CASAS' }

  const digitos = (n.inteiro + n.fracao.padEnd(spec.casas, '0')).replace(/^0+(?=\d)/, '')
  let escalado = BigInt(digitos)
  if (n.negativo) escalado = -escalado // -0n === 0n

  const min = escalarLimite(spec.min, spec.casas)
  const max = escalarLimite(spec.max, spec.casas)
  if (spec.minExclusivo ? escalado <= min : escalado < min) return { ok: false, motivo: 'ABAIXO' }
  if (spec.maxExclusivo ? escalado >= max : escalado > max) return { ok: false, motivo: 'ACIMA' }

  const valor = Number(`${n.negativo ? '-' : ''}${n.inteiro}${n.fracao ? '.' + n.fracao : ''}`)
  return { ok: true, valor: valor === 0 ? 0 : valor } // normaliza -0
}

// ============================================================================
// Presets (constantes)
// ============================================================================

/** Dimensões do item (R7.11): > 0 e ≤ 99.999,99 mm, 2 casas. */
export const DIMENSAO_MM: EspecFaixa = { min: 0, max: 99999.99, minExclusivo: true, casas: 2 }
/** Dimensões do plano (R10.2): 0,00 a 99.999,99 mm, 2 casas. */
export const DIMENSAO_MM_PLANO: EspecFaixa = { min: 0, max: 99999.99, casas: 2 }
/** Ajuste Corte Micro do item, como no requirements R8.9: 0 a 100,00, 2 casas. */
export const AJUSTE_MICRO_ITEM: EspecFaixa = { min: 0, max: 100, casas: 2 }
/** Ajuste Corte Micro do plano (R10.5): −99,99 a 99,99, 2 casas. */
export const AJUSTE_MICRO_PLANO: EspecFaixa = { min: -99.99, max: 99.99, casas: 2 }
/** Parâmetro de material de atividade (R11.5, R11.6): > 0 e ≤ 99.999,99, 2 casas. */
export const PARAM_MATERIAL: EspecFaixa = { min: 0, max: 99999.99, minExclusivo: true, casas: 2 }
/** Cobertura de tinta (R10.3): 0 a 100 %, 2 casas. */
export const COBERTURA_PERC: EspecFaixa = { min: 0, max: 100, casas: 2 }
/** Tiragem (R6.2, R10.1): inteiro de 1 a 999.999.999. */
export const TIRAGEM: EspecFaixa = { min: 1, max: 999_999_999, casas: 0 }
/** Modelos do item (R6.2): inteiro de 1 a 999. */
export const MODELOS: EspecFaixa = { min: 1, max: 999, casas: 0 }
/** Conteúdo por volume (R6.4): inteiro de 1 a 999.999. */
export const CONTEUDO_POR_VOLUME: EspecFaixa = { min: 1, max: 999_999, casas: 0 }
/** Ocorrências do plano (R10.1): inteiro de 1 a 99. */
export const OCORRENCIAS: EspecFaixa = { min: 1, max: 99, casas: 0 }

// Suporte Não Cadastrado (R12.5, R12.6)
export const NC_GRAMATURA: EspecFaixa = { min: 1, max: 2000, casas: 2 }
export const NC_CUSTO_KG: EspecFaixa = { min: 0.01, max: 999_999.99, casas: 2 }
export const NC_FRETE_KG: EspecFaixa = { min: 0, max: 999_999.99, casas: 2 }
export const NC_CREDITO_PERC: EspecFaixa = { min: 0, max: 100, casas: 2 }
export const NC_ESPESSURA_MICRAS: EspecFaixa = { min: 0, max: 10_000, casas: 2 }

// ============================================================================
// Cores "NxM" (R10.3)
// ============================================================================

export const LIMITE_CORES = 12

export type ResultadoCores =
  | { ok: true; frente: number; verso: number }
  | { ok: false; motivo: 'VAZIO' | 'FORMATO' | 'ACIMA' }

/** `5x0`, `5 x 0`, `5X0`: N e M inteiros de 0 a 12. */
export function parseCores(entrada: string | null | undefined): ResultadoCores {
  if (entrada === null || entrada === undefined || entrada.trim() === '') return { ok: false, motivo: 'VAZIO' }
  const m = /^(\d+)\s*[xX]\s*(\d+)$/.exec(entrada.trim())
  if (!m) return { ok: false, motivo: 'FORMATO' }
  const frente = Number(m[1])
  const verso = Number(m[2])
  if (!Number.isSafeInteger(frente) || !Number.isSafeInteger(verso)) return { ok: false, motivo: 'ACIMA' }
  if (frente > LIMITE_CORES || verso > LIMITE_CORES) return { ok: false, motivo: 'ACIMA' }
  return { ok: true, frente, verso }
}
