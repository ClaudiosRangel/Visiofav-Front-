import './ambiente-dom.test-util'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { get, post, patch, del, push } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  patch: vi.fn(),
  del: vi.fn(),
  push: vi.fn(),
}))

vi.mock('@/lib/api', () => ({ api: { get, post, put: vi.fn(), patch, delete: del } }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}))

import { limparMemoriaPlanos } from '../_plano/pilha-store'
import type { PlanoLeitura } from '../_plano/plano.types'
import GridPlanos, { textoAcabamento, textoCores, textoFormato, textoSuporte } from './GridPlanos'

function plano(id: string, nome: string, sequencia: number): PlanoLeitura {
  return {
    id,
    sequencia,
    nome,
    tipoPlanoId: null,
    suporteId: 'sup-1',
    suporteProducaoId: null,
    gramatura: '300',
    formatoLarguraMm: '650',
    formatoAlturaMm: '1225.5',
    numCores: 4,
    cores: null,
    maquinaId: null,
    acabamentosRicos: [{ nome: 'Verniz' }, { nome: 'Corte e vinco' }],
    custoSuporte: null,
    custoImpressao: null,
    custoAcabamento: null,
    especificacao: { versao: 1, cores: '4x1' },
  }
}

function servidor(planos: PlanoLeitura[]) {
  get.mockResolvedValue({ data: { planos } })
}

function renderizar(onAlterado = vi.fn()) {
  render(
    <MantineProvider>
      <GridPlanos orcamentoId="orc-1" itemId="item-1" onAlterado={onAlterado} />
    </MantineProvider>,
  )
  return onAlterado
}

const botao = (nome: string) => screen.getByRole('button', { name: nome })

beforeEach(() => {
  vi.clearAllMocks()
  limparMemoriaPlanos()
})

describe('GridPlanos — colunas', () => {
  it('formata Suporte, Cores, Formato e Acabamento', () => {
    const p = plano('a', 'Tampa', 1)
    expect(textoSuporte(p)).toBe('300 g/m²')
    expect(textoCores(p)).toBe('4x1')
    expect(textoFormato(p)).toBe('650 x 1.225,5 mm')
    expect(textoAcabamento(p)).toBe('Verniz, Corte e vinco')
    const vazio = { ...p, gramatura: null, especificacao: null, numCores: null, formatoLarguraMm: null, acabamentosRicos: null }
    expect([textoSuporte(vazio), textoCores(vazio), textoFormato(vazio), textoAcabamento(vazio)]).toEqual(['—', '—', '—', '—'])
  })

  it('mostra as colunas na ordem e uma linha por plano', async () => {
    servidor([plano('a', 'Tampa', 1), plano('b', 'Fundo', 2)])
    renderizar()
    const tabela = await screen.findByTestId('grid-planos-tabela')
    const cabecalhos = within(tabela).getAllByRole('columnheader').map((c) => c.textContent)
    // 1ª coluna = seleção (rádio); última = ações da linha.
    expect(cabecalhos).toEqual(['', 'Nome', 'Suporte', 'Cores', 'Formato', 'Acabamento', 'Ações'])
    expect(within(tabela).getByText('Tampa')).toBeInTheDocument()
    expect(within(tabela).getByText('Fundo')).toBeInTheDocument()
  })
})

describe('GridPlanos — estado vazio', () => {
  it('mostra a mensagem, Incluir habilitado e as demais ações desabilitadas', async () => {
    servidor([])
    renderizar()
    expect(await screen.findByTestId('grid-planos-vazio')).toHaveTextContent('Este item ainda não tem planos.')
    expect(botao('Incluir')).toBeEnabled()
    expect(botao('Incluir plano')).toBeEnabled()
    for (const nome of ['Copiar', 'Excluir', 'Subir', 'Descer', 'Desfazer', 'Abrir']) expect(botao(nome)).toBeDisabled()

    fireEvent.click(botao('Incluir plano'))
    expect(push).toHaveBeenCalledWith('/orcamento-grafico/orc-1/itens/item-1/planos/novo')
  })
})

describe('GridPlanos — habilitação dos botões', () => {
  it('Copiar/Excluir/Abrir com 1 selecionado; Subir/Descer conforme a posição; Desfazer sem ação', async () => {
    servidor([plano('a', 'Tampa', 1), plano('b', 'Fundo', 2)])
    renderizar()
    await screen.findByTestId('grid-planos-tabela')

    expect(botao('Incluir')).toBeEnabled()
    for (const nome of ['Copiar', 'Excluir', 'Subir', 'Descer', 'Abrir']) expect(botao(nome)).toBeDisabled()
    expect(botao('Desfazer')).toBeDisabled()

    fireEvent.click(screen.getByTestId('plano-linha-a'))
    expect(screen.getByTestId('plano-linha-a')).toHaveAttribute('aria-selected', 'true')
    for (const nome of ['Copiar', 'Excluir', 'Descer', 'Abrir']) expect(botao(nome)).toBeEnabled()
    expect(botao('Subir')).toBeDisabled()

    fireEvent.click(screen.getByTestId('plano-linha-b'))
    expect(botao('Subir')).toBeEnabled()
    expect(botao('Descer')).toBeDisabled()

    // Incluir com seleção vai para logo abaixo do selecionado.
    fireEvent.click(botao('Incluir'))
    expect(push).toHaveBeenLastCalledWith('/orcamento-grafico/orc-1/itens/item-1/planos/novo?apos=b')
  })

  it('com 1 plano, Subir/Descer ficam desabilitados mesmo selecionado', async () => {
    servidor([plano('a', 'Tampa', 1)])
    renderizar()
    fireEvent.click(await screen.findByTestId('plano-linha-a'))
    expect(botao('Subir')).toBeDisabled()
    expect(botao('Descer')).toBeDisabled()
    expect(botao('Copiar')).toBeEnabled()
  })

  it('duplo clique abre a Tela_Plano do plano', async () => {
    servidor([plano('a', 'Tampa', 1)])
    renderizar()
    fireEvent.doubleClick(await screen.findByTestId('plano-linha-a'))
    expect(push).toHaveBeenCalledWith('/orcamento-grafico/orc-1/itens/item-1/planos/a')
  })

  it('mover habilita Desfazer e avisa o pai', async () => {
    servidor([plano('a', 'Tampa', 1), plano('b', 'Fundo', 2)])
    patch.mockResolvedValue({ data: { planos: [] } })
    const onAlterado = renderizar()
    fireEvent.click(await screen.findByTestId('plano-linha-b'))
    fireEvent.click(botao('Subir'))
    await waitFor(() => expect(botao('Desfazer')).toBeEnabled())
    expect(patch).toHaveBeenCalledWith('/orcamento-grafico/orc-1/itens/item-1/planos/reordenar', { ordem: ['b', 'a'] })
    expect(onAlterado).toHaveBeenCalledTimes(1)
  })
})

describe('GridPlanos — limite de 20 planos', () => {
  it('desabilita Incluir e Copiar e mostra o aviso', async () => {
    servidor(Array.from({ length: 20 }, (_, i) => plano(`p${i}`, `Plano ${i}`, i + 1)))
    renderizar()
    expect(await screen.findByTestId('grid-planos-limite')).toHaveTextContent('Limite de 20 planos por item.')
    fireEvent.click(screen.getByTestId('plano-linha-p0'))
    expect(botao('Incluir')).toBeDisabled()
    expect(botao('Copiar')).toBeDisabled()
    expect(botao('Excluir')).toBeEnabled()
  })
})

describe('GridPlanos — excluir', () => {
  it('pede confirmação; cancelar não chama a API', async () => {
    servidor([plano('a', 'Tampa', 1)])
    renderizar()
    fireEvent.click(await screen.findByTestId('plano-linha-a'))
    fireEvent.click(botao('Excluir'))
    const dialogo = await screen.findByRole('dialog')
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar' }))
    expect(del).not.toHaveBeenCalled()
    expect(screen.getByTestId('plano-linha-a')).toBeInTheDocument()
  })

  it('erro de gravação mantém a lista e mostra "A operação não foi salva."', async () => {
    servidor([plano('a', 'Tampa', 1), plano('b', 'Fundo', 2)])
    del.mockRejectedValue({ response: { status: 500, data: { message: 'Falha no banco' } } })
    const onAlterado = renderizar()
    fireEvent.click(await screen.findByTestId('plano-linha-a'))
    fireEvent.click(botao('Excluir'))
    const dialogo = await screen.findByRole('dialog')
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Excluir' }))

    expect(await screen.findByTestId('grid-planos-erro')).toHaveTextContent('A operação não foi salva. Falha no banco')
    expect(del).toHaveBeenCalledWith('/orcamento-grafico/orc-1/itens/item-1/planos/a')
    expect(screen.getByTestId('plano-linha-a')).toBeInTheDocument()
    expect(screen.getByTestId('plano-linha-b')).toBeInTheDocument()
    // O modal fica fora do grid (portal): este é o botão da barra, ainda disponível para nova tentativa.
    expect(within(screen.getByTestId('grid-planos')).getByRole('button', { name: 'Excluir' })).toBeEnabled()
    expect(botao('Desfazer')).toBeDisabled()
    expect(onAlterado).not.toHaveBeenCalled()
  })

  it('sucesso remove a linha e permite desfazer', async () => {
    servidor([plano('a', 'Tampa', 1), plano('b', 'Fundo', 2)])
    del.mockResolvedValue({ status: 204 })
    renderizar()
    fireEvent.click(await screen.findByTestId('plano-linha-a'))
    fireEvent.click(botao('Excluir'))
    const dialogo = await screen.findByRole('dialog')
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Excluir' }))

    await waitFor(() => expect(screen.queryByTestId('plano-linha-a')).toBeNull())
    expect(botao('Desfazer')).toBeEnabled()
  })
})
