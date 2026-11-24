import './ambiente-dom.test-util'
import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { get, put, post, push, replace } = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
}))

vi.mock('@/lib/api', () => ({ api: { get, put, post, patch: vi.fn(), delete: vi.fn() } }))
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, back: vi.fn(), prefetch: vi.fn() }),
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}))
vi.mock('next/link', () => ({
  default: ({ href, children, ...resto }: { href: string; children: ReactNode }) => (
    <a href={href} {...resto}>
      {children}
    </a>
  ),
}))
// Os passos de papel e medidas do wizard têm cargas próprias; aqui só interessa o que gravam no form.
vi.mock('../../../../novo/StepPapel', () => ({
  default: ({ updateForm }: { updateForm: (p: Record<string, unknown>) => void }) => (
    <button type="button" onClick={() => updateForm({ gramatura: 300, precoKg: 5 })}>
      Papel de teste
    </button>
  ),
}))
vi.mock('../../../../novo/StepMedidas', () => ({ default: () => <div>Medidas de teste</div> }))

import { itemParaForm, montarPayloadItem } from '../../../itemFormShared'
import { itemParaEditar } from '../itemParaEditar'
import TelaItem from './TelaItem'

const TIPO = { id: 'te-1', codigo: 'CG-EMB-1', descricao: 'Cartuchos', parametros: [] }

/** Item no formato do `GET /:id` (engenharia do item puxado do cálculo 12992). */
const ITEM = {
  id: 'item-1',
  sequencia: 1,
  descricao: 'Rótulo para arame',
  tipoEmbalagemId: 'te-1',
  produtoGraficoId: 'prod-1',
  calculoGraficoOrigemId: 'calc-12992',
  medidas: { L: 190, A: 1200, largura: 190, altura: 1200 },
  papelId: '11111111-1111-4111-8111-111111111111',
  papelDescricao: 'Stora Enzo Bobina 415',
  suporteId: null,
  gramatura: '415',
  numCores: 3,
  cores: [
    { nome: 'Pantone 01', tipo: 'PANTONE', coberturaPercent: 40, precoKg: 71.5, rendimentoM2Kg: 25 },
    { nome: 'Pantone 02', tipo: 'PANTONE', coberturaPercent: 10, precoKg: 99, rendimentoM2Kg: 25 },
    { nome: 'Pantone 03', tipo: 'PANTONE', coberturaPercent: 10, precoKg: 170.5, rendimentoM2Kg: 25 },
  ],
  acabamentosRicos: [{ acabamentoId: 'ac-1', nome: 'Guilhotina', naturezaCusto: 'HORA_MAQUINA', custoHora: 77.69, producaoHora: 2000 }],
  maquinaId: '22222222-2222-4222-8222-222222222222',
  aproveitamentoManual: 3,
  formatoCorteLarguraMm: '650',
  formatoCorteAlturaMm: '1225',
  quantidade: 4000,
  siglaAcabado: 'ROT',
  tributacao: 'ICMS + IPI',
  qtdModelos: null,
  resultadoCalculo: { custoProducao: 5192.05, precoVenda: 7000, papel: { precoKg: 6.83 } },
  planos: [],
}

function produtoCatalogo(fixo: boolean) {
  return {
    produto: {
      id: 'prod-1',
      nome: 'Cartucho',
      modoFormato: 'TRES_DIMENSOES',
      formatoPadraoLargura: null,
      formatoPadraoAltura: null,
      exibeRestricoes: true,
      exibeInformacoesComplementares: false,
      semImpressao: false,
    },
    planos: [{ id: 'tp-1', nome: 'Cartucho', fixo, ordem: 1, padrao: true }],
    atividades: [],
    acondicionamento: [],
    itensDiversos: [],
    defaults: [],
  }
}

const PLANO = {
  plano: { id: 'tp-1', nome: 'Cartucho', fixo: true },
  defaultProduto: null,
  atividades: [],
  coberturas: [],
  suportes: [],
  itensDiversosAutomaticos: [],
}

function orcamento(itens: unknown[]) {
  return {
    id: 'orc-1',
    numero: 3233,
    status: 'RASCUNHO',
    linhaProdutoId: null,
    tipoEmbalagem: { codigo: 'CG-EMB-1', descricao: 'Cartuchos' },
    itens,
  }
}

function prepararApi({ fixo = true, itens = [ITEM] }: { fixo?: boolean; itens?: unknown[] } = {}) {
  get.mockImplementation((url: string) => {
    if (url === '/orcamento-grafico/orc-1') return Promise.resolve({ data: orcamento(itens) })
    if (url.includes('/catalogo/produto/')) return Promise.resolve({ data: produtoCatalogo(fixo) })
    if (url.includes('/catalogo/plano/')) return Promise.resolve({ data: { ...PLANO, plano: { ...PLANO.plano, fixo } } })
    if (url.includes('/tipos-embalagem')) return Promise.resolve({ data: [TIPO] })
    if (url.endsWith('/produtos/prod-1')) {
      return Promise.resolve({ data: { id: 'prod-1', nome: 'Cartucho', status: true, linhaProdutoId: null } })
    }
    return Promise.resolve({ data: [] })
  })
}

function renderizar(itemId = 'item-1') {
  return render(
    <MantineProvider>
      <TelaItem orcamentoId="orc-1" itemId={itemId} />
    </MantineProvider>,
  )
}

async function esperarTela() {
  await screen.findByTestId('tela-item')
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('TelaItem — carga e blocos por estrutura', () => {
  it('plano único: título com o produto e blocos do plano implícito, sem "Tipos de Plano"', async () => {
    prepararApi({ fixo: true })
    renderizar()
    await esperarTela()
    await waitFor(() => expect(screen.getByTestId('tela-item')).toHaveAttribute('data-estrutura', 'PLANO_UNICO'))

    expect(screen.getByTestId('tela-item-titulo')).toHaveTextContent('Item — Cartucho')
    expect(screen.getByRole('link', { name: 'Orçamento nº 3233' })).toHaveAttribute('href', '/orcamento-grafico/orc-1')
    for (const id of ['bloco-comum', 'bloco-formato', 'bloco-plano-unico', 'bloco-acabamento', 'acabamentos-de-produto',
      'acondicionamento-bloco', 'complementos-do-item', 'margem-do-item', 'bloco-estrutura-custo']) {
      expect(screen.getByTestId(id)).toBeInTheDocument()
    }
    expect(screen.queryByTestId('tipos-de-plano')).toBeNull()
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Calcular' })).toBeInTheDocument()
    // Cores NxM vindas do numCores do item.
    expect((screen.getByLabelText('Cores') as HTMLInputElement).value).toBe('3x0')
  })

  it('multi-plano: sem os blocos do plano e com o espaço "Tipos de Plano"', async () => {
    prepararApi({ fixo: false })
    renderizar()
    await esperarTela()
    await waitFor(() => expect(screen.getByTestId('tela-item')).toHaveAttribute('data-estrutura', 'MULTI_PLANO'))

    expect(screen.getByTestId('tipos-de-plano')).toBeInTheDocument()
    expect(screen.queryByTestId('bloco-plano-unico')).toBeNull()
    expect(screen.queryByTestId('bloco-acabamento')).toBeNull()
    expect(screen.getByTestId('bloco-comum')).toBeInTheDocument()
    expect(screen.getByTestId('acondicionamento-bloco')).toBeInTheDocument()
  })
})

describe('TelaItem — salvar', () => {
  it('plano único: PUT com o mesmo payload de engenharia do editor atual, sem planos', async () => {
    prepararApi({ fixo: true })
    put.mockResolvedValue({ data: { id: 'item-1' } })
    renderizar()
    await esperarTela()
    await waitFor(() => expect(screen.getByTestId('tela-item')).toHaveAttribute('data-estrutura', 'PLANO_UNICO'))

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1))

    const [url, payload] = put.mock.calls[0] as [string, Record<string, unknown>]
    expect(url).toBe('/orcamento-grafico/orc-1/itens/item-1')
    expect(post).not.toHaveBeenCalled()

    // O que o EditorItem enviaria para o mesmo item (mesma hidratação, montarPayloadItem intocado).
    const doEditor = montarPayloadItem(itemParaForm(itemParaEditar(ITEM, orcamento([]).tipoEmbalagem), 'orc-1'))
    for (const [chave, valor] of Object.entries(doEditor)) expect(payload[chave]).toEqual(valor)
    expect(payload).toMatchObject({
      aproveitamentoManual: 3,
      formatoCorteLarguraMm: 650,
      formatoCorteAlturaMm: 1225,
      papelId: ITEM.papelId,
      medidas: ITEM.medidas,
      acabamentosRicos: ITEM.acabamentosRicos,
      quantidade: 4000,
    })
    // Fora do motor: descrição preservada e numCores = N + M.
    expect(payload.descricao).toBe('Rótulo para arame')
    expect(payload.numCores).toBe(3)
    // Nunca cria PlanoCalculoGrafico.
    expect(payload).not.toHaveProperty('planos')
    const chavesExtras = Object.keys(payload).filter((k) => !(k in doEditor))
    expect(chavesExtras.sort()).toEqual(['descricao', 'numCores'])
  })

  it('erro do servidor: mostra campo e motivo e mantém os valores digitados', async () => {
    prepararApi({ fixo: true })
    put.mockRejectedValue({ response: { status: 400, data: { message: 'Dados inválidos — quantidade: Número deve ser maior que 0' } } })
    renderizar()
    await esperarTela()
    await waitFor(() => expect(screen.getByTestId('tela-item')).toHaveAttribute('data-estrutura', 'PLANO_UNICO'))

    const descricao = screen.getByLabelText('Descrição') as HTMLInputElement
    fireEvent.change(descricao, { target: { value: 'Descrição nova' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByTestId('tela-item-erro')).toHaveTextContent('Dados inválidos — quantidade: Número deve ser maior que 0')
    expect((screen.getByLabelText('Descrição') as HTMLInputElement).value).toBe('Descrição nova')
    expect(push).not.toHaveBeenCalled()
    expect(replace).not.toHaveBeenCalled()
  })

  it('erro de validação: não envia e informa campo e motivo', async () => {
    prepararApi({ fixo: true })
    renderizar()
    await esperarTela()
    await waitFor(() => expect(screen.getByTestId('tela-item')).toHaveAttribute('data-estrutura', 'PLANO_UNICO'))

    fireEvent.change(screen.getByLabelText('Modelos'), { target: { value: '0' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByTestId('tela-item-erro')).toHaveTextContent('Modelos:')
    expect(put).not.toHaveBeenCalled()
  })
})

describe('TelaItem — alterações não salvas', () => {
  it('com alteração, sair pelas migalhas pede confirmação', async () => {
    prepararApi({ fixo: true })
    renderizar()
    await esperarTela()

    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Mudou' } })
    fireEvent.click(screen.getByRole('link', { name: 'Orçamento nº 3233' }))

    const dialogo = await screen.findByRole('dialog')
    expect(within(dialogo).getByText('Sair sem salvar?')).toBeInTheDocument()
    expect(push).not.toHaveBeenCalled()

    fireEvent.click(within(dialogo).getByRole('button', { name: 'Sair sem salvar' }))
    expect(push).toHaveBeenCalledWith('/orcamento-grafico/orc-1')
  })

  it('sem alteração, o botão de voltar sai direto', async () => {
    prepararApi({ fixo: true })
    renderizar()
    await esperarTela()

    fireEvent.click(screen.getByRole('button', { name: 'Voltar ao orçamento' }))
    expect(push).toHaveBeenCalledWith('/orcamento-grafico/orc-1')
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('beforeunload é bloqueado só com alteração', async () => {
    prepararApi({ fixo: true })
    renderizar()
    await esperarTela()

    const semAlteracao = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(semAlteracao)
    expect(semAlteracao.defaultPrevented).toBe(false)

    fireEvent.change(screen.getByLabelText('Descrição'), { target: { value: 'Mudou' } })
    const comAlteracao = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(comAlteracao)
    expect(comAlteracao.defaultPrevented).toBe(true)
  })
})

describe('TelaItem — item novo', () => {
  it('cria o item com POST e vai para a URL do id criado', async () => {
    prepararApi({ fixo: true })
    post.mockResolvedValue({ data: { id: 'item-novo' } })
    renderizar('novo')
    await esperarTela()
    expect(screen.getByTestId('tela-item-titulo')).toHaveTextContent('Novo item')

    // Tipo de Produto (BlocoComum) e papel (gramatura + preço) são os obrigatórios do item.
    fireEvent.click(screen.getByRole('textbox', { name: 'Tipo de Produto' }))
    fireEvent.click(await screen.findByRole('option', { name: 'Cartuchos' }))
    fireEvent.click(screen.getByRole('button', { name: 'Papel de teste' }))

    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))
    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))

    const [url, payload] = post.mock.calls[0] as [string, Record<string, unknown>]
    expect(url).toBe('/orcamento-grafico/orc-1/itens')
    expect(payload).toMatchObject({ tipoEmbalagemId: 'te-1', gramatura: 300, precoKg: 5, quantidade: 10000 })
    expect(payload).not.toHaveProperty('planos')
    expect(put).not.toHaveBeenCalled()
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/orcamento-grafico/orc-1/itens/item-novo'))
  })
})
