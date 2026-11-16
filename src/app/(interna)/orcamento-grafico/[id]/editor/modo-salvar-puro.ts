/**
 * modo-salvar-puro — decide se o próximo "Salvar" do editor cria (POST) ou atualiza (PUT)
 * o item (spec orcamento-grafico-fase3-produto-embalagem, Req 10.3).
 *
 * O item criado no primeiro salvamento passa a valer como "item existente" mesmo que o
 * passe de seleções de material falhe. Assim, "Salvar" e "Tentar novamente" seguintes
 * sempre fazem PUT e nunca criam um segundo item. Funções puras, sem React nem rede.
 */

export interface ModoSalvar {
  /** `true` = PUT no item existente; `false` = POST de item novo. */
  isEditing: boolean
  /** Id do item a atualizar (`null` quando for criar). */
  itemId: string | null
}

/** Item vindo da página (`itemId`) tem prioridade sobre o criado nesta sessão do editor. */
export function decidirModoSalvar(
  itemId: string | null | undefined,
  itemIdCriado: string | null | undefined,
): ModoSalvar {
  const id = itemId ?? itemIdCriado ?? null
  return { isEditing: !!id, itemId: id || null }
}

/** Guarda o primeiro id criado; um id já guardado nunca é trocado. */
export function registrarItemCriado(
  atual: string | null | undefined,
  idDevolvido: string | null | undefined,
): string | null {
  return atual || idDevolvido || null
}
