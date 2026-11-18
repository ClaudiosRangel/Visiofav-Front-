import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import type { SelecaoMaterial } from '../../../../cadastros/_shared/cadastros-graficos.types'
import {
  alternarAtividade,
  aplicarPreMarcadas,
  definirRestricao,
  estaMarcada,
  filtrarAtividades,
  novoAcabamentoRico,
  restricaoDaAtividade,
  selecaoDaAtividade,
  type AtividadeCadastro,
} from './acabamento-item'

const ativ = (id: string, nome: string, extra: Partial<AtividadeCadastro> = {}): AtividadeCadastro => ({
  id,
  nome,
  codigo: id.toUpperCase(),
  naturezaCusto: 'HORA_MAQUINA',
  ...extra,
})

const CADASTRO = [ativ('a1', 'AFT70 Coladeira'), ativ('a2', 'Bimac Acoplagem'), ativ('a3', 'Corte e Vinco')]

describe('novoAcabamentoRico', () => {
  it('copia os padrões do cadastro convertendo texto em número', () => {
    const r = novoAcabamentoRico(ativ('a1', 'AFT70', { custoHora: '320', producaoHora: '', quantAcertos: '2' }))
    expect(r).toMatchObject({
      acabamentoId: 'a1',
      nome: 'AFT70',
      naturezaCusto: 'HORA_MAQUINA',
      custoHora: 320,
      producaoHora: undefined,
      quantAcertos: 2,
      unidadeBase: 'FOLHA',
    })
  })
})

describe('alternarAtividade', () => {
  it('marca e desmarca (ida e volta devolve a lista original)', () => {
    const marcada = alternarAtividade([], CADASTRO[0])
    expect(marcada.map((s) => s.acabamentoId)).toEqual(['a1'])
    expect(alternarAtividade(marcada, CADASTRO[0])).toEqual([])
  })

  it('desmarca item salvo sem acabamentoId casando pelo nome (sem acento/caixa)', () => {
    const salvo = [{ nome: 'aft70 coladeira', naturezaCusto: 'HORA_MAQUINA' }] as never
    expect(alternarAtividade(salvo, CADASTRO[0])).toEqual([])
  })

  it('propriedade: nunca duplica atividade e preserva a ordem de marcação', () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 2 }), { maxLength: 12 }), (cliques) => {
        let lista: ReturnType<typeof alternarAtividade> = []
        for (const i of cliques) lista = alternarAtividade(lista, CADASTRO[i])
        const ids = lista.map((s) => s.acabamentoId)
        expect(new Set(ids).size).toBe(ids.length)
        for (const a of CADASTRO) {
          const vezes = cliques.filter((i) => CADASTRO[i].id === a.id).length
          expect(estaMarcada(lista, a)).toBe(vezes % 2 === 1)
        }
      }),
    )
  })
})

describe('aplicarPreMarcadas', () => {
  it('item sem marcações recebe as pré-marcadas do cadastro, sem repetir e ignorando ids desconhecidos', () => {
    const r = aplicarPreMarcadas([], ['a2', 'a2', 'zzz', 'a1'], CADASTRO)
    expect(r.acabamentosRicos.map((s) => s.acabamentoId)).toEqual(['a2', 'a1'])
    expect(r.marcadas.map((a) => a.id)).toEqual(['a2', 'a1'])
  })

  it('item que já tem marcação não muda', () => {
    const atuais = [novoAcabamentoRico(CADASTRO[2])]
    const r = aplicarPreMarcadas(atuais, ['a1'], CADASTRO)
    expect(r.acabamentosRicos).toEqual(atuais)
    expect(r.marcadas).toEqual([])
  })

  it('sem pré-marcadas não marca nada', () => {
    expect(aplicarPreMarcadas([], [], CADASTRO).acabamentosRicos).toEqual([])
    expect(aplicarPreMarcadas([], null, CADASTRO).marcadas).toEqual([])
  })
})

describe('filtrarAtividades', () => {
  it('busca por nome ou código sem acento nem caixa', () => {
    expect(filtrarAtividades(CADASTRO, 'aft').map((a) => a.id)).toEqual(['a1'])
    expect(filtrarAtividades(CADASTRO, 'ACOPLAGEM').map((a) => a.id)).toEqual(['a2'])
    expect(filtrarAtividades(CADASTRO, 'a3').map((a) => a.id)).toEqual(['a3'])
  })
  it('vazio devolve tudo; sem resultado devolve vazio', () => {
    expect(filtrarAtividades(CADASTRO, '  ')).toHaveLength(3)
    expect(filtrarAtividades(CADASTRO, 'xyz')).toEqual([])
  })
})

describe('restrição escolhida', () => {
  const marcadas = [novoAcabamentoRico(CADASTRO[0]), novoAcabamentoRico(CADASTRO[1])]

  it('define e lê a restrição só da atividade indicada', () => {
    const r = definirRestricao(marcadas, CADASTRO[0], { id: 'r1', nome: 'Lateral Simples' })
    expect(restricaoDaAtividade(r, CADASTRO[0])).toEqual({ id: 'r1', nome: 'Lateral Simples' })
    expect(restricaoDaAtividade(r, CADASTRO[1])).toBeNull()
  })

  it('limpa com null e não altera a lista original', () => {
    const com = definirRestricao(marcadas, CADASTRO[0], { id: 'r1', nome: 'X' })
    const sem = definirRestricao(com, CADASTRO[0], null)
    expect(restricaoDaAtividade(sem, CADASTRO[0])).toBeNull()
    expect(sem[0]).not.toHaveProperty('restricaoAcabamentoId')
    expect(marcadas[0]).not.toHaveProperty('restricaoAcabamentoId')
  })

  it('atividade desmarcada não ganha linha', () => {
    expect(definirRestricao(marcadas, CADASTRO[2], { id: 'r1', nome: 'X' })).toEqual(marcadas)
  })
})

describe('selecaoDaAtividade', () => {
  const gravada = {
    id: 's1',
    itemId: 'i1',
    planoId: null,
    acabamentoId: 'a1',
    materialId: 'm1',
    restricaoId: 'r1',
    tipoParam: 3,
    param1: 12.5,
    param2: null,
    consumo: null,
    unidadeConsumo: null,
    valorUnitario: null,
    custo: 0,
    aplicaNoPreco: false,
    situacaoParametro: 'OK',
  } as SelecaoMaterial

  it('prefere a gravada', () => {
    expect(selecaoDaAtividade([gravada], [{ acabamentoId: 'a1', materialId: 'mX' }], 'a1')).toMatchObject({
      materialId: 'm1',
      restricaoId: 'r1',
      tipoParam: 3,
      param1: 12.5,
      pendente: false,
    })
  })

  it('usa a pendente quando não há gravada, ignorando remoções', () => {
    expect(selecaoDaAtividade([], [{ acabamentoId: 'a1', materialId: 'mP', param1: 2 }], 'a1')).toMatchObject({
      materialId: 'mP',
      param1: 2,
      pendente: true,
    })
    expect(selecaoDaAtividade([], [{ acabamentoId: 'a1', materialId: 'mP', remover: true }], 'a1')).toBeNull()
  })

  it('seleção de plano não vaza para a do item e vice-versa', () => {
    const doPlano = { ...gravada, planoId: 'p1' } as SelecaoMaterial
    expect(selecaoDaAtividade([doPlano], [], 'a1')).toBeNull()
    expect(selecaoDaAtividade([doPlano], [], 'a1', 'p1')).not.toBeNull()
  })

  it('nada selecionado = null', () => {
    expect(selecaoDaAtividade(null, undefined, 'a1')).toBeNull()
  })
})
