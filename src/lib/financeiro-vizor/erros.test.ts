import { describe, it, expect } from 'vitest'
import fc from 'fast-check'
import { traduzirErroApi } from './erros'

/**
 * Espelha a regra de extração de mensagem do corpo usada em `erros.ts`:
 * aceita apenas `message`/`error` que sejam string com conteúdo após `trim()`.
 * Usado pelo teste para distinguir "mensagem do corpo presente" de "fallback".
 */
function extrairMensagemDoCorpoTeste(erro: unknown): string | null {
  const data = (erro as { response?: { data?: { message?: unknown; error?: unknown } } })
    .response?.data
  if (!data) return null
  for (const candidato of [data.message, data.error]) {
    if (typeof candidato === 'string' && candidato.trim().length > 0) {
      return candidato.trim()
    }
  }
  return null
}

/**
 * Property 10: Tradução de erro sempre retorna texto amigável não vazio.
 *
 * Para qualquer erro (com ou sem mensagem no corpo, com qualquer status),
 * `traduzirErroApi` retorna uma string não vazia e nunca expõe o código HTTP
 * cru como única informação.
 *
 * Validates: Requirements 8.3, 8.4, 8.5, 8.6, 8.7, 8.8
 */

/** Gera um status HTTP plausível (inclui os mapeados e outros arbitrários). */
const statusArb = fc.oneof(
  fc.constantFrom(400, 401, 403, 404, 409, 422, 429, 500, 502, 503),
  fc.integer({ min: 100, max: 599 }),
)

/**
 * Gera um erro no formato do Axios com combinações variadas de corpo:
 * com/sem `message`, com/sem `error`, com/sem `status`, e valores não-string.
 */
const erroAxiosArb = fc.record(
  {
    response: fc.option(
      fc.record(
        {
          status: fc.option(statusArb, { nil: undefined }),
          data: fc.option(
            fc.record(
              {
                message: fc.option(
                  fc.oneof(fc.string(), fc.integer(), fc.constant(null)),
                  { nil: undefined },
                ),
                error: fc.option(
                  fc.oneof(fc.string(), fc.integer(), fc.constant(null)),
                  { nil: undefined },
                ),
              },
              { requiredKeys: [] },
            ),
            { nil: undefined },
          ),
        },
        { requiredKeys: [] },
      ),
      { nil: undefined },
    ),
  },
  { requiredKeys: [] },
)

describe('traduzirErroApi (Property 10)', () => {
  it('sempre retorna uma string não vazia para qualquer erro Axios-like', () => {
    fc.assert(
      fc.property(erroAxiosArb, (erro) => {
        const msg = traduzirErroApi(erro)
        expect(typeof msg).toBe('string')
        expect(msg.trim().length).toBeGreaterThan(0)
      }),
      { numRuns: 300 },
    )
  })

  it('nunca expõe o código HTTP cru como única informação', () => {
    fc.assert(
      fc.property(erroAxiosArb, (erro) => {
        const status = erro.response?.status
        const msgCorpo = extrairMensagemDoCorpoTeste(erro)
        const msg = traduzirErroApi(erro).trim()
        // A mensagem nunca pode ser apenas o número do status HTTP.
        if (typeof status === 'number') {
          expect(msg).not.toBe(String(status))
        }
        // Quando o backend NÃO forneceu mensagem legível no corpo, o retorno
        // não pode ser composto apenas por dígitos (seria um código cru vazando).
        // Se o backend enviou uma mensagem numérica no corpo (ex.: "0"), echoá-la
        // é o comportamento correto de priorizar a mensagem da API.
        if (!msgCorpo) {
          expect(/^\d+$/.test(msg)).toBe(false)
        }
      }),
      { numRuns: 300 },
    )
  })

  it('retorna texto não vazio mesmo para valores totalmente arbitrários (unknown)', () => {
    fc.assert(
      fc.property(
        fc.anything(),
        (qualquer) => {
          const msg = traduzirErroApi(qualquer)
          expect(typeof msg).toBe('string')
          expect(msg.trim().length).toBeGreaterThan(0)
        },
      ),
      { numRuns: 300 },
    )
  })

  it('é determinístico: a mesma entrada produz sempre o mesmo texto', () => {
    fc.assert(
      fc.property(erroAxiosArb, (erro) => {
        const a = traduzirErroApi(erro)
        const b = traduzirErroApi(erro)
        expect(b).toBe(a)
      }),
      { numRuns: 200 },
    )
  })

  it('prioriza a mensagem legível do corpo quando presente (message ou error)', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((s) => s.trim().length > 0),
        statusArb,
        fc.constantFrom('message', 'error'),
        (texto, status, chave) => {
          const erro = { response: { status, data: { [chave]: texto } } }
          expect(traduzirErroApi(erro)).toBe(texto.trim())
        },
      ),
      { numRuns: 200 },
    )
  })

  it('usa mensagem por status quando o corpo não traz texto legível', () => {
    const esperadoPorStatus: Record<number, string> = {
      401: 'Sua sessão expirou ou você não está autenticado. Entre novamente para continuar.',
      403: 'Acesso negado. Você não tem permissão para esta operação.',
      404: 'O recurso solicitado não foi encontrado.',
      409: 'A operação não pôde ser concluída por um conflito no estado atual.',
      422: 'Há dados inválidos na solicitação. Revise os campos e tente novamente.',
    }
    for (const [statusStr, esperado] of Object.entries(esperadoPorStatus)) {
      const status = Number(statusStr)
      // Sem corpo legível: data ausente e message/error não-string.
      expect(traduzirErroApi({ response: { status } })).toBe(esperado)
      expect(
        traduzirErroApi({ response: { status, data: { message: null, error: 123 } } }),
      ).toBe(esperado)
    }
  })
})
