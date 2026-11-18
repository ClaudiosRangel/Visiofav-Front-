import './ambiente-dom.test-util'
import { useState } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { get } = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { get, post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))

import { resolverLayoutItem } from '../../../_layout/resolver-layout-item'
import BlocoPlanoUnico from './BlocoPlanoUnico'
import { planoUnicoVazio, type ValorPlanoUnico } from './plano-unico-item'

const PRODUTO = {
  modoFormato: 'TRES_DIMENSOES',
  formatoPadraoLargura: null,
  formatoPadraoAltura: null,
  exibeRestricoes: true,
  exibeInformacoesComplementares: false,
  semImpressao: false,
}

function layoutDe(opcoes: { fixo?: boolean; micro?: boolean } = {}) {
  return resolverLayoutItem({
    produto: PRODUTO,
    tiposPlano: [{ id: 't', fixo: opcoes.fixo !== false, previsao: { microondulado: opcoes.micro ?? null } }],
  })
}

/** O Autocomplete do Mantine também rotula a lista de opções; aqui interessa só o campo de digitação. */
function campo(rotulo: string): HTMLInputElement {
  const el = screen.getAllByLabelText(rotulo).find((e) => e.tagName === 'INPUT')
  if (!el) throw new Error(`Campo "${rotulo}" não encontrado`)
  return el as HTMLInputElement
}

interface Props {
  inicial?: Partial<ValorPlanoUnico>
  layout?: ReturnType<typeof layoutDe>
  onChangeEspiao?: (p: Partial<ValorPlanoUnico>) => void
  processoPre?: string | null
}

function Pagina({ inicial, layout = layoutDe(), onChangeEspiao, processoPre }: Props) {
  const [valor, setValor] = useState<ValorPlanoUnico>({ ...planoUnicoVazio(), ...inicial })
  return (
    <MantineProvider>
      <BlocoPlanoUnico
        value={valor}
        onChange={(p) => {
          onChangeEspiao?.(p)
          setValor((v) => ({ ...v, ...p }))
        }}
        layout={layout}
        montagem="2x2"
        formatoCorte="650 x 1225"
        suporte={<div>Seletor de suporte</div>}
        processoPre={processoPre}
        orcamentoId="orc-1"
      />
    </MantineProvider>
  )
}

describe('BlocoPlanoUnico', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    get.mockResolvedValue({ data: [{ nome: 'Offset Plana' }] })
  })

  it('plano único mostra todos os campos, o suporte e o botão Propriedades/Preview', () => {
    render(<Pagina />)
    for (const rotulo of [
      'Cores',
      'Processo de Impressão',
      'Cobertura de Tinta',
      'Fabricante',
      'Fornecido',
      'Microondulado',
      'Fibra',
      'Montagem',
      'Formato de Corte',
      'Ajuste Corte Micro (mm)',
    ]) {
      expect(campo(rotulo)).toBeInTheDocument()
    }
    expect(screen.getByText('Seletor de suporte')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Pré' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Travar processo' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Propriedades/Preview' })).toBeInTheDocument()
  })

  it('multi-plano não renderiza nada', () => {
    const { container } = render(<Pagina layout={layoutDe({ fixo: false })} />)
    expect(container.querySelector('[data-testid="bloco-plano-unico"]')).toBeNull()
  })

  it('cadastro sem microondulado oculta Microondulado e Ajuste Corte Micro', () => {
    render(<Pagina layout={layoutDe({ micro: false })} />)
    expect(screen.queryByLabelText('Microondulado')).toBeNull()
    expect(screen.queryByLabelText('Ajuste Corte Micro (mm)')).toBeNull()
    expect(screen.getByLabelText('Fibra')).toBeInTheDocument()
  })

  it('Montagem e Formato de Corte são somente leitura e mostram o valor calculado', () => {
    render(<Pagina />)
    const montagem = screen.getByLabelText('Montagem') as HTMLInputElement
    const corte = screen.getByLabelText('Formato de Corte') as HTMLInputElement
    expect(montagem).toHaveAttribute('readonly')
    expect(corte).toHaveAttribute('readonly')
    expect(montagem.value).toBe('2x2')
    expect(corte.value).toBe('650 x 1225')
  })

  it('digitar Cores e Fabricante chama onChange com o campo alterado', () => {
    const espiao = vi.fn()
    render(<Pagina onChangeEspiao={espiao} />)
    fireEvent.change(screen.getByLabelText('Cores'), { target: { value: '5x0' } })
    fireEvent.change(screen.getByLabelText('Fabricante'), { target: { value: 'Acme' } })
    expect(espiao).toHaveBeenCalledWith({ cores: '5x0' })
    expect(espiao).toHaveBeenCalledWith({ fabricante: 'Acme' })
  })

  it('Cores inválidas e Ajuste Corte Micro fora da faixa mostram erro junto ao campo', () => {
    render(<Pagina inicial={{ cores: '13x0', ajusteCorteMicro: '100,01' }} />)
    expect(screen.getByText('Use de 0 a 12 cores em cada lado.')).toBeInTheDocument()
    expect(screen.getByText('Valor máximo: 100,00 mm.')).toBeInTheDocument()
  })

  it('Pré aplica o processo padrão; o cadeado trava o campo e o Pré', () => {
    const espiao = vi.fn()
    render(<Pagina onChangeEspiao={espiao} processoPre="Offset Plana" />)
    fireEvent.click(screen.getByRole('button', { name: 'Pré' }))
    expect(espiao).toHaveBeenCalledWith({ processoImpressao: 'Offset Plana' })

    fireEvent.click(screen.getByRole('button', { name: 'Travar processo' }))
    expect(campo('Processo de Impressão')).toHaveAttribute('readonly')
    expect(screen.getByRole('button', { name: 'Pré' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Destravar processo' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('Pré fica desabilitado sem processo padrão', () => {
    render(<Pagina processoPre={null} />)
    expect(screen.getByRole('button', { name: 'Pré' })).toBeDisabled()
  })
})
