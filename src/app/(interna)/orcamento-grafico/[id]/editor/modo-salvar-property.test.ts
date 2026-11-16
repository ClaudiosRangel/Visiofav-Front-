/**
 * Property 20: Retentativas nunca criam item duplicado
 * Validates: Requirements 10.3
 *
 * Simula uma sequência de tentativas de salvar (inclusive "Tentar novamente") com
 * qualquer combinação de falhas do POST e do passe de seleções. Em nenhuma sequência
 * o item é criado mais de uma vez, e depois da criação toda tentativa é PUT no mesmo id.
 */

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { decidirModoSalvar, registrarItemCriado } from './modo-salvar-puro'

const RUNS = { numRuns: 200, seed: 20262703 } as const

interface Tentativa {
  /** O POST responde com erro (nada foi criado). */
  postFalha: boolean
  /** O passe de seleções falha depois do salvamento. */
  passeFalha: boolean
}

const arbTentativas = fc.array(
  fc.record({ postFalha: fc.boolean(), passeFalha: fc.boolean() }),
  { minLength: 1, maxLength: 12 },
)

function simular(itemIdProp: string | null, tentativas: Tentativa[]) {
  let criado: string | null = null
  let proximoId = 0
  const posts: number[] = []
  const puts: string[] = []
  let itensCriados = 0

  for (const t of tentativas) {
    const modo = decidirModoSalvar(itemIdProp, criado)
    if (modo.isEditing) {
      puts.push(modo.itemId as string)
    } else {
      posts.push(1)
      if (t.postFalha) continue
      itensCriados += 1
      criado = registrarItemCriado(criado, `novo-${++proximoId}`)
    }
  }
  return { posts: posts.length, puts, itensCriados, criado }
}

describe('decidirModoSalvar (Property 20)', () => {
  it('Feature: orcamento-grafico-fase3-produto-embalagem, Property 20: retentativas nunca criam item duplicado', () => {
    fc.assert(
      fc.property(arbTentativas, (tentativas) => {
        const r = simular(null, tentativas)
        // No máximo um item criado, qualquer que seja a sequência de falhas.
        expect(r.itensCriados).toBeLessThanOrEqual(1)
        // Depois da criação, todas as tentativas seguintes são PUT no mesmo id.
        expect(r.puts.every((p) => p === r.criado)).toBe(true)
        // Sem POST bem-sucedido, o item não existe e nenhuma tentativa foi PUT.
        if (r.itensCriados === 0) expect(r.puts).toHaveLength(0)
      }),
      RUNS,
    )
  })

  it('item vindo da página nunca gera POST', () => {
    fc.assert(
      fc.property(fc.uuid(), arbTentativas, (id, tentativas) => {
        const r = simular(id, tentativas)
        expect(r.posts).toBe(0)
        expect(r.puts).toHaveLength(tentativas.length)
        expect(r.puts.every((p) => p === id)).toBe(true)
      }),
      RUNS,
    )
  })

  it('o primeiro id criado nunca é trocado', () => {
    fc.assert(
      fc.property(fc.uuid(), fc.uuid(), (a, b) => {
        expect(registrarItemCriado(a, b)).toBe(a)
        expect(registrarItemCriado(null, b)).toBe(b)
        expect(registrarItemCriado(null, undefined)).toBeNull()
      }),
      RUNS,
    )
  })

  it('o item da página prevalece sobre o criado na sessão', () => {
    expect(decidirModoSalvar('a', 'b')).toEqual({ isEditing: true, itemId: 'a' })
    expect(decidirModoSalvar(undefined, 'b')).toEqual({ isEditing: true, itemId: 'b' })
    expect(decidirModoSalvar(null, null)).toEqual({ isEditing: false, itemId: null })
  })
})
