import { describe, it, expect } from 'vitest'
import * as fc from 'fast-check'

import {
  traduzirTipoMovimentacao,
  TIPO_LABELS,
  montarParametrosKardex,
  deveExibirEstadoVazioKardex,
  deveExibirEstadoFalhaKardex,
  deveManterHistoricoAoFalharSaldo,
  type TipoMovimentacaoEstoque,
} from './useKardex'

const TIPOS_CONHECIDOS: TipoMovimentacaoEstoque[] = [
  'ENTRADA_COMPRA',
  'SAIDA_VENDA',
  'AJUSTE_MANUAL',
  'ENTRADA_ESTORNO_VENDA',
  'SAIDA_ESTORNO_COMPRA',
]

describe('traduzirTipoMovimentacao', () => {
  // Feature: melhorias-compras-wms-fiscal-frontend, Property 10: Tradução de
  // tipo de movimentação é total e determinística
  // Validates: Requirements 7.2

  it('traduz cada um dos tipos conhecidos para o rótulo pt-BR exato', () => {
    expect(traduzirTipoMovimentacao('ENTRADA_COMPRA')).toBe('Entrada por Compra')
    expect(traduzirTipoMovimentacao('SAIDA_VENDA')).toBe('Saída por Venda')
    expect(traduzirTipoMovimentacao('AJUSTE_MANUAL')).toBe('Ajuste Manual')
    expect(traduzirTipoMovimentacao('ENTRADA_ESTORNO_VENDA')).toBe('Entrada por Estorno de Venda')
    expect(traduzirTipoMovimentacao('SAIDA_ESTORNO_COMPRA')).toBe('Saída por Estorno de Compra')
  })

  it('para qualquer tipo conhecido, retorna exatamente o rótulo da tabela TIPO_LABELS', () => {
    fc.assert(
      fc.property(fc.constantFrom(...TIPOS_CONHECIDOS), (tipo) => {
        expect(traduzirTipoMovimentacao(tipo)).toBe(TIPO_LABELS[tipo])
      }),
      { numRuns: 100 },
    )
  })

  it('totalidade: para qualquer string que não seja um tipo conhecido, retorna a própria entrada sem lançar exceção e sem ser undefined', () => {
    fc.assert(
      fc.property(
        fc.string().filter((s) => !TIPOS_CONHECIDOS.includes(s as TipoMovimentacaoEstoque)),
        (tipoDesconhecido) => {
          let resultado: string = ''
          expect(() => {
            resultado = traduzirTipoMovimentacao(tipoDesconhecido)
          }).not.toThrow()
          expect(resultado).toBe(tipoDesconhecido)
          expect(resultado).not.toBeUndefined()
        },
      ),
      { numRuns: 100 },
    )
  })

  it('determinismo: chamar a função duas vezes com a mesma entrada produz sempre a mesma saída', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constantFrom(...TIPOS_CONHECIDOS), fc.string()),
        (tipo) => {
          const primeiraChamada = traduzirTipoMovimentacao(tipo)
          const segundaChamada = traduzirTipoMovimentacao(tipo)
          expect(segundaChamada).toBe(primeiraChamada)
        },
      ),
      { numRuns: 100 },
    )
  })
})

describe('montarParametrosKardex', () => {
  // Feature: melhorias-compras-wms-fiscal-frontend, Property 11: Parâmetros de
  // filtro do Kardex refletem exatamente as datas preenchidas
  // Validates: Requirements 7.3

  const dataOuNula = fc.option(fc.date({ noInvalidDate: true }), { nil: null })

  it('presença de cada chave reflete exatamente se a data correspondente é não nula', () => {
    fc.assert(
      fc.property(dataOuNula, dataOuNula, (dataInicio, dataFim) => {
        const params = montarParametrosKardex(dataInicio, dataFim)

        expect(Object.prototype.hasOwnProperty.call(params, 'dataInicio')).toBe(dataInicio !== null)
        expect(Object.prototype.hasOwnProperty.call(params, 'dataFim')).toBe(dataFim !== null)
      }),
      { numRuns: 100 },
    )
  })

  it('quando presente, o valor de cada parâmetro é exatamente a data no formato yyyy-MM-dd', () => {
    fc.assert(
      fc.property(dataOuNula, dataOuNula, (dataInicio, dataFim) => {
        const params = montarParametrosKardex(dataInicio, dataFim)

        if (dataInicio !== null) {
          expect(params.dataInicio).toBe(dataInicio.toISOString().split('T')[0])
        }
        if (dataFim !== null) {
          expect(params.dataFim).toBe(dataFim.toISOString().split('T')[0])
        }
      }),
      { numRuns: 100 },
    )
  })

  it('nunca contém chaves além de dataInicio/dataFim', () => {
    fc.assert(
      fc.property(dataOuNula, dataOuNula, (dataInicio, dataFim) => {
        const params = montarParametrosKardex(dataInicio, dataFim)

        expect(Object.keys(params).every((chave) => chave === 'dataInicio' || chave === 'dataFim')).toBe(true)
      }),
      { numRuns: 100 },
    )
  })

  it('quando ambas as datas são nulas, retorna um objeto vazio', () => {
    expect(montarParametrosKardex(null, null)).toEqual({})
  })
})

describe('deveExibirEstadoVazioKardex e deveExibirEstadoFalhaKardex', () => {
  // Feature: melhorias-compras-wms-fiscal-frontend, Property 12: Estado vazio e
  // estado de falha do Kardex são mutuamente exclusivos e corretamente determinados
  // Validates: Requirements 7.5, 7.6

  const listaArbitraria = fc.array(fc.anything())

  it('deveExibirEstadoVazioKardex é verdadeiro se e somente se a lista está vazia e não houve erro', () => {
    fc.assert(
      fc.property(listaArbitraria, fc.boolean(), (lista, ocorreuErro) => {
        const resultado = deveExibirEstadoVazioKardex(lista as any, ocorreuErro)
        expect(resultado).toBe(lista.length === 0 && !ocorreuErro)
      }),
      { numRuns: 100 },
    )
  })

  it('deveExibirEstadoFalhaKardex é verdadeiro se e somente se ocorreuErro é verdadeiro', () => {
    fc.assert(
      fc.property(fc.boolean(), (ocorreuErro) => {
        expect(deveExibirEstadoFalhaKardex(ocorreuErro)).toBe(ocorreuErro)
      }),
      { numRuns: 100 },
    )
  })

  it('mutualmente exclusivos: nunca ambos são verdadeiros para a mesma combinação de entrada', () => {
    fc.assert(
      fc.property(listaArbitraria, fc.boolean(), (lista, ocorreuErro) => {
        const estadoVazio = deveExibirEstadoVazioKardex(lista as any, ocorreuErro)
        const estadoFalha = deveExibirEstadoFalhaKardex(ocorreuErro)
        expect(estadoVazio && estadoFalha).toBe(false)
      }),
      { numRuns: 100 },
    )
  })

  it('quando ocorreuErro é verdadeiro, uma lista vazia ainda exibe o estado de falha, não o estado vazio', () => {
    expect(deveExibirEstadoVazioKardex([], true)).toBe(false)
    expect(deveExibirEstadoFalhaKardex(true)).toBe(true)
  })
})

describe('deveManterHistoricoAoFalharSaldo', () => {
  // Feature: melhorias-compras-wms-fiscal-frontend, Property 13: Falha na
  // consulta de saldo nunca oculta o histórico já carregado
  // Validates: Requirements 8.3

  it('o resultado depende exclusivamente de historicoTemDados, independentemente de saldoTeveErro', () => {
    fc.assert(
      fc.property(fc.boolean(), fc.boolean(), (saldoTeveErro, historicoTemDados) => {
        expect(deveManterHistoricoAoFalharSaldo(saldoTeveErro, historicoTemDados)).toBe(historicoTemDados)
      }),
      { numRuns: 100 },
    )
  })

  it('independência: variar saldoTeveErro mantendo historicoTemDados fixo nunca altera o resultado', () => {
    fc.assert(
      fc.property(fc.boolean(), (historicoTemDados) => {
        const resultadoComErro = deveManterHistoricoAoFalharSaldo(true, historicoTemDados)
        const resultadoSemErro = deveManterHistoricoAoFalharSaldo(false, historicoTemDados)
        expect(resultadoComErro).toBe(resultadoSemErro)
      }),
      { numRuns: 100 },
    )
  })

  it('saldo falhou mas histórico tem dados: histórico continua sendo exibido', () => {
    expect(deveManterHistoricoAoFalharSaldo(true, true)).toBe(true)
  })

  it('saldo falhou e histórico não tem dados: nada a exibir, independente do erro de saldo', () => {
    expect(deveManterHistoricoAoFalharSaldo(true, false)).toBe(false)
  })
})
