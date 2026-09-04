import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import {
  StatusFaturaBadge,
  CORES_STATUS_FATURA,
  ROTULOS_STATUS_FATURA,
} from './StatusFaturaBadge'
import type { StatusFatura } from '@/lib/financeiro-vizor/types'

const STATUS: StatusFatura[] = ['PENDENTE', 'VENCIDA', 'PAGA', 'CANCELADA']

function renderWithMantine(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>)
}

describe('StatusFaturaBadge — mapa de cor (Property 8)', () => {
  // Validates: Requirements 4.3
  it('mapeia todo valor do enum para exatamente uma cor', () => {
    fc.assert(
      fc.property(fc.constantFrom(...STATUS), (status) => {
        const cor = CORES_STATUS_FATURA[status]
        expect(typeof cor).toBe('string')
        expect(cor.length).toBeGreaterThan(0)
      }),
    )
  })

  // Validates: Requirements 4.3
  it('usa cores distintas para valores distintos', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...STATUS),
        fc.constantFrom(...STATUS),
        (a, b) => {
          if (a !== b) {
            expect(CORES_STATUS_FATURA[a]).not.toBe(CORES_STATUS_FATURA[b])
          }
        },
      ),
    )
  })

  it('cobre exatamente os valores do enum (sem faltar nem sobrar)', () => {
    expect(Object.keys(CORES_STATUS_FATURA).sort()).toEqual([...STATUS].sort())
    expect(new Set(Object.values(CORES_STATUS_FATURA)).size).toBe(STATUS.length)
  })
})

describe('StatusFaturaBadge — renderização', () => {
  it('renderiza o rótulo correspondente a cada status', () => {
    for (const status of STATUS) {
      const { unmount } = renderWithMantine(<StatusFaturaBadge status={status} />)
      expect(screen.getByText(ROTULOS_STATUS_FATURA[status])).toBeInTheDocument()
      unmount()
    }
  })
})
