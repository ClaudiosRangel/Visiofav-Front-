import { describe, expect, it } from 'vitest'
import { corpoDaEdicao, linhasDaTela } from './tiragens-editaveis'

describe('tiragens editáveis do item', () => {
  it('converte as linhas do back e ordena por tiragem', () => {
    const l = linhasDaTela([
      { ordem: 1, quantidade: 4000, valorTotal: '8000.00', margemPerc: '20.5', valorInformado: true },
      { ordem: 0, quantidade: 2000, valorTotal: '5000', margemPerc: '30' },
    ])
    expect(l.map((x) => x.quantidade)).toEqual([2000, 4000])
    expect(l[0]).toMatchObject({ referencia: true, valorTotal: 5000, valorUnitario: 2.5, digitado: false })
    expect(l[1]).toMatchObject({ referencia: false, margemPerc: 20.5, digitado: true })
    expect(linhasDaTela(null)).toEqual([])
  })

  it('monta o corpo do PUT só quando a entrada muda e é válida', () => {
    const atual = { valorTotal: 5000, margemPerc: 30 }
    expect(corpoDaEdicao({ tipo: 'valor', valor: 6000.456 }, atual)).toEqual({ valorTotal: 6000.46 })
    expect(corpoDaEdicao({ tipo: 'valor', valor: 5000 }, atual)).toBeNull()
    expect(corpoDaEdicao({ tipo: 'valor', valor: 0 }, atual)).toBeNull()
    expect(corpoDaEdicao({ tipo: 'valor', valor: Number.NaN }, atual)).toBeNull()
    expect(corpoDaEdicao({ tipo: 'margem', margem: 25 }, atual)).toEqual({ margemPerc: 25 })
    expect(corpoDaEdicao({ tipo: 'margem', margem: 30 }, atual)).toBeNull()
    expect(corpoDaEdicao({ tipo: 'limpar' }, atual)).toEqual({ limpar: true })
  })
})
