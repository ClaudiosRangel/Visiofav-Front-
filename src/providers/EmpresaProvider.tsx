'use client'

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { podeTrocarEmpresa as calcularPodeTrocarEmpresa } from '@/app/(interna)/selecionar-empresa/selecaoEmpresa.utils'
import { fecharTodasAbasModulo } from '@/lib/abasModulo'

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
  const queryClient = useQueryClient()
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

  // ── Segurança: sincronizar troca/logout de empresa entre abas ──
  // Cada módulo é aberto em uma aba própria (ver abasModulo.ts), mas
  // localStorage é compartilhado por TODAS as abas da mesma origem — só o
  // token (usado pelo interceptor do axios em cada requisição) é atualizado
  // globalmente ao trocar de empresa. O state React (`empresa`, `modulos`)
  // de uma aba já aberta ficava com a empresa ANTIGA na tela, enquanto toda
  // nova requisição feita a partir dessa mesma aba já usava o token da
  // empresa NOVA — causando o bug de "cadastro na empresa X aparece em Y"
  // quando o usuário trocava de empresa em uma aba enquanto outra aba de
  // módulo permanecia aberta com a UI desatualizada.
  //
  // O evento `storage` do navegador dispara em todas as OUTRAS abas quando
  // uma delas altera o localStorage (nunca na aba que fez a alteração) —
  // por isso é o mecanismo certo aqui: assim que outra aba troca de empresa
  // ou faz logout, esta aba recarrega a página, garantindo que a UI e o
  // token fiquem sempre consistentes antes de qualquer nova requisição.
  useEffect(() => {
    function handleStorageChange(e: StorageEvent) {
      if (e.key !== STORAGE_KEY_EMPRESA && e.key !== STORAGE_KEY_TOKEN) return
      window.location.reload()
    }
    window.addEventListener('storage', handleStorageChange)
    return () => window.removeEventListener('storage', handleStorageChange)
  }, [])

  const selecionarEmpresa = useCallback(
    async (emp: Empresa) => {
      try {
        // ── Segurança: limpar TODO o cache do TanStack Query ANTES de trocar
        // de empresa — evita que dados em cache de uma empresa anterior
        // (produtos, fornecedores, clientes, etc.) sejam exibidos por engano
        // após a seleção da nova empresa, já que as queryKeys desses hooks
        // não incluem o empresaId e o cache poderia servir dados "stale" da
        // empresa anterior dentro da janela de staleTime/gcTime.
        queryClient.clear()

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
    [queryClient],
  )

  const trocarEmpresa = useCallback(() => {
    // ── Segurança: limpar o cache do TanStack Query ao trocar de empresa,
    // pelo mesmo motivo descrito em selecionarEmpresa — nenhum dado da
    // empresa anterior deve permanecer acessível após a troca.
    queryClient.clear()
    // Fecha todas as abas de módulo abertas pela empresa anterior — evita
    // que uma aba deixada aberta continue mostrando dados/ações da empresa
    // que o usuário acabou de trocar.
    fecharTodasAbasModulo()
    localStorage.removeItem(STORAGE_KEY_EMPRESA)
    setEmpresa(null)
    setModulos([])
    router.push('/selecionar-empresa')
  }, [router, queryClient])

  // ── Segurança: Logout limpa todos os tokens e o cache do TanStack Query ──
  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', {
        refreshToken: localStorage.getItem('visiofab-wms-refresh-token'),
      })
    } catch { /* silenciar — limpar localmente mesmo se API falhar */ }

    queryClient.clear()
    // Fecha todas as abas de módulo abertas — nenhuma aba deve continuar
    // acessível/exibindo dados depois que o usuário saiu do sistema.
    fecharTodasAbasModulo()
    localStorage.removeItem(STORAGE_KEY_TOKEN)
    localStorage.removeItem(STORAGE_KEY_EMPRESA)
    localStorage.removeItem('visiofab-wms-user')
    localStorage.removeItem('visiofab-wms-refresh-token')
    setEmpresa(null)
    setModulos([])
    router.push('/login')
  }, [router, queryClient])

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
