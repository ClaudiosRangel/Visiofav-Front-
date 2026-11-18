import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import { RAIZ_MODULO, blanquear, linhaDe, listarArquivosNovos, listarArquivosLegado } from './escopo-telas-novas'

/**
 * Hierarquia (tarefa 1.4, Req 16.7) — as telas NOVAS da reforma não acessam localStorage nem
 * sessionStorage diretamente; a sessão (token, empresa) só passa por `@/lib/authStorage`.
 * Comentários e textos de literais são ignorados. O legado não é verificado nem corrigido aqui.
 */

const ACESSO_DIRETO = /(?<![\w$])(localStorage|sessionStorage)(?![\w$])/g
const ACESSO_POR_COLCHETES = /\[\s*(["'`])(localStorage|sessionStorage)\1\s*\]/g

/** Ocorrências "caminho:linha: uso direto de X" de localStorage/sessionStorage no código. */
export function acharStorageDireto(fonte: string, caminho: string): string[] {
  const semTexto = blanquear(fonte, true)
  const semComentario = blanquear(fonte)
  const achados: string[] = []
  for (const m of semTexto.matchAll(ACESSO_DIRETO)) {
    achados.push(`${caminho}:${linhaDe(semTexto, m.index ?? 0)}: uso direto de ${m[1]}`)
  }
  for (const m of semComentario.matchAll(ACESSO_POR_COLCHETES)) {
    achados.push(`${caminho}:${linhaDe(semComentario, m.index ?? 0)}: uso direto de ${m[2]}`)
  }
  return achados
}

function varrer(arquivos: string[]): string[] {
  const achados: string[] = []
  for (const arq of arquivos) {
    achados.push(...acharStorageDireto(readFileSync(arq, 'utf8'), relative(RAIZ_MODULO, arq)))
  }
  return achados
}

describe('sessão só via authStorage nas telas novas (Req 16.7)', () => {
  describe('detector — fixtures negativas (devem reprovar)', () => {
    it.each([
      "const t = localStorage.getItem('token')",
      "window.localStorage.setItem('a', 'b')",
      "sessionStorage.removeItem('empresa')",
      "globalThis.sessionStorage.clear()",
      "const s = window['localStorage']",
      "const { getItem } = localStorage",
    ])('reprova %s', (fonte) => {
      expect(acharStorageDireto(fonte, 'x.ts')).toHaveLength(1)
    })

    it('informa a linha', () => {
      const fonte = ['const a = 1', '', "localStorage.clear()"].join('\n')
      expect(acharStorageDireto(fonte, 'a.ts')).toEqual(['a.ts:3: uso direto de localStorage'])
    })
  })

  describe('detector — fixtures positivas (devem passar)', () => {
    it.each([
      "import { getToken } from '@/lib/authStorage'\nconst t = getToken()",
      '// não usar localStorage aqui',
      '/* sessionStorage proibido */',
      "const aviso = 'Não use localStorage'",
      'const meuLocalStorageHelper = 1',
      'const x = obj.localStorageKey',
    ])('aceita %s', (fonte) => {
      expect(acharStorageDireto(fonte, 'x.ts')).toEqual([])
    })
  })

  it('nenhuma tela nova usa localStorage/sessionStorage direto (passa com 0 arquivos e vale quando as pastas surgirem)', () => {
    expect(varrer(listarArquivosNovos())).toEqual([])
  })

  // Auditoria informativa do legado (não falha): AUDITAR_LEGADO=1 npx vitest run ... > arquivo
  it.runIf(process.env.AUDITAR_LEGADO === '1')('auditoria do legado (informativa)', () => {
    const achados = varrer(listarArquivosLegado())
    console.log(`LEGADO_STORAGE total=${achados.length}`)
    for (const a of achados) console.log(`LEGADO ${a}`)
    expect(true).toBe(true)
  })
})
