import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Apoio aos testes estáticos da reforma hierarquia Orçamento → Item → Plano (Req 16.7, 18.1, 18.2).
 * Define quais arquivos são "telas novas" da reforma. O código legado do módulo fica FORA do escopo
 * e não é corrigido por esses testes. Pastas que ainda não existem simplesmente não geram arquivos.
 */
export const RAIZ_MODULO = __dirname

/** Caminhos relativos (separador "/") das pastas novas da reforma. */
export const PADROES_ESCOPO_NOVO: RegExp[] = [
  /(^|\/)\[id\]\/(_orcamento|_layout|_validacao|_hooks)\//,
  /(^|\/)\[id\]\/itens\//,
  /(^|\/)(_plano|_item)\//,
  // Fase 1 (paridade com o fluxo legado, tarefa 6.11)
  /^novo-orcamento\//,
  /^DialogoLinhaProduto\.tsx$/,
  /^_calculo-padrao\//,
  /^biblioteca-calculos\//,
  /^\[id\]\/page\.tsx$/,
]

export function ehEscopoNovo(caminhoRelativo: string): boolean {
  const c = caminhoRelativo.replace(/\\/g, '/')
  return PADROES_ESCOPO_NOVO.some((p) => p.test(c))
}

function listar(dir: string, acc: string[] = []): string[] {
  for (const nome of readdirSync(dir)) {
    const cam = join(dir, nome)
    if (statSync(cam).isDirectory()) {
      if (nome === 'node_modules') continue
      listar(cam, acc)
    } else if (/\.(ts|tsx)$/.test(nome) && !/\.(test|spec)\.(ts|tsx)$/.test(nome) && !/\.d\.ts$/.test(nome)) {
      acc.push(cam)
    }
  }
  return acc
}

/** Arquivos .ts/.tsx (não-teste) das telas novas da reforma; vazio enquanto as pastas não existirem. */
export function listarArquivosNovos(): string[] {
  return listar(RAIZ_MODULO).filter((a) => ehEscopoNovo(relative(RAIZ_MODULO, a)))
}

/** Arquivos .ts/.tsx (não-teste) do restante do módulo (legado). Usado só para auditoria informativa. */
export function listarArquivosLegado(): string[] {
  return listar(RAIZ_MODULO).filter((a) => !ehEscopoNovo(relative(RAIZ_MODULO, a)))
}

/**
 * Devolve a fonte com o mesmo tamanho e as mesmas quebras de linha, com comentários trocados por
 * espaços (e, opcionalmente, o conteúdo de literais de texto). Mantém os índices e as linhas.
 */
export function blanquear(fonte: string, blanquearStrings = false): string {
  const out = fonte.split('')
  const n = fonte.length
  const apagar = (de: number, ate: number) => {
    for (let k = de; k < ate; k++) if (out[k] !== '\n') out[k] = ' '
  }
  let i = 0
  while (i < n) {
    const c = fonte[i]
    const p = fonte[i + 1]
    if (c === '/' && p === '/') {
      let j = i
      while (j < n && fonte[j] !== '\n') j++
      apagar(i, j)
      i = j
      continue
    }
    if (c === '/' && p === '*') {
      const f = fonte.indexOf('*/', i + 2)
      const ate = f === -1 ? n : f + 2
      apagar(i, ate)
      i = ate
      continue
    }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1
      while (j < n && fonte[j] !== c) {
        if (fonte[j] === '\\') j++
        else if (c !== '`' && fonte[j] === '\n') break
        j++
      }
      if (blanquearStrings) apagar(i + 1, Math.min(j, n))
      i = j + 1
      continue
    }
    i++
  }
  return out.join('')
}

export function linhaDe(fonte: string, indice: number): number {
  let linha = 1
  for (let k = 0; k < indice && k < fonte.length; k++) if (fonte[k] === '\n') linha++
  return linha
}
