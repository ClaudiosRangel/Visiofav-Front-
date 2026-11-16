/**
 * Testes de `sugestoes.ts` (spec orcamento-grafico-fase3-produto-embalagem, tarefas 8.4 a 8.9).
 *
 * Unidade: cada função com entrada vazia e entrada preenchida, tipo inativo, preço com
 * 0, 1 e 2 papéis. Propriedades (fast-check, 100 execuções): Properties 4, 5, 6, 7 e 8.
 */

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import {
  aplicarSugestoes,
  aplicarTipoEmbalagem,
  filtrarCandidatosPapel,
  sugerirPrecoKg,
  sugerirSuporteGramatura,
  sugerirTipoEmbalagem,
  type EntradaSugestoes,
  type FlagsItem,
} from './sugestoes'

const NUM_RUNS = 100

const NOVO: FlagsItem = { itemNovo: true, itemPuxado: false, itemSalvo: false }
const PUXADO: FlagsItem = { itemNovo: true, itemPuxado: true, itemSalvo: false }
const SALVO: FlagsItem = { itemNovo: false, itemPuxado: false, itemSalvo: true }

// ----------------------------------------------------------------------------
// Geradores e auxiliares
// ----------------------------------------------------------------------------

const flagsArb = fc.record({
  itemNovo: fc.boolean(),
  itemPuxado: fc.boolean(),
  itemSalvo: fc.boolean(),
})

/** Texto de id: nulo, vazio, só espaços ou um uuid. */
const idOuVazioArb = fc.oneof(
  fc.constant<string | null>(null),
  fc.constant<string | null>(''),
  fc.constant<string | null>('   '),
  fc.uuid() as fc.Arbitrary<string | null>,
)

const ehVazio = (v: string | null | undefined): boolean => v == null || v.trim() === ''
const ehPositivo = (v: unknown): boolean => {
  if (v === null || v === undefined || v === '') return false
  const n = Number(v)
  return Number.isFinite(n) && n > 0
}
const podeSugerir = (f: FlagsItem): boolean => f.itemNovo && !f.itemPuxado && !f.itemSalvo

// ============================================================================
// sugerirTipoEmbalagem
// ============================================================================

describe('sugerirTipoEmbalagem (unidade)', () => {
  it('entrada vazia: sem produto, sem vínculo e campo vazio não sugere nada', () => {
    expect(
      sugerirTipoEmbalagem({ ...NOVO, produtoEscolhidoId: null, vinculo: null, valorAtual: null }),
    ).toEqual({ acao: 'NENHUM' })
  })

  it('entrada preenchida: produto com vínculo ativo e campo vazio aplica o tipo', () => {
    expect(
      sugerirTipoEmbalagem({
        ...NOVO,
        produtoEscolhidoId: 'p1',
        vinculo: { id: 't1', ativo: true },
        valorAtual: null,
      }),
    ).toEqual({ acao: 'APLICAR', tipoEmbalagemId: 't1' })
  })

  it('tipo inativo: devolve aviso e não preenche', () => {
    expect(
      sugerirTipoEmbalagem({
        ...NOVO,
        produtoEscolhidoId: 'p1',
        vinculo: { id: 't1', ativo: false },
        valorAtual: '',
      }),
    ).toEqual({ acao: 'AVISO_INATIVO' })
  })

  it('campo já preenchido não é sobrescrito', () => {
    expect(
      sugerirTipoEmbalagem({
        ...NOVO,
        produtoEscolhidoId: 'p1',
        vinculo: { id: 't1', ativo: true },
        valorAtual: 't-manual',
      }),
    ).toEqual({ acao: 'NENHUM' })
  })

  it('item puxado ou salvo nunca recebe sugestão', () => {
    const base = { produtoEscolhidoId: 'p1', vinculo: { id: 't1', ativo: true }, valorAtual: null }
    expect(sugerirTipoEmbalagem({ ...PUXADO, ...base })).toEqual({ acao: 'NENHUM' })
    expect(sugerirTipoEmbalagem({ ...SALVO, ...base })).toEqual({ acao: 'NENHUM' })
  })
})

// ============================================================================
// aplicarTipoEmbalagem
// ============================================================================

describe('aplicarTipoEmbalagem (unidade)', () => {
  it('entrada vazia: limpar a escolha zera tipo e medidas', () => {
    const r = aplicarTipoEmbalagem({ tipoEmbalagemId: 't1', tipoEmbalagem: { id: 't1' }, medidas: { L: 10 } }, null)
    expect(r).toEqual({ tipoEmbalagemId: null, tipoEmbalagem: null, medidas: {} })
  })

  it('entrada preenchida: aplica o tipo, reinicia as medidas e preserva os demais campos', () => {
    const tipo = { id: 't2', nome: 'Caixa' }
    const r = aplicarTipoEmbalagem({ quantidade: 500, medidas: { L: 10, A: 20 } }, tipo)
    expect(r).toEqual({ quantidade: 500, tipoEmbalagemId: 't2', tipoEmbalagem: tipo, medidas: {} })
  })
})

// ============================================================================
// sugerirSuporteGramatura
// ============================================================================

describe('sugerirSuporteGramatura (unidade)', () => {
  it('entrada vazia: sem plano fixo não sugere nada', () => {
    expect(
      sugerirSuporteGramatura({ ...NOVO, planoFixo: null, suporteAtual: null, gramaturaAtual: null }),
    ).toEqual({})
  })

  it('entrada preenchida: preenche suporte e gramatura vazios (gramatura 0 conta como vazia)', () => {
    expect(
      sugerirSuporteGramatura({
        ...NOVO,
        planoFixo: { suportePadraoId: 's1', gramaturaPadrao: 300 },
        suporteAtual: '',
        gramaturaAtual: 0,
      }),
    ).toEqual({ suporteId: 's1', gramatura: 300 })
  })

  it('não sobrescreve campo preenchido', () => {
    expect(
      sugerirSuporteGramatura({
        ...NOVO,
        planoFixo: { suportePadraoId: 's1', gramaturaPadrao: 300 },
        suporteAtual: 's-manual',
        gramaturaAtual: 250,
      }),
    ).toEqual({})
  })

  it('preenche só o que está vazio', () => {
    expect(
      sugerirSuporteGramatura({
        ...NOVO,
        planoFixo: { suportePadraoId: 's1', gramaturaPadrao: 300 },
        suporteAtual: 's-manual',
        gramaturaAtual: null,
      }),
    ).toEqual({ gramatura: 300 })
  })

  it('item puxado não recebe sugestão', () => {
    expect(
      sugerirSuporteGramatura({
        ...PUXADO,
        planoFixo: { suportePadraoId: 's1', gramaturaPadrao: 300 },
        suporteAtual: null,
        gramaturaAtual: null,
      }),
    ).toEqual({})
  })
})

// ============================================================================
// sugerirPrecoKg e filtrarCandidatosPapel
// ============================================================================

describe('sugerirPrecoKg (unidade): preço com 0, 1 e 2 papéis', () => {
  const base = { ...NOVO, suporteId: 's1', gramatura: 300, precoKgAtual: null as number | null }

  it('0 papéis: aviso "SEM_PAPEL"', () => {
    expect(sugerirPrecoKg({ ...base, candidatos: [] })).toEqual({ acao: 'AVISO', motivo: 'SEM_PAPEL' })
  })

  it('1 papel com preço: aplica o preço', () => {
    expect(sugerirPrecoKg({ ...base, candidatos: [{ id: 'a', precoUnitario: 7.45 }] })).toEqual({
      acao: 'APLICAR',
      precoKg: 7.45,
    })
  })

  it('2 papéis com preço: aviso "MAIS_DE_UM" e não aplica', () => {
    expect(
      sugerirPrecoKg({
        ...base,
        candidatos: [
          { id: 'a', precoUnitario: 7.45 },
          { id: 'b', precoUnitario: 6.83 },
        ],
      }),
    ).toEqual({ acao: 'AVISO', motivo: 'MAIS_DE_UM' })
  })

  it('papel com preço 0 não conta como candidato', () => {
    expect(
      sugerirPrecoKg({
        ...base,
        candidatos: [
          { id: 'a', precoUnitario: 0 },
          { id: 'b', precoUnitario: 6.83 },
        ],
      }),
    ).toEqual({ acao: 'APLICAR', precoKg: 6.83 })
  })

  it('entrada vazia: sem suporte ou sem gramatura não sugere', () => {
    expect(sugerirPrecoKg({ ...base, suporteId: null, candidatos: [{ id: 'a', precoUnitario: 5 }] })).toEqual({
      acao: 'NENHUM',
    })
    expect(sugerirPrecoKg({ ...base, gramatura: 0, candidatos: [{ id: 'a', precoUnitario: 5 }] })).toEqual({
      acao: 'NENHUM',
    })
  })

  it('preço já informado (maior que 0) é preservado; 0 conta como vazio', () => {
    const cand = [{ id: 'a', precoUnitario: 5 }]
    expect(sugerirPrecoKg({ ...base, precoKgAtual: 9, candidatos: cand })).toEqual({ acao: 'NENHUM' })
    expect(sugerirPrecoKg({ ...base, precoKgAtual: 0, candidatos: cand })).toEqual({ acao: 'APLICAR', precoKg: 5 })
  })

  it('item puxado não recebe sugestão', () => {
    expect(sugerirPrecoKg({ ...base, ...PUXADO, candidatos: [{ id: 'a', precoUnitario: 5 }] })).toEqual({
      acao: 'NENHUM',
    })
  })
})

describe('filtrarCandidatosPapel (unidade)', () => {
  it('entrada vazia: sem papéis, suporte ou gramatura devolve lista vazia', () => {
    expect(filtrarCandidatosPapel(null, 's1', 300)).toEqual([])
    expect(filtrarCandidatosPapel([], 's1', 300)).toEqual([])
    expect(filtrarCandidatosPapel([{ id: 'a', suporteId: 's1', gramatura: 300, precoUnitario: 5 }], null, 300)).toEqual([])
    expect(filtrarCandidatosPapel([{ id: 'a', suporteId: 's1', gramatura: 300, precoUnitario: 5 }], 's1', 0)).toEqual([])
  })

  it('entrada preenchida: casa por suporte e gramatura, aceita texto numérico e ignora preço 0', () => {
    const papeis = [
      { id: 'a', suporteId: 's1', gramatura: '300', precoUnitario: '7.45' },
      { id: 'b', suporteId: 's1', gramatura: 300, precoUnitario: 0 },
      { id: 'c', suporteId: 's2', gramatura: 300, precoUnitario: 9 },
      { id: 'd', suporteId: 's1', gramatura: 250, precoUnitario: 9 },
      { id: 'e', suporteId: 's1', gramatura: null, precoUnitario: 9 },
    ]
    expect(filtrarCandidatosPapel(papeis, 's1', 300)).toEqual([{ id: 'a', precoUnitario: 7.45 }])
  })
})

// ============================================================================
// aplicarSugestoes (unidade)
// ============================================================================

describe('aplicarSugestoes (unidade)', () => {
  const tipo = { id: 't1', nome: 'Caixa' }
  const entradaBase: EntradaSugestoes<typeof tipo> = {
    flags: NOVO,
    produtoEscolhidoId: 'p1',
    vinculo: { id: 't1', ativo: true },
    tipoDoVinculo: tipo,
    planoFixo: { suportePadraoId: 's1', gramaturaPadrao: 300 },
    papeis: [{ id: 'a', suporteId: 's1', gramatura: 300, precoUnitario: 7.45 }],
  }

  it('formulário vazio recebe tipo, suporte, gramatura e preço', () => {
    const r = aplicarSugestoes({ tipoEmbalagemId: null, suporteId: null, gramatura: 0, precoKg: 0 }, entradaBase)
    expect(r.form).toEqual({
      tipoEmbalagemId: 't1',
      tipoEmbalagem: tipo,
      medidas: {},
      suporteId: 's1',
      gramatura: 300,
      precoKg: 7.45,
    })
    expect(r.tipoSugerido).toBe(true)
    expect(r.avisoTipoInativo).toBe(false)
    expect(r.avisoPreco).toBeNull()
  })

  it('formulário preenchido não muda', () => {
    const form = { tipoEmbalagemId: 'x', suporteId: 's9', gramatura: 250, precoKg: 3 }
    const r = aplicarSugestoes(form, entradaBase)
    expect(r.form).toEqual(form)
    expect(r.tipoSugerido).toBe(false)
  })

  it('tipo inativo: não preenche o tipo e sinaliza o aviso', () => {
    const r = aplicarSugestoes(
      { tipoEmbalagemId: null, suporteId: null, gramatura: 0, precoKg: 0 },
      { ...entradaBase, vinculo: { id: 't1', ativo: false } },
    )
    expect(r.form.tipoEmbalagemId).toBeNull()
    expect(r.tipoSugerido).toBe(false)
    expect(r.avisoTipoInativo).toBe(true)
  })

  it('dois papéis com o mesmo suporte e gramatura: preço fica vazio e sinaliza o aviso', () => {
    const r = aplicarSugestoes(
      { tipoEmbalagemId: null, suporteId: null, gramatura: 0, precoKg: 0 },
      {
        ...entradaBase,
        papeis: [
          { id: 'a', suporteId: 's1', gramatura: 300, precoUnitario: 7.45 },
          { id: 'b', suporteId: 's1', gramatura: 300, precoUnitario: 6.83 },
        ],
      },
    )
    expect(r.form.precoKg).toBe(0)
    expect(r.avisoPreco).toBe('MAIS_DE_UM')
  })

  it('sem papel casado: sinaliza "SEM_PAPEL"', () => {
    const r = aplicarSugestoes(
      { tipoEmbalagemId: null, suporteId: null, gramatura: 0, precoKg: 0 },
      { ...entradaBase, papeis: [] },
    )
    expect(r.avisoPreco).toBe('SEM_PAPEL')
  })
})

// ============================================================================
// Propriedades
// ============================================================================

describe('Propriedades de sugestoes.ts', () => {
  // Feature: orcamento-grafico-fase3-produto-embalagem, Property 4: Sugestão de Tipo_Embalagem só ocorre em item novo e campo vazio
  it('Property 4: Sugestão de Tipo_Embalagem só ocorre em item novo e campo vazio', () => {
    fc.assert(
      fc.property(
        flagsArb,
        idOuVazioArb,
        fc.option(fc.record({ id: fc.uuid(), ativo: fc.boolean() }), { nil: null }),
        idOuVazioArb,
        (flags, produtoEscolhidoId, vinculo, valorAtual) => {
          const r = sugerirTipoEmbalagem({ ...flags, produtoEscolhidoId, vinculo, valorAtual })

          // Fora de item novo (puxado, salvo ou não novo): nunca sugere.
          if (!podeSugerir(flags)) expect(r).toEqual({ acao: 'NENHUM' })
          // Campo já preenchido nunca é sobrescrito.
          if (!ehVazio(valorAtual)) expect(r).toEqual({ acao: 'NENHUM' })
          // Sem produto ou sem vínculo: nada.
          if (ehVazio(produtoEscolhidoId) || vinculo === null) expect(r).toEqual({ acao: 'NENHUM' })

          // Caso que sugere: item novo, campo vazio, produto escolhido e vínculo presente.
          if (podeSugerir(flags) && ehVazio(valorAtual) && !ehVazio(produtoEscolhidoId) && vinculo) {
            expect(r).toEqual(
              vinculo.ativo ? { acao: 'APLICAR', tipoEmbalagemId: vinculo.id } : { acao: 'AVISO_INATIVO' },
            )
          }
          // Só APLICAR quando o tipo é do vínculo e está ativo.
          if (r.acao === 'APLICAR') expect(vinculo?.ativo).toBe(true)
        },
      ),
      { numRuns: NUM_RUNS },
    )
  })

  // Feature: orcamento-grafico-fase3-produto-embalagem, Property 5: Sugestão de suporte e gramatura só preenche vazios
  it('Property 5: Sugestão de suporte e gramatura só preenche vazios', () => {
    const gramaturaArb = fc.oneof(fc.constant<number | null>(null), fc.constant<number | null>(0), fc.integer({ min: 1, max: 1000 }))
    fc.assert(
      fc.property(
        flagsArb,
        fc.option(
          fc.record({
            suportePadraoId: fc.option(fc.uuid(), { nil: null }),
            gramaturaPadrao: gramaturaArb,
          }),
          { nil: null },
        ),
        idOuVazioArb,
        gramaturaArb,
        (flags, planoFixo, suporteAtual, gramaturaAtual) => {
          const r = sugerirSuporteGramatura({ ...flags, planoFixo, suporteAtual, gramaturaAtual })

          if (!podeSugerir(flags) || !planoFixo) {
            expect(r).toEqual({})
            return
          }
          // Suporte: só preenche vazio e com o valor padrão do plano.
          if (!ehVazio(suporteAtual)) expect(r.suporteId).toBeUndefined()
          if (r.suporteId !== undefined) {
            expect(ehVazio(suporteAtual)).toBe(true)
            expect(r.suporteId).toBe(planoFixo.suportePadraoId)
          }
          if (ehVazio(suporteAtual) && !ehVazio(planoFixo.suportePadraoId)) {
            expect(r.suporteId).toBe(planoFixo.suportePadraoId)
          }
          // Gramatura: só preenche vazia (null ou 0) e com padrão maior que 0.
          if (ehPositivo(gramaturaAtual)) expect(r.gramatura).toBeUndefined()
          if (r.gramatura !== undefined) {
            expect(ehPositivo(gramaturaAtual)).toBe(false)
            expect(r.gramatura).toBe(planoFixo.gramaturaPadrao)
            expect(r.gramatura).toBeGreaterThan(0)
          }
          if (!ehPositivo(gramaturaAtual) && ehPositivo(planoFixo.gramaturaPadrao)) {
            expect(r.gramatura).toBe(planoFixo.gramaturaPadrao)
          }
        },
      ),
      { numRuns: NUM_RUNS },
    )
  })

  // Feature: orcamento-grafico-fase3-produto-embalagem, Property 6: Preço por kg só vem de exatamente 1 papel com preço
  it('Property 6: Preço por kg só vem de exatamente 1 papel com preço', () => {
    const precoArb = fc.oneof(
      fc.constant(0),
      fc.double({ min: 0.01, max: 1000, noNaN: true, noDefaultInfinity: true }),
    )
    fc.assert(
      fc.property(
        flagsArb,
        idOuVazioArb,
        fc.oneof(fc.constant<number | null>(null), fc.constant<number | null>(0), fc.integer({ min: 1, max: 1000 })),
        fc.oneof(fc.constant<number | null>(null), fc.constant<number | null>(0), fc.double({ min: 0.01, max: 1000, noNaN: true, noDefaultInfinity: true })),
        fc.array(fc.record({ id: fc.uuid(), precoUnitario: precoArb }), { maxLength: 5 }),
        (flags, suporteId, gramatura, precoKgAtual, candidatos) => {
          const r = sugerirPrecoKg({ ...flags, suporteId, gramatura, precoKgAtual, candidatos })
          const comPreco = candidatos.filter((c) => c.precoUnitario > 0)
          const elegivel =
            podeSugerir(flags) && !ehVazio(suporteId) && ehPositivo(gramatura) && !ehPositivo(precoKgAtual)

          if (!elegivel) {
            expect(r).toEqual({ acao: 'NENHUM' })
            return
          }
          if (comPreco.length === 0) expect(r).toEqual({ acao: 'AVISO', motivo: 'SEM_PAPEL' })
          else if (comPreco.length === 1) expect(r).toEqual({ acao: 'APLICAR', precoKg: comPreco[0].precoUnitario })
          else expect(r).toEqual({ acao: 'AVISO', motivo: 'MAIS_DE_UM' })

          // Só aplica com exatamente 1 candidato de preço maior que 0.
          if (r.acao === 'APLICAR') expect(comPreco).toHaveLength(1)
        },
      ),
      { numRuns: NUM_RUNS },
    )
  })

  // Entrada compartilhada pelas Properties 7 e 8.
  const SUP_A = 'sup-a'
  const SUP_B = 'sup-b'
  const suporteArb = fc.constantFrom<string | null>(null, '', SUP_A, SUP_B)
  const gramaturaFormArb = fc.constantFrom<number | null>(null, 0, 100, 200)
  const precoFormArb = fc.constantFrom<number | null>(null, 0, 4.5, 9)

  // Feature: orcamento-grafico-fase3-produto-embalagem, Property 7: Aplicar sugestões é idempotente
  it('Property 7: Aplicar sugestões é idempotente', () => {
    const entradaArb = fc.record({
      flags: flagsArb,
      produtoEscolhidoId: idOuVazioArb,
      vinculo: fc.option(fc.record({ id: fc.uuid(), ativo: fc.boolean() }), { nil: null }),
      planoFixo: fc.option(
        fc.record({
          suportePadraoId: fc.constantFrom<string | null>(null, SUP_A, SUP_B),
          gramaturaPadrao: gramaturaFormArb,
        }),
        { nil: null },
      ),
      papeis: fc.array(
        fc.record({
          id: fc.uuid(),
          suporteId: fc.constantFrom(SUP_A, SUP_B),
          gramatura: fc.constantFrom<number | string>(100, 200, '100'),
          precoUnitario: fc.constantFrom<number | string>(0, 5, 7.5, '6'),
        }),
        { maxLength: 4 },
      ),
    })
    const formArb = fc.record({
      tipoEmbalagemId: idOuVazioArb,
      suporteId: suporteArb,
      gramatura: gramaturaFormArb,
      precoKg: precoFormArb,
      medidas: fc.constant<Record<string, number>>({ L: 10 }),
    })

    fc.assert(
      fc.property(formArb, entradaArb, (form, e) => {
        const entrada: EntradaSugestoes<{ id: string }> = {
          ...e,
          tipoDoVinculo: e.vinculo ? { id: e.vinculo.id } : null,
        }
        const r1 = aplicarSugestoes(form, entrada)
        const r2 = aplicarSugestoes(r1.form, entrada)
        expect(r2.form).toEqual(r1.form)

        // Campo preenchido nunca é sobrescrito pela primeira aplicação.
        if (!ehVazio(form.tipoEmbalagemId)) expect(r1.form.tipoEmbalagemId).toBe(form.tipoEmbalagemId)
        if (!ehVazio(form.suporteId)) expect(r1.form.suporteId).toBe(form.suporteId)
        if (ehPositivo(form.gramatura)) expect(r1.form.gramatura).toBe(form.gramatura)
        if (ehPositivo(form.precoKg)) expect(r1.form.precoKg).toBe(form.precoKg)
      }),
      { numRuns: NUM_RUNS },
    )
  })

  // Feature: orcamento-grafico-fase3-produto-embalagem, Property 8: Sugerir o tipo equivale a escolhê-lo manualmente
  it('Property 8: Sugerir o tipo equivale a escolhê-lo manualmente', () => {
    const tipoArb = fc.record({ id: fc.uuid(), nome: fc.string({ minLength: 1, maxLength: 20 }), ativo: fc.constant(true) })
    const formArb = fc.record({
      quantidade: fc.integer({ min: 0, max: 100000 }),
      medidas: fc.dictionary(fc.constantFrom('L', 'A', 'P'), fc.integer({ min: 1, max: 5000 })),
      cores: fc.array(fc.string({ maxLength: 8 }), { maxLength: 3 }),
    })

    fc.assert(
      fc.property(formArb, tipoArb, fc.uuid(), (resto, tipo, produtoId) => {
        const form = { ...resto, tipoEmbalagemId: null as string | null, tipoEmbalagem: null as unknown }

        // Escolha manual do StepTipo: updateForm({ tipoEmbalagemId, tipoEmbalagem, medidas: {} }).
        const manual = { ...form, tipoEmbalagemId: tipo.id, tipoEmbalagem: tipo, medidas: {} }

        const sugerido = aplicarSugestoes(form, {
          flags: NOVO,
          produtoEscolhidoId: produtoId,
          vinculo: { id: tipo.id, ativo: true },
          tipoDoVinculo: tipo,
          planoFixo: null,
          papeis: [],
        })

        expect(sugerido.tipoSugerido).toBe(true)
        expect(sugerido.form).toEqual(manual)
        expect(sugerido.form.tipoEmbalagemId).toBe(tipo.id)
        expect(sugerido.form.tipoEmbalagem).toBe(tipo)
        expect(sugerido.form.medidas).toEqual({})
        expect(aplicarTipoEmbalagem(form, tipo)).toEqual(manual)
      }),
      { numRuns: NUM_RUNS },
    )
  })
})
