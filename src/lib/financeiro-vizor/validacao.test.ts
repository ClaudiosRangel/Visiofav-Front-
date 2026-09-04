/**
 * Testes property-based (fast-check + Vitest) das funções puras de validação do
 * painel Financeiro Vizor.
 *
 * Cobre as Correctness Properties do design:
 * - Property 2: validação do dia de vencimento (Requirements 3.6)
 * - Property 3: validação do preço (Requirements 3.8)
 * - Property 4: validação da data de contrato não futura (Requirements 3.7)
 * - Property 5: validação do número de meses (Requirements 4.12)
 */

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import {
  validarDataContrato,
  validarDiaVencimento,
  validarMeses,
  validarPreco,
} from './validacao'
import {
  DIA_VENCIMENTO_MAX,
  DIA_VENCIMENTO_MIN,
  MESES_MAX,
  MESES_MIN,
  PRECO_MAX,
  PRECO_MIN,
} from './types'

/**
 * Property 2: `validarDiaVencimento(d)` retorna `null` se e somente se `d` é
 * inteiro e 1 <= d <= 31; caso contrário retorna mensagem não vazia.
 *
 * **Validates: Requirements 3.6**
 */
describe('Property 2: validação do dia de vencimento', () => {
  it('retorna null exatamente quando o dia é inteiro entre 1 e 31', () => {
    fc.assert(
      fc.property(fc.double({ min: -1000, max: 1000, noNaN: true }), (dia) => {
        const valido =
          Number.isInteger(dia) && dia >= DIA_VENCIMENTO_MIN && dia <= DIA_VENCIMENTO_MAX
        const resultado = validarDiaVencimento(dia)
        if (valido) {
          expect(resultado).toBeNull()
        } else {
          expect(resultado).not.toBeNull()
          expect((resultado as string).length).toBeGreaterThan(0)
        }
      }),
    )
  })

  it('aceita todos os inteiros do intervalo válido [1..31]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: DIA_VENCIMENTO_MIN, max: DIA_VENCIMENTO_MAX }),
        (dia) => {
          expect(validarDiaVencimento(dia)).toBeNull()
        },
      ),
    )
  })

  it('rejeita inteiros fora do intervalo com mensagem não vazia', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: -1000, max: DIA_VENCIMENTO_MIN - 1 }),
          fc.integer({ min: DIA_VENCIMENTO_MAX + 1, max: 1000 }),
        ),
        (dia) => {
          const resultado = validarDiaVencimento(dia)
          expect(resultado).not.toBeNull()
          expect((resultado as string).length).toBeGreaterThan(0)
        },
      ),
    )
  })
})

/**
 * Property 3: `validarPreco(p)` retorna `null` se e somente se
 * 0 <= p <= 999.999.999,99 com no máximo duas casas decimais; caso contrário
 * retorna mensagem não vazia.
 *
 * **Validates: Requirements 3.8**
 */
describe('Property 3: validação do preço', () => {
  it('aceita qualquer valor em centavos dentro do intervalo (<= 2 casas)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: Math.round(PRECO_MAX * 100) }),
        (centavos) => {
          const preco = centavos / 100
          expect(validarPreco(preco)).toBeNull()
        },
      ),
    )
  })

  it('rejeita valores negativos ou acima do teto com mensagem não vazia', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.double({ min: -1_000_000, max: -0.01, noNaN: true }),
          fc.double({ min: PRECO_MAX + 0.01, max: PRECO_MAX + 1_000_000, noNaN: true }),
        ),
        (preco) => {
          const resultado = validarPreco(preco)
          expect(resultado).not.toBeNull()
          expect((resultado as string).length).toBeGreaterThan(0)
        },
      ),
    )
  })

  it('rejeita valores com mais de duas casas decimais', () => {
    fc.assert(
      fc.property(
        // milésimos de real dentro do intervalo, mas não múltiplos de centavo
        fc
          .integer({ min: 1, max: Math.round(PRECO_MAX * 1000) })
          .filter((milesimos) => milesimos % 10 !== 0),
        (milesimos) => {
          const preco = milesimos / 1000
          const resultado = validarPreco(preco)
          expect(resultado).not.toBeNull()
          expect((resultado as string).length).toBeGreaterThan(0)
        },
      ),
    )
  })

  it('rejeita NaN e infinitos', () => {
    expect(validarPreco(Number.NaN)).not.toBeNull()
    expect(validarPreco(Number.POSITIVE_INFINITY)).not.toBeNull()
    expect(validarPreco(Number.NEGATIVE_INFINITY)).not.toBeNull()
  })

  it('aceita os limites exatos do intervalo', () => {
    expect(validarPreco(PRECO_MIN)).toBeNull()
    expect(validarPreco(PRECO_MAX)).toBeNull()
  })
})

/**
 * Property 4: `validarDataContrato(s)` retorna `null` se e somente se `s` é uma
 * data válida com valor menor ou igual à data atual; datas inválidas ou futuras
 * retornam mensagem.
 *
 * **Validates: Requirements 3.7**
 */
describe('Property 4: validação da data de contrato não futura', () => {
  const umDiaMs = 24 * 60 * 60 * 1000

  it('aceita qualquer data passada ou de hoje (formato YYYY-MM-DD)', () => {
    fc.assert(
      fc.property(
        // até ~40 anos no passado, sempre <= hoje
        fc.integer({ min: 0, max: 40 * 365 }),
        (diasAtras) => {
          const d = new Date(Date.now() - diasAtras * umDiaMs)
          const iso = d.toISOString().slice(0, 10) // YYYY-MM-DD
          expect(validarDataContrato(iso)).toBeNull()
        },
      ),
    )
  })

  it('rejeita datas futuras com mensagem não vazia', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 40 * 365 }), (diasFrente) => {
        const d = new Date(Date.now() + diasFrente * umDiaMs)
        const iso = d.toISOString().slice(0, 10)
        const resultado = validarDataContrato(iso)
        expect(resultado).not.toBeNull()
        expect((resultado as string).length).toBeGreaterThan(0)
      }),
    )
  })

  it('rejeita strings que não são datas válidas', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => Number.isNaN(new Date(s).getTime())),
        (texto) => {
          const resultado = validarDataContrato(texto)
          expect(resultado).not.toBeNull()
          expect((resultado as string).length).toBeGreaterThan(0)
        },
      ),
    )
  })

  it('rejeita string vazia', () => {
    expect(validarDataContrato('')).not.toBeNull()
    expect(validarDataContrato('   ')).not.toBeNull()
  })
})

/**
 * Property 5: `validarMeses(n)` retorna `null` se e somente se `n` é inteiro e
 * 1 <= n <= 60.
 *
 * **Validates: Requirements 4.12**
 */
describe('Property 5: validação do número de meses', () => {
  it('retorna null exatamente quando é inteiro entre 1 e 60', () => {
    fc.assert(
      fc.property(fc.double({ min: -1000, max: 1000, noNaN: true }), (meses) => {
        const valido = Number.isInteger(meses) && meses >= MESES_MIN && meses <= MESES_MAX
        const resultado = validarMeses(meses)
        if (valido) {
          expect(resultado).toBeNull()
        } else {
          expect(resultado).not.toBeNull()
          expect((resultado as string).length).toBeGreaterThan(0)
        }
      }),
    )
  })

  it('aceita todos os inteiros do intervalo válido [1..60]', () => {
    fc.assert(
      fc.property(fc.integer({ min: MESES_MIN, max: MESES_MAX }), (meses) => {
        expect(validarMeses(meses)).toBeNull()
      }),
    )
  })

  it('rejeita inteiros fora do intervalo com mensagem não vazia', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.integer({ min: -1000, max: MESES_MIN - 1 }),
          fc.integer({ min: MESES_MAX + 1, max: 1000 }),
        ),
        (meses) => {
          const resultado = validarMeses(meses)
          expect(resultado).not.toBeNull()
          expect((resultado as string).length).toBeGreaterThan(0)
        },
      ),
    )
  })
})
