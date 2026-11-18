import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { previewFaixaMargem } from '../../../editor/previa-margem'
import { resumoMargem } from './margem-item'

describe('resumoMargem', () => {
  it('sem custo de produção positivo não há resumo', () => {
    expect(resumoMargem({ baseCusto: null })).toBeNull()
    expect(resumoMargem({ baseCusto: undefined })).toBeNull()
    expect(resumoMargem({ baseCusto: 0 })).toBeNull()
    expect(resumoMargem({ baseCusto: -5 })).toBeNull()
    expect(resumoMargem({ baseCusto: Number.NaN })).toBeNull()
  })

  it('calcula o preço pelo gross-up da prévia (custo / (1 − margem − CEV))', () => {
    const r = resumoMargem({ baseCusto: 1000, cevPct: 20, margemAtualPct: 30, quantidade: 100, contribuicaoMarginalPerc: 27.14 })
    expect(r).toEqual({ custo: 1000, preco: 2000, precoUnitario: 20, margemPct: 30, cmPerc: 27.14 })
  })

  it('sem margem conhecida mostra só o custo', () => {
    expect(resumoMargem({ baseCusto: 500, margemAtualPct: null })).toEqual({
      custo: 500,
      preco: null,
      precoUnitario: null,
      margemPct: null,
      cmPerc: null,
    })
    expect(resumoMargem({ baseCusto: 500, margemAtualPct: 0 })?.preco).toBeNull()
  })

  it('margem + CEV que não fecham (divisor ≤ 0) não inventam preço', () => {
    const r = resumoMargem({ baseCusto: 500, cevPct: 60, margemAtualPct: 40, quantidade: 10 })
    expect(r?.preco).toBeNull()
    expect(r?.precoUnitario).toBeNull()
    expect(r?.custo).toBe(500)
  })

  it('sem tiragem não há preço unitário, mas há preço', () => {
    const r = resumoMargem({ baseCusto: 1000, cevPct: 20, margemAtualPct: 30, quantidade: 0 })
    expect(r?.preco).toBe(2000)
    expect(r?.precoUnitario).toBeNull()
  })

  it('CEV ausente vale 0', () => {
    expect(resumoMargem({ baseCusto: 700, margemAtualPct: 30, quantidade: 1 })?.preco).toBe(1000)
  })

  it('propriedade: coincide com previewFaixaMargem e o preço nunca fica abaixo do custo', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 1_000_000 }),
        fc.integer({ min: 1, max: 5000 }),
        fc.integer({ min: 0, max: 4000 }),
        fc.integer({ min: 1, max: 100_000 }),
        (custo, margemCent, cevCent, qtd) => {
          const margemPct = margemCent / 100
          const cevPct = cevCent / 100
          const r = resumoMargem({ baseCusto: custo, margemAtualPct: margemPct, cevPct, quantidade: qtd })
          const previa = previewFaixaMargem({ base: custo, margemPct, cevPct, quantidade: qtd })
          expect(r?.preco ?? null).toBe(previa.valorTotal > 0 ? previa.valorTotal : null)
          if (r?.preco != null) expect(r.preco).toBeGreaterThanOrEqual(custo)
        },
      ),
    )
  })
})
