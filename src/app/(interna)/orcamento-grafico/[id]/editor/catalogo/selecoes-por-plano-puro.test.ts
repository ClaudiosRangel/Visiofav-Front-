import fc from 'fast-check'
import { describe, expect, it } from 'vitest'

import { chaveSelecao } from './catalogo-puro'
import {
  deveExibirSeletorNoPlano,
  mesclarSelecoesPorPlano,
  type AcaoSelecaoPlano,
  type SelecaoDoPlano,
} from './selecoes-por-plano-puro'

const NUM_RUNS = 100

// Feature: orcamento-grafico-fase3-produto-embalagem, Property 16: Seletor de material do plano aparece só onde cabe
describe('Property 16: Seletor de material do plano aparece só onde cabe', () => {
  it('aparece somente em atividade marcada com ao menos um material, e nunca sem produto ou no plano fixo', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        fc.array(fc.string(), { maxLength: 5 }),
        (temProduto, atividadeMarcada, planoFixo, materiais) => {
          const resultado = deveExibirSeletorNoPlano({ temProduto, atividadeMarcada, materiais, planoFixo })
          const esperado = temProduto && !planoFixo && atividadeMarcada && materiais.length > 0
          expect(resultado).toBe(esperado)
        },
      ),
      { numRuns: NUM_RUNS },
    )
  })

  it('atividade sem material (lista vazia, nula ou ausente) não mostra seletor', () => {
    for (const materiais of [[], null, undefined]) {
      expect(deveExibirSeletorNoPlano({ temProduto: true, atividadeMarcada: true, materiais })).toBe(false)
    }
  })

  it('exemplo: produto, atividade marcada e um material mostram o seletor', () => {
    expect(deveExibirSeletorNoPlano({ temProduto: true, atividadeMarcada: true, materiais: [{ id: 'm' }] })).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Property 17
// ---------------------------------------------------------------------------

const acabamentoArb = fc.constantFrom('a1', 'a2', 'a3')
const planoArb = fc.constantFrom<string | null>(null, 'p1', 'p2', 'tmp')
const materialArb = fc.constantFrom('m1', 'm2', 'm3')

const inicialArb = fc.uniqueArray(
  fc.record({
    acabamentoId: acabamentoArb,
    planoId: fc.constantFrom<string | null>(null, 'p1', 'p2'),
    materialId: materialArb,
    selecaoId: fc.uuid(),
  }),
  { selector: (s) => chaveSelecao(s.acabamentoId, s.planoId), maxLength: 6 },
)

const acaoArb: fc.Arbitrary<AcaoSelecaoPlano> = fc.oneof(
  fc.record({
    tipo: fc.constant('escolher' as const),
    selecao: fc.record({ acabamentoId: acabamentoArb, planoId: planoArb, materialId: materialArb }),
  }),
  fc.record({ tipo: fc.constant('remover' as const), acabamentoId: acabamentoArb, planoId: planoArb }),
  fc.record({ tipo: fc.constant('desmarcar' as const), acabamentoId: acabamentoArb, planoId: planoArb }),
  fc.record({ tipo: fc.constant('salvarPlano' as const), planoIdTemporario: fc.constant('tmp'), planoId: fc.constantFrom('p1', 'p2', 'p9') }),
)

interface Modelo {
  acabamentoId: string
  planoId: string | null
  materialId: string
  selecaoId?: string
  origem?: string
}

/** Modelo de referência: mapa chave → seleção, independente da implementação. */
function aplicarNoModelo(modelo: Map<string, Modelo>, acao: AcaoSelecaoPlano): Map<string, Modelo> {
  const novo = new Map(modelo)
  if (acao.tipo === 'escolher') {
    const k = chaveSelecao(acao.selecao.acabamentoId, acao.selecao.planoId)
    const antes = novo.get(k)
    novo.set(k, {
      acabamentoId: acao.selecao.acabamentoId,
      planoId: acao.selecao.planoId,
      materialId: acao.selecao.materialId,
      selecaoId: antes?.selecaoId,
      origem: antes?.origem,
    })
  } else if (acao.tipo === 'remover' || acao.tipo === 'desmarcar') {
    novo.delete(chaveSelecao(acao.acabamentoId, acao.planoId))
  } else {
    const temporarias = [...novo.values()].filter((s) => s.planoId === acao.planoIdTemporario)
    for (const s of temporarias) {
      novo.delete(chaveSelecao(s.acabamentoId, s.planoId))
      novo.set(chaveSelecao(s.acabamentoId, acao.planoId), { ...s, planoId: acao.planoId })
    }
  }
  return novo
}

function normalizar(lista: ReadonlyArray<Modelo>) {
  return [...lista]
    .map((s) => ({
      chave: chaveSelecao(s.acabamentoId, s.planoId),
      materialId: s.materialId,
      selecaoId: s.selecaoId ?? null,
      origem: s.origem ?? null,
    }))
    .sort((a, b) => a.chave.localeCompare(b.chave))
}

// Feature: orcamento-grafico-fase3-produto-embalagem, Property 17: Seleções de material por plano são preservadas
describe('Property 17: Seleções de material por plano são preservadas', () => {
  it('qualquer sequência de ações termina com exatamente as seleções ativas por plano e atividade, com origem e selecaoId preservados', () => {
    fc.assert(
      fc.property(inicialArb, fc.array(acaoArb, { maxLength: 15 }), (inicial, acoes) => {
        const comOrigem: SelecaoDoPlano[] = inicial.map((s) => ({ ...s, origem: 'SELECAO' }))
        let lista: SelecaoDoPlano[] = comOrigem
        let modelo = new Map<string, Modelo>(comOrigem.map((s) => [chaveSelecao(s.acabamentoId, s.planoId), { ...s }]))
        for (const acao of acoes) {
          lista = mesclarSelecoesPorPlano(lista, acao)
          modelo = aplicarNoModelo(modelo, acao)
        }
        expect(normalizar(lista as Modelo[])).toEqual(normalizar([...modelo.values()]))
        // Nunca há duas seleções para a mesma atividade no mesmo plano.
        const chaves = lista.map((s) => chaveSelecao(s.acabamentoId, s.planoId))
        expect(new Set(chaves).size).toBe(chaves.length)
      }),
      { numRuns: NUM_RUNS },
    )
  })

  it('abrir e salvar sem alteração mantém o mesmo conjunto e não altera a lista original', () => {
    fc.assert(
      fc.property(inicialArb, (inicial) => {
        const original: SelecaoDoPlano[] = inicial.map((s) => ({ ...s, origem: 'SELECAO' }))
        const copia = JSON.parse(JSON.stringify(original))
        const salvo = mesclarSelecoesPorPlano(original, { tipo: 'salvarPlano', planoIdTemporario: 'tmp', planoId: 'p9' })
        expect(normalizar(salvo as Modelo[])).toEqual(normalizar(original as Modelo[]))
        expect(original).toEqual(copia)
      }),
      { numRuns: NUM_RUNS },
    )
  })

  it('trocar o material de uma seleção gravada mantém selecaoId e origem', () => {
    const base: SelecaoDoPlano[] = [{ acabamentoId: 'a1', planoId: 'p1', materialId: 'm1', selecaoId: 's-1', origem: 'SELECAO' }]
    const r = mesclarSelecoesPorPlano(base, { tipo: 'escolher', selecao: { acabamentoId: 'a1', planoId: 'p1', materialId: 'm2' } })
    expect(r).toEqual([{ acabamentoId: 'a1', planoId: 'p1', materialId: 'm2', selecaoId: 's-1', origem: 'SELECAO' }])
  })
})
