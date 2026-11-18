import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import {
  camposDoMaterial,
  erroDoParametro,
  escolhaDosParametros,
  escolhaInicial,
  mesmaEscolha,
  rascunhoDaSelecao,
  rascunhoVazio,
  ROTULO_MEDIDA_MM,
  textoIntervalo,
  validarRascunho,
} from './parametro-material'
import { PARAM_MATERIAL } from '../../../_validacao/validar-faixa'

const material = (tipoParam: number | null, extra: { unidadeCusto?: string; tipoMaterial?: string } = {}) => ({
  id: 'm1',
  tipoParam,
  ...extra,
})

describe('camposDoMaterial — rótulo por tipoParam', () => {
  it('tipoParam 3 mostra "Medida em mm"', () => {
    expect(camposDoMaterial(material(3)).map((c) => [c.chave, c.rotulo])).toEqual([['param1', ROTULO_MEDIDA_MM]])
  })

  it('tipoParam 0 mostra Peças por caixa', () => {
    expect(camposDoMaterial(material(0)).map((c) => [c.chave, c.rotulo])).toEqual([['pecasPorCaixa', 'Peças por caixa']])
  })

  it('tipoParam 1 mostra % frente e % verso (e gramatura quando KG)', () => {
    expect(camposDoMaterial(material(1)).map((c) => c.rotulo)).toEqual(['% frente', '% verso'])
    expect(camposDoMaterial(material(1, { unidadeCusto: 'KG' })).map((c) => c.rotulo)).toEqual([
      '% frente',
      '% verso',
      'Gramatura (kg/m²)',
    ])
  })

  it('tipoParam 4 mostra Quantidade por peça', () => {
    expect(camposDoMaterial(material(4)).map((c) => c.rotulo)).toEqual(['Quantidade por peça'])
  })

  it('tipoParam 2 (informativo), material nulo e sem tipoParam conservador não têm campo', () => {
    expect(camposDoMaterial(material(2))).toEqual([])
    expect(camposDoMaterial(null)).toEqual([])
    expect(camposDoMaterial(material(null))).toEqual([])
  })

  it('sem tipoParam, usa o tipo de material do cadastro', () => {
    expect(camposDoMaterial(material(null, { tipoMaterial: 'ACONDICIONAMENTO' })).map((c) => c.chave)).toEqual(['pecasPorCaixa'])
  })
})

describe('validação com PARAM_MATERIAL (R11.5, R11.6)', () => {
  it.each(['0,01', '1', '12,5', '12.5', '99999,99', '99.999,99'])('aceita %s', (v) => {
    expect(erroDoParametro(v, PARAM_MATERIAL)).toBeNull()
  })

  it.each(['', '  ', '0', '0,00', '-1', '100000', '99999,991', '1,234', 'abc'])('rejeita "%s" com o intervalo permitido', (v) => {
    expect(erroDoParametro(v, PARAM_MATERIAL)).toBe(
      'Informe um valor maior que 0 e até 99.999,99, com até 2 casas decimais.',
    )
  })

  it('propriedade: número em (0, 99999,99] com 2 casas é aceito; acima é rejeitado', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 9999999 }), (c) => {
        expect(erroDoParametro((c / 100).toFixed(2).replace('.', ','), PARAM_MATERIAL)).toBeNull()
      }),
    )
    fc.assert(
      fc.property(fc.integer({ min: 10000000, max: 99999999 }), (c) => {
        expect(erroDoParametro((c / 100).toFixed(2).replace('.', ','), PARAM_MATERIAL)).not.toBeNull()
      }),
    )
  })

  it('textoIntervalo descreve a faixa', () => {
    expect(textoIntervalo(PARAM_MATERIAL)).toContain('99.999,99')
  })
})

describe('% verso aceita 0 (padrão), % frente não', () => {
  const m = material(1)
  it('verso 0 é válido', () => {
    const r = validarRascunho(camposDoMaterial(m), { ...rascunhoVazio(), param1: '100', param2: '0' })
    expect(r.valido).toBe(true)
  })
  it('frente 0 é inválida', () => {
    const r = validarRascunho(camposDoMaterial(m), { ...rascunhoVazio(), param1: '0', param2: '0' })
    expect(r.erros.param1).toBeTruthy()
    expect(r.erros.param2).toBeUndefined()
  })
  it('acima de 100 % é inválido', () => {
    expect(validarRascunho(camposDoMaterial(m), { ...rascunhoVazio(), param1: '101', param2: '0' }).valido).toBe(false)
  })
})

describe('escolhaDosParametros — nunca monta escolha inválida', () => {
  const m = material(3)

  it('valor válido vira escolha numérica com o tipoParam e a restrição', () => {
    const r = escolhaDosParametros(m, { ...rascunhoVazio(), param1: '12,5' }, 'r1')
    expect(r.erros).toEqual({})
    expect(r.escolha).toMatchObject({ materialId: 'm1', tipoParam: 3, param1: 12.5, restricaoId: 'r1' })
  })

  it.each(['', '0', '-3', '100000', 'x'])('valor "%s" não gera escolha', (v) => {
    const r = escolhaDosParametros(m, { ...rascunhoVazio(), param1: v })
    expect(r.escolha).toBeNull()
    expect(r.erros.param1).toBeTruthy()
  })

  it('material sem campo gera escolha sem validar nada', () => {
    const r = escolhaDosParametros(material(2), rascunhoVazio())
    expect(r.escolha).toMatchObject({ materialId: 'm1', tipoParam: 2, param1: null, param2: null })
  })
})

describe('escolhaInicial', () => {
  it('cobertura começa em 100 % frente e 0 % verso', () => {
    expect(escolhaInicial(material(1))).toMatchObject({ tipoParam: 1, param1: 100, param2: 0, restricaoId: null })
  })
  it('quantidade por peça começa em 1', () => {
    expect(escolhaInicial(material(4))).toMatchObject({ tipoParam: 4, param1: 1, param2: null })
  })
  it('medida e peças por caixa começam vazias (a pessoa informa)', () => {
    expect(escolhaInicial(material(3))).toMatchObject({ param1: null, param2: null })
  })
})

describe('mesmaEscolha', () => {
  const atual = { materialId: 'm1', restricaoId: null, param1: 12.5, param2: null }
  it('igual quando material, restrição e parâmetros coincidem', () => {
    const r = escolhaDosParametros(material(3), { ...rascunhoVazio(), param1: '12,5' })
    expect(mesmaEscolha(r.escolha!, atual)).toBe(true)
  })
  it('diferente quando o parâmetro, o material ou a restrição mudam; sem atual é diferente', () => {
    const base = escolhaDosParametros(material(3), { ...rascunhoVazio(), param1: '13' }).escolha!
    expect(mesmaEscolha(base, atual)).toBe(false)
    expect(mesmaEscolha({ ...base, param1: 12.5 }, { ...atual, materialId: 'm2' })).toBe(false)
    expect(mesmaEscolha({ ...base, param1: 12.5, restricaoId: 'r1' }, atual)).toBe(false)
    expect(mesmaEscolha(base, null)).toBe(false)
  })
})

describe('rascunhoDaSelecao', () => {
  it('converte números em texto com vírgula e nulo em vazio', () => {
    expect(rascunhoDaSelecao({ param1: 12.5, param2: null })).toEqual({
      param1: '12,5',
      param2: '',
      gramaturaKgM2: '',
      pecasPorCaixa: '',
    })
    expect(rascunhoDaSelecao(null)).toEqual(rascunhoVazio())
  })
})
