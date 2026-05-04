'use client'

import { useState } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, Tabs, LoadingOverlay,
  NumberInput, Alert, Modal, Select, SimpleGrid, ThemeIcon, ActionIcon, Tooltip,
} from '@mantine/core'
import {
  IconCheck, IconX, IconRefresh, IconClipboardCheck, IconAlertCircle,
  IconPackage, IconPlayerPlay,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const statusColors: Record<string, string> = {
  SEPARADA: 'grape', EM_CONFERENCIA: 'blue', APROVADA: 'green', REJEITADA: 'red',
  CONFERIDA: 'teal', EMBALADA: 'cyan',
}

export default function ConferenciaSaidaPage() {
  useModuloGuard('WMS')
  const queryClient = useQueryClient()

  const [conferindo, setConferindo] = useState<any>(null)
  const [itensConferidos, setItensConferidos] = useState<Record<string, number>>({})
  const [conferenteId, setConferenteId] = useState<string | null>(null)
  const [iniciarModal, setIniciarModal] = useState(false)
  const [ondaParaConferir, setOndaParaConferir] = useState<any>(null)

  // Ondas separadas (prontas para conferência de saída)
  const { data: ondasResp, isLoading, refetch } = useQuery<any>({
    queryKey: ['ondas-conf-saida'],
    queryFn: async () => { const { data } = await api.get('/ondas-separacao', { params: { limit: 50 } }); return data },
  })

  // Funcionários
  const { data: funcResp } = useQuery<any>({
    queryKey: ['conf-saida-func'],
    queryFn: async () => { const { data } = await api.get('/funcionarios', { params: { limit: 50 } }); return data },
    enabled: iniciarModal,
  })

  // Criar conferência
  const criarConferencia = useMutation({
    mutationFn: async () => {
      if (!ondaParaConferir || !conferenteId) throw new Error('Selecione um conferente')
      const { data } = await api.post('/conferencias-saida', {
        ondaSeparacaoId: ondaParaConferir.id,
        conferenteId,
      })
      return data
    },
    onSuccess: async (confData) => {
      setIniciarModal(false)
      // Buscar detalhe da onda com itens
      const { data: ondaDetalhe } = await api.get(`/ondas-separacao/${ondaParaConferir.id}`)
      setConferindo({ conferencia: confData, onda: ondaDetalhe })
      setItensConferidos({})
      setOndaParaConferir(null)
      setConferenteId(null)
      notifications.show({ title: '✅ Conferência iniciada', message: 'Informe as quantidades conferidas', color: 'green' })
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' }) },
  })

  // Conferir item
  const conferirItem = useMutation({
    mutationFn: async ({ itemId, quantidade }: { itemId: string; quantidade: number }) => {
      if (!conferindo) throw new Error('Sem conferência')
      const { data } = await api.patch(`/conferencias-saida/${conferindo.conferencia.id}/itens/${itemId}`, {
        quantidadeConferida: quantidade,
      })
      return data
    },
    onSuccess: (data) => {
      setItensConferidos((prev) => ({ ...prev, [data.itemSeparacaoId]: data.quantidadeConferida }))
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' }) },
  })

  // Aprovar
  const aprovar = useMutation({
    mutationFn: async () => {
      if (!conferindo) throw new Error('Sem conferência')
      const { data } = await api.patch(`/conferencias-saida/${conferindo.conferencia.id}/aprovar`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ondas-conf-saida'] })
      setConferindo(null)
      notifications.show({ title: '✅ Conferência aprovada', message: 'Onda pronta para embalagem', color: 'green' })
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' }) },
  })

  // Rejeitar
  const rejeitar = useMutation({
    mutationFn: async () => {
      if (!conferindo) throw new Error('Sem conferência')
      const { data } = await api.patch(`/conferencias-saida/${conferindo.conferencia.id}/rejeitar`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ondas-conf-saida'] })
      setConferindo(null)
      notifications.show({ title: 'Conferência rejeitada', message: 'Onda retornou para separação', color: 'orange' })
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' }) },
  })

  const ondas = ondasResp?.data || []
  const ondasSeparadas = ondas.filter((o: any) => o.status === 'SEPARADA')
  const ondasConferidas = ondas.filter((o: any) => ['CONFERIDA', 'EMBALADA'].includes(o.status))
  const funcOptions = (funcResp?.data || []).map((f: any) => ({ value: f.id, label: `${f.matricula} — ${f.nome}` }))

  // Itens da onda em conferência
  const todosItens = conferindo?.onda?.ordens?.flatMap((o: any) => o.itens) || []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Conferência de Saída</Text>
      <Text size="xl" fw={600} mb="lg">Conferência de Saída</Text>

      {!conferindo ? (
        <Card>
          <Tabs defaultValue="pendentes">
            <Tabs.List mb="md">
              <Tabs.Tab value="pendentes" leftSection={<IconClipboardCheck size={16} />}>
                Pendentes ({ondasSeparadas.length})
              </Tabs.Tab>
              <Tabs.Tab value="conferidas" leftSection={<IconCheck size={16} />}>
                Conferidas ({ondasConferidas.length})
              </Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="pendentes">
              <LoadingOverlay visible={isLoading} />
              <Group justify="flex-end" mb="sm">
                <Button variant="default" size="xs" leftSection={<IconRefresh size={14} />} onClick={() => refetch()}>Atualizar</Button>
              </Group>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Onda</Table.Th><Table.Th>Pedidos</Table.Th><Table.Th>Itens</Table.Th>
                    <Table.Th>Prioridade</Table.Th><Table.Th>Status</Table.Th><Table.Th>Ações</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {ondasSeparadas.map((onda: any) => (
                    <Table.Tr key={onda.id}>
                      <Table.Td fw={600}>#{onda.numero}</Table.Td>
                      <Table.Td>{onda.totalPedidos || 0}</Table.Td>
                      <Table.Td>{onda.progresso?.totalItens || 0}</Table.Td>
                      <Table.Td><Badge variant="light" color={onda.prioridade === 'ALTA' ? 'red' : onda.prioridade === 'MEDIA' ? 'yellow' : 'gray'}>{onda.prioridade}</Badge></Table.Td>
                      <Table.Td><Badge color="grape" variant="light">SEPARADA</Badge></Table.Td>
                      <Table.Td>
                        <Button size="xs" variant="light" leftSection={<IconPlayerPlay size={14} />}
                          onClick={() => { setOndaParaConferir(onda); setIniciarModal(true) }}>
                          Iniciar Conferência
                        </Button>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                  {ondasSeparadas.length === 0 && (
                    <Table.Tr><Table.Td colSpan={6} className="text-center py-8 text-zinc-500">Nenhuma onda aguardando conferência</Table.Td></Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </Tabs.Panel>

            <Tabs.Panel value="conferidas">
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Onda</Table.Th><Table.Th>Pedidos</Table.Th><Table.Th>Itens</Table.Th>
                    <Table.Th>Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {ondasConferidas.map((onda: any) => (
                    <Table.Tr key={onda.id}>
                      <Table.Td fw={600}>#{onda.numero}</Table.Td>
                      <Table.Td>{onda.totalPedidos || 0}</Table.Td>
                      <Table.Td>{onda.progresso?.totalItens || 0}</Table.Td>
                      <Table.Td><Badge color={statusColors[onda.status] || 'gray'} variant="light">{onda.status}</Badge></Table.Td>
                    </Table.Tr>
                  ))}
                  {ondasConferidas.length === 0 && (
                    <Table.Tr><Table.Td colSpan={4} className="text-center py-8 text-zinc-500">Nenhuma onda conferida</Table.Td></Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </Tabs.Panel>
          </Tabs>
        </Card>
      ) : (
        /* Tela de conferência */
        <>
          <Alert icon={<IconClipboardCheck size={16} />} color="blue" variant="light" mb="md">
            <Text fw={600}>Conferência de Saída — Onda #{conferindo.onda.numero}</Text>
            <Text size="sm">Verifique as quantidades separadas para cada item</Text>
          </Alert>

          <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
            <Card withBorder>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Total Itens</Text>
              <Text size="xl" fw={700}>{todosItens.length}</Text>
            </Card>
            <Card withBorder>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Conferidos</Text>
              <Text size="xl" fw={700} c="green">{Object.keys(itensConferidos).length}</Text>
            </Card>
            <Card withBorder>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Pendentes</Text>
              <Text size="xl" fw={700} c="orange">{todosItens.length - Object.keys(itensConferidos).length}</Text>
            </Card>
          </SimpleGrid>

          <Card mb="md">
            <Table striped withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Produto</Table.Th>
                  <Table.Th>Endereço Origem</Table.Th>
                  <Table.Th>Qtd Solicitada</Table.Th>
                  <Table.Th>Qtd Separada</Table.Th>
                  <Table.Th>Qtd Conferida</Table.Th>
                  <Table.Th>Ação</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {todosItens.map((item: any) => (
                  <Table.Tr key={item.id} bg={itensConferidos[item.id] !== undefined ? 'green.0' : undefined}>
                    <Table.Td fw={500}>{item.produto ? `${item.produto.codigo} - ${item.produto.nome}` : item.produtoId?.substring(0, 8)}</Table.Td>
                    <Table.Td className="font-mono text-sm">{item.enderecoOrigem?.enderecoCompleto ?? item.enderecoOrigemId?.substring(0, 8)}</Table.Td>
                    <Table.Td>{Number(item.quantidadeSolicitada)}</Table.Td>
                    <Table.Td fw={500}>{Number(item.quantidadeSeparada)}</Table.Td>
                    <Table.Td>
                      {itensConferidos[item.id] !== undefined ? (
                        <Text fw={600} c="green">{itensConferidos[item.id]}</Text>
                      ) : (
                        <NumberInput size="xs" min={0} placeholder="Qtd" className="w-24"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const input = e.currentTarget as HTMLInputElement
                              const val = Number(input.value)
                              if (!isNaN(val)) conferirItem.mutate({ itemId: item.id, quantidade: val })
                            }
                          }} />
                      )}
                    </Table.Td>
                    <Table.Td>
                      {itensConferidos[item.id] === undefined && (
                        <Button size="xs" variant="light" onClick={() => {
                          conferirItem.mutate({ itemId: item.id, quantidade: Number(item.quantidadeSeparada) })
                        }}>OK</Button>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>

          <Group justify="space-between">
            <Button variant="default" onClick={() => setConferindo(null)}>Cancelar</Button>
            <Group>
              <Button color="red" variant="light" leftSection={<IconX size={16} />}
                onClick={() => { if (confirm('Rejeitar conferência?')) rejeitar.mutate() }}
                loading={rejeitar.isPending}>
                Rejeitar
              </Button>
              <Button color="green" leftSection={<IconCheck size={16} />}
                onClick={() => aprovar.mutate()} loading={aprovar.isPending}
                disabled={Object.keys(itensConferidos).length === 0}>
                Aprovar Conferência
              </Button>
            </Group>
          </Group>
        </>
      )}

      {/* Modal Selecionar Conferente */}
      <Modal opened={iniciarModal} onClose={() => { setIniciarModal(false); setOndaParaConferir(null) }}
        title={`Conferência — Onda #${ondaParaConferir?.numero}`} centered>
        <Select label="Conferente *" data={funcOptions} value={conferenteId} onChange={setConferenteId}
          searchable placeholder="Selecione o conferente..." mb="md" />
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setIniciarModal(false)}>Cancelar</Button>
          <Button onClick={() => criarConferencia.mutate()} loading={criarConferencia.isPending}
            disabled={!conferenteId} leftSection={<IconPlayerPlay size={16} />}>
            Iniciar
          </Button>
        </Group>
      </Modal>
    </div>
  )
}
