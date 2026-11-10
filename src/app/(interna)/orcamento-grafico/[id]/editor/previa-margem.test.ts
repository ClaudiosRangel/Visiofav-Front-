/**
 * Testes de propriedade do helper puro de pré-visualização de faixa de margem.
 *
 * Feature: orcamento-grafico-experiencia-calcgraf, Property 7: Pré-visualização
 * de faixa de margem é pura e não persiste.
 *
 * Validates: Requirements 7.4, 7.5
 *
 * Framework: vitest + fast-check (>= 100 iterações). Rodar com `--pool=threads`
 * (padrão "forks" dá timeout nesta máquina).
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  previewFaixaMargem,
  type PreviewFaixaMargemParams,
} from './previa-margem'

const ITERACOES = 200

/** Arbitrário de número finito seguro (sem NaN/Infinity). */
const numFinito = (opts: { min: number; max: number }) =>
  fc.double({
    min: opts.min,
    max: opts.max,
    noNaN: true,
    noDefaultInfinity: true,
  })

/**
 * Faixa VÁLIDA de margem+CEV: 0 < (margemPct/100 + cevPct/100) < 1, de modo que
 * o divisor de gross-up (1 − margem% − CEV%) seja estritamente positivo.
 * Geramos a soma percentual total em (0, 100) e a repartimos entre margem e CEV.
 */
const faixaValidaArb = fc
  .tuple(
    numFinito({ min: 0.5, max: 95 }), // somaPct total em pontos percentuais
    fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }), // fração p/ margem
  )
  .map(([somaPct, fracMargem]) => {
    const margemPct = somaPct * fracMargem
    const cevPct = somaPct - margemPct
    return { margemPct, cevPct, somaPct }
  })

/** Params com faixa VÁLIDA e base/quantidade positivas. */
const paramsValidosArb: fc.Arbitrary<PreviewFaixaMargemParams> = fc
  .tuple(
    faixaValidaArb,
    numFinito({ min: 0, max: 5_000_000 }), // base (custo)
    numFinito({ min: 0.0001, max: 10_000_000 }), // quantidade > 0
  )
  .map(([faixa, base, quantidade]) => ({
    base,
    margemPct: faixa.margemPct,
    cevPct: faixa.cevPct,
    quantidade,
  }))

describe('previewFaixaMargem — Property 7 (pré-visualização de faixa de margem)', () => {
  it('(a) faixa válida: valorTotal >= base e valorUnitario ≈ valorTotal/quantidade', () => {
    fc.assert(
      fc.property(paramsValidosArb, (params) => {
        const r = previewFaixaMargem(params)

        // Gross-up com divisor em (0,1) nunca reduz o custo: valorTotal >= base.
        // (tolerância mínima para o arredondamento a 2 casas do valorTotal)
        expect(r.valorTotal).toBeGreaterThanOrEqual(params.base - 0.01)

        // Consistência unitário × quantidade ≈ valorTotal. O erro de
        // reconstrução é dominado pelos arredondamentos: valorUnitario é
        // arredondado a 4 casas (±0.5e-4), e esse erro é amplificado ao
        // multiplicar por `quantidade`; soma-se o arredondamento do valorTotal
        // a 2 casas (±0.5e-2). Modelamos essa tolerância exatamente (com uma
        // folga pequena para o epsilon de ponto flutuante).
        if (params.quantidade > 0) {
          const reconstruido = r.valorUnitario * params.quantidade
          const tolerancia = params.quantidade * 0.5e-4 + 0.5e-2 + 1e-6
          expect(Math.abs(reconstruido - r.valorTotal)).toBeLessThanOrEqual(
            tolerancia,
          )
        }
      }),
      { numRuns: ITERACOES },
    )
  })

  it('(b) determinismo/pureza: mesma entrada → mesma saída (chamar 2x é igual)', () => {
    fc.assert(
      fc.property(
        fc.record({
          base: numFinito({ min: -1_000_000, max: 5_000_000 }),
          margemPct: numFinito({ min: -50, max: 150 }),
          cevPct: numFinito({ min: -50, max: 150 }),
          quantidade: numFinito({ min: -100, max: 10_000_000 }),
          custosVariaveis: fc.option(numFinito({ min: 0, max: 5_000_000 }), {
            nil: undefined,
          }),
        }),
        (params) => {
          const r1 = previewFaixaMargem(params)
          const r2 = previewFaixaMargem(params)
          // Saídas idênticas (determinismo) — compara o objeto inteiro.
          expect(r2).toEqual(r1)
          // E não muta a entrada (pureza).
          const copia = { ...params }
          previewFaixaMargem(params)
          expect(params).toEqual(copia)
        },
      ),
      { numRuns: ITERACOES },
    )
  })

  it('(c) divisor <= 0 retorna zeros sem lançar', () => {
    // Garante soma margem%+CEV% >= 100 → divisor (1 − soma%) <= 0.
    const faixaInvalidaArb = fc
      .tuple(
        numFinito({ min: 100, max: 1000 }), // somaPct >= 100
        fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
      )
      .map(([somaPct, frac]) => {
        const margemPct = somaPct * frac
        const cevPct = somaPct - margemPct
        return { margemPct, cevPct }
      })

    fc.assert(
      fc.property(
        fc.tuple(
          faixaInvalidaArb,
          numFinito({ min: 0, max: 5_000_000 }),
          numFinito({ min: 0.0001, max: 10_000_000 }),
          fc.option(numFinito({ min: 0, max: 5_000_000 }), { nil: undefined }),
        ),
        ([faixa, base, quantidade, custosVariaveis]) => {
          const params: PreviewFaixaMargemParams = {
            base,
            margemPct: faixa.margemPct,
            cevPct: faixa.cevPct,
            quantidade,
            custosVariaveis,
          }
          let r: ReturnType<typeof previewFaixaMargem> | undefined
          expect(() => {
            r = previewFaixaMargem(params)
          }).not.toThrow()
          expect(r!.valorTotal).toBe(0)
          expect(r!.valorUnitario).toBe(0)
        },
      ),
      { numRuns: ITERACOES },
    )
  })

  it('(d) monotonicidade: aumentar margemPct (no domínio válido) não diminui valorTotal', () => {
    fc.assert(
      fc.property(
        fc.tuple(
          numFinito({ min: 0, max: 5_000_000 }), // base
          numFinito({ min: 0.0001, max: 10_000_000 }), // quantidade
          numFinito({ min: 0, max: 60 }), // cevPct (fixo entre as duas chamadas)
          // duas margens no domínio válido; garantimos margem+CEV < 100
          numFinito({ min: 0, max: 30 }),
          numFinito({ min: 0, max: 30 }),
        ),
        ([base, quantidade, cevPct, mA, mB]) => {
          // margem menor e maior, ambas com margem+CEV estritamente < 100.
          const margemMenor = Math.min(mA, mB)
          const margemMaior = Math.max(mA, mB)
          // Garantir domínio válido: margemMaior + cevPct < 100.
          fc.pre(margemMaior + cevPct < 99.5)

          const rMenor = previewFaixaMargem({
            base,
            margemPct: margemMenor,
            cevPct,
            quantidade,
          })
          const rMaior = previewFaixaMargem({
            base,
            margemPct: margemMaior,
            cevPct,
            quantidade,
          })

          // Aumentar a margem aumenta (ou mantém) o divisor inverso → valorTotal
          // não diminui. Tolerância mínima p/ arredondamento a 2 casas.
          expect(rMaior.valorTotal).toBeGreaterThanOrEqual(
            rMenor.valorTotal - 0.01,
          )
        },
      ),
      { numRuns: ITERACOES },
    )
  })
})
