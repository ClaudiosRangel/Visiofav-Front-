import { describe, expect, it } from 'vitest'

import { comumDoItem, comumParaPayload, comumVazio, modelosEfetivo, validarComum } from './comum-item'

describe('comumDoItem', () => {
  it('item sem modelos assume o padrão 1', () => {
    expect(comumDoItem({ quantidade: 4000 }).modelos).toBe('1')
    expect(comumDoItem(null).modelos).toBe('1')
  })

  it('lê os campos do item', () => {
    const v = comumDoItem({
      tipoEmbalagemId: 't1',
      siglaAcabado: 'CTC',
      tributacao: 'ICMS + IPI',
      quantidade: 6000,
      qtdModelos: '3',
    })
    expect(v).toMatchObject({ tipoEmbalagemId: 't1', siglaAcabado: 'CTC', tiragem: '6000', modelos: '3' })
  })
})

describe('validarComum', () => {
  it('limites de caracteres: descrição 200, sigla 60, tributação 60', () => {
    const ok = { ...comumVazio(), descricao: 'a'.repeat(200), siglaAcabado: 'b'.repeat(60), tributacao: 'c'.repeat(60) }
    expect(validarComum(ok).valido).toBe(true)
    const ruim = { ...comumVazio(), descricao: 'a'.repeat(201), siglaAcabado: 'b'.repeat(61), tributacao: 'c'.repeat(61) }
    expect(Object.keys(validarComum(ruim).erros).sort()).toEqual(['descricao', 'siglaAcabado', 'tributacao'])
  })

  it('tiragem: inteiro de 1 a 999.999.999', () => {
    for (const bom of ['1', '4000', '999999999']) expect(validarComum({ ...comumVazio(), tiragem: bom }).valido).toBe(true)
    for (const ruim of ['0', '-5', '1000000000', '10,5', 'abc']) {
      expect(validarComum({ ...comumVazio(), tiragem: ruim }).erros.tiragem).toBeTruthy()
    }
  })

  it('modelos: 1 a 999; vazio vale 1 e nunca exige', () => {
    expect(validarComum({ ...comumVazio(), modelos: '' }, { validarVazios: true }).erros.modelos).toBeUndefined()
    for (const bom of ['1', '999']) expect(validarComum({ ...comumVazio(), modelos: bom }).erros.modelos).toBeUndefined()
    for (const ruim of ['0', '1000', '2,5']) {
      expect(validarComum({ ...comumVazio(), modelos: ruim }).erros.modelos).toBeTruthy()
    }
    expect(modelosEfetivo({ modelos: '' })).toBe(1)
  })

  it('obrigatórios só são exigidos com validarVazios', () => {
    expect(validarComum(comumVazio()).valido).toBe(true)
    const r = validarComum(comumVazio(), { validarVazios: true })
    expect(Object.keys(r.erros).sort()).toEqual(['tipoEmbalagemId', 'tiragem'])
  })
})

describe('comumParaPayload', () => {
  it('converte para as colunas do item', () => {
    const p = comumParaPayload({
      tipoEmbalagemId: 't1',
      descricao: 'qualquer',
      siglaAcabado: ' CTC ',
      tributacao: 'ICMS',
      tiragem: '6000',
      modelos: '',
    })
    expect(p).toEqual({ tipoEmbalagemId: 't1', siglaAcabado: 'CTC', tributacao: 'ICMS', quantidade: 6000, qtdModelos: 1 })
  })
})
