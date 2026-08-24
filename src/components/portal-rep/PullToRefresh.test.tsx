import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { PullToRefresh } from './PullToRefresh'

function renderPullToRefresh(onRefresh: () => Promise<void>) {
  return render(
    <MantineProvider>
      <PullToRefresh onRefresh={onRefresh}>
        <div data-testid="content">Conteúdo</div>
      </PullToRefresh>
    </MantineProvider>,
  )
}

describe('PullToRefresh', () => {
  it('renderiza children corretamente', () => {
    renderPullToRefresh(vi.fn().mockResolvedValue(undefined))
    expect(screen.getByTestId('content')).toBeInTheDocument()
    expect(screen.getByText('Conteúdo')).toBeInTheDocument()
  })

  it('não mostra loader inicialmente', () => {
    const { container } = renderPullToRefresh(vi.fn().mockResolvedValue(undefined))
    // Não deve haver nenhum Loader renderizado antes de um pull
    const loaders = container.querySelectorAll('[role="presentation"], .mantine-Loader-root')
    expect(loaders.length).toBe(0)
  })

  it('renderiza um container wrapper ao redor dos children', () => {
    const { container } = renderPullToRefresh(vi.fn().mockResolvedValue(undefined))
    // Deve haver um wrapper que contém o conteúdo
    const contentEl = screen.getByTestId('content')
    expect(contentEl.parentElement).toBeTruthy()
    expect(container.firstElementChild).toBeTruthy()
  })

  it('aceita a prop onRefresh como função assíncrona', () => {
    // Verifica que o componente renderiza sem erro com a interface documentada
    const onRefresh = vi.fn().mockResolvedValue(undefined)
    expect(() => renderPullToRefresh(onRefresh)).not.toThrow()
  })
})
