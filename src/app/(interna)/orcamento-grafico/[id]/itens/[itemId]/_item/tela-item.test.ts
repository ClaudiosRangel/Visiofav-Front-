import { describe, expect, it } from 'vitest'

import { montarPayloadItem } from '../../../itemFormShared'
import { resolverLayoutItem } from '../../../_layout/resolver-layout-item'
import { itemParaEditar } from '../itemParaEditar'
import {
  estadoInicialTelaItem,
  formEfetivo,
  montarPayloadTelaItem,
  validarTelaItem,
  type EstadoTelaItem,
} from './tela-item'

function layout(modoFormato: string, fixo: boolean) {
  return resolverLayoutItem({
    produto: {
      modoFormato,
      formatoPadraoLargura: null,
      formatoPadraoAltura: null,
      exibeRestricoes: true,
      exibeInformacoesComplementares: false,
      semImpressao: false,
    },
    tiposPlano: [{ id: 't', fixo }],
  })
}

const BRUTO = {
  id: 'item-1',
  tipoEmbalagemId: 'te-1',
  produtoGraficoId: 'prod-1',
  medidas: { L: 190, A: 1200, largura: 190, altura: 1200 },
  papelId: 'papel-1',
  gramatura: '415',
  numCores: 3,
  cores: [{ nome: 'Pantone 01', tipo: 'PANTONE', coberturaPercent: 40, precoKg: 71.5, rendimentoM2Kg: 25 }],
  aproveitamentoManual: 3,
  formatoCorteLarguraMm: '650',
  formatoCorteAlturaMm: '1225',
  comprimentoMm: '100',
  quantidade: 4000,
  descricao: 'Rótulo',
  resultadoCalculo: { papel: { precoKg: 6.83 } },
}

function inicial(): EstadoTelaItem {
  return estadoInicialTelaItem(itemParaEditar(BRUTO, null), { orcamentoId: 'orc-1' })
}

describe('tela-item', () => {
  it('sem alteração, o payload de engenharia é o mesmo do editor atual (só descrição e numCores a mais)', () => {
    const e0 = inicial()
    const lay = layout('TRES_DIMENSOES', true)
    const payload = montarPayloadTelaItem(e0, e0, lay)
    const doEditor = montarPayloadItem(e0.form)
    expect(Object.keys(payload).filter((k) => !(k in doEditor)).sort()).toEqual(['descricao', 'numCores'])
    for (const [k, v] of Object.entries(doEditor)) expect(payload[k]).toEqual(v)
    expect(payload).not.toHaveProperty('planos')
  })

  it('campo oculto pelo layout nunca é gravado (fica o valor do item)', () => {
    const e0 = inicial()
    // DUAS_DIMENSOES não mostra Comprimento: a edição feita antes da troca de produto não vale.
    const editado = { ...e0, formato: { ...e0.formato, comprimento: '999' } }
    const f = formEfetivo(editado, e0, layout('DUAS_DIMENSOES', true))
    expect(f.comprimentoMm).toBe(100)
    // Com Comprimento visível, a edição entra.
    expect(formEfetivo(editado, e0, layout('TRES_DIMENSOES', true)).comprimentoMm).toBe(999)
  })

  it('campos D3 só entram no payload quando visíveis e alterados', () => {
    const e0 = inicial()
    const lay = layout('ABERTO_FECHADO', true)
    expect(montarPayloadTelaItem(e0, e0, lay)).not.toHaveProperty('formatoFechadoLarguraMm')
    const editado = { ...e0, formato: { ...e0.formato, formatoFechado: { largura: '210', altura: '297' } } }
    expect(montarPayloadTelaItem(editado, e0, lay)).toMatchObject({ formatoFechadoLarguraMm: 210, formatoFechadoAlturaMm: 297 })
  })

  it('Cores NxM gravam numCores = N + M só em plano único', () => {
    const e0 = inicial()
    const editado = { ...e0, planoUnico: { ...e0.planoUnico, cores: '4x1' } }
    expect(montarPayloadTelaItem(editado, e0, layout('TRES_DIMENSOES', true)).numCores).toBe(5)
    expect(montarPayloadTelaItem(editado, e0, layout('TRES_DIMENSOES', false))).not.toHaveProperty('numCores')
  })

  it('validação: formato vazio só bloqueia item novo; texto inválido sempre', () => {
    const e0 = inicial()
    const lay = layout('ABERTO_FECHADO', true)
    expect(validarTelaItem(e0, lay, { exigirFormato: false })).toEqual([])
    expect(validarTelaItem(e0, lay, { exigirFormato: true }).length).toBeGreaterThan(0)
    const invalido = { ...e0, comum: { ...e0.comum, tiragem: 'abc' } }
    expect(validarTelaItem(invalido, lay, { exigirFormato: false })[0]).toMatchObject({ campo: 'Tiragens' })
  })
  it('várias tiragens: o campo mostra a lista; sem alterar o campo, o payload não leva `tiragens`', () => {
    const bruto = { ...BRUTO, quantidade: 2000, tiragens: [{ quantidade: 6000 }, { quantidade: 2000 }, { quantidade: 4000 }] }
    const e0 = estadoInicialTelaItem(itemParaEditar(bruto, null), { orcamentoId: 'orc-1' })
    expect(e0.comum.tiragem).toBe('2000,4000,6000')
    const lay = layout('TRES_DIMENSOES', true)
    const payload = montarPayloadTelaItem(e0, e0, lay)
    expect(payload).not.toHaveProperty('tiragens')
    expect(payload.quantidade).toBe(2000)
  })
  it('digitar várias tiragens envia a lista e `quantidade` = a primeira', () => {
    const e0 = inicial()
    const editado = { ...e0, comum: { ...e0.comum, tiragem: '6.000, 2.000,4.000' } }
    const f = formEfetivo(editado, e0, layout('TRES_DIMENSOES', true))
    expect(f.tiragens).toEqual([2000, 4000, 6000])
    expect(f.quantidade).toBe(2000)
    const payload = montarPayloadTelaItem(editado, e0, layout('TRES_DIMENSOES', true))
    expect(payload.tiragens).toEqual([2000, 4000, 6000])
    expect(payload.quantidade).toBe(2000)
  })
  it('voltar a uma tiragem só envia `tiragens: []` para remover as linhas antigas', () => {
    const bruto = { ...BRUTO, quantidade: 2000, tiragens: [{ quantidade: 2000 }, { quantidade: 4000 }] }
    const e0 = estadoInicialTelaItem(itemParaEditar(bruto, null), { orcamentoId: 'orc-1' })
    const editado = { ...e0, comum: { ...e0.comum, tiragem: '3000' } }
    const f = formEfetivo(editado, e0, layout('TRES_DIMENSOES', true))
    expect(f.tiragens).toEqual([])
    expect(f.quantidade).toBe(3000)
  })
  it('lista inválida bloqueia a validação e não é enviada', () => {
    const e0 = inicial()
    const lay = layout('TRES_DIMENSOES', true)
    for (const ruim of ['1000,abc', '1000,1000', '0,1000']) {
      const editado = { ...e0, comum: { ...e0.comum, tiragem: ruim } }
      expect(validarTelaItem(editado, lay, { exigirFormato: false })[0], ruim).toMatchObject({ campo: 'Tiragens' })
      expect(formEfetivo(editado, e0, lay).tiragens).toBeUndefined()
    }
  })
})
