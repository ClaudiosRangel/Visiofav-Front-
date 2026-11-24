'use client'

/**
 * AcabamentosDeProduto — atividades do PRODUTO (comuns a todos os planos), marcáveis de forma
 * independente. Reaproveita `SecaoAcabamentos` (e, por baixo, o seletor de atividades com
 * material/restrição do editor atual) sem reescrevê-la.
 *
 * Lista vazia (produto sem atividades no cadastro) é indicada na tela; a lista geral continua
 * disponível dentro da seção para marcar uma atividade fora do cadastro do produto.
 *
 * Componente CONTROLADO (`value`/`onChange`): as marcações ficam no formulário do pai, então abrir
 * painéis ou trocar de bloco não perde edições. Não grava nada; a escolha de material por atividade
 * segue o `ControleSelecao` já existente (passado pelo pai).
 */

import { Badge, Stack, Text } from '@mantine/core'
import { IconTool } from '@tabler/icons-react'
import CartaoSecao from './CartaoSecao'

import type { WizardFormData } from '../../../../novo/page'
import type { CatalogoDoItem } from '../../../editor/catalogo/catalogo.types'
import type { ControleSelecao } from '../../../editor/catalogo/useSelecaoMaterial'
import SecaoAcabamentos from '../../../editor/SecaoAcabamentos'
import type { AcabamentoCarregado } from '../../../editor/useTodosAcabamentos'

export interface AcabamentosDeProdutoProps {
  /** Formulário do item (usa `acabamentosRicos`). */
  value: WizardFormData
  onChange: (parcial: Partial<WizardFormData>) => void
  /** Catálogo do produto (null = sem produto: lista geral). */
  catalogo?: CatalogoDoItem | null
  /** Controle da escolha de material por atividade (só com catálogo). */
  selecao?: ControleSelecao
  /** Lista completa de acabamentos carregada pelo pai. */
  acabamentosExternos?: ReadonlyArray<AcabamentoCarregado> | null
  /** Aviso de lista incompleta (falha de página ou de busca por ids). */
  avisoLista?: string | null
  onTentarNovamente?: () => void
  /** A lista completa ainda está carregando pela primeira vez. */
  carregandoLista?: boolean
}

export default function AcabamentosDeProduto({
  value,
  onChange,
  catalogo,
  selecao,
  acabamentosExternos,
  avisoLista,
  onTentarNovamente,
  carregandoLista,
}: AcabamentosDeProdutoProps) {
  const marcados = value.acabamentosRicos?.length ?? 0
  const produtoSemAtividades = !!catalogo && catalogo.produto.atividades.length === 0

  return (
    <CartaoSecao
      titulo="Acabamentos de Produto"
      icone={<IconTool size={16} />}
      direita={
        <Badge variant="light" color={marcados > 0 ? 'blue' : 'gray'} data-testid="acabamentos-de-produto-contagem">
          {marcados === 1 ? '1 selecionado' : `${marcados} selecionados`}
        </Badge>
      }
      data-testid="acabamentos-de-produto"
    >
      <Stack gap="md">

        {produtoSemAtividades && (
          <Text size="sm" c="dimmed" data-testid="acabamentos-de-produto-vazio">
            Este produto não tem atividades de acabamento cadastradas. Use a lista geral abaixo para marcar alguma.
          </Text>
        )}

        <SecaoAcabamentos
          formData={value}
          updateForm={onChange}
          catalogo={catalogo}
          selecao={selecao}
          acabamentosExternos={acabamentosExternos}
          avisoLista={avisoLista}
          onTentarNovamente={onTentarNovamente}
          carregandoLista={carregandoLista}
          compacto
        />
      </Stack>
    </CartaoSecao>
  )
}
