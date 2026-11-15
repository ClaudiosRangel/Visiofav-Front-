'use client'

/**
 * SecaoAcabamentos — seção "Acabamentos" do Editor de Item do Orçamento Gráfico
 * (experiência Calcgraf).
 *
 * Exibe APENAS a lista de acabamentos do `StepAcabamentos` (via a prop
 * `mostrar="acabamentos"`). Os "Materiais de acabamento" viraram a seção
 * `materiais-acabamento` (`SecaoMateriaisAcabamento`) e os itens
 * diversos/fornecidos/campos livres viraram a seção `itens-complementares`
 * (`SecaoItensComplementares`) — ambas ancoradas separadamente no `EditorItem`.
 *
 * Componente de APRESENTAÇÃO: apenas compõe o sub-form existente e repassa
 * `formData`/`updateForm`. Sem lógica de cálculo/salvamento. O título da seção
 * fica a cargo do `EditorItem` (não é repetido aqui).
 */

import type { WizardFormData } from '../../novo/page'
import StepAcabamentos from '../../novo/StepAcabamentos'
import type { CatalogoDoItem } from './catalogo/catalogo.types'
import type { ControleSelecao } from './catalogo/useSelecaoMaterial'

interface Props {
  formData: WizardFormData
  updateForm: (partial: Partial<WizardFormData>) => void
  /** Catálogo do produto do item (null = sem produto: lista geral, como hoje). */
  catalogo?: CatalogoDoItem | null
  /** Controle da escolha de material por atividade (só com catálogo). */
  selecao?: ControleSelecao
}

export default function SecaoAcabamentos({ formData, updateForm, catalogo, selecao }: Props) {
  return (
    <StepAcabamentos
      formData={formData}
      updateForm={updateForm}
      mostrar="acabamentos"
      catalogo={catalogo ?? null}
      selecao={catalogo ? selecao : undefined}
    />
  )
}
