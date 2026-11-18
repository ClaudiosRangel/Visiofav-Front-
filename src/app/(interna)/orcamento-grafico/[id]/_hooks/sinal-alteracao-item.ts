/**
 * sinal-alteracao-item — avisa a Tela_Orcamento de que um item foi salvo na Tela_Item.
 *
 * As duas telas são rotas diferentes: quando a Tela_Item salva, a Tela_Orcamento normalmente não
 * está montada. O sinal fica guardado em memória (por orçamento) e é consumido quando a
 * Tela_Orcamento monta, que então chama o `notificarAlteracaoItem()` do `useFechamentoTotalizador`.
 * Se ela estiver montada, recebe o evento na hora. Nada vai para `localStorage`/`sessionStorage`.
 */

export const EVENTO_ITEM_ALTERADO = 'orcamento-grafico:item-alterado'

const pendentes = new Set<string>()

export function notificarAlteracaoItem(orcamentoId: string): void {
  pendentes.add(orcamentoId)
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(EVENTO_ITEM_ALTERADO, { detail: { orcamentoId } }))
  }
}

/** `true` (uma única vez) quando há alteração pendente para o orçamento. */
export function consumirAlteracaoItem(orcamentoId: string): boolean {
  return pendentes.delete(orcamentoId)
}
