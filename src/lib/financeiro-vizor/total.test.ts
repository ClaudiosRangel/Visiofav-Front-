/**
 * Teste property-based (fast-check + Vitest) do cálculo do Total Mensal do
 * contrato no painel Financeiro Vizor.
 *
 * Cobre a Correctness Property 1 do design: o Total Mensal exibido pelo
 * `ContratoForm` é a soma exata dos preços do form, e alterar um preço atualiza
 * o total pela mesma diferença. A lógica pura foi extraída para
 * `calcularTotalForm(precos)`, que é o que o componente usa para derivar o valor
 * exibido — testá-la aqui prova a propriedade sem precisar renderizar.
 *
 * **Validates: Requirements 3.4**
 */

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { calcularTotalForm, type PrecosPorModulo } from './total'
import { MODULOS, PRECO_MAX, type Modulo } from './types'

/**
 * Gerador de preços válidos por módulo: valores em centavos dentro do intervalo
 * permitido (0..999.999.999,99, no máx. duas casas decimais), um por módulo.
 */
const arbPrecos: fc.Arbitrary<PrecosPorModulo> = fc
  .record(
    MODULOS.reduce(
      (acc, modulo) => {
        acc[modulo] = fc
          .integer({ min: 0, max: Math.round(PRECO_MAX * 100) })
          .map((centavos) => centavos / 100)
        return acc
      },
      {} as Record<Modulo, fc.Arbitrary<number>>,
    ),
  )
  .map((r) => r as PrecosPorModulo)

/** Soma de referência independente da implementação, para comparação. */
function somaReferencia(precos: PrecosPorModulo): number {
  let soma = 0
  for (const modulo of MODULOS) soma += precos[modulo]
  return soma
}

/**
 * Verifica igualdade de dois números com tolerância RELATIVA à grandeza.
 *
 * Os valores de preço vão até ~1 bilhão; a soma de vários deles carrega o erro
 * de arredondamento IEEE-754 inerente (na casa de 1e-6..1e-7 em magnitudes de
 * 1e9). Uma tolerância absoluta fixa (ex.: `toBeCloseTo(x, 6)`) é rígida demais
 * nessa escala — a propriedade matemática (soma exata / mesma diferença) vale,
 * o resíduo é só ponto flutuante. Por isso comparamos com tolerância relativa
 * à magnitude dos operandos (mais um piso absoluto para valores próximos de 0).
 */
function esperaProximoRelativo(recebido: number, esperado: number, ...magnitudes: number[]): void {
  const escala = Math.max(1, Math.abs(esperado), ...magnitudes.map(Math.abs))
  const tolerancia = escala * 1e-9 + 1e-6
  expect(Math.abs(recebido - esperado)).toBeLessThanOrEqual(tolerancia)
}

describe('Property 1: Total mensal exibido = soma dos preços do form', () => {
  it('o total é igual à soma exata dos seis preços', () => {
    fc.assert(
      fc.property(arbPrecos, (precos) => {
        const total = calcularTotalForm(precos)
        esperaProximoRelativo(total, somaReferencia(precos))
      }),
    )
  })

  it('alterar um preço muda o total exatamente pela mesma diferença', () => {
    fc.assert(
      fc.property(
        arbPrecos,
        fc.constantFrom(...MODULOS),
        fc.integer({ min: 0, max: Math.round(PRECO_MAX * 100) }).map((c) => c / 100),
        (precos, modulo, novoPreco) => {
          const totalAntes = calcularTotalForm(precos)
          const alterado: PrecosPorModulo = { ...precos, [modulo]: novoPreco }
          const totalDepois = calcularTotalForm(alterado)

          const diferencaPreco = novoPreco - precos[modulo]
          const diferencaTotal = totalDepois - totalAntes

          // Tolerância relativa à grandeza dos totais somados (casa do bilhão).
          esperaProximoRelativo(diferencaTotal, diferencaPreco, totalAntes, totalDepois)
        },
      ),
    )
  })

  it('preços todos zero resultam em total zero', () => {
    const zeros = MODULOS.reduce((acc, modulo) => {
      acc[modulo] = 0
      return acc
    }, {} as PrecosPorModulo)
    expect(calcularTotalForm(zeros)).toBe(0)
  })
})
