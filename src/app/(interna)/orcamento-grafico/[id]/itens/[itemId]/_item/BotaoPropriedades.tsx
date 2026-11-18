'use client'

/**
 * BotaoPropriedades — botão "Propriedades/Preview" ao lado de Ajuste Corte Micro (mm) (R13, decisão D2).
 *
 * Abre o `PreviewFichaMaster` já existente (Drawer somente leitura com imagem de corte, arte e dados
 * gráficos), lendo a ficha master do ORÇAMENTO pelo hook `useFichaMaster`. Por isso recebe só o
 * `orcamentoId`. Não tem estado de formulário: não grava, não recalcula e não altera item, plano
 * nem orçamento. Fechar o painel não toca nos campos da tela de origem.
 */

import PreviewFichaMaster from '../../../_orcamento/PreviewFichaMaster'

export const ROTULO_PROPRIEDADES = 'Propriedades/Preview'

export interface BotaoPropriedadesProps {
  /** Orçamento do item (a ficha master é lida por orçamento). */
  orcamentoId: string
  /** Abre o painel já na montagem (útil em testes). */
  abertoInicialmente?: boolean
}

export default function BotaoPropriedades({ orcamentoId, abertoInicialmente }: BotaoPropriedadesProps) {
  return (
    <PreviewFichaMaster
      orcamentoId={orcamentoId}
      abertoInicialmente={abertoInicialmente}
      rotuloBotao={ROTULO_PROPRIEDADES}
      tamanhoBotao="sm"
    />
  )
}
