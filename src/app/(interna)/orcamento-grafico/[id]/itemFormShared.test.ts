import { describe, expect, it, vi } from 'vitest'

// Evita carregar a página do wizard (Mantine, steps) e o cliente HTTP.
vi.mock('../novo/page', () => ({ extrairTiragensDasObservacoes: () => null }))
vi.mock('@/lib/api', () => ({ api: { put: vi.fn(), post: vi.fn() } }))

import { api } from '@/lib/api'
import {
  INITIAL_ITEM,
  itemParaForm,
  montarPayloadCalculo,
  montarPayloadItem,
  salvarItem,
  type ItemParaEditar,
} from './itemFormShared'

const itemBase: ItemParaEditar = { id: 'i1', tipoEmbalagemId: 't1', quantidade: 5000 }

describe('montarPayloadItem — não-regressão', () => {
  it('sem produto e sem SELECAO não envia produtoGraficoId nem materiais', () => {
    const p = montarPayloadItem({ ...INITIAL_ITEM, tipoEmbalagemId: 't1' })
    expect('produtoGraficoId' in p).toBe(false)
    expect(p.materiaisAcabamento).toBeUndefined()
  })

  it('linha manual marcada vai sem origem/selecaoId; desmarcada é omitida', () => {
    const p = montarPayloadItem({
      ...INITIAL_ITEM,
      materiaisAcabamento: [
        { materialAcabamentoId: 'm1', nome: 'A', computarCusto: true, valorUnitario: 2, quantidade: 3 },
        { materialAcabamentoId: 'm2', nome: 'B', computarCusto: false },
      ],
    })
    expect(p.materiaisAcabamento).toEqual([
      { materialAcabamentoId: 'm1', nome: 'A', computarCusto: true, valorUnitario: 2, quantidade: 3 },
    ])
  })
})

describe('montarPayloadItem — Fase 2', () => {
  it('envia produtoGraficoId quando definido e null para limpar', () => {
    expect(montarPayloadItem({ ...INITIAL_ITEM, produtoGraficoId: 'p1' }).produtoGraficoId).toBe('p1')
    const limpo = montarPayloadItem({ ...INITIAL_ITEM, produtoGraficoId: null })
    expect('produtoGraficoId' in limpo).toBe(true)
    expect(limpo.produtoGraficoId).toBeNull()
  })

  it('envia TODAS as linhas SELECAO (inclusive computarCusto=false)', () => {
    const p = montarPayloadItem({
      ...INITIAL_ITEM,
      materiaisAcabamento: [
        { materialAcabamentoId: 'm1', nome: 'Cola', computarCusto: false, valorUnitario: 1, quantidade: 2, origem: 'SELECAO', selecaoId: 's1' },
        { materialAcabamentoId: 'm2', nome: 'Verniz', computarCusto: true, valorUnitario: 3, quantidade: 4, origem: 'SELECAO', selecaoId: 's2' },
      ],
    })
    expect(p.materiaisAcabamento).toEqual([
      { materialAcabamentoId: 'm1', nome: 'Cola', computarCusto: false, valorUnitario: 1, quantidade: 2, origem: 'SELECAO', selecaoId: 's1' },
      { materialAcabamentoId: 'm2', nome: 'Verniz', computarCusto: true, valorUnitario: 3, quantidade: 4, origem: 'SELECAO', selecaoId: 's2' },
    ])
  })
})

describe('itemParaForm', () => {
  it('hidrata produtoGraficoId e preserva origem/selecaoId', () => {
    const f = itemParaForm({
      ...itemBase,
      produtoGraficoId: 'p1',
      materiaisAcabamento: [
        { materialAcabamentoId: 'm1', nome: 'Cola', computarCusto: false, valorUnitario: 1, quantidade: 2, origem: 'SELECAO', selecaoId: 's1' },
        { materialAcabamentoId: 'm2', nome: 'Manual', computarCusto: true, valorUnitario: 1, quantidade: 1 },
      ],
    })
    expect(f.produtoGraficoId).toBe('p1')
    expect(f.materiaisAcabamento?.[0]).toMatchObject({ origem: 'SELECAO', selecaoId: 's1', computarCusto: false })
    expect(f.materiaisAcabamento?.[1]).not.toHaveProperty('origem')
    expect(f.materiaisAcabamento?.[1]).not.toHaveProperty('selecaoId')
  })

  it('item sem produto fica com produtoGraficoId indefinido', () => {
    expect(itemParaForm(itemBase).produtoGraficoId).toBeUndefined()
  })

  it('round-trip: hidratar e montar preserva as linhas SELECAO', () => {
    const f = itemParaForm({
      ...itemBase,
      produtoGraficoId: 'p1',
      materiaisAcabamento: [
        { materialAcabamentoId: 'm1', nome: 'Cola', computarCusto: false, valorUnitario: 0, quantidade: 0, origem: 'SELECAO', selecaoId: 's1' },
      ],
    })
    const p = montarPayloadItem(f)
    expect(p.produtoGraficoId).toBe('p1')
    expect((p.materiaisAcabamento as unknown[])).toHaveLength(1)
  })
})

describe('montarPayloadCalculo', () => {
  const linhas = [
    { materialAcabamentoId: 'm1', nome: 'Cola', computarCusto: true, valorUnitario: 2, quantidade: 3, origem: 'SELECAO', selecaoId: 's1' },
    { materialAcabamentoId: 'm2', nome: 'Sem custo', computarCusto: false, origem: 'SELECAO', selecaoId: 's2' },
  ]

  it('sem produto: não envia materiaisAcabamento (idêntico ao atual)', () => {
    const p = montarPayloadCalculo({ ...INITIAL_ITEM, materiaisAcabamento: linhas })
    expect('materiaisAcabamento' in p).toBe(false)
  })

  it('com produto: envia só linhas com custo computado', () => {
    const p = montarPayloadCalculo({ ...INITIAL_ITEM, produtoGraficoId: 'p1', materiaisAcabamento: linhas })
    expect(p.materiaisAcabamento).toEqual([
      { materialAcabamentoId: 'm1', nome: 'Cola', computarCusto: true, valorUnitario: 2, quantidade: 3 },
    ])
  })
})

describe('salvarItem', () => {
  it('POST devolve o item criado; PUT devolve o atualizado', async () => {
    vi.mocked(api.post).mockResolvedValueOnce({ data: { id: 'novo' } } as never)
    vi.mocked(api.put).mockResolvedValueOnce({ data: { id: 'existente' } } as never)
    expect((await salvarItem('o1', INITIAL_ITEM)).id).toBe('novo')
    expect((await salvarItem('o1', INITIAL_ITEM, 'existente')).id).toBe('existente')
  })
})
