import axios, { AxiosError } from 'axios'
import { instalarTratamentoAtualizacao } from './backend-status'
import { podeRelogar, solicitarRelogin } from './relogin'
import {
  getAuthToken,
  setAuthToken,
  getRefreshToken,
  setRefreshToken,
  clearAuthSession,
} from './authStorage'

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api',
  // NÃO enviar cookies: o cookie de auth é GLOBAL por domínio e faria abas de
  // empresas diferentes colidirem (o backend aceita cookie como fallback).
  // O isolamento por aba depende do header Authorization vindo do
  // sessionStorage (ver authStorage.ts). O token no header é a única fonte.
  withCredentials: false,
})

// Flag para evitar loop infinito de refresh
let isRefreshing = false
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: Error) => void }> = []

function processQueue(error: Error | null, token: string | null) {
  failedQueue.forEach((p) => {
    if (error) {
      p.reject(error)
    } else {
      p.resolve(token!)
    }
  })
  failedQueue = []
}

// === Token Keep-Alive: renova proativamente enquanto o usuário estiver usando ===
// Regra: enquanto a tela está em uso, a sessão NÃO expira. O access token dura 60 min; renovamos
// a cada 4 min quando houve uso nos últimos 30 min (e sempre nas telas do PCP, ex.: painel na TV),
// e também ao voltar para a aba/computador quando o token está perto de vencer.
// Se a aba não tem refresh token (storage limpo por outra aba, sessão antiga), renova pelo próprio
// access token ainda válido (`POST /auth/renovar`) — antes, nesse caso, nada era renovado e a
// sessão vencia no meio do trabalho ("Refresh token não fornecido").
let keepAliveInterval: ReturnType<typeof setInterval> | null = null
let lastActivity = Date.now()
let renovando: Promise<boolean> | null = null

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api'
const JANELA_USO_MS = 30 * 60 * 1000
const PERTO_DE_VENCER_MS = 15 * 60 * 1000

/** Validade (ms epoch) do access token, lida do JWT; null se não der para ler. */
function expiracaoDoToken(token: string | null): number | null {
  if (!token) return null
  try {
    const parte = token.split('.')[1]
    const json = JSON.parse(atob(parte.replace(/-/g, '+').replace(/_/g, '/')))
    return typeof json.exp === 'number' ? json.exp * 1000 : null
  } catch {
    return null
  }
}

/** Renova a sessão desta aba. Tenta o refresh token; sem ele (ou se falhar), o access token válido. */
export function renovarSessao(): Promise<boolean> {
  if (renovando) return renovando
  renovando = (async () => {
    const refreshToken = getRefreshToken()
    if (refreshToken) {
      try {
        const { data } = await axios.post(`${API_BASE}/auth/refresh`, { refreshToken })
        // Grava só na sessão DESTA aba (e semente) — não migra outras abas.
        if (data.token) setAuthToken(data.token)
        if (data.refreshToken) setRefreshToken(data.refreshToken)
        if (data.token) return true
      } catch {
        // cai para a renovação pelo access token
      }
    }
    const token = getAuthToken()
    const exp = expiracaoDoToken(token)
    if (!token || (exp !== null && exp <= Date.now())) return false
    try {
      const { data } = await axios.post(`${API_BASE}/auth/renovar`, {}, { headers: { Authorization: `Bearer ${token}` } })
      if (data.token) setAuthToken(data.token)
      if (data.refreshToken) setRefreshToken(data.refreshToken)
      return Boolean(data.token)
    } catch {
      return false
    }
  })().finally(() => {
    renovando = null
  })
  return renovando
}

function startTokenKeepAlive() {
  if (typeof window === 'undefined') return
  if (keepAliveInterval) return // Já está rodando

  // Detectar uso da tela (digitar, clicar, rolar, mover o mouse, focar campos).
  const updateActivity = () => { lastActivity = Date.now() }
  for (const ev of ['mousemove', 'keydown', 'click', 'touchstart', 'scroll', 'wheel', 'input', 'focusin']) {
    window.addEventListener(ev, updateActivity, { passive: true, capture: true })
  }

  const emUso = () => window.location.pathname.startsWith('/pcp') || Date.now() - lastActivity <= JANELA_USO_MS

  keepAliveInterval = setInterval(() => {
    if (window.location.pathname === '/login' || !emUso()) return
    void renovarSessao()
  }, 4 * 60 * 1000)

  // Voltou para a aba / acordou o computador: se o token está perto de vencer, renova na hora.
  const aoVoltar = () => {
    if (document.visibilityState !== 'visible' || window.location.pathname === '/login') return
    const exp = expiracaoDoToken(getAuthToken())
    if (exp === null || exp - Date.now() < PERTO_DE_VENCER_MS) {
      lastActivity = Date.now()
      void renovarSessao()
    }
  }
  document.addEventListener('visibilitychange', aoVoltar)
  window.addEventListener('focus', aoVoltar)
}

// Iniciar keep-alive no carregamento do módulo
if (typeof window !== 'undefined') {
  startTokenKeepAlive()
}

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    // Token isolado POR ABA (sessionStorage) — impede que a troca de empresa
    // em outra aba altere a empresa desta requisição (ver authStorage.ts).
    const token = getAuthToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

api.interceptors.response.use(
  (response) => {
    // Proteger contra respostas HTML acidentais (ex: página de erro do servidor)
    if (typeof response.data === 'string' && response.data.includes('<!DOCTYPE') || 
        typeof response.data === 'string' && response.data.includes('<html')) {
      return Promise.reject(new Error('Servidor retornou resposta inesperada. Tente novamente.'))
    }
    return response
  },
  async (error: AxiosError) => {
    const originalRequest = error.config as any

    // Se recebeu 401 e não é a rota de refresh e não estamos já fazendo refresh
    if (error.response?.status === 401 && !originalRequest._retry && typeof window !== 'undefined') {
      const currentPath = window.location.pathname
      if (currentPath === '/login') {
        return Promise.reject(error)
      }

      // Tentar renovar o token via refresh
      if (isRefreshing) {
        // Já está refreshing — enfileirar esta request
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return api(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const refreshToken = getRefreshToken()

        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api'}/auth/refresh`,
          { refreshToken },
        )

        // Salvar novo access token (apenas na sessão DESTA aba + semente).
        if (data.token) {
          setAuthToken(data.token)
        }
        if (data.refreshToken) {
          setRefreshToken(data.refreshToken)
        }

        // Processar fila de requests pendentes
        processQueue(null, data.token)

        // Refazer a request original com novo token
        originalRequest.headers.Authorization = `Bearer ${data.token}`
        return api(originalRequest)
      } catch (refreshError) {
        // Refresh falhou. Se a tela tem o modal "Sua sessão expirou", pede a senha POR CIMA da
        // página e refaz a requisição — sem recarregar e sem perder o que foi digitado.
        if (podeRelogar()) {
          try {
            const novoToken = await solicitarRelogin()
            processQueue(null, novoToken)
            originalRequest.headers.Authorization = `Bearer ${novoToken}`
            return api(originalRequest)
          } catch {
            // Usuário desistiu: segue o fluxo antigo abaixo.
          }
        }
        // Refresh falhou — limpar tudo e redirecionar ao login
        processQueue(refreshError as Error, null)
        clearAuthSession()
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)

// Deploy do backend: em vez de erro, mostra "Aguarde, atualizando versão…" e repete as consultas (GET)
// quando o backend voltar. Registrado DEPOIS do interceptor de 401/refresh acima.
instalarTratamentoAtualizacao(
  api,
  `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api'}/health`,
)
