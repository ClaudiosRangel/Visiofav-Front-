import './ambiente-dom.test-util'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { get, post, mostrar } = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), mostrar: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { get, post } }))
vi.mock('@mantine/notifications', () => ({ notifications: { show: mostrar } }))

import SuporteNcModal, { MENSAGEM_PROVISORIO, URL_SUPORTE_NC, type SuporteNcModalProps } from './SuporteNcModal'

function renderizar(props: Partial<SuporteNcModalProps> = {}) {
  const onClose = vi.fn()
  const onCriado = vi.fn()
  render(
    <MantineProvider>
      <SuporteNcModal opened onClose={onClose} onCriado={onCriado} {...props} />
    </MantineProvider>,
  )
  return { onClose, onCriado }
}

const campo = (nome: RegExp) => screen.getByLabelText(nome) as HTMLInputElement
const digitar = (nome: RegExp, valor: string) => fireEvent.change(campo(nome), { target: { value: valor } })
const confirmar = () => fireEvent.click(screen.getByRole('button', { name: 'Confirmar' }))

function preencherMinimo() {
  digitar(/^Nome/, 'Cartão Triplex')
  digitar(/^Gramatura/, '250')
  digitar(/^Custo por Kg/, '9,5')
}

const CRIADO = { resultado: 'CRIADO', suporteId: 's1', precoId: 'p1', provisorio: true }
const DUPLICADO = { resultado: 'DUPLICADO', suporteId: 's9', nome: 'Cartão Triplex', gramatura: 250 }

describe('SuporteNcModal (R12)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    get.mockResolvedValue({ data: [] })
  })

  it('validação: vazio mostra erro nos obrigatórios e não chama a API', async () => {
    renderizar()
    confirmar()
    expect(await screen.findAllByText('Campo obrigatório.')).toHaveLength(3)
    expect(post).not.toHaveBeenCalled()
  })

  it('validação por campo: gramatura acima do limite e crédito inválido, sem enviar', async () => {
    renderizar()
    preencherMinimo()
    digitar(/^Gramatura/, '2000,01')
    digitar(/^Crédito ICMS/, '100,01')
    confirmar()
    expect(await screen.findByText(/Valor máximo: 2\.000,00/)).toBeInTheDocument()
    expect(screen.getByText(/Valor máximo: 100,00/)).toBeInTheDocument()
    expect(post).not.toHaveBeenCalled()
    expect(campo(/^Nome/).value).toBe('Cartão Triplex')
  })

  it('sucesso: envia o body, avisa que é provisório e chama onCriado com os dados', async () => {
    post.mockResolvedValue({ status: 201, data: CRIADO })
    const { onCriado, onClose } = renderizar()
    preencherMinimo()
    digitar(/^Frete por Kg/, '0,5')
    confirmar()

    await waitFor(() => expect(onCriado).toHaveBeenCalledTimes(1))
    expect(post).toHaveBeenCalledWith(URL_SUPORTE_NC, {
      nome: 'Cartão Triplex',
      gramatura: 250,
      custoKg: 9.5,
      freteKg: 0.5,
      tiraRetira: false,
      unidadeCustoKg: true,
      unidadeCalculoFl: true,
    })
    expect(onCriado).toHaveBeenCalledWith({ suporteId: 's1', precoId: 'p1', nome: 'Cartão Triplex', gramatura: 250, custoKg: 9.5 })
    expect(mostrar).toHaveBeenCalledWith(expect.objectContaining({ message: MENSAGEM_PROVISORIO }))
    expect(onClose).toHaveBeenCalled()
  })

  it('duplicata: mostra o existente e "Usar o existente" reenvia com confirmarExistente', async () => {
    post.mockResolvedValueOnce({ status: 200, data: DUPLICADO }).mockResolvedValueOnce({ status: 200, data: CRIADO })
    const { onCriado } = renderizar()
    preencherMinimo()
    confirmar()

    const alerta = await screen.findByRole('alert')
    expect(within(alerta).getByText('Cartão Triplex')).toBeInTheDocument()
    expect(within(alerta).getByText(/250 g\/m²/)).toBeInTheDocument()
    expect(onCriado).not.toHaveBeenCalled()
    expect(post.mock.calls[0][1]).not.toHaveProperty('confirmarExistente')

    fireEvent.click(within(alerta).getByRole('button', { name: 'Usar o existente' }))
    await waitFor(() => expect(onCriado).toHaveBeenCalledTimes(1))
    expect(post).toHaveBeenCalledTimes(2)
    expect(post.mock.calls[1][1]).toMatchObject({ nome: 'Cartão Triplex', gramatura: 250, custoKg: 9.5, confirmarExistente: true })
    expect(onCriado).toHaveBeenCalledWith(expect.objectContaining({ suporteId: 's1', nome: 'Cartão Triplex' }))
  })

  it('duplicata: "Cancelar" fecha sem nova chamada e sem criar nada', async () => {
    post.mockResolvedValueOnce({ status: 200, data: DUPLICADO })
    const { onClose, onCriado } = renderizar()
    preencherMinimo()
    confirmar()

    const alerta = await screen.findByRole('alert')
    fireEvent.click(within(alerta).getByRole('button', { name: 'Cancelar' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(post).toHaveBeenCalledTimes(1)
    expect(onCriado).not.toHaveBeenCalled()
    expect(mostrar).not.toHaveBeenCalled()
  })

  it('erro 500: mostra "O suporte não foi criado." com detalhe e mantém os dados', async () => {
    post.mockRejectedValue({ response: { status: 500, data: { message: 'Falha no banco' } }, message: 'Request failed' })
    const { onCriado, onClose } = renderizar()
    preencherMinimo()
    digitar(/^Fibra/, 'Longa')
    confirmar()

    const alerta = await screen.findByRole('alert')
    expect(within(alerta).getByText('O suporte não foi criado.')).toBeInTheDocument()
    expect(within(alerta).getByText('Falha no banco')).toBeInTheDocument()
    expect(campo(/^Nome/).value).toBe('Cartão Triplex')
    expect(campo(/^Gramatura/).value).toBe('250')
    expect(campo(/^Custo por Kg/).value).toBe('9,5')
    expect(campo(/^Fibra/).value).toBe('Longa')
    expect(onCriado).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(mostrar).not.toHaveBeenCalled()
  })

  it('erro de rede também mantém o formulário', async () => {
    post.mockRejectedValue(new Error('Network Error'))
    renderizar()
    preencherMinimo()
    confirmar()
    expect(await screen.findByText('Network Error')).toBeInTheDocument()
    expect(campo(/^Nome/).value).toBe('Cartão Triplex')
  })

  it('400 do servidor aparece no campo correspondente e preserva os dados', async () => {
    post.mockRejectedValue({
      response: { status: 400, data: { message: 'nome: máximo de 120 caracteres', campo: 'nome', issues: [{ campo: 'nome', motivo: 'máximo de 120 caracteres' }] } },
    })
    const { onCriado } = renderizar()
    preencherMinimo()
    confirmar()
    expect(await screen.findByText('Máximo de 120 caracteres')).toBeInTheDocument()
    expect(campo(/^Gramatura/).value).toBe('250')
    expect(onCriado).not.toHaveBeenCalled()
  })

  it('Consumo de Tinta lista os suportes da empresa pela busca server-side', async () => {
    get.mockResolvedValue({ data: [{ id: 'ref-1', descricao: 'Kraft 120' }] })
    renderizar()
    await waitFor(() => expect(get).toHaveBeenCalledWith('/orcamento-grafico/suportes', expect.objectContaining({ params: expect.objectContaining({ limit: 50 }) })))
    expect(screen.getAllByLabelText('Consumo de Tinta').length).toBeGreaterThan(0)
  })
})
