import { describe, expect, it } from 'vitest'

import {
  LIMITE_DESFAZER,
  PILHA_VAZIA,
  desempilhar,
  empilhar,
  reducerPilha,
  remapearId,
  topo,
  type OperacaoInversa,
} from './pilha-desfazer'
import type { PlanoLeitura } from './plano.types'

function plano(id: string): PlanoLeitura {
  return {
    id,
    sequencia: 1,
    nome: 'Tampa',
    tipoPlanoId: null,
    suporteId: null,
    suporteProducaoId: null,
    gramatura: null,
    formatoLarguraMm: '650',
    formatoAlturaMm: '1225',
    numCores: 4,
    cores: null,
    maquinaId: null,
    acabamentosRicos: null,
    custoSuporte: null,
    custoImpressao: null,
    custoAcabamento: null,
    especificacao: null,
  }
}

const excluir = (id: string): OperacaoInversa => ({ tipo: 'EXCLUIR_PLANO', planoId: id })

describe('pilha-desfazer', () => {
  it('desempilha em ordem inversa', () => {
    let p = PILHA_VAZIA
    p = empilhar(p, excluir('a'))
    p = empilhar(p, excluir('b'))
    p = empilhar(p, { tipo: 'RESTAURAR_ORDEM', ordem: ['a', 'b'] })
    const r1 = desempilhar(p)
    expect(r1.op).toEqual({ tipo: 'RESTAURAR_ORDEM', ordem: ['a', 'b'] })
    const r2 = desempilhar(r1.pilha)
    expect(r2.op).toEqual(excluir('b'))
    const r3 = desempilhar(r2.pilha)
    expect(r3.op).toEqual(excluir('a'))
    expect(desempilhar(r3.pilha).op).toBeNull()
  })

  it(`guarda no máximo ${LIMITE_DESFAZER} ações: com 21, a mais antiga sai`, () => {
    let p = PILHA_VAZIA
    for (let i = 1; i <= 21; i++) p = empilhar(p, excluir(`p${i}`))
    expect(p.itens).toHaveLength(LIMITE_DESFAZER)
    expect(p.itens[0]).toEqual(excluir('p2'))
    expect(topo(p)).toEqual(excluir('p21'))
  })

  it('desempilhar pilha vazia não muda nada', () => {
    expect(desempilhar(PILHA_VAZIA)).toEqual({ pilha: PILHA_VAZIA, op: null })
  })

  it('remapearId troca o id recriado em todas as operações', () => {
    let p = PILHA_VAZIA
    p = empilhar(p, excluir('x'))
    p = empilhar(p, { tipo: 'RESTAURAR_ORDEM', ordem: ['x', 'y'] })
    p = empilhar(p, { tipo: 'RECRIAR_PLANO', plano: plano('z'), posicaoApos: 'x', ordem: ['x', 'z', 'y'] })
    const r = remapearId(p, 'x', 'x2')
    expect(r.itens[0]).toEqual(excluir('x2'))
    expect(r.itens[1]).toEqual({ tipo: 'RESTAURAR_ORDEM', ordem: ['x2', 'y'] })
    const recriar = r.itens[2] as Extract<OperacaoInversa, { tipo: 'RECRIAR_PLANO' }>
    expect(recriar.posicaoApos).toBe('x2')
    expect(recriar.ordem).toEqual(['x2', 'z', 'y'])
    // A pilha original fica intacta (função pura).
    expect(p.itens[0]).toEqual(excluir('x'))
  })

  it('remapearId após RECRIAR_PLANO: o EXCLUIR seguinte aponta para o id novo', () => {
    // Incluir A (EXCLUIR A) → Excluir A (RECRIAR A). Desfazer recria A como A2 e remapeia.
    let p = empilhar(PILHA_VAZIA, excluir('A'))
    p = empilhar(p, { tipo: 'RECRIAR_PLANO', plano: plano('A'), posicaoApos: null, ordem: ['A'] })
    const { pilha } = desempilhar(p)
    expect(remapearId(pilha, 'A', 'A2').itens).toEqual([excluir('A2')])
  })

  it('reducer cobre empilhar, desempilhar, remapear e limpar', () => {
    let p = reducerPilha(PILHA_VAZIA, { tipo: 'EMPILHAR', op: excluir('a') })
    p = reducerPilha(p, { tipo: 'EMPILHAR', op: excluir('b') })
    p = reducerPilha(p, { tipo: 'DESEMPILHAR' })
    expect(p.itens).toEqual([excluir('a')])
    p = reducerPilha(p, { tipo: 'REMAPEAR', antigo: 'a', novo: 'c' })
    expect(p.itens).toEqual([excluir('c')])
    expect(reducerPilha(p, { tipo: 'LIMPAR' })).toEqual(PILHA_VAZIA)
  })
})
