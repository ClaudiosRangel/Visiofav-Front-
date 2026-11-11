/**
 * erros-amigaveis — tradução de erros de validação do backend para linguagem
 * humana (PT), evitando vazar texto cru do Zod para o usuário final.
 *
 * Feature: orcamento-editor-ux-redesign (Req 1)
 *
 * O backend pode responder, em caso de validação, com:
 *  - `{ issues: [{ campo, mensagem }] }` (formato amigável do handler global), OU
 *  - `{ issues: [{ path: [...], message }] }` (ZodError cru), OU
 *  - `{ message: '...' }` (mensagem única).
 *
 * Esta função PURA normaliza qualquer um desses formatos em:
 *  - `geral`: uma frase amigável de resumo (ou null quando só há erros de campo), e
 *  - `porCampo`: mapa campo → frase amigável, para exibição INLINE.
 *
 * Regra anti-vazamento: o texto cru do Zod em inglês ("Expected string,
 * received null", "Number must be greater than 0", "Required", "Invalid",
 * "Expected ...") NUNCA é propagado — é substituído pela frase mapeada do campo
 * ou por um fallback genérico.
 */

/** Frases amigáveis por campo conhecido (terminologia do orçamento). */
export const ROTULO_ERRO: Record<string, string> = {
  tipoEmbalagemId: 'Selecione o tipo de embalagem.',
  medidas: 'Preencha as medidas da embalagem.',
  gramatura: 'Informe a gramatura do papel.',
  precoKg: 'Informe o preço por kg do papel.',
  papelId: 'Selecione o papel/cartão.',
  suporteId: 'Selecione o suporte (papel/cartão).',
  cores: 'Adicione ao menos uma cor de impressão.',
  quantidade: 'Informe a quantidade (tiragem).',
  maquinaId: 'Selecione a máquina de impressão.',
  tabelaMargemId: 'Selecione a tabela de margem.',
  aproveitamentoManual: 'Informe o aproveitamento (peças por folha).',
}

/** Fallback quando o campo não está mapeado. */
const FALLBACK_CAMPO = 'Revise este campo.'
const FALLBACK_GERAL = 'Revise os dados do item para continuar.'

/**
 * Detecta se um texto é mensagem crua de validação (Zod/inglês) que não deve
 * ser mostrada ao usuário.
 */
function ehTextoCru(texto: unknown): boolean {
  if (typeof texto !== 'string') return true
  const t = texto.trim()
  if (!t) return true
  return /expected\s|received\s|number must be|string must|required$|^invalid|nan|null/i.test(t)
}

/** Extrai o nome do campo de um issue (amigável `campo` OU Zod `path[]`). */
function campoDoIssue(issue: Record<string, unknown>): string | null {
  if (typeof issue.campo === 'string' && issue.campo) return issue.campo
  if (Array.isArray(issue.path) && issue.path.length) {
    // path pode ser ['medidas', 'L'] → usamos o primeiro segmento como campo.
    const primeiro = issue.path[0]
    if (typeof primeiro === 'string' && primeiro) return primeiro
  }
  return null
}

export interface ErrosAmigaveis {
  /** Resumo geral amigável (null quando só há erros de campo). */
  geral: string | null
  /** Mapa campo → frase amigável (para exibição inline). */
  porCampo: Record<string, string>
}

/**
 * Traduz a resposta de erro do backend para mensagens amigáveis.
 * `resp` é tipicamente `err.response.data`.
 */
export function traduzirErros(resp: unknown): ErrosAmigaveis {
  const porCampo: Record<string, string> = {}

  const data = (resp ?? {}) as Record<string, unknown>
  const issues = Array.isArray(data.issues) ? (data.issues as Record<string, unknown>[]) : []

  for (const issue of issues) {
    const campo = campoDoIssue(issue)
    if (!campo) continue
    // Preferimos o rótulo mapeado. Só usamos a `mensagem` do backend se ela NÃO
    // for texto cru (alguns handlers já mandam mensagem amigável em PT).
    const mensagemBackend = (issue.mensagem ?? issue.message) as unknown
    porCampo[campo] = ROTULO_ERRO[campo] ?? (ehTextoCru(mensagemBackend) ? FALLBACK_CAMPO : String(mensagemBackend))
  }

  // Mensagem geral: usa a `message` do backend quando NÃO for texto cru; senão,
  // um fallback amigável. Se há erros por campo, o geral pode ser null (o resumo
  // vem dos campos), mas mantemos uma frase curta de contexto quando não há campos.
  const temCampos = Object.keys(porCampo).length > 0
  const msg = data.message as unknown
  let geral: string | null = null
  if (!temCampos) {
    geral = ehTextoCru(msg) ? FALLBACK_GERAL : String(msg)
  } else {
    geral = ehTextoCru(msg) ? null : String(msg)
  }

  return { geral, porCampo }
}
