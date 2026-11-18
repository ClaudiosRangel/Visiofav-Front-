import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  carregarTodasPaginas,
  completarPorIds,
  TAMANHO_PAGINA,
  MAX_IDS_POR_REQUISICAO,
  type PaginaAcabamentos,
} from './acabamentos-paginacao'

// Feature: orcamento-grafico-fase3-produto-embalagem, Property 21: Carga paginada traz todos os acabamentos uma vez

interface Ac {
  id: string
}

function servidor(todos: Ac[], informarTotal: boolean) {
  const chamadas: number[] = []
  const buscarPagina = async (pagina: number, limite: number): Promise<PaginaAcabamentos<Ac>> => {
    chamadas.push(pagina)
    const ini = (pagina - 1) * limite
    return { data: todos.slice(ini, ini + limite), total: informarTotal ? todos.length : null }
  }
  return { chamadas, buscarPagina }
}

const listaArb = fc
  .integer({ min: 0, max: 450 })
  .map((n) => Array.from({ length: n }, (_, i) => ({ id: `ac-${i}` })))

describe('Property 21: carga paginada traz todos os acabamentos uma vez', () => {
  it('traz cada acabamento exatamente uma vez, na ordem, e o número de requisições é o mínimo', async () => {
    await fc.assert(
      fc.asyncProperty(listaArb, fc.boolean(), async (todos, informarTotal) => {
        const { chamadas, buscarPagina } = servidor(todos, informarTotal)
        const r = await carregarTodasPaginas(buscarPagina)
        expect(r.erro).toBeNull()
        expect(r.completo).toBe(true)
        expect(r.itens.map((i) => i.id)).toEqual(todos.map((i) => i.id))
        expect(new Set(r.itens.map((i) => i.id)).size).toBe(r.itens.length)
        // Página cheia sem total: o carregador não sabe que acabou e pede a próxima (vazia).
        if (todos.length < TAMANHO_PAGINA || (informarTotal && todos.length === TAMANHO_PAGINA)) expect(chamadas).toEqual([1])
        else if (informarTotal) expect(chamadas.length).toBe(Math.ceil(todos.length / TAMANHO_PAGINA))
        else expect(chamadas.length).toBe(Math.floor(todos.length / TAMANHO_PAGINA) + 1)
      }),
      { numRuns: 100 },
    )
  })

  it('até 100 acabamentos: 1 requisição de listagem e 0 buscas por id', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 100 }), async (n) => {
        const todos = Array.from({ length: n }, (_, i) => ({ id: `ac-${i}` }))
        const { chamadas, buscarPagina } = servidor(todos, true)
        const r = await carregarTodasPaginas(buscarPagina)
        let buscasPorId = 0
        const c = await completarPorIds(r.itens, todos.map((t) => t.id), async () => {
          buscasPorId++
          return []
        })
        expect(chamadas.length).toBe(1)
        expect(buscasPorId).toBe(0)
        expect(c.itens.length).toBe(n)
      }),
      { numRuns: 100 },
    )
  })

  it('busca por id só do que falta, em lotes de até 50, sem duplicar', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 200 }),
        fc.integer({ min: 0, max: 120 }),
        async (carregadosN, ausentesN) => {
          const carregados = Array.from({ length: carregadosN }, (_, i) => ({ id: `c-${i}` }))
          const ausentes = Array.from({ length: ausentesN }, (_, i) => ({ id: `a-${i}` }))
          const pedidos = [...carregados.slice(0, 30).map((c) => c.id), ...ausentes.map((a) => a.id), ...ausentes.map((a) => a.id)]
          const tamanhos: number[] = []
          const r = await completarPorIds(carregados, pedidos, async (ids) => {
            tamanhos.push(ids.length)
            return ids.map((id) => ({ id }))
          })
          expect(r.erro).toBeNull()
          expect(tamanhos.every((t) => t >= 1 && t <= MAX_IDS_POR_REQUISICAO)).toBe(true)
          expect(tamanhos.reduce((s, t) => s + t, 0)).toBe(ausentesN)
          expect(r.itens.length).toBe(carregadosN + ausentesN)
          expect(new Set(r.itens.map((i) => i.id)).size).toBe(r.itens.length)
        },
      ),
      { numRuns: 100 },
    )
  })

  it('falha de página mantém o já carregado e retoma sem repetir itens', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 101, max: 450 }), async (n) => {
        const todos = Array.from({ length: n }, (_, i) => ({ id: `ac-${i}` }))
        let falhar = true
        const buscar = async (pagina: number, limite: number): Promise<PaginaAcabamentos<Ac>> => {
          if (pagina === 2 && falhar) throw { response: { data: { message: 'Falha de teste' } } }
          const ini = (pagina - 1) * limite
          return { data: todos.slice(ini, ini + limite), total: todos.length }
        }
        const parcial = await carregarTodasPaginas(buscar)
        expect(parcial.completo).toBe(false)
        expect(parcial.erro).toBe('Falha de teste')
        expect(parcial.itens.length).toBe(TAMANHO_PAGINA)
        falhar = false
        const final = await carregarTodasPaginas(buscar, parcial)
        expect(final.erro).toBeNull()
        expect(final.itens.map((i) => i.id)).toEqual(todos.map((i) => i.id))
      }),
      { numRuns: 100 },
    )
  })

  it('falha em um lote da busca por id mantém a lista e informa a mensagem', async () => {
    const carregados = [{ id: 'c-1' }]
    const pedidos = Array.from({ length: 60 }, (_, i) => `a-${i}`)
    let chamada = 0
    const r = await completarPorIds(carregados, pedidos, async (ids) => {
      chamada++
      if (chamada === 2) throw { response: { data: { message: 'Erro na busca' } } }
      return ids.map((id) => ({ id }))
    })
    expect(r.erro).toBe('Erro na busca')
    expect(r.idsComFalha.length).toBe(10)
    expect(r.itens.length).toBe(1 + 50)
  })
})
