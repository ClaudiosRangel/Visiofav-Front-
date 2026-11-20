import { describe, expect, it } from 'vitest'

import {
  comumDoItem,
  comumParaPayload,
  comumVazio,
  lerTiragens,
  modelosEfetivo,
  tiragensDoComum,
  validarComum,
} from './comum-item'

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
    // "10,5" deixou de ser inválido: a vírgula separa tiragens (10 e 5), como no Calcgraf.
    for (const ruim of ['0', '-5', '1000000000', '1.5', 'abc']) {
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

describe('lerTiragens', () => {
  it('aceita uma ou várias, com ponto de milhar, espaço e ponto e vírgula; devolve em ordem crescente', () => {
    expect(lerTiragens('4000')).toEqual({ ok: true, valores: [4000] })
    expect(lerTiragens('2.000,4.000,6.000,8.000,10.000,15.000')).toEqual({ ok: true, valores: [2000, 4000, 6000, 8000, 10000, 15000] })
    expect(lerTiragens('6.000 ; 2.000, 4.000')).toEqual({ ok: true, valores: [2000, 4000, 6000] })
    expect(lerTiragens('1000,,2000,')).toEqual({ ok: true, valores: [1000, 2000] })
  })
  it('recusa o campo inteiro se algum valor for inválido, citando o valor', () => {
    for (const ruim of ['abc', '1000,abc', '0', '1000,0', '-5', '10,5x', '1000000000', '1.5', '1.5,2000']) {
      const r = lerTiragens(ruim)
      expect(r.ok, ruim).toBe(false)
    }
    const r = lerTiragens('1000,abc')
    expect(r.ok === false && r.erro).toContain('abc')
  })
  it('recusa repetida e mais de 20', () => {
    const rep = lerTiragens('1000,2000,1000')
    expect(rep.ok === false && rep.erro).toContain('repetida')
    expect(lerTiragens(Array.from({ length: 21 }, (_, i) => (i + 1) * 100).join(',')).ok).toBe(false)
    expect(lerTiragens(Array.from({ length: 20 }, (_, i) => (i + 1) * 100).join(',')).ok).toBe(true)
  })
  it('vazio pede a tiragem', () => {
    expect(lerTiragens('  ,  ').ok).toBe(false)
  })
})

describe('tiragens no bloco comum', () => {
  it('item com várias tiragens mostra a lista; com uma só, a quantidade', () => {
    expect(comumDoItem({ quantidade: 2000, tiragens: [{ quantidade: 4000 }, { quantidade: 2000 }] }).tiragem).toBe('2000,4000')
    expect(comumDoItem({ quantidade: 2000, tiragens: [{ quantidade: 2000 }] }).tiragem).toBe('2000')
    expect(comumDoItem({ quantidade: 6000, tiragens: [] }).tiragem).toBe('6000')
    expect(comumDoItem({ quantidade: 6000 }).tiragem).toBe('6000')
  })
  it('o payload usa a primeira tiragem como quantidade; tiragensDoComum devolve a lista válida', () => {
    const v = { ...comumVazio(), tiragem: '6000, 2000' }
    expect(comumParaPayload(v).quantidade).toBe(2000)
    expect(tiragensDoComum(v)).toEqual([2000, 6000])
    expect(tiragensDoComum({ tiragem: '' })).toBeNull()
    expect(tiragensDoComum({ tiragem: 'x' })).toBeNull()
  })
  it('validarComum aponta o valor inválido na lista', () => {
    const r = validarComum({ ...comumVazio(), tiragem: '1000,abc' })
    expect(r.valido).toBe(false)
    expect(r.erros.tiragem).toContain('abc')
    expect(validarComum({ ...comumVazio(), tiragem: '1000,2000' }).valido).toBe(true)
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
