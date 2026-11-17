import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Fase 3 (tarefa 16.2) — nenhum texto exibido ao usuário pode citar o sistema legado
 * ("Calcgraf", "G-Print", "GPrint"). Varre os .ts/.tsx não-teste do módulo orcamento-grafico,
 * ignora comentários e identificadores (nomes de campo/variável/rota) e olha só literais de
 * texto (aspas simples, duplas e template) e texto de JSX.
 */

const RAIZ = __dirname
const MARCA = /calcgraf|calcgraph|g-?print/i

function listar(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const cam = join(dir, nome)
    if (statSync(cam).isDirectory()) {
      if (nome === 'node_modules') continue
      listar(cam, acc)
    } else if (/\.(ts|tsx)$/.test(nome) && !/\.(test|spec|property\.test)\.(ts|tsx)$/.test(nome)) {
      acc.push(cam)
    }
  }
  return acc
}

/** Separa o código em literais de texto e JSX, descartando comentários. */
export function extrairTextos(fonte: string): string[] {
  const textos: string[] = []
  const semLiterais: string[] = []
  let i = 0
  const n = fonte.length
  while (i < n) {
    const c = fonte[i]
    const prox = fonte[i + 1]
    if (c === '/' && prox === '/') {
      while (i < n && fonte[i] !== '\n') i++
      continue
    }
    if (c === '/' && prox === '*') {
      const fim = fonte.indexOf('*/', i + 2)
      i = fim === -1 ? n : fim + 2
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      const aspa = c
      let j = i + 1
      let buf = ''
      while (j < n && fonte[j] !== aspa) {
        if (fonte[j] === '\\') { buf += fonte[j + 1] ?? ''; j += 2; continue }
        if (aspa !== '`' && fonte[j] === '\n') break
        // Em template, `${expressão}` é código (nome de campo), não texto exibido.
        // Pula a expressão inteira, inclusive chaves e templates aninhados.
        if (aspa === '`' && fonte[j] === '$' && fonte[j + 1] === '{') {
          let prof = 1
          j += 2
          while (j < n && prof > 0) {
            if (fonte[j] === '{') prof++
            else if (fonte[j] === '}') prof--
            j++
          }
          buf += ' '
          continue
        }
        buf += fonte[j]
        j++
      }
      textos.push(buf)
      semLiterais.push(' ')
      i = j + 1
      continue
    }
    semLiterais.push(c)
    i++
  }
  // Texto de JSX: entre '>' e '<' sem chaves (já sem comentários e sem literais).
  const codigo = semLiterais.join('')
  for (const m of codigo.matchAll(/>([^<>{}=;()]+)</g)) {
    const t = m[1].replace(/\s+/g, ' ').trim()
    if (t) textos.push(t)
  }
  return textos
}

/** Literal exibível: tem espaço (frase) ou é exatamente um dos termos (rótulo de uma palavra). */
function ehTextoVisivel(t: string): boolean {
  if (/\s/.test(t.trim())) return true
  return /^(calcgraf|g-?print)$/i.test(t.trim())
}

describe('texto visível sem a marca do sistema legado (Req 16.2)', () => {
  it('extrairTextos ignora comentários e identificadores', () => {
    const fonte = [
      '// Calcgraf em comentário',
      '/* G-Print em bloco */',
      'const numeroCalcgraf = obj.calcgraf',
      "const rota = '/api/calcgraf-x'",
      "const msg = 'Importado do Calcgraf'",
      'const j = <b>Dados do GPrint</b>',
    ].join('\n')
    const visiveis = extrairTextos(fonte).filter(ehTextoVisivel).filter((t) => MARCA.test(t))
    expect(visiveis).toEqual(['Importado do Calcgraf', 'Dados do GPrint'])
  })

  it('nenhum arquivo do módulo exibe Calcgraf, G-Print ou GPrint', () => {
    const arquivos = listar(RAIZ)
    expect(arquivos.length).toBeGreaterThan(50)
    const achados: string[] = []
    for (const arq of arquivos) {
      const fonte = readFileSync(arq, 'utf8')
      for (const t of extrairTextos(fonte)) {
        if (ehTextoVisivel(t) && MARCA.test(t)) {
          achados.push(`${relative(RAIZ, arq)}: "${t.slice(0, 120)}"`)
        }
      }
    }
    expect(achados).toEqual([])
  })
})
