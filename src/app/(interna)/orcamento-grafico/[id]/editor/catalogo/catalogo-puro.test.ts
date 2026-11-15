import { describe, expect, it } from 'vitest'

import {
  aplicarDefaultsEmPlano,
  aplicarDefaultsEmVazios,
  deveAplicarDefaults,
  filtrarOrdenarAtividades,
  mesclarLinhasSelecao,
  normalizarTexto,
  planoFixoDoCatalogo,
  preMarcarAtividades,
  sugerirItensDiversos,
  tipoParamDoMaterial,
} from './catalogo-puro'

describe('aplicarDefaultsEmVazios', () => {
  const padrao = { fabricanteSuporte: 'Stora Enso' }
  const nomes = { processoImpressao: 'Offset', coberturaTinta: 'Total' }

  it('preenche só campos vazios', () => {
    const r = aplicarDefaultsEmVazios({ processoImpressao: '', coberturaTintaTexto: undefined, fabricante: null }, padrao, nomes)
    expect(r).toEqual({ processoImpressao: 'Offset', coberturaTintaTexto: 'Total', fabricante: 'Stora Enso' })
  })

  it('nunca sobrescreve campo preenchido', () => {
    const entrada = { processoImpressao: 'Flexo', coberturaTintaTexto: 'Parcial', fabricante: 'Klabin' }
    expect(aplicarDefaultsEmVazios(entrada, padrao, nomes)).toEqual(entrada)
  })

  it('é idempotente', () => {
    const uma = aplicarDefaultsEmVazios({ processoImpressao: '' }, padrao, nomes)
    expect(aplicarDefaultsEmVazios(uma, padrao, nomes)).toEqual(uma)
  })

  it('sem default devolve o mesmo objeto', () => {
    const entrada = { fabricante: '' }
    expect(aplicarDefaultsEmVazios(entrada, null)).toBe(entrada)
  })

  it('não toca em campos que não conhece (ex.: cores)', () => {
    const entrada = { fabricante: '', cores: [1, 2, 3] }
    const r = aplicarDefaultsEmVazios(entrada, padrao, nomes)
    expect(r.cores).toBe(entrada.cores)
  })
})

describe('aplicarDefaultsEmPlano', () => {
  const tipo = { nome: 'Cartão', suportePadraoId: 's1', gramaturaPadrao: 300 }
  const padrao = { coresFrente: 4, coresVerso: 1 }

  it('preenche nome, cores, suporte e gramatura quando vazios', () => {
    const r = aplicarDefaultsEmPlano({ nome: '', numCores: 4, suporteId: null, gramatura: 0 }, tipo, padrao)
    expect(r).toEqual({ nome: 'Cartão', numCores: 5, suporteId: 's1', gramatura: 300 })
  })

  it('respeita campos tocados e preenchidos', () => {
    const r = aplicarDefaultsEmPlano(
      { nome: 'Meu plano', numCores: 2, suporteId: 'x', gramatura: 250 },
      tipo,
      padrao,
      new Set(['numCores']),
    )
    expect(r).toEqual({ nome: 'Meu plano', numCores: 2, suporteId: 'x', gramatura: 250 })
  })

  it('é idempotente', () => {
    const uma = aplicarDefaultsEmPlano({ nome: '', numCores: 4, suporteId: null, gramatura: 0 }, tipo, padrao)
    expect(aplicarDefaultsEmPlano(uma, tipo, padrao)).toEqual(uma)
  })
})

describe('deveAplicarDefaults', () => {
  it('item novo aplica', () => expect(deveAplicarDefaults({})).toBe(true))
  it('item puxado não aplica', () => expect(deveAplicarDefaults({ calculoGraficoOrigemId: 'c1' })).toBe(false))
  it('item salvo com produto não aplica', () => expect(deveAplicarDefaults({ produtoGraficoIdSalvo: 'p1' })).toBe(false))
})

describe('planoFixoDoCatalogo', () => {
  it('prefere o tipo fixo', () => {
    expect(planoFixoDoCatalogo({ planos: [{ id: 'a' }, { id: 'b', fixo: true }] })).toBe('b')
  })
  it('usa o único tipo permitido', () => {
    expect(planoFixoDoCatalogo({ planos: [{ id: 'a', fixo: false }] })).toBe('a')
  })
  it('vários não fixos → null', () => {
    expect(planoFixoDoCatalogo({ planos: [{ id: 'a' }, { id: 'b' }] })).toBeNull()
  })
  it('sem catálogo → null', () => {
    expect(planoFixoDoCatalogo(null)).toBeNull()
    expect(planoFixoDoCatalogo({ planos: [] })).toBeNull()
  })
})

describe('filtrarOrdenarAtividades', () => {
  const cadastro = [
    { id: 'a', nome: 'Corte' },
    { id: 'b', nome: 'Cola' },
    { id: 'c', nome: 'Verniz' },
    { id: 'd', nome: 'Caixa' },
    { id: 'e', nome: 'Extra' },
  ]

  it('segue a ordem do catálogo e separa acondicionamento', () => {
    const r = filtrarOrdenarAtividades(cadastro, {
      atividades: [
        { id: 'c', ordem: 2 },
        { id: 'a', ordem: 1 },
        { id: 'b', ordem: 3 },
      ],
      acondicionamento: [{ id: 'd', ordem: 1 }],
    })
    expect(r.planoProduto.map((x) => x.id)).toEqual(['a', 'c', 'b'])
    expect(r.acondicionamento.map((x) => x.id)).toEqual(['d'])
    expect(r.foraDoCatalogo).toEqual([])
    expect(r.naoExibidas).toBe(0)
  })

  it('sem ordem, ordena por nome', () => {
    const r = filtrarOrdenarAtividades(cadastro, {
      atividades: [
        { id: 'c', nome: 'Verniz' },
        { id: 'b', nome: 'Cola' },
      ],
      acondicionamento: [],
    })
    expect(r.planoProduto.map((x) => x.id)).toEqual(['b', 'c'])
  })

  it('mantém marcada fora do catálogo e conta as não exibidas', () => {
    const r = filtrarOrdenarAtividades(
      cadastro,
      { atividades: [{ id: 'a', ordem: 1 }, { id: 'zzz', ordem: 2 }], acondicionamento: [] },
      ['e', 'a'],
    )
    expect(r.foraDoCatalogo.map((x) => x.id)).toEqual(['e'])
    expect(r.naoExibidas).toBe(1)
  })

  it('acondicionamento não repete em atividades', () => {
    const r = filtrarOrdenarAtividades(cadastro, {
      atividades: [{ id: 'd', ordem: 1 }, { id: 'a', ordem: 2 }],
      acondicionamento: [{ id: 'd', ordem: 1 }],
    })
    expect(r.planoProduto.map((x) => x.id)).toEqual(['a'])
    expect(r.acondicionamento.map((x) => x.id)).toEqual(['d'])
  })
})

describe('preMarcarAtividades', () => {
  const cadastro = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
  it('marca na ordem do default quando não há marcação', () => {
    expect(preMarcarAtividades([], ['c', 'a', 'x'], cadastro).map((x) => x.id)).toEqual(['c', 'a'])
  })
  it('não marca se já há acabamentos', () => {
    expect(preMarcarAtividades([{ acabamentoId: 'a' }], ['b'], cadastro)).toEqual([])
  })
  it('sem pré-marcadas devolve vazio', () => {
    expect(preMarcarAtividades(undefined, null, cadastro)).toEqual([])
  })
})

describe('tipoParamDoMaterial', () => {
  it('usa o campo do material quando existe', () => {
    expect(tipoParamDoMaterial({ tipoParam: 4, tipoMaterial: 'COLA' })).toBe(4)
    expect(tipoParamDoMaterial({ tipoParam: 0 })).toBe(0)
  })
  it('mapa provisório por tipoMaterial e unidade', () => {
    expect(tipoParamDoMaterial({ tipoMaterial: 'ACONDICIONAMENTO' })).toBe(0)
    expect(tipoParamDoMaterial({ tipoMaterial: 'REVESTIMENTO_KG' })).toBe(1)
    expect(tipoParamDoMaterial({ tipoMaterial: 'OUTRO', unidadeCusto: 'M2' })).toBe(1)
    expect(tipoParamDoMaterial({ tipoMaterial: 'OUTRO', unidadeCusto: 'KG' })).toBe(2)
    expect(tipoParamDoMaterial({ tipoMaterial: 'PROPORCIONAL_TIRAGEM' })).toBe(4)
    expect(tipoParamDoMaterial({ tipoMaterial: 'COLA' })).toBe(3)
    expect(tipoParamDoMaterial({ tipoMaterial: 'FITA' })).toBe(3)
  })
  it('incerto cai em informativo (2)', () => {
    expect(tipoParamDoMaterial({ tipoMaterial: 'DESCONHECIDO' })).toBe(2)
    expect(tipoParamDoMaterial(null)).toBe(2)
  })
})

describe('mesclarLinhasSelecao', () => {
  const manual = { materialAcabamentoId: 'm1', nome: 'Manual', computarCusto: true, valorUnitario: 2, quantidade: 3 }
  const velhaSelecao = { materialAcabamentoId: 'x', nome: 'Velha', computarCusto: false, origem: 'SELECAO', selecaoId: 'zz' }
  const selecoes = [
    { selecaoId: 'b', materialId: 'mb', nome: 'B', valorUnitario: 1.5, consumo: 4, aplicaNoPreco: true },
    { selecaoId: 'a', materialId: 'ma', nome: 'A', valorUnitario: null, consumo: null, aplicaNoPreco: false },
  ]

  it('mantém manuais, substitui seleções e ordena por selecaoId', () => {
    const r = mesclarLinhasSelecao([manual, velhaSelecao], selecoes)
    expect(r[0]).toEqual(manual)
    expect(r.slice(1).map((l) => l.selecaoId)).toEqual(['a', 'b'])
    expect(r[1]).toMatchObject({ computarCusto: false, valorUnitario: 0, quantidade: 0, origem: 'SELECAO' })
    expect(r[2]).toMatchObject({ computarCusto: true, valorUnitario: 1.5, quantidade: 4 })
  })

  it('é idempotente', () => {
    const uma = mesclarLinhasSelecao([manual], selecoes)
    expect(mesclarLinhasSelecao(uma, selecoes)).toEqual(uma)
  })

  it('sem seleções remove só as de seleção', () => {
    expect(mesclarLinhasSelecao([manual, velhaSelecao], [])).toEqual([manual])
  })
})

describe('sugerirItensDiversos', () => {
  const auto = [
    { id: '1', nome: 'Fita Dupla Face', tipoCalculo: 'TIRAGEM', quantidadePorUnidade: '2', custoInformado: '0.5' },
    { id: '2', nome: 'Cola Adicional', tipoCalculo: 'FIXO', quantidadePorUnidade: null, custoInformado: null },
  ]

  it('converte para o formato do formulário e marca sem custo', () => {
    const r = sugerirItensDiversos(auto, [])
    expect(r).toHaveLength(2)
    expect(r[0]).toMatchObject({ descricao: 'Fita Dupla Face', quantidade: 2, valor: 0.5, fixo: false, semCusto: false })
    expect(r[1]).toMatchObject({ descricao: 'Cola Adicional', quantidade: 1, valor: 0, fixo: true, semCusto: true })
  })

  it('não repete descrição já presente (sem acento e caixa)', () => {
    const r = sugerirItensDiversos(auto, [{ descricao: '  fita DUPLA face ' }])
    expect(r.map((x) => x.origemId)).toEqual(['2'])
  })

  it('não repete entre si', () => {
    const r = sugerirItensDiversos([...auto, { ...auto[0], id: '9' }], [])
    expect(r).toHaveLength(2)
  })

  it('normalizarTexto remove acento', () => {
    expect(normalizarTexto('  Laminação  BOPP ')).toBe('laminacao bopp')
  })
})
