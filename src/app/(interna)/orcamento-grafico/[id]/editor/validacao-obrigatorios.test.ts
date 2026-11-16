/**
 * Testes de `validacao-obrigatorios.ts` (spec orcamento-grafico-fase3-produto-embalagem,
 * tarefas 8.4 e 8.10). Property 9 com fast-check (100 execuções).
 */

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import {
  NOME_GRAMATURA,
  NOME_PRECO_KG,
  NOME_TIPO_EMBALAGEM,
  validarObrigatoriosParaSalvar,
} from './validacao-obrigatorios'

describe('validarObrigatoriosParaSalvar (unidade)', () => {
  it('entrada vazia: lista os três campos na ordem Tipo, Gramatura e Preço por kg', () => {
    expect(validarObrigatoriosParaSalvar({})).toEqual([NOME_TIPO_EMBALAGEM, NOME_GRAMATURA, NOME_PRECO_KG])
    expect(validarObrigatoriosParaSalvar({ tipoEmbalagemId: null, gramatura: null, precoKg: null })).toEqual([
      NOME_TIPO_EMBALAGEM,
      NOME_GRAMATURA,
      NOME_PRECO_KG,
    ])
  })

  it('entrada preenchida: devolve lista vazia', () => {
    expect(validarObrigatoriosParaSalvar({ tipoEmbalagemId: 't1', gramatura: 300, precoKg: 7.45 })).toEqual([])
  })

  it('gramatura 0 e preço 0 contam como faltantes (formulário nasce com 0)', () => {
    expect(validarObrigatoriosParaSalvar({ tipoEmbalagemId: 't1', gramatura: 0, precoKg: 0 })).toEqual([
      NOME_GRAMATURA,
      NOME_PRECO_KG,
    ])
  })

  it('tipo só com espaços conta como vazio; números em texto são aceitos', () => {
    expect(validarObrigatoriosParaSalvar({ tipoEmbalagemId: '   ', gramatura: '300', precoKg: '7,5' })).toEqual([
      NOME_TIPO_EMBALAGEM,
      NOME_PRECO_KG, // "7,5" com vírgula não é número válido para Number()
    ])
    expect(validarObrigatoriosParaSalvar({ tipoEmbalagemId: 't1', gramatura: '300', precoKg: '7.5' })).toEqual([])
  })

  it('valores negativos faltam', () => {
    expect(validarObrigatoriosParaSalvar({ tipoEmbalagemId: 't1', gramatura: -1, precoKg: -0.5 })).toEqual([
      NOME_GRAMATURA,
      NOME_PRECO_KG,
    ])
  })
})

describe('Propriedades de validacao-obrigatorios.ts', () => {
  // Feature: orcamento-grafico-fase3-produto-embalagem, Property 9: Validação prévia lista exatamente os campos faltantes
  it('Property 9: Validação prévia lista exatamente os campos faltantes', () => {
    const tipoArb = fc.oneof(
      fc.constant<string | null | undefined>(null),
      fc.constant<string | null | undefined>(undefined),
      fc.constant<string | null | undefined>(''),
      fc.constant<string | null | undefined>('   '),
      fc.uuid() as fc.Arbitrary<string | null | undefined>,
    )
    const numeroArb = fc.oneof(
      fc.constant<number | string | null | undefined>(null),
      fc.constant<number | string | null | undefined>(undefined),
      fc.constant<number | string | null | undefined>(''),
      fc.constant<number | string | null | undefined>('abc'),
      fc.constant<number | string | null | undefined>(0),
      fc.constant<number | string | null | undefined>(NaN),
      fc.integer({ min: -1000, max: 0 }),
      fc.double({ min: 0.01, max: 100000, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: 0.01, max: 100000, noNaN: true, noDefaultInfinity: true }).map((n) => String(n)),
    )

    // Modelo independente: um campo numérico falta quando não é número finito maior que 0.
    const numeroFalta = (v: number | string | null | undefined): boolean => {
      if (v === null || v === undefined || v === '') return true
      const n = Number(v)
      return !(Number.isFinite(n) && n > 0)
    }

    fc.assert(
      fc.property(tipoArb, numeroArb, numeroArb, (tipoEmbalagemId, gramatura, precoKg) => {
        const esperado: string[] = []
        if (tipoEmbalagemId == null || tipoEmbalagemId.trim() === '') esperado.push(NOME_TIPO_EMBALAGEM)
        if (numeroFalta(gramatura)) esperado.push(NOME_GRAMATURA)
        if (numeroFalta(precoKg)) esperado.push(NOME_PRECO_KG)

        const r = validarObrigatoriosParaSalvar({ tipoEmbalagemId, gramatura, precoKg })
        expect(r).toEqual(esperado)
        // Lista vazia significa que pode salvar; não repete nome.
        expect(new Set(r).size).toBe(r.length)
      }),
      { numRuns: 100 },
    )
  })
})
