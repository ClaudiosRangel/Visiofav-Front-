'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Tabs, LoadingOverlay, SimpleGrid,
  Button, TextInput, Select, Modal, Stack, Pagination,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import {
  IconTruckDelivery, IconRefresh, IconSearch, IconFileText,
  IconRoute, IconPackage, IconScale, IconReceipt,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const statusColors: Record<string, string> = {
  AGUARDANDO_SEPARACAO: 'gray',
  EM_CARREGAMENTO: 'orange',
  FINALIZADO: 'green',
  CANCELADO: 'red',
}

export default function RelatoriosExpedicaoPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Relatórios Expedição' }, [])

  const [dataInicio, setDataInicio] = useState<Date | null>(null)
  const [dataFim, setDataFim] = useState<Date | null>(null)
  const [page, setPage] = useState(1)
  const [filtroStatus, setFiltroStatus] = useState<string | null>(null)
  const [filtroMotorista, setFiltroMotorista] = useState('')
  const [filtroPlaca, setFiltroPlaca] = useState('')
  const [romaneioMapaId, setRomaneioMapaId] = useState<string | null>(null)

  const diStr = dataInicio ? dataInicio.toISOString().split('T')[0] : undefined
  const dfStr = dataFim ? dataFim.toISOString().split('T')[0] : undefined

  // Total Expedição
  const { data: totalExp, isLoading: loadTotal, refetch } = useQuery<any>({
    queryKey: ['rel-total-expedicao', diStr, dfStr],
    queryFn: async () => {
      if (!diStr || !dfStr) return null
      const { data } = await api.get('/relatorios/expedicao/total-expedicao', {
        params: { dataInicio: diStr, dataFim: dfStr },
      })
      return data
    },
    enabled: !!(diStr && dfStr),
  })

  // Total por Roteiro
  const { data: totalRoteiro, isLoading: loadRoteiro } = useQuery<any>({
    queryKey: ['rel-total-roteiro', diStr, dfStr],
    queryFn: async () => {
      if (!diStr || !dfStr) return null
      const { data } = await api.get('/relatorios/expedicao/total-roteiro', {
        params: { dataInicio: diStr, dataFim: dfStr },
      })
      return data
    },
    enabled: !!(diStr && dfStr),
  })

  // Consulta Mapas
  const { data: mapasResp, isLoading: loadMapas } = useQuery<any>({
    queryKey: ['rel-consulta-mapas', diStr, dfStr, filtroStatus, filtroMotorista, filtroPlaca, page],
    queryFn: async () => {
      const params: any = { page, limit: 20 }
      if (diStr) params.dataInicio = diStr
      if (dfStr) params.dataFim = dfStr
      if (filtroStatus) params.status = filtroStatus
      if (filtroMotorista) params.motorista = filtroMotorista
      if (filtroPlaca) params.placa = filtroPlaca
      const { data } = await api.get('/relatorios/expedicao/consulta-mapas', { params })
      return data
    },
  })

  // Romaneio
  const { data: romaneio, isLoading: loadRomaneio } = useQuery<any>({
    queryKey: ['rel-romaneio', romaneioMapaId],
    queryFn: async () => {
      if (!romaneioMapaId) return null
      const { data } = await api.get(`/relatorios/expedicao/romaneio/${romaneioMapaId}`)
      return data
    },
    enabled: !!romaneioMapaId,
  })

  const mapas = mapasResp?.data || []
  const totalPages = mapasResp?.totalPages || 1
  const roteiroData = totalRoteiro?.data || []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Relatórios Expedição</Text>
      <Text size="xl" fw={600} mb="lg">Relatórios de Expedição</Text>

      {/* Filtro de período */}
      <Card mb="md">
        <Group gap="md">
          <DateInput label="De" value={dataInicio} onChange={setDataInicio} valueFormat="DD/MM/YYYY" clearable className="w-36" />
          <DateInput label="Até" value={dataFim} onChange={setDataFim} valueFormat="DD/MM/YYYY" clearable className="w-36" />
          <Button variant="default" leftSection={<IconRefresh size={16} />} mt={24} onClick={() => refetch()}>Atualizar</Button>
        </Group>
      </Card>

      <Card>
        <Tabs defaultValue="totais">
          <Tabs.List mb="md">
            <Tabs.Tab value="totais" leftSection={<IconPackage size={16} />}>Totais Expedição</Tabs.Tab>
            <Tabs.Tab value="roteiro" leftSection={<IconRoute size={16} />}>Por Roteiro</Tabs.Tab>
            <Tabs.Tab value="mapas" leftSection={<IconTruckDelivery size={16} />}>Consulta Mapas</Tabs.Tab>
          </Tabs.List>

          {/* Totais Expedição */}
          <Tabs.Panel value="totais">
            <LoadingOverlay visible={loadTotal} />
            {!diStr || !dfStr ? (
              <Text c="dimmed" ta="center" py="xl">Selecione um período para visualizar os totais</Text>
            ) : totalExp ? (
              <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
                <Card withBorder>
                  <Group gap="xs" mb="xs">
                    <IconTruckDelivery size={20} color="var(--mantine-color-blue-6)" />
                    <Text size="sm" c="dimmed">Mapas Gerados</Text>
                  </Group>
                  <Text size="xl" fw={700}>{totalExp.mapasGerados}</Text>
                </Card>
                <Card withBorder>
                  <Group gap="xs" mb="xs">
                    <IconReceipt size={20} color="var(--mantine-color-green-6)" />
                    <Text size="sm" c="dimmed">NFs Expedidas</Text>
                  </Group>
                  <Text size="xl" fw={700}>{totalExp.nfsExpedidas}</Text>
                </Card>
                <Card withBorder>
                  <Group gap="xs" mb="xs">
                    <IconPackage size={20} color="var(--mantine-color-violet-6)" />
                    <Text size="sm" c="dimmed">Valor Total</Text>
                  </Group>
                  <Text size="xl" fw={700}>
                    {Number(totalExp.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </Text>
                </Card>
                <Card withBorder>
                  <Group gap="xs" mb="xs">
                    <IconScale size={20} color="var(--mantine-color-orange-6)" />
                    <Text size="sm" c="dimmed">Peso Total (kg)</Text>
                  </Group>
                  <Text size="xl" fw={700}>{Number(totalExp.pesoTotal).toLocaleString('pt-BR')}</Text>
                </Card>
              </SimpleGrid>
            ) : (
              <Text c="dimmed" ta="center" py="xl">Nenhum dado encontrado no período</Text>
            )}
          </Tabs.Panel>

          {/* Por Roteiro */}
          <Tabs.Panel value="roteiro">
            <LoadingOverlay visible={loadRoteiro} />
            {!diStr || !dfStr ? (
              <Text c="dimmed" ta="center" py="xl">Selecione um período para visualizar por roteiro</Text>
            ) : (
              <>
                {totalRoteiro?.geral && (
                  <Card withBorder mb="md" bg="blue.0">
                    <Group justify="space-between">
                      <Text fw={600}>Totais Gerais</Text>
                      <Group gap="xl">
                        <div><Text size="xs" c="dimmed">NFs</Text><Text fw={700}>{totalRoteiro.geral.quantidadeNfs}</Text></div>
                        <div><Text size="xs" c="dimmed">Valor</Text><Text fw={700}>{Number(totalRoteiro.geral.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Text></div>
                        <div><Text size="xs" c="dimmed">Peso (kg)</Text><Text fw={700}>{totalRoteiro.geral.pesoTotalKg}</Text></div>
                        <div><Text size="xs" c="dimmed">Volumes</Text><Text fw={700}>{totalRoteiro.geral.totalVolumes}</Text></div>
                      </Group>
                    </Group>
                  </Card>
                )}
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Rota</Table.Th>
                      <Table.Th>Descrição</Table.Th>
                      <Table.Th>Qtd NFs</Table.Th>
                      <Table.Th>Valor Total</Table.Th>
                      <Table.Th>Peso (kg)</Table.Th>
                      <Table.Th>Volumes</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {roteiroData.map((r: any, idx: number) => (
                      <Table.Tr key={idx}>
                        <Table.Td fw={600}>{r.rotaCodigo || 'Sem rota'}</Table.Td>
                        <Table.Td>{r.rotaDescricao || '—'}</Table.Td>
                        <Table.Td>{r.quantidadeNfs}</Table.Td>
                        <Table.Td>{Number(r.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
                        <Table.Td>{r.pesoTotalKg}</Table.Td>
                        <Table.Td>{r.totalVolumes}</Table.Td>
                      </Table.Tr>
                    ))}
                    {roteiroData.length === 0 && (
                      <Table.Tr><Table.Td colSpan={6} className="text-center py-8 text-zinc-500">Nenhum dado no período</Table.Td></Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </>
            )}
          </Tabs.Panel>

          {/* Consulta Mapas */}
          <Tabs.Panel value="mapas">
            <LoadingOverlay visible={loadMapas} />
            <Group gap="md" mb="md">
              <TextInput
                placeholder="Motorista..."
                leftSection={<IconSearch size={16} />}
                value={filtroMotorista}
                onChange={(e) => { setFiltroMotorista(e.currentTarget.value); setPage(1) }}
                className="w-48"
              />
              <TextInput
                placeholder="Placa..."
                value={filtroPlaca}
                onChange={(e) => { setFiltroPlaca(e.currentTarget.value); setPage(1) }}
                className="w-32"
              />
              <Select
                placeholder="Status"
                clearable
                data={[
                  { value: 'AGUARDANDO_SEPARACAO', label: 'Aguard. Separação' },
                  { value: 'EM_CARREGAMENTO', label: 'Em Carregamento' },
                  { value: 'FINALIZADO', label: 'Finalizado' },
                  { value: 'CANCELADO', label: 'Cancelado' },
                ]}
                value={filtroStatus}
                onChange={(v) => { setFiltroStatus(v); setPage(1) }}
                className="w-48"
              />
            </Group>

            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nº</Table.Th>
                  <Table.Th>Emissão</Table.Th>
                  <Table.Th>Placa</Table.Th>
                  <Table.Th>Motorista</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>NFs</Table.Th>
                  <Table.Th>Valor</Table.Th>
                  <Table.Th>Ações</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {mapas.map((m: any) => (
                  <Table.Tr key={m.id}>
                    <Table.Td fw={600}>{m.numero}</Table.Td>
                    <Table.Td>{new Date(m.emissao).toLocaleDateString('pt-BR')}</Table.Td>
                    <Table.Td className="font-mono">{m.placa}</Table.Td>
                    <Table.Td>{m.motorista || '—'}</Table.Td>
                    <Table.Td>
                      <Badge color={statusColors[m.status] || 'gray'} variant="light">
                        {m.status?.replace(/_/g, ' ')}
                      </Badge>
                    </Table.Td>
                    <Table.Td>{m.totalNfs}</Table.Td>
                    <Table.Td>{Number(m.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
                    <Table.Td>
                      <Button size="xs" variant="light" leftSection={<IconFileText size={14} />} onClick={() => setRomaneioMapaId(m.id)}>
                        Romaneio
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {mapas.length === 0 && (
                  <Table.Tr><Table.Td colSpan={8} className="text-center py-8 text-zinc-500">Nenhum mapa encontrado</Table.Td></Table.Tr>
                )}
              </Table.Tbody>
            </Table>

            {totalPages > 1 && (
              <Group justify="center" mt="md">
                <Pagination total={totalPages} value={page} onChange={setPage} />
              </Group>
            )}
          </Tabs.Panel>
        </Tabs>
      </Card>

      {/* Modal Romaneio */}
      <Modal opened={!!romaneioMapaId} onClose={() => setRomaneioMapaId(null)} title="Romaneio" size="xl">
        <LoadingOverlay visible={loadRomaneio} />
        {romaneio && (
          <Stack gap="md">
            <Card withBorder>
              <SimpleGrid cols={{ base: 2, sm: 4 }}>
                <div><Text size="xs" c="dimmed">Mapa Nº</Text><Text fw={700}>{romaneio.numero}</Text></div>
                <div><Text size="xs" c="dimmed">Placa</Text><Text fw={600} className="font-mono">{romaneio.placa}</Text></div>
                <div><Text size="xs" c="dimmed">Motorista</Text><Text>{romaneio.motorista || '—'}</Text></div>
                <div><Text size="xs" c="dimmed">Status</Text><Badge color={statusColors[romaneio.status] || 'gray'}>{romaneio.status?.replace(/_/g, ' ')}</Badge></div>
              </SimpleGrid>
              {romaneio.rota && (
                <Group mt="sm" gap="xs">
                  <IconRoute size={16} />
                  <Text size="sm">Rota: <Text span fw={600}>{romaneio.rota.codigo} — {romaneio.rota.descricao}</Text></Text>
                </Group>
              )}
              {romaneio.distanciaTotalKm != null && (
                <Group mt="xs" gap="xs">
                  <Badge color="blue" size="lg">Distância total: {Number(romaneio.distanciaTotalKm).toFixed(2)} km</Badge>
                </Group>
              )}
            </Card>

            <Text fw={500}>Entregas ({romaneio.nfs?.length || 0})</Text>
            <Table striped withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  {romaneio.distanciaTotalKm != null && <Table.Th>Ordem</Table.Th>}
                  <Table.Th>NF</Table.Th>
                  <Table.Th>Cliente</Table.Th>
                  <Table.Th>Cidade</Table.Th>
                  <Table.Th>Valor</Table.Th>
                  <Table.Th>Peso (kg)</Table.Th>
                  {romaneio.distanciaTotalKm != null && <Table.Th>Dist. Parcial</Table.Th>}
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(romaneio.nfs || []).map((nf: any, idx: number) => (
                  <Table.Tr key={nf.nfeId}>
                    {romaneio.distanciaTotalKm != null && <Table.Td fw={600}>{nf.ordemEntrega ?? idx + 1}</Table.Td>}
                    <Table.Td>{nf.numero || '—'}</Table.Td>
                    <Table.Td>{nf.cliente?.razaoSocial || '—'}</Table.Td>
                    <Table.Td>{nf.cliente?.cidade || '—'}</Table.Td>
                    <Table.Td>{Number(nf.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
                    <Table.Td>{nf.pesoTotalKg}</Table.Td>
                    {romaneio.distanciaTotalKm != null && (
                      <Table.Td>{nf.distanciaParcialKm != null ? `${Number(nf.distanciaParcialKm).toFixed(2)} km` : '—'}</Table.Td>
                    )}
                    <Table.Td>
                      {nf.statusEntrega ? (
                        <Badge color={nf.statusEntrega === 'ENTREGUE' ? 'green' : 'red'} variant="light" size="sm">
                          {nf.statusEntrega}
                        </Badge>
                      ) : (
                        <Text size="xs" c="dimmed">Pendente</Text>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        )}
      </Modal>
    </div>
  )
}
