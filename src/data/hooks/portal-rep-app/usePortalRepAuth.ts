import { useMutation } from '@tanstack/react-query'
import { portalRepApi } from './portal-rep-api'
import type { LoginPayload, LoginResponse, TrocarSenhaPayload } from './types'

const STORAGE_KEY_TOKEN = 'portal-rep-token'
const STORAGE_KEY_REFRESH = 'portal-rep-refresh-token'

export function useLogin() {
  return useMutation<LoginResponse, Error, LoginPayload>({
    mutationFn: async (body) => {
      const { data } = await portalRepApi.post('/auth/login', body)
      return data
    },
    onSuccess: (data) => {
      localStorage.setItem(STORAGE_KEY_TOKEN, data.accessToken)
      localStorage.setItem(STORAGE_KEY_REFRESH, data.refreshToken)
    },
  })
}

export function useRefreshToken() {
  return useMutation<{ token: string; refreshToken: string }, Error, void>({
    mutationFn: async () => {
      const refreshToken = localStorage.getItem(STORAGE_KEY_REFRESH)
      if (!refreshToken) throw new Error('No refresh token available')
      const { data } = await portalRepApi.post('/auth/refresh', { refreshToken })
      return data
    },
    onSuccess: (data) => {
      localStorage.setItem(STORAGE_KEY_TOKEN, data.token)
      localStorage.setItem(STORAGE_KEY_REFRESH, data.refreshToken)
    },
  })
}

export function useTrocarSenha() {
  return useMutation<void, Error, TrocarSenhaPayload>({
    mutationFn: async (body) => {
      await portalRepApi.post('/auth/trocar-senha', body)
    },
  })
}

export function useLogout() {
  return {
    logout: () => {
      localStorage.removeItem(STORAGE_KEY_TOKEN)
      localStorage.removeItem(STORAGE_KEY_REFRESH)
      window.location.href = '/portal-rep/login'
    },
  }
}
