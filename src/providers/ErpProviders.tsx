'use client'

import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'
import { QueryProvider } from '@/providers/QueryProvider'
import { EmpresaProvider } from '@/providers/EmpresaProvider'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { PreferencesProvider } from '@/providers/PreferencesProvider'
import BackendAtualizandoAviso from '@/components/BackendAtualizandoAviso'
import ReloginModal from '@/components/ReloginModal'

/**
 * Providers do ERP Vizor (tema, modais, notificações, React Query, empresa
 * selecionada e preferências do usuário).
 *
 * IMPORTANTE: este conjunto de providers é específico do ERP e NÃO deve
 * envolver o Portal do Representante (grupo de rotas `(portal-rep)`), que
 * possui sua própria stack de providers (QueryClient + MantineProvider com
 * tema próprio) em `(portal-rep)/layout.tsx`.
 *
 * O `EmpresaProvider`, ao montar, dispara `GET /empresas/minhas` usando o
 * `api` global do ERP (token `visiofab-wms-token`). Quando montado no portal
 * do representante — que usa outro token (`portal-rep-token`) — essa chamada
 * responde 401 e o interceptor do axios redireciona para `/login`, tirando o
 * usuário do portal. Por isso os providers do ERP vivem nos layouts de cada
 * grupo do ERP, e não no RootLayout global.
 */
export function ErpProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <ModalsProvider>
        <Notifications position="top-right" autoClose={4000} />
        {/* Aviso global "Aguarde, atualizando versão…" quando o backend está sendo publicado. */}
        <BackendAtualizandoAviso />
        {/* Sessão expirada: pede a senha por cima da tela, sem perder o que foi digitado. */}
        <ReloginModal />
        <QueryProvider>
          <EmpresaProvider>
            <PreferencesProvider>{children}</PreferencesProvider>
          </EmpresaProvider>
        </QueryProvider>
      </ModalsProvider>
    </ThemeProvider>
  )
}
