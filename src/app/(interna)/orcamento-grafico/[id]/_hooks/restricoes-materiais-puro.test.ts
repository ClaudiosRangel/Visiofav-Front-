import { describe, expect, it } from 'vitest'

import type { CatalogoPlano } from '../../cadastros/_shared/cadastros-graficos.types'
import { daRespostaDaAtividade, doCatalogoDoPlano } from './restricoes-materiais-puro'

const catalogo = {
  atividades: [
    {
      id: 'a1',
      codigo: 'A1',
      nome: 'Atividade 1',
      restricoes: [{ id: 'r1', nome: 'Lateral Simples' }],
      materiais: [{ id: 'm1', nome: 'Cola Branca', tipoParam: 4, ordem: 0, padrao: true }],
    },
    { id: 'a2', codigo: 'A2', nome: 'Atividade 2', restricoes: [], materiais: [] },
  ],
} as unknown as Pick<CatalogoPlano, 'atividades'>

describe('doCatalogoDoPlano', () => {
  it('devolve restrições e materiais da atividade presente no catálogo do plano', () => {
    const r = doCatalogoDoPlano(catalogo, 'a1')
    expect(r?.restricoes.map((x) => x.nome)).toEqual(['Lateral Simples'])
    expect(r?.materiais[0]).toMatchObject({ id: 'm1', tipoParam: 4 })
  })

  it('atividade presente porém sem registros devolve listas vazias (não null)', () => {
    expect(doCatalogoDoPlano(catalogo, 'a2')).toEqual({ restricoes: [], materiais: [] })
  })

  it('atividade fora do catálogo, catálogo ausente ou sem foco devolve null (exige consulta avulsa)', () => {
    expect(doCatalogoDoPlano(catalogo, 'zzz')).toBeNull()
    expect(doCatalogoDoPlano(null, 'a1')).toBeNull()
    expect(doCatalogoDoPlano(undefined, 'a1')).toBeNull()
    expect(doCatalogoDoPlano(catalogo, null)).toBeNull()
  })

  it('devolve cópias: alterar o resultado não altera o catálogo', () => {
    const r = doCatalogoDoPlano(catalogo, 'a1')!
    r.restricoes.pop()
    expect(doCatalogoDoPlano(catalogo, 'a1')!.restricoes).toHaveLength(1)
  })
})

describe('daRespostaDaAtividade', () => {
  it('normaliza listas ausentes para vazias', () => {
    expect(daRespostaDaAtividade(null)).toEqual({ restricoes: [], materiais: [] })
    expect(daRespostaDaAtividade({ restricoes: undefined, materiais: undefined } as never)).toEqual({
      restricoes: [],
      materiais: [],
    })
  })

  it('mantém os registros da resposta', () => {
    const r = daRespostaDaAtividade({
      restricoes: [{ id: 'r1', nome: 'X' }],
      materiais: [{ id: 'm1', nome: 'Y', tipoParam: 0, ordem: 1, padrao: false }],
    })
    expect(r.restricoes).toHaveLength(1)
    expect(r.materiais[0].id).toBe('m1')
  })
})
