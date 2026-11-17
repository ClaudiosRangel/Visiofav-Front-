import { render, fireEvent, waitFor, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Fase 3 (tarefa 9.2) — vínculo Produto × Tipo de Embalagem no ProdutoModal:
 * vínculo ativo pré-selecionado; inativo marcado "(inativo)" e preservado sem enviar o campo;
 * limpar envia null; erro 422 mantém o formulário.
 */

const { getMock, atualizarMock, criarMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  atualizarMock: vi.fn(),
  criarMock: vi.fn(),
}))

vi.mock('@/lib/api', () => ({ api: { get: getMock, post: vi.fn(), put: vi.fn() } }))
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }))
vi.mock('../_shared/cadastros-graficos.api', async (importOriginal) => {
  const real = await importOriginal<typeof import('../_shared/cadastros-graficos.api')>()
  return { ...real, produtosApi: { ...real.produtosApi, atualizar: atualizarMock, criar: criarMock } }
})
vi.mock('./AbaDefaultsPlano', () => ({ default: () => null }))
vi.mock('./AbaRelacoesProduto', () => ({ default: () => null }))

import { notifications } from '@mantine/notifications'
import ProdutoModal from './ProdutoModal'

const notificar = notifications.show as unknown as ReturnType<typeof vi.fn>

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver

const TIPO_A = { id: 'tipo-a', codigo: 'CG-EMB-1', descricao: 'Cartucho Simples' }
const TIPO_B = { id: 'tipo-b', codigo: 'CG-EMB-2', descricao: 'Caixa Automática' }
const TIPO_INATIVO = { id: 'tipo-x', codigo: 'CG-EMB-9', descricao: 'Tipo Antigo' }

function produtoBase(tipoEmbalagemId: string | null) {
  return {
    id: 'prod-1',
    codigo: 'P1',
    nome: 'Produto 1',
    status: true,
    baseUnidadePreco: 'UN',
    prazoProducaoDias: 5,
    tipoCartucho: null,
    modoFormato: 'TRES_DIMENSOES',
    formatoPadraoLargura: null,
    formatoPadraoAltura: null,
    faturamentoMinimo: false,
    valorFaturamentoMinimo: null,
    semImpressao: false,
    exibeRestricoes: false,
    exibeInformacoesComplementares: false,
    tributacao2026: null,
    tributacao2027: null,
    classificacaoFiscal: null,
    tipoEmbalagemId,
  } as any
}

/** /tipos-embalagem: ativos (status=true) e inativos (status=false). */
function mockTipos(ativos: unknown[], inativos: unknown[] = []) {
  getMock.mockImplementation((_url: string, cfg: any) => {
    const lista = cfg?.params?.status === 'false' ? inativos : ativos
    return Promise.resolve({ data: { data: lista, total: lista.length, page: 1, totalPages: 1 } })
  })
}

function renderModal(produto: any, onSalvo = vi.fn()) {
  const onClose = vi.fn()
  render(
    <MantineProvider>
      <ProdutoModal produto={produto} onClose={onClose} onSalvo={onSalvo} />
    </MantineProvider>,
  )
  return { onSalvo, onClose }
}

const campoTipo = () => screen.getByRole('textbox', { name: /Tipo de Embalagem/i }) as HTMLInputElement

async function esperarTiposCarregados(valorEsperado: string) {
  await waitFor(() => expect(campoTipo().value).toBe(valorEsperado))
}

beforeEach(() => {
  getMock.mockReset()
  atualizarMock.mockReset()
  criarMock.mockReset()
  notificar.mockReset()
})

describe('ProdutoModal — vínculo com Tipo de Embalagem', () => {
  it('vínculo ativo vem pré-selecionado', async () => {
    mockTipos([TIPO_A, TIPO_B])
    renderModal(produtoBase('tipo-a'))
    await esperarTiposCarregados('Cartucho Simples')
  })

  it('vínculo inativo aparece marcado "(inativo)" e não é enviado ao salvar sem mudança', async () => {
    mockTipos([TIPO_A], [TIPO_INATIVO])
    atualizarMock.mockImplementation((_id: string, dados: any) =>
      Promise.resolve({ ...produtoBase('tipo-x'), ...dados }),
    )
    const { onSalvo } = renderModal(produtoBase('tipo-x'))
    await esperarTiposCarregados('Tipo Antigo (inativo)')

    fireEvent.click(screen.getByRole('button', { name: /Salvar Alterações/i }))
    await waitFor(() => expect(atualizarMock).toHaveBeenCalledTimes(1))
    const [id, payload] = atualizarMock.mock.calls[0]
    expect(id).toBe('prod-1')
    expect(payload).not.toHaveProperty('tipoEmbalagemId')
    await waitFor(() => expect(onSalvo).toHaveBeenCalled())
    // O vínculo continua exibido depois de salvar.
    expect(campoTipo().value).toBe('Tipo Antigo (inativo)')
  })

  it('limpar o campo envia tipoEmbalagemId null', async () => {
    mockTipos([TIPO_A, TIPO_B])
    atualizarMock.mockImplementation((_id: string, dados: any) =>
      Promise.resolve({ ...produtoBase(null), ...dados }),
    )
    renderModal(produtoBase('tipo-a'))
    await esperarTiposCarregados('Cartucho Simples')

    // Botão "x" do Select: fica no mesmo contêiner do input (não confundir com o fechar do modal).
    const limpar = campoTipo().parentElement?.querySelector('button')
    expect(limpar).not.toBeNull()
    fireEvent.click(limpar as Element)
    await waitFor(() => expect(campoTipo().value).toBe(''))

    fireEvent.click(screen.getByRole('button', { name: /Salvar Alterações/i }))
    await waitFor(() => expect(atualizarMock).toHaveBeenCalledTimes(1))
    expect(atualizarMock.mock.calls[0][1]).toHaveProperty('tipoEmbalagemId', null)
  })

  it('erro 422 mostra a mensagem, mantém o formulário e não chama onSalvo', async () => {
    mockTipos([TIPO_A, TIPO_B])
    atualizarMock.mockRejectedValue({
      response: { status: 422, data: { message: 'Tipo de embalagem inativo ou inexistente' } },
    })
    const { onSalvo } = renderModal(produtoBase('tipo-a'))
    await esperarTiposCarregados('Cartucho Simples')

    const nome = screen.getByRole('textbox', { name: /Nome/i }) as HTMLInputElement
    fireEvent.change(nome, { target: { value: 'Produto editado' } })
    fireEvent.click(screen.getByRole('button', { name: /Salvar Alterações/i }))

    await waitFor(() =>
      expect(notificar).toHaveBeenCalledWith(
        expect.objectContaining({ color: 'red', message: 'Tipo de embalagem inativo ou inexistente' }),
      ),
    )
    expect(onSalvo).not.toHaveBeenCalled()
    expect((screen.getByRole('textbox', { name: /Nome/i }) as HTMLInputElement).value).toBe('Produto editado')
    expect(campoTipo().value).toBe('Cartucho Simples')
    expect(screen.getByRole('button', { name: /Salvar Alterações/i })).toBeEnabled()
  })
})
