'use client'

import { useState } from 'react'
import { Card, Group, Text, SimpleGrid, ThemeIcon, Select, LoadingOverlay, Tooltip, Badge, Modal, Table, Progress, NumberInput, TextInput, Button, Stack, Alert } from '@mantine/core'
import { IconBuildingWarehouse, IconCheck, IconX, IconLock, IconPackage, IconAlertTriangle } from '@tabler/icons-react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const ocupacaoColors: Record<string, string> = {
  LIVRE: '#40c057',
  PARCIAL: '#fab005',
  CHEIO: '#228be6',
  BLOQUEADO: '#868e96',
}

const ocupacaoBg: Record<string, string> = {
  LIVRE: 'bg-green-100 border-green-300',
  PARCIAL: 'bg-yellow-100 border-yellow-300',
  CHEIO: 'bg-blue-100 border-blue-300',
  BLOQUEADO: 'bg-gray-200 border-gray-400',
}

export default function MapaArmazemPage() {
  useModuloGuard('WMS')
  const [selectedEnd, setSelectedEnd] = useState<any>(null)
  const [produtoFiltro, setProdutoFiltro] = useState<string | null>(null)
  const [depositoFiltro, setDepositoFiltro] = useState<string | null>(null)
  const [zonaFiltro, setZonaFiltro] = useState<string | null>(null)
  const [searchProd, setSearchProd] = useState('')

  // Distribuição inteligente
  const [distribuirOpen, setDistribuirOpen] = useState(false)
  const [distProdutoId, setDistProdutoId] = useState<string | null>(null)
  const [distQuantidade, setDistQuantidade] = useState<number | ''>('')
  const [distLote, setDistLote] = useState('')
  const [distValidade, setDistValidade] = useState('')
  const [distResultado, setDistResultado] = useState<any>(null)

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
      { produtoId: distProdutoId, alocacoes: distResultado.alocacoes.map((a: any) => ({ enderecoId: a.enderecoId, enderecoCompleto: a.enderecoCompleto, quantidadeAlocada: a.quantidadeAlocada })), lote: distLote || undefined, validade: distValidade || undefined },
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

  const { data: mapaData, isLoading } = useQuery<any>({
    queryKey: ['posicionamento-mapa', produtoFiltro, depositoFiltro, zonaFiltro],
    queryFn: async () => {
      const params: Record<string, string> = {}
      if (produtoFiltro) params.produtoId = produtoFiltro
      if (depositoFiltro) params.depositoId = depositoFiltro
      if (zonaFiltro) params.zonaId = zonaFiltro
      const { data } = await api.get('/posicionamento/mapa', { params })
      return data
    },
  })

  // Produtos para filtro
  const { data: produtosResp } = useQuery<any>({
    queryKey: ['mapa-produtos', searchProd],
    queryFn: async () => { const { data } = await api.get('/produtos', { params: { limit: 50, search: searchProd || undefined } }); return data },
  })

  // Depósitos para filtro
  const { data: depositosResp } = useQuery<any>({
    queryKey: ['mapa-depositos'],
    queryFn: async () => { const { data } = await api.get('/depositos', { params: { limit: 50 } }); return data },
  })

  // Zonas para filtro
  const { data: zonasResp } = useQuery<any>({
    queryKey: ['mapa-zonas'],
    queryFn: async () => { const { data } = await api.get('/zonas', { params: { limit: 50 } }); return data },
  })

  const produtoOptions = (produtosResp?.data || []).map((p: any) => ({ value: p.id, label: `${p.codigo} — ${p.nome}` }))
  const depositoOptions = (depositosResp?.data || []).map((d: any) => ({ value: d.id, label: d.descricao }))
  const zonaOptions = (zonasResp?.data || []).map((z: any) => ({ value: z.id, label: z.descricao }))

  const mapa = mapaData?.mapa || {}
  const stats = mapaData?.estatisticas || {}
  const ruas = mapaData?.ruas || []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Mapa do Armazém</Text>
      <Group justify="space-between" mb="lg">
        <Text size="xl" fw={600}>Posicionamento de Estoque</Text>
        <Group>
          {distResultado && (
            <Button color="green" leftSection={<IconCheck size={16} />} onClick={handleConfirmar} loading={confirmarMutation.isPending}>
              Confirmar Endereçamento ({distResultado.alocacoes.length} posições)
            </Button>
          )}
          <Button leftSection={<IconPackage size={16} />} onClick={() => setDistribuirOpen(true)}>
            Distribuir
          </Button>
        </Group>
      </Group>

      {/* Resultado da distribuição */}
      {distResultado && (
        <Alert
          icon={distResultado.completa ? <IconCheck size={16} /> : <IconAlertTriangle size={16} />}
          color={distResultado.completa ? 'green' : 'yellow'}
          mb="md"
          title={`Distribuição: ${distResultado.alocacoes.length} posições — ${distResultado.quantidadeAlocada} un`}
        >
          <Table striped size="sm" mt="xs">
            <Table.Thead><Table.Tr><Table.Th>Endereço</Table.Th><Table.Th>Quantidade</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {distResultado.alocacoes.map((a: any, i: number) => (
                <Table.Tr key={i}><Table.Td>{a.enderecoCompleto}</Table.Td><Table.Td><Badge color="grape">{a.quantidadeAlocada}</Badge></Table.Td></Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          {!distResultado.completa && <Text size="sm" c="red" mt="xs">⚠️ {distResultado.quantidadeRestante} un sem endereço disponível</Text>}
        </Alert>
      )}

      {/* Modal Distribuir */}
      <Modal opened={distribuirOpen} onClose={() => setDistribuirOpen(false)} title="Distribuição Inteligente" centered>
        <Stack gap="md">
          <Select label="Produto" placeholder="Selecione" data={produtoOptions} value={distProdutoId} onChange={setDistProdutoId} searchable onSearchChange={setSearchProd} />
          <NumberInput label="Quantidade" placeholder="Ex: 100" value={distQuantidade} onChange={(v) => setDistQuantidade(typeof v === 'number' ? v : '')} min={1} />
          <TextInput label="Lote (opcional)" value={distLote} onChange={(e) => setDistLote(e.currentTarget.value)} />
          <TextInput label="Validade (opcional)" placeholder="AAAA-MM-DD" value={distValidade} onChange={(e) => setDistValidade(e.currentTarget.value)} />
          <Button fullWidth onClick={handleDistribuir} loading={distribuirMutation.isPending} disabled={!distProdutoId || !distQuantidade}>
            Calcular Distribuição
          </Button>
        </Stack>
      </Modal>

      {/* Estatísticas */}
      <SimpleGrid cols={{ base: 2, sm: 4 }} mb="xl">
        <Card>
          <Group justify="space-between">
            <div><Text size="xs" c="dimmed" tt="uppercase" fw={600}>Total</Text><Text size="xl" fw={700}>{stats.totalEnderecos || 0}</Text></div>
            <ThemeIcon color="blue" variant="light" size={48} radius="md"><IconBuildingWarehouse size={24} /></ThemeIcon>
          </Group>
        </Card>
        <Card>
          <Group justify="space-between">
            <div><Text size="xs" c="dimmed" tt="uppercase" fw={600}>Livres</Text><Text size="xl" fw={700} c="green">{stats.livres || 0}</Text></div>
            <ThemeIcon color="green" variant="light" size={48} radius="md"><IconCheck size={24} /></ThemeIcon>
          </Group>
        </Card>
        <Card>
          <Group justify="space-between">
            <div><Text size="xs" c="dimmed" tt="uppercase" fw={600}>Ocupados</Text><Text size="xl" fw={700} c="blue">{stats.ocupados || 0}</Text></div>
            <ThemeIcon color="blue" variant="light" size={48} radius="md"><IconBuildingWarehouse size={24} /></ThemeIcon>
          </Group>
        </Card>
        <Card>
          <Group justify="space-between">
            <div><Text size="xs" c="dimmed" tt="uppercase" fw={600}>Ocupação</Text><Text size="xl" fw={700}>{stats.percentualOcupacao || 0}%</Text></div>
            <Progress value={stats.percentualOcupacao || 0} size="xl" className="w-16" color={stats.percentualOcupacao > 80 ? 'red' : stats.percentualOcupacao > 50 ? 'yellow' : 'green'} />
          </Group>
        </Card>
      </SimpleGrid>

      {/* Filtros */}
      <Card mb="md">
        <Group gap="md">
          <Select
            label="Depósito"
            placeholder="Todos"
            data={depositoOptions}
            value={depositoFiltro}
            onChange={setDepositoFiltro}
            searchable
            clearable
            className="w-52"
          />
          <Select
            label="Zona"
            placeholder="Todas"
            data={zonaOptions}
            value={zonaFiltro}
            onChange={setZonaFiltro}
            searchable
            clearable
            className="w-52"
          />
          <Select
            label="Produto"
            placeholder="Todos os produtos"
            data={produtoOptions}
            value={produtoFiltro}
            onChange={setProdutoFiltro}
            searchable
            clearable
            onSearchChange={setSearchProd}
            className="w-80"
          />
          {(produtoFiltro || depositoFiltro || zonaFiltro) && (
            <Text size="sm" c="blue" mt={24}>
              Filtro ativo
            </Text>
          )}
        </Group>
      </Card>

      {/* Legenda */}
      <Card mb="md">
        <Group gap="lg">
          <Text size="sm" fw={500}>Legenda:</Text>
          <Group gap="sm"><div className="w-4 h-4 rounded bg-green-400" /><Text size="sm">Livre</Text></Group>
          <Group gap="sm"><div className="w-4 h-4 rounded bg-blue-400" /><Text size="sm">Ocupado</Text></Group>
          <Group gap="sm"><div className="w-4 h-4 rounded bg-gray-400" /><Text size="sm">Bloqueado</Text></Group>
        </Group>
      </Card>

      {/* Mapa Visual */}
      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />

        {ruas.length === 0 && !isLoading && (
          <Text c="dimmed" className="text-center py-12">Nenhum endereço cadastrado</Text>
        )}

        {ruas.map((rua: string) => (
          <div key={rua} className="mb-6">
            <Text fw={600} mb="sm" size="lg">Rua {rua}</Text>
            <div className="flex gap-4 overflow-x-auto pb-2">
              {Object.keys(mapa[rua] || {}).sort().map((predio) => (
                <div key={predio} className="min-w-[120px]">
                  <Text size="sm" fw={500} mb={4} className="text-center">Prédio {predio}</Text>
                  <div className="flex flex-col-reverse gap-1">
                    {(mapa[rua][predio] || []).sort((a: any, b: any) => {
                      const nivelDiff = a.nivel.localeCompare(b.nivel)
                      return nivelDiff !== 0 ? nivelDiff : a.apto.localeCompare(b.apto)
                    }).map((pos: any) => (
                      <Tooltip
                        key={pos.enderecoId}
                        label={
                          <div>
                            <Text size="xs" fw={600}>{pos.enderecoCompleto}</Text>
                            <Text size="xs">{pos.ocupacao}</Text>
                            {pos.produtos.map((p: any) => (
                              <Text key={p.id} size="xs">{p.descricao}: {p.quantidade}</Text>
                            ))}
                          </div>
                        }
                        multiline
                        w={220}
                      >
                        <div
                          className={`w-full h-8 rounded border cursor-pointer flex items-center justify-center text-xs font-mono transition-all hover:scale-105 ${ocupacaoBg[pos.ocupacao] || 'bg-white border-gray-200'}`}
                          onClick={() => setSelectedEnd(pos)}
                        >
                          {pos.ocupacao === 'CHEIO' || pos.ocupacao === 'PARCIAL' ? (
                            <span title={`${pos.nivel}-${pos.apto}`}>
                              <svg width="20" height="18" viewBox="0 0 24 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <rect x="2" y="10" width="20" height="2" rx="1" fill="#555"/>
                                <rect x="3" y="4" width="7" height="6" rx="1" fill="#FF9F43" stroke="#E08A30" strokeWidth="0.5"/>
                                <rect x="11" y="2" width="7" height="8" rx="1" fill="#28C76F" stroke="#1FA85C" strokeWidth="0.5"/>
                                <rect x="4" y="12" width="2" height="6" rx="0.5" fill="#888"/>
                                <rect x="18" y="12" width="2" height="6" rx="0.5" fill="#888"/>
                                <rect x="1" y="17" width="8" height="2" rx="1" fill="#666"/>
                                <rect x="15" y="17" width="8" height="2" rx="1" fill="#666"/>
                              </svg>
                            </span>
                          ) : (
                            <span>{pos.nivel}-{pos.apto}</span>
                          )}
                        </div>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </Card>

      {/* Modal Detalhe do Endereço */}
      <Modal opened={!!selectedEnd} onClose={() => setSelectedEnd(null)} title={`Endereço: ${selectedEnd?.enderecoCompleto}`} size="lg" centered>
        {selectedEnd && (
          <>
            <Group mb="md">
              <Badge color={ocupacaoColors[selectedEnd.ocupacao]} size="lg">{selectedEnd.ocupacao}</Badge>
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
