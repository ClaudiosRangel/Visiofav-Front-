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

import { Text } from '@mantine/core'

import type { WizardFormData } from '../../novo/page'
import StepItensDiversos from '../../novo/StepItensDiversos'
import type { OpcaoSugerida } from './campos-livres-puro'
import type { CatalogoDoItem } from './catalogo/catalogo.types'
import SugestaoItensDiversos from './catalogo/SugestaoItensDiversos'

interface Props {
  formData: WizardFormData
  updateForm: (partial: Partial<WizardFormData>) => void
  /** Catálogo do produto do item (null = sem produto). Usado na tarefa 4.11 (itens sugeridos). */
  catalogo?: CatalogoDoItem | null
  /** Sugestões de campos livres (hook do editor). Ausentes = campos livres como hoje. */
  sugestoesRotulos?: ReadonlyArray<string>
  opcoesPorRotulo?: Readonly<Record<string, ReadonlyArray<OpcaoSugerida>>>
  obrigatorios?: ReadonlySet<string>
  /** Falha ao carregar os campos livres cadastrados; não bloqueia o salvamento. */
  avisoCamposLivres?: string | null
  /** Só uma das listas (abas da tela do item). Ausente = as três. */
  secao?: 'diversos' | 'fornecidos' | 'livres'
}

export default function SecaoItensComplementares({
  formData, updateForm, catalogo, sugestoesRotulos, opcoesPorRotulo, obrigatorios, avisoCamposLivres, secao,
}: Props) {
  return (
    <>
      {(!secao || secao === 'diversos') && (
      <SugestaoItensDiversos
        catalogo={catalogo}
        itensAtuais={formData.itensDiversos}
        onAdicionar={(novos) =>
          updateForm({ itensDiversos: [...(formData.itensDiversos ?? []), ...novos] })
        }
      />
      )}
      {avisoCamposLivres && (!secao || secao === 'livres') && (
        <Text size="xs" c="dimmed" mb="xs" data-testid="aviso-campos-livres">
          Não foi possível carregar as sugestões de campos livres ({avisoCamposLivres}). Você pode digitar os
          campos normalmente.
        </Text>
      )}
      <StepItensDiversos
        formData={formData}
        updateForm={updateForm}
        sugestoesRotulos={sugestoesRotulos}
        opcoesPorRotulo={opcoesPorRotulo}
        obrigatorios={obrigatorios}
        secao={secao}
      />
    </>
  )
}
