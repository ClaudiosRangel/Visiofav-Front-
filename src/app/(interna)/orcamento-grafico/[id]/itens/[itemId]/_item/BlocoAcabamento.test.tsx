import './ambiente-dom.test-util'
import { useState } from 'react'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { atividade } = vi.hoisted(() => ({ atividade: vi.fn() }))
vi.mock('../../../../cadastros/_shared/cadastros-graficos.api', () => ({ catalogoApi: { atividade } }))

import type { WizardFormData } from '../../../../novo/page'
import type { SelecaoMaterial } from '../../../../cadastros/_shared/cadastros-graficos.types'
import { novoAcabamentoRico, type AtividadeCadastro } from './acabamento-item'
import BlocoAcabamento, { type BlocoAcabamentoProps } from './BlocoAcabamento'
import { TEXTO_NAO_GRAVADA, TEXTO_SEM_ATIVIDADE } from './RestricoesEMateriais'

const ativ = (id: string, nome: string): AtividadeCadastro => ({
  id,
  nome,
  codigo: id.toUpperCase(),
  naturezaCusto: 'HORA_MAQUINA',
})
const ATIVIDADES = [ativ('a1', 'AFT70 Coladeira'), ativ('a2', 'Bimac Acoplagem'), ativ('a3', 'Corte e Vinco')]

const RESPOSTA = {
  restricoes: [{ id: 'r1', nome: 'Lateral Simples' }],
  materiais: [{ id: 'm1', nome: 'Cola Branca', tipoParam: 2, ordem: 1, padrao: true }],
}

type Selecao = NonNullable<BlocoAcabamentoProps['selecao']>

function criarSelecao(parcial: Partial<Selecao> = {}): Selecao {
  return {
    selecoes: [],
    pendentes: [],
    ocupados: {},
    erros: {},
    escolher: vi.fn().mockResolvedValue(true),
    limpar: vi.fn().mockResolvedValue(undefined),
    ...parcial,
  }
}

interface Props {
  inicial?: WizardFormData['acabamentosRicos']
  selecao?: Selecao
  recolhida?: boolean
  atividades?: AtividadeCadastro[]
  catalogoDoPlano?: BlocoAcabamentoProps['catalogoDoPlano']
  avisoLista?: string | null
  onTentarNovamente?: () => void
}

function Pagina({ inicial = [], selecao, recolhida = false, atividades = ATIVIDADES, catalogoDoPlano, avisoLista, onTentarNovamente }: Props) {
  const [valor, setValor] = useState<Pick<WizardFormData, 'acabamentosRicos'>>({ acabamentosRicos: inicial })
  return (
    <MantineProvider>
      <BlocoAcabamento
        atividades={atividades}
        value={valor}
        onChange={setValor}
        layout={{ restricoes: recolhida ? 'RECOLHIDA' : 'EXPANDIDA' }}
        catalogoDoPlano={catalogoDoPlano}
        selecao={selecao}
        avisoLista={avisoLista}
        onTentarNovamente={onTentarNovamente}
      />
    </MantineProvider>
  )
}

describe('BlocoAcabamento (R8.3, R11)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    atividade.mockResolvedValue(RESPOSTA)
  })

  it('lista as atividades do cadastro e mostra a orientação sem atividade em foco', () => {
    render(<Pagina selecao={criarSelecao()} />)
    for (const a of ATIVIDADES) expect(screen.getByLabelText(a.nome)).toBeInTheDocument()
    expect(screen.getByText(TEXTO_SEM_ATIVIDADE)).toBeInTheDocument()
    expect(screen.getByTestId('bloco-acabamento-contagem')).toHaveTextContent('0 marcadas')
    expect(atividade).not.toHaveBeenCalled()
  })

  it('atividades pré-marcadas já vêm marcadas e as do catálogo levam o selo Padrão', () => {
    render(
      <Pagina
        inicial={[novoAcabamentoRico(ATIVIDADES[1])]}
        selecao={criarSelecao()}
        catalogoDoPlano={{ atividades: [{ id: 'a2', preMarcada: true, materiais: [], restricoes: [] } as never] }}
      />,
    )
    expect(screen.getByLabelText('Bimac Acoplagem')).toBeChecked()
    expect(screen.getByLabelText('AFT70 Coladeira')).not.toBeChecked()
    expect(screen.getByText('Padrão')).toBeInTheDocument()
    expect(screen.getByTestId('bloco-acabamento-contagem')).toHaveTextContent('1 marcada')
  })

  it('marcar uma atividade a coloca em foco e carrega suas restrições e materiais', async () => {
    render(<Pagina selecao={criarSelecao()} />)
    fireEvent.click(screen.getByLabelText('AFT70 Coladeira'))

    expect(screen.getByLabelText('AFT70 Coladeira')).toBeChecked()
    expect(screen.getByTestId('bloco-acabamento-contagem')).toHaveTextContent('1 marcada')
    expect(await screen.findByLabelText('Lateral Simples')).toBeInTheDocument()
    expect(screen.getByLabelText('Cola Branca')).toBeInTheDocument()
    expect(atividade.mock.calls[0][0]).toBe('a1')
    expect(screen.getByText('Atividade em foco: AFT70 Coladeira')).toBeInTheDocument()
  })

  it('clicar numa atividade sem marcá-la só muda o foco', async () => {
    render(<Pagina selecao={criarSelecao()} />)
    fireEvent.click(screen.getByText('Bimac Acoplagem'))
    expect(await screen.findByText('Atividade em foco: Bimac Acoplagem')).toBeInTheDocument()
    expect(screen.getByLabelText('Bimac Acoplagem')).not.toBeChecked()
  })

  it('marcar escolhe o material padrão do catálogo; desmarcar limpa a escolha', async () => {
    const selecao = criarSelecao()
    render(
      <Pagina
        selecao={selecao}
        catalogoDoPlano={{
          atividades: [
            { id: 'a1', preMarcada: false, restricoes: RESPOSTA.restricoes, materiais: RESPOSTA.materiais } as never,
          ],
        }}
      />,
    )
    fireEvent.click(screen.getByLabelText('AFT70 Coladeira'))
    expect(selecao.escolher).toHaveBeenCalledWith(expect.objectContaining({ acabamentoId: 'a1', materialId: 'm1' }))

    fireEvent.click(screen.getByLabelText('AFT70 Coladeira'))
    expect(screen.getByLabelText('AFT70 Coladeira')).not.toBeChecked()
    expect(selecao.limpar).toHaveBeenCalledWith('a1')
  })

  it('a busca filtra a lista sem perder as marcações', () => {
    render(<Pagina selecao={criarSelecao()} inicial={[novoAcabamentoRico(ATIVIDADES[0])]} />)
    fireEvent.change(screen.getByLabelText('Buscar atividade'), { target: { value: 'corte' } })
    expect(screen.queryByLabelText('AFT70 Coladeira')).toBeNull()
    expect(screen.getByLabelText('Corte e Vinco')).toBeInTheDocument()
    expect(screen.getByTestId('bloco-acabamento-contagem')).toHaveTextContent('1 marcada')

    fireEvent.change(screen.getByLabelText('Buscar atividade'), { target: { value: 'zzz' } })
    expect(screen.getByText('Nenhuma atividade encontrada.')).toBeInTheDocument()
  })

  it('restrição escolhida é guardada no item e gravada junto da seleção de material', async () => {
    const selecao = criarSelecao({
      selecoes: [
        {
          id: 's1', itemId: 'i1', planoId: null, acabamentoId: 'a1', materialId: 'm1', restricaoId: null,
          tipoParam: 2, param1: null, param2: null, consumo: null, unidadeConsumo: null, valorUnitario: null,
          custo: 0, aplicaNoPreco: false, situacaoParametro: 'OK',
        } as SelecaoMaterial,
      ],
    })
    render(<Pagina selecao={selecao} inicial={[novoAcabamentoRico(ATIVIDADES[0])]} />)
    fireEvent.click(screen.getByText('AFT70 Coladeira'))
    fireEvent.click(await screen.findByLabelText('Lateral Simples'))

    await waitFor(() => expect(screen.getByLabelText('Lateral Simples')).toBeChecked())
    expect(selecao.escolher).toHaveBeenCalledWith(
      expect.objectContaining({ acabamentoId: 'a1', materialId: 'm1', restricaoId: 'r1' }),
    )
  })

  it('gravação da restrição que falha restaura a restrição anterior e avisa', async () => {
    const selecao = criarSelecao({
      selecoes: [
        {
          id: 's1', itemId: 'i1', planoId: null, acabamentoId: 'a1', materialId: 'm1', restricaoId: null,
          tipoParam: 2, param1: null, param2: null, consumo: null, unidadeConsumo: null, valorUnitario: null,
          custo: 0, aplicaNoPreco: false, situacaoParametro: 'OK',
        } as SelecaoMaterial,
      ],
      escolher: vi.fn().mockResolvedValue(false),
    })
    render(<Pagina selecao={selecao} inicial={[novoAcabamentoRico(ATIVIDADES[0])]} />)
    fireEvent.click(screen.getByText('AFT70 Coladeira'))
    fireEvent.click(await screen.findByLabelText('Lateral Simples'))

    expect(await screen.findByText(TEXTO_NAO_GRAVADA)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByLabelText('Lateral Simples')).not.toBeChecked())
  })

  it('restrição sem material escolhido fica só no item (não chama a seleção)', async () => {
    const selecao = criarSelecao()
    render(<Pagina selecao={selecao} inicial={[novoAcabamentoRico(ATIVIDADES[0])]} />)
    fireEvent.click(screen.getByText('AFT70 Coladeira'))
    fireEvent.click(await screen.findByLabelText('Lateral Simples'))
    await waitFor(() => expect(screen.getByLabelText('Lateral Simples')).toBeChecked())
    expect(selecao.escolher).not.toHaveBeenCalled()
  })

  it('exibeRestricoes falso: Restrições recolhidas com título e contagem', async () => {
    render(<Pagina selecao={criarSelecao()} recolhida inicial={[novoAcabamentoRico(ATIVIDADES[0])]} />)
    fireEvent.click(screen.getByText('AFT70 Coladeira'))
    await screen.findByLabelText('Cola Branca')
    expect(screen.queryByLabelText('Lateral Simples')).toBeNull()
    expect(screen.getByTestId('lista-restricoes')).toHaveTextContent('Restrições')
  })

  it('lista vazia e aviso de lista incompleta com Tentar novamente', () => {
    const tentar = vi.fn()
    const { unmount } = render(<Pagina atividades={[]} selecao={criarSelecao()} />)
    expect(screen.getByText('Nenhuma atividade cadastrada.')).toBeInTheDocument()
    unmount()

    render(<Pagina avisoLista="A lista de acabamentos pode estar incompleta." onTentarNovamente={tentar} selecao={criarSelecao()} />)
    expect(screen.getByText('A lista de acabamentos pode estar incompleta.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(tentar).toHaveBeenCalledTimes(1)
  })
})
