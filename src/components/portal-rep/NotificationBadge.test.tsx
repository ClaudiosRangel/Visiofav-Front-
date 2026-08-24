import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { NotificationBadge } from './NotificationBadge'

function renderBadge(count: number) {
  return render(
    <MantineProvider>
      <NotificationBadge count={count} />
    </MantineProvider>,
  )
}

describe('NotificationBadge', () => {
  it('retorna null quando count é 0 (badge oculto)', () => {
    renderBadge(0)
    expect(screen.queryByText('0')).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('retorna null quando count é negativo', () => {
    renderBadge(-5)
    expect(screen.queryByText('-5')).not.toBeInTheDocument()
    expect(screen.queryByText('99+')).not.toBeInTheDocument()
  })

  it('exibe número exato para count entre 1 e 99', () => {
    renderBadge(1)
    expect(screen.getByText('1')).toBeInTheDocument()
  })

  it('exibe número exato para count = 50', () => {
    renderBadge(50)
    expect(screen.getByText('50')).toBeInTheDocument()
  })

  it('exibe número exato para count = 99', () => {
    renderBadge(99)
    expect(screen.getByText('99')).toBeInTheDocument()
  })

  it('exibe "99+" quando count é maior que 99', () => {
    renderBadge(100)
    expect(screen.getByText('99+')).toBeInTheDocument()
  })

  it('exibe "99+" para valores muito grandes', () => {
    renderBadge(999)
    expect(screen.getByText('99+')).toBeInTheDocument()
  })
})
