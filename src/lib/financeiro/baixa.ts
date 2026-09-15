/**
 * Financeiro (frontend) — espelho puro do cálculo de baixa do backend
 * (`baixa-calculo.ts`). Usado para o resumo em tempo real do modal de baixa.
 *
 * PAGAR:   liquido = valor + juros + multa - desconto + tarifa
 * RECEBER: liquido = valor + juros + multa - desconto - tarifa
 */

export type TipoBaixa = 'PAGAR' | 'RECEBER'

export interface ComponentesBaixa {
  valor: number
  juros?: number
  multa?: number
  desconto?: number
  tarifa?: number
}

export interface ResumoBaixa {
  acrescimos: number
  desconto: number
  tarifa: number
  liquido: number
  valido: boolean
}

function num(v: number | undefined): number {
  const n = Number(v)
  return Number.isFinite(n) && n > 0 ? n : 0
}

function centavos(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100
}

export function calcularLiquidoBaixa(tipo: TipoBaixa, c: ComponentesBaixa): ResumoBaixa {
  const valor = num(c.valor)
  const juros = num(c.juros)
  const multa = num(c.multa)
  const desconto = num(c.desconto)
  const tarifa = num(c.tarifa)

  const acrescimos = centavos(juros + multa)
  const base = valor + acrescimos - desconto
  const liquido = centavos(tipo === 'PAGAR' ? base + tarifa : base - tarifa)

  return { acrescimos, desconto: centavos(desconto), tarifa: centavos(tarifa), liquido, valido: liquido >= 0 }
}
