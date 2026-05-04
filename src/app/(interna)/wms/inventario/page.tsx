'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, Select, NumberInput,
  LoadingOverlay, Alert, SimpleGrid, ThemeIcon, Tabs, Progress, Modal,
} from '@mantine/core'
import {
  IconClipboardList, IconCheck, IconRefresh, IconAlertCircle,
  IconArrowRight, IconPlus, IconHistory,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const statusColors: Record<string, string> = {
  ABERTO: 'blue', EM_CONTAGEM: 'orange', CONCLUIDO: 'green', CANCELADO: 'red',
}

export default function InventarioPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - Inventário' }, [])
  const queryClient = useQueryClient()

  const [inventarioAtivo, setInventarioAtivo] = useState<any>(null)
  const [itensContagem, setItensContagem] = useState<Record<string, number>>({})
  const [criarModal, setCriarModal] = useState(false)
  const [tipo, setTipo] = useState<string | null>('GERAL')

  // Lista de inventários
  const { data: inventariosResp, isLoading: loadList } = useQuery<any>({
    queryKey: ['inventarios'],
    queryFn: async () => { const { data } = await api.get('/inventarios', { params: { limit: 20 } }); return data },
  })

  // Detalhe do inventário ativo
  const { data: detalheResp, isLoading: loadDetalhe, refetch: refetchDetalhe } = useQuery<any>({
    queryKey: ['inventario-detalhe', inventarioAtivo?.id],
    queryFn: async () => { const { data } = await api.get(`/inventarios/${inventarioAtivo.id}`); return data },
    enabled: !!inventarioAtivo,
  })

  // Criar inventário
  const criarInventario = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/inventarios', { tipo: tipo || 'GERAL' })
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inventarios'] })
      setCriarModal(false)
      setInventarioAtivo(data)
      setItensContagem({})
      notifications.show({ title: '✅ Inventário criado', message: `#${data.numero} — ${data.totalItens} itens`, color: 'green' })
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' }) },
  })

  // Registrar contagem de todos
  const contarTodos = useMutation({
    mutationFn: async () => {
      if (!inventarioAtivo) throw new Error('Sem inventário')
      const itens = Object.entries(itensContagem).map(([itemId, saldoContado]) => ({ itemId, saldoContado }))
      if (itens.length === 0) throw new Error('Nenhum item contado')
      const { data } = await api.patch(`/inventarios/${inventarioAtivo.id}/contar-todos`, { itens })
      return data
    },
    onSuccess: (data) => {
      refetchDetalhe()
      notifications.show({ title: '✅ Contagem registrada', message: `${data.conformes} conformes, ${data.divergentes} divergentes`, color: 'green' })
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' }) },
  })

  // Aplicar ajustes
  const aplicarAjustes = useMutation({
    mutationFn: async () => {
      if (!inventarioAtivo) throw new Error('Sem inventário')
      const { data } = await api.patch(`/inventarios/${inventarioAtivo.id}/aplicar-ajustes`)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['inventarios'] })
      queryClient.invalidateQueries({ queryKey: ['inventario-detalhe'] })
      notifications.show({ title: '✅ Inventário concluído', message: `${data.ajustesAplicados} ajuste(s) aplicado(s)`, color: 'green' })
      setInventarioAtivo(null)
      setItensContagem({})
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' }) },
  })

  // Concluir sem ajustes
  const concluirSemAjuste = useMutation({
    mutationFn: async () => {
      if (!inventarioAtivo) throw new Error('Sem inventário')
      const { data } = await api.patch(`/inventarios/${inventarioAtivo.id}/concluir`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventarios'] })
      notifications.show({ title: '✅ Inventário concluído', message: 'Sem divergências', color: 'green' })
      setInventarioAtivo(null)
      setItensContagem({})
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' }) },
  })

  const inventarios = inventariosResp?.data || []
  const detalhe = detalheResp
  const itens = detalhe?.itens || []
  const resumo = detalhe?.resumo || {}

  const contados = Object.keys(itensContagem).length
  const totalItens = itens.length
  const progresso = totalItens > 0 ? Math.round((contados / totalItens) * 100) : 0

  function abrirInventario(inv: any) {
    setInventarioAtivo(inv)
    setItensContagem({})
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Inventário</Text>
      <Text size="xl" fw={600} mb="lg">Inventário / Contagem Cíclica</Text>

      {!inventarioAtivo ? (
        /* Lista de inventários */
        <Card>
          <Tabs defaultValue="novo">
            <Tabs.List mb="md">
              <Tabs.Tab value="novo" leftSection={<IconPlus size={16} />}>Novo Inventário</Tabs.Tab>
              <Tabs.Tab value="historico" leftSection={<IconHistory size={16} />}>Histórico ({inventarios.length})</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="novo">
              <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
                <Card withBorder>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Inventários Abertos</Text>
                  <Text size="xl" fw={700} c="blue">{inventarios.filter((i: any) => ['ABERTO', 'EM_CONTAGEM'].includes(i.status)).length}</Text>
                </Card>
                <Card withBorder>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Concluídos</Text>
                  <Text size="xl" fw={700} c="green">{inventarios.filter((i: any) => i.status === 'CONCLUIDO').length}</Text>
                </Card>
                <Card withBorder>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Total</Text>
                  <Text size="xl" fw={700}>{inventarios.length}</Text>
                </Card>
              </SimpleGrid>

              <Card withBorder>
                <Text fw={600} mb="md">Iniciar Novo Inventário</Text>
                <Text size="sm" c="dimmed" mb="md">
                  O inventário irá gerar uma lista de todos os endereços com saldo para contagem.
                  Após a contagem, as divergências serão identificadas e você poderá aplicar os ajustes.
                </Text>
                <Button size="lg" leftSection={<IconClipboardList size={20} />} onClick={() => setCriarModal(true)}>
                  Criar Inventário
                </Button>
              </Card>

              {/* Inventários abertos */}
              {inventarios.filter((i: any) => ['ABERTO', 'EM_CONTAGEM'].includes(i.status)).length > 0 && (
                <>
                  <Text fw={600} mt="xl" mb="sm">Inventários em Andamento</Text>
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>#</Table.Th><Table.Th>Tipo</Table.Th><Table.Th>Itens</Table.Th>
                        <Table.Th>Status</Table.Th><Table.Th>Criado em</Table.Th><Table.Th>Ações</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {inventarios.filter((i: any) => ['ABERTO', 'EM_CONTAGEM'].includes(i.status)).map((inv: any) => (
                        <Table.Tr key={inv.id}>
                          <Table.Td fw={600}>#{inv.numero}</Table.Td>
                          <Table.Td><Badge variant="light">{inv.tipo}</Badge></Table.Td>
                          <Table.Td>{inv.totalItens || inv._count?.itens || 0}</Table.Td>
                          <Table.Td><Badge color={statusColors[inv.status] || 'gray'}>{inv.status}</Badge></Table.Td>
                          <Table.Td>{new Date(inv.criadoEm).toLocaleDateString('pt-BR')}</Table.Td>
                          <Table.Td>
                            <Button size="xs" variant="light" onClick={() => abrirInventario(inv)}>
                              Continuar
                            </Button>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </>
              )}
            </Tabs.Panel>

            <Tabs.Panel value="historico">
              <LoadingOverlay visible={loadList} />
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>#</Table.Th><Table.Th>Tipo</Table.Th><Table.Th>Itens</Table.Th>
                    <Table.Th>Status</Table.Th><Table.Th>Criado em</Table.Th><Table.Th>Concluído em</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {inventarios.map((inv: any) => (
                    <Table.Tr key={inv.id}>
                      <Table.Td fw={600}>#{inv.numero}</Table.Td>
                      <Table.Td><Badge variant="light">{inv.tipo}</Badge></Table.Td>
                      <Table.Td>{inv.totalItens || 0}</Table.Td>
                      <Table.Td><Badge color={statusColors[inv.status] || 'gray'}>{inv.status}</Badge></Table.Td>
                      <Table.Td>{new Date(inv.criadoEm).toLocaleDateString('pt-BR')}</Table.Td>
                      <Table.Td>{inv.concluidoEm ? new Date(inv.concluidoEm).toLocaleDateString('pt-BR') : '—'}</Table.Td>
                    </Table.Tr>
                  ))}
                  {inventarios.length === 0 && (
                    <Table.Tr><Table.Td colSpan={6} className="text-center py-8 text-zinc-500">Nenhum inventário</Table.Td></Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </Tabs.Panel>
          </Tabs>
        </Card>
      ) : (
        /* Tela de contagem */
        <>
          <Card mb="md">
            <Group justify="space-between" mb="sm">
              <div>
                <Text fw={600}>Inventário #{detalhe?.numero || inventarioAtivo.numero}</Text>
                <Text size="sm" c="dimmed">Tipo: {detalhe?.tipo || inventarioAtivo.tipo} | Status: {detalhe?.status || inventarioAtivo.status}</Text>
              </div>
              <Badge size="lg">{resumo.contados || contados} / {resumo.total || totalItens} contados</Badge>
            </Group>
            <Progress value={detalhe?.status === 'EM_CONTAGEM' ? Math.round(((resumo.contados || 0) / (resumo.total || 1)) * 100) : progresso}
              size="lg" mb="sm" color={progresso === 100 || resumo.contados === resumo.total ? 'green' : 'blue'} />
          </Card>

          {/* Resultado se já contado */}
          {detalhe?.status === 'EM_CONTAGEM' && resumo.contados === resumo.total && (
            <>
              <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
                <Card withBorder>
                  <Group justify="space-between">
                    <div><Text size="xs" c="dimmed" tt="uppercase" fw={600}>Total</Text><Text size="xl" fw={700}>{resumo.total}</Text></div>
                    <ThemeIcon color="blue" variant="light" size={40} radius="md"><IconClipboardList size={20} /></ThemeIcon>
                  </Group>
                </Card>
                <Card withBorder>
                  <Group justify="space-between">
                    <div><Text size="xs" c="dimmed" tt="uppercase" fw={600}>Conformes</Text><Text size="xl" fw={700} c="green">{resumo.conformes}</Text></div>
                    <ThemeIcon color="green" variant="light" size={40} radius="md"><IconCheck size={20} /></ThemeIcon>
                  </Group>
                </Card>
                <Card withBorder>
                  <Group justify="space-between">
                    <div><Text size="xs" c="dimmed" tt="uppercase" fw={600}>Divergentes</Text><Text size="xl" fw={700} c="red">{resumo.divergentes}</Text></div>
                    <ThemeIcon color="red" variant="light" size={40} radius="md"><IconAlertCircle size={20} /></ThemeIcon>
                  </Group>
                </Card>
              </SimpleGrid>

              {resumo.divergentes > 0 && (
                <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" mb="md">
                  {resumo.divergentes} item(ns) com divergência. Ao aplicar ajustes, o estoque será corrigido automaticamente.
                </Alert>
              )}
            </>
          )}

          {/* Tabela de itens */}
          <Card mb="md" pos="relative">
            <LoadingOverlay visible={loadDetalhe} />
            <Table striped withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Endereço</Table.Th><Table.Th>Código</Table.Th><Table.Th>Produto</Table.Th>
                  {detalhe?.status === 'EM_CONTAGEM' && resumo.contados === resumo.total ? (
                    <><Table.Th>Sistema</Table.Th><Table.Th>Contado</Table.Th><Table.Th>Divergência</Table.Th></>
                  ) : (
                    <Table.Th>Qtd Contada</Table.Th>
                  )}
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {itens.map((item: any) => (
                  <Table.Tr key={item.id} bg={item.status === 'DIVERGENTE' ? 'red.0' : item.status === 'CONFORME' ? 'green.0' : undefined}>
                    <Table.Td className="font-mono">{item.endereco?.enderecoCompleto || '—'}</Table.Td>
                    <Table.Td className="font-mono">{item.produto?.codigo || '—'}</Table.Td>
                    <Table.Td>{item.produto?.nome || '—'}</Table.Td>
                    {detalhe?.status === 'EM_CONTAGEM' && resumo.contados === resumo.total ? (
                      <>
                        <Table.Td>{item.saldoSistema}</Table.Td>
                        <Table.Td fw={600}>{item.saldoContado}</Table.Td>
                        <Table.Td>
                          <Text fw={600} c={item.divergencia === 0 ? 'green' : 'red'}>
                            {item.divergencia !== null ? (item.divergencia > 0 ? `+${item.divergencia}` : item.divergencia) : '—'}
                          </Text>
                        </Table.Td>
                      </>
                    ) : (
                      <Table.Td>
                        {item.saldoContado !== null ? (
                          <Text fw={600}>{item.saldoContado}</Text>
                        ) : (
                          <NumberInput size="xs" min={0} value={itensContagem[item.id] ?? ''} placeholder="Contar"
                            onChange={(v) => setItensContagem({ ...itensContagem, [item.id]: typeof v === 'number' ? v : 0 })} className="w-28" />
                        )}
                      </Table.Td>
                    )}
                    <Table.Td>
                      <Badge color={item.status === 'CONFORME' ? 'green' : item.status === 'DIVERGENTE' ? 'red' : item.status === 'CONTADO' ? 'blue' : 'gray'} variant="light">
                        {item.status}
                      </Badge>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>

          {/* Ações */}
          <Group justify="space-between">
            <Button variant="default" onClick={() => { setInventarioAtivo(null); setItensContagem({}) }}>← Voltar</Button>
            <Group>
              {detalhe?.status !== 'EM_CONTAGEM' || resumo.contados < resumo.total ? (
                <Button color="blue" leftSection={<IconArrowRight size={16} />}
                  onClick={() => contarTodos.mutate()} loading={contarTodos.isPending}
                  disabled={Object.keys(itensContagem).length === 0}>
                  Registrar Contagem ({Object.keys(itensContagem).length})
                </Button>
              ) : resumo.divergentes === 0 ? (
                <Button color="green" leftSection={<IconCheck size={16} />}
                  onClick={() => concluirSemAjuste.mutate()} loading={concluirSemAjuste.isPending}>
                  Concluir Inventário
                </Button>
              ) : (
                <Button color="green" leftSection={<IconCheck size={16} />}
                  onClick={() => aplicarAjustes.mutate()} loading={aplicarAjustes.isPending}>
                  Aplicar Ajustes ({resumo.divergentes})
                </Button>
              )}
            </Group>
          </Group>
        </>
      )}

      {/* Modal Criar Inventário */}
      <Modal opened={criarModal} onClose={() => setCriarModal(false)} title="Novo Inventário" centered>
        <Select label="Tipo" data={[
          { value: 'GERAL', label: 'Geral (todos os endereços)' },
          { value: 'PARCIAL', label: 'Parcial' },
          { value: 'CICLICO', label: 'Cíclico' },
        ]} value={tipo} onChange={setTipo} mb="md" />
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setCriarModal(false)}>Cancelar</Button>
          <Button onClick={() => criarInventario.mutate()} loading={criarInventario.isPending}
            leftSection={<IconClipboardList size={16} />}>
            Criar e Iniciar
          </Button>
        </Group>
      </Modal>
    </div>
  )
}
