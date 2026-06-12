'use client'

import { useEffect, useState } from 'react'
import {
  Card,
  Group,
  Text,
  Select,
  Button,
  Modal,
  NumberInput,
  TextInput,
  Table,
  Badge,
  Alert,
  Stack,
  LoadingOverlay,
  Tooltip,
  SimpleGrid,
  ThemeIcon,
  Progress,
} from '@mantine/core'
import { IconPackage, IconCheck, IconAlertTriangle, IconBuildingWarehouse } from '@tabler/icons-react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const ocupacaoBg: Record<string, string> = {
  LIVRE: 'bg-green-100 border-green-400',
  PARCIAL: 'bg-yellow-100 border-yellow-400',
  CHEIO: 'bg-red-100 border-red-400',
  BLOQUEADO: 'bg-gray-200 border-gray-500',
}

const areaBorder: Record<string, string> = {
  PICKING: 'border-orange-500',
  PULMAO: 'border-blue-500',
}

export default function MapaArmazemPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Mapa do Armazém' }, [])

  const [depositoId, setDepositoId] = useState<string | null>(null)
  const [produtoFiltro, setProdutoFiltro] = useState<string | null>(null)
  const [searchProd, setSearchProd] = useState('')
  const [selectedEnd, setSelectedEnd] = useState<any>(null)

  // Distribuição
  const [distribuirOpen, setDistribuirOpen] = useState(false)
  const [distProdutoId, setDistProdutoId] = useState<string | null>(null)
  const [distQuantidade, setDistQuantidade] = useState<number | ''>('')
  const [distLote, setDistLote] = useState('')
  const [distValidade, setDistValidade] = useState('')
  const [distResultado, setDistResultado] = useState<any>(null)

  // Depósitos
  const { data: depositosResp } = useQuery<any>({
    queryKey: ['mapa-armazem-depositos'],
    queryFn: async () => { const { data } = await api.get('/depositos', { params: { limit: 100 } }); return data },
  })

  // Produtos para filtro
  const { data: produtosResp } = useQuery<any>({
    queryKey: ['mapa-armazem-produtos', searchProd],
    queryFn: async () => { const { data } = await api.get('/produtos', { params: { limit: 50, search: searchProd || undefined } }); return data },
  })

  // Mapa (usa /posicionamento/mapa)
  const { data: mapaData, isLoading } = useQuery<any>({
    queryKey: ['mapa-armazem-posicionamento', depositoId, produtoFiltro],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (depositoId) params.depositoId = depositoId
      if (produtoFiltro) params.produtoId = produtoFiltro
      const { data } = await api.get('/posicionamento/mapa', { params })
      return data
    },
    enabled: !!depositoId,
    staleTime: 1000 * 60 * 2,
    refetchOnWindowFocus: false,
  })

  // Mutations
  const distribuirMutation = useMutation({
    mutationFn: async (body: any) => {
      const { data } = await api.post('/enderecamento-inteligente/distribuir', body)
      return data
    },
  })

  const confirmarMutation = useMutation({
    mutationFn: async (body: any) => {
      const { data } = await api.post('/enderecamento-inteligente/confirmar', body)
      return data
    },
  })

  // Options
  const depositoOptions = (depositosResp?.data || []).map((d: any) => ({ value: d.id, label: d.descricao || d.codigo }))
  const produtoOptions = (produtosResp?.data || []).map((p: any) => ({ value: p.id, label: `${p.codigo} — ${p.nome}` }))

  const mapa = mapaData?.mapa || {}
  const stats = mapaData?.estatisticas || {}
  const ruas = mapaData?.ruas || []

  // Sugestões (endereços sugeridos pela distribuição)
  const sugestaoSet = new Set<string>(distResultado?.alocacoes?.map((a: any) => a.enderecoId) || [])

  function handleDistribuir() {
    if (!distProdutoId || !distQuantidade) return
    distribuirMutation.mutate(
      { produtoId: distProdutoId, quantidade: Number(distQuantidade), lote: distLote || undefined, validade: distValidade || undefined },
      {
        onSuccess: (result) => {
          setDistResultado(result)
          setDistribuirOpen(false)
          notifications.show({
            title: result.completa ? '✅ Distribuição calculada' : '⚠️ Distribuição parcial',
            message: `${result.alocacoes.length} posições — ${result.quantidadeAlocada} un alocadas${!result.completa ? ` (${result.quantidadeRestante} un sem endereço)` : ''}`,
            color: result.completa ? 'green' : 'yellow',
          })
        },
        onError: (err: any) => {
          notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao calcular', color: 'red' })
        },
      },
    )
  }

  function handleConfirmar() {
    if (!distResultado || !distProdutoId) return
    confirmarMutation.mutate(
      {
        produtoId: distProdutoId,
        alocacoes: distResultado.alocacoes.map((a: any) => ({
          enderecoId: a.enderecoId,
          enderecoCompleto: a.enderecoCompleto,
          quantidadeAlocada: a.quantidadeAlocada,
          areaArmazenagem: a.areaArmazenagem,
        })),
        lote: distLote || undefined,
        validade: distValidade || undefined,
      },
      {
        onSuccess: () => {
          notifications.show({ title: '✅ Confirmado', message: 'Endereçamento confirmado com sucesso', color: 'green' })
          setDistResultado(null)
        },
        onError: (err: any) => {
          notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao confirmar', color: 'red' })
        },
      },
    )
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Mapa do Armazém</Text>
      <Group justify="space-between" mb="lg">
        <Text size="xl" fw={600}>Mapa do Armazém</Text>
        <Group>
          {distResultado && distResultado.alocacoes.length > 0 && (
            <Button color="green" leftSection={<IconCheck size={16} />} onClick={handleConfirmar} loading={confirmarMutation.isPending}>
              Confirmar Endereçamento ({distResultado.alocacoes.length} posições)
            </Button>
          )}
          <Button leftSection={<IconPackage size={16} />} onClick={() => setDistribuirOpen(true)} disabled={!depositoId}>
            Distribuir
          </Button>
        </Group>
      </Group>

      {/* Estatísticas */}
      {depositoId && stats.totalEnderecos > 0 && (
        <SimpleGrid cols={{ base: 2, sm: 4 }} mb="md">
          <Card withBorder padding="sm">
            <Group justify="space-between">
              <div><Text size="xs" c="dimmed" tt="uppercase" fw={600}>Total</Text><Text size="xl" fw={700}>{stats.totalEnderecos || 0}</Text></div>
              <ThemeIcon color="blue" variant="light" size={40} radius="md"><IconBuildingWarehouse size={20} /></ThemeIcon>
            </Group>
          </Card>
          <Card withBorder padding="sm">
            <Group justify="space-between">
              <div><Text size="xs" c="dimmed" tt="uppercase" fw={600}>Livres</Text><Text size="xl" fw={700} c="green">{stats.livres || 0}</Text></div>
              <ThemeIcon color="green" variant="light" size={40} radius="md"><IconCheck size={20} /></ThemeIcon>
            </Group>
          </Card>
          <Card withBorder padding="sm">
            <Group justify="space-between">
              <div><Text size="xs" c="dimmed" tt="uppercase" fw={600}>Ocupados</Text><Text size="xl" fw={700} c="blue">{stats.ocupados || 0}</Text></div>
              <ThemeIcon color="blue" variant="light" size={40} radius="md"><IconBuildingWarehouse size={20} /></ThemeIcon>
            </Group>
          </Card>
          <Card withBorder padding="sm">
            <Group justify="space-between">
              <div><Text size="xs" c="dimmed" tt="uppercase" fw={600}>Ocupação</Text><Text size="xl" fw={700}>{stats.percentualOcupacao || 0}%</Text></div>
              <Progress value={stats.percentualOcupacao || 0} size="xl" className="w-16" color={stats.percentualOcupacao > 80 ? 'red' : stats.percentualOcupacao > 50 ? 'yellow' : 'green'} />
            </Group>
          </Card>
        </SimpleGrid>
      )}

      {/* Resultado da distribuição */}
      {distResultado && (
        <Alert
          icon={distResultado.completa ? <IconCheck size={16} /> : <IconAlertTriangle size={16} />}
          color={distResultado.completa ? 'green' : 'yellow'}
          mb="md"
          title={`Distribuição: ${distResultado.alocacoes.length} posições — ${distResultado.quantidadeAlocada} un`}
        >
          <Table striped highlightOnHover mt="xs">
            <Table.Thead><Table.Tr><Table.Th>Endereço</Table.Th><Table.Th>Área</Table.Th><Table.Th>Quantidade</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {distResultado.alocacoes.map((a: any, i: number) => (
                <Table.Tr key={i}>
                  <Table.Td>{a.enderecoCompleto}</Table.Td>
                  <Table.Td><Badge color={a.areaArmazenagem === 'PICKING' ? 'orange' : 'blue'} variant="light" size="sm">{a.areaArmazenagem === 'PICKING' ? 'Picking' : 'Pulmão'}</Badge></Table.Td>
                  <Table.Td><Badge color="grape">{a.quantidadeAlocada}</Badge></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          {!distResultado.completa && <Text size="sm" c="red" mt="xs">⚠️ {distResultado.quantidadeRestante} un sem endereço disponível</Text>}
        </Alert>
      )}

      {/* Filtros + Depósito */}
      <Card withBorder mb="md" padding="sm">
        <Group gap="md">
          <Select label="Depósito" placeholder="Selecione" data={depositoOptions} value={depositoId} onChange={setDepositoId} searchable style={{ width: 200 }} />
          <Select label="Produto" placeholder="Todos" data={produtoOptions} value={produtoFiltro} onChange={setProdutoFiltro} searchable clearable onSearchChange={setSearchProd} style={{ width: 280 }} />
        </Group>
      </Card>

      {/* Legenda */}
      <Card withBorder mb="md" padding="xs">
        <Group gap="lg">
          <Text size="sm" fw={500}>Legenda:</Text>
          <Group gap="sm"><div className="w-4 h-4 rounded bg-green-400" /><Text size="sm">Vazio</Text></Group>
          <Group gap="sm"><div className="w-4 h-4 rounded bg-yellow-400" /><Text size="sm">Parcial</Text></Group>
          <Group gap="sm"><div className="w-4 h-4 rounded bg-red-400" /><Text size="sm">Cheio</Text></Group>
          <Group gap="sm"><div className="w-4 h-4 rounded bg-gray-400" /><Text size="sm">Bloqueado</Text></Group>
          <Group gap="sm"><div className="w-4 h-4 rounded bg-purple-400" /><Text size="sm">Sugerido</Text></Group>
          <Text size="sm" fw={500} ml="md">Área:</Text>
          <Group gap="sm"><div className="w-4 h-4 rounded border-[3px] border-orange-500" /><Text size="sm">Picking</Text></Group>
          <Group gap="sm"><div className="w-4 h-4 rounded border-[3px] border-blue-500" /><Text size="sm">Pulmão</Text></Group>
        </Group>
      </Card>

      {/* Mapa Visual */}
      <Card withBorder pos="relative" padding="md">
        <LoadingOverlay visible={isLoading} />

        {!depositoId && (
          <Text c="dimmed" className="text-center py-12">Selecione um depósito para visualizar o mapa</Text>
        )}

        {depositoId && ruas.length === 0 && !isLoading && (
          <Text c="dimmed" className="text-center py-12">Nenhum endereço cadastrado</Text>
        )}

        {ruas.map((rua: string) => (
          <div key={rua} className="mb-8">
            <Text fw={600} mb="sm" size="lg">Rua {rua}</Text>
            <div className="flex gap-6 overflow-x-auto pb-2">
              {Object.keys(mapa[rua] || {}).sort().map((predio) => {
                const posicoes = mapa[rua][predio] || []
                const niveis = [...new Set(posicoes.map((p: any) => p.nivel))].sort((a: string, b: string) => b.localeCompare(a))
                const aptos = [...new Set(posicoes.map((p: any) => p.apto))].sort()

                return (
                  <div key={predio} className="min-w-[120px]">
                    <Text size="sm" fw={500} mb={4} className="text-center">Prédio {predio}</Text>
                    {/* Header: Apartamentos */}
                    <div className="flex gap-1 mb-1 ml-12">
                      {aptos.map((apto: string) => (
                        <Text key={apto} size="xs" c="dimmed" className="w-12 text-center">Ap {apto}</Text>
                      ))}
                    </div>
                    {/* Grid: Nível × Apartamento */}
                    {niveis.map((nivel: string) => (
                      <div key={nivel} className="flex items-center gap-1 mb-1">
                        <Text size="xs" c="dimmed" className="w-10 text-right">Nv {nivel}</Text>
                        {aptos.map((apto: string) => {
                          const pos = posicoes.find((p: any) => p.nivel === nivel && p.apto === apto)
                          if (!pos) return <div key={`${nivel}-${apto}`} className="w-12 h-10 rounded bg-gray-100 border border-gray-200" />

                          const isSugerido = sugestaoSet.has(pos.enderecoId)
                          const bgClass = isSugerido ? 'bg-purple-200 border-purple-500' : (ocupacaoBg[pos.ocupacao] || 'bg-white border-gray-200')
                          const borderClass = areaBorder[pos.areaArmazenagem] || areaBorder.PULMAO

                          return (
                            <Tooltip
                              key={`${nivel}-${apto}`}
                              multiline
                              w={220}
                              label={
                                <div>
                                  <Text size="xs" fw={600}>{pos.enderecoCompleto}</Text>
                                  <Text size="xs">Status: {isSugerido ? 'Sugerido' : pos.ocupacao}</Text>
                                  <Text size="xs">Área: {pos.areaArmazenagem === 'PICKING' ? 'Picking' : 'Pulmão'}</Text>
                                  {pos.produtos.map((p: any) => (
                                    <Text key={p.id} size="xs">{p.descricao}: {p.quantidade}</Text>
                                  ))}
                                  {isSugerido && (
                                    <Text size="xs" fw={600} c="grape">
                                      Sugestão: {distResultado?.alocacoes?.find((a: any) => a.enderecoId === pos.enderecoId)?.quantidadeAlocada} un
                                    </Text>
                                  )}
                                </div>
                              }
                            >
                              <div
                                className={`w-12 h-10 rounded border-[3px] cursor-pointer flex flex-col items-center justify-center text-xs font-mono transition-all hover:scale-110 ${bgClass} ${borderClass}`}
                                onClick={() => setSelectedEnd(pos)}
                              >
                                <span className="font-semibold text-[10px]">{apto}</span>
                                {pos.areaArmazenagem === 'PICKING' && <span className="text-[7px] font-bold text-orange-600">PK</span>}
                              </div>
                            </Tooltip>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </Card>

      {/* Modal Distribuir */}
      <Modal opened={distribuirOpen} onClose={() => setDistribuirOpen(false)} title="Distribuição Inteligente" centered>
        <Stack gap="md">
          <Select label="Produto" placeholder="Selecione" data={produtoOptions} value={distProdutoId} onChange={setDistProdutoId} searchable onSearchChange={setSearchProd} />
          <NumberInput label="Quantidade" placeholder="Ex: 100" value={distQuantidade} onChange={(v) => setDistQuantidade(typeof v === 'number' ? v : '')} min={1} />
          <TextInput label="Lote (opcional)" value={distLote} onChange={(e) => setDistLote(e.currentTarget.value)} />
          <TextInput label="Validade (opcional)" placeholder="DD/MM/AAAA" value={distValidade} onChange={(e) => setDistValidade(e.currentTarget.value)} />
          <Button fullWidth onClick={handleDistribuir} loading={distribuirMutation.isPending} disabled={!distProdutoId || !distQuantidade}>
            Calcular Distribuição
          </Button>
        </Stack>
      </Modal>

      {/* Modal Detalhe do Endereço */}
      <Modal opened={!!selectedEnd} onClose={() => setSelectedEnd(null)} title={`Endereço: ${selectedEnd?.enderecoCompleto}`} size="lg" centered>
        {selectedEnd && (
          <>
            <Group mb="md">
              <Badge color={selectedEnd.ocupacao === 'LIVRE' ? 'green' : selectedEnd.ocupacao === 'CHEIO' ? 'red' : selectedEnd.ocupacao === 'PARCIAL' ? 'yellow' : 'gray'} size="lg">{selectedEnd.ocupacao}</Badge>
              <Badge color={selectedEnd.areaArmazenagem === 'PICKING' ? 'orange' : 'blue'} size="lg">{selectedEnd.areaArmazenagem === 'PICKING' ? 'Picking' : 'Pulmão'}</Badge>
              <Text size="sm" c="dimmed">Tipo: {selectedEnd.tipo}</Text>
            </Group>

            {selectedEnd.produtos.length > 0 ? (
              <Table striped>
                <Table.Thead>
                  <Table.Tr><Table.Th>Código</Table.Th><Table.Th>Produto</Table.Th><Table.Th>Quantidade</Table.Th></Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {selectedEnd.produtos.map((p: any) => (
                    <Table.Tr key={p.id}>
                      <Table.Td className="font-mono">{p.codigo}</Table.Td>
                      <Table.Td>{p.descricao}</Table.Td>
                      <Table.Td fw={500}>{p.quantidade}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <Text c="dimmed" className="text-center py-4">Endereço vazio</Text>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}
