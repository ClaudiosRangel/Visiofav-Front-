'use client'

/**
 * Tela do item (rota `/orcamento-grafico/:id/itens/:itemId`) — Tela_Item da Fase 2, dirigida pelo
 * cadastro do Produto Gráfico. `itemId = novo` cria o item no primeiro Salvar e passa para a URL
 * do id criado.
 *
 * Item novo vindo de "Incluir item" traz `?linha=<linhaProdutoId>` (escolhida no diálogo de Linha
 * de Produto): a linha filtra o combobox de Produto e dá o título da tela.
 *
 * O `EditorItem` antigo continua nos arquivos (remoção é a tarefa 5.24), mas não é mais montado aqui.
 */

import { useParams, useSearchParams } from 'next/navigation'

import TelaItem, { ID_ITEM_NOVO } from './_item/TelaItem'

export default function PaginaItem() {
  const params = useParams()
  const searchParams = useSearchParams()
  const itemId = params.itemId as string
  const linha = itemId === ID_ITEM_NOVO ? searchParams.get('linha')?.trim() || null : null
  return <TelaItem orcamentoId={params.id as string} itemId={itemId} linhaProdutoIdNovo={linha} />
}
