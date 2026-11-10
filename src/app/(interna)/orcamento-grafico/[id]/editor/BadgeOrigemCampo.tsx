'use client'

/**
 * BadgeOrigemCampo — indicador por campo técnico da legenda do Editor de Item
 * (experiência Calcgraf).
 *
 * Feature: orcamento-grafico-experiencia-calcgraf (Tarefa 5.2)
 * _Requirements: 4.4_
 *
 * Recebe o NOME do campo técnico + o valor atual e deriva, via
 * `origemCampoDoCampo`, o estado de origem exibido:
 *   ● copiado (veio do cálculo ao Puxar)
 *   ○ manual   (preenchido manualmente)
 *   ⚠ vazio    (precisa completar)
 *
 * Materializa a Tabela_De_Para_Puxar diretamente ao lado de cada campo. É um
 * componente de APRESENTAÇÃO puro (sem I/O), consumindo a função pura do
 * `origem-campo.ts`.
 */

import { Text, Tooltip } from '@mantine/core'

import { origemCampoDoCampo, type OrigemCampo } from './origem-campo'

interface Props {
  /** Nome do campo técnico (ex.: `siglaAcabado`, `tributacao`). */
  campo: string
  /** Valor atual do campo no formulário. */
  valor: unknown
}

/** Marcador/cor/descrição por estado de origem. */
const APRESENTACAO: Record<OrigemCampo, { marcador: string; cor: string; titulo: string }> = {
  copiado: { marcador: '●', cor: 'green', titulo: 'Copiado do cálculo' },
  'manual-preenchido': { marcador: '○', cor: 'gray', titulo: 'Preenchido manualmente' },
  'manual-vazio': { marcador: '⚠', cor: 'yellow', titulo: 'Vazio — completar manualmente' },
  vazio: { marcador: '⚠', cor: 'yellow', titulo: 'Vazio — não havia valor na origem' },
}

export default function BadgeOrigemCampo({ campo, valor }: Props) {
  const estado = origemCampoDoCampo(campo, valor)
  const { marcador, cor, titulo } = APRESENTACAO[estado]

  return (
    <Tooltip label={titulo} withArrow position="top">
      <Text span fw={700} c={cor} aria-label={titulo} style={{ cursor: 'help' }}>
        {marcador}
      </Text>
    </Tooltip>
  )
}
