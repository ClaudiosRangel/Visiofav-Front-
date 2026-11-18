import { describe, expect, it } from 'vitest'

import {
  MENSAGEM_NAO_CRIADO,
  erroDoServidor,
  estadoSuporteNcVazio,
  interpretarRespostaSuporteNc,
  montarBodySuporteNc,
  validarSuporteNc,
  type EstadoSuporteNc,
} from './suporte-nc'

function valido(extra: Partial<EstadoSuporteNc> = {}): EstadoSuporteNc {
  return { ...estadoSuporteNcVazio(), nome: 'Cartão Triplex', gramatura: '250', custoKg: '9,5', ...extra }
}

describe('estadoSuporteNcVazio', () => {
  it('textos vazios e unidades ligadas por padrão', () => {
    const e = estadoSuporteNcVazio()
    expect(e.nome).toBe('')
    expect(e.tiraRetira).toBe(false)
    expect(e.unidadeCustoKg).toBe(true)
    expect(e.unidadeCalculoFl).toBe(true)
    expect(e.tipoSuporteConsumoTintaId).toBe('')
  })
})

describe('validarSuporteNc', () => {
  it('vazio: só nome, gramatura e custo por kg são obrigatórios', () => {
    expect(Object.keys(validarSuporteNc(estadoSuporteNcVazio())).sort()).toEqual(['custoKg', 'gramatura', 'nome'])
  })

  it('mínimo preenchido é válido', () => {
    expect(validarSuporteNc(valido())).toEqual({})
  })

  it('nome: 120 aceita, 121 rejeita, só espaços rejeita', () => {
    expect(validarSuporteNc(valido({ nome: 'a'.repeat(120) })).nome).toBeUndefined()
    expect(validarSuporteNc(valido({ nome: 'a'.repeat(121) })).nome).toBeDefined()
    expect(validarSuporteNc(valido({ nome: '   ' })).nome).toBeDefined()
  })

  it('gramatura: 1 e 2000 aceitam; 0,99 e 2000,01 rejeitam', () => {
    for (const g of ['1', '2000']) expect(validarSuporteNc(valido({ gramatura: g })).gramatura).toBeUndefined()
    for (const g of ['0,99', '2000,01', '0', 'abc']) expect(validarSuporteNc(valido({ gramatura: g })).gramatura).toBeDefined()
  })

  it('custo por kg: 0,01 e 999.999,99 aceitam; 0,00 e 1.000.000 rejeitam', () => {
    for (const c of ['0,01', '999999,99', '999.999,99']) expect(validarSuporteNc(valido({ custoKg: c })).custoKg).toBeUndefined()
    for (const c of ['0', '0,00', '1000000', '1,234']) expect(validarSuporteNc(valido({ custoKg: c })).custoKg).toBeDefined()
  })

  it('frete por kg: 0 e 999.999,99 aceitam; negativo e acima rejeitam; vazio é opcional', () => {
    expect(validarSuporteNc(valido({ freteKg: '' })).freteKg).toBeUndefined()
    for (const f of ['0', '999999,99']) expect(validarSuporteNc(valido({ freteKg: f })).freteKg).toBeUndefined()
    for (const f of ['-0,01', '1000000']) expect(validarSuporteNc(valido({ freteKg: f })).freteKg).toBeDefined()
  })

  it('créditos: 0 e 100 aceitam; 100,01 e -1 rejeitam', () => {
    for (const campo of ['creditoIcmsPerc', 'creditoIpiPerc'] as const) {
      for (const v of ['0', '100']) expect(validarSuporteNc(valido({ [campo]: v }))[campo]).toBeUndefined()
      for (const v of ['100,01', '-1']) expect(validarSuporteNc(valido({ [campo]: v }))[campo]).toBeDefined()
    }
  })

  it('espessura (micras) 0 a 10.000; espessura G/ aceita 10.000,01 como o back', () => {
    expect(validarSuporteNc(valido({ espessuraMicras: '10000' })).espessuraMicras).toBeUndefined()
    expect(validarSuporteNc(valido({ espessuraMicras: '10000,01' })).espessuraMicras).toBeDefined()
    expect(validarSuporteNc(valido({ espessuraGm: '0' })).espessuraGm).toBeUndefined()
    expect(validarSuporteNc(valido({ espessuraGm: '10000,01' })).espessuraGm).toBeUndefined()
    expect(validarSuporteNc(valido({ espessuraGm: '1000000' })).espessuraGm).toBeDefined()
  })

  it('pacotes com: inteiro de 0 a 1.000.000', () => {
    for (const p of ['0', '1000000']) expect(validarSuporteNc(valido({ pacotesCom: p })).pacotesCom).toBeUndefined()
    for (const p of ['1000001', '1,5', '-1']) expect(validarSuporteNc(valido({ pacotesCom: p })).pacotesCom).toBeDefined()
  })

  it('fibra: 40 aceita, 41 rejeita; formato mm precisa ser > 0 quando informado', () => {
    expect(validarSuporteNc(valido({ fibra: 'f'.repeat(40) })).fibra).toBeUndefined()
    expect(validarSuporteNc(valido({ fibra: 'f'.repeat(41) })).fibra).toBeDefined()
    expect(validarSuporteNc(valido({ formatoLarguraMm: '0' })).formatoLarguraMm).toBeDefined()
    expect(validarSuporteNc(valido({ formatoAlturaMm: '660' })).formatoAlturaMm).toBeUndefined()
  })
})

describe('montarBodySuporteNc', () => {
  it('omite campos opcionais vazios e manda os booleanos', () => {
    expect(montarBodySuporteNc(valido())).toEqual({
      nome: 'Cartão Triplex',
      gramatura: 250,
      custoKg: 9.5,
      tiraRetira: false,
      unidadeCustoKg: true,
      unidadeCalculoFl: true,
    })
  })

  it('inclui opcionais preenchidos, com vírgula e milhar pt-BR', () => {
    const body = montarBodySuporteNc(
      valido({
        custoKg: '1.234,56',
        espessuraMicras: '0,3',
        formatoLarguraMm: '660',
        formatoAlturaMm: '960,5',
        fibra: ' Longa ',
        tiraRetira: true,
        tipoSuporteConsumoTintaId: 'uuid-ref',
        freteKg: '0,10',
        pacotesCom: '500',
        creditoIcmsPerc: '12',
        creditoIpiPerc: '0',
      }),
    )
    expect(body).toMatchObject({
      custoKg: 1234.56,
      espessuraMicras: 0.3,
      formatoLarguraMm: 660,
      formatoAlturaMm: 960.5,
      fibra: 'Longa',
      tiraRetira: true,
      tipoSuporteConsumoTintaId: 'uuid-ref',
      freteKg: 0.1,
      pacotesCom: 500,
      creditoIcmsPerc: 12,
      creditoIpiPerc: 0,
    })
    expect(body).not.toHaveProperty('espessuraGm')
    expect(body).not.toHaveProperty('confirmarExistente')
  })

  it('não gera float errado (0,07 e 1,005 por dígitos)', () => {
    expect(montarBodySuporteNc(valido({ custoKg: '0,07' })).custoKg).toBe(0.07)
    expect(montarBodySuporteNc(valido({ freteKg: '19,99' })).freteKg).toBe(19.99)
  })

  it('confirmarExistente só aparece quando pedido', () => {
    expect(montarBodySuporteNc(valido(), true).confirmarExistente).toBe(true)
    expect(montarBodySuporteNc(valido(), false)).not.toHaveProperty('confirmarExistente')
  })
})

describe('interpretarRespostaSuporteNc', () => {
  it('CRIADO usa nome, gramatura e custo do estado', () => {
    const r = interpretarRespostaSuporteNc({ resultado: 'CRIADO', suporteId: 's1', precoId: 'p1', provisorio: true }, valido())
    expect(r).toEqual({
      tipo: 'CRIADO',
      provisorio: true,
      criado: { suporteId: 's1', precoId: 'p1', nome: 'Cartão Triplex', gramatura: 250, custoKg: 9.5 },
    })
  })

  it('DUPLICADO traz nome e gramatura do existente', () => {
    const r = interpretarRespostaSuporteNc({ resultado: 'DUPLICADO', suporteId: 's9', nome: 'Triplex', gramatura: 250 }, valido())
    expect(r).toEqual({ tipo: 'DUPLICADO', duplicado: { suporteId: 's9', nome: 'Triplex', gramatura: 250 } })
  })

  it('corpo inesperado é INVALIDA', () => {
    expect(interpretarRespostaSuporteNc({}, valido()).tipo).toBe('INVALIDA')
    expect(interpretarRespostaSuporteNc(null, valido()).tipo).toBe('INVALIDA')
  })
})

describe('erroDoServidor', () => {
  const http = (status: number, data: unknown) => ({ response: { status, data }, message: `Request failed ${status}` })

  it('400 com issues traduz para a chave do estado', () => {
    const r = erroDoServidor(
      http(400, { message: 'gramatura: mínimo 1', campo: 'gramatura', issues: [{ campo: 'gramatura', motivo: 'mínimo 1' }] }),
    )
    expect(r.campoErro).toEqual({ campo: 'gramatura', motivo: 'Mínimo 1' })
    expect(r.mensagem).toBe('Mínimo 1')
  })

  it('400 só com `campo` + message "campo: motivo" também traduz', () => {
    const r = erroDoServidor(http(400, { message: 'custoKg: máximo 999.999,99', campo: 'custoKg' }))
    expect(r.campoErro).toEqual({ campo: 'custoKg', motivo: 'Máximo 999.999,99' })
  })

  it('400 pega o primeiro issue de campo conhecido, ignorando os desconhecidos', () => {
    const r = erroDoServidor(
      http(400, {
        message: 'coefTinta: máximo 100',
        issues: [
          { campo: 'coefTinta', motivo: 'máximo 100' },
          { campo: 'nome', motivo: 'obrigatório' },
        ],
      }),
    )
    expect(r.campoErro?.campo).toBe('nome')
  })

  it('400 de campo desconhecido vira mensagem geral sem campoErro', () => {
    const r = erroDoServidor(http(400, { message: 'corpo: inválido', campo: 'corpo' }))
    expect(r.campoErro).toBeUndefined()
    expect(r.mensagem).toBe(`${MENSAGEM_NAO_CRIADO} corpo: inválido`)
  })

  it('500 vira "O suporte não foi criado." + detalhe', () => {
    const r = erroDoServidor(http(500, { message: 'Erro interno' }))
    expect(r.campoErro).toBeUndefined()
    expect(r.mensagem).toBe(`${MENSAGEM_NAO_CRIADO} Erro interno`)
  })

  it('erro de rede (sem response) usa a mensagem do erro', () => {
    const r = erroDoServidor(new Error('Network Error'))
    expect(r.campoErro).toBeUndefined()
    expect(r.mensagem).toBe(`${MENSAGEM_NAO_CRIADO} Network Error`)
  })

  it('valor sem detalhe devolve só a mensagem base', () => {
    expect(erroDoServidor(undefined).mensagem).toBe(MENSAGEM_NAO_CRIADO)
  })
})
