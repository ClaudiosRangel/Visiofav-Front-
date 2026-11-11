import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

import {
  CAMPOS_POR_LINHA,
  CAMPOS_PADRAO,
  camposDaLinha,
  normalizarCodigoLinha,
  type CampoCondicional,
} from './campos-por-linha'

// Spec: orcamento-grafico-paridade-total-calcgraf.
// Property 6 (totalidade), Property 7 (normalização estável), Property 8
// (preservação ao trocar linha — lógica de conjuntos) + golden cases.

/** Variações acentuadas/com caixa/espaços que devem normalizar para a mesma chave. */
function variacoes(codigo: string): fc.Arbitrary<string> {
  return fc
    .record({
      prefixo: fc.constantFrom('', ' ', '  ', '\t'),
      sufixo: fc.constantFrom('', ' ', '  ', '\t'),
      caixa: fc.constantFrom<'upper' | 'lower' | 'mixed'>('upper', 'lower', 'mixed'),
    })
    .map(({ prefixo, sufixo, caixa }) => {
      let base = codigo
      if (caixa === 'lower') base = base.toLowerCase()
      else if (caixa === 'upper') base = base.toUpperCase()
      else base = base.split('').map((c, i) => (i % 2 ? c.toLowerCase() : c.toUpperCase())).join('')
      return `${prefixo}${base}${sufixo}`
    })
}

describe('campos-por-linha', () => {
  // ─── Property 6: totalidade ────────────────────────────────────────────
  describe('Property 6 — totalidade (nunca retorna vazio)', () => {
    it('retorna array não-vazio para qualquer string ou null', () => {
      fc.assert(
        fc.property(
          fc.oneof(fc.string(), fc.constant(null), fc.constant(undefined)),
          (codigo) => {
            const campos = camposDaLinha(codigo as string | null | undefined)
            expect(Array.isArray(campos)).toBe(true)
            expect(campos.length).toBeGreaterThan(0)
          },
        ),
      )
    })

    it('string não mapeada cai em CAMPOS_PADRAO', () => {
      fc.assert(
        fc.property(fc.string(), (codigo) => {
          const chave = normalizarCodigoLinha(codigo)
          if (!(chave in CAMPOS_POR_LINHA)) {
            expect(camposDaLinha(codigo)).toEqual(CAMPOS_PADRAO)
          }
        }),
      )
    })
  })

  // ─── Property 7: normalização estável ──────────────────────────────────
  describe('Property 7 — normalização estável (acento/caixa/espaço)', () => {
    const codigosMapeados = Object.keys(CAMPOS_POR_LINHA)

    it('variações de caixa/espaço do mesmo código dão o mesmo conjunto', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(...codigosMapeados),
          (codigo) => {
            return fc.assert(
              fc.property(variacoes(codigo), variacoes(codigo), (a, b) => {
                expect(camposDaLinha(a)).toEqual(camposDaLinha(b))
                expect(camposDaLinha(a)).toEqual(CAMPOS_POR_LINHA[codigo])
              }),
            )
          },
        ),
      )
    })

    it("'LÂMINAS', 'laminas ', 'LAMINAS' batem na mesma chave 'LAMINAS'", () => {
      expect(normalizarCodigoLinha('LÂMINAS')).toBe('LAMINAS')
      expect(normalizarCodigoLinha('laminas ')).toBe('LAMINAS')
      expect(normalizarCodigoLinha('LAMINAS')).toBe('LAMINAS')
      expect(normalizarCodigoLinha('  lâ minas ')).toBe('LA MINAS') // espaço interno preservado (colapsado)
      const ref = camposDaLinha('LAMINAS')
      expect(camposDaLinha('LÂMINAS')).toEqual(ref)
      expect(camposDaLinha('laminas ')).toEqual(ref)
    })

    it('colapsa múltiplos espaços internos', () => {
      expect(normalizarCodigoLinha('CARTUCHO   COMPOSTO')).toBe('CARTUCHO COMPOSTO')
      expect(camposDaLinha('cartucho  composto')).toEqual(CAMPOS_POR_LINHA['CARTUCHO COMPOSTO'])
    })
  })

  // ─── Property 8: preservação ao trocar de linha (lógica de conjuntos) ───
  describe('Property 8 — interseção de conjuntos ao trocar de linha', () => {
    const interseccao = (a: CampoCondicional[], b: CampoCondicional[]): CampoCondicional[] =>
      a.filter((c) => b.includes(c))

    it('a interseção de duas linhas é calculável, consistente e simétrica', () => {
      const chaves = [...Object.keys(CAMPOS_POR_LINHA), '__INEXISTENTE__']
      fc.assert(
        fc.property(
          fc.constantFrom(...chaves),
          fc.constantFrom(...chaves),
          (ca, cb) => {
            const a = camposDaLinha(ca)
            const b = camposDaLinha(cb)
            const ab = interseccao(a, b)
            const ba = interseccao(b, a)
            // interseção simétrica (mesmo conjunto, independente da ordem)
            expect(new Set(ab)).toEqual(new Set(ba))
            // todo campo da interseção pertence aos dois conjuntos (seria preservado ao trocar)
            for (const campo of ab) {
              expect(a).toContain(campo)
              expect(b).toContain(campo)
            }
          },
        ),
      )
    })

    it('CARTUCHO ∩ SACOLA inclui abaCola, coberturaTinta, processoImpressao, fibra', () => {
      const cartucho = camposDaLinha('CARTUCHO')
      const sacola = camposDaLinha('SACOLA')
      const inter = interseccao(cartucho, sacola)
      expect(inter).toContain('abaCola')
      expect(inter).toContain('coberturaTinta')
      expect(inter).toContain('processoImpressao')
      expect(inter).toContain('fibra')
      // montagem3d só existe em CARTUCHO → não está na interseção
      expect(inter).not.toContain('montagem3d')
    })
  })

  // ─── Golden ─────────────────────────────────────────────────────────────
  describe('Golden', () => {
    it("camposDaLinha('CARTUCHO') contém 'montagem3d'", () => {
      expect(camposDaLinha('CARTUCHO')).toContain('montagem3d')
    })

    it("camposDaLinha('SACOLA') contém 'alca' e 'fundo' e NÃO contém 'montagem3d'", () => {
      const sacola = camposDaLinha('SACOLA')
      expect(sacola).toContain('alca')
      expect(sacola).toContain('fundo')
      expect(sacola).not.toContain('montagem3d')
    })

    it("camposDaLinha('código inexistente') === CAMPOS_PADRAO", () => {
      expect(camposDaLinha('código inexistente')).toEqual(CAMPOS_PADRAO)
      expect(camposDaLinha(null)).toEqual(CAMPOS_PADRAO)
      expect(camposDaLinha('')).toEqual(CAMPOS_PADRAO)
    })
  })
})
