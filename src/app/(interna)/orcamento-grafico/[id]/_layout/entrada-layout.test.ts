import { describe, expect, it } from 'vitest'

import type { CatalogoProduto, ProdutoGrafico, TipoPlanoGrafico } from '../../cadastros/_shared/cadastros-graficos.types'
import { chaveDaEntradaLayout, entradaLayoutDoCatalogo } from './entrada-layout'
import { resolverLayoutItem } from './resolver-layout-item'

function produto(extra: Partial<ProdutoGrafico> = {}): ProdutoGrafico {
  return {
    id: 'p1',
    empresaId: 'e1',
    codigo: 'X',
    nome: 'Nome qualquer',
    modoFormato: 'TRES_DIMENSOES',
    formatoPadraoLargura: null,
    formatoPadraoAltura: null,
    exibeRestricoes: false,
    exibeInformacoesComplementares: false,
    semImpressao: false,
    ...extra,
  } as ProdutoGrafico
}

function plano(extra: Partial<TipoPlanoGrafico> = {}): CatalogoProduto['planos'][number] {
  return { id: 't1', fixo: false, ordem: 0, padrao: false, fibraDefault: null, ...extra } as CatalogoProduto['planos'][number]
}

describe('entradaLayoutDoCatalogo', () => {
  it('converte Decimal (string) do formato padrão em número', () => {
    const e = entradaLayoutDoCatalogo({
      produto: produto({ formatoPadraoLargura: '660.00', formatoPadraoAltura: '960' }),
      planos: [],
    })
    expect(e.produto.formatoPadraoLargura).toBe(660)
    expect(e.produto.formatoPadraoAltura).toBe(960)
  })

  it('tri-estado: ausente/nulo vira null; só true/false são repassados', () => {
    const e = entradaLayoutDoCatalogo({
      produto: produto({ possuiAlturaTampa: undefined }),
      planos: [plano({ prevMicroondulado: false, prevFibra: null })],
    })
    expect(e.produto.possuiAlturaTampa).toBeNull()
    expect(e.tiposPlano[0].previsao).toEqual({
      capaExterna: null,
      microondulado: false,
      capaInterna: null,
      fibra: null,
    })
  })

  it('alimenta o layout: Alt Tampa só com possuiAlturaTampa; plano fixo vira plano único', () => {
    const com = resolverLayoutItem(
      entradaLayoutDoCatalogo({ produto: produto({ possuiAlturaTampa: true }), planos: [plano({ fixo: true })] }),
    )
    expect(com.formato.campos).toContain('alturaTampa')
    expect(com.estrutura).toBe('PLANO_UNICO')

    const sem = resolverLayoutItem(entradaLayoutDoCatalogo({ produto: produto(), planos: [plano()] }))
    expect(sem.formato.campos).not.toContain('alturaTampa')
    expect(sem.estrutura).toBe('MULTI_PLANO')
  })

  it('nome e código do produto não influenciam a chave nem o layout', () => {
    const a = entradaLayoutDoCatalogo({ produto: produto({ nome: 'Cartucho', codigo: 'A' }), planos: [plano()] })
    const b = entradaLayoutDoCatalogo({ produto: produto({ nome: 'Outro', codigo: 'B' }), planos: [plano()] })
    expect(chaveDaEntradaLayout(a)).toBe(chaveDaEntradaLayout(b))
    expect(resolverLayoutItem(a)).toEqual(resolverLayoutItem(b))
  })

  it('modo de formato inválido no cadastro resulta em cadastro incompleto', () => {
    const e = entradaLayoutDoCatalogo({ produto: produto({ modoFormato: 'INVENTADO' as never }), planos: [] })
    const l = resolverLayoutItem(e)
    expect(l.cadastroCompleto).toBe(false)
    expect(l.formato.campos).toEqual([])
  })
})
