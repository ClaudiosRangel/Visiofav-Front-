import { describe, it, expect } from 'vitest'
import { formatarBRL, formatarCompetencia, formatarData, AGING_LABELS } from './format'

describe('formatarBRL', () => {
  it('formata valores em reais', () => {
    expect(formatarBRL(1234.5)).toContain('1.234,50')
    expect(formatarBRL(0)).toContain('0,00')
  })
  it('trata valores inválidos como zero', () => {
    expect(formatarBRL(NaN)).toBe('R$ 0,00')
    expect(formatarBRL(Infinity)).toBe('R$ 0,00')
  })
})

describe('formatarCompetencia', () => {
  it('converte YYYY-MM em MM/YYYY', () => {
    expect(formatarCompetencia('2026-06')).toBe('06/2026')
  })
  it('retorna a entrada quando o formato não casa', () => {
    expect(formatarCompetencia('junho')).toBe('junho')
  })
})

describe('formatarData', () => {
  it('formata ISO em dd/mm/aaaa', () => {
    expect(formatarData('2026-06-15T00:00:00Z')).toBe('15/06/2026')
  })
  it('retorna entrada em data inválida', () => {
    expect(formatarData('xx')).toBe('xx')
  })
})

describe('AGING_LABELS', () => {
  it('cobre todas as 5 faixas', () => {
    expect(Object.keys(AGING_LABELS)).toHaveLength(5)
    expect(AGING_LABELS.A_VENCER).toBeTruthy()
    expect(AGING_LABELS.D90_MAIS).toBeTruthy()
  })
})
