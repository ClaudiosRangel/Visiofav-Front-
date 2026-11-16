/**
 * acabamentos-paginacao — funções PURAS (sem React, sem rede própria) para
 * carregar TODOS os acabamentos: paginação de 100 em 100 e busca em lote por id
 * das atividades do catálogo que não vieram nas páginas.
 *
 * Feature: orcamento-grafico-fase3-produto-embalagem (Req 11).
 * O acesso à API é injetado (`buscarPagina`, `buscarPorIds`) para testar sem rede.
 */

export const TAMANHO_PAGINA = 100
export const MAX_IDS_POR_REQUISICAO = 50

export interface ComId {
  id: string
}

export interface PaginaAcabamentos<T extends ComId> {
  data: T[]
  /** Total informado pela API (pode faltar). */
  total?: number | null
}

export interface EstadoCarga<T extends ComId> {
  itens: T[]
  /** Próxima página a pedir (1-based). */
  proximaPagina: number
  /** true quando a listagem terminou sem erro. */
  completo: boolean
  /** Mensagem da API quando uma página falhou (null quando não houve falha). */
  erro: string | null
}

/** Remove repetidos por `id`, mantendo a primeira ocorrência e a ordem. */
export function deduplicarPorId<T extends ComId>(itens: readonly T[]): T[] {
  const vistos = new Set<string>()
  const saida: T[] = []
  for (const item of itens) {
    if (vistos.has(item.id)) continue
    vistos.add(item.id)
    saida.push(item)
  }
  return saida
}

/** Divide uma lista em lotes de no máximo `tamanho` itens (tamanho >= 1). */
export function dividirEmLotes<T>(lista: readonly T[], tamanho: number): T[][] {
  const t = Math.max(1, Math.floor(tamanho))
  const lotes: T[][] = []
  for (let i = 0; i < lista.length; i += t) lotes.push(lista.slice(i, i + t))
  return lotes
}

/** Ids pedidos que ainda não estão na lista carregada (sem repetir, na ordem). */
export function idsAusentes(idsPedidos: readonly string[], carregados: readonly ComId[]): string[] {
  const tem = new Set(carregados.map((c) => c.id))
  const vistos = new Set<string>()
  const faltando: string[] = []
  for (const id of idsPedidos) {
    if (!id || tem.has(id) || vistos.has(id)) continue
    vistos.add(id)
    faltando.push(id)
  }
  return faltando
}

/** Extrai a `message` da API de um erro de requisição (ou texto padrão). */
export function mensagemDoErro(erro: unknown): string {
  const e = erro as { response?: { data?: { message?: unknown } }; message?: unknown } | null
  const daApi = e?.response?.data?.message
  if (typeof daApi === 'string' && daApi.trim()) return daApi
  if (typeof e?.message === 'string' && e.message.trim()) return e.message
  return 'Não foi possível carregar os acabamentos.'
}

/**
 * Pagina a listagem em sequência (limit=100) até receber menos de 100 registros,
 * página vazia ou atingir o total informado. Com até 100 registros faz exatamente
 * 1 requisição. Em falha, devolve o já carregado + a mensagem e a página a repetir;
 * passar o `EstadoCarga` anterior em `inicio` retoma de onde parou.
 */
export async function carregarTodasPaginas<T extends ComId>(
  buscarPagina: (pagina: number, limite: number) => Promise<PaginaAcabamentos<T>>,
  inicio?: EstadoCarga<T>,
): Promise<EstadoCarga<T>> {
  let itens = inicio ? [...inicio.itens] : []
  let pagina = inicio ? inicio.proximaPagina : 1
  // Salvaguarda contra API que ignore a paginação (repetiria a mesma página).
  const LIMITE_PAGINAS = 1000
  for (let n = 0; n < LIMITE_PAGINAS; n++) {
    let resposta: PaginaAcabamentos<T>
    try {
      resposta = await buscarPagina(pagina, TAMANHO_PAGINA)
    } catch (e) {
      return { itens: deduplicarPorId(itens), proximaPagina: pagina, completo: false, erro: mensagemDoErro(e) }
    }
    const recebidos = Array.isArray(resposta?.data) ? resposta.data : []
    const antes = itens.length
    itens = deduplicarPorId([...itens, ...recebidos])
    pagina += 1
    const total = typeof resposta?.total === 'number' ? resposta.total : null
    const terminou =
      recebidos.length < TAMANHO_PAGINA ||
      (total !== null && itens.length >= total) ||
      itens.length === antes
    if (terminou) return { itens, proximaPagina: pagina, completo: true, erro: null }
  }
  return { itens, proximaPagina: pagina, completo: true, erro: null }
}

export interface ResultadoBuscaPorIds<T extends ComId> {
  itens: T[]
  /** Ids cujo lote falhou (para "Tentar novamente"). */
  idsComFalha: string[]
  erro: string | null
}

/**
 * Busca em lote (até 50 ids por requisição) as atividades ausentes e as soma à
 * lista, sem repetir. Nenhuma requisição quando não falta nada.
 */
export async function completarPorIds<T extends ComId>(
  carregados: readonly T[],
  idsPedidos: readonly string[],
  buscarPorIds: (ids: string[]) => Promise<T[]>,
): Promise<ResultadoBuscaPorIds<T>> {
  let itens = deduplicarPorId(carregados)
  const faltando = idsAusentes(idsPedidos, itens)
  const idsComFalha: string[] = []
  let erro: string | null = null
  for (const lote of dividirEmLotes(faltando, MAX_IDS_POR_REQUISICAO)) {
    try {
      const achados = await buscarPorIds(lote)
      itens = deduplicarPorId([...itens, ...(Array.isArray(achados) ? achados : [])])
    } catch (e) {
      idsComFalha.push(...lote)
      erro = erro ?? mensagemDoErro(e)
    }
  }
  return { itens, idsComFalha, erro }
}
