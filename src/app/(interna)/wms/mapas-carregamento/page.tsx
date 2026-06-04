'use client'

import { useState, useMemo } from 'react'
import {
  Card, Table, Badge, Button, Modal, TextInput, Select, Group, Text,
  LoadingOverlay, Stack, SimpleGrid, ThemeIcon,
} from '@mantine/core'
import { IconRefresh, IconRoute } from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import type { SequenciaEntrega } from '@/data/types/geo'
import { OtimizarRotaPanel } from '@/components/geo/OtimizarRotaPanel'

const statusColors: Record<string, string> = {
  AGUARDANDO_SEPARACAO: 'orange',
  EM_CARREGAMENTO: 'blue',
  FINALIZADO: 'green',
  CANCELADO: 'red',
}

const statusLabels: Record<string, string> = {
  AGUARDANDO_SEPARACAO: 'Aguardando Separação',
  EM_CARREGAMENTO: 'Em Carregamento',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
}

export default function MapasCarregamentoPage() {
  useModuloGuard('WMS')
  const queryClient = useQueryClient()

  // Filters
  const [numero, setNumero] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [periodoInicio, setPeriodoInicio] = useState('')
  const [periodoFim, setPeriodoFim] = useState('')

  // Modals
  const [cancelarModal, setCancelarModal] = useState<any>(null)
  const [motivoCancelamento, setMotivoCancelamento] = useState('')
  const [fecharModal, setFecharModal] = useState<any>(null)
  const [nfsEntrega, setNfsEntrega] = useState<any[]>([])
  const [detalheModal, setDetalheModal] = useState<any>(null)

  const filterParams = useMemo(() => {
    const params: Record<string, any> = {}
    if (numero) params.numero = numero
    if (status) params.status = status
    if (periodoInicio) params.dataInicio = periodoInicio
    if (periodoFim) params.dataFim = periodoFim
    return params
  }, [numero, status, periodoInicio, periodoFim])

  const { data: mapasResponse, isLoading } = useQuery<any>({
    queryKey: ['mapas-carregamento', filterParams],
    queryFn: async () => {
      const { data } = await api.get('/mapas-carregamento', { params: filterParams })
      return data
    },
  })

  const cancelar = useMutation({
    mutationFn: async ({ id, motivoCancelamento }: { id: string; motivoCancelamento: string }) => {
      await api.post(`/mapas-carregamento/${id}/cancelar`, { motivoCancelamento })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mapas-carregamento'] })
      notifications.show({ title: 'Sucesso', message: 'Mapa cancelado', color: 'green' })
      setCancelarModal(null)
      setMotivoCancelamento('')
    },
  })

  const fechar = useMutation({
    mutationFn: async ({ id, nfs }: { id: string; nfs: any[] }) => {
      await api.post(`/mapas-carregamento/${id}/fechar`, { nfs })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mapas-carregamento'] })
      notifications.show({ title: 'Sucesso', message: 'Mapa fechado', color: 'green' })
      setFecharModal(null)
      setNfsEntrega([])
    },
  })

  const mapas = mapasResponse?.data || mapasResponse || []

  async function handleCancelar() {
    if (!motivoCancelamento.trim()) {
      notifications.show({ title: 'Atenção', message: 'Motivo é obrigatório', color: 'yellow' })
      return
    }
    try {
      await cancelar.mutateAsync({ id: cancelarModal.id, motivoCancelamento })
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Falha ao cancelar'
      notifications.show({ title: 'Erro', message: msg, color: 'red' })
    }
  }

  async function handleFechar() {
    const nfsPayload = nfsEntrega.map((nf: any) => ({
      nfeId: nf.nfeId,
      statusEntrega: nf.statusEntrega,
      motivoDevolucao: nf.motivoDevolucao || undefined,
    }))

    const invalid = nfsPayload.find(
      (n: any) => n.statusEntrega === 'DEVOLVIDO' && !n.motivoDevolucao
    )
    if (invalid) {
      notifications.show({
        title: 'Atenção',
        message: 'Informe o motivo para todas as NFs devolvidas',
        color: 'yellow',
      })
      return
    }

    try {
      await fechar.mutateAsync({ id: fecharModal.id, nfs: nfsPayload })
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Falha ao fechar mapa'
      notifications.show({ title: 'Erro', message: msg, color: 'red' })
    }
  }

  async function openDetalhe(mapa: any) {
    try {
      const { data } = await api.get(`/mapas-carregamento/${mapa.id}`)
      setDetalheModal(data)
    } catch {
      notifications.show({ title: 'Erro', message: 'Falha ao carregar detalhes', color: 'red' })
    }
  }

  async function openFechar(mapa: any) {
    try {
      const { data } = await api.get(`/mapas-carregamento/${mapa.id}`)
      setFecharModal(data)
      setNfsEntrega(
        (data.nfs || []).map((nf: any) => ({
          nfeId: nf.nfeId || nf.id,
          nfNumero: nf.nfe?.numero || nf.nfe?.nNF || nf.numero || '-',
          clienteNome: nf.nfe?.cliente?.razaoSocial || nf.clienteNome || '-',
          statusEntrega: nf.statusEntrega || 'ENTREGUE',
          motivoDevolucao: nf.motivoDevolucao || '',
        }))
      )
    } catch {
      notifications.show({ title: 'Erro', message: 'Falha ao carregar mapa', color: 'red' })
    }
  }

  function updateNfEntrega(index: number, field: string, value: string) {
    setNfsEntrega((prev) =>
      prev.map((nf, i) => (i === index ? { ...nf, [field]: value } : nf))
    )
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / WMS / Mapas de Carregamento</Text>
      <Text size="xl" fw={600} mb="lg">Mapas de Carregamento</Text>

      <Stack gap="md">
        {/* Filters */}
        <Card withBorder>
          <Text size="sm" fw={500} mb="sm">Filtros</Text>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }}>
            <TextInput
              label="Número"
              placeholder="Nº do mapa"
              value={numero}
              onChange={(e) => setNumero(e.currentTarget.value)}
            />
            <Select
              label="Status"
              placeholder="Todos"
              clearable
              data={[
                { value: 'AGUARDANDO_SEPARACAO', label: 'Aguardando Separação' },
                { value: 'EM_CARREGAMENTO', label: 'Em Carregamento' },
                { value: 'FINALIZADO', label: 'Finalizado' },
                { value: 'CANCELADO', label: 'Cancelado' },
              ]}
              value={status}
              onChange={setStatus}
            />
            <TextInput
              label="Período Início"
              type="date"
              value={periodoInicio}
              onChange={(e) => setPeriodoInicio(e.currentTarget.value)}
            />
            <TextInput
              label="Período Fim"
              type="date"
              value={periodoFim}
              onChange={(e) => setPeriodoFim(e.currentTarget.value)}
            />
          </SimpleGrid>
          <Group mt="sm">
            <Button
              variant="default"
              leftSection={<IconRefresh size={16} />}
              onClick={() => queryClient.invalidateQueries({ queryKey: ['mapas-carregamento'] })}
            >
              Atualizar
            </Button>
          </Group>
        </Card>

        {/* Mapas Table */}
        <Card withBorder pos="relative">
          <LoadingOverlay visible={isLoading} />
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Número</Table.Th>
                <Table.Th>Placa</Table.Th>
                <Table.Th>Motorista</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Distância Total (km)</Table.Th>
                <Table.Th>Emissão</Table.Th>
                <Table.Th>Ações</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {(Array.isArray(mapas) ? mapas : []).map((mapa: any) => (
                <Table.Tr key={mapa.id}>
                  <Table.Td>{mapa.numero}</Table.Td>
                  <Table.Td>{mapa.veiculoPlaca}</Table.Td>
                  <Table.Td>{mapa.motorista || '-'}</Table.Td>
                  <Table.Td>
                    <Badge color={statusColors[mapa.status] || 'gray'} variant="light">
                      {statusLabels[mapa.status] || mapa.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {mapa.distanciaTotalKm != null
                      ? `${Number(mapa.distanciaTotalKm).toFixed(2)} km`
                      : '—'}
                  </Table.Td>
                  <Table.Td>
                    {mapa.emissaoEm ? new Date(mapa.emissaoEm).toLocaleDateString('pt-BR') : '-'}
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <Button size="xs" variant="subtle" onClick={() => openDetalhe(mapa)}>
                        Ver
                      </Button>
                      {mapa.status !== 'FINALIZADO' && mapa.status !== 'CANCELADO' && (
                        <Button
                          size="xs"
                          variant="subtle"
                          color="red"
                          onClick={() => setCancelarModal(mapa)}
                        >
                          Cancelar
                        </Button>
                      )}
                      {mapa.status === 'EM_CARREGAMENTO' && (
                        <Button
                          size="xs"
                          variant="subtle"
                          color="green"
                          onClick={() => openFechar(mapa)}
                        >
                          Fechar
                        </Button>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {!isLoading && mapas.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={7} className="text-center py-8 text-zinc-500">
                    Nenhum mapa encontrado
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Card>

        {/* Modal Cancelar */}
        <Modal
          opened={!!cancelarModal}
          onClose={() => { setCancelarModal(null); setMotivoCancelamento('') }}
          title={`Cancelar Mapa nº ${cancelarModal?.numero || ''}`}
          centered
        >
          <Stack gap="md">
            <TextInput
              label={<>Motivo do Cancelamento <span style={{ color: 'red' }}>*</span></>}
              value={motivoCancelamento}
              onChange={(e) => setMotivoCancelamento(e.currentTarget.value)}
            />
            <Group justify="flex-end">
              <Button variant="default" onClick={() => { setCancelarModal(null); setMotivoCancelamento('') }}>
                Voltar
              </Button>
              <Button color="red" onClick={handleCancelar} loading={cancelar.isPending}>
                Confirmar Cancelamento
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Modal Fechar */}
        <Modal
          opened={!!fecharModal}
          onClose={() => { setFecharModal(null); setNfsEntrega([]) }}
          title={`Fechar Mapa nº ${fecharModal?.numero || ''}`}
          centered
          size="lg"
        >
          <Stack gap="md">
            <Text size="sm" c="dimmed">
              Informe o status de entrega para cada NF:
            </Text>
            <Table withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>NF</Table.Th>
                  <Table.Th>Cliente</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Motivo Devolução</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {nfsEntrega.map((nf: any, idx: number) => (
                  <Table.Tr key={idx}>
                    <Table.Td>{nf.nfNumero}</Table.Td>
                    <Table.Td>{nf.clienteNome}</Table.Td>
                    <Table.Td>
                      <Select
                        size="xs"
                        data={[
                          { value: 'ENTREGUE', label: 'Entregue' },
                          { value: 'DEVOLVIDO', label: 'Devolvido' },
                        ]}
                        value={nf.statusEntrega}
                        onChange={(val) => updateNfEntrega(idx, 'statusEntrega', val || 'ENTREGUE')}
                      />
                    </Table.Td>
                    <Table.Td>
                      {nf.statusEntrega === 'DEVOLVIDO' && (
                        <TextInput
                          size="xs"
                          placeholder="Motivo..."
                          value={nf.motivoDevolucao}
                          onChange={(e) => updateNfEntrega(idx, 'motivoDevolucao', e.currentTarget.value)}
                        />
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            <Group justify="flex-end">
              <Button variant="default" onClick={() => { setFecharModal(null); setNfsEntrega([]) }}>
                Voltar
              </Button>
              <Button color="green" onClick={handleFechar} loading={fechar.isPending}>
                Confirmar Fechamento
              </Button>
            </Group>
          </Stack>
        </Modal>

        {/* Modal Detalhe / Romaneio */}
        <Modal
          opened={!!detalheModal}
          onClose={() => setDetalheModal(null)}
          title={`Mapa de Carregamento nº ${detalheModal?.numero || ''}`}
          centered
          size="lg"
        >
          {detalheModal && (
            <Stack gap="md">
              <SimpleGrid cols={2}>
                <div>
                  <Text size="xs" c="dimmed">Placa</Text>
                  <Text size="sm" fw={500}>{detalheModal.veiculoPlaca}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Motorista</Text>
                  <Text size="sm" fw={500}>{detalheModal.motorista || '-'}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">CPF</Text>
                  <Text size="sm" fw={500}>{detalheModal.motoristaCpf || '-'}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Status</Text>
                  <Badge color={statusColors[detalheModal.status] || 'gray'} variant="light">
                    {statusLabels[detalheModal.status] || detalheModal.status}
                  </Badge>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Emissão</Text>
                  <Text size="sm">{detalheModal.emissaoEm ? new Date(detalheModal.emissaoEm).toLocaleDateString('pt-BR') : '-'}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">Observações</Text>
                  <Text size="sm">{detalheModal.observacoes || '-'}</Text>
                </div>
              </SimpleGrid>

              {/* Distância Total card — shown when sequence exists */}
              {detalheModal.sequenciaEntrega && detalheModal.sequenciaEntrega.length > 0 && detalheModal.distanciaTotalKm != null && (
                <Card withBorder padding="sm">
                  <Group gap="xs">
                    <ThemeIcon color="blue" variant="light" size="sm">
                      <IconRoute size={14} />
                    </ThemeIcon>
                    <Text size="sm" fw={500}>Distância Total do Percurso:</Text>
                    <Badge size="lg" color="blue">
                      {Number(detalheModal.distanciaTotalKm).toFixed(2)} km
                    </Badge>
                  </Group>
                </Card>
              )}

              <Text size="sm" fw={500}>NFs do Mapa</Text>

              {/* Romaneio with sequence: show Ordem + Distância columns, NFs in sequence order */}
              {detalheModal.sequenciaEntrega && detalheModal.sequenciaEntrega.length > 0 ? (
                <Table withTableBorder striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Ordem</Table.Th>
                      <Table.Th>NF</Table.Th>
                      <Table.Th>Cliente</Table.Th>
                      <Table.Th>Distância Parcial (km)</Table.Th>
                      <Table.Th>Status Entrega</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {(detalheModal.sequenciaEntrega as SequenciaEntrega[])
                      .slice()
                      .sort((a, b) => a.ordem - b.ordem)
                      .map((item) => {
                        const nfMatch = (detalheModal.nfs || []).find(
                          (nf: any) => (nf.nfeId || nf.id) === item.nfeId
                        )
                        return (
                          <Table.Tr key={item.nfeId}>
                            <Table.Td fw={600}>{item.ordem}</Table.Td>
                            <Table.Td>
                              {nfMatch?.nfe?.numero || nfMatch?.nfe?.nNF || '-'}
                            </Table.Td>
                            <Table.Td>{item.clienteRazaoSocial}</Table.Td>
                            <Table.Td>
                              {item.distanciaParcialKm != null
                                ? `${Number(item.distanciaParcialKm).toFixed(2)} km`
                                : '—'}
                            </Table.Td>
                            <Table.Td>
                              {nfMatch?.statusEntrega ? (
                                <Badge
                                  color={nfMatch.statusEntrega === 'ENTREGUE' ? 'green' : 'red'}
                                  variant="light"
                                >
                                  {nfMatch.statusEntrega}
                                </Badge>
                              ) : (
                                <Text size="sm" c="dimmed">Pendente</Text>
                              )}
                            </Table.Td>
                          </Table.Tr>
                        )
                      })}
                  </Table.Tbody>
                </Table>
              ) : (
                /* Romaneio without sequence: original order, no Ordem/Distância columns */
                <Table withTableBorder striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>NF</Table.Th>
                      <Table.Th>Cliente</Table.Th>
                      <Table.Th>Status Entrega</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {(detalheModal.nfs || []).map((nf: any, idx: number) => (
                      <Table.Tr key={idx}>
                        <Table.Td>{nf.nfe?.numero || nf.nfe?.nNF || '-'}</Table.Td>
                        <Table.Td>{nf.nfe?.vendaEfetivada?.pedidoVenda?.cliente?.razaoSocial || '-'}</Table.Td>
                        <Table.Td>
                          {nf.statusEntrega ? (
                            <Badge
                              color={nf.statusEntrega === 'ENTREGUE' ? 'green' : 'red'}
                              variant="light"
                            >
                              {nf.statusEntrega}
                            </Badge>
                          ) : (
                            <Text size="sm" c="dimmed">Pendente</Text>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                    {(detalheModal.nfs || []).length === 0 && (
                      <Table.Tr>
                        <Table.Td colSpan={3} className="text-center py-4 text-zinc-500">
                          Nenhuma NF associada
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              )}

              {/* Otimizar Rota Panel */}
              <OtimizarRotaPanel
                mapaId={detalheModal.id}
                status={detalheModal.status}
                nfs={(detalheModal.nfs || []).map((nf: any) => ({
                  nfeId: nf.nfeId || nf.id,
                }))}
              />

              <Group justify="flex-end">
                <Button variant="default" onClick={() => setDetalheModal(null)}>
                  Fechar
                </Button>
              </Group>
            </Stack>
          )}
        </Modal>
      </Stack>
    </div>
  )
}
