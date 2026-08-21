'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Title, Stack, Paper, Group, SimpleGrid, Text, Select,
  Table, Badge, Progress, Loader, Center, ThemeIcon,
} from '@mantine/core'
import {
  IconChartBar, IconPercentage, IconCurrencyReal,
  IconTrendingUp, IconUsers, IconFilter,
} from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

interface DashboardData {
  periodo: string
  total: number
  convertidos: number
  taxaConversao: number
  ticketMedio: number
  porStatus: Record<string, number>
  pipeline: {
    rascunho: number
    enviado: number
    aprovado: number
    recusado: number
    vencido: number
  }
  rankingVolume: Array<{ nome: string; volume: number; count: number }>
  rankingMargem: Array<{ nome: string; margemMedia: number; count: number }>
}

const STATUS_COLORS: Record<string, string> = {
  RASCUNHO: 'gray',
  ENVIADO: 'blue',
  APROVADO: 'green',
  RECUSADO: 'red',
  VENCIDO: 'orange',
}

export default function DashboardComercialPage() {
  const [dados, setDados] = useState<DashboardData | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [periodo, setPeriodo] = useState('90')

  const carregar = useCallback(async () => {
    setCarregando(true)
    try {
      const response = await api.get('/orcamento-grafico/dashboard', { params: { periodo } })
      setDados(response.data)
    } catch (err: any) {
      notifications.show({
        title: 'Erro',
        message: err.response?.data?.message || 'Falha ao carregar dashboard',
        color: 'red',
      })
    } finally {
      setCarregando(false)
    }
  }, [periodo])

  useEffect(() => { carregar() }, [carregar])

  if (carregando) {
    return <Center h={400}><Loader /></Center>
  }

  if (!dados) {
    return <Center h={400}><Text c="dimmed">Nenhum dado disponível</Text></Center>
  }

  const pipelineTotal = dados.pipeline.rascunho + dados.pipeline.enviado +
    dados.pipeline.aprovado + dados.pipeline.recusado + dados.pipeline.vencido

  return (
    <Stack gap="lg" p="md">
      <Group justify="space-between">
        <Title order={2}>Dashboard Comercial</Title>
        <Select
          leftSection={<IconFilter size={16} />}
          value={periodo}
          onChange={(v) => v && setPeriodo(v)}
          data={[
            { value: '30', label: 'Últimos 30 dias' },
            { value: '90', label: 'Últimos 90 dias' },
            { value: '365', label: 'Último ano' },
          ]}
          w={200}
        />
      </Group>

      {/* Cards de indicadores */}
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        <IndicatorCard
          icon={<IconChartBar size={24} />}
          label="Total Orçamentos"
          value={String(dados.total)}
          color="blue"
        />
        <IndicatorCard
          icon={<IconTrendingUp size={24} />}
          label="Convertidos"
          value={String(dados.convertidos)}
          color="green"
        />
        <IndicatorCard
          icon={<IconPercentage size={24} />}
          label="Taxa de Conversão"
          value={`${dados.taxaConversao}%`}
          color="teal"
        />
        <IndicatorCard
          icon={<IconCurrencyReal size={24} />}
          label="Ticket Médio"
          value={dados.ticketMedio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          color="violet"
        />
      </SimpleGrid>

      {/* Pipeline comercial */}
      <Paper p="md" withBorder>
        <Stack gap="sm">
          <Title order={4}>Pipeline Comercial</Title>
          {pipelineTotal > 0 ? (
            <Stack gap="xs">
              <PipelineRow label="Rascunho" count={dados.pipeline.rascunho} total={pipelineTotal} color="gray" />
              <PipelineRow label="Enviado" count={dados.pipeline.enviado} total={pipelineTotal} color="blue" />
              <PipelineRow label="Aprovado" count={dados.pipeline.aprovado} total={pipelineTotal} color="green" />
              <PipelineRow label="Recusado" count={dados.pipeline.recusado} total={pipelineTotal} color="red" />
              <PipelineRow label="Vencido" count={dados.pipeline.vencido} total={pipelineTotal} color="orange" />
            </Stack>
          ) : (
            <Text c="dimmed" size="sm">Nenhum orçamento registrado</Text>
          )}
        </Stack>
      </Paper>

      {/* Rankings */}
      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        {/* Ranking por Volume */}
        <Paper p="md" withBorder>
          <Stack gap="sm">
            <Group gap="xs">
              <IconUsers size={20} />
              <Title order={4}>Top Clientes (Volume)</Title>
            </Group>
            {dados.rankingVolume.length > 0 ? (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>#</Table.Th>
                    <Table.Th>Cliente</Table.Th>
                    <Table.Th>Volume</Table.Th>
                    <Table.Th>Orçamentos</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {dados.rankingVolume.map((c, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>{i + 1}</Table.Td>
                      <Table.Td>{c.nome}</Table.Td>
                      <Table.Td>{c.volume.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
                      <Table.Td>{c.count}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <Text c="dimmed" size="sm">Nenhum cliente com orçamento aprovado</Text>
            )}
          </Stack>
        </Paper>

        {/* Ranking por Margem */}
        <Paper p="md" withBorder>
          <Stack gap="sm">
            <Group gap="xs">
              <IconPercentage size={20} />
              <Title order={4}>Top Clientes (Margem)</Title>
            </Group>
            {dados.rankingMargem.length > 0 ? (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>#</Table.Th>
                    <Table.Th>Cliente</Table.Th>
                    <Table.Th>Margem Média</Table.Th>
                    <Table.Th>Orçamentos</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {dados.rankingMargem.map((c, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>{i + 1}</Table.Td>
                      <Table.Td>{c.nome}</Table.Td>
                      <Table.Td>{c.margemMedia}%</Table.Td>
                      <Table.Td>{c.count}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <Text c="dimmed" size="sm">Nenhum dado de margem disponível</Text>
            )}
          </Stack>
        </Paper>
      </SimpleGrid>
    </Stack>
  )
}

// ── Componentes auxiliares ──

function IndicatorCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <Paper p="md" withBorder>
      <Group gap="sm">
        <ThemeIcon size="lg" radius="md" variant="light" color={color}>
          {icon}
        </ThemeIcon>
        <div>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>{label}</Text>
          <Text size="xl" fw={700}>{value}</Text>
        </div>
      </Group>
    </Paper>
  )
}

function PipelineRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const percent = total > 0 ? (count / total) * 100 : 0
  return (
    <Group gap="sm">
      <Badge color={color} w={90} variant="light">{label}</Badge>
      <Progress value={percent} color={color} style={{ flex: 1 }} size="lg" />
      <Text size="sm" fw={500} w={60} ta="right">{count}</Text>
    </Group>
  )
}
