/**
 * Rotulo escrito EM CIMA da barra colorida no zoom afastado (OP, cliente e servico).
 * Rodar: npx vitest run "src/app/(interna)/pcp/gantt/gantt-rotulo.test.ts" --pool=threads
 */
import { describe, expect, it } from 'vitest'
import fc from 'fast-check'
import { escolherRotuloNaBarra } from './gantt-layout'

const ALTURA = 50

describe('escolherRotuloNaBarra', () => {
  it('barra larga -> "OP3224" deitado', () => {
    expect(escolherRotuloNaBarra('3224', 90, ALTURA)).toEqual({ texto: 'OP3224', orientacao: 'horizontal' })
  })
  it('barra media -> so o numero, deitado', () => {
    expect(escolherRotuloNaBarra('3224', 45, ALTURA)).toEqual({ texto: '3224', orientacao: 'horizontal' })
  })
  it('barra estreita -> numero em pe (cabe na altura da barra)', () => {
    expect(escolherRotuloNaBarra('3224', 20, ALTURA)).toEqual({ texto: '3224', orientacao: 'vertical' })
  })
  it('barra estreita e alta -> "OP3224" em pe', () => {
    expect(escolherRotuloNaBarra('3224', 20, 70)).toEqual({ texto: 'OP3224', orientacao: 'vertical' })
  })
  it('barra fina demais (menos de 15px) -> nada em cima (usa o rotulo ao lado)', () => {
    expect(escolherRotuloNaBarra('3224', 10, ALTURA)).toBeNull()
    expect(escolherRotuloNaBarra('3224', 3, ALTURA)).toBeNull()
  })
  it('numero muito longo que nao cabe nem em pe -> nada', () => {
    expect(escolherRotuloNaBarra('123456789012', 20, ALTURA)).toBeNull()
  })
  it('OP vazia -> nada', () => {
    expect(escolherRotuloNaBarra('', 90, ALTURA)).toBeNull()
  })
})

describe('cliente e servico (linhas extras)', () => {
  const extras = ['Cervejaria Imperial', 'Caixa e-commerce 270 x 200']

  it('barra larga e alta -> OP + cliente + servico', () => {
    expect(escolherRotuloNaBarra('3224', 150, ALTURA, extras)).toEqual({
      texto: 'OP3224', orientacao: 'horizontal', detalhes: extras,
    })
  })
  it('exatamente 90px de largura ja mostra os detalhes', () => {
    expect(escolherRotuloNaBarra('3224', 90, ALTURA, extras)?.detalhes).toEqual(extras)
  })
  it('barra media (menos de 90px) -> so a OP, sem detalhes', () => {
    expect(escolherRotuloNaBarra('3224', 70, ALTURA, extras)).toEqual({ texto: 'OP3224', orientacao: 'horizontal' })
  })
  it('barra baixa (menos de 44px de altura) -> so a OP', () => {
    expect(escolherRotuloNaBarra('3224', 150, 40, extras)).toEqual({ texto: 'OP3224', orientacao: 'horizontal' })
  })
  it('barra estreita (texto em pe) nunca leva detalhes', () => {
    expect(escolherRotuloNaBarra('3224', 20, ALTURA, extras)).toEqual({ texto: '3224', orientacao: 'vertical' })
  })
  it('ignora linhas vazias/nulas e usa so o que existe', () => {
    expect(escolherRotuloNaBarra('3224', 150, ALTURA, [null, '  ', 'Caixa'])).toEqual({
      texto: 'OP3224', orientacao: 'horizontal', detalhes: ['Caixa'],
    })
    expect(escolherRotuloNaBarra('3224', 150, ALTURA, [null, undefined, ''])).toEqual({
      texto: 'OP3224', orientacao: 'horizontal',
    })
  })
  it('no maximo 2 linhas extras', () => {
    expect(escolherRotuloNaBarra('3224', 150, ALTURA, ['a', 'b', 'c'])?.detalhes).toEqual(['a', 'b'])
  })
})

describe('propriedades', () => {
  it('o rotulo escolhido sempre cabe no espaco da orientacao escolhida', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 8 }).filter((s) => s.trim().length > 0),
        fc.integer({ min: 1, max: 400 }),
        fc.integer({ min: 20, max: 120 }),
        (op, largura, altura) => {
          const r = escolherRotuloNaBarra(op, largura, altura)
          if (!r) return true
          const comprimento = r.texto.length * 7.6 + 8
          return r.orientacao === 'horizontal' ? comprimento <= largura : comprimento <= altura && largura >= 15
        },
      ),
    )
  })
  it('detalhes so existem em rotulo deitado, em barra larga e alta', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 400 }),
        fc.integer({ min: 20, max: 120 }),
        (largura, altura) => {
          const r = escolherRotuloNaBarra('3224', largura, altura, ['Cliente', 'Servico'])
          if (!r?.detalhes) return true
          return r.orientacao === 'horizontal' && largura >= 90 && altura >= 44
        },
      ),
    )
  })
})
