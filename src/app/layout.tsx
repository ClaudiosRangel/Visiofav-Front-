import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@mantine/dates/styles.css'
import '@mantine/dropzone/styles.css'
import './globals.css'

import { ColorSchemeScript } from '@mantine/core'

export const metadata = {
  title: {
    template: 'Vizor - %s',
    default: 'Vizor',
  },
  description: 'Sistema de Gerenciamento de Armazém',
}

/**
 * Layout raiz — mantém apenas <html>/<body>, estilos globais e o
 * ColorSchemeScript do Mantine.
 *
 * Os providers do ERP (tema, empresa, preferências, React Query, etc.) NÃO
 * vivem aqui: cada grupo de rotas do ERP os monta via <ErpProviders> em seu
 * próprio layout. Isso mantém o grupo (portal-rep) — que tem sua própria
 * stack de providers — livre do EmpresaProvider do ERP, que redirecionava
 * indevidamente para /login ao abrir o Portal do Representante.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="auto" />
      </head>
      <body>{children}</body>
    </html>
  )
}
