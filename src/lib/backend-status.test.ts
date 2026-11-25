/**
 * Testes do aviso "Aguarde, atualizando versão…" (lib/backend-status.ts).
 * Rodar: npx vitest run src/lib/backend-status.test.ts --pool=threads
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { instalarTratamentoAtualizacao, lerEstadoBackend, pareceBackendIndisponivel } from './backend-status'

function criarInstancia() {
  let tratador: ((e: unknown) => Promise<unknown>) | null = null
  const reenvios: unknown[] = []
  const inst: any = vi.fn(async (cfg: unknown) => { reenvios.push(cfg); return { data: 'reenviado' } })
  inst.interceptors = { response: { use: (_ok: unknown, erro: (e: unknown) => Promise<unknown>) => { tratador = erro } } }
  instalarTratamentoAtualizacao(inst, 'https://api.exemplo/api/health')
  return { falhar: (e: unknown) => tratador!(e), reenvios }
}
const erro = (extra: Record<string, unknown> = {}) => ({ config: { method: 'get', url: '/x' }, code: 'ERR_NETWORK', ...extra })

describe('pareceBackendIndisponivel', () => {
  it('sem resposta (rede/CORS do proxy) → indisponível', () => {
    expect(pareceBackendIndisponivel(erro() as never)).toBe(true)
  })
  it('502, 503 e 504 → indisponível', () => {
    for (const status of [502, 503, 504]) {
      expect(pareceBackendIndisponivel(erro({ response: { status } }) as never)).toBe(true)
    }
  })
  it('erros de negócio (400, 401, 404, 500) → não é atualização', () => {
    for (const status of [400, 401, 404, 500]) {
      expect(pareceBackendIndisponivel(erro({ response: { status } }) as never)).toBe(false)
    }
  })
  it('requisição cancelada → não é atualização', () => {
    expect(pareceBackendIndisponivel(erro({ code: 'ERR_CANCELED' }) as never)).toBe(false)
  })
})

describe('instalarTratamentoAtualizacao', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })

  it('backend saudável → o erro segue para a tela e não mostra o aviso', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }))
    const { falhar } = criarInstancia()
    const e = erro()
    await expect(falhar(e)).rejects.toBe(e)
    expect(lerEstadoBackend()).toBe('ok')
  })

  it('backend fora e depois de volta → repete o GET e o aviso some', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false }) // confirmação inicial
      .mockResolvedValueOnce({ ok: false }) // 1ª sonda
      .mockResolvedValueOnce({ ok: true })  // 2ª sonda: voltou
    vi.stubGlobal('fetch', fetchMock)
    const { falhar, reenvios } = criarInstancia()
    const p = falhar(erro({ response: { status: 503 } }))
    await vi.advanceTimersByTimeAsync(0)
    expect(lerEstadoBackend()).toBe('atualizando')
    await vi.advanceTimersByTimeAsync(6100)
    await expect(p).resolves.toEqual({ data: 'reenviado' })
    expect(reenvios).toHaveLength(1)
    expect(lerEstadoBackend()).toBe('ok')
  })

  it('POST nunca é reenviado sozinho (evita duplicar lançamento)', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true })
    vi.stubGlobal('fetch', fetchMock)
    const { falhar, reenvios } = criarInstancia()
    const e = erro({ config: { method: 'post', url: '/x' }, response: { status: 502 } })
    const p = falhar(e)
    const assertion = expect(p).rejects.toBe(e)
    await vi.advanceTimersByTimeAsync(3100)
    await assertion
    expect(reenvios).toHaveLength(0)
    expect(lerEstadoBackend()).toBe('ok')
  })

  it('sem internet do usuário → não é "atualizando versão"', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    Object.defineProperty(window.navigator, 'onLine', { value: false, configurable: true })
    try {
      const { falhar } = criarInstancia()
      const e = erro()
      await expect(falhar(e)).rejects.toBe(e)
      expect(fetchMock).not.toHaveBeenCalled()
      expect(lerEstadoBackend()).toBe('ok')
    } finally {
      Object.defineProperty(window.navigator, 'onLine', { value: true, configurable: true })
    }
  })
})
