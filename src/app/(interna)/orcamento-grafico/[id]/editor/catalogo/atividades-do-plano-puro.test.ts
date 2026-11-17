import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

import {
  alternarAtividadeMarcada,
  escolhaPadraoDaAtividade,
  montarAcabamentosRicosDoPlano,
  type AtividadeMarcada,
} from './atividades-do-plano-puro'

const NUM_RUNS = 100

const idArb = fc.string({ minLength: 1, maxLength: 6 })
const marcadaArb = fc.record({ acabamentoId: idArb, nome: fc.string({ minLength: 1, maxLength: 10 }) })
const marcadasArb = fc
  .array(marcadaArb, { maxLength: 8 })
  .map((l) => l.filter((m, i) => l.findIndex((x) => x.acabamentoId === m.acabamentoId) === i))

describe('alternarAtividadeMarcada', () => {
  it('marcar inclui a atividade uma única vez e desmarcar a remove (idempotente)', () => {
    fc.assert(
      fc.property(marcadasArb, idArb, fc.string({ maxLength: 10 }), (marcadas, id, nome) => {
        const marcada = alternarAtividadeMarcada(marcadas, { id, nome }, true)
        expect(marcada.filter((m) => m.acabamentoId === id)).toHaveLength(1)
        expect(alternarAtividadeMarcada(marcada, { id, nome }, true)).toEqual(marcada)

        const desmarcada = alternarAtividadeMarcada(marcada, { id, nome }, false)
        expect(desmarcada.some((m) => m.acabamentoId === id)).toBe(false)
        expect(alternarAtividadeMarcada(desmarcada, { id, nome }, false)).toEqual(desmarcada)
      }),
      { numRuns: NUM_RUNS },
    )
  })

  it('não altera as demais atividades nem a ordem delas', () => {
    fc.assert(
      fc.property(marcadasArb, idArb, (marcadas, id) => {
        const outras = marcadas.filter((m) => m.acabamentoId !== id)
        const marcada = alternarAtividadeMarcada(marcadas, { id, nome: 'X' }, true)
        expect(marcada.filter((m) => m.acabamentoId !== id)).toEqual(outras)
        expect(alternarAtividadeMarcada(marcadas, { id, nome: 'X' }, false)).toEqual(outras)
      }),
      { numRuns: NUM_RUNS },
    )
  })

  it('não altera a lista original e usa nome padrão quando o nome vem vazio', () => {
    const original: AtividadeMarcada[] = [{ acabamentoId: 'a', nome: 'A' }]
    const copia = JSON.parse(JSON.stringify(original))
    const r = alternarAtividadeMarcada(original, { id: 'b', nome: '  ' }, true)
    expect(original).toEqual(copia)
    expect(r[1]).toEqual({ acabamentoId: 'b', nome: 'Atividade' })
  })
})

describe('escolhaPadraoDaAtividade', () => {
  it('sem materiais devolve null', () => {
    expect(escolhaPadraoDaAtividade({ materiais: [] })).toBeNull()
    expect(escolhaPadraoDaAtividade({ materiais: null })).toBeNull()
  })

  it('vários materiais sem padrão devolve null; com padrão escolhe o padrão', () => {
    expect(escolhaPadraoDaAtividade({ materiais: [{ id: 'm1' }, { id: 'm2' }] })).toBeNull()
    const r = escolhaPadraoDaAtividade({ materiais: [{ id: 'm1' }, { id: 'm2', padrao: true, tipoParam: 1 }] })
    expect(r).toMatchObject({ materialId: 'm2', tipoParam: 1, param1: 100, param2: 0 })
  })

  it('material único é pré-selecionado e o resultado sempre aponta para um material permitido', () => {
    const materialArb = fc.record({
      id: idArb,
      padrao: fc.boolean(),
      tipoParam: fc.constantFrom(0, 1, 2, 3, 4, null),
    })
    fc.assert(
      fc.property(fc.array(materialArb, { maxLength: 6 }), (lista) => {
        const materiais = lista.filter((m, i) => lista.findIndex((x) => x.id === m.id) === i)
        const r = escolhaPadraoDaAtividade({ materiais })
        if (r) expect(materiais.some((m) => m.id === r.materialId)).toBe(true)
        if (materiais.length === 1) expect(r?.materialId).toBe(materiais[0].id)
        if (materiais.length === 0) expect(r).toBeNull()
      }),
      { numRuns: NUM_RUNS },
    )
  })
})

describe('montarAcabamentosRicosDoPlano', () => {
  it('gera uma linha por atividade marcada, na ordem, reaproveitando as gravadas', () => {
    fc.assert(
      fc.property(marcadasArb, marcadasArb, (marcadas, gravadasBase) => {
        const gravadas = gravadasBase.map((g) => ({ ...g, extra: 'gravado' }))
        const r = montarAcabamentosRicosDoPlano(marcadas, gravadas)
        expect(r.map((x) => x.acabamentoId)).toEqual(marcadas.map((m) => m.acabamentoId))
        for (const linha of r) {
          const g = gravadas.find((x) => x.acabamentoId === linha.acabamentoId)
          if (g) expect(linha).toBe(g)
          else expect(Object.keys(linha).sort()).toEqual(['acabamentoId', 'nome'])
        }
      }),
      { numRuns: NUM_RUNS },
    )
  })

  it('ignora marcadas repetidas e gravadas sem acabamentoId', () => {
    const r = montarAcabamentosRicosDoPlano(
      [{ acabamentoId: 'a', nome: 'A' }, { acabamentoId: 'a', nome: 'A' }],
      [{ nome: 'sem id' } as { acabamentoId?: string }],
    )
    expect(r).toEqual([{ acabamentoId: 'a', nome: 'A' }])
  })
})
