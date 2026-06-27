import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@mantine/dates/styles.css'
import './globals.css'

import { ColorSchemeScript } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { ModalsProvider } from '@mantine/modals'
import { QueryProvider } from '@/providers/QueryProvider'
import { EmpresaProvider } from '@/providers/EmpresaProvider'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { PreferencesProvider } from '@/providers/PreferencesProvider'

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
        <ColorSchemeScript defaultColorScheme="auto" />
      </head>
      <body>
        <ThemeProvider>
          <ModalsProvider>
            <Notifications position="top-right" autoClose={4000} />
            <QueryProvider>
              <EmpresaProvider>
                <PreferencesProvider>{children}</PreferencesProvider>
              </EmpresaProvider>
            </QueryProvider>
          </ModalsProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
