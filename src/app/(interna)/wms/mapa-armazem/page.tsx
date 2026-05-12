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
  Drawer,
} from '@mantine/core'
import { IconMap2, IconPackage, IconCheck, IconAlertTriangle } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { MapaArmazem } from '@/components/wms/MapaArmazem'
import {
  useOcupacaoArmazem,
  useDistribuicaoInteligente,
  useConfirmarDistribuicao,
  type DistribuicaoResult,
  type OcupacaoEndereco,
} from '@/data/hooks/useEnderecamentoInteligente'

export default function MapaArmazemPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - Mapa do Armazém (Inteligente)' }, [])

  // State
  const [depositoId, setDepositoId] = useState<string | null>(null)
  const [distribuirModalOpen, setDistribuirModalOpen] = useState(false)
  const [produtoId, setProdutoId] = useState<string | null>(null)
  const [quantidade, setQuantidade] = useState<number | ''>('')
  const [lote, setLote] = useState('')
  const [validade, setValidade] = useState('')
  const [distribuicaoResult, setDistribuicaoResult] = useState<DistribuicaoResult | null>(null)
  const [detalheEnderecoId, setDetalheEnderecoId] = useState<string | null>(null)
  const [searchProduto, setSearchProduto] = useState('')

  // Queries
  const { data: depositosResp } = useQuery<any>({
    queryKey: ['mapa-armazem-depositos'],
    queryFn: async () => { const { data } = await api.get('/depositos', { params: { limit: 100 } }); return data },
  })

  const { data: produtosResp } = useQuery<any>({
    queryKey: ['mapa-armazem-produtos', searchProduto],
    queryFn: async () => {
      const { data } = await api.get('/produtos', { params: { limit: 50, search: searchProduto || undefined } })
      return data
    },
  })

  const { data: ocupacaoData, isLoading: loadingOcupacao, refetch: refetchOcupacao } = useOcupacaoArmazem(depositoId)

  // Mutations
  const distribuicaoMutation = useDistribuicaoInteligente()
  const confirmarMutation = useConfirmarDistribuicao()

  // Options
  const depositoOptions = (depositosResp?.data || []).map((d: any) => ({
    value: d.id,
    label: d.descricao || d.codigo,
  }))

  const produtoOptions = (produtosResp?.data || []).map((p: any) => ({
    value: p.id,
    label: `${p.codigo} — ${p.nome}`,
  }))

  // Sugestões para o mapa (derivadas do resultado da distribuição)
  const sugestoes = distribuicaoResult?.alocacoes.map((a) => ({
    enderecoId: a.enderecoId,
    quantidade: a.quantidadeAlocada,
  }))

  // Detalhe do endereço selecionado
  const enderecoDetalhe = ocupacaoData?.enderecos.find((e) => e.id === detalheEnderecoId)

  // Handlers
  function handleDistribuir() {
    if (!produtoId || !quantidade) return

    distribuicaoMutation.mutate(
      {
        produtoId,
        quantidade: Number(quantidade),
        lote: lote || undefined,
        validade: validade || undefined,
      },
      {
        onSuccess: (result) => {
          setDistribuicaoResult(result)
          setDistribuirModalOpen(false)
          if (result.completa) {
            notifications.show({
              title: '✅ Distribuição calculada',
              message: `${result.alocacoes.length} posições sugeridas para ${result.quantidadeAlocada} unidades`,
              color: 'green',
            })
          } else {
            notifications.show({
              title: '⚠️ Distribuição parcial',
              message: `Capacidade insuficiente. ${result.quantidadeRestante} unidades sem endereço.`,
              color: 'yellow',
            })
          }
        },
        onError: (err: any) => {
          notifications.show({
            title: 'Erro na distribuição',
            message: err?.response?.data?.message || 'Falha ao calcular distribuição',
            color: 'red',
          })
        },
      },
    )
  }

  function handleConfirmar() {
    if (!distribuicaoResult || !produtoId) return

    confirmarMutation.mutate(
      {
        produtoId,
        alocacoes: distribuicaoResult.alocacoes.map((a) => ({
          enderecoId: a.enderecoId,
          enderecoCompleto: a.enderecoCompleto,
          quantidadeAlocada: a.quantidadeAlocada,
        })),
        lote: lote || undefined,
        validade: validade || undefined,
      },
      {
        onSuccess: (result) => {
          notifications.show({
            title: '✅ Endereçamento confirmado',
            message: `${result.alocacoesConfirmadas} posições confirmadas — ${result.quantidadeTotal} unidades`,
            color: 'green',
          })
          setDistribuicaoResult(null)
          refetchOcupacao()
        },
        onError: (err: any) => {
          notifications.show({
            title: 'Erro ao confirmar',
            message: err?.response?.data?.message || 'Falha ao confirmar endereçamento',
            color: 'red',
          })
        },
      },
    )
  }

  function handleLimparDistribuicao() {
    setDistribuicaoResult(null)
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Mapa do Armazém</Text>
      <Text size="xl" fw={600} mb="lg">Endereçamento Inteligente — Mapa do Armazém</Text>

      {/* Controls */}
      <Card withBorder mb="md" padding="sm">
        <Group justify="space-between">
          <Group gap="md">
            <Select
              label="Depósito"
              placeholder="Selecione um depósito"
              data={depositoOptions}
              value={depositoId}
              onChange={setDepositoId}
              searchable
              style={{ width: 260 }}
            />
          </Group>
          <Group gap="sm">
            {distribuicaoResult && (
              <>
                <Button
                  color="green"
                  leftSection={<IconCheck size={16} />}
                  onClick={handleConfirmar}
                  loading={confirmarMutation.isPending}
                >
                  Confirmar Endereçamento
                </Button>
                <Button variant="default" onClick={handleLimparDistribuicao}>
                  Limpar
                </Button>
              </>
            )}
            <Button
              leftSection={<IconPackage size={16} />}
              onClick={() => setDistribuirModalOpen(true)}
              disabled={!depositoId}
            >
              Distribuir
            </Button>
          </Group>
        </Group>
      </Card>

      {/* Distribution result alert */}
      {distribuicaoResult && (
        <Alert
          icon={distribuicaoResult.completa ? <IconCheck size={16} /> : <IconAlertTriangle size={16} />}
          color={distribuicaoResult.completa ? 'green' : 'yellow'}
          mb="md"
          title={distribuicaoResult.completa ? 'Distribuição completa' : 'Distribuição parcial'}
        >
          <Group gap="lg">
            <Text size="sm">
              {distribuicaoResult.alocacoes.length} posições • {distribuicaoResult.quantidadeAlocada} un alocadas
            </Text>
            {!distribuicaoResult.completa && (
              <Badge color="red" variant="light">
                {distribuicaoResult.quantidadeRestante} un sem endereço
              </Badge>
            )}
          </Group>
        </Alert>
      )}

      {/* Distribution result table */}
      {distribuicaoResult && distribuicaoResult.alocacoes.length > 0 && (
        <Card withBorder mb="md" padding="sm">
          <Text fw={500} mb="xs">Alocações sugeridas</Text>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Endereço</Table.Th>
                <Table.Th>Rua</Table.Th>
                <Table.Th>Prédio</Table.Th>
                <Table.Th>Nível</Table.Th>
                <Table.Th>Apto</Table.Th>
                <Table.Th>Área</Table.Th>
                <Table.Th>Quantidade</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {distribuicaoResult.alocacoes.map((a, i) => (
                <Table.Tr key={i}>
                  <Table.Td fw={500}>{a.enderecoCompleto}</Table.Td>
                  <Table.Td>{a.rua}</Table.Td>
                  <Table.Td>{a.predio}</Table.Td>
                  <Table.Td>{a.nivel}</Table.Td>
                  <Table.Td>{a.apartamento}</Table.Td>
                  <Table.Td>
                    <Badge
                      color={(a as any).areaArmazenagem === 'PICKING' ? 'orange' : 'blue'}
                      variant="light"
                      size="sm"
                    >
                      {(a as any).areaArmazenagem === 'PICKING' ? 'Picking' : 'Pulmão'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Badge color="grape" variant="light">{a.quantidadeAlocada}</Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}

      {/* Map */}
      <Card withBorder pos="relative" padding="md">
        <LoadingOverlay visible={loadingOcupacao} />
        {!depositoId && (
          <Text c="dimmed" ta="center" py="xl">
            Selecione um depósito para visualizar o mapa de ocupação
          </Text>
        )}
        {depositoId && ocupacaoData && (
          <MapaArmazem
            enderecos={ocupacaoData.enderecos}
            sugestoes={sugestoes}
            onEnderecoClick={setDetalheEnderecoId}
          />
        )}
      </Card>

      {/* Distribuir Modal */}
      <Modal
        opened={distribuirModalOpen}
        onClose={() => setDistribuirModalOpen(false)}
        title="Distribuição Inteligente"
        centered
      >
        <Stack gap="md">
          <Select
            label="Produto"
            placeholder="Selecione o produto"
            data={produtoOptions}
            value={produtoId}
            onChange={setProdutoId}
            searchable
            onSearchChange={setSearchProduto}
            required
          />
          <NumberInput
            label="Quantidade"
            placeholder="Quantidade a endereçar"
            value={quantidade}
            onChange={(val) => setQuantidade(typeof val === 'number' ? val : '')}
            min={1}
            required
          />
          <TextInput
            label="Lote"
            placeholder="Lote (opcional)"
            value={lote}
            onChange={(e) => setLote(e.currentTarget.value)}
          />
          <TextInput
            label="Validade"
            placeholder="DD/MM/AAAA (opcional)"
            value={validade}
            onChange={(e) => setValidade(e.currentTarget.value)}
          />
          <Button
            fullWidth
            onClick={handleDistribuir}
            loading={distribuicaoMutation.isPending}
            disabled={!produtoId || !quantidade}
          >
            Calcular Distribuição
          </Button>
        </Stack>
      </Modal>

      {/* Detalhe Drawer */}
      <Drawer
        opened={!!detalheEnderecoId}
        onClose={() => setDetalheEnderecoId(null)}
        title="Detalhes do Endereço"
        position="right"
        size="sm"
      >
        {enderecoDetalhe && (
          <Stack gap="md">
            <div>
              <Text size="sm" c="dimmed">Endereço</Text>
              <Text fw={600}>{enderecoDetalhe.enderecoCompleto}</Text>
            </div>
            <Group>
              <div>
                <Text size="sm" c="dimmed">Rua</Text>
                <Text>{enderecoDetalhe.rua}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">Prédio</Text>
                <Text>{enderecoDetalhe.predio}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">Nível</Text>
                <Text>{enderecoDetalhe.nivel}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">Apto</Text>
                <Text>{enderecoDetalhe.apartamento}</Text>
              </div>
            </Group>
            <div>
              <Text size="sm" c="dimmed">Status</Text>
              <Badge
                color={
                  enderecoDetalhe.status === 'VAZIO' ? 'green' :
                  enderecoDetalhe.status === 'PARCIAL' ? 'yellow' :
                  enderecoDetalhe.status === 'CHEIO' ? 'red' : 'blue'
                }
                variant="light"
                size="lg"
              >
                {enderecoDetalhe.status}
              </Badge>
            </div>
            <div>
              <Text size="sm" c="dimmed">Área</Text>
              <Badge
                color={enderecoDetalhe.areaArmazenagem === 'PICKING' ? 'orange' : 'blue'}
                variant="light"
                size="lg"
              >
                {enderecoDetalhe.areaArmazenagem === 'PICKING' ? 'Picking' : 'Pulmão'}
              </Badge>
            </div>
            <div>
              <Text size="sm" c="dimmed">Ocupação</Text>
              <Text fw={500}>{enderecoDetalhe.percentualOcupacao}%</Text>
            </div>
            <Group>
              <div>
                <Text size="sm" c="dimmed">Saldo Atual</Text>
                <Text>{enderecoDetalhe.saldoAtual}</Text>
              </div>
              <div>
                <Text size="sm" c="dimmed">Capacidade</Text>
                <Text>{enderecoDetalhe.capacidadePalete}</Text>
              </div>
            </Group>
            {enderecoDetalhe.produto && (
              <Card withBorder padding="sm">
                <Text size="sm" fw={500} mb="xs">Produto</Text>
                <Text size="sm">{enderecoDetalhe.produto.nome}</Text>
                <Text size="sm" c="dimmed">Qtd: {enderecoDetalhe.produto.quantidade}</Text>
                {enderecoDetalhe.produto.lote && (
                  <Text size="sm" c="dimmed">Lote: {enderecoDetalhe.produto.lote}</Text>
                )}
              </Card>
            )}
            {sugestaoMap(sugestoes, detalheEnderecoId) && (
              <Alert color="grape" title="Sugestão de Endereçamento">
                <Text size="sm">
                  Quantidade sugerida: <strong>{sugestaoMap(sugestoes, detalheEnderecoId)}</strong> unidades
                </Text>
              </Alert>
            )}
          </Stack>
        )}
      </Drawer>
    </div>
  )
}

// Helper to get suggestion quantity for a specific address
function sugestaoMap(sugestoes: Array<{ enderecoId: string; quantidade: number }> | undefined, enderecoId: string | null): number | null {
  if (!sugestoes || !enderecoId) return null
  const found = sugestoes.find((s) => s.enderecoId === enderecoId)
  return found ? found.quantidade : null
}
