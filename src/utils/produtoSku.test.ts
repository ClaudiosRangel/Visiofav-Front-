import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { deveExibirAlertaEnriquecimentoSku, deveExibirSecaoItensPendentes, type ItemPendenteXml } from './produtoSku'

describe('deveExibirAlertaEnriquecimentoSku', () => {
  /**
   * Property 3: Alerta de falha de enriquecimento de SKU depende
   * exclusivamente do conteúdo de `motivoFalhaEnriquecimentoSku`.
   * Validates: Requirements 2.2, 2.3, 2.5
   */
  it('retorna true se e somente se o valor, após trim(), tem comprimento maior que zero', () => {
    fc.assert(
      fc.property(fc.string(), (s) => {
        expect(deveExibirAlertaEnriquecimentoSku(s)).toBe(s.trim().length > 0)
      }),
      { numRuns: 100 },
    )
  })

  it('retorna sempre false para null e undefined', () => {
    expect(deveExibirAlertaEnriquecimentoSku(null)).toBe(false)
    expect(deveExibirAlertaEnriquecimentoSku(undefined)).toBe(false)
  })

  it('retorna false para strings compostas somente por espaços em branco', () => {
    fc.assert(
      fc.property(
        fc
          .array(fc.constantFrom(' ', '\t', '\n', '\r'), { minLength: 1 })
          .map((chars) => chars.join('')),
        (whitespaceOnly) => {
          expect(deveExibirAlertaEnriquecimentoSku(whitespaceOnly)).toBe(false)
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
          const primeiraChamada = deveExibirAlertaEnriquecimentoSku(input)
          const segundaChamada = deveExibirAlertaEnriquecimentoSku(input)
          const terceiraChamada = deveExibirAlertaEnriquecimentoSku(input)
          expect(segundaChamada).toBe(primeiraChamada)
          expect(terceiraChamada).toBe(primeiraChamada)
        },
      ),
      { numRuns: 100 },
    )
  })
})

describe('deveExibirSecaoItensPendentes', () => {
  /**
   * Property 4: Seção de itens pendentes é exibida se e somente se o array
   * recebido não é vazio, preservando seu conteúdo.
   * Validates: Requirements 3.1, 3.2
   */
  const itemPendenteArbitrary = fc.record<ItemPendenteXml>({
    cProd: fc.string(),
    xProd: fc.string(),
    motivo: fc.string(),
  })

  it('retorna true se e somente se o array possui ao menos um elemento', () => {
    fc.assert(
      fc.property(fc.array(itemPendenteArbitrary), (itens) => {
        expect(deveExibirSecaoItensPendentes(itens)).toBe(itens.length > 0)
      }),
      { numRuns: 100 },
    )
  })

  it('retorna false para array vazio', () => {
    expect(deveExibirSecaoItensPendentes([])).toBe(false)
  })

  it('retorna false para null e undefined', () => {
    expect(deveExibirSecaoItensPendentes(null)).toBe(false)
    expect(deveExibirSecaoItensPendentes(undefined)).toBe(false)
  })

  it('preserva o conteúdo do array de entrada, sem mutar ou descartar elementos', () => {
    fc.assert(
      fc.property(fc.array(itemPendenteArbitrary), (itens) => {
        const copiaAntes = JSON.parse(JSON.stringify(itens))
        deveExibirSecaoItensPendentes(itens)
        expect(itens).toEqual(copiaAntes)
      }),
      { numRuns: 100 },
    )
  })
})
