/**
 * Layout de rotas PÚBLICAS (sem autenticação) — grupo (publico).
 * Fornece APENAS o tema Mantine; NÃO monta EmpresaProvider/QueryProvider/auth
 * (que disparam GET /empresas/minhas e redirecionam para /login quando não há
 * token). Usado pela página pública de aprovação de arte do cliente.
 */
import { ThemeProvider } from '@/providers/ThemeProvider'

export default function PublicoLayout({ children }: { children: React.ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>
}
