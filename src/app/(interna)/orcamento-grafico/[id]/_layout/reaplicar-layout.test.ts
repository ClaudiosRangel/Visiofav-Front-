import { describe, expect, it } from 'vitest'
import { camposParaGravar, campoVazio, reaplicarLayoutAoTrocarProduto } from './reaplicar-layout'
import { resolverLayoutItem, type EntradaLayoutItem } from './resolver-layout-item'

function layoutDe(
  produto: Partial<EntradaLayoutItem['produto']>,
  fixo = true,
) {
  return resolverLayoutItem({
    produto: {
      modoFormato: 'TRES_DIMENSOES',
      formatoPadraoLargura: null,
      formatoPadraoAltura: null,
      exibeRestricoes: false,
      exibeInformacoesComplementares: false,
      semImpressao: false,
      ...produto,
    },
    tiposPlano: [{ id: 't', fixo }],
  })
}

describe('campoVazio', () => {
  it.each([
    [undefined, true],
    [null, true],
    ['', true],
    ['  ', true],
    [0, true],
    ['0,00', true],
    [{ largura: 0, altura: 0 }, true],
    [{ largura: null, altura: '' }, true],
    [{ largura: 660, altura: 0 }, false],
    [12, false],
    ['abc', false],
    [[], true],
    [['x'], false],
  ])('%j → %s', (v, esperado) => {
    expect(campoVazio(v)).toBe(esperado)
  })
})

describe('reaplicarLayoutAoTrocarProduto', () => {
  it('mantém valores dos campos que continuam visíveis', () => {
    const form = { comprimento: 100, largura: 50, altura: 30, descricao: 'x' }
    const r = reaplicarLayoutAoTrocarProduto(form, layoutDe({ modoFormato: 'TRES_DIMENSOES' }))
    expect(r.form).toEqual(form)
    expect(r.ocultos).toEqual([])
  })

  it('não altera o form recebido', () => {
    const form = { formatoFinal: { largura: 0, altura: 0 } }
    const copia = JSON.parse(JSON.stringify(form))
    reaplicarLayoutAoTrocarProduto(form, layoutDe({ modoFormato: 'DUAS_DIMENSOES', formatoPadraoLargura: 660, formatoPadraoAltura: 960 }))
    expect(form).toEqual(copia)
  })

  it('preenche o formato padrão só quando o campo de formato está vazio', () => {
    const layout = layoutDe({ modoFormato: 'DUAS_DIMENSOES', formatoPadraoLargura: 660, formatoPadraoAltura: 960 })
    expect(reaplicarLayoutAoTrocarProduto({ formatoFinal: { largura: 0, altura: 0 } }, layout).form.formatoFinal).toEqual({
      largura: 660,
      altura: 960,
    })
    expect(reaplicarLayoutAoTrocarProduto({}, layout).form.formatoFinal).toEqual({ largura: 660, altura: 960 })
    const preenchido = { formatoFinal: { largura: 100, altura: 200 } }
    expect(reaplicarLayoutAoTrocarProduto(preenchido, layout).form.formatoFinal).toEqual({ largura: 100, altura: 200 })
  })

  it('sem formato padrão no cadastro (ou com 0) não preenche nada', () => {
    const l = layoutDe({ modoFormato: 'DUAS_DIMENSOES', formatoPadraoLargura: 0, formatoPadraoAltura: 960 })
    expect(reaplicarLayoutAoTrocarProduto({}, l).form).toEqual({})
  })

  it('em ABERTO_FECHADO o padrão vai para Formato Fechado e nunca para Formato Aberto', () => {
    const l = layoutDe({ modoFormato: 'ABERTO_FECHADO', formatoPadraoLargura: 300, formatoPadraoAltura: 400 })
    const r = reaplicarLayoutAoTrocarProduto({}, l)
    expect(r.form.formatoFechado).toEqual({ largura: 300, altura: 400 })
    expect(r.form.formatoAberto).toBeUndefined()
  })

  it('lista como ocultos os campos que deixaram de ser visíveis e ainda têm valor', () => {
    const form = { comprimento: 100, largura: 50, altura: 30, abaCola: 0, formatoFinal: { largura: 0, altura: 0 } }
    const r = reaplicarLayoutAoTrocarProduto(form, layoutDe({ modoFormato: 'DUAS_DIMENSOES' }))
    expect(r.ocultos).toEqual(['comprimento', 'largura', 'altura'])
    // os valores continuam no form (voltar ao produto anterior não perde o digitado)
    expect(r.form.comprimento).toBe(100)
  })

  it('semImpressao oculta cores e afins', () => {
    const r = reaplicarLayoutAoTrocarProduto({ cores: '5x0', suporte: 's1' }, layoutDe({ semImpressao: true }))
    expect(r.ocultos).toEqual(['cores'])
  })

  it('produto multi-plano oculta todos os campos de plano único', () => {
    const r = reaplicarLayoutAoTrocarProduto({ cores: '5x0', suporte: 's1' }, layoutDe({}, false))
    expect(r.ocultos).toEqual(['cores', 'suporte'])
  })

  it('modo inválido oculta todos os campos de formato', () => {
    const r = reaplicarLayoutAoTrocarProduto({ largura: 10 }, layoutDe({ modoFormato: 'HEXAGONAL' }))
    expect(r.ocultos).toEqual(['largura'])
  })

  it('é rápido (≤ 500 ms) mesmo com form grande', () => {
    const form: Record<string, unknown> = { comprimento: 1, largura: 2 }
    for (let i = 0; i < 5000; i++) form[`extra${i}`] = i
    const layout = layoutDe({ modoFormato: 'DUAS_DIMENSOES', formatoPadraoLargura: 1, formatoPadraoAltura: 1 })
    const t0 = performance.now()
    reaplicarLayoutAoTrocarProduto(form, layout)
    camposParaGravar(form, layout)
    expect(performance.now() - t0).toBeLessThan(500)
  })
})

describe('camposParaGravar', () => {
  it('descarta os campos ocultos e mantém os visíveis e os fora do vocabulário', () => {
    const form = { comprimento: 100, formatoFinal: { largura: 1, altura: 2 }, descricao: 'x', tributacao: 't', cores: '5x0' }
    const g = camposParaGravar(form, layoutDe({ modoFormato: 'DUAS_DIMENSOES', semImpressao: true }))
    expect(g).toEqual({ formatoFinal: { largura: 1, altura: 2 }, descricao: 'x', tributacao: 't' })
  })

  it('campo oculto nunca vai ao payload, mesmo com valor', () => {
    const l = layoutDe({}, false) // multi-plano
    const g = camposParaGravar({ cores: '5x0', suporte: 's', comprimento: 1 }, l)
    expect(g).not.toHaveProperty('cores')
    expect(g).not.toHaveProperty('suporte')
    expect(g).toHaveProperty('comprimento', 1)
  })

  it('não altera o form', () => {
    const form = { cores: '5x0' }
    camposParaGravar(form, layoutDe({}, false))
    expect(form).toEqual({ cores: '5x0' })
  })
})
