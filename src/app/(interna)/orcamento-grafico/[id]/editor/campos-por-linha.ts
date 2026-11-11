// Mapa fixo Linha de Produto → campos condicionais (frontend).
// Spec: orcamento-grafico-paridade-total-calcgraf (Requisito 2, Properties 6–8).
//
// O mapeamento entre o CÓDIGO de cada Linha de Produto e o conjunto de campos
// condicionais a exibir é FIXO (definido no Sistema, não configurável pelo
// usuário), cobrindo os códigos das linhas ativas do legado. O código é
// normalizado (sem acento/caixa/trim/espaços internos colapsados) antes de
// casar com a chave do mapa.

// Chaves de campo condicional exibíveis na seção Produto/Dados Técnicos.
export type CampoCondicional =
  | 'montagem3d' | 'abaCola' | 'abaFechamento' | 'alca' | 'fundo'
  | 'microondulado' | 'fibra' | 'formatoCorte' | 'coberturaTinta' | 'processoImpressao'

// Mapa FIXO por CÓDIGO normalizado da linha (sem acento/caixa/trim).
export const CAMPOS_POR_LINHA: Record<string, CampoCondicional[]> = {
  'CARTUCHO':          ['montagem3d', 'abaCola', 'abaFechamento', 'fibra', 'formatoCorte', 'coberturaTinta', 'processoImpressao'],
  'CARTUCHO COMPOSTO': ['montagem3d', 'abaCola', 'abaFechamento', 'microondulado', 'fibra', 'formatoCorte', 'coberturaTinta', 'processoImpressao'],
  'SACOLA':            ['alca', 'fundo', 'abaCola', 'fibra', 'coberturaTinta', 'processoImpressao'],
  'LAMINA SIMPLES':    ['formatoCorte', 'coberturaTinta', 'processoImpressao'],
  'LAMINAS':           ['formatoCorte', 'coberturaTinta', 'processoImpressao'],
}

// Conjunto padrão quando a linha não está mapeada (R2.5): TODOS os campos.
export const CAMPOS_PADRAO: CampoCondicional[] = [
  'montagem3d', 'abaCola', 'abaFechamento', 'alca', 'fundo', 'microondulado', 'fibra', 'formatoCorte', 'coberturaTinta', 'processoImpressao',
]

/**
 * Normaliza o código da linha: remove acentos (NFD + remoção de diacríticos),
 * converte para caixa alta, remove espaços nas bordas e colapsa múltiplos
 * espaços internos em um único. Assim `'LÂMINAS'`, `'laminas '` e `'LAMINAS'`
 * batem na mesma chave `'LAMINAS'`.
 */
export function normalizarCodigoLinha(codigo?: string | null): string {
  if (!codigo) return ''
  return codigo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Retorna o conjunto de campos condicionais da linha (mapeado pelo código
 * normalizado) ou `CAMPOS_PADRAO` quando a linha não está mapeada/é nula.
 * Nunca retorna um conjunto vazio.
 */
export function camposDaLinha(codigo?: string | null): CampoCondicional[] {
  const chave = normalizarCodigoLinha(codigo)
  const mapeado = CAMPOS_POR_LINHA[chave]
  return mapeado ?? CAMPOS_PADRAO
}
