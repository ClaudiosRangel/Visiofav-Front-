'use client'

/**
 * SecaoMateriaisAcabamento — seção "Materiais de Acabamento" do Editor de Item
 * do Orçamento Gráfico (experiência Calcgraf).
 *
 * Exibe APENAS o bloco "Materiais de acabamento (computar no custo)" do
 * `StepAcabamentos`, via a prop `mostrar="materiais"`. Toda a lógica
 * (estados/efeitos/handlers/hidratação/payload) continua dentro do
 * `StepAcabamentos` — aqui só compomos e repassamos `formData`/`updateForm`.
 *
 * Componente de APRESENTAÇÃO: sem lógica de cálculo/toggle/patch própria. O
 * título da seção fica a cargo do `EditorItem` (não é repetido aqui).
 */

import type { WizardFormData } from '../../novo/page'
import StepAcabamentos from '../../novo/StepAcabamentos'

interface Props {
  formData: WizardFormData
  updateForm: (partial: Partial<WizardFormData>) => void
}

export default function SecaoMateriaisAcabamento({ formData, updateForm }: Props) {
  return <StepAcabamentos formData={formData} updateForm={updateForm} mostrar="materiais" />
}
