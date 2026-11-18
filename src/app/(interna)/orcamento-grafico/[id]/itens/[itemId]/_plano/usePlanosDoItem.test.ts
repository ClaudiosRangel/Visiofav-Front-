import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { get, post, patch, del } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}))

vi.mock('@/lib/api', () => ({ api: { get, post, put: vi.fn(), patch, delete: del } }))

import { lerPilha, limparMemoriaPlanos } from './pilha-store'
import type { PlanoLeitura } from './plano.types'
import {
  MSG_LIMITE_PLANOS,
  montarBodyPlano,
  ordemMovida,
  usePlanosDoItem,
} from './usePlanosDoItem'

const BASE = '/orcamento-grafico/orc-1/itens/item-1/planos'

function plano(id: string, nome: string, sequencia: number, extra: Partial<PlanoLeitura> = {}): PlanoLeitura {
  return {
    id,
    sequencia,
    nome,
    tipoPlanoId: null,
    suporteId: null,
    suporteProducaoId: null,
    gramatura: '300',
    formatoLarguraMm: '650',
    formatoAlturaMm: '1225',
    numCores: 4,
    cores: null,
    maquinaId: null,
    acabamentosRicos: [{ acabamentoId: 'ac-1', nome: 'Verniz', restricaoAcabamentoId: null as unknown as string }],
    custoSuporte: null,
    custoImpressao: null,
    custoAcabamento: null,
    especificacao: { versao: 1, cores: '4x0' },
    ...extra,
  }
}

let lista: PlanoLeitura[]

function servidor() {
  get.mockImplementation(() => Promise.resolve({ data: { planos: lista } }))
}

beforeEach(() => {
  vi.clearAllMocks()
  limparMemoriaPlanos()
  lista = [plano('a', 'Tampa', 1), plano('b', 'Fundo', 2)]
  servidor()
})

async function montar() {
  const r = renderHook(() => usePlanosDoItem('orc-1', 'item-1'))
  await waitFor(() => expect(r.result.current.carregando).toBe(false))
  return r
}

describe('funções puras', () => {
  it('montarBodyPlano: converte decimais, tira nulos das linhas e leva posicaoApos', () => {
    const body = montarBodyPlano(plano('a', 'Tampa', 1), 'Tampa (Cópia)', 'a')
    expect(body).toMatchObject({
      nome: 'Tampa (Cópia)',
      formatoLarguraMm: 650,
      formatoAlturaMm: 1225,
      gramatura: 300,
      numCores: 4,
      posicaoApos: 'a',
      especificacao: { versao: 1, cores: '4x0' },
      acabamentosRicos: [{ acabamentoId: 'ac-1', nome: 'Verniz' }],
    })
  })

  it('ordemMovida troca com o vizinho e recusa as pontas', () => {
    expect(ordemMovida(['a', 'b', 'c'], 'b', 'cima')).toEqual(['b', 'a', 'c'])
    expect(ordemMovida(['a', 'b', 'c'], 'b', 'baixo')).toEqual(['a', 'c', 'b'])
    expect(ordemMovida(['a', 'b'], 'a', 'cima')).toBeNull()
    expect(ordemMovida(['a', 'b'], 'b', 'baixo')).toBeNull()
  })
})

describe('usePlanosDoItem', () => {
  it('carrega os planos do item', async () => {
    const { result } = await montar()
    expect(get).toHaveBeenCalledWith(BASE)
    expect(result.current.planos.map((p) => p.id)).toEqual(['a', 'b'])
    expect(result.current.podeDesfazer).toBe(false)
  })

  it('incluir devolve a URL da Tela_Plano, com ?apos quando há referência', async () => {
    const { result } = await montar()
    expect(result.current.incluir()).toBe('/orcamento-grafico/orc-1/itens/item-1/planos/novo')
    expect(result.current.incluir('a')).toBe('/orcamento-grafico/orc-1/itens/item-1/planos/novo?apos=a')
  })

  it('copiar: POST com nome de cópia logo abaixo do original; desfazer apaga a cópia', async () => {
    post.mockImplementation(() => {
      const novo = plano('c', 'Tampa (Cópia)', 2)
      lista = [lista[0], novo, { ...lista[1], sequencia: 3 }]
      return Promise.resolve({ data: novo })
    })
    const { result } = await montar()

    await act(async () => {
      expect(await result.current.copiar('a')).toBe(true)
    })
    const [url, body] = post.mock.calls[0] as [string, Record<string, unknown>]
    expect(url).toBe(BASE)
    expect(body).toMatchObject({ nome: 'Tampa (Cópia)', posicaoApos: 'a', formatoLarguraMm: 650 })
    expect(result.current.planos.map((p) => p.id)).toEqual(['a', 'c', 'b'])
    expect(result.current.podeDesfazer).toBe(true)

    del.mockImplementation(() => {
      lista = lista.filter((p) => p.id !== 'c')
      return Promise.resolve({ status: 204 })
    })
    await act(async () => {
      expect(await result.current.desfazer()).toBe(true)
    })
    expect(del).toHaveBeenCalledWith(`${BASE}/c`)
    expect(result.current.planos.map((p) => p.id)).toEqual(['a', 'b'])
    expect(result.current.podeDesfazer).toBe(false)
  })

  it('erro ao excluir: mantém a lista e mostra "A operação não foi salva." com o detalhe', async () => {
    del.mockRejectedValue({ response: { status: 500, data: { message: 'Falha no banco' } } })
    const { result } = await montar()

    await act(async () => {
      expect(await result.current.excluir('a')).toBe(false)
    })
    expect(result.current.planos.map((p) => p.id)).toEqual(['a', 'b'])
    expect(result.current.erroOperacao).toBe('A operação não foi salva. Falha no banco')
    expect(result.current.podeDesfazer).toBe(false)
  })

  it('409 de limite mostra "Limite de 20 planos por item."', async () => {
    post.mockRejectedValue({ response: { status: 409, data: { message: 'Limite de 20 planos por item.' } } })
    const { result } = await montar()
    await act(async () => {
      await result.current.copiar('a')
    })
    expect(result.current.erroOperacao).toBe(MSG_LIMITE_PLANOS)
    expect(result.current.planos).toHaveLength(2)
  })

  it('no limite de 20 não chama a API ao copiar e não devolve URL de inclusão', async () => {
    lista = Array.from({ length: 20 }, (_, i) => plano(`p${i}`, `P${i}`, i + 1))
    const { result } = await montar()
    expect(result.current.noLimite).toBe(true)
    await act(async () => {
      expect(await result.current.copiar('p0')).toBe(false)
    })
    expect(post).not.toHaveBeenCalled()
    let url: string | null = 'x'
    act(() => {
      url = result.current.incluir()
    })
    expect(url).toBeNull()
    expect(result.current.erroOperacao).toBe(MSG_LIMITE_PLANOS)
  })

  it('mover: PATCH reordenar; desfazer volta a ordem anterior', async () => {
    patch.mockResolvedValue({ data: { planos: [] } })
    const { result } = await montar()

    await act(async () => {
      expect(await result.current.mover('b', 'cima')).toBe(true)
    })
    expect(patch).toHaveBeenLastCalledWith(`${BASE}/reordenar`, { ordem: ['b', 'a'] })
    expect(result.current.planos.map((p) => p.id)).toEqual(['b', 'a'])

    await act(async () => {
      expect(await result.current.desfazer()).toBe(true)
    })
    expect(patch).toHaveBeenLastCalledWith(`${BASE}/reordenar`, { ordem: ['a', 'b'] })
    expect(result.current.planos.map((p) => p.id)).toEqual(['a', 'b'])
  })

  it('erro ao mover: ordem mantida e nada empilhado', async () => {
    patch.mockRejectedValue({ response: { status: 400, data: { message: 'Ordem inválida' } } })
    const { result } = await montar()
    await act(async () => {
      expect(await result.current.mover('b', 'cima')).toBe(false)
    })
    expect(result.current.planos.map((p) => p.id)).toEqual(['a', 'b'])
    expect(result.current.erroOperacao).toBe('A operação não foi salva. Ordem inválida')
    expect(lerPilha('item-1').itens).toHaveLength(0)
  })

  it('excluir e desfazer: recria logo abaixo do anterior e remapeia o id na pilha', async () => {
    lista = [plano('a', 'Tampa', 1), plano('b', 'Fundo', 2), plano('c', 'Miolo', 3)]
    del.mockImplementation((url: string) => {
      lista = lista.filter((p) => !url.endsWith(`/${p.id}`))
      return Promise.resolve({ status: 204 })
    })
    patch.mockResolvedValue({ data: { planos: [] } })
    const { result } = await montar()

    // Reordenar antes, para provar o remapeamento da ordem guardada.
    await act(async () => {
      await result.current.mover('c', 'cima')
    })
    lista = [lista[0], lista[2], lista[1]]
    await act(async () => {
      expect(await result.current.excluir('b')).toBe(true)
    })
    expect(result.current.planos.map((p) => p.id)).toEqual(['a', 'c'])

    post.mockImplementation(() => {
      const novo = plano('b2', 'Fundo', 3)
      lista = [...lista, novo]
      return Promise.resolve({ data: novo })
    })
    await act(async () => {
      expect(await result.current.desfazer()).toBe(true)
    })
    const [, body] = post.mock.calls[0] as [string, Record<string, unknown>]
    expect(body).toMatchObject({ nome: 'Fundo', posicaoApos: 'c' })
    const restante = lerPilha('item-1').itens
    expect(restante).toEqual([{ tipo: 'RESTAURAR_ORDEM', ordem: ['a', 'b2', 'c'] }])
  })
})
