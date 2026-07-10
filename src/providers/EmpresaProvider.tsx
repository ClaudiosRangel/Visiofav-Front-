'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { podeTrocarEmpresa as calcularPodeTrocarEmpresa } from '@/app/(interna)/selecionar-empresa/selecaoEmpresa.utils'

interface Empresa {
  id: string
  razaoSocial: string
  nomeFantasia: string | null
  cnpj: string
}

interface EmpresaContextType {
  empresa: Empresa | null
  modulos: string[]
  loading: boolean
  podeTrocarEmpresa: boolean
  selecionarEmpresa: (empresa: Empresa) => Promise<void>
  trocarEmpresa: () => void
  logout: () => Promise<void>
}

const EmpresaContext = createContext<EmpresaContextType | null>(null)

const STORAGE_KEY_EMPRESA = 'visiofab-wms-empresa'
const STORAGE_KEY_TOKEN = 'visiofab-wms-token'

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [modulos, setModulos] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  // Reaproveita a mesma queryKey usada pela página de seleção de empresa,
  // evitando refetch duplicado via cache do TanStack Query (Requirement 1.7).
  const { data: empresasMinhas, isLoading: isLoadingEmpresasMinhas } = useQuery<unknown[]>({
    queryKey: ['empresas-minhas'],
    queryFn: async () => {
      const { data } = await api.get('/empresas/minhas')
      return Array.isArray(data) ? data : [data]
    },
  })

  // Fail-safe: enquanto a contagem não foi carregada, assume-se que a troca
  // de empresa é possível (preferimos mostrar o controle a escondê-lo indevidamente).
  const podeTrocarEmpresaValue = isLoadingEmpresasMinhas
    ? true
    : calcularPodeTrocarEmpresa(empresasMinhas?.length ?? 0)

  // Carregar empresa salva no localStorage ao montar
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY_EMPRESA)
    if (saved) {
      try {
        const emp = JSON.parse(saved) as Empresa
        setEmpresa(emp)
        // Buscar módulos
        api.get(`/empresas/${emp.id}/modulos`)
          .then((res) => setModulos(res.data.modulos ?? []))
          .catch(() => setModulos([]))
          .finally(() => setLoading(false))
      } catch {
        localStorage.removeItem(STORAGE_KEY_EMPRESA)
        setLoading(false)
      }
    } else {
      setLoading(false)
    }
  }, [])

  const selecionarEmpresa = useCallback(
    async (emp: Empresa) => {
      try {
        // Obter token com empresaId
        const { data } = await api.post(`/empresas/${emp.id}/selecionar`, {})
        if (data.token) {
          localStorage.setItem(STORAGE_KEY_TOKEN, data.token)
        }
        if (data.refreshToken) {
          localStorage.setItem('visiofab-wms-refresh-token', data.refreshToken)
        }

        // Buscar módulos com o novo token
        const modulosResp = await api.get(`/empresas/${emp.id}/modulos`)

        // Salvar no state e localStorage
        setEmpresa(emp)
        setModulos(modulosResp.data.modulos ?? [])
        localStorage.setItem(STORAGE_KEY_EMPRESA, JSON.stringify(emp))
      } catch (err) {
        console.error('Erro ao selecionar empresa:', err)
        throw err
      }
    },
    [],
  )

  const trocarEmpresa = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY_EMPRESA)
    setEmpresa(null)
    setModulos([])
    router.push('/selecionar-empresa')
  }, [router])

  // ── Segurança: Logout limpa todos os tokens ──
  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', {
        refreshToken: localStorage.getItem('visiofab-wms-refresh-token'),
      })
    } catch { /* silenciar — limpar localmente mesmo se API falhar */ }

    localStorage.removeItem(STORAGE_KEY_TOKEN)
    localStorage.removeItem(STORAGE_KEY_EMPRESA)
    localStorage.removeItem('visiofab-wms-user')
    localStorage.removeItem('visiofab-wms-refresh-token')
    setEmpresa(null)
    setModulos([])
    router.push('/login')
  }, [router])

  return (
    <EmpresaContext.Provider
      value={{
        empresa,
        modulos,
        loading,
        podeTrocarEmpresa: podeTrocarEmpresaValue,
        selecionarEmpresa,
        trocarEmpresa,
        logout,
      }}
    >
      {children}
    </EmpresaContext.Provider>
  )
}

export function useEmpresa() {
  const context = useContext(EmpresaContext)
  if (!context) {
    throw new Error('useEmpresa deve ser usado dentro de um EmpresaProvider')
  }
  return context
}
