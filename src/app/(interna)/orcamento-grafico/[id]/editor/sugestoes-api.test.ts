import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getMock } = vi.hoisted(() => ({ getMock: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { get: getMock } }))

import { buscarPapeisComPreco, montarParamsPapeis } from './sugestoes-api'

const papeis = (n: number, inicio = 0) =>
  Array.from({ length: n }, (_, i) => ({ id: `p${inicio + i}`, precoUnitario: 5 }))

beforeEach(() => getMock.mockReset())

describe('montarParamsPapeis', () => {
  it('envia gramatura só quando positiva', () => {
    expect(montarParamsPapeis({ suporteId: 's', gramatura: 415 }, 2)).toMatchObject({
      tipo: 'PAPEL', suporteId: 's', comPreco: 'true', limit: 100, page: 2, gramatura: 415,
    })
    expect(montarParamsPapeis({ suporteId: 's', gramatura: null }, 1)).not.toHaveProperty('gramatura')
    expect(montarParamsPapeis({ suporteId: 's', gramatura: 0 }, 1)).not.toHaveProperty('gramatura')
    expect(montarParamsPapeis({ suporteId: 's' }, 1)).not.toHaveProperty('gramatura')
  })
})

describe('buscarPapeisComPreco', () => {
  it('pagina até o fim (250 papéis em 3 páginas) e junta tudo', async () => {
    getMock
      .mockResolvedValueOnce({ data: { data: papeis(100, 0), total: 250, page: 1, totalPages: 3 } })
      .mockResolvedValueOnce({ data: { data: papeis(100, 100), total: 250, page: 2, totalPages: 3 } })
      .mockResolvedValueOnce({ data: { data: papeis(50, 200), total: 250, page: 3, totalPages: 3 } })
    const r = await buscarPapeisComPreco({ suporteId: 's', gramatura: 415 })
    expect(r).toHaveLength(250)
    expect(getMock).toHaveBeenCalledTimes(3)
    expect(getMock.mock.calls.map((c) => c[1].params.page)).toEqual([1, 2, 3])
    expect(getMock.mock.calls[0][1].params.gramatura).toBe(415)
  })

  it('uma página só: não pede a segunda', async () => {
    getMock.mockResolvedValueOnce({ data: { data: papeis(1), total: 1, page: 1, totalPages: 1 } })
    const r = await buscarPapeisComPreco({ suporteId: 's' })
    expect(r).toHaveLength(1)
    expect(getMock).toHaveBeenCalledTimes(1)
  })

  it('resposta em array puro: para na primeira página incompleta', async () => {
    getMock.mockResolvedValueOnce({ data: papeis(3) })
    const r = await buscarPapeisComPreco({ suporteId: 's' })
    expect(r).toHaveLength(3)
    expect(getMock).toHaveBeenCalledTimes(1)
  })

  it('propaga o erro da consulta', async () => {
    getMock.mockRejectedValueOnce(new Error('falhou'))
    await expect(buscarPapeisComPreco({ suporteId: 's' })).rejects.toThrow('falhou')
  })
})
