/**
 * ancoras.test.ts — Teste de propriedade do helper PURO `montarAncoras`.
 *
 * Cobre a Correctness Property do design
 * `orcamento-grafico-experiencia-calcgraf`:
 *  - Property 5 (âncoras refletem exatamente as seções; Planos em plano único)
 *    — Requirements 1.2, 5.2
 *
 * Contrato de `montarAncoras(item)`:
 *  - Sempre contém as âncoras fixas: 'produto', 'dados-tecnicos',
 *    'acabamentos', 'estrutura', 'fechamento'.
 *  - Contém 'planos' SE E SOMENTE SE `item.planos?.length > 0`, posicionada
 *    logo após 'produto'.
 *
 * Stack: vitest + fast-check (≥100 iterações). Geradores restritos ao espaço de
 * entrada que a função observa (presença/ausência da lista de planos).
 */

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { montarAncoras, type AncoraId } from './ancoras'

// ≥100 iterações (design). Seed fixa p/ determinismo.
const RUNS = { numRuns: 300, seed: 20262702 } as const

const ANCORAS_FIXAS: readonly AncoraId[] = [
  'produto',
  'dados-tecnicos',
  'acabamentos',
  'estrutura',
  'fechamento',
] as const

/**
 * Gerador do campo `planos` do item cobrindo TODO o espaço relevante:
 *  - null / undefined (sem planos)
 *  - [] (lista vazia → sem planos)
 *  - arrays não-vazios de tamanho variável (com planos)
 * O conteúdo de cada plano é irrelevante para a função (só o length conta).
 */
const arbPlanos = (): fc.Arbitrary<unknown[] | null | undefined> =>
  fc.oneof(
    fc.constant(null),
    fc.constant(undefined),
    fc.constant([] as unknown[]),
    fc.array(fc.anything(), { minLength: 1, maxLength: 8 }),
  )

const arbItem = (): fc.Arbitrary<{ planos?: unknown[] | null }> =>
  arbPlanos().map((planos) => ({ planos }))

describe('montarAncoras (Property 5)', () => {
  it('Feature: orcamento-grafico-experiencia-calcgraf, Property 5: Âncoras presentes refletem exatamente as seções (Planos em plano único)', () => {
    fc.assert(
      fc.property(arbItem(), (item) => {
        const ancoras = montarAncoras(item)
        const temPlanos = (item.planos?.length ?? 0) > 0

        // (a) Âncoras fixas sempre presentes.
        for (const fixa of ANCORAS_FIXAS) {
          expect(ancoras).toContain(fixa)
        }

        // (b) 'planos' presente SSE há ≥ 1 plano.
        expect(ancoras.includes('planos')).toBe(temPlanos)

        // (c) Ordem estável: 'planos' (quando presente) logo após 'produto';
        //     e as fixas mantêm a ordem canônica de renderização.
        const esperado: AncoraId[] = [
          'produto',
          ...(temPlanos ? (['planos'] as const) : []),
          'dados-tecnicos',
          'acabamentos',
          'estrutura',
          'fechamento',
        ]
        expect(ancoras).toEqual(esperado)

        // (d) Nunca âncora duplicada (conjunto == lista).
        expect(new Set(ancoras).size).toBe(ancoras.length)
      }),
      RUNS,
    )
  })
})
