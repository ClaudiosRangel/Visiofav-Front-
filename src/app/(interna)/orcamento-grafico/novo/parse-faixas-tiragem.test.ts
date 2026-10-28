import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { parseFaixasTiragem, MAX_FAIXAS_TIRAGEM } from './parse-faixas-tiragem'

describe('parseFaixasTiragem — casos de exemplo', () => {
  it('parseia lista com separador de milhar brasileiro e espaços', () => {
    expect(parseFaixasTiragem('10.000, 20.000, 50.000')).toEqual([10000, 20000, 50000])
  })

  it('aceita ponto-e-vírgula como separador', () => {
    expect(parseFaixasTiragem('1000; 2000; 3000')).toEqual([1000, 2000, 3000])
  })

  it('mistura vírgula e ponto-e-vírgula', () => {
    expect(parseFaixasTiragem('1000, 2000; 3000')).toEqual([1000, 2000, 3000])
  })

  it('ordena em ordem crescente', () => {
    expect(parseFaixasTiragem('50000, 10000, 20000')).toEqual([10000, 20000, 50000])
  })

  it('remove duplicatas (inclusive equivalentes após limpar pontos)', () => {
    expect(parseFaixasTiragem('10.000, 10000, 10.000')).toEqual([10000])
  })

  it('descarta entradas não numéricas e <= 0', () => {
    expect(parseFaixasTiragem('abc, 1000, 0, -5, 2000')).toEqual([1000, 2000])
  })

  it('descarta entradas vazias entre separadores', () => {
    expect(parseFaixasTiragem('1000,,2000, ,3000')).toEqual([1000, 2000, 3000])
  })

  it('texto vazio → lista vazia', () => {
    expect(parseFaixasTiragem('')).toEqual([])
    expect(parseFaixasTiragem('   ')).toEqual([])
  })

  it('descarta valor decimal (vírgula decimal vira dois pedaços; ponto é milhar)', () => {
    // "1.5" → remove ponto → "15" (ponto é separador de milhar, não decimal).
    expect(parseFaixasTiragem('1.5')).toEqual([15])
    // "1,5" → separa em "1" e "5".
    expect(parseFaixasTiragem('1,5')).toEqual([1, 5])
  })

  it('limita a 20 faixas (corta o excedente)', () => {
    const texto = Array.from({ length: 30 }, (_, i) => String((i + 1) * 1000)).join(',')
    const r = parseFaixasTiragem(texto)
    expect(r).toHaveLength(MAX_FAIXAS_TIRAGEM)
    expect(r[0]).toBe(1000)
    expect(r[MAX_FAIXAS_TIRAGEM - 1]).toBe(20000)
  })
})

describe('parseFaixasTiragem — propriedades', () => {
  // Gera textos a partir de listas de inteiros, formatando alguns com separador
  // de milhar, para exercitar a normalização.
  const textoDeNumeros = fc
    .array(fc.integer({ min: 1, max: 9_999_999 }), { maxLength: 40 })
    .map((nums) =>
      nums
        .map((n) => (Math.random() < 0.5 ? n.toLocaleString('pt-BR') : String(n)))
        .join(', '),
    )

  it('resultado é sempre ordenado em ordem crescente', () => {
    fc.assert(
      fc.property(textoDeNumeros, (texto) => {
        const r = parseFaixasTiragem(texto)
        for (let i = 1; i < r.length; i++) {
          expect(r[i]).toBeGreaterThan(r[i - 1])
        }
      }),
    )
  })

  it('resultado nunca tem duplicatas', () => {
    fc.assert(
      fc.property(textoDeNumeros, (texto) => {
        const r = parseFaixasTiragem(texto)
        expect(new Set(r).size).toBe(r.length)
      }),
    )
  })

  it('resultado tem no máximo 20 faixas', () => {
    fc.assert(
      fc.property(textoDeNumeros, (texto) => {
        expect(parseFaixasTiragem(texto).length).toBeLessThanOrEqual(MAX_FAIXAS_TIRAGEM)
      }),
    )
  })

  it('todos os valores do resultado são > 0', () => {
    fc.assert(
      fc.property(textoDeNumeros, (texto) => {
        for (const n of parseFaixasTiragem(texto)) {
          expect(n).toBeGreaterThan(0)
        }
      }),
    )
  })

  it('idempotência da normalização: reparsar a saída formatada dá o mesmo conjunto', () => {
    fc.assert(
      fc.property(textoDeNumeros, (texto) => {
        const r1 = parseFaixasTiragem(texto)
        // Reserializa com separador de milhar e reparseia.
        const texto2 = r1.map((n) => n.toLocaleString('pt-BR')).join(', ')
        const r2 = parseFaixasTiragem(texto2)
        expect(r2).toEqual(r1)
      }),
    )
  })
})
