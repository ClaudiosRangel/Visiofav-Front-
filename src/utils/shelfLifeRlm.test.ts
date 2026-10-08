import { describe, it, expect } from 'vitest'
import { rlmPercentParaDias, diasParaRlmPercent, estadoCamposShelfLife } from './shelfLifeRlm'

describe('rlmPercentParaDias', () => {
  it('calcula dias a partir do % e do total', () => {
    expect(rlmPercentParaDias(75, 365)).toBe(274) // round(273.75)
    expect(rlmPercentParaDias(50, 100)).toBe(50)
  })
  it('retorna null sem total ou com valores inválidos', () => {
    expect(rlmPercentParaDias(75, null)).toBeNull()
    expect(rlmPercentParaDias(null, 365)).toBeNull()
    expect(rlmPercentParaDias(75, 0)).toBeNull()
  })
})

describe('diasParaRlmPercent', () => {
  it('calcula % a partir dos dias e do total', () => {
    expect(diasParaRlmPercent(270, 365)).toBe(74) // round(73.9)
    expect(diasParaRlmPercent(50, 100)).toBe(50)
  })
  it('retorna null sem total ou com valores inválidos', () => {
    expect(diasParaRlmPercent(270, null)).toBeNull()
    expect(diasParaRlmPercent(null, 365)).toBeNull()
    expect(diasParaRlmPercent(270, 0)).toBeNull()
  })
})

describe('estadoCamposShelfLife', () => {
  it('inibe RLM quando dias preenchido', () => {
    expect(estadoCamposShelfLife(30, null)).toEqual({ diasDesabilitado: false, rlmDesabilitado: true })
  })
  it('inibe dias quando RLM preenchido', () => {
    expect(estadoCamposShelfLife(null, 75)).toEqual({ diasDesabilitado: true, rlmDesabilitado: false })
  })
  it('ambos livres quando vazios', () => {
    expect(estadoCamposShelfLife(null, null)).toEqual({ diasDesabilitado: false, rlmDesabilitado: false })
  })
  it('ambos livres quando ambos preenchidos (não trava edição posterior)', () => {
    expect(estadoCamposShelfLife(30, 75)).toEqual({ diasDesabilitado: false, rlmDesabilitado: false })
  })
})
