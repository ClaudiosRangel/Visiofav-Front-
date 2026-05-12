'use client'

import { useEffect, useState } from 'react'
import { Card, Group, Text, Table, Badge, Button, Tabs, LoadingOverlay, Modal } from '@mantine/core'
import { IconMapPin, IconCheck, IconRefresh, IconArrowRight, IconMap2 } from '@tabler/icons-react'
import Link from 'next/link'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const statusColors: Record<string, string> = {
  CONFERIDA: 'green', ENDERECADA: 'teal', PENDENTE: 'orange', EM_CONFERENCIA: 'blue',
}

export default function EnderecamentoPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - Endereçamento' }, [])
  const queryClient = useQueryClient()

  // Notas conferidas (prontas para endereçar)
  const { data: conferidasResp, isLoading: loadConf, refetch: refetchConf } = useQuery<any>({
    queryKey: ['enderecamento-conferidas'],
    queryFn: async () => { const { data } = await api.get('/conferencia-entrada/notas-conferidas'); return data },
  })

  // Notas endereçadas
  const { data: enderecadasResp, isLoading: loadEnd, refetch: refetchEnd } = useQuery<any>({
    queryKey: ['enderecamento-enderecadas'],
    queryFn: async () => {
      const { data } = await api.get('/conferencia-entrada/notas-enderecadas')
      return data
    },
  })

  // Usar o mesmo endpoint para a lista de endereçadas
  const notasEnderecadasResp = enderecadasResp

  // Endereçamento automático — 2 etapas: simular → confirmar
  const [simulacaoData, setSimulacaoData] = useState<any>(null)
  const [simulacaoNotaId, setSimulacaoNotaId] = useState<string | null>(null)

  const simularEnderecamento = useMutation({
    mutationFn: async (notaId: string) => { const { data } = await api.post(`/conferencia-entrada/enderecamento-automatico/${notaId}`, { confirmar: false }); return data },
    onSuccess: (data, notaId) => {
      setSimulacaoData(data)
      setSimulacaoNotaId(notaId)
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao simular', color: 'red' }) },
  })

  const confirmarEnderecamento = useMutation({
    mutationFn: async (notaId: string) => { const { data } = await api.post(`/conferencia-entrada/enderecamento-automatico/${notaId}`, { confirmar: true }); return data },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['enderecamento-conferidas'] })
      queryClient.invalidateQueries({ queryKey: ['notas-enderecadas'] })
      notifications.show({ title: '✅ Endereçamento concluído', message: `${data.itens?.length || 0} posições endereçadas`, color: 'green' })
      setSimulacaoData(null)
      setSimulacaoNotaId(null)
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao confirmar', color: 'red' }) },
  })

  const conferidas = conferidasResp?.data || []
  const enderecadas = notasEnderecadasResp?.data || []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Endereçamento</Text>
      <Group justify="space-between" mb="lg">
        <Text size="xl" fw={600}>Endereçamento</Text>
        <Link href="/wms/mapa-armazem">
          <Button variant="light" color="grape" leftSection={<IconMap2 size={16} />}>
            Mapa do Armazém
          </Button>
        </Link>
      </Group>

      <Card>
        <Tabs defaultValue="enderecar">
          <Tabs.List mb="md">
            <Tabs.Tab value="enderecar" leftSection={<IconMapPin size={16} />}>
              Endereçar ({conferidas.length})
            </Tabs.Tab>
            <Tabs.Tab value="enderecadas" leftSection={<IconCheck size={16} />}>
              Endereçadas ({enderecadas.length})
            </Tabs.Tab>
          </Tabs.List>

          {/* ABA ENDEREÇAR */}
          <Tabs.Panel value="enderecar">
            <LoadingOverlay visible={loadConf} />
            <Group justify="space-between" mb="sm">
              <Text fw={500}>Notas conferidas prontas para endereçamento</Text>
              <Button variant="default" size="xs" leftSection={<IconRefresh size={14} />} onClick={() => refetchConf()}>Atualizar</Button>
            </Group>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>NF</Table.Th><Table.Th>Fornecedor</Table.Th><Table.Th>Itens</Table.Th><Table.Th>Status</Table.Th><Table.Th>Ações</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {conferidas.map((nota: any) => (
                  <Table.Tr key={nota.id}>
                    <Table.Td fw={500}>{nota.numero}</Table.Td>
                    <Table.Td>{nota.fornecedor || '—'}</Table.Td>
                    <Table.Td>{nota.itens?.length || 0}</Table.Td>
                    <Table.Td><Badge color="green" variant="light">CONFERIDA</Badge></Table.Td>
                    <Table.Td>
                      <Button size="xs" variant="light" color="teal" leftSection={<IconArrowRight size={14} />}
                        onClick={() => simularEnderecamento.mutate(nota.id)} loading={simularEnderecamento.isPending}>
                        Endereçar Automático
                      </Button>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {conferidas.length === 0 && (
                  <Table.Tr><Table.Td colSpan={5} className="text-center py-8 text-zinc-500">Nenhuma nota aguardando endereçamento</Table.Td></Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Tabs.Panel>

          {/* ABA ENDEREÇADAS */}
          <Tabs.Panel value="enderecadas">
            <LoadingOverlay visible={loadEnd} />
            <Group justify="space-between" mb="sm">
              <Text fw={500}>Notas já endereçadas</Text>
              <Button variant="default" size="xs" leftSection={<IconRefresh size={14} />} onClick={() => refetchEnd()}>Atualizar</Button>
            </Group>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>NF</Table.Th><Table.Th>Fornecedor</Table.Th><Table.Th>Itens</Table.Th><Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {enderecadas.map((nota: any) => (
                  <Table.Tr key={nota.id}>
                    <Table.Td fw={500}>{nota.numero}</Table.Td>
                    <Table.Td>{nota.fornecedor || '—'}</Table.Td>
                    <Table.Td>{nota.itens?.length || 0}</Table.Td>
                    <Table.Td><Badge color="teal" variant="light">ENDEREÇADA</Badge></Table.Td>
                  </Table.Tr>
                ))}
                {enderecadas.length === 0 && (
                  <Table.Tr><Table.Td colSpan={4} className="text-center py-8 text-zinc-500">Nenhuma nota endereçada</Table.Td></Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Tabs.Panel>
        </Tabs>
      </Card>

      {/* Modal de Confirmação de Endereçamento */}
      <Modal
        opened={!!simulacaoData}
        onClose={() => { setSimulacaoData(null); setSimulacaoNotaId(null) }}
        title="Confirmar Endereçamento Automático"
        size="lg"
        centered
      >
        {simulacaoData && (
          <div>
            <Text size="sm" c="dimmed" mb="md">
              Revise a distribuição proposta e confirme para gravar no estoque:
            </Text>

            {(simulacaoData.distribuicoes || []).map((dist: any, idx: number) => (
              <Card key={idx} withBorder mb="sm" padding="sm">
                <Text fw={500} size="sm" mb="xs">{dist.produto}</Text>
                <Table striped size="sm">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Endereço</Table.Th>
                      <Table.Th style={{ textAlign: 'right' }}>Quantidade</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {(dist.alocacoes || []).map((a: any, i: number) => (
                      <Table.Tr key={i}>
                        <Table.Td>{a.enderecoCompleto}</Table.Td>
                        <Table.Td style={{ textAlign: 'right' }}>
                          <Badge color="teal" variant="light">{a.quantidadeAlocada}</Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
                {dist.quantidadeRestante > 0 && (
                  <Text size="sm" c="red" mt="xs">⚠️ {dist.quantidadeRestante} un sem endereço disponível</Text>
                )}
              </Card>
            ))}

            <Group justify="flex-end" mt="md">
              <Button variant="default" onClick={() => { setSimulacaoData(null); setSimulacaoNotaId(null) }}>
                Cancelar
              </Button>
              <Button
                color="teal"
                leftSection={<IconCheck size={16} />}
                onClick={() => simulacaoNotaId && confirmarEnderecamento.mutate(simulacaoNotaId)}
                loading={confirmarEnderecamento.isPending}
              >
                Confirmar Endereçamento
              </Button>
            </Group>
          </div>
        )}
      </Modal>
    </div>
  )
}
