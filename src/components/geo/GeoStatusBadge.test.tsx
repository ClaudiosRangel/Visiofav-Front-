import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { describe, it, expect } from 'vitest'
import { GeoStatusBadge } from './GeoStatusBadge'

function renderWithMantine(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>)
}

describe('GeoStatusBadge', () => {
  it('renders green badge with "Geocodificado" when geocodificado is true', () => {
    renderWithMantine(<GeoStatusBadge geocodificado={true} />)
    const badge = screen.getByText('Geocodificado')
    expect(badge).toBeInTheDocument()
  })

  it('renders gray badge with "Não geocodificado" when geocodificado is false', () => {
    renderWithMantine(<GeoStatusBadge geocodificado={false} />)
    const badge = screen.getByText('Não geocodificado')
    expect(badge).toBeInTheDocument()
  })
})
