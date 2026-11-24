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

import { Group, Loader, Text } from '@mantine/core'

import type { WizardFormData } from '../../novo/page'
import StepAcabamentos, { type AcabamentoCadastro } from '../../novo/StepAcabamentos'
import type { CatalogoDoItem } from './catalogo/catalogo.types'
import type { ControleSelecao } from './catalogo/useSelecaoMaterial'
import type { AcabamentoCarregado } from './useTodosAcabamentos'

interface Props {
  formData: WizardFormData
  updateForm: (partial: Partial<WizardFormData>) => void
  /** Catálogo do produto do item (null = sem produto: lista geral, como hoje). */
  catalogo?: CatalogoDoItem | null
  /** Controle da escolha de material por atividade (só com catálogo). */
  selecao?: ControleSelecao
  /** Lista completa de acabamentos carregada pelo editor (ausente = carga própria, como no wizard). */
  acabamentosExternos?: ReadonlyArray<AcabamentoCarregado> | null
  /** Aviso de lista incompleta (falha de página ou de busca por ids). */
  avisoLista?: string | null
  onTentarNovamente?: () => void
  /** A lista completa ainda está sendo carregada pela primeira vez. */
  carregandoLista?: boolean
  /** Lista simples de marcar (tela do item). */
  compacto?: boolean
}

export default function SecaoAcabamentos({
  formData, updateForm, catalogo, selecao, acabamentosExternos, avisoLista, onTentarNovamente, carregandoLista, compacto,
}: Props) {
  // Primeira carga da lista completa: evita mostrar "nenhum acabamento" antes da resposta.
  if (carregandoLista && (acabamentosExternos?.length ?? 0) === 0) {
    return (
      <Group gap="xs">
        <Loader size="xs" />
        <Text size="sm" c="dimmed">Carregando acabamentos…</Text>
      </Group>
    )
  }
  return (
    <StepAcabamentos
      formData={formData}
      updateForm={updateForm}
      mostrar="acabamentos"
      catalogo={catalogo ?? null}
      selecao={catalogo ? selecao : undefined}
      acabamentosExternos={acabamentosExternos as unknown as ReadonlyArray<AcabamentoCadastro> | null | undefined}
      avisoLista={avisoLista}
      onTentarNovamente={onTentarNovamente}
      compacto={compacto}
    />
  )
}
