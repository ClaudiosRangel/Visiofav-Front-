/**
 * Tarefas 11.2 e 11.3 — spec orcamento-grafico-fase3-produto-embalagem.
 *
 * Nota de isolamento: `itemFormShared.ts` importa `../novo/page` (React/Mantine).
 * Mesmo padrão do `itemFormShared.test.ts`: `vi.mock` do módulo pesado e da API,
 * mantendo `itemParaForm`/`montarPayloadDadosTecnicos` REAIS.
 *
 * Semântica de "null permanece null": o payload omite (undefined) o campo vazio e
 * o backend (`body.campo ?? null` em orcamento-grafico.routes.ts) grava null/false.
 * Portanto a comparação é feita após a MESMA normalização do backend:
 * texto/número ausente => null; boolean ausente => false; lista vazia => ausente.
 */
import { describe, expect, it, vi } from 'vitest'
import fc from 'fast-check'

vi.mock('../novo/page', () => ({ extrairTiragensDasObservacoes: () => null }))
vi.mock('@/lib/api', () => ({ api: { put: vi.fn(), post: vi.fn() } }))

import { INITIAL_ITEM, itemParaForm, montarPayloadCalculo, montarPayloadItem, type ItemParaEditar } from './itemFormShared'

const CAMPOS_TEXTO = [
  'siglaAcabado',
  'tributacao',
  'processoImpressao',
  'coberturaTintaTexto',
  'fabricante',
  'arte',
  'observacao',
  'observacaoAreasOp',
] as const

const CAMPOS_NUMERO = [
  'qtdModelos',
  'conteudoVolume',
  'comprimentoMm',
  'larguraMm',
  'alturaMm',
  'abaColaMm',
  'abaFechamentoMm',
  'montagemLinhas',
  'montagemColunas',
  'formatoSupLarguraMm',
  'formatoSupAlturaMm',
  'formatoCorteLarguraMm',
  'formatoCorteAlturaMm',
  'ajusteCorteMicroMm',
] as const

const texto = fc.oneof(
  fc.constant(null),
  fc.string({ minLength: 1, maxLength: 40 }).filter((s) => s.trim() === s && s.length > 0),
)
const numero = fc.oneof(fc.constant(null), fc.double({ min: 0, max: 100000, noNaN: true, noDefaultInfinity: true }))

const itemArb = fc.record({
  textos: fc.record(Object.fromEntries(CAMPOS_TEXTO.map((c) => [c, texto]))),
  numeros: fc.record(Object.fromEntries(CAMPOS_NUMERO.map((c) => [c, numero]))),
  microondulado: fc.boolean(),
  materialId: fc.oneof(fc.constant(null), fc.uuid()),
  fornecido: fc.boolean(),
  fibra: fc.boolean(),
  acond: fc.array(
    fc.string({ minLength: 1, maxLength: 20 }).filter((s) => s.trim() === s && s.length > 0),
    { maxLength: 4 },
  ),
})

describe('Feature: orcamento-grafico-fase3-produto-embalagem, Property 18: Campos técnicos fazem ida e volta', () => {
  it('item -> itemParaForm -> montarPayloadDadosTecnicos preserva cada Campo_Tecnico (inclusive null)', () => {
    fc.assert(
      fc.property(itemArb, (g) => {
        const item = {
          id: 'i1',
          tipoEmbalagemId: 't1',
          quantidade: 1000,
          ...g.textos,
          ...g.numeros,
          microondulado: g.microondulado,
          // o payload só carrega o material quando microondulado = true (regra existente)
          materialMicroonduladoId: g.microondulado ? g.materialId : null,
          fornecido: g.fornecido,
          fibra: g.fibra,
          acondicionamento: g.acond.map((descricao) => ({ descricao })),
        } as ItemParaEditar

        const p = montarPayloadItem(itemParaForm(item)) as Record<string, unknown>
        const registro = item as unknown as Record<string, unknown>

        for (const c of [...CAMPOS_TEXTO, ...CAMPOS_NUMERO]) {
          expect(p[c] ?? null, c).toStrictEqual(registro[c])
        }
        expect(p.microondulado ?? false).toBe(item.microondulado)
        expect(p.fornecido ?? false).toBe(item.fornecido)
        expect(p.fibra ?? false).toBe(item.fibra)
        expect(p.materialMicroonduladoId ?? null).toBe(item.materialMicroonduladoId)
        expect(p.acondicionamento ?? []).toStrictEqual(item.acondicionamento)
      }),
      { numRuns: 200 },
    )
  })

  it('item totalmente nulo: nenhum Campo_Tecnico vira texto vazio ou zero no payload', () => {
    const p = montarPayloadItem(itemParaForm({ id: 'i1', tipoEmbalagemId: 't1', quantidade: 1 })) as Record<string, unknown>
    for (const c of [...CAMPOS_TEXTO, ...CAMPOS_NUMERO]) {
      expect(p[c], c).toBeUndefined()
    }
  })
})

describe('11.3 — payload de referência (formulário sem produtoGraficoId)', () => {
  const form = {
    ...INITIAL_ITEM,
    tipoEmbalagemId: 't1',
    medidas: { L: 100, A: 50 },
    papelId: 'p1',
    papelDescricao: 'Papel X',
    gramatura: 250,
    precoKg: 7.45,
    quantidade: 4000,
    maquinaId: 'm1',
    aproveitamentoManual: 3,
    formatoCorteLarguraMm: 650,
    formatoCorteAlturaMm: 1225,
    siglaAcabado: 'ABC',
    comprimentoMm: 190,
  }
  const coresRef = INITIAL_ITEM.cores.map((c) => ({
    nome: c.nome,
    tipo: c.tipo,
    coberturaPercent: c.coberturaPercent,
    precoKg: c.precoKg,
    rendimentoM2Kg: c.rendimentoM2Kg,
  }))
  const acabRef = [
    { tipo: 'CORTE_VINCO', custoHora: 180, velocidade: 4000, custoMaterialM2: 0 },
    { tipo: 'COLAGEM', custoHora: 150, velocidade: 8000, custoMaterialM2: 0 },
  ]

  it('payload de salvar igual ao de referência e sem chaves da fase', () => {
    const p = montarPayloadItem(form)
    expect('produtoGraficoId' in p).toBe(false)
    expect('materiaisAcabamento' in p && p.materiaisAcabamento !== undefined).toBe(false)
    expect(p).toEqual({
      tipoEmbalagemId: 't1',
      medidas: { L: 100, A: 50 },
      papelId: 'p1',
      papelDescricao: 'Papel X',
      gramatura: 250,
      precoKg: 7.45,
      cores: coresRef,
      acabamentos: acabRef,
      quantidade: 4000,
      maquinaId: 'm1',
      aproveitamentoManual: 3,
      tinta: { modo: 'COBERTURA' },
      materialMicroonduladoId: null,
      siglaAcabado: 'ABC',
      comprimentoMm: 190,
      formatoCorteLarguraMm: 650,
      formatoCorteAlturaMm: 1225,
    })
  })

  it('payload de cálculo igual ao de referência e sem materiaisAcabamento', () => {
    const p = montarPayloadCalculo(form)
    expect('materiaisAcabamento' in p).toBe(false)
    expect(p).toEqual({
      tipoEmbalagemId: 't1',
      medidas: { L: 100, A: 50 },
      papelId: 'p1',
      gramatura: 250,
      precoKg: 7.45,
      cores: coresRef,
      acabamentos: acabRef,
      quantidade: 4000,
      maquinaId: 'm1',
      aproveitamentoManual: 3,
      formatoCorteLarguraMm: 650,
      formatoCorteAlturaMm: 1225,
    })
  })

  it('materiais no formulário sem produto não entram no payload de cálculo', () => {
    const p = montarPayloadCalculo({
      ...form,
      materiaisAcabamento: [{ materialAcabamentoId: 'm1', nome: 'Cola', computarCusto: true, valorUnitario: 2, quantidade: 3 }],
    })
    expect('materiaisAcabamento' in p).toBe(false)
  })
})
