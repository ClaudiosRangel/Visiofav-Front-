import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fc from 'fast-check'
import { renderHook, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import { decidirAcaoAutorizarEntrada, type AcaoAutorizarEntrada, useAutorizarEntrada } from './useAutorizarEntrada'

// Mock the api module
vi.mock('@/lib/api', () => ({
  api: {
    post: vi.fn(),
  },
}))

// Mock notifications to avoid DOM/portal issues in tests
vi.mock('@mantine/notifications', () => ({
  notifications: {
    show: vi.fn(),
  },
}))

import { api } from '@/lib/api'

const mockedApi = api as unknown as { post: ReturnType<typeof vi.fn> }

const ACOES_VALIDAS: AcaoAutorizarEntrada[] = [
  'ABRIR_MODAL_CREDENCIAIS',
  'ERRO_CREDENCIAIS_INVALIDAS',
  'SUCESSO',
  'ERRO_GENERICO',
]

describe('decidirAcaoAutorizarEntrada', () => {
  // Feature: melhorias-compras-wms-fiscal-frontend, Property 16: Decisão de
  // ação do fluxo Autorizar Entrada cobre todo o espaço de status HTTP sem
  // sobreposição
  // Validates: Requirements 10.2, 10.4, 10.5, 11.1

  const statusHttp = fc.integer({ min: 100, max: 599 })

  it('totalidade: para qualquer status e qualquer tinhaCredenciais, retorna sempre uma das quatro ações, sem lançar exceção', () => {
    fc.assert(
      fc.property(statusHttp, fc.boolean(), (status, tinhaCredenciais) => {
        let resultado: AcaoAutorizarEntrada | undefined
        expect(() => {
          resultado = decidirAcaoAutorizarEntrada(status, tinhaCredenciais)
        }).not.toThrow()
        expect(resultado).not.toBeUndefined()
        expect(resultado).not.toBeNull()
        expect(ACOES_VALIDAS).toContain(resultado)
      }),
      { numRuns: 100 },
    )
  })

  it('para qualquer status 2xx, retorna SUCESSO independentemente de tinhaCredenciais', () => {
    fc.assert(
      fc.property(fc.integer({ min: 200, max: 299 }), fc.boolean(), (status, tinhaCredenciais) => {
        expect(decidirAcaoAutorizarEntrada(status, tinhaCredenciais)).toBe('SUCESSO')
      }),
      { numRuns: 100 },
    )
  })

  it('para status 422, retorna ABRIR_MODAL_CREDENCIAIS independentemente de tinhaCredenciais', () => {
    fc.assert(
      fc.property(fc.boolean(), (tinhaCredenciais) => {
        expect(decidirAcaoAutorizarEntrada(422, tinhaCredenciais)).toBe('ABRIR_MODAL_CREDENCIAIS')
      }),
      { numRuns: 100 },
    )
  })

  it('para status 401 com tinhaCredenciais true, retorna ERRO_CREDENCIAIS_INVALIDAS', () => {
    expect(decidirAcaoAutorizarEntrada(401, true)).toBe('ERRO_CREDENCIAIS_INVALIDAS')
  })

  it('para status 401 com tinhaCredenciais false, retorna ERRO_GENERICO (não havia credenciais a serem inválidas)', () => {
    expect(decidirAcaoAutorizarEntrada(401, false)).toBe('ERRO_GENERICO')
  })

  it('para qualquer outro status (não 2xx, não 422, não (401 e tinhaCredenciais)), retorna ERRO_GENERICO', () => {
    fc.assert(
      fc.property(statusHttp, fc.boolean(), (status, tinhaCredenciais) => {
        const eh2xx = status >= 200 && status < 300
        const eh422 = status === 422
        const eh401ComCredenciais = status === 401 && tinhaCredenciais
        fc.pre(!eh2xx && !eh422 && !eh401ComCredenciais)

        expect(decidirAcaoAutorizarEntrada(status, tinhaCredenciais)).toBe('ERRO_GENERICO')
      }),
      { numRuns: 100 },
    )
  })

  it('exclusividade mútua: exatamente uma das quatro condições de classificação é satisfeita para qualquer par (status, tinhaCredenciais)', () => {
    fc.assert(
      fc.property(statusHttp, fc.boolean(), (status, tinhaCredenciais) => {
        const eh2xx = status >= 200 && status < 300
        const eh422 = status === 422
        const eh401ComCredenciais = status === 401 && tinhaCredenciais
        const condicoes = [
          eh2xx,
          eh422 && !eh2xx,
          eh401ComCredenciais && !eh422 && !eh2xx,
          !eh2xx && !eh422 && !eh401ComCredenciais,
        ]
        const totalSatisfeitas = condicoes.filter(Boolean).length

        expect(totalSatisfeitas).toBe(1)
      }),
      { numRuns: 100 },
    )
  })

  it('determinismo: chamar a função duas vezes com o mesmo status e tinhaCredenciais produz sempre o mesmo resultado', () => {
    fc.assert(
      fc.property(statusHttp, fc.boolean(), (status, tinhaCredenciais) => {
        const primeiraChamada = decidirAcaoAutorizarEntrada(status, tinhaCredenciais)
        const segundaChamada = decidirAcaoAutorizarEntrada(status, tinhaCredenciais)
        expect(segundaChamada).toBe(primeiraChamada)
      }),
      { numRuns: 100 },
    )
  })
})

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children)
  }
}

describe('useAutorizarEntrada', () => {
  // Feature: melhorias-compras-wms-fiscal-frontend, Task 9.4 — fluxo completo
  // de autorizar entrada (hook useAutorizarEntrada)
  // Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 10.8, 11.1, 11.2

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('primeira tentativa sem credenciais: sucesso direto não abre o modal e invalida queries', async () => {
    mockedApi.post.mockResolvedValueOnce({ data: { ok: true } })
    const onInvalidateQueries = vi.fn()

    const { result } = renderHook(() => useAutorizarEntrada({ onInvalidateQueries }), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.autorizar('ag1')
    })

    await waitFor(() => expect(onInvalidateQueries).toHaveBeenCalledTimes(1))

    expect(result.current.modalAberto).toBe(false)
    expect(mockedApi.post).toHaveBeenCalledTimes(1)
    expect(mockedApi.post).toHaveBeenCalledWith('/portaria/autorizar-entrada/ag1', {})
  })

  it('abre o modal quando a primeira tentativa retorna 422', async () => {
    mockedApi.post.mockRejectedValueOnce({
      response: { status: 422, data: { message: 'Credenciais exigidas' } },
    })

    const { result } = renderHook(() => useAutorizarEntrada(), { wrapper: createWrapper() })

    act(() => {
      result.current.autorizar('ag1')
    })

    await waitFor(() => expect(result.current.modalAberto).toBe(true))
  })

  it('reenvio com credenciais válidas após 422: sucesso fecha o modal e invalida queries', async () => {
    mockedApi.post.mockRejectedValueOnce({
      response: { status: 422, data: { message: 'Credenciais exigidas' } },
    })
    const onInvalidateQueries = vi.fn()

    const { result } = renderHook(() => useAutorizarEntrada({ onInvalidateQueries }), {
      wrapper: createWrapper(),
    })

    act(() => {
      result.current.autorizar('ag1')
    })
    await waitFor(() => expect(result.current.modalAberto).toBe(true))

    mockedApi.post.mockResolvedValueOnce({ data: { ok: true } })

    await act(async () => {
      await result.current.confirmarComCredenciais({ usuario: 'super', senha: '123' })
    })

    expect(result.current.modalAberto).toBe(false)
    expect(onInvalidateQueries).toHaveBeenCalledTimes(1)
  })

  it('reenvio com credenciais inválidas (401): lança erro e mantém o modal aberto', async () => {
    mockedApi.post.mockRejectedValueOnce({
      response: { status: 422, data: { message: 'Credenciais exigidas' } },
    })

    const { result } = renderHook(() => useAutorizarEntrada(), { wrapper: createWrapper() })

    act(() => {
      result.current.autorizar('ag1')
    })
    await waitFor(() => expect(result.current.modalAberto).toBe(true))

    mockedApi.post.mockRejectedValueOnce({ response: { status: 401 } })

    await act(async () => {
      await expect(
        result.current.confirmarComCredenciais({ usuario: 'super', senha: 'errada' })
      ).rejects.toBeTruthy()
    })

    expect(result.current.modalAberto).toBe(true)
  })

  it('erro genérico (500) na primeira tentativa: modal nunca abre e nenhuma exceção propaga', async () => {
    mockedApi.post.mockRejectedValueOnce({ response: { status: 500 } })

    const { result } = renderHook(() => useAutorizarEntrada(), { wrapper: createWrapper() })

    expect(() => {
      act(() => {
        result.current.autorizar('ag1')
      })
    }).not.toThrow()

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledTimes(1))

    expect(result.current.modalAberto).toBe(false)
  })

  it('erro genérico (404) na primeira tentativa: modal nunca abre', async () => {
    mockedApi.post.mockRejectedValueOnce({ response: { status: 404 } })

    const { result } = renderHook(() => useAutorizarEntrada(), { wrapper: createWrapper() })

    act(() => {
      result.current.autorizar('ag1')
    })

    await waitFor(() => expect(mockedApi.post).toHaveBeenCalledTimes(1))
    expect(result.current.modalAberto).toBe(false)
  })

  it('cancelamento do modal: fecharModal fecha o modal sem disparar nenhum novo reenvio', async () => {
    mockedApi.post.mockRejectedValueOnce({
      response: { status: 422, data: { message: 'Credenciais exigidas' } },
    })

    const { result } = renderHook(() => useAutorizarEntrada(), { wrapper: createWrapper() })

    act(() => {
      result.current.autorizar('ag1')
    })
    await waitFor(() => expect(result.current.modalAberto).toBe(true))

    const chamadasAntesDeFechar = mockedApi.post.mock.calls.length

    act(() => {
      result.current.fecharModal()
    })

    expect(result.current.modalAberto).toBe(false)
    expect(mockedApi.post).toHaveBeenCalledTimes(chamadasAntesDeFechar)
  })
})
