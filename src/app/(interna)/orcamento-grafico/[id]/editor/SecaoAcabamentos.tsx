'use client'

/**
 * SecaoAcabamentos — seção "Acabamentos" do Editor de Item do Orçamento Gráfico
 * (experiência Calcgraf).
 *
 * Feature: orcamento-grafico-experiencia-calcgraf (Tarefa 5.3)
 * _Requirements: 1.1, 1.5_
 *
 * Agrupa numa única seção os sub-forms de acabamento que no wizard atual
 * (`../../novo/`) eram duas telas separadas: Acabamentos (lista de atividades/
 * acabamentos com custo) → Diversos (itens diversos/fornecidos/campos livres).
 * Replica a composição dos steps 3 ("Acabamentos") e 4 ("Diversos") do
 * `ItemWizardModal` — os dois `Step*` empilhados num `Stack`, um abaixo do
 * outro, com `Divider` separando as subdivisões.
 *
 * Componente de APRESENTAÇÃO: apenas compõe os sub-forms existentes e repassa
 * `formData`/`updateForm`. Sem lógica de cálculo, salvamento ou recálculo
 * implícito. O título da seção fica a cargo do `EditorItem` (não é repetido
 * aqui).
 */

import { Stack, Divider } from '@mantine/core'

import type { WizardFormData } from '../../novo/page'
import StepAcabamentos from '../../novo/StepAcabamentos'
import StepItensDiversos from '../../novo/StepItensDiversos'

interface Props {
  formData: WizardFormData
  updateForm: (partial: Partial<WizardFormData>) => void
}

export default function SecaoAcabamentos({ formData, updateForm }: Props) {
  return (
    <Stack gap="xl">
      <StepAcabamentos formData={formData} updateForm={updateForm} />
      <Divider label="Diversos" labelPosition="center" />
      <StepItensDiversos formData={formData} updateForm={updateForm} />
    </Stack>
  )
}
