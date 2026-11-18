import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  escolherPassoEscalaMin,
  faixaDeCarga,
  gerarMarcadoresEscala,
  nivelDetalheBarra,
} from './gantt-layout'
import { corDaLinha, COR_SEM_LINHA } from './gantt-linha'

describe('escolherPassoEscalaMin', () => {
  it('zoom aproximado = hora; afastado = dia/semana', () => {
    expect(escolherPassoEscalaMin(2.5)).toBe(60)
    expect(escolherPassoEscalaMin(1.2)).toBe(60)
    expect(escolherPassoEscalaMin(0.17)).toBe(360)
    expect(escolherPassoEscalaMin(0.05)).toBe(1440)
    expect(escolherPassoEscalaMin(0.001)).toBe(10080)
  })

  it('rótulos nunca ficam mais próximos que 58px (exceto no passo máximo)', () => {
    fc.assert(
      fc.property(fc.double({ min: 0.006, max: 6, noNaN: true }), (ppm) => {
        expect(escolherPassoEscalaMin(ppm) * ppm).toBeGreaterThanOrEqual(58)
      }),
      { numRuns: 200, seed: 20261118 },
    )
  })
})

describe('gerarMarcadoresEscala', () => {
  const ini = new Date(2026, 10, 16, 10, 30).getTime()
  const fim = new Date(2026, 10, 23, 8, 0).getTime()

  it('ordenados, dentro do intervalo e com espaçamento uniforme na escala de horas', () => {
    const m = gerarMarcadoresEscala(ini, ini + 12 * 3600000, 1.2)
    expect(m.length).toBeGreaterThan(5)
    for (const x of m) {
      expect(x.ms).toBeGreaterThanOrEqual(ini)
      expect(x.ms).toBeLessThan(ini + 12 * 3600000)
    }
    for (let i = 1; i < m.length; i++) expect(m[i].ms).toBeGreaterThan(m[i - 1].ms)
  })

  it('no zoom de dia, cada marcador cai à meia-noite e é forte', () => {
    const m = gerarMarcadoresEscala(ini, fim, 0.05)
    expect(m.length).toBe(7)
    for (const x of m) {
      const d = new Date(x.ms)
      expect(d.getHours()).toBe(0)
      expect(x.forte).toBe(true)
    }
    expect(m[0].rotulo).toMatch(/^ter 17\/11$/)
  })

  it('na escala semanal alinha pela segunda-feira', () => {
    const m = gerarMarcadoresEscala(new Date(2026, 10, 1).getTime(), new Date(2026, 11, 31).getTime(), 0.001)
    for (const x of m) expect(new Date(x.ms).getDay()).toBe(1)
  })

  it('intervalo inválido devolve vazio', () => {
    expect(gerarMarcadoresEscala(10, 5, 1)).toEqual([])
  })
})

describe('nivelDetalheBarra / faixaDeCarga', () => {
  it('reduz o detalhe ao afastar', () => {
    expect(nivelDetalheBarra(1.2)).toBe('completo')
    expect(nivelDetalheBarra(0.17)).toBe('compacto')
    expect(nivelDetalheBarra(0.05)).toBe('minimo')
  })
  it('faixas de carga', () => {
    expect(faixaDeCarga(0)).toBe('livre')
    expect(faixaDeCarga(40)).toBe('normal')
    expect(faixaDeCarga(85)).toBe('atencao')
    expect(faixaDeCarga(130)).toBe('sobrecarga')
  })
})

describe('corDaLinha', () => {
  it('linhas conhecidas têm cor fixa; desconhecidas, cor estável', () => {
    expect(corDaLinha('CARTUCHO')).toBe('#2F9E44')
    expect(corDaLinha('CAIXA')).toBe(corDaLinha('CAIXA'))
    expect(corDaLinha(null)).toBe(COR_SEM_LINHA)
  })
})
