'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

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
  selecionarEmpresa: (empresa: Empresa) => Promise<void>
  trocarEmpresa: () => void
}

const EmpresaContext = createContext<EmpresaContextType | null>(null)

const STORAGE_KEY_EMPRESA = 'visiofab-wms-empresa'
const STORAGE_KEY_TOKEN = 'visiofab-wms-token'

export function EmpresaProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [modulos, setModulos] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

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

  return (
    <EmpresaContext.Provider value={{ empresa, modulos, loading, selecionarEmpresa, trocarEmpresa }}>
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
