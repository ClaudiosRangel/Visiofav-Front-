import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { deveExibirAlertaDivergencia, deveExibirCampoTransporte } from './transporteWms'

describe('deveExibirAlertaDivergencia', () => {
  /**
   * Property 1: Indicador de alerta de divergência de transporte depende
   * exclusivamente do conteúdo do campo.
   * Validates: Requirements 1.3, 1.4, 1.6
   */
  it('retorna true se e somente se o valor, após trim(), tem comprimento maior que zero', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(deveExibirAlertaDivergencia(s)).toBe(s.trim().length > 0)
      }),
      { numRuns: 100 },
    )
  })

  it('retorna sempre false para null e undefined', () => {
    expect(deveExibirAlertaDivergencia(null)).toBe(false)
    expect(deveExibirAlertaDivergencia(undefined)).toBe(false)
  })

  it('retorna false para strings compostas somente por espaços em branco', () => {
    fc.assert(
      fc.property(
        fc
          .array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1 })
          .map((chars) => chars.join('')),
        (whitespaceOnly) => {
          expect(deveExibirAlertaDivergencia(whitespaceOnly)).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('é puramente determinístico: mesma entrada produz sempre o mesmo resultado, sem estado oculto', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.string(), fc.constant(null), fc.constant(undefined)),
        (input) => {
          const primeiraChamada = deveExibirAlertaDivergencia(input)
          const segundaChamada = deveExibirAlertaDivergencia(input)
          const terceiraChamada = deveExibirAlertaDivergencia(input)
          expect(segundaChamada).toBe(primeiraChamada)
          expect(terceiraChamada).toBe(primeiraChamada)
        },
      ),
      { numRuns: 100 },
    )
  })
})

describe('deveExibirCampoTransporte', () => {
  /**
   * Property 2: Exibição de cada campo de transporte da Nota_Entrada é decidida de forma independente
   * Validates: Requirements 1.7, 1.8
   */
  it('retorna true se e somente se o valor, após trim(), tem comprimento maior que zero', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(deveExibirCampoTransporte(s)).toBe(s.trim().length > 0)
      }),
      { numRuns: 100 },
    )
  })

  it('retorna sempre false para null e undefined', () => {
    expect(deveExibirCampoTransporte(null)).toBe(false)
    expect(deveExibirCampoTransporte(undefined)).toBe(false)
  })

  it('a decisão de deveExibirCampoTransporte para um valor independe de qualquer outro valor de transporte', () => {
    const valorOuAusente = fc.oneof(fc.string(), fc.constant(null), fc.constant(undefined))

    fc.assert(
      fc.property(valorOuAusente, valorOuAusente, (ufValue, rntcValue) => {
        const decisaoUfAntes = deveExibirCampoTransporte(ufValue)
        const decisaoRntcAntes = deveExibirCampoTransporte(rntcValue)

        // Recalcular a decisão do outro campo "no meio" não altera o resultado já obtido
        deveExibirCampoTransporte(rntcValue)
        expect(deveExibirCampoTransporte(ufValue)).toBe(decisaoUfAntes)

        deveExibirCampoTransporte(ufValue)
        expect(deveExibirCampoTransporte(rntcValue)).toBe(decisaoRntcAntes)

        // Cada decisão, isoladamente, ainda respeita a regra de trim/comprimento do seu próprio valor
        const esperadoUf = typeof ufValue === 'string' && ufValue.trim().length > 0
        const esperadoRntc = typeof rntcValue === 'string' && rntcValue.trim().length > 0
        expect(decisaoUfAntes).toBe(esperadoUf)
        expect(decisaoRntcAntes).toBe(esperadoRntc)
      }),
      { numRuns: 100 },
    )
  })
})
