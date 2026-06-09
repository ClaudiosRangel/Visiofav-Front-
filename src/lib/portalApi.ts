import axios from 'axios'

export const portalApi = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api',
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
