'use client'

import { useEffect } from 'react'
import {
  Card, Group, Text, SimpleGrid, ThemeIcon, Badge, LoadingOverlay, Button,
} from '@mantine/core'
import {
  IconTrendingUp, IconTrendingDown, IconTarget, IconBox,
  IconCurrencyDollar, IconUsers, IconArrowRight,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import Link from 'next/link'

const KPI_ICONS: Record<string, any> = {
  throughput: IconBox,
  acuracia: IconTarget,
  ocupacao: IconBox,
  custoMedio: IconCurrencyDollar,
  produtividade: IconUsers,
}

const KPI_COLORS: Record<string, string> = {
  throughput: 'blue',
  acuracia: 'green',
  ocupacao: 'grape',
  custoMedio: 'orange',
  produtividade: 'teal',
}

export default function BiDashboardPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - BI Avançado' }, [])

  const { data: resp, isLoading } = useQuery<any>({
    queryKey: ['bi-dashboard'],
    queryFn: async () => { const { data } = await api.get('/bi/dashboard'); return data },
    refetchInterval: 60000,
  })

  const kpis = resp?.data || resp?.kpis || []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / BI Avançado</Text>
      <Text size="xl" fw={600} mb="lg">Dashboard Executivo</Text>

      <LoadingOverlay visible={isLoading} />

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }} mb="xl">
        {kpis.map((kpi: any) => {
          const Icon = KPI_ICONS[kpi.chave] || IconTarget
          const color = KPI_COLORS[kpi.chave] || 'blue'
          const variacao = kpi.variacao ?? 0
          const positivo = variacao >= 0

          return (
            <Card key={kpi.chave || kpi.label} withBorder>
              <Group justify="space-between" mb="xs">
                <ThemeIcon color={color} variant="light" size={40} radius="md">
                  <Icon size={20} />
                </ThemeIcon>
                <Badge
                  color={positivo ? 'green' : 'red'}
                  variant="light"
                  leftSection={positivo ? <IconTrendingUp size={12} /> : <IconTrendingDown size={12} />}
                >
                  {positivo ? '+' : ''}{variacao.toFixed(1)}%
                </Badge>
              </Group>
              <Text size="xl" fw={700}>
                {kpi.valorAtual}
                {kpi.unidade && <Text component="span" size="xs" c="dimmed" ml={4}>{kpi.unidade}</Text>}
              </Text>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>{kpi.label}</Text>
              <Text size="xs" c="dimmed" mt={2}>vs período anterior</Text>
            </Card>
          )
        })}
        {kpis.length === 0 && !isLoading && (
          <Text c="dimmed">Nenhum KPI configurado</Text>
        )}
      </SimpleGrid>

      {/* Links sub-páginas */}
      <Text fw={500} mb="sm">Módulos</Text>
      <SimpleGrid cols={{ base: 2, sm: 3, lg: 5 }} mb="xl">
        <Button component={Link} href="/wms/bi/custos" variant="light" rightSection={<IconArrowRight size={16} />}>
          Custos por Operação
        </Button>
        <Button component={Link} href="/wms/bi/correlacao" variant="light" rightSection={<IconArrowRight size={16} />}>
          Análise Cruzada
        </Button>
        <Button component={Link} href="/wms/bi/alertas" variant="light" rightSection={<IconArrowRight size={16} />}>
          Alertas Inteligentes
        </Button>
        <Button component={Link} href="/wms/bi/config" variant="light" rightSection={<IconArrowRight size={16} />}>
          Config Custos
        </Button>
        <Button component={Link} href="/wms/bi/exportar" variant="light" rightSection={<IconArrowRight size={16} />}>
          Exportar Power BI
        </Button>
      </SimpleGrid>
    </div>
  )
}
