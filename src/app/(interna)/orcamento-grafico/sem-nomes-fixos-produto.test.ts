import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { RAIZ_MODULO, blanquear, linhaDe, listarArquivosNovos } from './escopo-telas-novas'

/**
 * Paridade com o fluxo legado, tarefa 6.11 (Req 16.1, 16.2, 16.4, 19.11) — nenhuma lógica das telas
 * novas pode decidir por NOME de produto ou de linha de produto ("Cartucho", "Lâmina Simples",
 * "Impressos", "Venda de Cartão", "Cartonagem"...). Quem decide é o cadastro (plano fixo, modo de
 * formato, flags do Produto Gráfico). Só literais em decisões de código são reprovados:
 * `=== '...'`, `.includes('...')`, `case '...':`. Comentários e textos de exemplo/JSX ficam de fora.
 */

const NOMES_FIXOS = [
  'cartucho',
  'cartucho composto',
  'cartuchos',
  'lamina simples',
  'laminas',
  'impressos',
  'venda de cartao',
  'cartonagem',
  'sacola',
]

function normalizar(t: string): string {
  return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function ehNomeFixo(literal: string): boolean {
  const n = normalizar(literal)
  if (!n) return false
  return NOMES_FIXOS.some((nome) => n === nome || new RegExp(`(?<![a-z])${nome}(?![a-z])`).test(n))
}

const LIT = `("([^"\\n]*)"|'([^'\\n]*)'|\`([^\`\\n$]*)\`)`
const CONTEXTOS: { motivo: string; re: RegExp }[] = [
  { motivo: 'comparação', re: new RegExp(`(?:===|!==|==|!=)\\s*${LIT}`, 'g') },
  { motivo: 'comparação', re: new RegExp(`${LIT}\\s*(?:===|!==|==|!=)`, 'g') },
  { motivo: 'busca de texto', re: new RegExp(`\\.(?:includes|startsWith|endsWith|indexOf)\\(\\s*${LIT}`, 'g') },
  { motivo: 'lista literal .includes', re: new RegExp(`\\[[^\\]\\n]*${LIT}[^\\]\\n]*\\]\\.(?:includes|indexOf|some)\\(`, 'g') },
  { motivo: 'switch/case', re: new RegExp(`\\bcase\\s+${LIT}\\s*:`, 'g') },
]

/** Ocorrências "caminho:linha: motivo → "literal"" de nome fixo de produto/linha em decisão de código. */
export function acharNomesFixos(fonte: string, caminho: string): string[] {
  const codigo = blanquear(fonte)
  const achados: string[] = []
  const vistos = new Set<string>()
  for (const { motivo, re } of CONTEXTOS) {
    for (const m of codigo.matchAll(re)) {
      // Para a lista literal, examina todos os literais do trecho; nos demais há um só.
      const trecho = m[0]
      for (const l of trecho.matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`\n$]*)`/g)) {
        const valor = l[1] ?? l[2] ?? l[3] ?? ''
        if (!ehNomeFixo(valor)) continue
        const pos = (m.index ?? 0) + (l.index ?? 0)
        const chave = `${pos}`
        if (vistos.has(chave)) continue
        vistos.add(chave)
        achados.push(`${caminho}:${linhaDe(codigo, pos)}: ${motivo} → "${valor.slice(0, 60)}"`)
      }
    }
  }
  return achados
}

describe('sem nomes fixos de produto/linha na lógica das telas novas (Req 16.1, 16.2, 16.4, 19.11)', () => {
  describe('detector — fixtures negativas (devem reprovar)', () => {
    it.each([
      "if (linha.nome === 'Cartucho') {}",
      'if (linha.nome !== "Lâmina Simples") {}',
      "if ('Impressos' == produto.nome) {}",
      "const x = nome.includes('Venda de Cartão')",
      "const y = ['Cartucho', 'Lâmina Simples'].includes(nome)",
      "switch (n) { case 'Cartonagem': break }",
      "const z = nome.toLowerCase() === 'cartucho composto'",
    ])('reprova %s', (fonte) => {
      expect(acharNomesFixos(fonte, 'x.ts').length).toBeGreaterThan(0)
    })

    it('informa a linha', () => {
      const fonte = ['const a = 1', "if (n === 'Cartucho') {}"].join('\n')
      expect(acharNomesFixos(fonte, 'a.ts')).toEqual(['a.ts:2: comparação → "Cartucho"'])
    })
  })

  describe('detector — fixtures positivas (devem passar)', () => {
    it.each([
      "// if (n === 'Cartucho') — comentário",
      "/* nome.includes('Impressos') */",
      "const placeholder = 'Ex.: Cartucho Composto'",
      '<Text>Cartucho</Text>',
      "if (linha.planoUnico === true) {}",
      "if (produto.modoFormato === 'ABERTO_FECHADO') {}",
      "const lista = ['Cartucho']",
      "const t = nome.includes('abc')",
    ])('aceita %s', (fonte) => {
      expect(acharNomesFixos(fonte, 'x.ts')).toEqual([])
    })
  })

  it('os arquivos novos da Fase 1 estão no escopo da varredura', () => {
    const rel = listarArquivosNovos().map((a) => relative(RAIZ_MODULO, a).replace(/\\/g, '/'))
    for (const esperado of [
      'novo-orcamento/page.tsx',
      'DialogoLinhaProduto.tsx',
      '_calculo-padrao/FiltrosCalculo.tsx',
      '_calculo-padrao/ColunasCalculo.tsx',
      '_calculo-padrao/SeletorCalculoPadrao.tsx',
      '[id]/_orcamento/ClientePrincipalBusca.tsx',
      '[id]/_orcamento/ObservacoesEmpresaModal.tsx',
      '[id]/_orcamento/GridItens.tsx',
      '[id]/_orcamento/PainelDadosItem.tsx',
      '[id]/_orcamento/AbaFechamento.tsx',
      '[id]/_orcamento/AbaComissoes.tsx',
      '[id]/_orcamento/fechamentoTotais.ts',
      '[id]/_orcamento/formatacao.ts',
      '[id]/page.tsx',
    ]) {
      expect(rel).toContain(esperado)
    }
  })

  it('nenhuma tela nova decide por nome fixo de produto ou linha', () => {
    const achados: string[] = []
    for (const arq of listarArquivosNovos()) {
      achados.push(...acharNomesFixos(readFileSync(arq, 'utf8'), relative(RAIZ_MODULO, arq)))
    }
    expect(achados).toEqual([])
  })
})
