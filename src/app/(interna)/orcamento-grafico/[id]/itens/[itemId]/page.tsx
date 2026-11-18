'use client'

/**
 * Tela do item (rota `/orcamento-grafico/:id/itens/:itemId`) — Tela_Item da Fase 2, dirigida pelo
 * cadastro do Produto Gráfico. `itemId = novo` cria o item no primeiro Salvar e passa para a URL
 * do id criado.
 *
 * O `EditorItem` antigo continua nos arquivos (remoção é a tarefa 5.24), mas não é mais montado aqui.
 */

import { useParams } from 'next/navigation'

import TelaItem from './_item/TelaItem'

export default function PaginaItem() {
  const params = useParams()
  return <TelaItem orcamentoId={params.id as string} itemId={params.itemId as string} />
}
