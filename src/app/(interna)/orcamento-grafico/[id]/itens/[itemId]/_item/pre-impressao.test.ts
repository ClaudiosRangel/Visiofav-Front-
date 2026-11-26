import { describe, expect, it } from 'vitest'

import { lerPreImpressao, PRE_IMPRESSAO_PADRAO, preImpressaoIgual, resumoPreImpressao } from './pre-impressao'

describe('Pré-Impressão', () => {
  it('lê o valor gravado e completa o que faltar com o padrão do campo', () => {
    expect(lerPreImpressao({ ctp: false, fotolito: 'NAO_CALCULAR', contatos: 'CALCULAR', montagem: 'NAO_CALCULAR' })).toEqual({
      ctp: false,
      fotolito: 'NAO_CALCULAR',
      contatos: 'CALCULAR',
      montagem: 'NAO_CALCULAR',
    })
    expect(lerPreImpressao({ ctp: false })).toEqual({ ...PRE_IMPRESSAO_PADRAO, ctp: false })
  })

  it('valor fora da lista cai no padrão; ausente ou lixo vira null', () => {
    expect(lerPreImpressao({ ctp: true, fotolito: 'XYZ' })?.fotolito).toBe('FORNECIDO')
    expect(lerPreImpressao(null)).toBeNull()
    expect(lerPreImpressao(undefined)).toBeNull()
    expect(lerPreImpressao([])).toBeNull()
    expect(lerPreImpressao({})).toBeNull()
    expect(lerPreImpressao('texto')).toBeNull()
  })

  it('compara e resume', () => {
    expect(preImpressaoIgual(PRE_IMPRESSAO_PADRAO, { ...PRE_IMPRESSAO_PADRAO })).toBe(true)
    expect(preImpressaoIgual(PRE_IMPRESSAO_PADRAO, { ...PRE_IMPRESSAO_PADRAO, ctp: false })).toBe(false)
    expect(preImpressaoIgual(null, undefined)).toBe(true)
    expect(preImpressaoIgual(null, PRE_IMPRESSAO_PADRAO)).toBe(false)
    expect(resumoPreImpressao(PRE_IMPRESSAO_PADRAO)).toBe('CTP · Fotolito: Fornecido · Contatos: Não calcular · Montagem: Mont.Contatos')
    expect(resumoPreImpressao(null)).toBe('Não definida')
  })
})
