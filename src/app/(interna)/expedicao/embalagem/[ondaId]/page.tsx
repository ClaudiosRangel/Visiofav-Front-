'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Card, Table, Button, Badge, Grid, NumberInput, Select, Modal, MultiSelect,
  Group, Text, LoadingOverlay, Stack, Divider, Alert, Progress, SimpleGrid,
} from '@mantine/core'
import {
  IconPackage, IconPlus, IconCheck, IconArrowLeft, IconBox,
  IconUsers, IconDeviceMobile, IconClipboard, IconPrinter, IconEye,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useParams, useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

interface ProdutoInfo {
  id: string
  codigo: string
  nome: string
  unidade: string
}

interface ItemPendente {
  itemSeparacaoId: string
  produtoId: string
  pedidoVendaId: string
  quantidadeSeparada: number
  quantidadeEmbalada: number
  quantidadePendente: number
  produto: ProdutoInfo | null
}

interface PedidoPendente {
  pedidoVendaId: string
  pedidoNumero: string | null
  itens: ItemPendente[]
}

interface PendentesResponse {
  ondaId: string
  pedidos: PedidoPendente[]
  totalPendentes: number
}

interface VolumeAtivo {
  id: string
  codigo: number
  tipo: string
  pedidoVendaId: string
}

export default function EmbalagemPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - Embalagem' }, [])

  const { ondaId } = useParams<{ ondaId: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [volumeAtivo, setVolumeAtivo] = useState<VolumeAtivo | null>(null)
  const [quantidades, setQuantidades] = useState<Record<string, number>>({})
  const [itensSelecionados, setItensSelecionados] = useState<Set<string>>(new Set())
  const [pedidoSelecionado, setPedidoSelecionado] = useState<string | null>(null)

  // Dual-mode: employee selection + mode
  const [modoAtivo, setModoAtivo] = useState<'selecao' | 'manual' | 'coletor'>('selecao')
  const [funcSelecionados, setFuncSelecionados] = useState<string[]>([])

  // Fetch onda details
  const { data: onda, isLoading: loadingOnda } = useQuery<any>({
    queryKey: ['onda-separacao', ondaId],
    queryFn: async () => {
      const { data } = await api.get(`/ondas-separacao/${ondaId}`)
      return data
    },
  })

  // Fetch pending items
  const { data: pendentes, isLoading: loadingPendentes } = useQuery<PendentesResponse>({
    queryKey: ['pendentes-embalagem', ondaId],
    queryFn: async () => {
      const { data } = await api.get(`/volumes/pendentes-embalagem/${ondaId}`)
      return data
    },
    enabled: modoAtivo === 'manual',
  })

  // Fetch funcionários
  const { data: funcsData } = useQuery<any>({
    queryKey: ['funcionarios-select-emb'],
    queryFn: async () => { const { data } = await api.get('/funcionarios', { params: { limit: 100 } }); return data },
    enabled: modoAtivo === 'selecao',
  })

  // Monitor data for coletor mode (5s polling)
  const { data: monitorData } = useQuery<any>({
    queryKey: ['monitor-embalagem', ondaId],
    queryFn: async () => { const { data } = await api.get(`/ondas-separacao/${ondaId}/monitor/embalagem`); return data },
    enabled: modoAtivo === 'coletor',
    refetchInterval: 5000,
  })

  const funcOptions = (funcsData?.data || []).map((f: any) => ({ value: f.id, label: f.nome || f.matricula }))

  // Pedido options for the select
  const pedidoOptions = useMemo(() => {
    if (!pendentes?.pedidos) return []
    return pendentes.pedidos.map((p) => ({
      value: p.pedidoVendaId,
      label: `Pedido #${p.pedidoNumero || p.pedidoVendaId.substring(0, 8)}`,
    }))
  }, [pendentes])

  // Items for the selected pedido
  const itensDoPedido = useMemo(() => {
    if (!pedidoSelecionado || !pendentes?.pedidos) return []
    const pedido = pendentes.pedidos.find((p) => p.pedidoVendaId === pedidoSelecionado)
    return pedido?.itens || []
  }, [pedidoSelecionado, pendentes])

  // Auto-select first pedido
  useEffect(() => {
    if (!pedidoSelecionado && pedidoOptions.length > 0) {
      setPedidoSelecionado(pedidoOptions[0].value)
    }
  }, [pedidoOptions, pedidoSelecionado])

  // Create volume mutation
  const criarVolume = useMutation({
    mutationFn: async () => {
      if (!pedidoSelecionado) throw new Error('Selecione um pedido')
      const { data } = await api.post('/volumes', {
        ondaSeparacaoId: ondaId,
        pedidoVendaId: pedidoSelecionado,
        tipo: 'CAIXA',
        pesoKg: 1,
        comprimentoCm: 30,
        larguraCm: 30,
        alturaCm: 30,
      })
      return data
    },
    onSuccess: (data) => {
      setVolumeAtivo({ id: data.id, codigo: data.codigo, tipo: data.tipo, pedidoVendaId: data.pedidoVendaId })
      setItensSelecionados(new Set())
      setQuantidades({})
      notifications.show({ title: 'Volume criado', message: `Volume #${data.codigo} criado`, color: 'green' })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' })
    },
  })

  // Link items to volume mutation
  const vincularItens = useMutation({
    mutationFn: async () => {
      if (!volumeAtivo) throw new Error('Nenhum volume ativo')
      const itens = Array.from(itensSelecionados).map((itemSeparacaoId) => ({
        itemSeparacaoId,
        quantidade: quantidades[itemSeparacaoId] || 1,
      }))
      if (itens.length === 0) throw new Error('Selecione ao menos um item')
      const { data } = await api.post(`/volumes/${volumeAtivo.id}/itens`, { itens })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pendentes-embalagem', ondaId] })
      queryClient.invalidateQueries({ queryKey: ['onda-separacao', ondaId] })
      setItensSelecionados(new Set())
      setQuantidades({})
      notifications.show({ title: 'Sucesso', message: 'Itens vinculados ao volume', color: 'green' })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' })
    },
  })

  // Finalize volume
  function finalizarVolume() {
    setVolumeAtivo(null)
    setItensSelecionados(new Set())
    setQuantidades({})
    notifications.show({ title: 'Volume finalizado', message: 'Volume marcado como pronto', color: 'teal' })
  }

  // Conclude packing — redirect back
  function concluirEmbalagem() {
    notifications.show({ title: 'Embalagem concluída', message: 'Todos os itens foram embalados', color: 'green' })
    router.push('/expedicao')
  }

  function toggleItem(itemId: string) {
    const next = new Set(itensSelecionados)
    if (next.has(itemId)) next.delete(itemId)
    else next.add(itemId)
    setItensSelecionados(next)
  }

  const allPacked = pendentes?.totalPendentes === 0

  // Helper: print ficha
  async function printFicha() {
    try {
      const { data } = await api.get(`/ondas-separacao/${ondaId}/ficha-acompanhamento/embalagem`, { responseType: 'text' })
      const w = window.open('', '_blank')
      if (w) { w.document.write(data); w.document.close() }
    } catch { notifications.show({ title: 'Erro', message: 'Falha ao gerar ficha', color: 'red' }) }
  }

  // Helper: start with employees
  async function iniciarComFuncionarios(modo: 'manual' | 'coletor') {
    // Update OS with employee
    try {
      const { data: osResp } = await api.get('/os-wms', { params: { operacao: 'EMBALAGEM', limit: 10 } })
      const osVinculada = (osResp?.data || []).find((os: any) => os.ondaSeparacaoId === ondaId && ['ABERTO', 'EXECUTANDO'].includes(os.status))
      if (osVinculada && funcSelecionados.length > 0) {
        await api.patch(`/os-wms/${osVinculada.id}/iniciar`, { funcionarioIds: funcSelecionados })
      }
    } catch { /* non-blocking */ }
    setModoAtivo(modo)
  }

  // ===== MODE: SELECAO (employee + mode selection) =====
  if (modoAtivo === 'selecao') {
    return (
      <div>
        <Group mb="xs">
          <Button variant="subtle" size="xs" leftSection={<IconArrowLeft size={14} />} onClick={() => router.push('/expedicao')}>Voltar</Button>
        </Group>
        <Text size="xs" c="dimmed" mb={4}>WMS / Expedição / Embalagem</Text>
        <Text size="xl" fw={600} mb="lg">Embalagem — Onda #{onda?.numero || '...'}</Text>

        <Card withBorder maw={500}>
          <Text fw={600} mb="md">Selecione os funcionários e o modo de operação</Text>
          <MultiSelect
            label={<>Funcionário(s) <span style={{ color: 'red' }}>*</span></>}
            placeholder="Selecione..."
            data={funcOptions}
            value={funcSelecionados}
            onChange={setFuncSelecionados}
            searchable
            mb="lg"
          />
          <Group>
            <Button leftSection={<IconClipboard size={16} />} onClick={() => iniciarComFuncionarios('manual')}
              disabled={funcSelecionados.length === 0}>
              Manual (Papel)
            </Button>
            <Button leftSection={<IconDeviceMobile size={16} />} color="cyan" variant="light"
              onClick={() => iniciarComFuncionarios('coletor')}
              disabled={funcSelecionados.length === 0}>
              Coletor / App
            </Button>
          </Group>
        </Card>
      </div>
    )
  }

  // ===== MODE: COLETOR (monitoring) =====
  if (modoAtivo === 'coletor') {
    const mPercentual = monitorData?.percentual ?? 0
    const mTotal = monitorData?.totalItensSeparados ?? 0
    const mEmbalados = monitorData?.itensEmbalados ?? 0
    const mPendentes = monitorData?.itensPendentes ?? 0
    const mVolumes = monitorData?.volumes ?? []

    return (
      <div>
        <Group mb="xs">
          <Button variant="subtle" size="xs" leftSection={<IconArrowLeft size={14} />} onClick={() => router.push('/expedicao')}>Voltar</Button>
        </Group>
        <Text size="xs" c="dimmed" mb={4}>WMS / Expedição / Embalagem / Monitor</Text>
        <Group justify="space-between" mb="lg">
          <Text size="xl" fw={600}>Monitor Embalagem — Onda #{onda?.numero || '...'}</Text>
          <Group>
            <Button leftSection={<IconPrinter size={16} />} variant="light" color="teal" onClick={printFicha}>Imprimir Ficha</Button>
            <Badge color="grape" variant="light" size="lg">📱 Aguardando coletor...</Badge>
          </Group>
        </Group>

        <Card withBorder mb="md">
          <Text size="sm" fw={500} mb="xs">Progresso Geral</Text>
          <Group gap="xs" align="center">
            <Progress value={mPercentual} color={mPercentual === 100 ? 'green' : 'blue'} size="lg" style={{ flex: 1 }} />
            <Text size="sm" fw={600}>{mPercentual}%</Text>
          </Group>
        </Card>

        <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
          <Card withBorder><Text size="xs" c="dimmed" tt="uppercase" fw={600}>Total Separados</Text><Text size="xl" fw={700}>{mTotal}</Text></Card>
          <Card withBorder><Text size="xs" c="dimmed" tt="uppercase" fw={600}>Embalados</Text><Text size="xl" fw={700} c="green">{mEmbalados}</Text></Card>
          <Card withBorder><Text size="xs" c="dimmed" tt="uppercase" fw={600}>Pendentes</Text><Text size="xl" fw={700} c="orange">{mPendentes}</Text></Card>
        </SimpleGrid>

        {mVolumes.length > 0 && (
          <Card withBorder>
            <Text size="sm" fw={500} mb="sm">Volumes</Text>
            <Table striped highlightOnHover withTableBorder>
              <Table.Thead><Table.Tr><Table.Th>Código</Table.Th><Table.Th>Tipo</Table.Th><Table.Th>Itens</Table.Th><Table.Th>% Concluído</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>
                {mVolumes.map((v: any, i: number) => (
                  <Table.Tr key={i}>
                    <Table.Td fw={500}>{v.codigo}</Table.Td>
                    <Table.Td>{v.tipo}</Table.Td>
                    <Table.Td>{v.totalItens}</Table.Td>
                    <Table.Td><Group gap="xs"><Progress value={v.percentualConcluido ?? 0} size="sm" style={{ width: 80 }} color={v.percentualConcluido === 100 ? 'green' : 'blue'} /><Text size="xs">{v.percentualConcluido ?? 0}%</Text></Group></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Card>
        )}

        {mPercentual === 100 && (
          <Alert color="green" icon={<IconCheck size={16} />} mt="md">
            Todos os itens foram embalados via coletor.
            <Button mt="sm" color="green" leftSection={<IconCheck size={16} />} onClick={concluirEmbalagem}>Concluir Embalagem</Button>
          </Alert>
        )}
      </div>
    )
  }

  // ===== MODE: MANUAL =====

  return (
    <div>
      <Group mb="xs">
        <Button variant="subtle" size="xs" leftSection={<IconArrowLeft size={14} />} onClick={() => router.push('/expedicao')}>
          Voltar
        </Button>
      </Group>

      <Text size="xs" c="dimmed" mb={4}>WMS / Expedição / Embalagem</Text>
      <Group justify="space-between" mb="lg">
        <Text size="xl" fw={600}>
          Embalagem — Onda #{onda?.numero || '...'}
        </Text>
        <Group>
          <Button leftSection={<IconPrinter size={16} />} variant="light" color="teal" size="xs" onClick={printFicha}>Imprimir Ficha</Button>
          <Badge color={allPacked ? 'green' : 'blue'} size="lg" variant="light">
            {allPacked ? 'Tudo embalado' : `${pendentes?.totalPendentes || 0} itens pendentes`}
          </Badge>
        </Group>
      </Group>

      <LoadingOverlay visible={loadingOnda || loadingPendentes} />

      {allPacked && !loadingPendentes && (
        <Alert color="green" icon={<IconCheck size={16} />} mb="lg">
          Todos os itens foram embalados. Você pode concluir a embalagem.
          <Button mt="sm" color="green" leftSection={<IconCheck size={16} />} onClick={concluirEmbalagem}>
            Concluir Embalagem
          </Button>
        </Alert>
      )}

      <Grid>
        {/* Left panel — pending items */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder>
            <Group justify="space-between" mb="md">
              <Text fw={600} size="lg">Itens Pendentes</Text>
              {pedidoOptions.length > 1 && (
                <Select
                  size="xs"
                  data={pedidoOptions}
                  value={pedidoSelecionado}
                  onChange={setPedidoSelecionado}
                  placeholder="Filtrar pedido"
                  style={{ minWidth: 200 }}
                />
              )}
            </Group>

            {pedidoOptions.length === 0 && !loadingPendentes && (
              <Text c="dimmed" ta="center" py="xl">Nenhum item pendente de embalagem</Text>
            )}

            {itensDoPedido.length > 0 && (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th />
                    <Table.Th>Produto</Table.Th>
                    <Table.Th>Pendente</Table.Th>
                    <Table.Th>Qtd</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {itensDoPedido.map((item) => {
                    const selected = itensSelecionados.has(item.itemSeparacaoId)
                    return (
                      <Table.Tr
                        key={item.itemSeparacaoId}
                        style={{ cursor: volumeAtivo ? 'pointer' : 'default', opacity: volumeAtivo ? 1 : 0.6 }}
                        onClick={() => volumeAtivo && toggleItem(item.itemSeparacaoId)}
                        bg={selected ? 'var(--mantine-color-blue-light)' : undefined}
                      >
                        <Table.Td>
                          <input
                            type="checkbox"
                            checked={selected}
                            disabled={!volumeAtivo}
                            onChange={() => volumeAtivo && toggleItem(item.itemSeparacaoId)}
                          />
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={500}>{item.produto?.nome || item.produtoId.substring(0, 8)}</Text>
                          <Text size="xs" c="dimmed">{item.produto?.codigo}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Badge variant="light" color="orange" size="sm">
                            {item.quantidadePendente} {item.produto?.unidade || 'un'}
                          </Badge>
                        </Table.Td>
                        <Table.Td onClick={(e) => e.stopPropagation()}>
                          <NumberInput
                            size="xs"
                            min={1}
                            max={item.quantidadePendente}
                            value={quantidades[item.itemSeparacaoId] || item.quantidadePendente}
                            onChange={(val) => setQuantidades((prev) => ({
                              ...prev,
                              [item.itemSeparacaoId]: Number(val) || 1,
                            }))}
                            disabled={!volumeAtivo}
                            style={{ width: 80 }}
                          />
                        </Table.Td>
                      </Table.Tr>
                    )
                  })}
                </Table.Tbody>
              </Table>
            )}
          </Card>
        </Grid.Col>

        {/* Right panel — active volume */}
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card withBorder>
            <Text fw={600} size="lg" mb="md">Volume Ativo</Text>

            {!volumeAtivo ? (
              <Stack align="center" py="xl" gap="md">
                <IconBox size={48} color="var(--mantine-color-dimmed)" />
                <Text c="dimmed" ta="center">Nenhum volume ativo. Crie um novo volume para começar a embalar.</Text>
                <Button
                  leftSection={<IconPlus size={16} />}
                  onClick={() => criarVolume.mutate()}
                  loading={criarVolume.isPending}
                  disabled={allPacked || !pedidoSelecionado}
                >
                  Novo Volume
                </Button>
              </Stack>
            ) : (
              <Stack gap="md">
                <Group justify="space-between">
                  <div>
                    <Text size="sm" c="dimmed">Volume</Text>
                    <Text size="xl" fw={700}>#{volumeAtivo.codigo}</Text>
                  </div>
                  <Badge size="lg" color="grape" variant="light">{volumeAtivo.tipo}</Badge>
                </Group>

                <Divider />

                <Text size="sm" c="dimmed">
                  Selecione itens no painel esquerdo e clique em "Adicionar ao Volume" para vincular.
                </Text>

                <Group>
                  <Button
                    leftSection={<IconPackage size={16} />}
                    onClick={() => vincularItens.mutate()}
                    loading={vincularItens.isPending}
                    disabled={itensSelecionados.size === 0}
                  >
                    Adicionar ao Volume ({itensSelecionados.size})
                  </Button>
                  <Button
                    variant="outline"
                    color="teal"
                    leftSection={<IconCheck size={16} />}
                    onClick={finalizarVolume}
                  >
                    Finalizar Volume
                  </Button>
                </Group>

                <Divider />

                <Button
                  variant="subtle"
                  leftSection={<IconPlus size={14} />}
                  onClick={() => criarVolume.mutate()}
                  loading={criarVolume.isPending}
                  disabled={allPacked}
                  size="xs"
                >
                  Criar outro volume
                </Button>
              </Stack>
            )}
          </Card>
        </Grid.Col>
      </Grid>
    </div>
  )
}
