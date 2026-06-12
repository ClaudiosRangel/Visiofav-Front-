import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@mantine/dates/styles.css'
import './globals.css'

import { ColorSchemeScript, MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { ModalsProvider } from '@mantine/modals'
import { theme } from '@/theme'
import { QueryProvider } from '@/providers/QueryProvider'
import { EmpresaProvider } from '@/providers/EmpresaProvider'

export const metadata = {
  title: {
    template: 'Vizor - %s',
    default: 'Vizor',
  },
  description: 'Sistema de Gerenciamento de Armazém',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <ColorSchemeScript defaultColorScheme="light" />
      </head>
      <body>
        <MantineProvider theme={theme} defaultColorScheme="light">
          <ModalsProvider>
            <Notifications position="top-right" autoClose={4000} />
            <QueryProvider>
              <EmpresaProvider>{children}</EmpresaProvider>
            </QueryProvider>
          </ModalsProvider>
        </MantineProvider>
      </body>
    </html>
  )
}
