'use client'

import { useEffect } from 'react'
import { Title, Text, Card, SimpleGrid, Stack, Group, Badge, Progress, RingProgress, ThemeIcon } from '@mantine/core'
import {
  IconTarget,
  IconTrendingUp,
  IconTrendingDown,
  IconBuildingWarehouse,
  IconSettingsAutomation,
  IconReceipt,
} from '@tabler/icons-react'
import { useEmpresa } from '@/providers/EmpresaProvider'

interface Indicador {
  label: string
  valor: number
  meta: number
  unidade: string
  tendencia: 'up' | 'down' | 'stable'
  variacao: number
}

const INDICADORES_WMS: Indicador[] = [
  { label: 'Acuracidade de Estoque', valor: 97.2, meta: 99, unidade: '%', tendencia: 'up', variacao: 1.3 },
  { label: 'OTIF', valor: 91.5, meta: 95, unidade: '%', tendencia: 'down', variacao: -2.1 },
  { label: 'Tempo Médio Picking', valor: 4.2, meta: 3.5, unidade: 'min', tendencia: 'up', variacao: -0.8 },
]

const INDICADORES_PCP: Indicador[] = [
  { label: 'OEE', valor: 78.3, meta: 85, unidade: '%', tendencia: 'up', variacao: 3.2 },
  { label: 'Aderência ao Plano', valor: 82.1, meta: 90, unidade: '%', tendencia: 'stable', variacao: 0.5 },
]

const INDICADORES_VENDAS: Indicador[] = [
  { label: 'Ticket Médio', valor: 1250.0, meta: 1500, unidade: 'R$', tendencia: 'up', variacao: 8.5 },
  { label: 'Taxa de Conversão', valor: 32.4, meta: 40, unidade: '%', tendencia: 'down', variacao: -1.2 },
]

function KpiCard({ indicador }: { indicador: Indicador }) {
  const atingimento = Math.min((indicador.valor / indicador.meta) * 100, 100)
  const isCritico = atingimento < 80
  const color = isCritico ? 'red' : atingimento < 95 ? 'yellow' : 'green'

  return (
    <Card shadow="xs" radius="md" p="lg">
      <Stack gap="sm">
        <Group justify="space-between">
          <Text size="xs" c="dimmed" fw={600} tt="uppercase">{indicador.label}</Text>
          {isCritico && <Badge color="red" size="xs" variant="filled">⚠ Abaixo da meta</Badge>}
        </Group>

        <Group gap="xs" align="end">
          <Text size="xl" fw={700}>
            {indicador.unidade === 'R$' ? `R$ ${indicador.valor.toFixed(2)}` : `${indicador.valor.toFixed(1)}${indicador.unidade}`}
          </Text>
          <Group gap={2}>
            {indicador.tendencia === 'up' ? <IconTrendingUp size={14} color="green" /> : indicador.tendencia === 'down' ? <IconTrendingDown size={14} color="red" /> : null}
            <Text size="xs" c={indicador.variacao >= 0 ? 'green' : 'red'}>
              {indicador.variacao >= 0 ? '+' : ''}{indicador.variacao.toFixed(1)}%
            </Text>
          </Group>
        </Group>

        <div>
          <Group justify="space-between" mb={4}>
            <Text size="xs" c="dimmed">Meta: {indicador.unidade === 'R$' ? `R$ ${indicador.meta}` : `${indicador.meta}${indicador.unidade}`}</Text>
            <Text size="xs" c={color} fw={500}>{atingimento.toFixed(0)}%</Text>
          </Group>
          <Progress value={atingimento} color={color} size="sm" radius="xl" />
        </div>
      </Stack>
    </Card>
  )
}

export default function IndicadoresPage() {
  useEffect(() => { document.title = 'Vizor - Indicadores' }, [])

  const { modulos } = useEmpresa()

  return (
    <div className="max-w-[1400px] mx-auto">
      <div className="mb-8">
        <Title order={2} fw={700}>Indicadores de Desempenho</Title>
        <Text size="sm" c="dimmed">KPIs por módulo com metas configuráveis</Text>
      </div>

      {/* WMS */}
      {modulos.includes('WMS') && (
        <div className="mb-8">
          <Group gap="sm" mb="md">
            <ThemeIcon variant="light" color="violet" size="sm">
              <IconBuildingWarehouse size={14} />
            </ThemeIcon>
            <Text size="sm" fw={600}>WMS — Logística</Text>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {INDICADORES_WMS.map(ind => <KpiCard key={ind.label} indicador={ind} />)}
          </SimpleGrid>
        </div>
      )}

      {/* PCP */}
      {modulos.includes('PCP') && (
        <div className="mb-8">
          <Group gap="sm" mb="md">
            <ThemeIcon variant="light" color="purple" size="sm">
              <IconSettingsAutomation size={14} />
            </ThemeIcon>
            <Text size="sm" fw={600}>PCP — Produção</Text>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {INDICADORES_PCP.map(ind => <KpiCard key={ind.label} indicador={ind} />)}
          </SimpleGrid>
        </div>
      )}

      {/* Vendas */}
      {modulos.includes('VENDAS') && (
        <div className="mb-8">
          <Group gap="sm" mb="md">
            <ThemeIcon variant="light" color="green" size="sm">
              <IconReceipt size={14} />
            </ThemeIcon>
            <Text size="sm" fw={600}>Vendas</Text>
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {INDICADORES_VENDAS.map(ind => <KpiCard key={ind.label} indicador={ind} />)}
          </SimpleGrid>
        </div>
      )}
    </div>
  )
}
