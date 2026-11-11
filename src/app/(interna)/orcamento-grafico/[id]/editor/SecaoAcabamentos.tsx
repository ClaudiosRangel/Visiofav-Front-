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

interface Props {
  formData: WizardFormData
  updateForm: (partial: Partial<WizardFormData>) => void
}

export default function SecaoAcabamentos({ formData, updateForm }: Props) {
  return <StepAcabamentos formData={formData} updateForm={updateForm} mostrar="acabamentos" />
}
