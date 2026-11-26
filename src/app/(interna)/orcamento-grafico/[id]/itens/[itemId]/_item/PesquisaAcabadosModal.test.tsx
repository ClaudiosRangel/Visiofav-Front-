import './ambiente-dom.test-util'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'
const { get } = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { get, post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))
import PesquisaAcabadosModal from './PesquisaAcabadosModal'

const LISTA = {
  data: [
    { id: 'p1', codigo: '4502', nome: 'CARTUCHO KIT 500ML LISO JAPONESA', unidade: 'UN', status: true },
    { id: 'p2', codigo: '4503', nome: 'CARTUCHO KIT 500ML LISO MAIS CRESCIMENTO', unidade: 'UN', status: true },
  ],
  total: 2,
  page: 1,
  totalPages: 1,
}

beforeEach(() => {
  vi.clearAllMocks()
  get.mockResolvedValue({ data: LISTA })
})

function abrir(props: Partial<Parameters<typeof PesquisaAcabadosModal>[0]> = {}) {
  const onEscolher = vi.fn()
  const onClose = vi.fn()
  render(
    <MantineProvider>
      <PesquisaAcabadosModal opened onClose={onClose} onEscolher={onEscolher} {...props} />
    </MantineProvider>,
  )
  return { onEscolher, onClose }
}

describe('Pesquisa de Acabados', () => {
  it('abre já pesquisando pelo código digitado e lista código, nome e unidade', async () => {
    abrir({ codigoInicial: '45' })
    expect(await screen.findByText('CARTUCHO KIT 500ML LISO JAPONESA', {}, { timeout: 3000 })).toBeTruthy()
    expect(get).toHaveBeenCalledWith('/orcamento-grafico/acabados', { params: expect.objectContaining({ codigo: '45', page: 1 }) })
    expect(screen.getByTestId('acabado-4503')).toBeTruthy()
  })

  it('pesquisa pela descrição com as palavras separadas por vírgula', async () => {
    abrir()
    await screen.findByText('CARTUCHO KIT 500ML LISO JAPONESA')
    fireEvent.change(screen.getByLabelText(/Descrição/), { target: { value: 'kit, liso' } })
    expect(screen.queryByRole('button', { name: 'Pesquisar' })).toBeNull()
    await waitFor(() =>
      expect(get).toHaveBeenLastCalledWith('/orcamento-grafico/acabados', { params: expect.objectContaining({ descricao: 'kit, liso' }) }),
    )
  })

  it('duplo clique escolhe e fecha', async () => {
    const { onEscolher, onClose } = abrir()
    fireEvent.doubleClick(await screen.findByTestId('acabado-4502'))
    expect(onEscolher).toHaveBeenCalledWith(expect.objectContaining({ codigo: '4502', nome: 'CARTUCHO KIT 500ML LISO JAPONESA' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('Selecionar só habilita com uma linha marcada', async () => {
    const { onEscolher } = abrir()
    const selecionar = screen.getByRole('button', { name: 'Selecionar' }) as HTMLButtonElement
    await screen.findByTestId('acabado-4503')
    expect(selecionar.disabled).toBe(true)
    fireEvent.click(screen.getByTestId('acabado-4503'))
    expect(selecionar.disabled).toBe(false)
    fireEvent.click(selecionar)
    expect(onEscolher).toHaveBeenCalledWith(expect.objectContaining({ codigo: '4503' }))
  })

  it('falha na pesquisa informa o erro', async () => {
    get.mockRejectedValue(new Error('x'))
    abrir()
    expect(await screen.findByText('Não foi possível pesquisar os acabados.')).toBeTruthy()
  })
})
