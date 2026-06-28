import axios from 'axios'

export const portalApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api',
  withCredentials: true, // ← Envia cookies httpOnly
})

portalApi.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('visiofab-portal-token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// ── Segurança: Limpar token expirado e redirecionar ──
portalApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      const currentPath = window.location.pathname
      if (currentPath !== '/portal/login') {
        localStorage.removeItem('visiofab-portal-token')
        window.location.href = '/portal/login'
      }
    }
    return Promise.reject(error)
  }
)
