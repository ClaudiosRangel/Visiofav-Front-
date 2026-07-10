import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { deveExibirLinkKardex, deveRedirecionarKardex } from './useEmpresaAtual'

describe('deveExibirLinkKardex', () => {
  /**
   * Property 14: Visibilidade do link de navegação do Kardex depende
   * exclusivamente de `usaWms`.
   * Validates: Requirements 9.1, 9.2
   */
  it('retorna exatamente !usaWms para qualquer valor booleano', () => {
    fc.assert(
      fc.property(fc.boolean(), (usaWms) => {
        expect(deveExibirLinkKardex(usaWms)).toBe(!usaWms)
      }),
      { numRuns: 100 },
    )
  })

  it('casos explícitos: true retorna false, false retorna true', () => {
    expect(deveExibirLinkKardex(true)).toBe(false)
    expect(deveExibirLinkKardex(false)).toBe(true)
  })
})

describe('deveRedirecionarKardex', () => {
  /**
   * Property 15: Redirecionamento por acesso direto ao Kardex é a conjunção
   * exata de `usaWms` e aviso não dispensado.
   * Validates: Requirements 9.3, 9.4
   */
  it('retorna exatamente usaWms && !avisoDispensado para quaisquer valores booleanos', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), (usaWms, avisoDispensado) => {
        expect(deveRedirecionarKardex(usaWms, avisoDispensado)).toBe(usaWms && !avisoDispensado)
      }),
      { numRuns: 100 },
    )
  })

  it('tabela verdade explícita', () => {
    expect(deveRedirecionarKardex(true, false)).toBe(true)
    expect(deveRedirecionarKardex(true, true)).toBe(false)
    expect(deveRedirecionarKardex(false, false)).toBe(false)
    expect(deveRedirecionarKardex(false, true)).toBe(false)
  })

  it('determinismo: mesma entrada produz sempre o mesmo resultado', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), (usaWms, avisoDispensado) => {
        const primeiraChamada = deveRedirecionarKardex(usaWms, avisoDispensado)
        const segundaChamada = deveRedirecionarKardex(usaWms, avisoDispensado)
        expect(segundaChamada).toBe(primeiraChamada)
      }),
      { numRuns: 100 },
    )
  })
})
