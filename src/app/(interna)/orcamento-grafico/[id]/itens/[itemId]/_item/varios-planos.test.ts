import { describe, expect, it } from 'vitest'
import { tiposPermitidosDaLinha } from './comum-item'
import { medidasDoFormato, type ValorFormato } from './formato-item'
import { payloadVariosPlanos, semPapelEmVariosPlanos } from './tela-item'

const vazio: ValorFormato = {
  comprimento: '', largura: '', altura: '', abaCola: '', abaFechamento: '', alturaTampa: '',
  numeroSanfonas: '', aba: '', numeroPaginas: '',
  formatoFinal: { largura: '', altura: '' }, formatoFechado: { largura: '', altura: '' }, formatoAberto: { largura: '', altura: '' },
}

describe('item de vários planos', () => {
  it('sem papel no item: não exige papel e envia sem papel', () => {
    expect(semPapelEmVariosPlanos({ estrutura: 'MULTI_PLANO' } as never, { papelId: '' } as never)).toBe(true)
    expect(semPapelEmVariosPlanos({ estrutura: 'MULTI_PLANO' } as never, { papelId: 'p1' } as never)).toBe(false)
    expect(semPapelEmVariosPlanos({ estrutura: 'PLANO_UNICO' } as never, { papelId: '' } as never)).toBe(false)
    expect(payloadVariosPlanos({ precoKg: 4.5, papelId: 'x', gramatura: 300, tipoEmbalagemId: 't' }, 'prod')).toEqual({
      tipoEmbalagemId: 't', gramatura: 0, produtoGraficoId: 'prod',
    })
  })

  it('formato alimenta as medidas do cálculo', () => {
    expect(medidasDoFormato({ ...vazio, comprimento: '220', largura: '150', altura: '80,5' }, ['L', 'A', 'P'])).toEqual({ L: 220, A: 150, P: 80.5 })
    expect(medidasDoFormato({ ...vazio, formatoFinal: { largura: '190', altura: '1200' } }, ['L', 'A'])).toEqual({ L: 190, A: 1200 })
    expect(medidasDoFormato({ ...vazio, comprimento: '220' }, ['L', 'A', 'FUNDO'])).toEqual({ L: 220 })
    expect(medidasDoFormato(vazio, ['L'])).toEqual({})
  })

  it('tipo de produto limitado aos tipos da linha do produto', () => {
    const produtos = [
      { id: 'cc', linhaProdutoId: 'L1', tipoEmbalagemId: 't-cc' },
      { id: 'cx', linhaProdutoId: 'L1', tipoEmbalagemId: 't-cx' },
      { id: 'sa', linhaProdutoId: 'L2', tipoEmbalagemId: 't-sa' },
    ]
    expect([...(tiposPermitidosDaLinha('cc', produtos, null) ?? [])].sort()).toEqual(['t-cc', 't-cx'])
    expect(tiposPermitidosDaLinha('cc', produtos, 't-x')?.has('t-x')).toBe(true)
    expect(tiposPermitidosDaLinha('zz', produtos, null)).toBeNull()
  })
})
