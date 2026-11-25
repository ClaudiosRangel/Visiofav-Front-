import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { MAX_TINTAS, tintasDaCobertura, totalDeCores, type TintasPadrao } from './tintas-item'

// Composição do sistema de referência (CoberturasTinta + CoberturasTintaxCodTinta).
const escala: TintasPadrao = {
  umaCor: { tinta: 'Escala', perc: 20 },
  cores: [...Array(4).fill({ tinta: 'Escala', perc: 10 }), ...Array(4).fill({ tinta: 'Especiais', perc: 10 })],
}
const especial: TintasPadrao = { umaCor: { tinta: 'Metálica', perc: 20 }, cores: Array(4).fill({ tinta: 'Especiais', perc: 10 }) }
const cadastro = [
  { id: 't-esc', nome: 'Escala', precoKg: 48.5 },
  { id: 't-esp', nome: 'Especiais', precoKg: 60 },
  { id: 't-met', nome: 'Metalica', precoKg: 0 },
]

describe('cores do plano', () => {
  it('soma frente e verso', () => {
    expect(totalDeCores('4x0')).toBe(4)
    expect(totalDeCores('4 x 1')).toBe(5)
    expect(totalDeCores('1x0')).toBe(1)
    expect(totalDeCores('')).toBe(0)
    expect(totalDeCores('abc')).toBe(0)
  })
})

describe('tintas da cobertura', () => {
  it('Escala 4x0: quatro linhas de Escala a 10% com o preço do cadastro', () => {
    const l = tintasDaCobertura(escala, '4x0', cadastro)
    expect(l).toHaveLength(4)
    expect(l.every((c) => c.tinta === 'Escala' && c.coberturaPercent === 10 && c.precoKg === 48.5 && c.tintaId === 't-esc')).toBe(true)
    expect(l[0].tipo).toBe('CMYK')
  })

  it('Escala 5x0: quatro de Escala e uma de Especiais', () => {
    const l = tintasDaCobertura(escala, '5x0', cadastro)
    expect(l.map((c) => c.tinta)).toEqual(['Escala', 'Escala', 'Escala', 'Escala', 'Especiais'])
    expect(l[4].tipo).toBe('PANTONE')
  })

  it('1 cor usa a tinta de uma cor (Especial → Metálica 20%), casando o cadastro sem acento', () => {
    const l = tintasDaCobertura(especial, '1x0', cadastro)
    expect(l).toHaveLength(1)
    expect(l[0]).toMatchObject({ tinta: 'Metalica', coberturaPercent: 20, tintaId: 't-met' })
  })

  it('sequência menor que as cores repete a última; sem cadastro o preço fica 0', () => {
    const l = tintasDaCobertura(especial, '6x0', [])
    expect(l).toHaveLength(6)
    expect(l.every((c) => c.tinta === 'Especiais' && c.precoKg === 0 && c.tintaId === null)).toBe(true)
  })

  it('sem composição ou sem cores: nada', () => {
    expect(tintasDaCobertura(null, '4x0', cadastro)).toEqual([])
    expect(tintasDaCobertura(escala, '0x0', cadastro)).toEqual([])
    expect(tintasDaCobertura(escala, '', cadastro)).toEqual([])
  })

  it('o número de linhas é o total de cores, limitado ao máximo da janela', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 12 }), fc.integer({ min: 0, max: 12 }), (f, v) => {
        const l = tintasDaCobertura(escala, `${f}x${v}`, cadastro)
        expect(l).toHaveLength(Math.min(f + v, MAX_TINTAS))
      }),
    )
  })
})
