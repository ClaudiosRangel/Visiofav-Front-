import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Teste de integridade do arquivo compartilhado de vetores do layout do Item
// (tarefa 1.8 — Requirements 20.3, 20.4, 7.9, 7.12). O mesmo arquivo existe no back
// (src/modules/orcamento-grafico/hierarquia/vetores-layout.json) e deve ser idêntico.

const ARQUIVO_FRONT = join(
  process.cwd(), 'src', 'app', '(interna)', 'orcamento-grafico', '[id]', '_layout', 'vetores-layout.json',
)
const ARQUIVO_BACK = resolve(
  process.cwd(), '..', 'VisioFab.Wms.Back', 'src', 'modules', 'orcamento-grafico', 'hierarquia', 'vetores-layout.json',
)

/** Hash do conteúdo normalizando quebras de linha (autocrlf do Git no Windows). */
function hashNormalizado(caminho: string): string {
  const texto = readFileSync(caminho, 'utf8').replace(/\r\n/g, '\n')
  return createHash('sha256').update(texto).digest('hex')
}

describe('vetores-layout.json (front)', () => {
  it('existe e tem vetores com id único', () => {
    const doc = JSON.parse(readFileSync(ARQUIVO_FRONT, 'utf8'))
    expect(doc.versao).toBe(1)
    const ids: string[] = doc.vetores.map((v: { id: string }) => v.id)
    expect(ids.length).toBeGreaterThan(0)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('o back tem arquivo idêntico (hash)', (ctx) => {
    if (!existsSync(ARQUIVO_BACK)) ctx.skip() // repositório vizinho ausente nesta máquina/CI
    expect(hashNormalizado(ARQUIVO_BACK)).toBe(hashNormalizado(ARQUIVO_FRONT))
  })
})
