'use client'

/**
 * PlanosDoItemComCatalogo — mantém UMA instância de `useCatalogoItem(produtoGraficoId do item)`
 * por item da página e a entrega ao `PlanosDoItem` em `catalogoCompartilhado` (Fase 3, 14.6).
 *
 * O `PlanosDoItem` é renderizado em `page.tsx`, dentro de um `map` de itens (hooks não podem ficar
 * ali), por isso este wrapper existe. O que fica compartilhado:
 *   - todas as aberturas do modal de plano do mesmo item usam esta instância (produto, plano fixo
 *     e tipos de plano consultados ficam em cache; abrir o modal de novo não refaz a chamada);
 *   - o `PlanosDoItem` não cria consulta própria (recebe `catalogoCompartilhado`).
 * O que NÃO é compartilhado: o `EditorItem` (outra tela) mantém a própria instância, e dois itens
 * com o mesmo produto consultam cada um o seu catálogo.
 * Sem produto gráfico o hook não faz chamada de rede.
 */

import PlanosDoItem, { type PlanosDoItemProps } from './PlanosDoItem'
import { useCatalogoItem } from './editor/catalogo/useCatalogoItem'

export default function PlanosDoItemComCatalogo(props: Omit<PlanosDoItemProps, 'catalogoCompartilhado'>) {
  const catalogo = useCatalogoItem(props.produtoGraficoId)
  return <PlanosDoItem {...props} catalogoCompartilhado={catalogo} />
}
