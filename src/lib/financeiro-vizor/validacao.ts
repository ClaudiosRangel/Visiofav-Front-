/**
 * Validação no cliente do painel Financeiro Vizor.
 *
 * Espelha os limites do Zod do backend (VisioFab.Wms.Back) para dar feedback
 * imediato ao SUPER_ADMIN, bloqueando o envio antes de chamar a API. A
 * validação autoritativa continua sendo a do backend — aqui é só UX.
 *
 * Todas as funções são puras e determinísticas (sem I/O), retornando uma
 * mensagem de erro em pt-BR quando o valor é inválido, ou `null` quando é
 * válido. São cobertas por testes property-based (Correctness Properties 2, 3,
 * 4 e 5 do design).
 */

import {
  DIA_VENCIMENTO_MAX,
  DIA_VENCIMENTO_MIN,
  MESES_MAX,
  MESES_MIN,
  PRECO_MAX,
  PRECO_MIN,
} from './types'

/**
 * Valida o dia de vencimento do contrato.
 *
 * Retorna `null` se e somente se `dia` é um inteiro entre 1 e 31 (inclusive);
 * caso contrário retorna uma mensagem de erro não vazia.
 *
 * Property 2 (Validates: Requirements 3.6).
 */
export function validarDiaVencimento(dia: number): string | null {
  if (!Number.isInteger(dia) || dia < DIA_VENCIMENTO_MIN || dia > DIA_VENCIMENTO_MAX) {
    return `O dia de vencimento deve ser um número inteiro entre ${DIA_VENCIMENTO_MIN} e ${DIA_VENCIMENTO_MAX}.`
  }
  return null
}

/**
 * Valida a data do contrato.
 *
 * Retorna `null` se e somente se `data` é uma data válida (parseável) cujo valor
 * é menor ou igual à data atual (não futura). Datas inválidas ou futuras
 * retornam uma mensagem de erro não vazia.
 *
 * A comparação é feita em nível de dia (não de instante): uma data de contrato
 * com o dia de hoje é sempre válida, independentemente da hora atual.
 *
 * Property 4 (Validates: Requirements 3.7).
 */
export function validarDataContrato(data: string): string | null {
  const msgInvalida = 'A data do contrato deve ser válida e não pode ser futura.'

  if (typeof data !== 'string' || data.trim() === '') {
    return msgInvalida
  }

  const informada = new Date(data)
  if (Number.isNaN(informada.getTime())) {
    return msgInvalida
  }

  // Normaliza ambas as datas para o início do dia (UTC) para comparar por dia,
  // ignorando a hora — evita que "hoje mais tarde" seja tratado como futuro.
  const inicioDoDia = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())

  const hoje = new Date()
  if (inicioDoDia(informada) > inicioDoDia(hoje)) {
    return msgInvalida
  }

  return null
}

/**
 * Valida o preço de um módulo.
 *
 * Retorna `null` se e somente se `preco` é um número finito entre 0 e
 * 999.999.999,99 (inclusive) com no máximo duas casas decimais. Caso contrário
 * retorna uma mensagem de erro não vazia.
 *
 * Property 3 (Validates: Requirements 3.8).
 */
export function validarPreco(preco: number): string | null {
  if (!Number.isFinite(preco) || preco < PRECO_MIN || preco > PRECO_MAX) {
    return `O preço deve estar entre ${PRECO_MIN.toFixed(2)} e 999.999.999,99.`
  }
  // Checa no máximo duas casas decimais. Multiplicar por 100 e comparar com o
  // inteiro mais próximo sofre com erro de ponto flutuante que cresce com a
  // magnitude do valor (ex.: 131538.67 * 100 = 13153866.999999998), então a
  // tolerância precisa ser relativa à grandeza do número, não absoluta.
  const emCentavos = preco * 100
  const desvio = Math.abs(emCentavos - Math.round(emCentavos))
  const tolerancia = Math.max(1e-6, Math.abs(emCentavos) * Number.EPSILON * 4)
  if (desvio > tolerancia) {
    return 'O preço deve ter no máximo duas casas decimais.'
  }
  return null
}

/**
 * Valida o número de meses da geração de vencimentos em lote.
 *
 * Retorna `null` se e somente se `meses` é um inteiro entre 1 e 60 (inclusive);
 * caso contrário retorna uma mensagem de erro não vazia.
 *
 * Property 5 (Validates: Requirements 4.12).
 */
export function validarMeses(meses: number): string | null {
  if (!Number.isInteger(meses) || meses < MESES_MIN || meses > MESES_MAX) {
    return `O número de meses deve ser um inteiro entre ${MESES_MIN} e ${MESES_MAX}.`
  }
  return null
}
