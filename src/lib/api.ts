import axios, { AxiosError } from 'axios'

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api',
  withCredentials: true, // ← Envia cookies httpOnly em todas as requests
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

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    // Backward compatibility: enviar token via header (mobile, localStorage)
    const token = localStorage.getItem('visiofab-wms-token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
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
        const refreshToken = localStorage.getItem('visiofab-wms-refresh-token')

        const { data } = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api'}/auth/refresh`,
          { refreshToken },
          { withCredentials: true }
        )

        // Salvar novo access token
        if (data.token) {
          localStorage.setItem('visiofab-wms-token', data.token)
        }
        if (data.refreshToken) {
          localStorage.setItem('visiofab-wms-refresh-token', data.refreshToken)
        }

        // Processar fila de requests pendentes
        processQueue(null, data.token)

        // Refazer a request original com novo token
        originalRequest.headers.Authorization = `Bearer ${data.token}`
        return api(originalRequest)
      } catch (refreshError) {
        // Refresh falhou — limpar tudo e redirecionar ao login
        processQueue(refreshError as Error, null)
        localStorage.removeItem('visiofab-wms-token')
        localStorage.removeItem('visiofab-wms-refresh-token')
        window.location.href = '/login'
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  }
)
