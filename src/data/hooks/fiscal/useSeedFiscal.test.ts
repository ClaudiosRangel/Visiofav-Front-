import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

import {
  montarTabelasSeedPayload,
  botaoSeedHabilitado,
  classificarResultadoSeedPorTabela,
  deveExibirDadosParciaisSeed,
  deveExibirLinkSeedFiscal,
  type CadastroFiscal,
  type ResultadoTabela,
  type ResultadoTabelaSucesso,
  type ResultadoTabelaErro,
} from './useSeedFiscal'

const TABELAS_FISCAIS: CadastroFiscal[] = ['NCM', 'CFOP', 'CEST']

describe('montarTabelasSeedPayload', () => {
  // Feature: melhorias-compras-wms-fiscal-frontend, Property 5: Payload do seed
  // reflete exatamente o conjunto de tabelas selecionado
  it('reflete exatamente o conjunto de tabelas selecionado, sem duplicatas', () => {
    fc.assert(
      fc.property(fc.uniqueArray(fc.constantFrom(...TABELAS_FISCAIS)), (tabelasSelecionadas) => {
        const selecionados = new Set<CadastroFiscal>(tabelasSelecionadas)

        const payload = montarTabelasSeedPayload(selecionados)

        // Mesmo conjunto de elementos, sem mais nem menos
        expect(new Set(payload.tabelas)).toEqual(selecionados)
        expect(payload.tabelas.length).toBe(selecionados.size)

        // Nenhuma duplicata no array resultante
        expect(new Set(payload.tabelas).size).toBe(payload.tabelas.length)
      }),
      { numRuns: 100 },
    )
  })

  it('conjunto vazio produz payload com tabelas vazio', () => {
    const payload = montarTabelasSeedPayload(new Set<CadastroFiscal>())
    expect(payload).toEqual({ tabelas: [] })
  })
})

describe('botaoSeedHabilitado', () => {
  // Feature: melhorias-compras-wms-fiscal-frontend, Property 6: Botão de disparo do
  // seed é habilitado se e somente se ao menos uma tabela está selecionada
  // Validates: Requirements 5.1
  it('é habilitado se e somente se ao menos uma tabela está selecionada', () => {
    fc.assert(
      fc.property(fc.subarray(TABELAS_FISCAIS), (tabelasSelecionadas) => {
        const selecionados = new Set<CadastroFiscal>(tabelasSelecionadas)

        const habilitado = botaoSeedHabilitado(selecionados)

        expect(habilitado).toBe(selecionados.size > 0)
      }),
      { numRuns: 100 },
    )
  })

  it('conjunto vazio produz botão desabilitado', () => {
    expect(botaoSeedHabilitado(new Set<CadastroFiscal>())).toBe(false)
  })

  it('qualquer conjunto de um único elemento produz botão habilitado', () => {
    for (const tabela of TABELAS_FISCAIS) {
      expect(botaoSeedHabilitado(new Set<CadastroFiscal>([tabela]))).toBe(true)
    }
  })

  it('todas as três tabelas selecionadas produz botão habilitado', () => {
    expect(botaoSeedHabilitado(new Set<CadastroFiscal>(TABELAS_FISCAIS))).toBe(true)
  })
})

describe('classificarResultadoSeedPorTabela', () => {
  // Feature: melhorias-compras-wms-fiscal-frontend, Property 7: Classificação do
  // resultado do seed por tabela é independente e determinística
  // Validates: Requirements 5.4, 5.5
  const arbSucesso: fc.Arbitrary<ResultadoTabelaSucesso> = fc.record({
    inseridos: fc.nat(),
    ignorados: fc.nat(),
  })

  const arbErro: fc.Arbitrary<ResultadoTabelaErro> = fc.record({
    erro: fc.record({
      code: fc.string(),
      message: fc.string(),
    }),
  })

  it('resultado de sucesso é sempre classificado como sucesso com a mensagem formatada correta', () => {
    fc.assert(
      fc.property(arbSucesso, (resultado) => {
        const classificacao = classificarResultadoSeedPorTabela(resultado)

        expect(classificacao).toEqual({
          tipo: 'sucesso',
          mensagem: `${resultado.inseridos} inserido(s), ${resultado.ignorados} ignorado(s)`,
        })
      }),
      { numRuns: 100 },
    )
  })

  it('resultado de erro é sempre classificado como falha com a mensagem do erro', () => {
    fc.assert(
      fc.property(arbErro, (resultado) => {
        const classificacao = classificarResultadoSeedPorTabela(resultado)

        expect(classificacao).toEqual({
          tipo: 'falha',
          mensagem: resultado.erro.message,
        })
      }),
      { numRuns: 100 },
    )
  })

  it('é determinística: mesma entrada sempre produz a mesma saída', () => {
    fc.assert(
      fc.property(fc.oneof(arbSucesso, arbErro), (resultado) => {
        const primeira = classificarResultadoSeedPorTabela(resultado)
        const segunda = classificarResultadoSeedPorTabela(resultado)

        expect(primeira).toEqual(segunda)
      }),
      { numRuns: 100 },
    )
  })

  it('classificação de um resultado é independente da classificação de outro resultado', () => {
    fc.assert(
      fc.property(
        fc.oneof(arbSucesso, arbErro),
        fc.oneof(arbSucesso, arbErro),
        (resultadoA, resultadoB) => {
          const classificacaoAIsolada = classificarResultadoSeedPorTabela(resultadoA)

          // Classifica B "no meio" — não deve afetar o resultado de A calculado antes ou depois
          classificarResultadoSeedPorTabela(resultadoB)
          const classificacaoADepoisDeB = classificarResultadoSeedPorTabela(resultadoA)

          expect(classificacaoADepoisDeB).toEqual(classificacaoAIsolada)
        },
      ),
      { numRuns: 100 },
    )
  })
})

describe('deveExibirDadosParciaisSeed', () => {
  // Feature: melhorias-compras-wms-fiscal-frontend, Property 8: Dados parciais do
  // seed nunca são exibidos quando a API retorna 403
  // Validates: Requirements 5.7
  it('retorna false quando o status é 403', () => {
    fc.assert(
      fc.property(fc.constant(403), (status) => {
        expect(deveExibirDadosParciaisSeed(status)).toBe(false)
      }),
      { numRuns: 100 },
    )
  })

  it('retorna true para qualquer status diferente de 403', () => {
    fc.assert(
      fc.property(
        fc.integer().filter((status) => status !== 403),
        (status) => {
          expect(deveExibirDadosParciaisSeed(status)).toBe(true)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('é total e determinística para qualquer status inteiro', () => {
    fc.assert(
      fc.property(fc.integer(), (status) => {
        const primeira = deveExibirDadosParciaisSeed(status)
        const segunda = deveExibirDadosParciaisSeed(status)

        expect(typeof primeira).toBe('boolean')
        expect(primeira).toBe(segunda)
        expect(primeira).toBe(status !== 403)
      }),
      { numRuns: 100 },
    )
  })
})

describe('deveExibirLinkSeedFiscal', () => {
  // Feature: melhorias-compras-wms-fiscal-frontend, Property 9: Link de navegação
  // do Seed Fiscal é visível apenas para perfis administrativos
  // Validates: Requirements 6.3
  const PERFIS_ADMIN = ['ADMIN', 'SUPER_ADMIN'] as const

  it('retorna true para qualquer perfil administrativo', () => {
    fc.assert(
      fc.property(fc.constantFrom(...PERFIS_ADMIN), (perfil) => {
        expect(deveExibirLinkSeedFiscal(perfil)).toBe(true)
      }),
      { numRuns: 100 },
    )
  })

  it('retorna false para qualquer string que não seja um perfil administrativo', () => {
    fc.assert(
      fc.property(
        fc.string().filter((perfil) => !PERFIS_ADMIN.includes(perfil as any)),
        (perfil) => {
          expect(deveExibirLinkSeedFiscal(perfil)).toBe(false)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('retorna false quando o perfil é null', () => {
    expect(deveExibirLinkSeedFiscal(null)).toBe(false)
  })
})
