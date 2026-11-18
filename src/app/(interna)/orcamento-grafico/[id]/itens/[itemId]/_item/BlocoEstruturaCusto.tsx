'use client'

/**
 * BlocoEstruturaCusto — bloco "Estrutura de custo" do item: faixa de KPIs (`ResumoKpis`) e a
 * decomposição de custo por grupo (`SecaoEstruturaCusto`), ambas do editor atual e SOMENTE LEITURA.
 *
 * Não calcula nada: lê o `resultadoCalculo` persistido do item e os KPIs que a tela já tem (os do
 * cálculo ao vivo, quando existirem). Sem KPIs, mostra só a decomposição.
 */

import { Loader, Paper, Stack, Group, Title } from '@mantine/core'

import ResumoKpis from '../../../editor/ResumoKpis'
import SecaoEstruturaCusto from '../../../editor/SecaoEstruturaCusto'
import type { KpisCalculo } from '../../../editor/useCalculoAoVivo'

export interface BlocoEstruturaCustoProps {
  /** Resultado do cálculo persistido do item (`item.resultadoCalculo`). */
  resultadoCalculo?: unknown | null
  /** KPIs do cálculo ao vivo (custo total, preço de venda, margem, preço unitário). */
  kpis?: KpisCalculo | null
  /** Cálculo ao vivo em andamento. */
  calculando?: boolean
}

export default function BlocoEstruturaCusto({ resultadoCalculo, kpis, calculando }: BlocoEstruturaCustoProps) {
  return (
    <Paper withBorder radius="md" p="lg" shadow="xs" data-testid="bloco-estrutura-custo">
      <Stack gap="md">
        <Group gap="xs">
          <Title order={5}>Estrutura de custo</Title>
          {calculando && <Loader size="xs" />}
        </Group>
        {kpis && <ResumoKpis kpis={kpis} loading={calculando === true} />}
        <SecaoEstruturaCusto resultadoCalculo={resultadoCalculo ?? null} />
      </Stack>
    </Paper>
  )
}
