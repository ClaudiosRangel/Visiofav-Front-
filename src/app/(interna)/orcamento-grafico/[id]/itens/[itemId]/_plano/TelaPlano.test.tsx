import '../_item/ambiente-dom.test-util'
import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { get, post, put, del, push } = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  del: vi.fn(),
  push: vi.fn(),
}))

vi.mock('@/lib/api', () => ({ api: { get, post, put, patch: vi.fn(), delete: del } }))
vi.mock('@mantine/notifications', () => ({ notifications: { show: vi.fn() } }))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
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

import TelaPlano, { AVISO_CUSTO_ANCORADO, MSG_PLANO_NAO_GRAVADO } from './TelaPlano'
import { lerPilha } from './pilha-store'

const URL_ITEM = '/orcamento-grafico/orc-1/itens/item-1'

const TIPO_CARTAO = {
  id: '11111111-1111-4111-8111-111111111111',
  nome: 'Cartão',
  fixo: false,
  ordem: 1,
  padrao: true,
  suportePadraoId: '33333333-3333-4333-8333-333333333333',
  gramaturaPadrao: '300',
  fibraDefault: 'Longitudinal',
  prevCapaExterna: true,
  prevMicroondulado: false,
  prevCapaInterna: false,
  prevFibra: null,
}

const TIPO_MICRO = {
  id: '22222222-2222-4222-8222-222222222222',
  nome: 'Microondulado',
  fixo: false,
  ordem: 2,
  padrao: false,
  suportePadraoId: null,
  gramaturaPadrao: null,
  fibraDefault: null,
  prevCapaExterna: null,
  prevMicroondulado: null,
  prevCapaInterna: null,
  prevFibra: null,
}

const ATIVIDADE = { id: 'ac-1', nome: 'Corte e vinco', naturezaCusto: 'HORA_MAQUINA', preMarcada: true, restricoes: [], materiais: [] }

function catalogoPlano(tipo: typeof TIPO_CARTAO | typeof TIPO_MICRO) {
  return {
    plano: tipo,
    defaultProduto:
      tipo.id === TIPO_CARTAO.id
        ? {
            id: 'def-1',
            produtoId: 'prod-1',
            tipoPlanoId: tipo.id,
            semImpressao: false,
            processoImpressaoId: 'proc-1',
            coberturaTintaId: null,
            coresFrente: 4,
            coresVerso: 1,
            areaTintaPerc: '30',
            fabricanteSuporte: 'Suzano',
            atividadesPreMarcadas: ['ac-1'],
          }
        : null,
    atividades: [ATIVIDADE],
    coberturas: [],
    suportes: [],
    itensDiversosAutomaticos: [],
  }
}

const PLANO_GRAVADO = {
  id: 'pl-1',
  sequencia: 1,
  nome: 'Tampa',
  tipoPlanoId: TIPO_CARTAO.id,
  suporteId: TIPO_CARTAO.suportePadraoId,
  suporteProducaoId: null,
  gramatura: '300',
  formatoLarguraMm: '650',
  formatoAlturaMm: '1225',
  numCores: 4,
  cores: null,
  maquinaId: null,
  acabamentosRicos: [{ acabamentoId: 'ac-1', nome: 'Corte e vinco' }],
  custoSuporte: '0',
  custoImpressao: '0',
  custoAcabamento: '0',
  especificacao: {
    versao: 1,
    cores: '4x0',
    processoImpressao: 'Offset Plana',
    capaExterna: { fabricante: 'Suzano', suporteId: TIPO_CARTAO.suportePadraoId, suporteNome: 'Duplex 300', fornecido: false, fibra: 'Longitudinal' },
  },
}

function prepararApi({ ancorado = false }: { ancorado?: boolean } = {}) {
  get.mockImplementation((url: string) => {
    if (url === '/orcamento-grafico/orc-1') {
      return Promise.resolve({
        data: {
          id: 'orc-1',
          numero: 3233,
          status: 'RASCUNHO',
          itens: [
            { id: 'item-1', quantidade: 4000, produtoGraficoId: 'prod-1', calculoGraficoOrigemId: ancorado ? 'calc-12992' : null },
          ],
        },
      })
    }
    if (url === `${URL_ITEM}/planos/pl-1`) {
      return Promise.resolve({ data: PLANO_GRAVADO })
    }
    if (url.includes('/catalogo/produto/')) {
      return Promise.resolve({
        data: {
          produto: { id: 'prod-1', nome: 'Caixa', exibeRestricoes: true },
          planos: [TIPO_CARTAO, TIPO_MICRO],
          atividades: [],
          acondicionamento: [],
          itensDiversos: [],
          defaults: [],
        },
      })
    }
    if (url.includes(`/catalogo/plano/${TIPO_CARTAO.id}`)) return Promise.resolve({ data: catalogoPlano(TIPO_CARTAO) })
    if (url.includes(`/catalogo/plano/${TIPO_MICRO.id}`)) return Promise.resolve({ data: catalogoPlano(TIPO_MICRO) })
    if (url.includes('/processos-impressao')) return Promise.resolve({ data: [{ id: 'proc-1', nome: 'Offset Plana' }] })
    return Promise.resolve({ data: [] })
  })
}

function renderizar(planoId: string, posicaoApos: string | null = null) {
  return render(
    <MantineProvider>
      <TelaPlano orcamentoId="orc-1" itemId="item-1" planoId={planoId} posicaoApos={posicaoApos} />
    </MantineProvider>,
  )
}

const campo = (nome: RegExp) => screen.getByRole('textbox', { name: nome }) as HTMLInputElement
const digitar = (nome: RegExp, valor: string) => fireEvent.change(campo(nome), { target: { value: valor } })

async function esperarPlanoGravado() {
  await screen.findByTestId('tela-plano')
  await waitFor(() => expect(campo(/^Nome/).value).toBe('Tampa'))
}

describe('TelaPlano (R10, R13, R15.7)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prepararApi()
  })

  it('plano gravado: título, migalhas e valores gravados, sem reaplicar padrões', async () => {
    renderizar('pl-1')
    await esperarPlanoGravado()
    expect(screen.getByTestId('tela-plano-titulo')).toHaveTextContent('Plano — Tampa')
    expect(screen.getByRole('link', { name: 'Orçamento nº 3233' })).toHaveAttribute('href', '/orcamento-grafico/orc-1')
    expect(screen.getByRole('link', { name: 'Item' })).toHaveAttribute('href', URL_ITEM)
    // Padrão do tipo seria 4x1; o gravado é 4x0 e fica.
    expect(campo(/^Cores/).value).toBe('4x0')
    expect(campo(/^Tiragem/).value).toBe('4000')
    expect(campo(/^Formato Aberto/).value).toMatch(/^650 x /)
    // Tipo Cartão: sem microondulado nem capa interna.
    expect(screen.getByTestId('bloco-capa-externa')).toBeInTheDocument()
    expect(screen.queryByTestId('bloco-microondulado')).not.toBeInTheDocument()
    expect(screen.queryByTestId('bloco-capa-interna')).not.toBeInTheDocument()
    // Nenhum campo de item.
    expect(screen.queryByRole('textbox', { name: /Descrição/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /Tipo de Produto/ })).not.toBeInTheDocument()
  })

  it('trocar o tipo muda os blocos exibidos (microondulado mostra os três)', async () => {
    renderizar('pl-1')
    await esperarPlanoGravado()
    fireEvent.click(campo(/Tipo de Plano/))
    fireEvent.click(await screen.findByRole('option', { name: 'Microondulado' }))
    expect(await screen.findByTestId('bloco-microondulado')).toBeInTheDocument()
    expect(screen.getByTestId('bloco-capa-interna')).toBeInTheDocument()
    // Plano gravado: trocar o tipo não reaplica padrões.
    expect(campo(/^Nome/).value).toBe('Tampa')
  })

  it('Cancelar volta ao item sem chamar a API de gravação', async () => {
    renderizar('pl-1')
    await esperarPlanoGravado()
    digitar(/^Nome/, 'Tampa alterada')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(push).toHaveBeenCalledWith(URL_ITEM)
    expect(post).not.toHaveBeenCalled()
    expect(put).not.toHaveBeenCalled()
    expect(del).not.toHaveBeenCalled()
  })

  it('OK sem mudança em plano gravado volta sem chamar a API', async () => {
    renderizar('pl-1')
    await esperarPlanoGravado()
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(push).toHaveBeenCalledWith(URL_ITEM))
    expect(put).not.toHaveBeenCalled()
    expect(post).not.toHaveBeenCalled()
  })

  it('OK com mudança grava (PUT) com `especificacao` e volta ao item', async () => {
    put.mockResolvedValue({ data: { ...PLANO_GRAVADO, nome: 'Tampa nova' } })
    renderizar('pl-1')
    await esperarPlanoGravado()
    digitar(/^Nome/, 'Tampa nova')
    digitar(/^Ocorrências/, '2')
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    await waitFor(() => expect(put).toHaveBeenCalledTimes(1))
    const [url, body] = put.mock.calls[0]
    expect(url).toBe(`${URL_ITEM}/planos/pl-1`)
    expect(body).toMatchObject({
      nome: 'Tampa nova',
      tipoPlanoId: TIPO_CARTAO.id,
      suporteId: TIPO_CARTAO.suportePadraoId,
      formatoLarguraMm: 650,
      formatoAlturaMm: 1225,
      numCores: 4,
      gramatura: 300,
      especificacao: {
        versao: 1,
        ocorrencias: 2,
        tiragem: null,
        cores: '4x0',
        processoImpressao: 'Offset Plana',
        capaExterna: { suporteId: TIPO_CARTAO.suportePadraoId, fabricante: 'Suzano', fibra: 'Longitudinal' },
        microondulado: null,
        capaInterna: null,
      },
    })
    expect(body).not.toHaveProperty('posicaoApos')
    await waitFor(() => expect(push).toHaveBeenCalledWith(URL_ITEM))
  })

  it('erro de gravação mantém o formulário e mostra "campo: motivo"', async () => {
    put.mockRejectedValue({ response: { status: 400, data: { message: 'Dados inválidos — nome: muito longo' } } })
    renderizar('pl-1')
    await esperarPlanoGravado()
    digitar(/^Nome/, 'Tampa com erro')
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    const alerta = await screen.findByTestId('tela-plano-erro')
    expect(alerta).toHaveTextContent(MSG_PLANO_NAO_GRAVADO)
    expect(alerta).toHaveTextContent('nome: muito longo')
    expect(campo(/^Nome/).value).toBe('Tampa com erro')
    expect(push).not.toHaveBeenCalled()
  })

  it('validação: obrigatórios com erro no próprio campo e sem gravar', async () => {
    renderizar('pl-1')
    await esperarPlanoGravado()
    digitar(/^Nome/, '')
    digitar(/^Cores/, '13x0')
    digitar(/^Processo de Impressão/, '')
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    expect(await screen.findByTestId('tela-plano-erro')).toHaveTextContent('Nome: Campo obrigatório')
    expect(screen.getByText('Use de 0 a 12 cores por lado')).toBeInTheDocument()
    expect(put).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })

  it('plano novo: aplica o DefaultProdutoPlano do tipo e cria com `posicaoApos` e `especificacao`', async () => {
    post.mockResolvedValue({ data: { id: 'pl-novo' } })
    renderizar('novo', 'pl-1')
    await screen.findByTestId('tela-plano')
    expect(screen.getByTestId('tela-plano-titulo')).toHaveTextContent('Novo plano')
    expect(campo(/^Tiragem/).value).toBe('4000')

    fireEvent.click(campo(/Tipo de Plano/))
    fireEvent.click(await screen.findByRole('option', { name: 'Cartão' }))

    await waitFor(() => expect(campo(/^Nome/).value).toBe('Cartão'))
    expect(campo(/^Cores/).value).toBe('4x1')
    await waitFor(() => expect(campo(/^Processo de Impressão/).value).toBe('Offset Plana'))
    expect(campo(/^Cobertura de Tinta/).value).toBe('30')
    const capa = screen.getByTestId('bloco-capa-externa')
    expect((within(capa).getByRole('textbox', { name: /^Fabricante/ }) as HTMLInputElement).value).toBe('Suzano')
    expect((within(capa).getByRole('textbox', { name: /Fibra/ }) as HTMLInputElement).value).toBe('Longitudinal')
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Corte e vinco' })).toBeChecked())

    digitar(/^Formato Aberto/, '650 x 1225,5')
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))

    await waitFor(() => expect(post).toHaveBeenCalledTimes(1))
    const [url, body] = post.mock.calls[0]
    expect(url).toBe(`${URL_ITEM}/planos`)
    expect(body).toMatchObject({
      nome: 'Cartão',
      tipoPlanoId: TIPO_CARTAO.id,
      suporteId: TIPO_CARTAO.suportePadraoId,
      gramatura: 300,
      formatoLarguraMm: 650,
      formatoAlturaMm: 1225.5,
      numCores: 5,
      posicaoApos: 'pl-1',
      acabamentosRicos: [expect.objectContaining({ acabamentoId: 'ac-1', nome: 'Corte e vinco' })],
      especificacao: {
        versao: 1,
        cores: '4x1',
        processoImpressao: 'Offset Plana',
        coberturaTinta: 30,
        formatoAberto: { largura: 650, altura: 1225.5 },
        capaExterna: { fabricante: 'Suzano', suporteId: TIPO_CARTAO.suportePadraoId, fibra: 'Longitudinal' },
        microondulado: null,
        capaInterna: null,
      },
    })
    // Sem null dentro das linhas de acabamento (o back rejeita).
    for (const linha of body.acabamentosRicos as Record<string, unknown>[]) {
      expect(Object.values(linha)).not.toContain(null)
    }
    await waitFor(() => expect(push).toHaveBeenCalledWith(URL_ITEM))
    expect(lerPilha('item-1').itens.at(-1)).toEqual({ tipo: 'EXCLUIR_PLANO', planoId: 'pl-novo' })
  })

  it('plano novo sem tipo nem formato: erros no campo e nada é criado', async () => {
    renderizar('novo')
    await screen.findByTestId('tela-plano')
    fireEvent.click(screen.getByRole('button', { name: 'OK' }))
    const alerta = await screen.findByTestId('tela-plano-erro')
    expect(alerta).toHaveTextContent('Tipo de Plano: Campo obrigatório')
    expect(alerta).toHaveTextContent('Formato Aberto (largura)')
    expect(post).not.toHaveBeenCalled()
  })

  describe('item com custo ancorado (R15.7)', () => {
    beforeEach(() => prepararApi({ ancorado: true }))

    it('mostra o aviso e, sem mudança, OK não chama a API nem pede confirmação', async () => {
      renderizar('pl-1')
      await esperarPlanoGravado()
      expect(screen.getByTestId('aviso-custo-ancorado')).toHaveTextContent(AVISO_CUSTO_ANCORADO)
      fireEvent.click(screen.getByRole('button', { name: 'OK' }))
      await waitFor(() => expect(push).toHaveBeenCalledWith(URL_ITEM))
      expect(screen.queryByTestId('confirmar-custo-ancorado')).not.toBeInTheDocument()
      expect(put).not.toHaveBeenCalled()
    })

    it('com mudança, pede confirmação com o aviso antes de gravar', async () => {
      put.mockResolvedValue({ data: PLANO_GRAVADO })
      renderizar('pl-1')
      await esperarPlanoGravado()
      digitar(/^Nome/, 'Tampa 2')
      fireEvent.click(screen.getByRole('button', { name: 'OK' }))
      expect(await screen.findByTestId('confirmar-custo-ancorado')).toHaveTextContent(AVISO_CUSTO_ANCORADO)
      expect(put).not.toHaveBeenCalled()
      fireEvent.click(screen.getByRole('button', { name: 'Gravar mesmo assim' }))
      await waitFor(() => expect(put).toHaveBeenCalledTimes(1))
      expect(put.mock.calls[0][1]).toMatchObject({ nome: 'Tampa 2', especificacao: { versao: 1 } })
      await waitFor(() => expect(push).toHaveBeenCalledWith(URL_ITEM))
    })
  })
})
