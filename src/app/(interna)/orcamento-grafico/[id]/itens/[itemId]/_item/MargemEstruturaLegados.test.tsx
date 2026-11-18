import './ambiente-dom.test-util'
import { fireEvent, render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { describe, expect, it, vi } from 'vitest'

// A seção de fechamento (que embute a Revisão do cálculo) é do editor atual; aqui só interessa quando ela monta.
const montagens = vi.hoisted(() => ({ n: 0 }))
vi.mock('../../../editor/SecaoFechamento', () => ({
  default: () => {
    montagens.n += 1
    return <div>fechamento-do-item</div>
  },
}))

import type { WizardFormData } from '../../../../novo/page'
import { textoAvisoPlanosLegados } from './aviso-planos-legados'
import AvisoPlanosLegados from './AvisoPlanosLegados'
import BlocoEstruturaCusto from './BlocoEstruturaCusto'
import MargemDoItem from './MargemDoItem'

const envolver = (ui: React.ReactElement) => render(<MantineProvider>{ui}</MantineProvider>)
const FORM = { quantidade: 100 } as WizardFormData

describe('MargemDoItem', () => {
  it('fechada: mostra o resumo custo · preço · CM e não monta o fechamento', () => {
    montagens.n = 0
    envolver(
      <MargemDoItem
        formData={FORM}
        updateForm={() => {}}
        baseCusto={1000}
        cevPct={20}
        margemAtualPct={30}
        contribuicaoMarginalPerc={27.5}
      />,
    )
    const resumo = screen.getByTestId('margem-do-item-resumo')
    expect(resumo).toHaveTextContent(/Custo\s+R\$\s*1\.000,00/)
    expect(resumo).toHaveTextContent(/Preço\s+R\$\s*2\.000,00/)
    expect(resumo).toHaveTextContent(/CM\s+27,5%/)
    expect(screen.queryByText('fechamento-do-item')).toBeNull()
    expect(montagens.n).toBe(0)
  })

  it('sem custo calculado, orienta a calcular', () => {
    envolver(<MargemDoItem formData={FORM} updateForm={() => {}} baseCusto={null} />)
    expect(screen.getByTestId('margem-do-item-sem-resumo')).toBeInTheDocument()
  })

  it('Detalhar abre o fechamento e Recolher fecha', () => {
    envolver(<MargemDoItem formData={FORM} updateForm={() => {}} baseCusto={1000} cevPct={20} margemAtualPct={30} />)
    const botao = screen.getByRole('button', { name: /Detalhar/ })
    expect(botao).toHaveAttribute('aria-expanded', 'false')

    fireEvent.click(botao)
    expect(screen.getByText('fechamento-do-item')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Recolher/ })).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(screen.getByRole('button', { name: /Recolher/ }))
    expect(screen.queryByText('fechamento-do-item')).toBeNull()
  })
})

describe('BlocoEstruturaCusto', () => {
  it('mostra o título, os KPIs e a decomposição por grupo', () => {
    envolver(
      <BlocoEstruturaCusto
        kpis={{ custoTotal: 1000, precoVenda: 2000, margem: 30, precoUnitario: 20 } as never}
        resultadoCalculo={{
          materialDireto: 700,
          custoTransformacao: 300,
          custosCalcgraf: { componentes: [{ grupo: 'MD', descricao: 'Papel', valorTotal: 700 }, { grupo: 'CT', descricao: 'Impressão', valorTotal: 300 }] },
        }}
      />,
    )
    expect(screen.getByText('Estrutura de custo')).toBeInTheDocument()
    expect(screen.getByText('Custo Total')).toBeInTheDocument()
    expect(screen.getByText('Preço de Venda')).toBeInTheDocument()
    expect(screen.getByText('Material Direto')).toBeInTheDocument()
    expect(screen.getByText('Custo de Transformação')).toBeInTheDocument()
    expect(screen.getByText('Papel')).toBeInTheDocument()
  })

  it('sem resultado de cálculo, avisa em vez de mostrar valores', () => {
    envolver(<BlocoEstruturaCusto resultadoCalculo={null} />)
    expect(screen.getByText(/Sem resultado de cálculo para este item/)).toBeInTheDocument()
    expect(screen.queryByText('Custo Total')).toBeNull()
  })
})

describe('AvisoPlanosLegados', () => {
  it('texto: só plano único com planos persistidos', () => {
    expect(textoAvisoPlanosLegados('PLANO_UNICO', 2)).toBe('2 plano(s) legado(s) mantido(s) sem uso na tela')
    expect(textoAvisoPlanosLegados('PLANO_UNICO', 1)).toBe('1 plano(s) legado(s) mantido(s) sem uso na tela')
    expect(textoAvisoPlanosLegados('PLANO_UNICO', 0)).toBeNull()
    expect(textoAvisoPlanosLegados('PLANO_UNICO', null)).toBeNull()
    expect(textoAvisoPlanosLegados('PLANO_UNICO', undefined)).toBeNull()
    expect(textoAvisoPlanosLegados('MULTI_PLANO', 3)).toBeNull()
  })

  it('mostra o aviso sem nenhuma ação (não apaga nem edita planos)', () => {
    envolver(<AvisoPlanosLegados estrutura="PLANO_UNICO" planosPersistidos={3} />)
    expect(screen.getByTestId('aviso-planos-legados')).toHaveTextContent('3 plano(s) legado(s) mantido(s) sem uso na tela')
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('não renderiza em multi-plano nem sem planos', () => {
    const { container, rerender } = envolver(<AvisoPlanosLegados estrutura="MULTI_PLANO" planosPersistidos={3} />)
    expect(container.querySelector('[data-testid="aviso-planos-legados"]')).toBeNull()
    rerender(
      <MantineProvider>
        <AvisoPlanosLegados estrutura="PLANO_UNICO" planosPersistidos={0} />
      </MantineProvider>,
    )
    expect(container.querySelector('[data-testid="aviso-planos-legados"]')).toBeNull()
  })
})
