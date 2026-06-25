import axios from 'axios'

export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api',
})

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('visiofab-wms-token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      // Token expirado ou inválido — limpar e redirecionar ao login
      const currentPath = window.location.pathname
      if (currentPath !== '/login') {
        localStorage.removeItem('visiofab-wms-token')
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)
