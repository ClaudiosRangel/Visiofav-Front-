import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import { resolverLayoutItem, resolverPadroesIniciais, type LayoutItem } from '../../../_layout/resolver-layout-item'
import {
  aplicarPadroesNoValor,
  campoVisivel,
  coresDoValor,
  coresTextoDoItem,
  leituraCalculada,
  planoUnicoDoItem,
  planoUnicoParaForm,
  planoUnicoVazio,
  textoFormatoCorte,
  textoMontagem,
  validarPlanoUnico,
  type ValorPlanoUnico,
} from './plano-unico-item'

const PRODUTO = {
  modoFormato: 'TRES_DIMENSOES',
  formatoPadraoLargura: null,
  formatoPadraoAltura: null,
  exibeRestricoes: true,
  exibeInformacoesComplementares: false,
  semImpressao: false,
}

function layout(opcoes: { fixo?: boolean; semImpressao?: boolean; micro?: boolean; fibra?: boolean } = {}): LayoutItem {
  return resolverLayoutItem({
    produto: { ...PRODUTO, semImpressao: opcoes.semImpressao === true },
    tiposPlano: [
      {
        id: 't1',
        fixo: opcoes.fixo !== false,
        previsao: { microondulado: opcoes.micro ?? null, fibra: opcoes.fibra ?? null },
      },
    ],
  })
}

const valor = (parcial: Partial<ValorPlanoUnico> = {}): ValorPlanoUnico => ({ ...planoUnicoVazio(), ...parcial })

describe('planoUnicoDoItem', () => {
  it('item nulo vira valor vazio', () => {
    expect(planoUnicoDoItem(null)).toEqual(planoUnicoVazio())
  })

  it('lê as colunas achatadas e mostra Cores como NxM', () => {
    expect(
      planoUnicoDoItem({
        numCores: 5,
        processoImpressao: 'Offset Plana',
        coberturaTintaTexto: 'Definição Manual',
        fabricante: 'Fabricante X',
        fornecido: true,
        microondulado: false,
        fibra: true,
        ajusteCorteMicroMm: '2.5',
      }),
    ).toEqual({
      cores: '5x0',
      processoImpressao: 'Offset Plana',
      coberturaTintaTexto: 'Definição Manual',
      fabricante: 'Fabricante X',
      fornecido: true,
      microondulado: false,
      fibra: true,
      ajusteCorteMicro: '2,5',
    })
  })

  it('sem cores ou com zero cores não inventa NxM', () => {
    expect(coresTextoDoItem(null)).toBe('')
    expect(coresTextoDoItem(0)).toBe('')
    expect(coresTextoDoItem('4')).toBe('4x0')
  })
})

describe('visibilidade dirigida pelo layout', () => {
  it('plano único mostra todos os campos', () => {
    const l = layout()
    for (const c of l.planoUnico.campos) expect(campoVisivel(l, c)).toBe(true)
    expect(campoVisivel(l, 'cores')).toBe(true)
    expect(campoVisivel(l, 'ajusteCorteMicro')).toBe(true)
  })

  it('multi-plano não mostra nenhum campo de plano único', () => {
    const l = layout({ fixo: false })
    expect(campoVisivel(l, 'cores')).toBe(false)
    expect(campoVisivel(l, 'suporte')).toBe(false)
  })

  it('semImpressao oculta cores, processo e cobertura', () => {
    const l = layout({ semImpressao: true })
    expect(campoVisivel(l, 'cores')).toBe(false)
    expect(campoVisivel(l, 'processoImpressao')).toBe(false)
    expect(campoVisivel(l, 'coberturaTinta')).toBe(false)
    expect(campoVisivel(l, 'fabricante')).toBe(true)
  })

  it('cadastro sem microondulado oculta Microondulado e Ajuste Corte Micro; sem fibra oculta Fibra (independentes)', () => {
    const semMicro = layout({ micro: false })
    expect(campoVisivel(semMicro, 'microondulado')).toBe(false)
    expect(campoVisivel(semMicro, 'ajusteCorteMicro')).toBe(false)
    expect(campoVisivel(semMicro, 'fibra')).toBe(true)

    const semFibra = layout({ fibra: false })
    expect(campoVisivel(semFibra, 'fibra')).toBe(false)
    expect(campoVisivel(semFibra, 'microondulado')).toBe(true)
    expect(campoVisivel(semFibra, 'ajusteCorteMicro')).toBe(true)
  })

  it('Montagem e Formato de Corte são somente leitura', () => {
    expect(layout().planoUnico.somenteLeitura).toEqual(['montagem', 'formatoCorte'])
  })
})

describe('validarPlanoUnico', () => {
  it('valor vazio é válido (campos opcionais)', () => {
    expect(validarPlanoUnico(planoUnicoVazio(), layout()).valido).toBe(true)
  })

  it.each(['5x0', '5 x 0', '5X0', '12x12', '0x0'])('aceita cores %s', (cores) => {
    expect(validarPlanoUnico(valor({ cores }), layout()).erros.cores).toBeUndefined()
  })

  it.each(['5', 'x', '5x', 'cinco x 0', '13x0', '0x13'])('rejeita cores %s', (cores) => {
    expect(validarPlanoUnico(valor({ cores }), layout()).erros.cores).toBeTruthy()
  })

  it.each(['0', '100', '100,00', '12,5', '12.5', ',5'])('aceita Ajuste Corte Micro %s', (ajusteCorteMicro) => {
    expect(validarPlanoUnico(valor({ ajusteCorteMicro }), layout()).erros.ajusteCorteMicro).toBeUndefined()
  })

  it.each([
    ['-1', 'negativo'],
    ['100,01', 'máximo'],
    ['101', 'máximo'],
    ['1,234', 'casas'],
    ['abc', 'número'],
  ])('rejeita Ajuste Corte Micro %s', (ajusteCorteMicro) => {
    const r = validarPlanoUnico(valor({ ajusteCorteMicro }), layout())
    expect(r.erros.ajusteCorteMicro).toBeTruthy()
    expect(r.valido).toBe(false)
  })

  it('campo oculto não é validado', () => {
    const l = layout({ micro: false })
    expect(validarPlanoUnico(valor({ ajusteCorteMicro: '999' }), l).valido).toBe(true)
  })

  it('limita o tamanho dos textos', () => {
    const r = validarPlanoUnico(
      valor({ processoImpressao: 'p'.repeat(61), coberturaTintaTexto: 'c'.repeat(61), fabricante: 'f'.repeat(121) }),
      layout(),
    )
    expect(Object.keys(r.erros).sort()).toEqual(['coberturaTintaTexto', 'fabricante', 'processoImpressao'])
  })

  it('propriedade: ajuste fora de 0..100 com 2 casas nunca passa; dentro sempre passa', () => {
    const l = layout()
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 10000 }), (centesimos) => {
        const texto = (centesimos / 100).toFixed(2).replace('.', ',')
        expect(validarPlanoUnico(valor({ ajusteCorteMicro: texto }), l).valido).toBe(true)
      }),
    )
    fc.assert(
      fc.property(fc.integer({ min: 10001, max: 99999 }), (centesimos) => {
        const texto = (centesimos / 100).toFixed(2).replace('.', ',')
        expect(validarPlanoUnico(valor({ ajusteCorteMicro: texto }), l).valido).toBe(false)
      }),
    )
  })
})

describe('planoUnicoParaForm', () => {
  it('converte para colunas achatadas e Ajuste Corte Micro vira número', () => {
    const r = planoUnicoParaForm(
      valor({
        processoImpressao: '  Offset  ',
        coberturaTintaTexto: 'Manual',
        fabricante: 'X',
        fornecido: true,
        fibra: true,
        ajusteCorteMicro: '2,5',
      }),
      layout(),
    )
    expect(r).toEqual({
      processoImpressao: 'Offset',
      coberturaTintaTexto: 'Manual',
      fabricante: 'X',
      fornecido: true,
      microondulado: false,
      fibra: true,
      ajusteCorteMicroMm: 2.5,
    })
  })

  it('Ajuste vazio ou inválido não grava número', () => {
    expect(planoUnicoParaForm(valor({ ajusteCorteMicro: '' }), layout()).ajusteCorteMicroMm).toBeNull()
    expect(planoUnicoParaForm(valor({ ajusteCorteMicro: '500' }), layout()).ajusteCorteMicroMm).toBeNull()
  })

  it('não envia campos ocultos', () => {
    const r = planoUnicoParaForm(valor({ microondulado: true, ajusteCorteMicro: '3' }), layout({ micro: false, fibra: false }))
    expect(r).not.toHaveProperty('microondulado')
    expect(r).not.toHaveProperty('ajusteCorteMicroMm')
    expect(r).not.toHaveProperty('fibra')
  })

  it('multi-plano não grava nada de plano único', () => {
    expect(planoUnicoParaForm(valor({ fabricante: 'X' }), layout({ fixo: false }))).toEqual({})
  })

  it('nunca inclui Cores nem Suporte', () => {
    const r = planoUnicoParaForm(valor({ cores: '5x0' }), layout())
    expect(r).not.toHaveProperty('cores')
    expect(r).not.toHaveProperty('numCores')
    expect(r).not.toHaveProperty('suporteId')
  })
})

describe('coresDoValor', () => {
  it('divide frente e verso', () => {
    expect(coresDoValor({ cores: '5 x 2' })).toEqual({ frente: 5, verso: 2 })
  })
  it('vazio ou inválido = null', () => {
    expect(coresDoValor({ cores: '' })).toBeNull()
    expect(coresDoValor({ cores: '13x0' })).toBeNull()
  })
})

describe('padrões do DefaultProdutoPlano (item novo)', () => {
  const padroes = resolverPadroesIniciais({
    default: {
      id: 'd',
      empresaId: 'e',
      produtoId: 'p',
      tipoPlanoId: 't',
      semImpressao: false,
      processoImpressaoId: 'proc',
      coberturaTintaId: 'cob',
      coresFrente: 5,
      coresVerso: 0,
      areaTintaPerc: 100 as never,
      fabricanteSuporte: 'Fabricante Padrão',
      atividadesPreMarcadas: ['a1'],
    },
    atividadesDoCatalogo: [{ id: 'a2', preMarcada: true }],
  })
  const nomes = { processoImpressao: 'Offset Plana', coberturaTinta: 'Definição Manual' }

  it('preenche campos vazios', () => {
    expect(aplicarPadroesNoValor(planoUnicoVazio(), padroes, nomes)).toMatchObject({
      cores: '5x0',
      processoImpressao: 'Offset Plana',
      coberturaTintaTexto: 'Definição Manual',
      fabricante: 'Fabricante Padrão',
    })
  })

  it('nunca sobrescreve o que já foi digitado e é idempotente', () => {
    const digitado = valor({ cores: '1x1', processoImpressao: 'Flexo', fabricante: 'Meu' })
    const r = aplicarPadroesNoValor(digitado, padroes, nomes)
    expect(r).toMatchObject({ cores: '1x1', processoImpressao: 'Flexo', fabricante: 'Meu', coberturaTintaTexto: 'Definição Manual' })
    expect(aplicarPadroesNoValor(r, padroes, nomes)).toEqual(r)
  })

  it('sem padrão, devolve o mesmo valor', () => {
    const v = planoUnicoVazio()
    expect(aplicarPadroesNoValor(v, null)).toBe(v)
  })

  it('padrão sem impressão não preenche Cores', () => {
    const semImp = resolverPadroesIniciais({ default: { semImpressao: true, coresFrente: 4, coresVerso: 0 } as never })
    expect(aplicarPadroesNoValor(planoUnicoVazio(), semImp).cores).toBe('')
  })
})

describe('Montagem e Formato de Corte (somente leitura)', () => {
  it('montagem LxC', () => {
    expect(textoMontagem(2, 2)).toBe('2x2')
    expect(textoMontagem('3', '1')).toBe('3x1')
  })
  it('formato de corte em mm com vírgula decimal', () => {
    expect(textoFormatoCorte(650, 1225)).toBe('650 x 1225')
    expect(textoFormatoCorte(650.5, 1225)).toBe('650,5 x 1225')
  })
  it('lado ausente ou zero = vazio', () => {
    expect(textoMontagem(2, null)).toBe('')
    expect(textoMontagem(0, 2)).toBe('')
    expect(textoFormatoCorte(650, undefined)).toBe('')
  })
  it('leituraCalculada lê do formulário do item', () => {
    expect(
      leituraCalculada({ montagemLinhas: 2, montagemColunas: 3, formatoCorteLarguraMm: 650, formatoCorteAlturaMm: 1225 }),
    ).toEqual({ montagem: '2x3', formatoCorte: '650 x 1225' })
    expect(leituraCalculada(null)).toEqual({ montagem: '', formatoCorte: '' })
  })
})
