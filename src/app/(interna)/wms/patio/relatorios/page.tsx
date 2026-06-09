'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Tabs, Table, Button, SimpleGrid, ThemeIcon,
  LoadingOverlay,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import {
  IconClock, IconListNumbers, IconChartBar, IconDownload,
  IconCalendar,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0]
}

function exportCSV(data: any[], filename: string) {
  if (!data || data.length === 0) return
  const headers = Object.keys(data[0])
  const csv = [
    headers.join(';'),
    ...data.map((row) => headers.map((h) => row[h] ?? '').join(';')),
  ].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export default function PatioRelatoriosPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - Pátio - Relatórios' }, [])

  const [tab, setTab] = useState<string | null>('permanencia')
  const [dataInicio, setDataInicio] = useState<Date | null>(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  )
  const [dataFim, setDataFim] = useState<Date | null>(new Date())

  const params = {
    dataInicio: dataInicio ? formatDate(dataInicio) : undefined,
    dataFim: dataFim ? formatDate(dataFim) : undefined,
  }

  // Permanência
  const { data: permanencia, isLoading: loadingPerm } = useQuery<any>({
    queryKey: ['patio-rel-permanencia', params],
    queryFn: async () => {
      const { data } = await api.get('/patio/relatorios/permanencia', { params })
      return data
    },
    enabled: tab === 'permanencia',
  })

  // Fila
  const { data: filaRel, isLoading: loadingFila } = useQuery<any>({
    queryKey: ['patio-rel-fila', params],
    queryFn: async () => {
      const { data } = await api.get('/patio/relatorios/fila', { params })
      return data
    },
    enabled: tab === 'fila',
  })

  // Ocupação
  const { data: ocupacao, isLoading: loadingOcupacao } = useQuery<any>({
    queryKey: ['patio-rel-ocupacao', params],
    queryFn: async () => {
      const { data } = await api.get('/patio/relatorios/ocupacao', { params })
      return data
    },
    enabled: tab === 'ocupacao',
  })

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Pátio / Relatórios</Text>
      <Text size="xl" fw={600} mb="lg">Relatórios do Pátio</Text>

      {/* Date Filters */}
      <Card withBorder mb="md">
        <Group gap="md">
          <DatePickerInput
            label="Data Início"
            placeholder="Selecione"
            value={dataInicio}
            onChange={setDataInicio}
            leftSection={<IconCalendar size={16} />}
            maxDate={dataFim || undefined}
          />
          <DatePickerInput
            label="Data Fim"
            placeholder="Selecione"
            value={dataFim}
            onChange={setDataFim}
            leftSection={<IconCalendar size={16} />}
            minDate={dataInicio || undefined}
          />
        </Group>
      </Card>

      <Tabs value={tab} onChange={setTab}>
        <Tabs.List mb="md">
          <Tabs.Tab value="permanencia" leftSection={<IconClock size={16} />}>
            Permanência
          </Tabs.Tab>
          <Tabs.Tab value="fila" leftSection={<IconListNumbers size={16} />}>
            Fila
          </Tabs.Tab>
          <Tabs.Tab value="ocupacao" leftSection={<IconChartBar size={16} />}>
            Ocupação
          </Tabs.Tab>
        </Tabs.List>

        {/* Tab Permanência */}
        <Tabs.Panel value="permanencia">
          <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
            <Card withBorder>
              <Group gap="sm">
                <ThemeIcon variant="light" color="blue"><IconClock size={18} /></ThemeIcon>
                <div>
                  <Text size="xs" c="dimmed">Tempo Médio</Text>
                  <Text size="lg" fw={700}>{permanencia?.tempoMedio || '—'}</Text>
                </div>
              </Group>
            </Card>
            <Card withBorder>
              <Group gap="sm">
                <ThemeIcon variant="light" color="red"><IconClock size={18} /></ThemeIcon>
                <div>
                  <Text size="xs" c="dimmed">Tempo Máximo</Text>
                  <Text size="lg" fw={700}>{permanencia?.tempoMaximo || '—'}</Text>
                </div>
              </Group>
            </Card>
            <Card withBorder>
              <Group gap="sm">
                <ThemeIcon variant="light" color="orange"><IconClock size={18} /></ThemeIcon>
                <div>
                  <Text size="xs" c="dimmed">Excederam Limite</Text>
                  <Text size="lg" fw={700}>{permanencia?.excederamLimite ?? 0}</Text>
                </div>
              </Group>
            </Card>
          </SimpleGrid>

          <Card withBorder pos="relative">
            <LoadingOverlay visible={loadingPerm} />
            <Group justify="space-between" mb="md">
              <Text fw={600}>Detalhamento</Text>
              <Button
                variant="light"
                size="xs"
                leftSection={<IconDownload size={14} />}
                onClick={() => exportCSV(permanencia?.dados || [], 'patio-permanencia')}
                disabled={!permanencia?.dados?.length}
              >
                Exportar CSV
              </Button>
            </Group>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Placa</Table.Th>
                  <Table.Th>Motorista</Table.Th>
                  <Table.Th>Entrada</Table.Th>
                  <Table.Th>Saída</Table.Th>
                  <Table.Th>Permanência</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(permanencia?.dados || []).map((r: any, i: number) => (
                  <Table.Tr key={i}>
                    <Table.Td className="font-mono">{r.placa}</Table.Td>
                    <Table.Td>{r.motoristaNome || '—'}</Table.Td>
                    <Table.Td>
                      {r.entradaEm ? new Date(r.entradaEm).toLocaleString('pt-BR') : '—'}
                    </Table.Td>
                    <Table.Td>
                      {r.saidaEm ? new Date(r.saidaEm).toLocaleString('pt-BR') : '—'}
                    </Table.Td>
                    <Table.Td>{r.permanencia || '—'}</Table.Td>
                  </Table.Tr>
                ))}
                {(!permanencia?.dados || permanencia.dados.length === 0) && !loadingPerm && (
                  <Table.Tr>
                    <Table.Td colSpan={5} className="text-center py-8 text-zinc-500">
                      Nenhum dado encontrado para o período
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Card>
        </Tabs.Panel>

        {/* Tab Fila */}
        <Tabs.Panel value="fila">
          <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
            <Card withBorder>
              <Group gap="sm">
                <ThemeIcon variant="light" color="blue"><IconListNumbers size={18} /></ThemeIcon>
                <div>
                  <Text size="xs" c="dimmed">Tempo Médio na Fila</Text>
                  <Text size="lg" fw={700}>{filaRel?.tempoMedioFila || '—'}</Text>
                </div>
              </Group>
            </Card>
            <Card withBorder>
              <Group gap="sm">
                <ThemeIcon variant="light" color="green"><IconListNumbers size={18} /></ThemeIcon>
                <div>
                  <Text size="xs" c="dimmed">Total Atendidos</Text>
                  <Text size="lg" fw={700}>{filaRel?.totalAtendidos ?? 0}</Text>
                </div>
              </Group>
            </Card>
            <Card withBorder>
              <Group gap="sm">
                <ThemeIcon variant="light" color="orange"><IconListNumbers size={18} /></ThemeIcon>
                <div>
                  <Text size="xs" c="dimmed">Alterações de Prioridade</Text>
                  <Text size="lg" fw={700}>{filaRel?.alteracoesPrioridade ?? 0}</Text>
                </div>
              </Group>
            </Card>
          </SimpleGrid>

          <Card withBorder pos="relative">
            <LoadingOverlay visible={loadingFila} />
            <Group justify="space-between" mb="md">
              <Text fw={600}>Detalhamento</Text>
              <Button
                variant="light"
                size="xs"
                leftSection={<IconDownload size={14} />}
                onClick={() => exportCSV(filaRel?.dados || [], 'patio-fila')}
                disabled={!filaRel?.dados?.length}
              >
                Exportar CSV
              </Button>
            </Group>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Placa</Table.Th>
                  <Table.Th>Tipo Operação</Table.Th>
                  <Table.Th>Prioridade</Table.Th>
                  <Table.Th>Tempo na Fila</Table.Th>
                  <Table.Th>Data Entrada</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(filaRel?.dados || []).map((r: any, i: number) => (
                  <Table.Tr key={i}>
                    <Table.Td className="font-mono">{r.placa}</Table.Td>
                    <Table.Td>{r.tipoOperacao}</Table.Td>
                    <Table.Td>{r.prioridade}</Table.Td>
                    <Table.Td>{r.tempoFila || '—'}</Table.Td>
                    <Table.Td>
                      {r.entradaEm ? new Date(r.entradaEm).toLocaleString('pt-BR') : '—'}
                    </Table.Td>
                  </Table.Tr>
                ))}
                {(!filaRel?.dados || filaRel.dados.length === 0) && !loadingFila && (
                  <Table.Tr>
                    <Table.Td colSpan={5} className="text-center py-8 text-zinc-500">
                      Nenhum dado encontrado para o período
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Card>
        </Tabs.Panel>

        {/* Tab Ocupação */}
        <Tabs.Panel value="ocupacao">
          <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
            <Card withBorder>
              <Group gap="sm">
                <ThemeIcon variant="light" color="blue"><IconChartBar size={18} /></ThemeIcon>
                <div>
                  <Text size="xs" c="dimmed">Ocupação Média</Text>
                  <Text size="lg" fw={700}>{ocupacao?.ocupacaoMedia || '—'}</Text>
                </div>
              </Group>
            </Card>
            <Card withBorder>
              <Group gap="sm">
                <ThemeIcon variant="light" color="red"><IconChartBar size={18} /></ThemeIcon>
                <div>
                  <Text size="xs" c="dimmed">Pico de Ocupação</Text>
                  <Text size="lg" fw={700}>{ocupacao?.picoOcupacao ?? 0}</Text>
                </div>
              </Group>
            </Card>
            <Card withBorder>
              <Group gap="sm">
                <ThemeIcon variant="light" color="green"><IconChartBar size={18} /></ThemeIcon>
                <div>
                  <Text size="xs" c="dimmed">Total Veículos (período)</Text>
                  <Text size="lg" fw={700}>{ocupacao?.totalVeiculos ?? 0}</Text>
                </div>
              </Group>
            </Card>
          </SimpleGrid>

          <Card withBorder pos="relative">
            <LoadingOverlay visible={loadingOcupacao} />
            <Group justify="space-between" mb="md">
              <Text fw={600}>Detalhamento por Dia</Text>
              <Button
                variant="light"
                size="xs"
                leftSection={<IconDownload size={14} />}
                onClick={() => exportCSV(ocupacao?.dados || [], 'patio-ocupacao')}
                disabled={!ocupacao?.dados?.length}
              >
                Exportar CSV
              </Button>
            </Group>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Data</Table.Th>
                  <Table.Th>Veículos</Table.Th>
                  <Table.Th>Ocupação Máxima</Table.Th>
                  <Table.Th>Tempo Médio</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(ocupacao?.dados || []).map((r: any, i: number) => (
                  <Table.Tr key={i}>
                    <Table.Td>
                      {r.data ? new Date(r.data).toLocaleDateString('pt-BR') : '—'}
                    </Table.Td>
                    <Table.Td>{r.totalVeiculos}</Table.Td>
                    <Table.Td>{r.ocupacaoMaxima}</Table.Td>
                    <Table.Td>{r.tempoMedio || '—'}</Table.Td>
                  </Table.Tr>
                ))}
                {(!ocupacao?.dados || ocupacao.dados.length === 0) && !loadingOcupacao && (
                  <Table.Tr>
                    <Table.Td colSpan={4} className="text-center py-8 text-zinc-500">
                      Nenhum dado encontrado para o período
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Card>
        </Tabs.Panel>
      </Tabs>
    </div>
  )
}
