'use client'

/**
 * SecaoItensComplementares — seção "Itens Complementares" do Editor de Item do
 * Orçamento Gráfico (experiência Calcgraf).
 *
 * Exibe os itens diversos/fornecidos/campos livres via `StepItensDiversos`.
 * Antes esse sub-form vivia dentro da `SecaoAcabamentos` (abaixo de um
 * Divider); agora é uma seção ancorada própria (`itens-complementares`).
 *
 * Componente de APRESENTAÇÃO: apenas compõe o sub-form existente e repassa
 * `formData`/`updateForm`. Sem lógica de cálculo/salvamento. O título da seção
 * fica a cargo do `EditorItem` (não é repetido aqui).
 */

import type { WizardFormData } from '../../novo/page'
import StepItensDiversos from '../../novo/StepItensDiversos'
import type { CatalogoDoItem } from './catalogo/catalogo.types'
import SugestaoItensDiversos from './catalogo/SugestaoItensDiversos'

interface Props {
  formData: WizardFormData
  updateForm: (partial: Partial<WizardFormData>) => void
  /** Catálogo do produto do item (null = sem produto). Usado na tarefa 4.11 (itens sugeridos). */
  catalogo?: CatalogoDoItem | null
}

export default function SecaoItensComplementares({ formData, updateForm, catalogo }: Props) {
  return (
    <>
      <SugestaoItensDiversos
        catalogo={catalogo}
        itensAtuais={formData.itensDiversos}
        onAdicionar={(novos) =>
          updateForm({ itensDiversos: [...(formData.itensDiversos ?? []), ...novos] })
        }
      />
      <StepItensDiversos formData={formData} updateForm={updateForm} />
    </>
  )
}
