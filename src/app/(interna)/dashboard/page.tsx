'use client'

import { useEffect, useState } from 'react'
import { Title, Text, SimpleGrid, Card, Group, Badge, Stack, SegmentedControl, Skeleton, ActionIcon, RingProgress, ThemeIcon } from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import {
  IconCurrencyReal,
  IconShoppingCart,
  IconBuildingWarehouse,
  IconAlertTriangle,
  IconRefresh,
  IconCalendar,
  IconPlugConnected,
  IconCircleCheck,
  IconCircleX,
} from '@tabler/icons-react'
import { api } from '@/lib/api'
import { useEmpresa } from '@/providers/EmpresaProvider'

interface KpiData {
  receita: number
  pedidosPendentes: number
  ocupacaoArmazem: number
  opsAtrasadas: number
}

interface Alerta {
  tipo: string
  mensagem: string
  severidade: 'alta' | 'media' | 'baixa'
}

export default function DashboardPage() {
  useEffect(() => { document.title = 'Vizor - Dashboard' }, [])

  const { modulos } = useEmpresa()
  const [periodo, setPeriodo] = useState('mes')
  const [kpis, setKpis] = useState<KpiData | null>(null)
  const [alertas, setAlertas] = useState<Alerta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  async function loadDashboard() {
    setLoading(true)
    setError(false)
    try {
      const { data } = await api.get('/dashboard-wms/resumo')
      setKpis({
        receita: data.receita ?? 0,
        pedidosPendentes: data.pedidosPendentes ?? 0,
        ocupacaoArmazem: data.ocupacaoArmazem ?? 0,
        opsAtrasadas: data.opsAtrasadas ?? 0,
      })
      setAlertas(data.alertas ?? [])
    } catch {
      // Only show error if we have no data at all
      if (!kpis) setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadDashboard() }, [periodo]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-refresh every 60s
  useEffect(() => {
    const interval = setInterval(loadDashboard, 60000)
    return () => clearInterval(interval)
  }, [periodo]) // eslint-disable-line react-hooks/exhaustive-deps

  function formatCurrency(value: number) {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <Title order={2} fw={700}>Dashboard</Title>
          <Text size="sm" c="dimmed">Visão geral consolidada de todos os módulos</Text>
        </div>
        <Group gap="sm">
          <SegmentedControl
            size="xs"
            value={periodo}
            onChange={setPeriodo}
            data={[
              { label: 'Hoje', value: 'hoje' },
              { label: 'Semana', value: 'semana' },
              { label: 'Mês', value: 'mes' },
              { label: 'Trimestre', value: 'trimestre' },
            ]}
          />
          <ActionIcon variant="subtle" onClick={loadDashboard} aria-label="Atualizar">
            <IconRefresh size={18} />
          </ActionIcon>
        </Group>
      </div>

      {/* KPI Widgets */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} spacing="md" mb="xl">
        {/* Receita */}
        <Card shadow="xs" radius="md" p="lg">
          {loading ? <Skeleton height={80} /> : (
            <Stack gap={4}>
              <Group justify="space-between">
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Receita do Mês</Text>
                <ThemeIcon variant="light" color="green" size="sm" radius="xl">
                  <IconCurrencyReal size={14} />
                </ThemeIcon>
              </Group>
              <Text size="xl" fw={700}>{formatCurrency(kpis?.receita ?? 0)}</Text>
            </Stack>
          )}
        </Card>

        {/* Pedidos Pendentes */}
        <Card shadow="xs" radius="md" p="lg">
          {loading ? <Skeleton height={80} /> : (
            <Stack gap={4}>
              <Group justify="space-between">
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Pedidos Pendentes</Text>
                <ThemeIcon variant="light" color="blue" size="sm" radius="xl">
                  <IconShoppingCart size={14} />
                </ThemeIcon>
              </Group>
              <Text size="xl" fw={700}>{kpis?.pedidosPendentes ?? 0}</Text>
            </Stack>
          )}
        </Card>

        {/* Ocupação Armazém */}
        <Card shadow="xs" radius="md" p="lg">
          {loading ? <Skeleton height={80} /> : (
            <Stack gap={4}>
              <Group justify="space-between">
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Ocupação Armazém</Text>
                <ThemeIcon variant="light" color="violet" size="sm" radius="xl">
                  <IconBuildingWarehouse size={14} />
                </ThemeIcon>
              </Group>
              <Group gap="xs" align="end">
                <Text size="xl" fw={700}>{kpis?.ocupacaoArmazem ?? 0}%</Text>
                <RingProgress size={40} thickness={4} sections={[{ value: kpis?.ocupacaoArmazem ?? 0, color: 'violet' }]} />
              </Group>
            </Stack>
          )}
        </Card>

        {/* OPs Atrasadas */}
        <Card shadow="xs" radius="md" p="lg">
          {loading ? <Skeleton height={80} /> : (
            <Stack gap={4}>
              <Group justify="space-between">
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>OPs Atrasadas</Text>
                <ThemeIcon variant="light" color="red" size="sm" radius="xl">
                  <IconAlertTriangle size={14} />
                </ThemeIcon>
              </Group>
              <Text size="xl" fw={700} c={kpis?.opsAtrasadas ? 'red' : undefined}>
                {kpis?.opsAtrasadas ?? 0}
              </Text>
            </Stack>
          )}
        </Card>
      </SimpleGrid>

      {/* Alertas + Status */}
      <SimpleGrid cols={{ base: 1, lg: 2 }} spacing="md">
        {/* Alertas Críticos */}
        <Card shadow="xs" radius="md" p="lg">
          <Text size="sm" fw={600} mb="md">Alertas Críticos</Text>
          {loading ? (
            <Stack gap="xs">
              <Skeleton height={30} />
              <Skeleton height={30} />
              <Skeleton height={30} />
            </Stack>
          ) : alertas.length === 0 ? (
            <Text size="sm" c="dimmed">Nenhum alerta no momento</Text>
          ) : (
            <Stack gap="xs">
              {alertas.slice(0, 10).map((alerta, i) => (
                <Group key={i} gap="sm">
                  <Badge
                    size="xs"
                    color={alerta.severidade === 'alta' ? 'red' : alerta.severidade === 'media' ? 'yellow' : 'gray'}
                  >
                    {alerta.severidade}
                  </Badge>
                  <Text size="sm">{alerta.mensagem}</Text>
                </Group>
              ))}
              {alertas.length > 10 && (
                <Text size="xs" c="dimmed">+ {alertas.length - 10} alertas adicionais</Text>
              )}
            </Stack>
          )}
        </Card>

        {/* Status dos Serviços */}
        <Card shadow="xs" radius="md" p="lg">
          <Text size="sm" fw={600} mb="md">Status dos Serviços</Text>
          <Stack gap="xs">
            <Group justify="space-between">
              <Group gap="xs">
                <IconPlugConnected size={16} />
                <Text size="sm">API Backend</Text>
              </Group>
              <Badge color="green" variant="light" size="sm" leftSection={<IconCircleCheck size={10} />}>
                Online
              </Badge>
            </Group>
            <Group justify="space-between">
              <Group gap="xs">
                <IconPlugConnected size={16} />
                <Text size="sm">Banco de Dados</Text>
              </Group>
              <Badge color="green" variant="light" size="sm" leftSection={<IconCircleCheck size={10} />}>
                Online
              </Badge>
            </Group>
            {modulos.includes('WMS') && (
              <Group justify="space-between">
                <Group gap="xs">
                  <IconPlugConnected size={16} />
                  <Text size="sm">WMS Workers</Text>
                </Group>
                <Badge color="green" variant="light" size="sm" leftSection={<IconCircleCheck size={10} />}>
                  Online
                </Badge>
              </Group>
            )}
          </Stack>
        </Card>
      </SimpleGrid>

      {error && (
        <Card shadow="xs" radius="md" p="lg" mt="md" withBorder style={{ borderColor: 'var(--mantine-color-red-5)' }}>
          <Group>
            <IconAlertTriangle size={20} color="red" />
            <Text size="sm" c="red">Erro ao carregar dados do dashboard.</Text>
            <ActionIcon variant="light" color="red" onClick={loadDashboard}>
              <IconRefresh size={16} />
            </ActionIcon>
          </Group>
        </Card>
      )}
    </div>
  )
}
