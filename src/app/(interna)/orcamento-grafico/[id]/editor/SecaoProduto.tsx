'use client'

/**
 * SecaoProduto — seção "Produto" do Editor de Item do Orçamento Gráfico
 * (experiência Calcgraf).
 *
 * Feature: orcamento-grafico-experiencia-calcgraf (Tarefa 5.1)
 * _Requirements: 1.1, 1.5, 1.6_
 *
 * Agrupa numa única seção os sub-forms de engenharia de PRODUTO que no wizard
 * atual (`../../novo/`) eram três telas separadas: Tipo → Medidas → Papel.
 * Replica a composição do step 0 ("Produto") do `ItemWizardModal` — os três
 * `Step*` empilhados num `Stack`, com `Divider` separando as subdivisões
 * "Medidas" e "Papel / Cartão".
 *
 * Componente de APRESENTAÇÃO: apenas compõe os sub-forms existentes e repassa
 * `formData`/`updateForm`. Sem lógica de cálculo, salvamento ou recálculo
 * implícito. O título da seção fica a cargo do `EditorItem` (não é repetido
 * aqui).
 */

import { Stack, Divider } from '@mantine/core'

import type { WizardFormData } from '../../novo/page'
import StepTipo from '../../novo/StepTipo'
import StepMedidas from '../../novo/StepMedidas'
import StepPapel from '../../novo/StepPapel'
import type { CampoCondicional } from './campos-por-linha'

interface Props {
  formData: WizardFormData
  updateForm: (partial: Partial<WizardFormData>) => void
  /**
   * Campos condicionais por Linha de Produto a exibir. Recebido do EditorItem
   * para consistência de assinatura; a ocultação de campos condicionais da
   * seção Produto (ex.: alça/fundo) fica para depois — os campos condicionais
   * mapeáveis hoje vivem em Dados Técnicos (ver SecaoDadosTecnicos). A seção
   * Produto segue exibindo Tipo/Medidas/Papel na íntegra.
   */
  mostrarCampo?: (campo: CampoCondicional) => boolean
}

export default function SecaoProduto({ formData, updateForm }: Props) {
  return (
    <Stack gap="xl">
      <StepTipo formData={formData} updateForm={updateForm} />
      <Divider label="Medidas" labelPosition="center" />
      <StepMedidas formData={formData} updateForm={updateForm} />
      <Divider label="Papel / Cartão" labelPosition="center" />
      <StepPapel formData={formData} updateForm={updateForm} />
    </Stack>
  )
}
