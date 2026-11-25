import './ambiente-dom.test-util'
import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { get } = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { get, post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))

// O modal tem testes próprios: aqui ele só expõe "criar" e "falhar" para exercitar a integração.
const NOVO = { suporteId: 'sup-nc', precoId: 'preco-nc', nome: 'Kraft NC 250', gramatura: 250, custoKg: 7.5 }
vi.mock('./SuporteNcModal', () => ({
  default: ({ opened, onClose, onCriado }: { opened: boolean; onClose: () => void; onCriado: (r: typeof NOVO) => void }) =>
    opened ? (
      <div role="dialog" aria-label="Modal NC">
        <button type="button" onClick={() => { onCriado(NOVO); onClose() }}>Simular criado</button>
        <button type="button" onClick={onClose}>Simular falha</button>
      </div>
    ) : null,
}))

import { resolverLayoutItem } from '../../../_layout/resolver-layout-item'
import { aplicarSuporteNcCriado } from '../../../../novo/StepPapel'
import BlocosPorTipoPlano from '../_plano/BlocosPorTipoPlano'
import { blocosDaTela, estadoPlanoNovo, type EstadoTelaPlano } from '../_plano/tela-plano'
import BlocoPlanoUnico from './BlocoPlanoUnico'
import { planoUnicoVazio } from './plano-unico-item'

const PRODUTO = {
  modoFormato: 'TRES_DIMENSOES',
  formatoPadraoLargura: null,
  formatoPadraoAltura: null,
  exibeRestricoes: true,
  exibeInformacoesComplementares: false,
  semImpressao: false,
}
const layoutUnico = resolverLayoutItem({ produto: PRODUTO, tiposPlano: [{ id: 't', fixo: true, previsao: {} }] })

beforeEach(() => {
  vi.clearAllMocks()
  get.mockResolvedValue({ data: [] })
})

describe('NC no Plano único (BlocoPlanoUnico)', () => {
  function Pagina({ onNc, disabled }: { onNc?: (r: typeof NOVO) => void; disabled?: boolean }) {
    return (
      <MantineProvider>
        <BlocoPlanoUnico
          value={planoUnicoVazio()}
          onChange={() => {}}
          layout={layoutUnico}
          suporte={<div>Seletor de suporte</div>}
          onSuporteNcCriado={onNc}
          disabled={disabled}
        />
      </MantineProvider>
    )
  }

  it('mostra o botão NC ao lado do suporte e abre o modal', () => {
    render(<Pagina onNc={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Suporte não cadastrado' }))
    expect(screen.getByRole('dialog', { name: 'Modal NC' })).toBeInTheDocument()
  })

  it('sem a prop, ou desabilitado, não há NC ativo', () => {
    const { unmount } = render(<Pagina />)
    expect(screen.queryByRole('button', { name: 'Suporte não cadastrado' })).toBeNull()
    unmount()
    render(<Pagina onNc={vi.fn()} disabled />)
    expect(screen.getByRole('button', { name: 'Suporte não cadastrado' })).toBeDisabled()
  })

  it('ao criar, repassa o suporte novo; sem criação, nada é chamado', () => {
    const onNc = vi.fn()
    render(<Pagina onNc={onNc} />)
    fireEvent.click(screen.getByRole('button', { name: 'Suporte não cadastrado' }))
    fireEvent.click(screen.getByRole('button', { name: 'Simular falha' }))
    expect(onNc).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Suporte não cadastrado' }))
    fireEvent.click(screen.getByRole('button', { name: 'Simular criado' }))
    expect(onNc).toHaveBeenCalledWith(NOVO)
  })

  it('aplicarSuporteNcCriado atualiza o formData como o StepPapel (suporte + papel + preço + gramatura)', () => {
    expect(aplicarSuporteNcCriado(NOVO)).toEqual({
      suporteId: 'sup-nc',
      suporteNome: 'Kraft NC 250',
      papelId: 'preco-nc',
      papelDescricao: 'Kraft NC 250',
      precoKg: 7.5,
      gramatura: 250,
    })
  })
})

describe('NC nos blocos do Plano (BlocosPorTipoPlano)', () => {
  type Chamada = [string, Record<string, unknown>, string[]]
  function Pagina({ espiao, permitidos }: { espiao: (c: Chamada) => void; permitidos?: { value: string; label: string }[] }) {
    const [valor, setValor] = useState<EstadoTelaPlano>(estadoPlanoNovo({ tiragemItem: 1000 }))
    return (
      <MantineProvider>
        <BlocosPorTipoPlano
          blocos={blocosDaTela(null)}
          value={valor}
          onChange={(bloco, parcial, campos) => {
            espiao([bloco, parcial as Record<string, unknown>, campos])
            setValor((v) => ({ ...v, [bloco]: { ...v[bloco], ...parcial } }))
          }}
          erros={{}}
          processos={[]}
          orcamentoId="orc-1"
          suportesPermitidos={permitidos}
        />
      </MantineProvider>
    )
  }

  it('cada bloco de suporte tem seu botão NC', () => {
    render(<Pagina espiao={vi.fn()} />)
    expect(screen.getAllByRole('button', { name: 'Suporte não cadastrado' })).toHaveLength(3)
  })

  it('ao criar no bloco certo, chama onChange(bloco, {suporteId, suporteNome}, ["suporteId"]) e o campo mostra o novo', () => {
    const espiao = vi.fn()
    render(<Pagina espiao={espiao} />)
    const bloco = screen.getByTestId('bloco-microondulado')
    fireEvent.click(within(bloco).getByRole('button', { name: 'Suporte não cadastrado' }))
    fireEvent.click(screen.getByRole('button', { name: 'Simular criado' }))
    expect(espiao).toHaveBeenCalledTimes(1)
    expect(espiao).toHaveBeenCalledWith(['microondulado', { suporteId: 'preco-nc', suporteNome: 'Kraft NC 250' }, ['suporteId']])
    expect((within(bloco).getByRole('textbox', { name: /Suporte Microondulado/ }) as HTMLInputElement).value).toBe('Kraft NC 250')
    // Os outros blocos não mudam.
    const externa = screen.getByTestId('bloco-capa-externa')
    expect((within(externa).getByRole('textbox', { name: /Suporte Capa Externa/ }) as HTMLInputElement).value).toBe('')
  })

  it('com lista restrita, o suporte novo entra nas opções e fica selecionado', () => {
    const espiao = vi.fn()
    render(<Pagina espiao={espiao} permitidos={[{ value: 'a', label: 'Duplex 300' }]} />)
    const bloco = screen.getByTestId('bloco-capa-interna')
    fireEvent.click(within(bloco).getByRole('button', { name: 'Suporte não cadastrado' }))
    fireEvent.click(screen.getByRole('button', { name: 'Simular criado' }))
    expect((within(bloco).getByRole('textbox', { name: /Suporte Capa Interna/ }) as HTMLInputElement).value).toBe('Kraft NC 250')
  })

  it('sem criação (erro/cancelar) o campo não muda', () => {
    const espiao = vi.fn()
    render(<Pagina espiao={espiao} />)
    const bloco = screen.getByTestId('bloco-capa-externa')
    fireEvent.click(within(bloco).getByRole('button', { name: 'Suporte não cadastrado' }))
    fireEvent.click(screen.getByRole('button', { name: 'Simular falha' }))
    expect(espiao).not.toHaveBeenCalled()
  })
})
