'use client'

/**
 * BlocoEstruturaCusto — bloco "Estrutura de custo" do item: faixa de KPIs (`ResumoKpis`) e a
 * decomposição de custo por grupo (`SecaoEstruturaCusto`), ambas do editor atual e SOMENTE LEITURA.
 *
 * Não calcula nada: lê o `resultadoCalculo` persistido do item e os KPIs que a tela já tem (os do
 * cálculo ao vivo, quando existirem). Sem KPIs, mostra só a decomposição.
 */

import { Button, Group, Loader, Stack } from '@mantine/core'
import { IconCalculator, IconChartPie } from '@tabler/icons-react'

import ResumoKpis from '../../../editor/ResumoKpis'
import SecaoEstruturaCusto from '../../../editor/SecaoEstruturaCusto'
import type { KpisCalculo } from '../../../editor/useCalculoAoVivo'
import CartaoSecao from './CartaoSecao'

export interface BlocoEstruturaCustoProps {
  /** Resultado do cálculo persistido do item (`item.resultadoCalculo`). */
  resultadoCalculo?: unknown | null
  /** KPIs do cálculo ao vivo (custo total, preço de venda, margem, preço unitário). */
  kpis?: KpisCalculo | null
  /** Cálculo ao vivo em andamento. */
  calculando?: boolean
  /** Botão Calcular no cabeçalho do bloco (o mesmo do topo da tela). */
  onCalcular?: () => void
  /** Desabilita o botão Calcular (ex.: salvando). */
  desabilitado?: boolean
}

export default function BlocoEstruturaCusto({
  resultadoCalculo,
  kpis,
  calculando,
  onCalcular,
  desabilitado,
}: BlocoEstruturaCustoProps) {
  return (
    <CartaoSecao
      titulo="Estrutura de custo"
      icone={<IconChartPie size={16} />}
      direita={
        onCalcular ? (
          <Group gap="xs">
            <Button
              variant="light"
              size="xs"
              leftSection={<IconCalculator size={14} />}
              onClick={onCalcular}
              loading={calculando === true}
              disabled={desabilitado}
              data-testid="estrutura-custo-calcular"
            >
              Calcular
            </Button>
          </Group>
        ) : calculando ? (
          <Loader size="xs" />
        ) : undefined
      }
      data-testid="bloco-estrutura-custo"
    >
      <Stack gap="md">
        {kpis && <ResumoKpis kpis={kpis} loading={calculando === true} />}
        <SecaoEstruturaCusto resultadoCalculo={resultadoCalculo ?? null} />
      </Stack>
    </CartaoSecao>
  )
}
