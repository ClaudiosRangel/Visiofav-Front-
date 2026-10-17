/**
 * Rótulo de plano/face — normalização de nomenclatura exibida ao usuário.
 *
 * Spec pcp-visualizacao-planos-gantt (Req 1). Decisão de negócio da Carton
 * Wega (reunião 15/10/2026): a face de retiração chama-se SEMPRE "VERSO",
 * nunca "COSTA". Dados antigos (nomes de PlanoOrdemProducao / descrição de
 * etapa) podem ter "COSTA" persistido — então a normalização acontece na
 * EXIBIÇÃO, no frontend, de forma centralizada.
 *
 * Função PURA (sem I/O), testável isolada (vitest). Idempotente.
 */

/** Regex do token isolado "costa" em qualquer caixa (delimitado por `\b`). */
const TOKEN_COSTA = /\bcosta\b/gi

/**
 * Troca o token isolado "COSTA" (case-insensitive) por "VERSO", preservando o
 * restante do texto. Não afeta substrings (ex.: "Acostamento" permanece).
 * `null`/`undefined`/"" → "". Idempotente (a saída não contém mais o token).
 */
export function rotuloPlano(nome: string | null | undefined): string {
  if (!nome) return ''
  return nome.replace(TOKEN_COSTA, 'VERSO')
}

/**
 * Mesma regra do `rotuloPlano`, aplicada a textos que embutem a face na
 * descrição (ex.: rótulo de barra do Gantt "Impressão — COSTA"). Nome separado
 * só para deixar a intenção clara no ponto de uso.
 */
export function rotuloComFace(texto: string | null | undefined): string {
  return rotuloPlano(texto)
}
