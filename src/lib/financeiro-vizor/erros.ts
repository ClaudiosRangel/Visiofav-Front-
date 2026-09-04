/**
 * Tradução amigável (pt-BR) de erros da API do painel Financeiro Vizor.
 *
 * Função pura e determinística — sem I/O — coberta por testes property-based
 * (Correctness Property 10 do design). Recebe um erro (tipicamente um
 * `AxiosError`, mas aceita qualquer valor `unknown`) e devolve o texto que
 * deve ser exibido ao usuário.
 *
 * Estratégia (Req 8.3–8.8):
 * 1. Prioriza a mensagem do CORPO da resposta (`response.data.message` ou
 *    `response.data.error`) quando ela for uma string legível — o backend do
 *    módulo responde erros nesse formato (`{ message: ... }`), inclusive o
 *    `formatarErroZod` que devolve `{ message, erros }`.
 * 2. Na ausência de mensagem legível, cai para um texto genérico por status
 *    HTTP: 401 (sessão expirada), 403 (acesso negado), 404 (não encontrado),
 *    409 (conflito), 422 (validação) e um genérico para os demais.
 *
 * Nunca expõe apenas o código HTTP cru: o retorno é sempre uma frase amigável
 * e não vazia.
 */

/** Forma mínima do erro Axios que nos interessa (sem acoplar ao tipo do Axios). */
interface ErroApiLike {
  response?: {
    status?: number
    data?: {
      message?: unknown
      error?: unknown
    }
  }
}

/** Mensagens genéricas por status HTTP, usadas quando o corpo não traz texto legível. */
const MENSAGENS_POR_STATUS: Record<number, string> = {
  401: 'Sua sessão expirou ou você não está autenticado. Entre novamente para continuar.',
  403: 'Acesso negado. Você não tem permissão para esta operação.',
  404: 'O recurso solicitado não foi encontrado.',
  409: 'A operação não pôde ser concluída por um conflito no estado atual.',
  422: 'Há dados inválidos na solicitação. Revise os campos e tente novamente.',
}

/** Mensagem genérica final quando não há mensagem no corpo nem status mapeado. */
const MENSAGEM_GENERICA =
  'Ocorreu um erro ao processar a solicitação. Tente novamente.'

/**
 * Extrai uma mensagem legível do corpo da resposta, se houver.
 * Aceita apenas strings com conteúdo após `trim()`; qualquer outro tipo
 * (número, objeto, `null`, string vazia) é ignorado.
 */
function extrairMensagemDoCorpo(error: ErroApiLike): string | null {
  const data = error.response?.data
  if (!data) return null

  const candidatos = [data.message, data.error]
  for (const candidato of candidatos) {
    if (typeof candidato === 'string' && candidato.trim().length > 0) {
      return candidato.trim()
    }
  }
  return null
}

/**
 * Traduz um erro da API para uma mensagem amigável em pt-BR.
 *
 * @param error erro capturado (normalmente um `AxiosError`).
 * @returns string não vazia, pronta para exibição ao usuário.
 */
export function traduzirErroApi(error: unknown): string {
  const erro = (error ?? {}) as ErroApiLike

  // 1. Prioriza a mensagem do corpo da resposta (Req 8.4–8.8).
  const msgCorpo = extrairMensagemDoCorpo(erro)
  if (msgCorpo) return msgCorpo

  // 2. Fallback por status HTTP.
  const status = erro.response?.status
  if (typeof status === 'number' && MENSAGENS_POR_STATUS[status]) {
    return MENSAGENS_POR_STATUS[status]
  }

  // 3. Genérico (Req 8.8) — cobre ausência de status, erro de rede, etc.
  return MENSAGEM_GENERICA
}
