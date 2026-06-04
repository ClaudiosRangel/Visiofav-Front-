import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { DistanciaClienteInfo } from './DistanciaClienteInfo'

vi.mock('@/data/hooks/useGeo', () => ({
  useDistanciaCliente: vi.fn(),
}))

import { useDistanciaCliente } from '@/data/hooks/useGeo'

const mockedUseDistanciaCliente = vi.mocked(useDistanciaCliente)

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>{ui}</MantineProvider>
    </QueryClientProvider>
  )
}

describe('DistanciaClienteInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockedUseDistanciaCliente.mockReturnValue({
      data: undefined,
      isLoading: false,
    } as any)
  })

  it('renders fallback message when cliente has no coordinates', () => {
    renderWithProviders(
      <DistanciaClienteInfo
        clienteId="123"
        clienteTemCoordenadas={false}
        empresaTemCoordenadas={true}
      />
    )
    expect(
      screen.getByText('Distância: não disponível (cliente sem geolocalização)')
    ).toBeInTheDocument()
  })

  it('renders fallback message when empresa has no coordinates', () => {
    renderWithProviders(
      <DistanciaClienteInfo
        clienteId="123"
        clienteTemCoordenadas={true}
        empresaTemCoordenadas={false}
      />
    )
    expect(
      screen.getByText('Distância: não disponível (empresa sem geolocalização)')
    ).toBeInTheDocument()
  })

  it('does not call useDistanciaCliente when cliente has no coordinates', () => {
    renderWithProviders(
      <DistanciaClienteInfo
        clienteId="123"
        clienteTemCoordenadas={false}
        empresaTemCoordenadas={true}
      />
    )
    expect(mockedUseDistanciaCliente).toHaveBeenCalledWith(null)
  })

  it('does not call useDistanciaCliente when empresa has no coordinates', () => {
    renderWithProviders(
      <DistanciaClienteInfo
        clienteId="123"
        clienteTemCoordenadas={true}
        empresaTemCoordenadas={false}
      />
    )
    expect(mockedUseDistanciaCliente).toHaveBeenCalledWith(null)
  })

  it('calls useDistanciaCliente with clienteId when both have coordinates', () => {
    renderWithProviders(
      <DistanciaClienteInfo
        clienteId="abc-456"
        clienteTemCoordenadas={true}
        empresaTemCoordenadas={true}
      />
    )
    expect(mockedUseDistanciaCliente).toHaveBeenCalledWith('abc-456')
  })

  it('renders loading skeleton when query is loading', () => {
    mockedUseDistanciaCliente.mockReturnValue({
      data: undefined,
      isLoading: true,
    } as any)

    const { container } = renderWithProviders(
      <DistanciaClienteInfo
        clienteId="123"
        clienteTemCoordenadas={true}
        empresaTemCoordenadas={true}
      />
    )
    // Mantine Skeleton renders a div with specific data attributes
    expect(container.querySelector('[data-mantine-component="Skeleton"]') || container.querySelector('.mantine-Skeleton-root')).toBeTruthy()
  })

  it('renders distance formatted to 2 decimal places when data is available', () => {
    mockedUseDistanciaCliente.mockReturnValue({
      data: {
        distanciaKm: 12.3456,
        origemLatitude: -23.5,
        origemLongitude: -46.6,
        destinoLatitude: -23.6,
        destinoLongitude: -46.7,
      },
      isLoading: false,
    } as any)

    renderWithProviders(
      <DistanciaClienteInfo
        clienteId="123"
        clienteTemCoordenadas={true}
        empresaTemCoordenadas={true}
      />
    )
    expect(screen.getByText('Distância: 12.35 km')).toBeInTheDocument()
  })

  it('renders distance with trailing zeros when needed', () => {
    mockedUseDistanciaCliente.mockReturnValue({
      data: {
        distanciaKm: 5,
        origemLatitude: -23.5,
        origemLongitude: -46.6,
        destinoLatitude: -23.6,
        destinoLongitude: -46.7,
      },
      isLoading: false,
    } as any)

    renderWithProviders(
      <DistanciaClienteInfo
        clienteId="123"
        clienteTemCoordenadas={true}
        empresaTemCoordenadas={true}
      />
    )
    expect(screen.getByText('Distância: 5.00 km')).toBeInTheDocument()
  })

  it('renders fallback when data is undefined after loading', () => {
    mockedUseDistanciaCliente.mockReturnValue({
      data: undefined,
      isLoading: false,
    } as any)

    renderWithProviders(
      <DistanciaClienteInfo
        clienteId="123"
        clienteTemCoordenadas={true}
        empresaTemCoordenadas={true}
      />
    )
    expect(screen.getByText('Distância: não disponível')).toBeInTheDocument()
  })
})
