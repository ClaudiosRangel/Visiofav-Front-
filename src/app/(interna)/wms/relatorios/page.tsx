'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Tabs, LoadingOverlay, SimpleGrid,
  ThemeIcon, Progress, Button,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import {
  IconChartBar, IconClock, IconBuildingWarehouse, IconArrowsExchange,
  IconUsers, IconRefresh,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const operacaoLabels: Record<string, string> = {
  CONFERENCIA: 'Conferência', ENDERECAMENTO: 'Endereçamento', SEPARACAO: 'Separação',
  REPOSICAO: 'Reposição', MUDANCA_ENDERECO: 'Mudança End.', INVENTARIO: 'Inventário',
}

export default function RelatoriosWmsPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Relatórios' }, [])

  const [dataInicio, setDataInicio] = useState<Date | null>(null)
  const [dataFim, setDataFim] = useState<Date | null>(null)

  const diStr = dataInicio ? dataInicio.toISOString().split('T')[0] : undefined
  const dfStr = dataFim ? dataFim.toISOString().split('T')[0] : undefined

  // Produtividade
  const { data: prodResp, isLoading: loadProd, refetch: refetchProd } = useQuery<any>({
    queryKey: ['rel-produtividade', diStr, dfStr],
    queryFn: async () => {
      const params: any = {}
      if (diStr) params.dataInicio = diStr
      if (dfStr) params.dataFim = dfStr
      const { data } = await api.get('/relatorios-wms/produtividade', { params })
      return data
    },
  })

  // Tempos por operação
  const { data: temposResp, isLoading: loadTempos } = useQuery<any>({
    queryKey: ['rel-tempos', diStr, dfStr],
    queryFn: async () => {
      const params: any = {}
      if (diStr) params.dataInicio = diStr
      if (dfStr) params.dataFim = dfStr
      const { data } = await api.get('/relatorios-wms/tempos-operacao', { params })
      return data
    },
  })

  // Ocupação por rua
  const { data: ocupacaoResp, isLoading: loadOcup } = useQuery<any>({
    queryKey: ['rel-ocupacao'],
    queryFn: async () => { const { data } = await api.get('/relatorios-wms/ocupacao-enderecos'); return data },
  })

  // Movimentações por período
  const { data: movResp, isLoading: loadMov } = useQuery<any>({
    queryKey: ['rel-movimentacoes', diStr, dfStr],
    queryFn: async () => {
      const params: any = {}
      if (diStr) params.dataInicio = diStr
      if (dfStr) params.dataFim = dfStr
      const { data } = await api.get('/relatorios-wms/movimentacoes-periodo', { params })
      return data
    },
  })

  const produtividade = prodResp?.data || []
  const tempos = temposResp?.data || []
  const ocupacao = ocupacaoResp?.data || []
  const movimentacoes = movResp?.data || []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Relatórios</Text>
      <Text size="xl" fw={600} mb="lg">Relatórios Operacionais</Text>

      {/* Filtro de período */}
      <Card mb="md">
        <Group gap="md">
          <DateInput label="De" value={dataInicio} onChange={setDataInicio} valueFormat="DD/MM/YYYY" clearable className="w-36" />
          <DateInput label="Até" value={dataFim} onChange={setDataFim} valueFormat="DD/MM/YYYY" clearable className="w-36" />
          <Button variant="default" leftSection={<IconRefresh size={16} />} mt={24} onClick={() => refetchProd()}>Atualizar</Button>
        </Group>
      </Card>

      <Card>
        <Tabs defaultValue="produtividade">
          <Tabs.List mb="md">
            <Tabs.Tab value="produtividade" leftSection={<IconUsers size={16} />}>Produtividade</Tabs.Tab>
            <Tabs.Tab value="tempos" leftSection={<IconClock size={16} />}>Tempos por Operação</Tabs.Tab>
            <Tabs.Tab value="ocupacao" leftSection={<IconBuildingWarehouse size={16} />}>Ocupação por Rua</Tabs.Tab>
            <Tabs.Tab value="movimentacoes" leftSection={<IconArrowsExchange size={16} />}>Movimentações</Tabs.Tab>
          </Tabs.List>

          {/* Produtividade */}
          <Tabs.Panel value="produtividade">
            <LoadingOverlay visible={loadProd} />
            <Text fw={500} mb="sm">Produtividade por Funcionário ({prodResp?.totalOsConcluidas || 0} OS concluídas)</Text>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Matrícula</Table.Th><Table.Th>Funcionário</Table.Th>
                  <Table.Th>Total OS</Table.Th><Table.Th>Tempo Total</Table.Th>
                  <Table.Th>Tempo Médio/OS</Table.Th><Table.Th>Operações</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {produtividade.map((p: any) => (
                  <Table.Tr key={p.funcionarioId}>
                    <Table.Td className="font-mono">{p.funcionario?.matricula || '—'}</Table.Td>
                    <Table.Td fw={500}>{p.funcionario?.nome || '—'}</Table.Td>
                    <Table.Td fw={600}>{p.totalOs}</Table.Td>
                    <Table.Td>{p.tempoTotalMin} min</Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={p.tempoMedioPorOs < 30 ? 'green' : p.tempoMedioPorOs < 60 ? 'yellow' : 'red'}>
                        {p.tempoMedioPorOs} min
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {Object.entries(p.porOperacao || {}).map(([op, count]) => (
                          <Badge key={op} variant="light" size="sm">{operacaoLabels[op] || op}: {count as number}</Badge>
                        ))}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {produtividade.length === 0 && (
                  <Table.Tr><Table.Td colSpan={6} className="text-center py-8 text-zinc-500">Nenhum dado no período</Table.Td></Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Tabs.Panel>

          {/* Tempos por Operação */}
          <Tabs.Panel value="tempos">
            <LoadingOverlay visible={loadTempos} />
            <Text fw={500} mb="sm">Tempo Médio por Tipo de Operação</Text>
            <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} mb="md">
              {tempos.map((t: any) => (
                <Card key={t.operacao} withBorder>
                  <Text fw={600} mb="sm">{operacaoLabels[t.operacao] || t.operacao}</Text>
                  <SimpleGrid cols={2}>
                    <div><Text size="xs" c="dimmed">Total OS</Text><Text fw={700}>{t.totalOs}</Text></div>
                    <div><Text size="xs" c="dimmed">Tempo Médio</Text><Text fw={700} c="blue">{t.tempoMedio} min</Text></div>
                    <div><Text size="xs" c="dimmed">Mínimo</Text><Text fw={500} c="green">{t.tempoMinimo} min</Text></div>
                    <div><Text size="xs" c="dimmed">Máximo</Text><Text fw={500} c="red">{t.tempoMaximo} min</Text></div>
                  </SimpleGrid>
                </Card>
              ))}
            </SimpleGrid>
            {tempos.length === 0 && <Text c="dimmed" className="text-center py-8">Nenhum dado no período</Text>}
          </Tabs.Panel>

          {/* Ocupação por Rua */}
          <Tabs.Panel value="ocupacao">
            <LoadingOverlay visible={loadOcup} />
            <Text fw={500} mb="sm">
              Ocupação por Rua — {ocupacaoResp?.totalOcupados || 0} de {ocupacaoResp?.totalEnderecos || 0} endereços ocupados
            </Text>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Rua</Table.Th><Table.Th>Total</Table.Th><Table.Th>Ocupados</Table.Th>
                  <Table.Th>Livres</Table.Th><Table.Th>Ocupação</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {ocupacao.map((r: any) => (
                  <Table.Tr key={r.rua}>
                    <Table.Td fw={600}>Rua {r.rua}</Table.Td>
                    <Table.Td>{r.total}</Table.Td>
                    <Table.Td>{r.ocupados}</Table.Td>
                    <Table.Td c="green">{r.livres}</Table.Td>
                    <Table.Td>
                      <Group gap={8}>
                        <Progress value={r.percentual} size="lg" className="flex-1"
                          color={r.percentual > 80 ? 'red' : r.percentual > 50 ? 'yellow' : 'green'} />
                        <Text size="xs" fw={600} className="w-10">{r.percentual}%</Text>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {ocupacao.length === 0 && (
                  <Table.Tr><Table.Td colSpan={5} className="text-center py-8 text-zinc-500">Nenhum endereço cadastrado</Table.Td></Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Tabs.Panel>

          {/* Movimentações */}
          <Tabs.Panel value="movimentacoes">
            <LoadingOverlay visible={loadMov} />
            <Text fw={500} mb="sm">Movimentações por Dia</Text>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Data</Table.Th><Table.Th>Total Mov.</Table.Th><Table.Th>Detalhamento</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {movimentacoes.map((m: any) => (
                  <Table.Tr key={m.dia}>
                    <Table.Td fw={500}>{new Date(m.dia + 'T12:00:00').toLocaleDateString('pt-BR')}</Table.Td>
                    <Table.Td fw={600}>{m.totalMovimentacoes}</Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {(m.tipos || []).map((t: any) => (
                          <Badge key={t.tipo} variant="light" size="sm">
                            {t.tipo}: {t.count} ({t.entradas > 0 ? `+${t.entradas}` : ''}{t.saidas > 0 ? ` -${t.saidas}` : ''})
                          </Badge>
                        ))}
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {movimentacoes.length === 0 && (
                  <Table.Tr><Table.Td colSpan={3} className="text-center py-8 text-zinc-500">Nenhuma movimentação no período</Table.Td></Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Tabs.Panel>
        </Tabs>
      </Card>
    </div>
  )
}
