'use client'

import { useEffect } from 'react'
import { Card, Group, Text, SimpleGrid, ThemeIcon, Progress, Badge, RingProgress, LoadingOverlay } from '@mantine/core'
import {
  IconBuildingWarehouse, IconTruck, IconClipboardList, IconPackage,
  IconCheck, IconClock, IconAlertCircle, IconMapPin,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const operacaoLabels: Record<string, string> = {
  CONFERENCIA: 'Conferência', ENDERECAMENTO: 'Endereçamento', SEPARACAO: 'Separação',
  REPOSICAO: 'Reposição', MUDANCA_ENDERECO: 'Mudança End.', INVENTARIO: 'Inventário',
}

export default function DashboardWmsPage() {
  useModuloGuard('WMS')

  useEffect(() => { document.title = 'Vizor - WMS - Dashboard' }, [])

  const { data: kpis, isLoading } = useQuery<any>({
    queryKey: ['dashboard-wms'],
    queryFn: async () => { const { data } = await api.get('/dashboard-wms'); return data },
    refetchInterval: 30000,
  })

  const arm = kpis?.armazem || {}
  const rec = kpis?.recebimento || {}
  const os = kpis?.ordensServico || {}
  const exp = kpis?.expedicao || {}

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Dashboard</Text>
      <Text size="xl" fw={600} mb="lg">Dashboard WMS</Text>

      <LoadingOverlay visible={isLoading} />

      {/* Ocupação do Armazém */}
      <Text fw={600} mb="sm">Armazém</Text>
      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="xl">
        <Card>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Total Endereços</Text>
              <Text size="xl" fw={700}>{arm.totalEnderecos || 0}</Text>
            </div>
            <ThemeIcon color="blue" variant="light" size={48} radius="md"><IconBuildingWarehouse size={24} /></ThemeIcon>
          </Group>
        </Card>
        <Card>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Ocupados</Text>
              <Text size="xl" fw={700} c="orange">{arm.endOcupados || 0}</Text>
            </div>
            <ThemeIcon color="orange" variant="light" size={48} radius="md"><IconMapPin size={24} /></ThemeIcon>
          </Group>
        </Card>
        <Card>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Livres</Text>
              <Text size="xl" fw={700} c="green">{arm.endLivres || 0}</Text>
            </div>
            <ThemeIcon color="green" variant="light" size={48} radius="md"><IconCheck size={24} /></ThemeIcon>
          </Group>
        </Card>
        <Card>
          <Group justify="space-between" align="center">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Ocupação</Text>
              <Text size="xl" fw={700}>{arm.percentualOcupacao || 0}%</Text>
            </div>
            <RingProgress size={56} thickness={6} roundCaps
              sections={[{ value: arm.percentualOcupacao || 0, color: (arm.percentualOcupacao || 0) > 80 ? 'red' : (arm.percentualOcupacao || 0) > 50 ? 'yellow' : 'green' }]} />
          </Group>
        </Card>
      </SimpleGrid>

      {/* Recebimento */}
      <Text fw={600} mb="sm">Recebimento (Hoje)</Text>
      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="xl">
        <Card>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Agendados</Text>
              <Text size="xl" fw={700} c="blue">{rec.agendadosHoje || 0}</Text>
            </div>
            <ThemeIcon color="blue" variant="light" size={48} radius="md"><IconClock size={24} /></ThemeIcon>
          </Group>
        </Card>
        <Card>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Em Andamento</Text>
              <Text size="xl" fw={700} c="orange">{rec.emAndamentoHoje || 0}</Text>
            </div>
            <ThemeIcon color="orange" variant="light" size={48} radius="md"><IconTruck size={24} /></ThemeIcon>
          </Group>
        </Card>
        <Card>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Recebidos</Text>
              <Text size="xl" fw={700} c="green">{rec.recebidosHoje || 0}</Text>
            </div>
            <ThemeIcon color="green" variant="light" size={48} radius="md"><IconCheck size={24} /></ThemeIcon>
          </Group>
        </Card>
        <Card>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Notas Pendentes</Text>
              <Text size="xl" fw={700} c="red">{rec.notasPendentes || 0}</Text>
              <Text size="xs" c="dimmed">{rec.notasConferidas || 0} conferidas</Text>
            </div>
            <ThemeIcon color="red" variant="light" size={48} radius="md"><IconAlertCircle size={24} /></ThemeIcon>
          </Group>
        </Card>
      </SimpleGrid>

      {/* Ordens de Serviço + Expedição */}
      <SimpleGrid cols={{ base: 1, sm: 2 }} mb="xl">
        <div>
          <Text fw={600} mb="sm">Ordens de Serviço</Text>
          <SimpleGrid cols={3} mb="md">
            <Card>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Abertas</Text>
              <Text size="xl" fw={700} c="blue">{os.abertas || 0}</Text>
            </Card>
            <Card>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Executando</Text>
              <Text size="xl" fw={700} c="orange">{os.executando || 0}</Text>
            </Card>
            <Card>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Concluídas Hoje</Text>
              <Text size="xl" fw={700} c="green">{os.concluidasHoje || 0}</Text>
            </Card>
          </SimpleGrid>
          {(os.porOperacao || []).length > 0 && (
            <Card>
              <Text size="sm" fw={500} mb="sm">Por Operação (ativas)</Text>
              <Group gap="sm">
                {(os.porOperacao || []).map((o: any) => (
                  <Badge key={o.operacao} variant="light" size="lg">
                    {operacaoLabels[o.operacao] || o.operacao}: {o.total}
                  </Badge>
                ))}
              </Group>
            </Card>
          )}
        </div>

        <div>
          <Text fw={600} mb="sm">Expedição</Text>
          <SimpleGrid cols={2} mb="md">
            <Card>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Ondas Pendentes</Text>
              <Text size="xl" fw={700} c="orange">{exp.ondasPendentes || 0}</Text>
            </Card>
            <Card>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Em Separação</Text>
              <Text size="xl" fw={700} c="blue">{exp.ondasEmSeparacao || 0}</Text>
            </Card>
          </SimpleGrid>
          <SimpleGrid cols={2}>
            <Card>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Prontas p/ Carga</Text>
              <Text size="xl" fw={700} c="grape">{exp.ondasProntasCarga || 0}</Text>
            </Card>
            <Card>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Total Ativas</Text>
              <Text size="xl" fw={700}>{exp.totalOndasAtivas || 0}</Text>
            </Card>
          </SimpleGrid>
        </div>
      </SimpleGrid>

      {/* Gráfico de Ocupação por Rua */}
      <Text fw={600} mb="sm">Ocupação por Rua</Text>
      <Card mb="xl">
        <OcupacaoRuaChart />
      </Card>
    </div>
  )
}

function OcupacaoRuaChart() {
  const { data: ocupResp } = useQuery<any>({
    queryKey: ['dashboard-ocupacao-rua'],
    queryFn: async () => { const { data } = await api.get('/relatorios-wms/ocupacao-enderecos'); return data },
    staleTime: 1000 * 60 * 5,
  })

  const ruas = ocupResp?.data || []

  if (ruas.length === 0) return <Text c="dimmed" className="text-center py-4">Nenhum endereço cadastrado</Text>

  const maxTotal = Math.max(...ruas.map((r: any) => r.total), 1)

  return (
    <div>
      {ruas.map((rua: any) => (
        <div key={rua.rua} className="flex items-center gap-3 mb-2">
          <Text size="sm" fw={500} className="w-16 text-right">Rua {rua.rua}</Text>
          <div className="flex-1">
            <div className="relative h-6 bg-gray-100 rounded overflow-hidden">
              <div
                style={{ width: `${(rua.ocupados / maxTotal) * 100}%` }}
                className={`absolute left-0 top-0 h-full rounded transition-all ${
                  rua.percentual > 80 ? 'bg-red-400' : rua.percentual > 50 ? 'bg-yellow-400' : 'bg-green-400'
                }`}
              />
              <div
                style={{ width: `${(rua.total / maxTotal) * 100}%` }}
                className="absolute left-0 top-0 h-full border border-gray-300 rounded"
              />
            </div>
          </div>
          <Text size="xs" fw={600} className="w-20 text-right">
            {rua.ocupados}/{rua.total} ({rua.percentual}%)
          </Text>
        </div>
      ))}
    </div>
  )
}
