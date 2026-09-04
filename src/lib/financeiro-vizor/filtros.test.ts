/**
 * Testes property-based (fast-check) e unitários dos filtros da listagem de
 * empresas do painel Financeiro Vizor.
 *
 * Cobre as Correctness Properties do design:
 * - Property 6: filtro por nome é case-insensitive e por substring; termo
 *   vazio retorna todas.
 * - Property 7: filtro por status retorna exatamente as empresas com o status
 *   selecionado; `'todos'` retorna a lista inteira.
 */

import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { filtrarPorNome, filtrarPorStatus, filtrarEmpresas } from './filtros'
import type { EmpresaStatusView, StatusFinanceiro } from './types'

const STATUS: StatusFinanceiro[] = ['ATIVO', 'SOMENTE_LEITURA', 'INATIVADO']

/** Gerador de uma empresa arbitrária (só os campos relevantes para o filtro importam). */
const empresaArb: fc.Arbitrary<EmpresaStatusView> = fc.record({
  empresaId: fc.uuid(),
  nome: fc.string({ maxLength: 40 }),
  statusFinanceiro: fc.constantFrom(...STATUS),
  totalMensal: fc.double({ min: 0, max: 1_000_000, noNaN: true }),
  totalVencidoEmAberto: fc.double({ min: 0, max: 1_000_000, noNaN: true }),
})

const empresasArb = fc.array(empresaArb, { maxLength: 30 })

describe('filtrarPorNome — Property 6', () => {
  it('retorna exatamente as empresas cujo nome contém o termo (case-insensitive)', () => {
    // **Validates: Requirements 2.6**
    fc.assert(
      fc.property(empresasArb, fc.string({ maxLength: 10 }), (empresas, termo) => {
        const resultado = filtrarPorNome(empresas, termo)
        const alvo = termo.trim().toLowerCase()

        if (alvo === '') {
          // Termo vazio (ou só espaços) retorna todas.
          expect(resultado).toEqual(empresas)
          return
        }

        const esperado = empresas.filter((e) => e.nome.toLowerCase().includes(alvo))
        expect(resultado).toEqual(esperado)
        // Toda empresa do resultado realmente contém o termo (ignorando caixa).
        expect(resultado.every((e) => e.nome.toLowerCase().includes(alvo))).toBe(true)
        // Nenhuma empresa fora do resultado deveria conter o termo.
        const fora = empresas.filter((e) => !resultado.includes(e))
        expect(fora.every((e) => !e.nome.toLowerCase().includes(alvo))).toBe(true)
      }),
    )
  })

  it('é insensível a maiúsculas/minúsculas no termo e no nome', () => {
    // **Validates: Requirements 2.6**
    fc.assert(
      fc.property(empresasArb, fc.string({ minLength: 1, maxLength: 8 }), (empresas, termo) => {
        fc.pre(termo.trim() !== '')
        const alta = filtrarPorNome(empresas, termo.toUpperCase())
        const baixa = filtrarPorNome(empresas, termo.toLowerCase())
        expect(alta).toEqual(baixa)
      }),
    )
  })

  it('termo vazio retorna todas as empresas (exemplos)', () => {
    // **Validates: Requirements 2.6**
    const empresas: EmpresaStatusView[] = [
      { empresaId: '1', nome: 'Alpha', statusFinanceiro: 'ATIVO', totalMensal: 0, totalVencidoEmAberto: 0 },
      { empresaId: '2', nome: 'Beta', statusFinanceiro: 'INATIVADO', totalMensal: 0, totalVencidoEmAberto: 0 },
    ]
    expect(filtrarPorNome(empresas, '')).toEqual(empresas)
    expect(filtrarPorNome(empresas, '   ')).toEqual(empresas)
    expect(filtrarPorNome(empresas, 'lph')).toEqual([empresas[0]])
    expect(filtrarPorNome(empresas, 'BET')).toEqual([empresas[1]])
  })
})

describe('filtrarPorStatus — Property 7', () => {
  it('retorna exatamente as empresas com o status selecionado', () => {
    // **Validates: Requirements 2.7**
    fc.assert(
      fc.property(empresasArb, fc.constantFrom(...STATUS), (empresas, status) => {
        const resultado = filtrarPorStatus(empresas, status)
        expect(resultado).toEqual(empresas.filter((e) => e.statusFinanceiro === status))
        expect(resultado.every((e) => e.statusFinanceiro === status)).toBe(true)
      }),
    )
  })

  it("'todos' retorna a lista inteira", () => {
    // **Validates: Requirements 2.8**
    fc.assert(
      fc.property(empresasArb, (empresas) => {
        expect(filtrarPorStatus(empresas, 'todos')).toEqual(empresas)
      }),
    )
  })

  it('a soma dos filtros por cada status equivale à lista inteira (partição)', () => {
    // **Validates: Requirements 2.7, 2.8**
    fc.assert(
      fc.property(empresasArb, (empresas) => {
        const soma = STATUS.reduce((acc, s) => acc + filtrarPorStatus(empresas, s).length, 0)
        expect(soma).toBe(empresas.length)
      }),
    )
  })
})

describe('filtrarEmpresas — combinação', () => {
  it('equivale a aplicar nome e depois status', () => {
    // **Validates: Requirements 2.6, 2.7, 2.8**
    fc.assert(
      fc.property(
        empresasArb,
        fc.string({ maxLength: 8 }),
        fc.constantFrom<StatusFinanceiro | 'todos'>('ATIVO', 'SOMENTE_LEITURA', 'INATIVADO', 'todos'),
        (empresas, termo, status) => {
          const combinado = filtrarEmpresas(empresas, { termo, status })
          const passo = filtrarPorStatus(filtrarPorNome(empresas, termo), status)
          expect(combinado).toEqual(passo)
        },
      ),
    )
  })
})
