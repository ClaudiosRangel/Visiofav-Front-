import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { DefaultProdutoPlano } from '../../cadastros/_shared/cadastros-graficos.types'
import {
  aplicarPadroesNoItem,
  resolverBlocosPlano,
  resolverLayoutItem,
  resolverPadroesIniciais,
  type EntradaLayoutItem,
  type LayoutItem,
} from './resolver-layout-item'

const ARQUIVO = join(
  process.cwd(), 'src', 'app', '(interna)', 'orcamento-grafico', '[id]', '_layout', 'vetores-layout.json',
)

interface Vetor {
  id: string
  entrada: EntradaLayoutItem
  saidaEsperada: LayoutItem
}
const doc = JSON.parse(readFileSync(ARQUIVO, 'utf8')) as { vetores: Vetor[] }

describe('resolverLayoutItem — vetores compartilhados', () => {
  it('há vetores', () => {
    expect(doc.vetores.length).toBeGreaterThan(0)
  })

  it.each(doc.vetores.map((v) => [v.id, v] as const))('%s', (_id, v) => {
    expect(resolverLayoutItem(v.entrada)).toEqual(v.saidaEsperada)
  })

  it('é idempotente (mesma entrada, mesma saída)', () => {
    for (const v of doc.vetores) {
      expect(resolverLayoutItem(v.entrada)).toEqual(resolverLayoutItem(v.entrada))
    }
  })

  it('não altera a entrada', () => {
    for (const v of doc.vetores) {
      const copia = JSON.parse(JSON.stringify(v.entrada))
      resolverLayoutItem(v.entrada)
      expect(v.entrada).toEqual(copia)
    }
  })
})

function entradaBase(over: Partial<EntradaLayoutItem['produto']> = {}, fixo = true): EntradaLayoutItem {
  return {
    produto: {
      modoFormato: 'TRES_DIMENSOES',
      formatoPadraoLargura: null,
      formatoPadraoAltura: null,
      exibeRestricoes: false,
      exibeInformacoesComplementares: false,
      semImpressao: false,
      ...over,
    },
    tiposPlano: [{ id: 't1', fixo }],
  }
}

describe('resolverLayoutItem — decisões novas', () => {
  it('SANFONA_ABAS = Comp, Larg, Nº sanfonas, Aba (sem pendência)', () => {
    const l = resolverLayoutItem(entradaBase({ modoFormato: 'SANFONA_ABAS' }))
    expect(l.formato.campos).toEqual(['comprimento', 'largura', 'numeroSanfonas', 'aba'])
    expect(l.formato.formatoPendenteDeWireframe).toBe(false)
  })

  it('PAGINA = Formato Fechado + Nº de páginas (sem pendência)', () => {
    const l = resolverLayoutItem(entradaBase({ modoFormato: 'PAGINA' }))
    expect(l.formato.campos).toEqual(['formatoFechado', 'numeroPaginas'])
    expect(l.formato.formatoPendenteDeWireframe).toBe(false)
  })

  it('Alt Tampa só com possuiAlturaTampa = true', () => {
    expect(resolverLayoutItem(entradaBase({ possuiAlturaTampa: true })).formato.campos).toContain('alturaTampa')
    expect(resolverLayoutItem(entradaBase({ possuiAlturaTampa: null })).formato.campos).not.toContain('alturaTampa')
    expect(resolverLayoutItem(entradaBase({ possuiAlturaTampa: false })).formato.campos).not.toContain('alturaTampa')
  })

  it('R8.4: um único tipo não fixo é multi-plano; fixo em qualquer posição é plano único', () => {
    expect(resolverLayoutItem(entradaBase({}, false)).estrutura).toBe('MULTI_PLANO')
    const e = entradaBase()
    e.tiposPlano = [{ id: 'a', fixo: false }, { id: 'b', fixo: true }]
    const l = resolverLayoutItem(e)
    expect(l.estrutura).toBe('PLANO_UNICO')
    expect(l.tipoPlanoFixoId).toBe('b')
  })

  it('entrada sem nome nem código (chaves do produto)', () => {
    const chaves = Object.keys(entradaBase().produto)
    expect(chaves).not.toContain('nome')
    expect(chaves).not.toContain('codigo')
  })
})

describe('resolverBlocosPlano', () => {
  it('nulo/omitido = mostrar tudo', () => {
    expect(resolverBlocosPlano(null)).toEqual({ capaExterna: true, microondulado: true, capaInterna: true, fibra: true })
    expect(resolverBlocosPlano({})).toEqual({ capaExterna: true, microondulado: true, capaInterna: true, fibra: true })
    expect(resolverBlocosPlano({ previsao: {} }).microondulado).toBe(true)
  })

  it('só false oculta (objeto previsao)', () => {
    expect(
      resolverBlocosPlano({ previsao: { capaExterna: true, microondulado: false, capaInterna: null, fibra: false } }),
    ).toEqual({ capaExterna: true, microondulado: false, capaInterna: true, fibra: false })
  })

  it('aceita as flags planas prevCapaExterna/prevMicroondulado/prevCapaInterna/prevFibra', () => {
    expect(
      resolverBlocosPlano({ prevCapaExterna: false, prevMicroondulado: true, prevCapaInterna: false, prevFibra: null }),
    ).toEqual({ capaExterna: false, microondulado: true, capaInterna: false, fibra: true })
  })
})

describe('resolverPadroesIniciais', () => {
  const base: DefaultProdutoPlano = {
    id: 'd1',
    empresaId: 'e1',
    produtoId: 'p1',
    tipoPlanoId: 't1',
    semImpressao: false,
    processoImpressaoId: 'proc1',
    coberturaTintaId: 'cob1',
    coresFrente: 5,
    coresVerso: 0,
    areaTintaPerc: 0 as unknown as DefaultProdutoPlano['areaTintaPerc'],
    fabricanteSuporte: 'Fab X',
    atividadesPreMarcadas: ['a2', 'a3'],
  }

  it('sem default devolve padrões vazios', () => {
    expect(resolverPadroesIniciais({ default: null })).toEqual({
      cores: null,
      coresFrente: 0,
      coresVerso: 0,
      semImpressao: false,
      processoImpressaoId: null,
      coberturaTintaId: null,
      fabricanteSuporte: null,
      atividadesPreMarcadas: [],
    })
  })

  it('cores NxM, ids e atividades pré-marcadas (catálogo + default, sem repetir)', () => {
    const p = resolverPadroesIniciais({
      default: base,
      atividadesDoCatalogo: [{ id: 'a1', preMarcada: true }, { id: 'a2', preMarcada: true }, { id: 'a9' }],
    })
    expect(p.cores).toBe('5x0')
    expect(p.processoImpressaoId).toBe('proc1')
    expect(p.coberturaTintaId).toBe('cob1')
    expect(p.atividadesPreMarcadas).toEqual(['a1', 'a2', 'a3'])
  })

  it('semImpressao não gera cores', () => {
    expect(resolverPadroesIniciais({ default: { ...base, semImpressao: true } }).cores).toBeNull()
  })

  it('aplicarPadroesNoItem só preenche campo vazio (reusa aplicarDefaultsEmVazios)', () => {
    const p = resolverPadroesIniciais({ default: base })
    const r = aplicarPadroesNoItem({ fabricante: '', processoImpressao: 'Manual' }, p, { processoImpressao: 'Offset' })
    expect(r.fabricante).toBe('Fab X')
    expect(r.processoImpressao).toBe('Manual')
  })
})
