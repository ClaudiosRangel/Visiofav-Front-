import axios, { AxiosError } from 'axios'

const STORAGE_KEY_TOKEN = 'portal-rep-token'
const STORAGE_KEY_REFRESH = 'portal-rep-refresh-token'

export const portalRepApi = axios.create({
  baseURL: `${process.env.NEXT_PUBLIC_API_URL || 'https://api.vizorerp.com.br/api'}/portal-rep`,
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

// Interceptor de request: adiciona Authorization header
portalRepApi.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem(STORAGE_KEY_TOKEN)
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// Interceptor de response: trata 401 (refresh), 403 SENHA_TEMPORARIA
portalRepApi.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any

    if (typeof window === 'undefined') {
      return Promise.reject(error)
    }

    // 403 com código SENHA_TEMPORARIA → redireciona para trocar senha
    if (error.response?.status === 403) {
      const data = error.response.data as any
      if (data?.code === 'SENHA_TEMPORARIA') {
        window.location.href = '/portal-rep/trocar-senha'
        return Promise.reject(error)
      }
    }

    // 401 → tenta refresh (exceto se já é a rota de refresh)
    if (error.response?.status === 401 && !originalRequest._retry) {
      const requestUrl = originalRequest?.url || ''
      // Não tentar refresh se a própria rota de refresh retornou 401
      if (requestUrl.includes('/auth/refresh')) {
        localStorage.removeItem(STORAGE_KEY_TOKEN)
        localStorage.removeItem(STORAGE_KEY_REFRESH)
        window.location.href = '/portal-rep/login'
        return Promise.reject(error)
      }

      // Se já está refreshing, enfileira a request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`
            return portalRepApi(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        const refreshToken = localStorage.getItem(STORAGE_KEY_REFRESH)
        if (!refreshToken) {
          throw new Error('No refresh token available')
        }

        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api'}/portal-rep/auth/refresh`,
          { refreshToken },
        )

        // Armazena novos tokens
        if (data.token) {
          localStorage.setItem(STORAGE_KEY_TOKEN, data.token)
        }
        if (data.refreshToken) {
          localStorage.setItem(STORAGE_KEY_REFRESH, data.refreshToken)
        }

        // Processa fila de requests pendentes
        processQueue(null, data.token)

        // Replay da request original com novo token
        originalRequest.headers.Authorization = `Bearer ${data.token}`
        return portalRepApi(originalRequest)
      } catch (refreshError) {
        // Refresh falhou — limpa tokens e redireciona para login
        processQueue(refreshError as Error, null)
        localStorage.removeItem(STORAGE_KEY_TOKEN)
        localStorage.removeItem(STORAGE_KEY_REFRESH)
        window.location.href = '/portal-rep/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)
