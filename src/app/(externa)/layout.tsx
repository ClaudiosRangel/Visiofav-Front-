import { ErpProviders } from '@/providers/ErpProviders'

export default function ExternaLayout({ children }: { children: React.ReactNode }) {
  return <ErpProviders>{children}</ErpProviders>
}
