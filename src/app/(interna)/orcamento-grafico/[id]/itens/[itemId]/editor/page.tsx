'use client'
/**
 * Editor do cálculo do item (rota `/orcamento-grafico/:id/itens/:itemId/editor`).
 * Spec orcamento-editor-calculo.
 */
import { useParams } from 'next/navigation'
import EditorCalculo from './EditorCalculo'

export default function PaginaEditorCalculo() {
  const params = useParams()
  return <EditorCalculo orcamentoId={params.id as string} itemId={params.itemId as string} />
}
