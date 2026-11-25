/**
 * Estado global do backend durante deploy/atualização de versão.
 *
 * Quando o backend está sendo publicado (Render) as chamadas falham com 502/503/504
 * ou "Network Error" (a página de erro do proxy não traz CORS). Em vez de mostrar
 * erro em cada tela, este módulo:
 *  1. confirma a indisponibilidade consultando GET /api/health (evita falso alarme);
 *  2. publica o estado "atualizando" (a UI mostra "Aguarde, atualizando versão…");
 *  3. espera o backend voltar (health OK) e repete automaticamente as consultas (GET).
 *
 * Só GET/HEAD são repetidos: POST/PUT/PATCH/DELETE NUNCA são reenviados sozinhos
 * (poderiam duplicar um lançamento); nesses casos o erro segue para a tela.
 */
import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios'

export type EstadoBackend = 'ok' | 'atualizando' | 'demorando'

const INTERVALO_SONDA_MS = 3000
/** Depois deste tempo as requisições pendentes desistem (o aviso continua até voltar). */
const LIMITE_ESPERA_REQUISICAO_MS = 5 * 60 * 1000
/** A partir daqui o aviso muda para "está demorando" e oferece recarregar. */
const LIMITE_AVISO_DEMORA_MS = 90 * 1000

let estado: EstadoBackend = 'ok'
let desde = 0
const ouvintes = new Set<() => void>()
let esperaCompartilhada: Promise<boolean> | null = null

function definirEstado(novo: EstadoBackend) {
  if (estado === novo) return
  estado = novo
  if (novo === 'atualizando' && desde === 0) desde = Date.now()
  if (novo === 'ok') desde = 0
  ouvintes.forEach((f) => f())
}

// ── API para o componente de aviso (useSyncExternalStore) ────────────────────
export function assinarEstadoBackend(f: () => void): () => void {
  ouvintes.add(f)
  return () => { ouvintes.delete(f) }
}
export function lerEstadoBackend(): EstadoBackend { return estado }
export function lerEstadoBackendServidor(): EstadoBackend { return 'ok' }
export function segundosDesdeIndisponivel(): number {
  return desde ? Math.floor((Date.now() - desde) / 1000) : 0
}

// ── Detecção ─────────────────────────────────────────────────────────────────
/** Erro típico de backend fora/subindo: sem resposta (rede/CORS do proxy) ou 502/503/504. */
export function pareceBackendIndisponivel(error: AxiosError): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false // sem internet do usuário
  if (error.code === 'ERR_CANCELED') return false
  const status = error.response?.status
  if (status === undefined) return true
  return status === 502 || status === 503 || status === 504
}

/** true = backend respondeu saudável. Qualquer falha/timeout = não saudável. */
async function backendSaudavel(urlHealth: string): Promise<boolean> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), 5000)
  try {
    // Parâmetro único: nunca reaproveita resposta em cache (navegador ou Service Worker).
    const url = `${urlHealth}${urlHealth.includes('?') ? '&' : '?'}_=${Date.now()}`
    const r = await fetch(url, { cache: 'no-store', signal: ctrl.signal })
    return r.ok
  } catch {
    return false
  } finally {
    clearTimeout(t)
  }
}

/**
 * Espera o backend voltar. Compartilhada: várias requisições falhando juntas
 * usam a MESMA espera (uma única sonda a cada 3 s). Resolve true quando volta;
 * false se passar o limite das requisições (o aviso continua em segundo plano).
 */
function aguardarBackend(urlHealth: string): Promise<boolean> {
  if (esperaCompartilhada) return esperaCompartilhada
  definirEstado('atualizando')
  const inicio = Date.now()
  esperaCompartilhada = new Promise<boolean>((resolver) => {
    let resolvido = false
    const tick = async () => {
      if (await backendSaudavel(urlHealth)) {
        definirEstado('ok')
        esperaCompartilhada = null
        if (!resolvido) { resolvido = true; resolver(true) }
        return
      }
      const passou = Date.now() - inicio
      if (passou > LIMITE_AVISO_DEMORA_MS) definirEstado('demorando')
      if (passou > LIMITE_ESPERA_REQUISICAO_MS && !resolvido) { resolvido = true; resolver(false) }
      setTimeout(tick, INTERVALO_SONDA_MS) // continua até voltar, para o aviso sumir sozinho
    }
    setTimeout(tick, INTERVALO_SONDA_MS)
  })
  return esperaCompartilhada
}

type ConfigComTentativa = InternalAxiosRequestConfig & { _tentativaAtualizacao?: number }

/**
 * Instala o tratamento numa instância do axios. `urlHealth` = GET /api/health do backend.
 * Deve ser registrado DEPOIS dos outros interceptores de resposta (401/refresh).
 */
export function instalarTratamentoAtualizacao(instancia: AxiosInstance, urlHealth: string): void {
  instancia.interceptors.response.use(undefined, async (error: AxiosError) => {
    const cfg = error.config as ConfigComTentativa | undefined
    if (!cfg || typeof window === 'undefined' || !pareceBackendIndisponivel(error)) return Promise.reject(error)

    // Se o backend está de pé, o erro é outro (CORS, rede do cliente etc.): não é "atualização".
    if (estado === 'ok' && (await backendSaudavel(urlHealth))) return Promise.reject(error)

    const voltou = await aguardarBackend(urlHealth)
    const metodo = (cfg.method || 'get').toLowerCase()
    const seguro = metodo === 'get' || metodo === 'head'
    if (voltou && seguro && (cfg._tentativaAtualizacao ?? 0) < 2) {
      cfg._tentativaAtualizacao = (cfg._tentativaAtualizacao ?? 0) + 1
      return instancia(cfg)
    }
    return Promise.reject(error)
  })
}
