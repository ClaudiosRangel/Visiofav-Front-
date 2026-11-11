/**
 * Fonte única de verdade das seções/âncoras do Editor de Item do Orçamento
 * Gráfico (experiência Calcgraf).
 *
 * Esta função PURA (sem React/IO) é consumida tanto pelo índice de navegação
 * por âncoras (`IndiceAncoras`) quanto pela renderização das seções do
 * `EditorItem`, garantindo que nunca exista âncora sem seção nem seção sem
 * âncora (design — Property 5).
 *
 * _Requirements: 1.2, 5.2_
 */

/** Identificador de cada seção ancorada do Editor de Item. */
export type AncoraId =
  | 'produto'
  | 'planos'
  | 'dados-tecnicos'
  | 'acabamentos'
  | 'materiais-acabamento'
  | 'itens-complementares'
  | 'estrutura'
  | 'fechamento'

/**
 * Rótulos legíveis por âncora, com a terminologia equivalente à do Calcgraf
 * (Requisito 8.1). Opcional — usado pelo índice de navegação.
 */
export const ANCORA_LABEL: Record<AncoraId, string> = {
  produto: 'Produto',
  planos: 'Tipos de Plano',
  'dados-tecnicos': 'Dados Técnicos',
  acabamentos: 'Acabamentos',
  'materiais-acabamento': 'Materiais de Acabamento',
  'itens-complementares': 'Itens Complementares',
  estrutura: 'Estrutura',
  fechamento: 'Fechamento',
}

/**
 * Monta a lista ordenada de âncoras/seções que o Editor de Item deve exibir
 * para um item.
 *
 * - Âncoras fixas (sempre presentes, nesta ordem): `produto`, `dados-tecnicos`,
 *   `acabamentos`, `estrutura`, `fechamento`.
 * - A âncora `planos` é incluída SE E SOMENTE SE o item tem ≥ 1 plano
 *   (`item.planos?.length > 0`), logo após `produto` — em item de plano único a
 *   seção E a âncora são omitidas (Requisito 5.2).
 *
 * @param item item do orçamento (só precisamos saber se há planos)
 * @returns as âncoras presentes, na ordem de renderização das seções
 */
export function montarAncoras(item: { planos?: unknown[] | null }): AncoraId[] {
  const temPlanos = (item.planos?.length ?? 0) > 0

  return [
    'produto',
    ...(temPlanos ? (['planos'] as const) : []),
    'dados-tecnicos',
    'acabamentos',
    'materiais-acabamento',
    'itens-complementares',
    'estrutura',
    'fechamento',
  ]
}
