/**
 * Testes de `campos-livres-puro.ts` (spec orcamento-grafico-fase3-produto-embalagem,
 * tarefas 8.4, 8.11 e 8.12). Properties 10 e 11 com fast-check (100 execuções).
 *
 * Sobre o payload de cálculo: `montarPayloadCalculo` fica em `itemFormShared.ts`, que
 * importa `../novo/page` (React e Mantine) e `@/lib/api`. Importá-lo aqui puxaria toda a
 * árvore de tela para o Vitest. Por isso a prova de que o payload de cálculo não leva
 * `camposLivres` é feita sobre o texto-fonte da função (sem importar o módulo).
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'
import fc from 'fast-check'

import {
  MAX_CONTEUDO_CAMPO_LIVRE,
  MAX_PARES_CAMPOS_LIVRES,
  MAX_ROTULO_CAMPO_LIVRE,
  adicionarParCampoLivre,
  mesclarCamposLivres,
  type CampoLivreCadastro,
  type ParCampoLivre,
} from './campos-livres-puro'

const NUM_RUNS = 100

function campo(parcial: Partial<CampoLivreCadastro> & { nome: string }): CampoLivreCadastro {
  return {
    proprietario: 'SOLICITACAO',
    tipo: 'TEXTO',
    obrigatorio: false,
    status: true,
    opcoes: [],
    ...parcial,
  } as CampoLivreCadastro
}

// ============================================================================
// mesclarCamposLivres (unidade)
// ============================================================================

describe('mesclarCamposLivres (unidade)', () => {
  it('entrada vazia: sem cadastro e sem pares devolve tudo vazio', () => {
    const r = mesclarCamposLivres(null, null)
    expect(r.rotulos).toEqual([])
    expect(r.opcoesPorRotulo).toEqual({})
    expect(r.obrigatorios.size).toBe(0)
    expect(mesclarCamposLivres([], []).rotulos).toEqual([])
  })

  it('entrada preenchida: rótulos em ordem alfabética e opções na ordem do cadastro com marca de padrão', () => {
    const r = mesclarCamposLivres(
      [
        campo({ nome: 'PADRÃO', tipo: 'LISTA', obrigatorio: true, opcoes: [
          { valor: 'B', padrao: false },
          { valor: 'A', padrao: true },
        ] }),
        campo({ nome: 'ARTE', proprietario: 'PEDIDO' }),
      ],
      [],
    )
    expect(r.rotulos).toEqual(['ARTE', 'PADRÃO'])
    expect(r.opcoesPorRotulo).toEqual({
      'PADRÃO': [
        { valor: 'B', padrao: false },
        { valor: 'A', padrao: true },
      ],
    })
    expect([...r.obrigatorios]).toEqual(['PADRÃO'])
  })

  it('opções com `ordem` explícita seguem essa ordem', () => {
    const r = mesclarCamposLivres(
      [
        campo({ nome: 'COR', tipo: 'LISTA', opcoes: [
          { valor: 'terceira', padrao: false, ordem: 3 },
          { valor: 'primeira', padrao: true, ordem: 1 },
          { valor: 'segunda', padrao: false, ordem: 2 },
        ] }),
      ],
      [],
    )
    expect(r.opcoesPorRotulo.COR.map((o) => o.valor)).toEqual(['primeira', 'segunda', 'terceira'])
  })

  it('rótulos fora do cadastro, já usados no item, são preservados', () => {
    const r = mesclarCamposLivres(
      [campo({ nome: 'ARTE' })],
      [
        { rotulo: 'RÓTULO ANTIGO', conteudo: 'x' },
        { rotulo: 'ARTE', conteudo: 'y' },
      ],
    )
    expect(r.rotulos).toEqual(['ARTE', 'RÓTULO ANTIGO'])
  })

  it('ignora campo inativo e proprietário RECUSA ou INSUMO', () => {
    const r = mesclarCamposLivres(
      [
        campo({ nome: 'INATIVO', status: false }),
        campo({ nome: 'DA RECUSA', proprietario: 'RECUSA' }),
        campo({ nome: 'DO INSUMO', proprietario: 'INSUMO' }),
        campo({ nome: 'VALE' }),
      ],
      [],
    )
    expect(r.rotulos).toEqual(['VALE'])
  })

  it('não repete rótulo e não duplica opção', () => {
    const r = mesclarCamposLivres(
      [
        campo({ nome: 'ARTE', tipo: 'LISTA', opcoes: [
          { valor: 'X', padrao: false },
          { valor: 'X', padrao: true },
        ] }),
        campo({ nome: 'ARTE', proprietario: 'PEDIDO' }),
      ],
      [{ rotulo: 'ARTE', conteudo: '' }],
    )
    expect(r.rotulos).toEqual(['ARTE'])
    expect(r.opcoesPorRotulo.ARTE).toEqual([{ valor: 'X', padrao: true }])
  })

  it('nunca adiciona par nem altera os pares atuais', () => {
    const atuais: ParCampoLivre[] = [{ rotulo: 'ARTE', conteudo: 'azul' }]
    const copia = JSON.parse(JSON.stringify(atuais))
    mesclarCamposLivres([campo({ nome: 'PADRÃO', tipo: 'LISTA', opcoes: [{ valor: 'A', padrao: true }] })], atuais)
    expect(atuais).toEqual(copia)
  })
})

// ============================================================================
// adicionarParCampoLivre (unidade)
// ============================================================================

describe('adicionarParCampoLivre (unidade)', () => {
  it('entrada vazia: lista vazia aceita o primeiro par', () => {
    const r = adicionarParCampoLivre([], { rotulo: 'ARTE', conteudo: '' })
    expect(r).toEqual({ ok: true, pares: [{ rotulo: 'ARTE', conteudo: '' }] })
  })

  it('entrada preenchida: acrescenta ao final e preserva os anteriores', () => {
    const antes: ParCampoLivre[] = [{ rotulo: 'A', conteudo: '1' }]
    const r = adicionarParCampoLivre(antes, { rotulo: 'B', conteudo: '2' })
    expect(r).toEqual({ ok: true, pares: [{ rotulo: 'A', conteudo: '1' }, { rotulo: 'B', conteudo: '2' }] })
    expect(antes).toHaveLength(1)
  })

  it('rejeita o 21º par e mantém a lista', () => {
    const cheia = Array.from({ length: MAX_PARES_CAMPOS_LIVRES }, (_, i) => ({ rotulo: `R${i}`, conteudo: '' }))
    const r = adicionarParCampoLivre(cheia, { rotulo: 'extra', conteudo: '' })
    expect(r.ok).toBe(false)
    expect(r.pares).toBe(cheia)
    if (!r.ok) expect(r.mensagem).toMatch(/20/)
  })

  it('aceita o 20º par', () => {
    const quase = Array.from({ length: MAX_PARES_CAMPOS_LIVRES - 1 }, (_, i) => ({ rotulo: `R${i}`, conteudo: '' }))
    expect(adicionarParCampoLivre(quase, { rotulo: 'ultimo', conteudo: '' }).ok).toBe(true)
  })

  it('limites de rótulo (50) e conteúdo (500): no limite aceita, acima rejeita', () => {
    expect(adicionarParCampoLivre([], { rotulo: 'x'.repeat(MAX_ROTULO_CAMPO_LIVRE), conteudo: '' }).ok).toBe(true)
    expect(adicionarParCampoLivre([], { rotulo: 'x'.repeat(MAX_ROTULO_CAMPO_LIVRE + 1), conteudo: '' }).ok).toBe(false)
    expect(adicionarParCampoLivre([], { rotulo: 'r', conteudo: 'x'.repeat(MAX_CONTEUDO_CAMPO_LIVRE) }).ok).toBe(true)
    expect(adicionarParCampoLivre([], { rotulo: 'r', conteudo: 'x'.repeat(MAX_CONTEUDO_CAMPO_LIVRE + 1) }).ok).toBe(false)
  })
})

// ============================================================================
// Propriedades
// ============================================================================

describe('Propriedades de campos-livres-puro.ts', () => {
  // Feature: orcamento-grafico-fase3-produto-embalagem, Property 10: Mesclagem de rótulos e opções de campos livres
  it('Property 10: Mesclagem de rótulos e opções de campos livres', () => {
    const nomeArb = fc.string({ minLength: 1, maxLength: 10 }).filter((s) => s.trim().length > 0)
    const opcoesArb = fc.uniqueArray(
      fc.record({ valor: fc.string({ minLength: 1, maxLength: 8 }).filter((s) => s.trim().length > 0), padrao: fc.boolean() }),
      { selector: (o) => o.valor.trim(), maxLength: 5 },
    )
    const campoArb = fc.record({
      proprietario: fc.constantFrom('SOLICITACAO', 'PEDIDO', 'RECUSA', 'INSUMO'),
      nome: nomeArb,
      tipo: fc.constantFrom('TEXTO', 'LISTA'),
      obrigatorio: fc.boolean(),
      status: fc.boolean(),
      opcoes: opcoesArb,
    })
    const cadastroArb = fc.uniqueArray(campoArb, { selector: (c) => c.nome.trim(), maxLength: 8 })
    const paresArb = fc.array(
      fc.record({ rotulo: fc.string({ maxLength: 10 }), conteudo: fc.string({ maxLength: 20 }) }),
      { maxLength: 6 },
    )

    fc.assert(
      fc.property(cadastroArb, paresArb, (cadastroBruto, atuais) => {
        const cadastro = cadastroBruto as unknown as CampoLivreCadastro[]
        const atuaisAntes = JSON.parse(JSON.stringify(atuais))
        const r = mesclarCamposLivres(cadastro, atuais)

        const validos = cadastroBruto.filter(
          (c) => c.status && (c.proprietario === 'SOLICITACAO' || c.proprietario === 'PEDIDO'),
        )
        const esperados = new Set<string>([
          ...validos.map((c) => c.nome.trim()),
          ...atuais.map((p) => p.rotulo.trim()).filter((x) => x.length > 0),
        ])

        // Conjunto de rótulos: cadastro ativo (SOLICITACAO/PEDIDO) mais os já usados no item.
        expect(new Set(r.rotulos)).toEqual(esperados)
        // Sem repetição e em ordem alfabética.
        expect(r.rotulos).toHaveLength(new Set(r.rotulos).size)
        for (let i = 1; i < r.rotulos.length; i++) {
          expect(r.rotulos[i - 1].localeCompare(r.rotulos[i], 'pt-BR')).toBeLessThanOrEqual(0)
        }
        // Rótulos de campo inativo ou de outro proprietário só aparecem se já estavam no item.
        const nosPares = new Set(atuais.map((p) => p.rotulo.trim()))
        for (const c of cadastroBruto) {
          const elegivel = c.status && (c.proprietario === 'SOLICITACAO' || c.proprietario === 'PEDIDO')
          if (!elegivel && !nosPares.has(c.nome.trim())) expect(r.rotulos).not.toContain(c.nome.trim())
        }
        // Obrigatórios: só campos elegíveis marcados como obrigatórios.
        expect(r.obrigatorios).toEqual(new Set(validos.filter((c) => c.obrigatorio).map((c) => c.nome.trim())))
        // Opções: só de campos LISTA elegíveis, na ordem do cadastro, com a marca de padrão.
        const listas = validos.filter((c) => c.tipo === 'LISTA')
        expect(Object.keys(r.opcoesPorRotulo).sort()).toEqual(listas.map((c) => c.nome.trim()).sort())
        for (const c of listas) {
          expect(r.opcoesPorRotulo[c.nome.trim()]).toEqual(
            c.opcoes.map((o) => ({ valor: o.valor.trim(), padrao: o.padrao })),
          )
        }
        // Nunca altera os pares do item (não adiciona par nem seleciona opção).
        expect(atuais).toEqual(atuaisAntes)
      }),
      { numRuns: NUM_RUNS },
    )
  })

  // Feature: orcamento-grafico-fase3-produto-embalagem, Property 11: Campos livres preservam pares e respeitam limites
  it('Property 11: Campos livres preservam pares e respeitam limites', () => {
    const textoArb = (max: number, limite: number) =>
      fc.oneof(
        fc.string({ maxLength: max }),
        fc.constant('x'.repeat(limite)),
        fc.constant('x'.repeat(limite + 1)),
      )
    const parArb = fc.record({ rotulo: textoArb(60, MAX_ROTULO_CAMPO_LIVRE), conteudo: textoArb(520, MAX_CONTEUDO_CAMPO_LIVRE) })
    const paresArb = fc.array(
      fc.record({ rotulo: fc.string({ maxLength: 10 }), conteudo: fc.string({ maxLength: 20 }) }),
      { maxLength: MAX_PARES_CAMPOS_LIVRES + 2 },
    )

    fc.assert(
      fc.property(paresArb, parArb, (pares, par) => {
        const antes = JSON.parse(JSON.stringify(pares))
        const r = adicionarParCampoLivre(pares, par)
        const deveRejeitar =
          pares.length >= MAX_PARES_CAMPOS_LIVRES ||
          par.rotulo.length > MAX_ROTULO_CAMPO_LIVRE ||
          par.conteudo.length > MAX_CONTEUDO_CAMPO_LIVRE

        // A lista recebida nunca é alterada.
        expect(pares).toEqual(antes)

        if (deveRejeitar) {
          expect(r.ok).toBe(false)
          expect(r.pares).toBe(pares)
          if (!r.ok) expect(r.mensagem.length).toBeGreaterThan(0)
        } else {
          expect(r.ok).toBe(true)
          expect(r.pares).toEqual([...antes, par])
          expect(r.pares.length).toBeLessThanOrEqual(MAX_PARES_CAMPOS_LIVRES)
        }
      }),
      { numRuns: NUM_RUNS },
    )
  })

  // Feature: orcamento-grafico-fase3-produto-embalagem, Property 11: Campos livres preservam pares e respeitam limites
  it('Property 11 (payload): o payload de cálculo não contém camposLivres', () => {
    // `import.meta.url` não é `file:` no ambiente jsdom; o Vitest roda na raiz do front.
    const caminho = resolve(process.cwd(), 'src/app/(interna)/orcamento-grafico/[id]/itemFormShared.ts')
    const fonte = readFileSync(caminho, 'utf8').replace(/\r\n/g, '\n')

    const recortar = (assinatura: string): string => {
      const ini = fonte.indexOf(assinatura)
      expect(ini).toBeGreaterThanOrEqual(0)
      const fim = fonte.indexOf('\n}\n', ini)
      expect(fim).toBeGreaterThan(ini)
      return fonte.slice(ini, fim)
    }

    const calculo = recortar('export function montarPayloadCalculo')
    const materiais = recortar('function materiaisParaCalculo')

    // Controle: o recorte pegou a função certa e o arquivo trata camposLivres no payload de salvar.
    expect(calculo).toContain('tipoEmbalagemId')
    expect(fonte).toContain('camposLivres')

    expect(calculo).not.toContain('camposLivres')
    expect(materiais).not.toContain('camposLivres')
  })
})
