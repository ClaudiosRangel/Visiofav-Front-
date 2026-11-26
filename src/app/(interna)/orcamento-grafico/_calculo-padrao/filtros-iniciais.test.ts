import { describe, expect, it } from 'vitest'

import { filtrosIniciais } from './SeletorCalculoPadrao'

describe('filtros iniciais da busca de cálculo', () => {
  it('código numérico do cliente (codigoCalcgraf é inteiro) não quebra e vira o filtro de código', () => {
    const f = filtrosIniciais(null, { codigo: 365 as unknown as string, nome: 'Gerdau' })
    expect(f.clienteCodigo).toBe('365')
    expect(f.clienteNome).toBe('')
  })

  it('sem código usa o nome; sem cliente não filtra', () => {
    expect(filtrosIniciais(null, { nome: '  Cervejaria Imperial ' }).clienteNome).toBe('Cervejaria Imperial')
    expect(filtrosIniciais('Cartucho', null)).toMatchObject({ linhaProduto: 'Cartucho', clienteCodigo: '', clienteNome: '' })
    expect(filtrosIniciais(null, { codigo: null, nome: null }).clienteCodigo).toBe('')
  })
})
