import './ambiente-dom.test-util'
import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MantineProvider, TextInput } from '@mantine/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { get, post, put, patch, del } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
}))

vi.mock('@/lib/api', () => ({ api: { get, post, put, patch, delete: del } }))

import BotaoPropriedades, { ROTULO_PROPRIEDADES } from './BotaoPropriedades'

const FICHA = {
  origem: 'PRODUTO',
  imagemFaca: null,
  arte: null,
  arteUrl: null,
  cartao: 'Cartão Duplex',
  gramatura: '300',
  numCores: 4,
  coresDescricao: 'CMYK',
  acabamentos: 'Verniz',
  matriz: 'M-10',
}

/** Tela de origem com um campo preenchido, para provar que abrir/fechar não o altera. */
function Origem() {
  const [valor, setValor] = useState('4,5')
  return (
    <MantineProvider>
      <TextInput label="Ajuste Corte Micro (mm)" value={valor} onChange={(e) => setValor(e.currentTarget.value)} />
      <BotaoPropriedades orcamentoId="orc-1" />
    </MantineProvider>
  )
}

describe('BotaoPropriedades (R13, decisão D2)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    get.mockResolvedValue({ data: FICHA })
  })

  it('mostra o botão "Propriedades/Preview" e não consulta nada antes de abrir', () => {
    render(<Origem />)
    expect(screen.getByRole('button', { name: ROTULO_PROPRIEDADES })).toBeInTheDocument()
    expect(get).not.toHaveBeenCalled()
  })

  it('abre o preview da ficha master do orçamento (somente leitura, sem gravar)', async () => {
    render(<Origem />)
    fireEvent.click(screen.getByRole('button', { name: ROTULO_PROPRIEDADES }))

    expect(await screen.findByText('Cartão Duplex')).toBeInTheDocument()
    expect(screen.getByText('Ficha master do produto')).toBeInTheDocument()

    expect(get).toHaveBeenCalledTimes(1)
    expect(get.mock.calls[0][0]).toBe('/orcamento-grafico/orc-1/ficha-master')
    expect(post).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
    expect(patch).not.toHaveBeenCalled()
    expect(del).not.toHaveBeenCalled()
  })

  it('fechar mantém os campos da tela de origem intactos e não grava nada', async () => {
    render(<Origem />)
    const campo = screen.getByLabelText('Ajuste Corte Micro (mm)') as HTMLInputElement
    expect(campo.value).toBe('4,5')

    fireEvent.click(screen.getByRole('button', { name: ROTULO_PROPRIEDADES }))
    await screen.findByText('Cartão Duplex')
    fireEvent.click(screen.getByRole('button', { name: 'Fechar' }))

    await waitFor(() => expect(screen.queryByText('Cartão Duplex')).not.toBeInTheDocument())
    expect((screen.getByLabelText('Ajuste Corte Micro (mm)') as HTMLInputElement).value).toBe('4,5')
    expect(post).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
    expect(patch).not.toHaveBeenCalled()
    expect(del).not.toHaveBeenCalled()
  })

  it('erro de leitura mostra "Tentar novamente" sem afetar a tela de origem', async () => {
    get.mockRejectedValueOnce(new Error('rede'))
    render(<Origem />)
    fireEvent.click(screen.getByRole('button', { name: ROTULO_PROPRIEDADES }))

    expect(await screen.findByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
    expect((screen.getByLabelText('Ajuste Corte Micro (mm)') as HTMLInputElement).value).toBe('4,5')
  })
})
