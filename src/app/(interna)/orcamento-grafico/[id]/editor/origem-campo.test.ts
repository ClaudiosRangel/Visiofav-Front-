/**
 * origem-campo.test.ts — Teste de propriedade da legenda copiado/manual/vazio.
 *
 * Feature: orcamento-grafico-experiencia-calcgraf, Property 4: Classificação de
 * origem do campo (legenda copiado/manual/vazio).
 *
 * Valida a função pura `origemCampo(classe, valor)` e a constante
 * `CLASSE_CAMPO_TECNICO`. Contrato (Design, Property 4):
 *
 * | Classe   | Preenchido          | Vazio          |
 * |----------|---------------------|----------------|
 * | COPIAVEL | 'copiado'           | 'vazio'        |
 * | MANUAL   | 'manual-preenchido' | 'manual-vazio' |
 *
 * INVARIANTE central: NUNCA retorna 'copiado' para classe MANUAL.
 *
 * Stack: vitest + fast-check (>=100 iterações). Seed fixa para determinismo.
 *
 * **Validates: Requirements 4.4**
 */

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import {
  CLASSE_CAMPO_TECNICO,
  origemCampo,
  valorVazio,
  type ClasseCampoTecnico,
} from './origem-campo'

// Seed fixa + numRuns acima do mínimo exigido (>=100) para runs determinísticas.
const RUNS = { numRuns: 300, seed: 20261101 } as const

// ============================================================================
// Geradores
// ============================================================================

/** Classe de campo técnico: COPIAVEL ou MANUAL. */
const arbClasse: fc.Arbitrary<ClasseCampoTecnico> = fc.constantFrom('COPIAVEL', 'MANUAL')

/**
 * Valores considerados VAZIOS pela regra genérica de `origemCampo`
 * ('', null, undefined; números: só NaN). A sobrecarga `origemCampo(classe,
 * valor)` usa a regra genérica (campo '' → `0` NÃO é vazio aqui).
 */
const arbValorVazioGenerico: fc.Arbitrary<unknown> = fc.constantFrom(
  '',
  null,
  undefined,
  Number.NaN,
)

/**
 * Valores PREENCHIDOS pela regra genérica: strings não vazias, números (incl.
 * 0, negativos, decimais) e booleans (false é valor válido → preenchido).
 */
const arbValorPreenchidoGenerico: fc.Arbitrary<unknown> = fc.oneof(
  fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0 || s.length > 0),
  fc.integer(),
  fc.double({ noNaN: true }),
  fc.boolean(),
  fc.constant(0),
)

/** Gerador amplo de valores quaisquer (strings vazias/não, null, undefined, números incl. 0, booleans). */
const arbValorQualquer: fc.Arbitrary<unknown> = fc.oneof(
  fc.string(),
  fc.constant(''),
  fc.constant(null),
  fc.constant(undefined),
  fc.integer(),
  fc.double(),
  fc.constant(0),
  fc.constant(Number.NaN),
  fc.boolean(),
)

// ============================================================================
// (a) INVARIANTE — nunca 'copiado' para classe MANUAL
// ============================================================================

describe('Feature: orcamento-grafico-experiencia-calcgraf, Property 4: Classificação de origem do campo (legenda copiado/manual/vazio)', () => {
  it('(a) origemCampo NUNCA retorna "copiado" quando a classe é MANUAL (qualquer valor)', () => {
    fc.assert(
      fc.property(arbValorQualquer, (valor) => {
        const origem = origemCampo('MANUAL', valor)
        expect(origem).not.toBe('copiado')
        // Reforço: MANUAL só pode produzir os dois estados manuais.
        expect(['manual-preenchido', 'manual-vazio']).toContain(origem)
      }),
      RUNS,
    )
  })

  it('(a) para TODA classe conhecida em CLASSE_CAMPO_TECNICO, "copiado" só surge quando a classe é COPIAVEL', () => {
    const nomesCampos = Object.keys(CLASSE_CAMPO_TECNICO)
    fc.assert(
      fc.property(fc.constantFrom(...nomesCampos), arbValorQualquer, (campo, valor) => {
        const classe = CLASSE_CAMPO_TECNICO[campo]
        const origem = origemCampo(classe, valor)
        if (origem === 'copiado') {
          expect(classe).toBe('COPIAVEL')
        }
        if (classe === 'MANUAL') {
          expect(origem).not.toBe('copiado')
        }
      }),
      RUNS,
    )
  })

  // ==========================================================================
  // (b) MAPEAMENTO dos 4 casos da tabela
  // ==========================================================================

  it('(b) COPIAVEL + preenchido → "copiado"', () => {
    fc.assert(
      fc.property(arbValorPreenchidoGenerico, (valor) => {
        // Pré-condição: o valor é de fato preenchido pela regra genérica.
        fc.pre(!valorVazio('', valor))
        expect(origemCampo('COPIAVEL', valor)).toBe('copiado')
      }),
      RUNS,
    )
  })

  it('(b) COPIAVEL + vazio → "vazio"', () => {
    fc.assert(
      fc.property(arbValorVazioGenerico, (valor) => {
        fc.pre(valorVazio('', valor))
        expect(origemCampo('COPIAVEL', valor)).toBe('vazio')
      }),
      RUNS,
    )
  })

  it('(b) MANUAL + preenchido → "manual-preenchido"', () => {
    fc.assert(
      fc.property(arbValorPreenchidoGenerico, (valor) => {
        fc.pre(!valorVazio('', valor))
        expect(origemCampo('MANUAL', valor)).toBe('manual-preenchido')
      }),
      RUNS,
    )
  })

  it('(b) MANUAL + vazio → "manual-vazio"', () => {
    fc.assert(
      fc.property(arbValorVazioGenerico, (valor) => {
        fc.pre(valorVazio('', valor))
        expect(origemCampo('MANUAL', valor)).toBe('manual-vazio')
      }),
      RUNS,
    )
  })

  it('(b) a origem retornada é coerente classe × vazio para qualquer entrada', () => {
    fc.assert(
      fc.property(arbClasse, arbValorQualquer, (classe, valor) => {
        const vazio = valorVazio('', valor)
        const esperado =
          classe === 'COPIAVEL'
            ? vazio
              ? 'vazio'
              : 'copiado'
            : vazio
              ? 'manual-vazio'
              : 'manual-preenchido'
        expect(origemCampo(classe, valor)).toBe(esperado)
      }),
      RUNS,
    )
  })

  // ==========================================================================
  // (c) DETERMINISMO — mesma entrada → mesma saída
  // ==========================================================================

  it('(c) origemCampo é determinística (mesma entrada → mesma saída)', () => {
    fc.assert(
      fc.property(arbClasse, arbValorQualquer, (classe, valor) => {
        const a = origemCampo(classe, valor)
        const b = origemCampo(classe, valor)
        expect(a).toBe(b)
      }),
      RUNS,
    )
  })

  it('(c) o conjunto de saídas possíveis é fechado nos 4 estados da legenda', () => {
    fc.assert(
      fc.property(arbClasse, arbValorQualquer, (classe, valor) => {
        const origem = origemCampo(classe, valor)
        expect(['copiado', 'manual-preenchido', 'manual-vazio', 'vazio']).toContain(origem)
      }),
      RUNS,
    )
  })

  // ==========================================================================
  // Casos-exemplo explícitos (âncora de regressão da tabela)
  // ==========================================================================

  it('tabela da Property 4 (exemplos explícitos)', () => {
    expect(origemCampo('COPIAVEL', 'ABC123')).toBe('copiado')
    expect(origemCampo('COPIAVEL', '')).toBe('vazio')
    expect(origemCampo('COPIAVEL', null)).toBe('vazio')
    expect(origemCampo('MANUAL', 'texto')).toBe('manual-preenchido')
    expect(origemCampo('MANUAL', '')).toBe('manual-vazio')
    expect(origemCampo('MANUAL', undefined)).toBe('manual-vazio')
    // siglaAcabado é o único COPIAVEL do de-para.
    expect(CLASSE_CAMPO_TECNICO.siglaAcabado).toBe('COPIAVEL')
    expect(CLASSE_CAMPO_TECNICO.tributacao).toBe('MANUAL')
  })
})
