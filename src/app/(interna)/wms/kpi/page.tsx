'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, SimpleGrid, Badge, Tabs, Table, Button,
  ThemeIcon, LoadingOverlay, Stack,
} from '@mantine/core'
import {
  IconChartBar, IconAlertTriangle, IconSettings, IconDownload,
  IconTrendingUp, IconArrowLeft,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import Link from 'next/link'
import KpiTrendView from './components/KpiTrendView'

// SSE Integration: The backend emits KPI alert events via /api/eventos (Server-Sent Events).
// When SSE client is implemented, subscribe to 'kpi:alerta' events and show toast notifications.

const STATUS_COLORS: Record<string, string> = {
  NORMAL: 'green',
  ALERTA: 'yellow',
  CRITICO: 'red',
}

const SEVERIDADE_COLORS: Record<string, string> = {
  INFO: 'blue',
  WARNING: 'yellow',
  CRITICAL: 'red',
}

async function exportarCSV() {
  const response = await api.get('/kpi/exportar', { responseType: 'blob' })
  const url = window.URL.createObjectURL(new Blob([response.data]))
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', 'kpi-export.csv')
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export default function KpiDashboardPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - KPI / SLA' }, [])

  const [selectedKpi, setSelectedKpi] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<string | null>('dashboard')

  const { data: dashboard, isLoading: loadingDashboard } = useQuery<any>({
    queryKey: ['kpi-dashboard'],
    queryFn: async () => {
      const { data } = await api.get('/kpi/dashboard')
      return data
    },
    refetchInterval: 30000,
  })

  const { data: alertasResp, isLoading: loadingAlertas } = useQuery<any>({
    queryKey: ['kpi-alertas-recentes'],
    queryFn: async () => {
      const { data } = await api.get('/kpi/alertas', { params: { status: 'ABERTO', limit: 5 } })
      return data
    },
    refetchInterval: 30000,
  })

  const cards = dashboard?.cards || dashboard?.data || []
  const alertasRecentes = alertasResp?.data || alertasResp || []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Gestão / KPI / SLA</Text>

      <Group justify="space-between" mb="lg">
        <Text size="xl" fw={600}>KPI / SLA</Text>
        <Button
          variant="light"
          leftSection={<IconDownload size={16} />}
          onClick={exportarCSV}
        >
          Exportar CSV
        </Button>
      </Group>

      <Tabs value={activeTab} onChange={setActiveTab} mb="lg">
        <Tabs.List>
          <Tabs.Tab value="dashboard" leftSection={<IconChartBar size={16} />}>
            Dashboard
          </Tabs.Tab>
          <Tabs.Tab value="alertas" leftSection={<IconAlertTriangle size={16} />}>
            Alertas
          </Tabs.Tab>
          <Tabs.Tab value="regras" leftSection={<IconSettings size={16} />}>
            Regras
          </Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="dashboard" pt="md">
          <Card pos="relative" mb="md">
            <LoadingOverlay visible={loadingDashboard} />
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="md">
              {cards.map((kpi: any) => (
                <Card
                  key={kpi.indicador || kpi.label}
                  withBorder
                  className="cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => setSelectedKpi(kpi.indicador || kpi.label)}
                >
                  <Group justify="space-between" mb="xs">
                    <Text size="xs" c="dimmed" fw={500}>{kpi.label}</Text>
                    <Badge
                      size="xs"
                      variant="filled"
                      color={STATUS_COLORS[kpi.status] || 'gray'}
                    >
                      {kpi.status}
                    </Badge>
                  </Group>
                  <Text size="xl" fw={700}>
                    {kpi.valorAtual}
                    {kpi.unidade && (
                      <Text component="span" size="sm" c="dimmed" ml={4}>
                        {kpi.unidade}
                      </Text>
                    )}
                  </Text>
                  {kpi.meta != null && (
                    <Text size="xs" c="dimmed" mt={4}>
                      Meta: {kpi.meta} {kpi.unidade || ''}
                    </Text>
                  )}
                </Card>
              ))}
              {cards.length === 0 && !loadingDashboard && (
                <Text c="dimmed" size="sm">Nenhum indicador configurado</Text>
              )}
            </SimpleGrid>
          </Card>

          {/* Trend View when KPI card is clicked */}
          {selectedKpi && (
            <Card withBorder mb="md">
              <Group justify="space-between" mb="sm">
                <Group gap="xs">
                  <IconTrendingUp size={18} />
                  <Text fw={500}>Histórico: {selectedKpi}</Text>
                </Group>
                <Button
                  variant="subtle"
                  size="xs"
                  leftSection={<IconArrowLeft size={14} />}
                  onClick={() => setSelectedKpi(null)}
                >
                  Fechar
                </Button>
              </Group>
              <KpiTrendView indicador={selectedKpi} />
            </Card>
          )}

          {/* Recent open alerts */}
          <Card withBorder>
            <Group justify="space-between" mb="sm">
              <Text fw={500}>Alertas Recentes (Abertos)</Text>
              <Button
                component={Link}
                href="/wms/kpi/alertas"
                variant="subtle"
                size="xs"
              >
                Ver todos
              </Button>
            </Group>
            <LoadingOverlay visible={loadingAlertas} />
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Severidade</Table.Th>
                  <Table.Th>Mensagem</Table.Th>
                  <Table.Th>Valor Atual</Table.Th>
                  <Table.Th>Data</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(Array.isArray(alertasRecentes) ? alertasRecentes : []).slice(0, 5).map((alerta: any) => (
                  <Table.Tr key={alerta.id}>
                    <Table.Td>
                      <Badge
                        variant="light"
                        color={SEVERIDADE_COLORS[alerta.severidade] || 'gray'}
                      >
                        {alerta.severidade}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{alerta.mensagem}</Table.Td>
                    <Table.Td>{alerta.valorAtual}</Table.Td>
                    <Table.Td>
                      {alerta.criadoEm
                        ? new Date(alerta.criadoEm).toLocaleDateString('pt-BR', {
                            day: '2-digit', month: '2-digit',
                            hour: '2-digit', minute: '2-digit',
                          })
                        : '—'}
                    </Table.Td>
                  </Table.Tr>
                ))}
                {(!alertasRecentes || alertasRecentes.length === 0) && !loadingAlertas && (
                  <Table.Tr>
                    <Table.Td colSpan={4} className="text-center py-4 text-zinc-500">
                      Nenhum alerta aberto
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="alertas" pt="md">
          <Card>
            <Stack align="center" gap="sm" py="xl">
              <IconAlertTriangle size={40} color="gray" />
              <Text c="dimmed">
                Acesse a página completa de alertas para filtros avançados e ações.
              </Text>
              <Button component={Link} href="/wms/kpi/alertas" variant="light">
                Ir para Alertas KPI
              </Button>
            </Stack>
          </Card>
        </Tabs.Panel>

        <Tabs.Panel value="regras" pt="md">
          <Card>
            <Stack align="center" gap="sm" py="xl">
              <IconSettings size={40} color="gray" />
              <Text c="dimmed">
                Gerencie as regras de monitoramento de KPI.
              </Text>
              <Button component={Link} href="/wms/kpi/regras" variant="light">
                Ir para Regras KPI
              </Button>
            </Stack>
          </Card>
        </Tabs.Panel>
      </Tabs>
    </div>
  )
}
