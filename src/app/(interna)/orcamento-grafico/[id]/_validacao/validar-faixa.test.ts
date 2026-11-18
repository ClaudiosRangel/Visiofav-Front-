import { describe, expect, it } from 'vitest'
import {
  AJUSTE_MICRO_ITEM,
  AJUSTE_MICRO_PLANO,
  COBERTURA_PERC,
  DIMENSAO_MM,
  DIMENSAO_MM_PLANO,
  NC_CREDITO_PERC,
  NC_CUSTO_KG,
  NC_ESPESSURA_MICRAS,
  NC_FRETE_KG,
  NC_GRAMATURA,
  PARAM_MATERIAL,
  TIRAGEM,
  parseCores,
  validarFaixa,
  type EspecFaixa,
  type MotivoFaixa,
} from './validar-faixa'

const ok = (v: number) => ({ ok: true, valor: v })
const no = (motivo: MotivoFaixa) => ({ ok: false, motivo })

describe('validarFaixa — DIMENSAO_MM (> 0, ≤ 99.999,99, 2 casas)', () => {
  it.each([
    ['0', no('ABAIXO')],
    ['0,00', no('ABAIXO')],
    ['0,01', ok(0.01)],
    ['0.01', ok(0.01)],
    ['99999,99', ok(99999.99)],
    ['99999.99', ok(99999.99)],
    ['99.999,99', ok(99999.99)],
    ['100000,00', no('ACIMA')],
    ['100.000,00', no('ACIMA')],
    ['99999,991', no('CASAS')],
    ['1,234', no('CASAS')],
    ['1,230', no('CASAS')],
    ['', no('VAZIO')],
    ['   ', no('VAZIO')],
    ['abc', no('NAO_NUMERICO')],
    ['1,2,3', no('NAO_NUMERICO')],
    ['1e3', no('NAO_NUMERICO')],
    [',', no('NAO_NUMERICO')],
    ['-', no('NAO_NUMERICO')],
    ['-1', no('ABAIXO')],
    ['-0', no('ABAIXO')],
    ['-0,00', no('ABAIXO')],
    [' 12,5 ', ok(12.5)],
    [',5', ok(0.5)],
    ['5,', ok(5)],
  ])('%j', (entrada, esperado) => {
    expect(validarFaixa(entrada, DIMENSAO_MM)).toEqual(esperado)
  })

  it('vazio, null e undefined', () => {
    expect(validarFaixa(null, DIMENSAO_MM)).toEqual(no('VAZIO'))
    expect(validarFaixa(undefined, DIMENSAO_MM)).toEqual(no('VAZIO'))
  })

  it('aceita number e rejeita não finitos', () => {
    expect(validarFaixa(12.5, DIMENSAO_MM)).toEqual(ok(12.5))
    expect(validarFaixa(Number.NaN, DIMENSAO_MM)).toEqual(no('NAO_NUMERICO'))
    expect(validarFaixa(Number.POSITIVE_INFINITY, DIMENSAO_MM)).toEqual(no('NAO_NUMERICO'))
  })

  it('conta casas pela string digitada, sem erro de ponto flutuante', () => {
    // 1.005 e 0.07 têm erro de float; a contagem é por dígitos digitados.
    expect(validarFaixa('1,005', DIMENSAO_MM)).toEqual(no('CASAS'))
    expect(validarFaixa('0,07', DIMENSAO_MM)).toEqual(ok(0.07))
    expect(validarFaixa('1,10', DIMENSAO_MM)).toEqual(ok(1.1))
  })
})

describe('validarFaixa — DIMENSAO_MM_PLANO (0,00 a 99.999,99)', () => {
  it('aceita 0 e 0,00; rejeita 100.000,00', () => {
    expect(validarFaixa('0', DIMENSAO_MM_PLANO)).toEqual(ok(0))
    expect(validarFaixa('0,00', DIMENSAO_MM_PLANO)).toEqual(ok(0))
    expect(validarFaixa('100000,00', DIMENSAO_MM_PLANO)).toEqual(no('ACIMA'))
  })

  it('-0 vale 0 (nunca devolve -0)', () => {
    const r = validarFaixa('-0', DIMENSAO_MM_PLANO)
    expect(r).toEqual(ok(0))
    expect(Object.is((r as { valor: number }).valor, 0)).toBe(true)
    expect(Object.is((validarFaixa(-0, DIMENSAO_MM_PLANO) as { valor: number }).valor, 0)).toBe(true)
  })
})

describe('validarFaixa — AJUSTE_MICRO_ITEM (0 a 100,00 — requirements R8.9)', () => {
  it.each([
    ['0', ok(0)],
    ['0,01', ok(0.01)],
    ['100', ok(100)],
    ['100,00', ok(100)],
    ['100,01', no('ACIMA')],
    ['-0,01', no('ABAIXO')],
    ['5,555', no('CASAS')],
    ['x', no('NAO_NUMERICO')],
  ])('%j', (entrada, esperado) => {
    expect(validarFaixa(entrada, AJUSTE_MICRO_ITEM)).toEqual(esperado)
  })
})

describe('validarFaixa — AJUSTE_MICRO_PLANO (−99,99 a 99,99)', () => {
  it.each([
    ['-99,99', ok(-99.99)],
    ['99,99', ok(99.99)],
    ['-100', no('ABAIXO')],
    ['-99,991', no('CASAS')],
    ['100', no('ACIMA')],
    ['0', ok(0)],
    ['-0', ok(0)],
    ['+1,5', ok(1.5)],
  ])('%j', (entrada, esperado) => {
    expect(validarFaixa(entrada, AJUSTE_MICRO_PLANO)).toEqual(esperado)
  })
})

describe('validarFaixa — PARAM_MATERIAL (> 0, ≤ 99.999,99)', () => {
  it.each([
    ['', no('VAZIO')],
    ['0', no('ABAIXO')],
    ['-1', no('ABAIXO')],
    ['0,01', ok(0.01)],
    ['99999,99', ok(99999.99)],
    ['100000', no('ACIMA')],
    ['texto', no('NAO_NUMERICO')],
  ])('%j', (entrada, esperado) => {
    expect(validarFaixa(entrada, PARAM_MATERIAL)).toEqual(esperado)
  })
})

describe('validarFaixa — COBERTURA_PERC (0 a 100)', () => {
  it.each([
    ['0', ok(0)],
    ['100', ok(100)],
    ['100,01', no('ACIMA')],
    ['33,33', ok(33.33)],
    ['33,333', no('CASAS')],
  ])('%j', (entrada, esperado) => {
    expect(validarFaixa(entrada, COBERTURA_PERC)).toEqual(esperado)
  })
})

describe('validarFaixa — TIRAGEM (inteiro 1 a 999.999.999)', () => {
  it.each([
    ['1', ok(1)],
    ['0', no('ABAIXO')],
    ['999999999', ok(999999999)],
    ['1000000000', no('ACIMA')],
    ['10,5', no('CASAS')],
    ['10,0', no('CASAS')],
    ['', no('VAZIO')],
  ])('%j', (entrada, esperado) => {
    expect(validarFaixa(entrada, TIRAGEM)).toEqual(esperado)
  })

  it('número inteiro', () => {
    expect(validarFaixa(6000, TIRAGEM)).toEqual(ok(6000))
  })
})

describe('validarFaixa — presets do NC (R12)', () => {
  it('gramatura 1 a 2.000', () => {
    expect(validarFaixa('0,99', NC_GRAMATURA)).toEqual(no('ABAIXO'))
    expect(validarFaixa('1', NC_GRAMATURA)).toEqual(ok(1))
    expect(validarFaixa('2000', NC_GRAMATURA)).toEqual(ok(2000))
    expect(validarFaixa('2000,01', NC_GRAMATURA)).toEqual(no('ACIMA'))
  })

  it('custo por kg 0,01 a 999.999,99', () => {
    expect(validarFaixa('0', NC_CUSTO_KG)).toEqual(no('ABAIXO'))
    expect(validarFaixa('0,01', NC_CUSTO_KG)).toEqual(ok(0.01))
    expect(validarFaixa('999999,99', NC_CUSTO_KG)).toEqual(ok(999999.99))
    expect(validarFaixa('1000000', NC_CUSTO_KG)).toEqual(no('ACIMA'))
  })

  it('frete por kg 0 a 999.999,99', () => {
    expect(validarFaixa('0', NC_FRETE_KG)).toEqual(ok(0))
    expect(validarFaixa('999999,99', NC_FRETE_KG)).toEqual(ok(999999.99))
    expect(validarFaixa('1000000', NC_FRETE_KG)).toEqual(no('ACIMA'))
  })

  it('créditos 0 a 100', () => {
    expect(validarFaixa('0', NC_CREDITO_PERC)).toEqual(ok(0))
    expect(validarFaixa('100', NC_CREDITO_PERC)).toEqual(ok(100))
    expect(validarFaixa('100,01', NC_CREDITO_PERC)).toEqual(no('ACIMA'))
    expect(validarFaixa('-1', NC_CREDITO_PERC)).toEqual(no('ABAIXO'))
  })

  it('espessura 0 a 10.000 micras', () => {
    expect(validarFaixa('0', NC_ESPESSURA_MICRAS)).toEqual(ok(0))
    expect(validarFaixa('10000', NC_ESPESSURA_MICRAS)).toEqual(ok(10000))
    expect(validarFaixa('10000,01', NC_ESPESSURA_MICRAS)).toEqual(no('ACIMA'))
  })
})

describe('validarFaixa — limites exclusivos', () => {
  const spec: EspecFaixa = { min: 0, max: 10, minExclusivo: true, maxExclusivo: true, casas: 1 }
  it('exclui os dois extremos', () => {
    expect(validarFaixa('0', spec)).toEqual(no('ABAIXO'))
    expect(validarFaixa('0,1', spec)).toEqual(ok(0.1))
    expect(validarFaixa('9,9', spec)).toEqual(ok(9.9))
    expect(validarFaixa('10', spec)).toEqual(no('ACIMA'))
  })
})

describe('parseCores', () => {
  it.each([
    ['5x0', { ok: true, frente: 5, verso: 0 }],
    ['0x0', { ok: true, frente: 0, verso: 0 }],
    ['12x12', { ok: true, frente: 12, verso: 12 }],
    [' 4 X 4 ', { ok: true, frente: 4, verso: 4 }],
    ['13x0', { ok: false, motivo: 'ACIMA' }],
    ['0x13', { ok: false, motivo: 'ACIMA' }],
    ['5', { ok: false, motivo: 'FORMATO' }],
    ['5x', { ok: false, motivo: 'FORMATO' }],
    ['x5', { ok: false, motivo: 'FORMATO' }],
    ['-1x0', { ok: false, motivo: 'FORMATO' }],
    ['1,5x0', { ok: false, motivo: 'FORMATO' }],
    ['5x0x1', { ok: false, motivo: 'FORMATO' }],
    ['', { ok: false, motivo: 'VAZIO' }],
  ])('%j', (entrada, esperado) => {
    expect(parseCores(entrada)).toEqual(esperado)
  })

  it('null e undefined são VAZIO', () => {
    expect(parseCores(null)).toEqual({ ok: false, motivo: 'VAZIO' })
    expect(parseCores(undefined)).toEqual({ ok: false, motivo: 'VAZIO' })
  })
})
