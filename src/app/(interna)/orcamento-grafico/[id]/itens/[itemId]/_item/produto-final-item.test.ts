import { describe, expect, it } from 'vitest'

import {
  acondicionamentoDoItem,
  acondicionamentoParaPayload,
  complementosVazio,
  descartar,
  escolher,
  estaEscolhido,
  validarAcondicionamento,
  validarComplementos,
} from './produto-final-item'

describe('acondicionamento — escolhidos', () => {
  it('escolher não duplica (ignora maiúsculas e acento) e descartar remove', () => {
    let l = escolher([], 'Caixa Padrão')
    l = escolher(l, 'caixa padrao')
    l = escolher(l, 'Embalar')
    expect(l.map((e) => e.descricao)).toEqual(['Caixa Padrão', 'Embalar'])
    expect(estaEscolhido(l, 'EMBALAR')).toBe(true)
    expect(descartar(l, 'CAIXA PADRAO').map((e) => e.descricao)).toEqual(['Embalar'])
  })

  it('escolher ignora texto vazio e não altera a lista original', () => {
    const original = [{ descricao: 'Embalar' }]
    expect(escolher(original, '   ')).toEqual(original)
    escolher(original, 'Outra')
    expect(original).toHaveLength(1)
  })

  it('lê do item e monta o payload', () => {
    const v = acondicionamentoDoItem({ acondicionamento: [{ descricao: 'Embalar' }, { descricao: '' }], conteudoVolume: '500' })
    expect(v).toEqual({ escolhidos: [{ descricao: 'Embalar' }], conteudoVolume: '500' })
    expect(acondicionamentoParaPayload(v)).toEqual({ acondicionamento: [{ descricao: 'Embalar' }], conteudoVolume: 500 })
  })
})

describe('conteúdo por volume: inteiro de 1 a 999.999', () => {
  const v = (conteudoVolume: string) => validarAcondicionamento({ escolhidos: [], conteudoVolume })
  it('aceita vazio e os limites', () => {
    for (const bom of ['', '1', '999999']) expect(v(bom).valido).toBe(true)
  })
  it('reprova fora da faixa, decimal e texto', () => {
    for (const ruim of ['0', '1000000', '1,5', 'x']) expect(v(ruim).erros.conteudoVolume).toBeTruthy()
  })
})

describe('complementos — limites de texto', () => {
  const base = complementosVazio()
  it('observação e obs. áreas de op: até 2.000', () => {
    const ok = { ...base, observacao: 'a'.repeat(2000), observacaoAreasOp: 'b'.repeat(2000) }
    expect(validarComplementos(ok, { informacoesComplementaresVisiveis: false }).valido).toBe(true)
    const ruim = { ...base, observacao: 'a'.repeat(2001), observacaoAreasOp: 'b'.repeat(2001) }
    expect(Object.keys(validarComplementos(ruim, { informacoesComplementaresVisiveis: false }).erros).sort()).toEqual([
      'observacao',
      'observacaoAreasOp',
    ])
  })

  it('informações complementares: até 1.000, só quando visível', () => {
    const longo = { ...base, informacoesComplementares: 'c'.repeat(1001) }
    expect(validarComplementos(longo, { informacoesComplementaresVisiveis: true }).erros.informacoesComplementares).toBeTruthy()
    expect(validarComplementos(longo, { informacoesComplementaresVisiveis: false }).valido).toBe(true)
    const limite = { ...base, informacoesComplementares: 'c'.repeat(1000) }
    expect(validarComplementos(limite, { informacoesComplementaresVisiveis: true }).valido).toBe(true)
  })
})
