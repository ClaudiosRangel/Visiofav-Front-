import '../_item/ambiente-dom.test-util'
import { render, screen } from '@testing-library/react'
import { MantineProvider } from '@mantine/core'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { get } = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { get, post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }))

import BlocosPorTipoPlano from './BlocosPorTipoPlano'
import { ROTULO_PROPRIEDADES } from '../_item/BotaoPropriedades'
import { blocosDaTela, estadoPlanoNovo, type BlocosTelaPlano } from './tela-plano'
import type { TipoPlanoComPrevisao } from '../../../_layout/resolver-layout-item'

function renderizar(tipo: TipoPlanoComPrevisao | null) {
  const blocos: BlocosTelaPlano = blocosDaTela(tipo)
  render(
    <MantineProvider>
      <BlocosPorTipoPlano
        blocos={blocos}
        value={estadoPlanoNovo({ tiragemItem: 1000 })}
        onChange={() => {}}
        erros={{}}
        processos={[]}
        orcamentoId="orc-1"
      />
    </MantineProvider>,
  )
}

describe('BlocosPorTipoPlano (R10.4 a R10.6, R10.8)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    get.mockResolvedValue({ data: [] })
  })

  it('previsão nula mostra capa externa, microondulado e capa interna (nulo = mostrar)', () => {
    renderizar({ prevCapaExterna: null, prevMicroondulado: null, prevCapaInterna: null, prevFibra: null })
    expect(screen.getByTestId('bloco-capa-externa')).toBeInTheDocument()
    expect(screen.getByTestId('bloco-microondulado')).toBeInTheDocument()
    expect(screen.getByTestId('bloco-capa-interna')).toBeInTheDocument()
    expect(screen.queryByTestId('bloco-suporte-principal')).not.toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Fibra Capa Externa/ })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Sentido Onda/ })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Cores \(Interna\)/ })).toBeInTheDocument()
  })

  it('só oculta o bloco com previsão false (tipo sem microondulado nem capa interna)', () => {
    renderizar({ prevCapaExterna: true, prevMicroondulado: false, prevCapaInterna: false })
    expect(screen.getByTestId('bloco-capa-externa')).toBeInTheDocument()
    expect(screen.queryByTestId('bloco-microondulado')).not.toBeInTheDocument()
    expect(screen.queryByTestId('bloco-capa-interna')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /Ajuste Corte Micro/ })).not.toBeInTheDocument()
  })

  it('previsão de fibra false esconde só o campo Fibra', () => {
    renderizar({ prevCapaExterna: true, prevFibra: false })
    expect(screen.getByTestId('bloco-capa-externa')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: /Fibra/ })).not.toBeInTheDocument()
  })

  it('sem nenhum bloco previsto, mostra o Suporte principal', () => {
    renderizar({ prevCapaExterna: false, prevMicroondulado: false, prevCapaInterna: false })
    expect(screen.getByTestId('bloco-suporte-principal')).toBeInTheDocument()
    expect(screen.queryByTestId('bloco-capa-externa')).not.toBeInTheDocument()
  })

  it('aceita a previsão no formato objeto (`previsao`) e decide sem olhar o nome do tipo', () => {
    renderizar({ previsao: { capaExterna: false, microondulado: true, capaInterna: false } })
    expect(screen.getByTestId('bloco-microondulado')).toBeInTheDocument()
    expect(screen.queryByTestId('bloco-capa-externa')).not.toBeInTheDocument()
  })

  it('botão Propriedades/Preview fica ao lado do Ajuste Corte Micro (R13, D2)', () => {
    renderizar(null)
    const micro = screen.getByTestId('bloco-microondulado')
    const campo = screen.getByRole('textbox', { name: /Ajuste Corte Micro/ })
    const botao = screen.getByRole('button', { name: ROTULO_PROPRIEDADES })
    expect(micro).toContainElement(campo)
    expect(micro).toContainElement(botao)
    // Mesmo grupo do campo.
    expect(campo.closest('.mantine-Group-root')).toContainElement(botao)
    expect(get).not.toHaveBeenCalledWith('/orcamento-grafico/orc-1/ficha-master')
  })
})
