import axios, { AxiosError } from 'axios'
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

// === Token Keep-Alive: renova proativamente enquanto o usuário estiver ativo ===
let keepAliveInterval: ReturnType<typeof setInterval> | null = null
let lastActivity = Date.now()

function startTokenKeepAlive() {
  if (typeof window === 'undefined') return
  if (keepAliveInterval) return // Já está rodando

  // Detectar atividade do usuário
  const updateActivity = () => { lastActivity = Date.now() }
  window.addEventListener('mousemove', updateActivity, { passive: true })
  window.addEventListener('keydown', updateActivity, { passive: true })
  window.addEventListener('click', updateActivity, { passive: true })
  window.addEventListener('touchstart', updateActivity, { passive: true })

  // A cada 4 minutos, se houve atividade nos últimos 5 min, renova token.
  // Exceção: páginas do PCP (ex: painel na TV) renovam SEMPRE, independente
  // de atividade do usuário — evita logout em telas de monitoramento.
  keepAliveInterval = setInterval(async () => {
    const inatividade = Date.now() - lastActivity
    const isPcp = typeof window !== 'undefined' && window.location.pathname.startsWith('/pcp')
    if (!isPcp && inatividade > 5 * 60 * 1000) return // Mais de 5 min sem uso — não renova (exceto PCP)

    const refreshToken = getRefreshToken()
    if (!refreshToken) return

    try {
      const { data } = await axios.post(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api'}/auth/refresh`,
        { refreshToken },
      )
      // Grava só na sessão DESTA aba (e semente) — não migra outras abas.
      if (data.token) setAuthToken(data.token)
      if (data.refreshToken) setRefreshToken(data.refreshToken)
    } catch {
      // Silencioso — o interceptor de 401 cuida se falhar
    }
  }, 4 * 60 * 1000) // A cada 4 minutos
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
