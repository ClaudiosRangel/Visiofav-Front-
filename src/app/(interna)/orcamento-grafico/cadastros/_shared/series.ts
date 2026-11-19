// Séries de numeração do orçamento (cadastro Orçamento Gráfico → Cadastros → Séries).
// O Nº do orçamento é sequencial POR SÉRIE; nome vazio = série padrão sem nome.

export const SERIES_ENDPOINT = '/orcamento-grafico/cadastros/series'

export interface SerieDocumento {
  id: string
  nome: string
  descricao: string | null
  ativo: boolean
  padrao: boolean
  proximoNumero: number
}

/** Nome da série para exibição em grade/seleção. */
export function nomeSerieExibicao(nome: string | null | undefined): string {
  return nome && nome.trim() ? nome : '(padrão sem nome)'
}

/** Rótulo curto da série no cabeçalho do orçamento (somente leitura). */
export function rotuloSerieCabecalho(nome: string | null | undefined): string {
  return nome && nome.trim() ? nome : '(padrão)'
}
