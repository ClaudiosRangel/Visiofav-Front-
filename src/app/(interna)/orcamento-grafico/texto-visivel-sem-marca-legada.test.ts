import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Fase 3 (tarefa 16.2) + hierarquia (tarefa 1.2, Req 17.1-17.4) — nenhum texto exibido ao usuário
 * pode citar o sistema legado ou seus fornecedores (Calcgraf/Calcograf/Calcgraph, G-Print/G Print/GPrint,
 * PHTech). Varre recursivamente os .ts/.tsx não-teste do módulo orcamento-grafico, ignora comentários
 * e identificadores (nomes de campo/variável/rota) e olha só literais de texto (aspas simples, duplas
 * e template) e texto de JSX. Cada ocorrência é informada com caminho, linha e trecho.
 */

const RAIZ = __dirname

/** Normaliza: minúsculas e sem acento (CÁLCGRAF -> calcgraf). */
export function normalizar(t: string): string {
  return t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

/** Marca legada sobre texto já normalizado; "g print"/"g-print"/"gprint" não casam dentro de outra palavra. */
const MARCA_NORM = /calcgraf|calcograf|calcgraph|(?<![a-z])g[\s-]?print|phtech/
const MARCA_EXATA_NORM = /^(calcgraf|calcograf|calcgraph|g[\s-]?print|phtech)$/

export function contemMarcaLegada(t: string): boolean {
  return MARCA_NORM.test(normalizar(t))
}

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

export interface TextoComLinha { texto: string; linha: number }

/** Separa o código em literais de texto e JSX (com a linha de origem), descartando comentários. */
export function extrairTextosComLinha(fonte: string): TextoComLinha[] {
  const textos: TextoComLinha[] = []
  const semLiterais: { c: string; linha: number }[] = []
  let i = 0
  let linha = 1
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
      const ate = fim === -1 ? n : fim + 2
      for (let k = i; k < ate; k++) if (fonte[k] === '\n') linha++
      i = ate
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      const aspa = c
      const linhaIni = linha
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
            if (fonte[j] === '\n') linha++
            if (fonte[j] === '{') prof++
            else if (fonte[j] === '}') prof--
            j++
          }
          buf += ' '
          continue
        }
        if (fonte[j] === '\n') linha++
        buf += fonte[j]
        j++
      }
      textos.push({ texto: buf, linha: linhaIni })
      semLiterais.push({ c: ' ', linha: linhaIni })
      i = j + 1
      continue
    }
    if (c === '\n') linha++
    semLiterais.push({ c, linha })
    i++
  }
  // Texto de JSX: entre '>' e '<' sem chaves (já sem comentários e sem literais).
  const codigo = semLiterais.map((x) => x.c).join('')
  for (const m of codigo.matchAll(/>([^<>{}=;()]+)</g)) {
    const t = m[1].replace(/\s+/g, ' ').trim()
    if (!t) continue
    const offset = (m.index ?? 0) + 1 + (m[1].length - m[1].trimStart().length)
    textos.push({ texto: t, linha: semLiterais[Math.min(offset, semLiterais.length - 1)].linha })
  }
  return textos
}

/** Compatibilidade: só os textos. */
export function extrairTextos(fonte: string): string[] {
  return extrairTextosComLinha(fonte).map((x) => x.texto)
}

/** Literal exibível: tem espaço (frase) ou é exatamente um dos termos (rótulo de uma palavra). */
function ehTextoVisivel(t: string): boolean {
  if (/\s/.test(t.trim())) return true
  return MARCA_EXATA_NORM.test(normalizar(t.trim()))
}

/** Ocorrências "caminho:linha: "trecho"" de marca legada em texto visível da fonte. */
export function acharMarcaLegada(fonte: string, caminho: string): string[] {
  return extrairTextosComLinha(fonte)
    .filter((x) => ehTextoVisivel(x.texto) && contemMarcaLegada(x.texto))
    .map((x) => `${caminho}:${x.linha}: "${x.texto.slice(0, 120)}"`)
}

describe('texto visível sem a marca do sistema legado (Req 16.2, 17.1-17.4)', () => {
  it('extrairTextos ignora comentários e identificadores', () => {
    const fonte = [
      '// Calcgraf em comentário',
      '/* G-Print em bloco */',
      'const numeroCalcgraf = obj.calcgraf',
      'const ancorarCustoCalcgraf = 1; const calculoGraficoOrigemId = 2',
      "const rota = '/api/calcgraf-x'",
      "const msg = 'Importado do Calcgraf'",
      'const j = <b>Dados do GPrint</b>',
    ].join('\n')
    const visiveis = extrairTextos(fonte).filter(ehTextoVisivel).filter(contemMarcaLegada)
    expect(visiveis).toEqual(['Importado do Calcgraf', 'Dados do GPrint'])
  })

  it.each(['Calcograf', 'PHTech', 'G Print', 'g-print', 'CÁLCGRAF'])(
    'detector pega "%s" como texto visível',
    (marca) => {
      expect(contemMarcaLegada(marca)).toBe(true)
      expect(ehTextoVisivel(marca)).toBe(true)
      expect(acharMarcaLegada(`const a = 'Origem: ${marca}'`, 'x.ts')).toEqual([`x.ts:1: "Origem: ${marca}"`])
    },
  )

  it('informa a linha correta e não acusa texto limpo', () => {
    const fonte = ["const a = 'ok'", '', "const b = 'Veja o PHTech aqui'"].join('\n')
    expect(acharMarcaLegada(fonte, 'a.ts')).toEqual(['a.ts:3: "Veja o PHTech aqui"'])
    expect(acharMarcaLegada("const c = 'Cálculo gráfico e impressão'", 'b.ts')).toEqual([])
  })

  it('nenhum arquivo do módulo exibe a marca legada', () => {
    const arquivos = listar(RAIZ)
    expect(arquivos.length).toBeGreaterThan(50)
    const achados: string[] = []
    for (const arq of arquivos) {
      achados.push(...acharMarcaLegada(readFileSync(arq, 'utf8'), relative(RAIZ, arq)))
    }
    expect(achados).toEqual([])
  })
})
