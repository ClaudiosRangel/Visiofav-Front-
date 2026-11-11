import { describe, it, expect } from 'vitest'
import fc from 'fast-check'

import { traduzirErros, ROTULO_ERRO } from './erros-amigaveis'

const TERMOS_ZOD = ['Expected ', 'received ', 'Number must be', 'Required', 'Invalid']

function vazaZod(texto: string | null): boolean {
  if (!texto) return false
  return TERMOS_ZOD.some((t) => texto.toLowerCase().includes(t.toLowerCase()))
}

describe('traduzirErros', () => {
  it('P2 — campo conhecido mapeia para a frase PT definida', () => {
    const r = traduzirErros({
      issues: [{ path: ['tipoEmbalagemId'], message: 'Expected string, received null' }],
    })
    expect(r.porCampo.tipoEmbalagemId).toBe(ROTULO_ERRO.tipoEmbalagemId)
    expect(vazaZod(r.porCampo.tipoEmbalagemId)).toBe(false)
  })

  it('reproduz o caso real do print sem vazar Zod', () => {
    const r = traduzirErros({
      issues: [
        { campo: 'tipoEmbalagemId', mensagem: 'Expected string, received null' },
        { campo: 'gramatura', mensagem: 'Number must be greater than 0' },
        { campo: 'precoKg', mensagem: 'Number must be greater than 0' },
      ],
    })
    expect(r.porCampo.tipoEmbalagemId).toBe(ROTULO_ERRO.tipoEmbalagemId)
    expect(r.porCampo.gramatura).toBe(ROTULO_ERRO.gramatura)
    expect(r.porCampo.precoKg).toBe(ROTULO_ERRO.precoKg)
    for (const v of Object.values(r.porCampo)) expect(vazaZod(v)).toBe(false)
  })

  it('mensagem geral amigável quando não há issues de campo', () => {
    const r = traduzirErros({ message: 'Required' })
    expect(r.geral).toBeTruthy()
    expect(vazaZod(r.geral)).toBe(false)
  })

  it('P1 — nunca vaza termos Zod crus (property)', () => {
    fc.assert(
      fc.property(
        fc.record({
          message: fc.constantFrom('Required', 'Invalid input', 'Expected string, received null', 'Erro de verdade', ''),
          issues: fc.array(
            fc.record({
              campo: fc.constantFrom('tipoEmbalagemId', 'gramatura', 'precoKg', 'campoDesconhecido', ''),
              mensagem: fc.constantFrom('Expected string, received null', 'Number must be greater than 0', 'OK amigável'),
            }),
            { maxLength: 6 },
          ),
        }),
        (resp) => {
          const r = traduzirErros(resp)
          if (vazaZod(r.geral)) return false
          return Object.values(r.porCampo).every((v) => !vazaZod(v))
        },
      ),
    )
  })

  it('P3 — determinístico', () => {
    const entrada = { issues: [{ campo: 'gramatura', mensagem: 'Number must be greater than 0' }] }
    expect(traduzirErros(entrada)).toEqual(traduzirErros(entrada))
  })

  it('resp vazio/undefined não quebra', () => {
    expect(traduzirErros(undefined).geral).toBeTruthy()
    expect(traduzirErros({}).geral).toBeTruthy()
  })
})
