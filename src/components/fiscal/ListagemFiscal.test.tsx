import { render, screen, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ListagemFiscal, ColumnDef } from './ListagemFiscal'

// Mock the api module
vi.mock('@/lib/api', () => ({
  api: {
    get: vi.fn(),
  },
}))

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

import { api } from '@/lib/api'

const mockedApi = api as any

interface TestItem {
  id: string
  numero: string
  valor: number
  status: string
}

const columns: ColumnDef<TestItem>[] = [
  { key: 'numero', label: 'Número' },
  { key: 'valor', label: 'Valor' },
  { key: 'status', label: 'Status' },
]

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = createQueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>{ui}</MantineProvider>
    </QueryClientProvider>
  )
}

describe('ListagemFiscal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders title and breadcrumb', async () => {
    mockedApi.get.mockResolvedValue({
      data: { data: [], total: 0, page: 1, limit: 20, totalPages: 0 },
    })

    renderWithProviders(
      <ListagemFiscal<TestItem>
        queryKey={['test']}
        endpoint="/test"
        columns={columns}
        title="Notas Fiscais"
        breadcrumb="Início / Fiscal / NF-e"
      />
    )

    expect(screen.getByText('Notas Fiscais')).toBeInTheDocument()
    expect(screen.getByText('Início / Fiscal / NF-e')).toBeInTheDocument()
  })

  it('displays empty state when no data', async () => {
    mockedApi.get.mockResolvedValue({
      data: { data: [], total: 0, page: 1, limit: 20, totalPages: 0 },
    })

    renderWithProviders(
      <ListagemFiscal<TestItem>
        queryKey={['test-empty']}
        endpoint="/test"
        columns={columns}
        title="NF-e"
        breadcrumb="Fiscal / NF-e"
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Nenhum registro encontrado')).toBeInTheDocument()
    })
  })

  it('renders table data correctly', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        data: [
          { id: '1', numero: '001', valor: 1500, status: 'AUTORIZADA' },
          { id: '2', numero: '002', valor: 2300, status: 'PENDENTE' },
        ],
        total: 2,
        page: 1,
        limit: 20,
        totalPages: 1,
      },
    })

    renderWithProviders(
      <ListagemFiscal<TestItem>
        queryKey={['test-data']}
        endpoint="/test"
        columns={columns}
        title="NF-e"
        breadcrumb="Fiscal / NF-e"
      />
    )

    await waitFor(() => {
      expect(screen.getByText('001')).toBeInTheDocument()
      expect(screen.getByText('002')).toBeInTheDocument()
    })
  })

  it('renders status badges with custom colors', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        data: [
          { id: '1', numero: '001', valor: 1500, status: 'AUTORIZADA' },
        ],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      },
    })

    const statusColors = {
      AUTORIZADA: 'green',
      PENDENTE: 'gray',
      REJEITADA: 'red',
    }

    renderWithProviders(
      <ListagemFiscal<TestItem>
        queryKey={['test-badges']}
        endpoint="/test"
        columns={columns}
        title="NF-e"
        breadcrumb="Fiscal / NF-e"
        statusColors={statusColors}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('AUTORIZADA')).toBeInTheDocument()
    })
  })

  it('renders create button when provided', async () => {
    mockedApi.get.mockResolvedValue({
      data: { data: [], total: 0, page: 1, limit: 20, totalPages: 0 },
    })

    renderWithProviders(
      <ListagemFiscal<TestItem>
        queryKey={['test-btn']}
        endpoint="/test"
        columns={columns}
        title="NF-e"
        breadcrumb="Fiscal / NF-e"
        createButton={{ label: 'Nova NF-e', href: '/fiscal/nfe/nova' }}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Nova NF-e')).toBeInTheDocument()
    })
  })

  it('renders column headers correctly', async () => {
    mockedApi.get.mockResolvedValue({
      data: { data: [], total: 0, page: 1, limit: 20, totalPages: 0 },
    })

    renderWithProviders(
      <ListagemFiscal<TestItem>
        queryKey={['test-headers']}
        endpoint="/test"
        columns={columns}
        title="NF-e"
        breadcrumb="Fiscal / NF-e"
      />
    )

    expect(screen.getByText('Número')).toBeInTheDocument()
    expect(screen.getByText('Valor')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
  })

  it('renders actions column when actions prop provided', async () => {
    mockedApi.get.mockResolvedValue({
      data: {
        data: [{ id: '1', numero: '001', valor: 1500, status: 'AUTORIZADA' }],
        total: 1,
        page: 1,
        limit: 20,
        totalPages: 1,
      },
    })

    renderWithProviders(
      <ListagemFiscal<TestItem>
        queryKey={['test-actions']}
        endpoint="/test"
        columns={columns}
        title="NF-e"
        breadcrumb="Fiscal / NF-e"
        actions={(item) => <button>Editar {item.numero}</button>}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Editar 001')).toBeInTheDocument()
    })
    expect(screen.getByText('Ações')).toBeInTheDocument()
  })
})
