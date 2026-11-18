import { describe, expect, it } from 'vitest'

import { resolverLayoutItem, type EntradaLayoutItem } from '../../../_layout/resolver-layout-item'
import {
  aplicarFormatoPadrao,
  formatoDoItem,
  formatoParaPayload,
  formatoVazio,
  numeroParaTexto,
  textoParaNumero,
  validarFormato,
} from './formato-item'

function layoutDe(modo: string | null, extra: Partial<EntradaLayoutItem['produto']> = {}) {
  return resolverLayoutItem({
    produto: {
      modoFormato: modo,
      formatoPadraoLargura: null,
      formatoPadraoAltura: null,
      exibeRestricoes: false,
      exibeInformacoesComplementares: false,
      semImpressao: false,
      ...extra,
    },
    tiposPlano: [{ id: 't1', fixo: true }],
  })
}

describe('conversões texto ↔ número', () => {
  it('numeroParaTexto usa vírgula e descarta zeros à direita', () => {
    expect(numeroParaTexto('190.00')).toBe('190')
    expect(numeroParaTexto(190.5)).toBe('190,5')
    expect(numeroParaTexto(null)).toBe('')
    expect(numeroParaTexto('')).toBe('')
  })

  it('textoParaNumero aceita vírgula, ponto e milhar pt-BR', () => {
    expect(textoParaNumero('12,5')).toBe(12.5)
    expect(textoParaNumero('12.5')).toBe(12.5)
    expect(textoParaNumero('1.234,56')).toBe(1234.56)
    expect(textoParaNumero('  ')).toBeNull()
    expect(textoParaNumero('abc')).toBeNull()
  })
})

describe('validarFormato', () => {
  it('3 dimensões: erro no próprio campo para 0, texto e 3 casas; vazio só com validarVazios', () => {
    const layout = layoutDe('TRES_DIMENSOES')
    const v = { ...formatoVazio(), comprimento: '0', largura: 'abc', altura: '1,234' }
    const r = validarFormato(v, layout)
    expect(r.valido).toBe(false)
    expect(Object.keys(r.erros).sort()).toEqual(['altura', 'comprimento', 'largura'])

    const vazio = validarFormato(formatoVazio(), layout)
    expect(vazio.valido).toBe(true)
    const exigido = validarFormato(formatoVazio(), layout, { validarVazios: true })
    expect(Object.keys(exigido.erros).sort()).toEqual(['altura', 'comprimento', 'largura'])
    // Abas não são obrigatórias.
    expect(exigido.erros.abaCola).toBeUndefined()
  })

  it('limites: 99.999,99 passa; 100.000 reprova', () => {
    const layout = layoutDe('TRES_DIMENSOES')
    expect(validarFormato({ ...formatoVazio(), comprimento: '99999,99' }, layout).valido).toBe(true)
    expect(validarFormato({ ...formatoVazio(), comprimento: '100000' }, layout).valido).toBe(false)
  })

  it('formatos compostos validam largura e altura separadamente', () => {
    const layout = layoutDe('ABERTO_FECHADO')
    const v = {
      ...formatoVazio(),
      formatoFechado: { largura: '10', altura: '0' },
      formatoAberto: { largura: '', altura: '20' },
    }
    const r = validarFormato(v, layout, { validarVazios: true })
    expect(r.erros['formatoFechado.altura']).toBeTruthy()
    expect(r.erros['formatoFechado.largura']).toBeUndefined()
    expect(r.erros['formatoAberto.largura']).toBeTruthy()
    expect(r.erros['formatoAberto.altura']).toBeUndefined()
  })

  it('nº de sanfonas e de páginas são inteiros', () => {
    const sanfona = layoutDe('SANFONA_ABAS')
    expect(validarFormato({ ...formatoVazio(), numeroSanfonas: '2,5' }, sanfona).valido).toBe(false)
    expect(validarFormato({ ...formatoVazio(), numeroSanfonas: '3' }, sanfona).valido).toBe(true)
    const pagina = layoutDe('PAGINA')
    expect(validarFormato({ ...formatoVazio(), numeroPaginas: '0' }, pagina).valido).toBe(false)
    expect(validarFormato({ ...formatoVazio(), numeroPaginas: '16' }, pagina).valido).toBe(true)
  })

  it('só valida campos visíveis (valor inválido em campo oculto é ignorado)', () => {
    const layout = layoutDe('DUAS_DIMENSOES')
    const v = { ...formatoVazio(), comprimento: 'lixo', formatoFinal: { largura: '660', altura: '960' } }
    expect(validarFormato(v, layout, { validarVazios: true }).valido).toBe(true)
  })

  it('cadastro incompleto bloqueia e não valida nenhum campo', () => {
    for (const modo of [null, '', 'INVENTADO']) {
      const r = validarFormato({ ...formatoVazio(), comprimento: '0' }, layoutDe(modo))
      expect(r.valido).toBe(false)
      expect(r.bloqueio).toBe('CADASTRO_INCOMPLETO')
      expect(r.erros).toEqual({})
    }
  })
})

describe('aplicarFormatoPadrao', () => {
  const padrao = { formatoPadraoLargura: 660, formatoPadraoAltura: 960 }

  it('preenche Formato Final vazio com o padrão, editável', () => {
    const layout = layoutDe('DUAS_DIMENSOES', padrao)
    const r = aplicarFormatoPadrao(formatoVazio(), layout)
    expect(r.formatoFinal).toEqual({ largura: '660', altura: '960' })
  })

  it('no modo aberto/fechado preenche o Formato Fechado', () => {
    const r = aplicarFormatoPadrao(formatoVazio(), layoutDe('ABERTO_FECHADO', padrao))
    expect(r.formatoFechado).toEqual({ largura: '660', altura: '960' })
    expect(r.formatoAberto).toEqual({ largura: '', altura: '' })
  })

  it('nunca sobrescreve valor digitado e devolve o mesmo objeto', () => {
    const layout = layoutDe('DUAS_DIMENSOES', padrao)
    const digitado = { ...formatoVazio(), formatoFinal: { largura: '100', altura: '' } }
    expect(aplicarFormatoPadrao(digitado, layout)).toBe(digitado)
  })

  it('sem padrão ou modo 3 dimensões não preenche nada', () => {
    const vazio = formatoVazio()
    expect(aplicarFormatoPadrao(vazio, layoutDe('DUAS_DIMENSOES'))).toBe(vazio)
    expect(aplicarFormatoPadrao(vazio, layoutDe('TRES_DIMENSOES', padrao))).toBe(vazio)
  })
})

describe('formatoDoItem / formatoParaPayload', () => {
  it('lê os campos novos do item (Decimal como string)', () => {
    const v = formatoDoItem({
      comprimentoMm: '100.00',
      formatoFechadoLarguraMm: '210.5',
      formatoFechadoAlturaMm: 297,
      formatoAbertoLarguraMm: null,
      alturaTampaMm: '12',
      numeroSanfonas: 4,
      numeroPaginas: '32',
      formatoFinalLarguraMm: '660',
      formatoFinalAlturaMm: '960',
    })
    expect(v.comprimento).toBe('100')
    expect(v.formatoFechado).toEqual({ largura: '210,5', altura: '297' })
    expect(v.formatoAberto).toEqual({ largura: '', altura: '' })
    expect(v.alturaTampa).toBe('12')
    expect(v.numeroSanfonas).toBe('4')
    expect(v.numeroPaginas).toBe('32')
    expect(v.formatoFinal).toEqual({ largura: '660', altura: '960' })
  })

  it('payload leva só os campos visíveis do layout (ocultos nunca são gravados)', () => {
    const v = {
      ...formatoVazio(),
      comprimento: '100',
      formatoFinal: { largura: '660', altura: '960' },
      formatoFechado: { largura: '10', altura: '20' },
    }
    const payload = formatoParaPayload(v, layoutDe('DUAS_DIMENSOES'))
    expect(payload).toEqual({ formatoFinalLarguraMm: 660, formatoFinalAlturaMm: 960 })
  })

  it('3 dimensões com Alt Tampa grava as dimensões e as abas; vazio vira null', () => {
    const v = { ...formatoVazio(), comprimento: '100,5', largura: '50', altura: '30', alturaTampa: '12' }
    const payload = formatoParaPayload(v, layoutDe('TRES_DIMENSOES', { possuiAlturaTampa: true }))
    expect(payload).toEqual({
      comprimentoMm: 100.5,
      larguraMm: 50,
      alturaMm: 30,
      abaColaMm: null,
      abaFechamentoMm: null,
      alturaTampaMm: 12,
    })
  })

  it('sem possuiAlturaTampa a Alt Tampa não aparece nem é gravada', () => {
    const layout = layoutDe('TRES_DIMENSOES')
    expect(layout.formato.campos).not.toContain('alturaTampa')
    const payload = formatoParaPayload({ ...formatoVazio(), alturaTampa: '12' }, layout)
    expect('alturaTampaMm' in payload).toBe(false)
  })

  it('sanfona grava a Aba na coluna da aba de cola e o nº de sanfonas', () => {
    const v = { ...formatoVazio(), comprimento: '200', largura: '100', numeroSanfonas: '3', aba: '15' }
    const payload = formatoParaPayload(v, layoutDe('SANFONA_ABAS'))
    expect(payload).toEqual({ comprimentoMm: 200, larguraMm: 100, numeroSanfonas: 3, abaColaMm: 15 })
  })

  it('página grava o formato fechado e o nº de páginas', () => {
    const v = { ...formatoVazio(), formatoFechado: { largura: '148', altura: '210' }, numeroPaginas: '64' }
    const payload = formatoParaPayload(v, layoutDe('PAGINA'))
    expect(payload).toEqual({ formatoFechadoLarguraMm: 148, formatoFechadoAlturaMm: 210, numeroPaginas: 64 })
  })
})
