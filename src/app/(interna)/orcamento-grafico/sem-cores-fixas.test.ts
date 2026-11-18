import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { relative } from 'node:path'
import {
  RAIZ_MODULO,
  blanquear,
  linhaDe,
  ehEscopoNovo,
  listarArquivosNovos,
  listarArquivosLegado,
} from './escopo-telas-novas'

/**
 * Hierarquia (tarefa 1.4, Req 18.1, 18.2) — as telas NOVAS da reforma não podem usar cores fixas.
 * Reprova #hex, rgb(, rgba(, white, black, dark-N e gray-N em style, bg, c, color, backgroundColor e
 * borderColor. Aceita tokens adaptativos do Mantine: var(--mantine-color-*), *-light, *-filled,
 * *-light-color e cores semânticas de status por nome (red, green, orange...).
 * O escopo é só o código novo (ver escopo-telas-novas.ts); o legado não é verificado nem corrigido.
 */

const TOKEN_MANTINE = /var\(\s*--mantine-color-[\w-]+\s*\)/g

const REGRAS_COR: { motivo: string; re: RegExp }[] = [
  { motivo: 'cor hexadecimal', re: /#[0-9a-fA-F]{3,8}(?![\w-])/ },
  { motivo: 'rgb()/rgba()', re: /(?<![\w-])rgba?\s*\(/i },
  { motivo: 'white/black', re: /(?<![\w-])(white|black)(?![\w-])/i },
  { motivo: 'dark-N/gray-N', re: /(?<![\w])(dark|gray|grey)[-.]\d+/i },
]

/** Motivo da violação de um valor de texto, ou null se o valor for aceito. */
export function violacaoDeCor(valor: string): string | null {
  const limpo = valor.replace(TOKEN_MANTINE, ' ')
  for (const r of REGRAS_COR) if (r.re.test(limpo)) return r.motivo
  return null
}

const PROPRIEDADE = /(?<![\w.$-])(style|bg|c|color|backgroundColor|borderColor)\s*(=(?![=>])|:(?!:))\s*/g
const LITERAL = /"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g

/** Avança até o fim do literal que começa em `ini`. */
function fimDoLiteral(s: string, ini: number): number {
  const aspa = s[ini]
  let j = ini + 1
  while (j < s.length && s[j] !== aspa) {
    if (s[j] === '\\') j++
    else if (aspa !== '`' && s[j] === '\n') break
    j++
  }
  return j + 1
}

/** Fim (exclusivo) do valor que começa em `ini`: literal ou {…} únicos em JSX, ou expressão até , } ) ] ;. */
function fimDoValor(s: string, ini: number, op: string): number {
  const n = s.length
  const primeiro = s[ini]
  if (op === '=' && (primeiro === '"' || primeiro === "'" || primeiro === '`')) return fimDoLiteral(s, ini)
  let prof = 0
  let j = ini
  while (j < n) {
    const ch = s[j]
    if (ch === '"' || ch === "'" || ch === '`') {
      j = fimDoLiteral(s, j)
      continue
    }
    if (ch === '(' || ch === '[' || ch === '{') prof++
    else if (ch === ')' || ch === ']' || ch === '}') {
      if (prof === 0) break
      prof--
      if (prof === 0 && op === '=' && primeiro === '{') return j + 1
    } else if (prof === 0 && (ch === ',' || ch === ';')) break
    else if (prof === 0 && op === '=' && ch === '\n') break
    j++
  }
  return j
}

/** Ocorrências "caminho:linha: propriedade → "valor" (motivo)" de cor fixa na fonte. */
export function acharCoresFixas(fonte: string, caminho: string): string[] {
  const codigo = blanquear(fonte)
  const achados: string[] = []
  const vistos = new Set<number>()
  for (const m of codigo.matchAll(PROPRIEDADE)) {
    const prop = m[1]
    const op = m[2][0]
    const ini = (m.index ?? 0) + m[0].length
    const fim = fimDoValor(codigo, ini, op)
    const expr = codigo.slice(ini, fim)
    for (const l of expr.matchAll(LITERAL)) {
      const valor = l[1] ?? l[2] ?? l[3] ?? ''
      const motivo = violacaoDeCor(valor)
      const pos = ini + (l.index ?? 0)
      if (!motivo || vistos.has(pos)) continue
      vistos.add(pos)
      achados.push(`${caminho}:${linhaDe(codigo, pos)}: ${prop} → "${valor.slice(0, 80)}" (${motivo})`)
    }
  }
  return achados
}

function varrer(arquivos: string[]): string[] {
  const achados: string[] = []
  for (const arq of arquivos) {
    achados.push(...acharCoresFixas(readFileSync(arq, 'utf8'), relative(RAIZ_MODULO, arq)))
  }
  return achados
}

describe('sem cores fixas nas telas novas (Req 18.1, 18.2)', () => {
  describe('detector — fixtures negativas (devem reprovar)', () => {
    it.each([
      ['<Box bg="#fff" />', 'cor hexadecimal'],
      ['<Box c="#1a2B3c" />', 'cor hexadecimal'],
      ['<Box bg="rgb(0,0,0)" />', 'rgb()/rgba()'],
      ["<Box style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }} />", 'rgb()/rgba()'],
      ['<Text c="white" />', 'white/black'],
      ["<Box bg={'black'} />", 'white/black'],
      ['<Text color="dark-7" />', 'dark-N/gray-N'],
      ['<Text c="gray.6" />', 'dark-N/gray-N'],
      ["<Box style={{ borderColor: 'gray-4' }} />", 'dark-N/gray-N'],
      ["<Box style={{ border: '1px solid #ccc' }} />", 'cor hexadecimal'],
      ["<Box bg={ativo ? 'var(--mantine-color-body)' : 'white'} />", 'white/black'],
      ["const estilo = { color: '#333' }", 'cor hexadecimal'],
      ["const estilo = { borderColor: 'dark-4', padding: 4 }", 'dark-N/gray-N'],
      ['<Box bg={`#fff${x}`} />', 'cor hexadecimal'],
    ])('reprova %s', (fonte, motivo) => {
      const r = acharCoresFixas(fonte, 'x.tsx')
      expect(r).toHaveLength(1)
      expect(r[0]).toContain(motivo)
    })

    it('informa linha e propriedade e ignora comentários', () => {
      const fonte = ['// bg="white"', '/* c="#fff" */', 'const a = 1', '<Box', '  bg="white" />'].join('\n')
      expect(acharCoresFixas(fonte, 'a.tsx')).toEqual(['a.tsx:5: bg → "white" (white/black)'])
    })
  })

  describe('detector — fixtures positivas (devem passar)', () => {
    it.each([
      '<Box bg="var(--mantine-color-body)" />',
      '<Box bg="var(--mantine-color-gray-1)" />',
      '<Box bg="var(--mantine-color-white)" />',
      '<Text c="var(--mantine-color-dimmed)" />',
      '<Badge color="red-light" />',
      '<Badge color="blue-filled" />',
      '<Text c="red-light-color" />',
      '<Badge color="green" />',
      '<Text c="dimmed" />',
      '<Badge color={ok ? "teal" : "orange"} />',
      "<Box style={{ background: 'var(--mantine-color-default)', borderColor: 'var(--mantine-color-default-border)' }} />",
      "<Box style={{ background: 'light-dark(var(--mantine-color-gray-1), var(--mantine-color-dark-6))' }} />",
      "<Box style={{ whiteSpace: 'nowrap', padding: 8 }} />",
      "const estado = c === 'white'",
      '<Text data-color="#fff" />',
      '<Box id="#abc" />',
    ])('aceita %s', (fonte) => {
      expect(acharCoresFixas(fonte, 'x.tsx')).toEqual([])
    })
  })

  describe('escopo — só telas novas', () => {
    it.each([
      '[id]/_orcamento/GridItens.tsx',
      '[id]/_layout/resolver-layout-item.ts',
      '[id]/_validacao/validar-faixa.ts',
      '[id]/_hooks/useDadosItem.ts',
      '[id]/itens/[itemId]/page.tsx',
      '[id]/itens/[itemId]/planos/[planoId]/page.tsx',
      '[id]/itens/[itemId]/_item/BlocoComum.tsx',
      '[id]/itens/[itemId]/_plano/pilha-desfazer.ts',
    ])('%s está no escopo', (c) => {
      expect(ehEscopoNovo(c)).toBe(true)
      expect(ehEscopoNovo(c.replace(/\//g, '\\'))).toBe(true)
    })

    it.each(['[id]/page.tsx', '[id]/EditorItem.tsx', 'novo/StepCores.tsx', 'cadastros/produtos/page.tsx'])(
      '%s (legado) fica fora do escopo',
      (c) => {
        expect(ehEscopoNovo(c)).toBe(false)
      },
    )
  })

  it('nenhuma tela nova usa cor fixa (passa com 0 arquivos e vale quando as pastas surgirem)', () => {
    expect(varrer(listarArquivosNovos())).toEqual([])
  })

  // Auditoria informativa do legado (não falha): AUDITAR_LEGADO=1 npx vitest run ... > arquivo
  it.runIf(process.env.AUDITAR_LEGADO === '1')('auditoria do legado (informativa)', () => {
    const achados = varrer(listarArquivosLegado())
    console.log(`LEGADO_CORES_FIXAS total=${achados.length}`)
    const porArquivo = new Map<string, number>()
    for (const a of achados) {
      const arq = a.split(':')[0]
      porArquivo.set(arq, (porArquivo.get(arq) ?? 0) + 1)
    }
    for (const [arq, qtd] of [...porArquivo].sort((x, y) => y[1] - x[1])) console.log(`LEGADO ${qtd} ${arq}`)
    expect(true).toBe(true)
  })
})
