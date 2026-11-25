import { describe, expect, it } from 'vitest'
import { coresDasLinhas, linhasDasCores, resumoTintas, tipoDaTinta, validarLinhasTinta, type LinhaTinta } from './tintas-item'

const linha = (p: Partial<LinhaTinta>): LinhaTinta => ({
  chave: Math.random().toString(36),
  tintaId: null,
  tinta: '',
  complemento: '',
  perc: '',
  precoKg: '',
  ...p,
})

describe('janela Tintas', () => {
  it('exemplo do cliente: Escala CMYK 75% e Metálica CW0210 - DOURADO 25%', () => {
    const cores = coresDasLinhas([
      linha({ tintaId: 'e', tinta: 'Escala', complemento: 'CMYK', perc: '75', precoKg: '71,5' }),
      linha({ tintaId: 'm', tinta: 'Metálica', complemento: 'CW0210 - DOURADO', perc: '25', precoKg: '253' }),
    ])
    expect(cores).toEqual([
      expect.objectContaining({ nome: 'Escala CMYK', tipo: 'CMYK', coberturaPercent: 75, precoKg: 71.5, tinta: 'Escala', complemento: 'CMYK' }),
      expect.objectContaining({ nome: 'Metálica CW0210 - DOURADO', tipo: 'PANTONE', coberturaPercent: 25, precoKg: 253 }),
    ])
    expect(cores[0].rendimentoM2Kg).toBeGreaterThan(0)
    expect(resumoTintas(cores)).toBe('2 tintas · 100%')
  })

  it('reabrir mostra as mesmas linhas; cor antiga casa com o cadastro pelo nome', () => {
    const cores = coresDasLinhas([linha({ tintaId: 'e', tinta: 'Escala', complemento: 'CMYK', perc: '80', precoKg: '71,5' })])
    expect(linhasDasCores(cores)[0]).toMatchObject({ tintaId: 'e', tinta: 'Escala', complemento: 'CMYK', perc: '80', precoKg: '71,5' })
    const antiga = linhasDasCores([{ nome: 'Pantone 01', tipo: 'PANTONE', coberturaPercent: 30, precoKg: 65 }], [
      { id: 'p1', nome: 'Pantone 01', precoKg: 65 },
    ])
    expect(antiga[0]).toMatchObject({ tintaId: 'p1', tinta: 'Pantone 01', perc: '30' })
  })

  it('valida tinta, % e preço; linha vazia é ignorada', () => {
    expect(validarLinhasTinta([linha({})])).toEqual([])
    const erros = validarLinhasTinta([linha({ perc: '120' })])
    expect(erros.map((e) => e.campo).sort()).toEqual(['perc', 'precoKg', 'tinta'])
    expect(validarLinhasTinta([linha({ tinta: 'Escala', perc: '50', precoKg: '0' })])).toEqual([])
    expect(coresDasLinhas([linha({})])).toEqual([])
  })

  it('escala/CMYK conta como policromia; demais como cor especial', () => {
    expect(tipoDaTinta('Escala', '')).toBe('CMYK')
    expect(tipoDaTinta('Preto', 'CMYK')).toBe('CMYK')
    expect(tipoDaTinta('Pantone 01', 'Azul')).toBe('PANTONE')
  })
})
