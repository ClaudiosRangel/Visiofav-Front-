import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  BloqueioFinanceiroAviso,
  resolverStatusBloqueio,
} from './BloqueioFinanceiroAviso'
import type { StatusFinanceiro } from '@/lib/financeiro-vizor/types'

const STATUS: StatusFinanceiro[] = ['ATIVO', 'SOMENTE_LEITURA', 'INATIVADO']

function renderComProviders(ui: React.ReactElement) {
  // `buscarDaSessao=false` via prop nos casos abaixo garante que nenhuma
  // requisição é disparada; ainda assim envolvemos com QueryClient para
  // satisfazer o `useQuery` do componente.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MantineProvider>{ui}</MantineProvider>
    </QueryClientProvider>,
  )
}

describe('resolverStatusBloqueio — prioridade da prop sobre a sessão', () => {
  it('a prop sempre prevalece quando definida', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STATUS),
        fc.oneof(fc.constantFrom(...STATUS), fc.constant(undefined)),
        (prop, sessao) => {
          expect(resolverStatusBloqueio(prop, sessao)).toBe(prop)
        },
      ),
    )
  })

  it('usa o status da sessão quando a prop é undefined', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constantFrom(...STATUS), fc.constant(undefined)),
        (sessao) => {
          expect(resolverStatusBloqueio(undefined, sessao)).toBe(sessao)
        },
      ),
    )
  })
})

describe('BloqueioFinanceiroAviso — renderização por status (Req 6)', () => {
  it('SOMENTE_LEITURA exibe o banner de somente visualização (Req 6.1)', () => {
    renderComProviders(
      <BloqueioFinanceiroAviso status="SOMENTE_LEITURA" buscarDaSessao={false} />,
    )
    expect(screen.getAllByText(/somente visualiza/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/pendência financeira/i)).toBeInTheDocument()
  })

  it('INATIVADO exibe a tela de acesso impedido (Req 6.2)', () => {
    renderComProviders(
      <BloqueioFinanceiroAviso status="INATIVADO" buscarDaSessao={false} />,
    )
    expect(screen.getByText(/acesso temporariamente indispon/i)).toBeInTheDocument()
    expect(screen.getByText(/inativada/i)).toBeInTheDocument()
  })

  it('ATIVO não renderiza o aviso (Req 6.5)', () => {
    renderComProviders(
      <BloqueioFinanceiroAviso status="ATIVO" buscarDaSessao={false} />,
    )
    expect(screen.queryByText(/somente visualiza/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/acesso temporariamente indispon/i)).not.toBeInTheDocument()
  })

  it('sem status e sem busca de sessão não renderiza o aviso (degradação segura)', () => {
    renderComProviders(<BloqueioFinanceiroAviso buscarDaSessao={false} />)
    expect(screen.queryByText(/somente visualiza/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/acesso temporariamente indispon/i)).not.toBeInTheDocument()
  })

  it('não expõe códigos técnicos de erro ao usuário (Req 6.3, 6.4)', () => {
    for (const status of ['SOMENTE_LEITURA', 'INATIVADO'] as StatusFinanceiro[]) {
      const { container, unmount } = renderComProviders(
        <BloqueioFinanceiroAviso status={status} buscarDaSessao={false} />,
      )
      // Não deve conter menções a status HTTP (ex.: "403", "HTTP").
      expect(container.textContent).not.toMatch(/\b403\b/)
      expect(container.textContent).not.toMatch(/HTTP/i)
      unmount()
    }
  })
})
