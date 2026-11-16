/**
 * Property 19 (spec orcamento-grafico-fase3-produto-embalagem, tarefa 12.4):
 * passe de seleções com falha parcial e retentativa.
 * Validates: Requirements 10.1, 10.2, 10.4, 10.5, 10.6, 10.8
 */

import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { executarPasse, MENSAGEM_TEMPO_ESGOTADO, resumirPasse, type ItemDoPasse, type ResultadoPasse } from './passe-selecao-puro'

describe('Property 19: passe com falha parcial e retentativa', () => {
  it('falhas bloqueiam o recálculo; a retentativa reenvia só as não gravadas e converge', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.boolean(), { minLength: 0, maxLength: 12 }), // true = falha no 1º passe
        async (falhaNaPrimeira) => {
          const chaves = falhaNaPrimeira.map((_, i) => `ac${i}|`)
          const envios: Record<string, number> = {}
          const montar = (indices: number[], falhar: (i: number) => boolean): ItemDoPasse[] =>
            indices.map((i) => ({
              chave: chaves[i],
              atividadeNome: `Atividade ${i}`,
              executar: async () => {
                envios[chaves[i]] = (envios[chaves[i]] ?? 0) + 1
                if (falhar(i)) throw new Error(`erro ${i}`)
              },
            }))

          const todos = chaves.map((_, i) => i)
          const primeiro = await executarPasse(montar(todos, (i) => falhaNaPrimeira[i]), { timeoutMs: 1000 })
          const r1 = resumirPasse(primeiro)

          // 10.1/10.8: sem falha pode recalcular (inclui lista vazia); com falha, não.
          expect(r1.podeRecalcular).toBe(!falhaNaPrimeira.some(Boolean))
          // 10.2: cada falha traz atividade e mensagem.
          for (const f of r1.falhas) {
            expect(f.atividadeNome).toMatch(/^Atividade \d+$/)
            expect(f.mensagem).toMatch(/^erro \d+$/)
          }

          // 10.5: retentativa só das não gravadas.
          const reenviar = r1.reenviar.map((c) => chaves.indexOf(c))
          const segundo = await executarPasse(montar(reenviar, () => false), { timeoutMs: 1000 })
          const r2 = resumirPasse([primeiro, segundo])

          chaves.forEach((c, i) => {
            expect(envios[c]).toBe(falhaNaPrimeira[i] ? 2 : 1)
          })
          // 10.6: tudo gravado → recálculo liberado.
          expect(r2.podeRecalcular).toBe(true)
          expect(r2.totalGravadas).toBe(chaves.length)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('retentativa que falha de novo mantém o bloqueio (10.1/10.4)', async () => {
    const itens: ItemDoPasse[] = [
      { chave: 'a|', atividadeNome: 'Verniz', executar: async () => { throw new Error('indisponível') } },
    ]
    const p1 = await executarPasse(itens)
    const p2 = await executarPasse(itens)
    const r = resumirPasse([p1, p2])
    expect(r.podeRecalcular).toBe(false)
    expect(r.reenviar).toEqual(['a|'])
  })

  it('sem resposta no prazo: aborta e marca "tempo esgotado" (10.1/10.2)', async () => {
    let abortado = false
    const itens: ItemDoPasse[] = [
      {
        chave: 'a|',
        atividadeNome: 'Laminação',
        executar: (signal) =>
          new Promise((_, rejeitar) => {
            signal.addEventListener('abort', () => {
              abortado = true
              rejeitar(new Error('cancelado'))
            })
          }),
      },
      { chave: 'b|', atividadeNome: 'Corte', executar: async () => undefined },
    ]
    const r: ResultadoPasse = await executarPasse(itens, { timeoutMs: 20 })
    expect(abortado).toBe(true)
    expect(r.falhas).toEqual([{ chave: 'a|', atividadeNome: 'Laminação', mensagem: MENSAGEM_TEMPO_ESGOTADO }])
    expect(r.gravadas).toEqual([{ chave: 'b|' }])
  })
})
