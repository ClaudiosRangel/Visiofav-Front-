'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, SimpleGrid, ThemeIcon, LoadingOverlay, Button, Stack,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import {
  IconChartBar, IconArrowLeft, IconClock, IconCheck, IconAlertTriangle, IconTruck,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import Link from 'next/link'

export default function EstatisticasDocaPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Estatísticas de Docas' }, [])

  const [dataInicio, setDataInicio] = useState<Date>((() => { const d = new Date(); d.setDate(d.getDate() - 7); return d })())
  const [dataFim, setDataFim] = useState<Date>(new Date())

  const { data: stats, isLoading } = useQuery<any>({
    queryKey: ['estatisticas-doca', dataInicio.toISOString(), dataFim.toISOString()],
    queryFn: async () => {
      const { data } = await api.get('/agenda-doca/estatisticas', {
        params: {
          dataInicio: dataInicio.toISOString().split('T')[0],
          dataFim: dataFim.toISOString().split('T')[0],
        },
      })
      return data
    },
  })

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Recebimento / Agenda de Docas / Estatísticas</Text>

      <Group mb="lg">
        <Button component={Link} href="/wms/agenda-doca" variant="subtle" leftSection={<IconArrowLeft size={16} />}>
          Voltar
        </Button>
        <Text size="xl" fw={600}>Estatísticas de Docas</Text>
      </Group>

      {/* Date Range Filter */}
      <Card mb="md">
        <Group>
          <DatePickerInput
            label="Data Início"
            value={dataInicio}
            onChange={(d) => d && setDataInicio(d)}
            valueFormat="DD/MM/YYYY"
            className="w-44"
          />
          <DatePickerInput
            label="Data Fim"
            value={dataFim}
            onChange={(d) => d && setDataFim(d)}
            valueFormat="DD/MM/YYYY"
            className="w-44"
          />
        </Group>
      </Card>

      {/* Stats Cards */}
      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="lg">
          <Card withBorder>
            <Group gap="sm">
              <ThemeIcon size="lg" variant="light" color="blue">
                <IconTruck size={20} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">Total Agendamentos</Text>
                <Text size="xl" fw={700}>{stats?.totalAgendamentos ?? '—'}</Text>
              </div>
            </Group>
          </Card>
          <Card withBorder>
            <Group gap="sm">
              <ThemeIcon size="lg" variant="light" color="green">
                <IconCheck size={20} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">Concluídos no Prazo</Text>
                <Text size="xl" fw={700}>{stats?.concluidosNoPrazo ?? '—'}</Text>
              </div>
            </Group>
          </Card>
          <Card withBorder>
            <Group gap="sm">
              <ThemeIcon size="lg" variant="light" color="red">
                <IconAlertTriangle size={20} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">Atrasados</Text>
                <Text size="xl" fw={700}>{stats?.atrasados ?? '—'}</Text>
              </div>
            </Group>
          </Card>
          <Card withBorder>
            <Group gap="sm">
              <ThemeIcon size="lg" variant="light" color="orange">
                <IconClock size={20} />
              </ThemeIcon>
              <div>
                <Text size="xs" c="dimmed">Tempo Médio na Doca</Text>
                <Text size="xl" fw={700}>{stats?.tempoMedioDoca ? `${stats.tempoMedioDoca} min` : '—'}</Text>
              </div>
            </Group>
          </Card>
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Card withBorder>
            <Text fw={500} mb="sm">Taxa de Aderência</Text>
            <Text size="xl" fw={700} c="teal">
              {stats?.taxaAderencia != null ? `${stats.taxaAderencia}%` : '—'}
            </Text>
            <Text size="xs" c="dimmed">Agendamentos iniciados no horário previsto</Text>
          </Card>
          <Card withBorder>
            <Text fw={500} mb="sm">Ocupação Média das Docas</Text>
            <Text size="xl" fw={700} c="blue">
              {stats?.ocupacaoMedia != null ? `${stats.ocupacaoMedia}%` : '—'}
            </Text>
            <Text size="xs" c="dimmed">Percentual de uso das docas no período</Text>
          </Card>
        </SimpleGrid>

        {!stats && !isLoading && (
          <Stack align="center" py="xl">
            <IconChartBar size={40} color="gray" />
            <Text c="dimmed">Nenhuma estatística disponível para o período selecionado</Text>
          </Stack>
        )}
      </Card>
    </div>
  )
}
