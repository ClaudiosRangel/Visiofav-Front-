'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'
import {
  Card, Group, Text, Table, Badge, Tabs, Stack, LoadingOverlay,
  Pagination, SimpleGrid,
} from '@mantine/core'
import {
  IconFileText, IconReceipt, IconChartLine, IconInfoCircle,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import Link from 'next/link'
import { useState } from 'react'

const STATUS_COLORS: Record<string, string> = {
  ATIVO: 'green',
  SUSPENSO: 'yellow',
  ENCERRADO: 'gray',
}

const FATURA_STATUS_COLORS: Record<string, string> = {
  GERADA: 'gray',
  ENVIADA: 'blue',
  PAGA: 'green',
  CANCELADA: 'red',
  ATRASADA: 'orange',
}

export default function ContratoDetailPage() {
  useModuloGuard('WMS')
  const { id } = useParams<{ id: string }>()
  useEffect(() => { document.title = 'VisioFab - WMS - Contrato Detalhe' }, [])

  const [medicaoPage, setMedicaoPage] = useState(1)
  const medicaoLimit = 10

  const { data: contrato, isLoading } = useQuery<any>({
    queryKey: ['faturamento', 'contratos', id],
    queryFn: async () => {
      const { data } = await api.get(`/faturamento/contratos/${id}`)
      return data
    },
    enabled: !!id,
  })

  const { data: medicoesResp, isLoading: loadingMedicoes } = useQuery<any>({
    queryKey: ['faturamento', 'contratos', id, 'medicoes', medicaoPage],
    queryFn: async () => {
      const { data } = await api.get(`/faturamento/medicoes`, {
        params: { contratoId: id, dataInicio: '2020-01-01', dataFim: '2030-12-31', page: medicaoPage, limit: medicaoLimit },
      })
      return data
    },
    enabled: !!id,
  })

  const { data: faturasResp } = useQuery<any>({
    queryKey: ['faturamento', 'contratos', id, 'faturas'],
    queryFn: async () => {
      const { data } = await api.get(`/faturamento/faturas`, {
        params: { contratoId: id, limit: 50 },
      })
      return data
    },
    enabled: !!id,
  })

  const tarifas = contrato?.tarifas || []
  const medicoes = medicoesResp?.data || []
  const medicoesTotal = medicoesResp?.pagination?.total || 0
  const medicoesTotalPages = medicoesResp?.pagination?.totalPages || 0
  const faturas = faturasResp?.data || []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Faturamento / Contratos / Detalhe</Text>
      <Group justify="space-between" mb="lg">
        <Text size="xl" fw={600}>
          Contrato {contrato?.id ? `#${contrato.id}` : ''}
        </Text>
        {contrato?.status && (
          <Badge size="lg" variant="light" color={STATUS_COLORS[contrato.status] || 'gray'}>
            {contrato.status}
          </Badge>
        )}
      </Group>

      <Card pos="relative" withBorder>
        <LoadingOverlay visible={isLoading} />

        <Tabs defaultValue="dados">
          <Tabs.List>
            <Tabs.Tab value="dados" leftSection={<IconInfoCircle size={16} />}>
              Dados Gerais
            </Tabs.Tab>
            <Tabs.Tab value="tarifas" leftSection={<IconReceipt size={16} />}>
              Tarifas
            </Tabs.Tab>
            <Tabs.Tab value="medicoes" leftSection={<IconChartLine size={16} />}>
              Medições
            </Tabs.Tab>
            <Tabs.Tab value="faturas" leftSection={<IconFileText size={16} />}>
              Faturas
            </Tabs.Tab>
          </Tabs.List>

          {/* Dados Gerais */}
          <Tabs.Panel value="dados" pt="md">
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
              <Stack gap="xs">
                <Text size="sm" c="dimmed">Cliente</Text>
                <Text fw={500}>{contrato?.clienteNome || contrato?.clienteId || '—'}</Text>
              </Stack>
              <Stack gap="xs">
                <Text size="sm" c="dimmed">Periodicidade</Text>
                <Text fw={500}>{contrato?.periodicidade || '—'}</Text>
              </Stack>
              <Stack gap="xs">
                <Text size="sm" c="dimmed">Data Início</Text>
                <Text fw={500}>
                  {contrato?.dataInicio
                    ? new Date(contrato.dataInicio).toLocaleDateString('pt-BR')
                    : '—'}
                </Text>
              </Stack>
              <Stack gap="xs">
                <Text size="sm" c="dimmed">Data Fim</Text>
                <Text fw={500}>
                  {contrato?.dataFim
                    ? new Date(contrato.dataFim).toLocaleDateString('pt-BR')
                    : 'Indeterminado'}
                </Text>
              </Stack>
              <Stack gap="xs">
                <Text size="sm" c="dimmed">Moeda</Text>
                <Text fw={500}>{contrato?.moeda || 'BRL'}</Text>
              </Stack>
              <Stack gap="xs">
                <Text size="sm" c="dimmed">Observação</Text>
                <Text fw={500}>{contrato?.observacao || '—'}</Text>
              </Stack>
            </SimpleGrid>
          </Tabs.Panel>

          {/* Tarifas */}
          <Tabs.Panel value="tarifas" pt="md">
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Tipo</Table.Th>
                  <Table.Th>Valor Unitário</Table.Th>
                  <Table.Th>Carência (dias)</Table.Th>
                  <Table.Th>Descrição</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {tarifas.map((t: any, i: number) => (
                  <Table.Tr key={i}>
                    <Table.Td>
                      <Badge variant="light">{t.tipo}</Badge>
                    </Table.Td>
                    <Table.Td>
                      {(t.valorUnitario ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: contrato?.moeda || 'BRL' })}
                    </Table.Td>
                    <Table.Td>{t.carenciaDias ?? '—'}</Table.Td>
                    <Table.Td>{t.descricao || '—'}</Table.Td>
                  </Table.Tr>
                ))}
                {tarifas.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={4} className="text-center py-4 text-zinc-500">
                      Nenhuma tarifa cadastrada
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Tabs.Panel>

          {/* Medições */}
          <Tabs.Panel value="medicoes" pt="md" pos="relative">
            <LoadingOverlay visible={loadingMedicoes} />
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Data Medição</Table.Th>
                  <Table.Th>Pallets</Table.Th>
                  <Table.Th>Volume (m³)</Table.Th>
                  <Table.Th>Posições Ocupadas</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {medicoes.map((m: any) => (
                  <Table.Tr key={m.id}>
                    <Table.Td>
                      {m.dataMedicao
                        ? new Date(m.dataMedicao).toLocaleDateString('pt-BR')
                        : '—'}
                    </Table.Td>
                    <Table.Td>{m.quantidadePallets ?? 0}</Table.Td>
                    <Table.Td>{Number(m.volumeM3 ?? 0).toFixed(2)}</Table.Td>
                    <Table.Td>{m.posicoesOcupadas ?? 0}</Table.Td>
                  </Table.Tr>
                ))}
                {medicoes.length === 0 && !loadingMedicoes && (
                  <Table.Tr>
                    <Table.Td colSpan={4} className="text-center py-4 text-zinc-500">
                      Nenhuma medição encontrada
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
            {medicoesTotalPages > 1 && (
              <Group justify="center" mt="md">
                <Pagination value={medicaoPage} onChange={setMedicaoPage} total={medicoesTotalPages} />
              </Group>
            )}
          </Tabs.Panel>

          {/* Faturas */}
          <Tabs.Panel value="faturas" pt="md">
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Número</Table.Th>
                  <Table.Th>Período</Table.Th>
                  <Table.Th>Valor Total</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Emissão</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {faturas.map((f: any) => (
                  <Table.Tr key={f.id}>
                    <Table.Td>
                      <Text
                        component={Link}
                        href={`/wms/faturamento/faturas/${f.id}`}
                        c="blue"
                        td="underline"
                        size="sm"
                      >
                        {f.numero}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {f.periodoInicio && f.periodoFim
                        ? `${new Date(f.periodoInicio).toLocaleDateString('pt-BR')} a ${new Date(f.periodoFim).toLocaleDateString('pt-BR')}`
                        : '—'}
                    </Table.Td>
                    <Table.Td>
                      {(f.valorTotal ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: contrato?.moeda || 'BRL' })}
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={FATURA_STATUS_COLORS[f.status] || 'gray'}>
                        {f.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {f.criadoEm
                        ? new Date(f.criadoEm).toLocaleDateString('pt-BR')
                        : '—'}
                    </Table.Td>
                  </Table.Tr>
                ))}
                {faturas.length === 0 && (
                  <Table.Tr>
                    <Table.Td colSpan={5} className="text-center py-4 text-zinc-500">
                      Nenhuma fatura vinculada
                    </Table.Td>
                  </Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Tabs.Panel>
        </Tabs>
      </Card>
    </div>
  )
}
