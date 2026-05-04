'use client'

import { useState } from 'react'
import {
  Card, Group, Text, Select, NumberInput, Button, Alert, SimpleGrid,
  Table, LoadingOverlay, ThemeIcon, Badge,
} from '@mantine/core'
import {
  IconArrowsExchange, IconCheck, IconAlertCircle, IconRefresh, IconMapPin,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

export default function TransferenciaEnderecoPage() {
  useModuloGuard('WMS')
  const queryClient = useQueryClient()

  const [produtoId, setProdutoId] = useState<string | null>(null)
  const [enderecoOrigemId, setEnderecoOrigemId] = useState<string | null>(null)
  const [enderecoDestinoId, setEnderecoDestinoId] = useState<string | null>(null)
  const [quantidade, setQuantidade] = useState<number | undefined>()
  const [motivo, setMotivo] = useState('')
  const [searchProd, setSearchProd] = useState('')

  // Produtos
  const { data: produtosResp } = useQuery<any>({
    queryKey: ['transf-produtos', searchProd],
    queryFn: async () => { const { data } = await api.get('/produtos', { params: { limit: 50, search: searchProd || undefined } }); return data },
  })

  // Saldos por endereço (para selecionar origem com saldo)
  const { data: saldosResp, isLoading: loadSaldos } = useQuery<any>({
    queryKey: ['transf-saldos', produtoId],
    queryFn: async () => {
      const params: any = { limit: 200 }
      if (produtoId) params.produtoId = produtoId
      const { data } = await api.get('/posicionamento/saldo-enderecado', { params })
      return data
    },
    enabled: !!produtoId,
  })

  // Endereços livres (para destino)
  const { data: enderecosResp } = useQuery<any>({
    queryKey: ['transf-enderecos'],
    queryFn: async () => { const { data } = await api.get('/conferencia-entrada/enderecos-livres'); return data },
  })

  // Transferir
  const transferir = useMutation({
    mutationFn: async () => {
      if (!produtoId || !enderecoOrigemId || !enderecoDestinoId || !quantidade) {
        throw new Error('Preencha todos os campos')
      }
      const { data } = await api.post('/manutencao-estoque/transferencia', {
        produtoId, enderecoOrigemId, enderecoDestinoId, quantidade,
        motivo: motivo || undefined,
      })
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['transf-saldos'] })
      queryClient.invalidateQueries({ queryKey: ['transf-enderecos'] })
      queryClient.invalidateQueries({ queryKey: ['manut-historico'] })
      notifications.show({
        title: '✅ Transferência realizada',
        message: `${data.origem.endereco} (${data.origem.saldoNovo}) → ${data.destino.endereco} (${data.destino.saldoNovo})`,
        color: 'green',
      })
      resetForm()
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' }) },
  })

  function resetForm() {
    setEnderecoOrigemId(null); setEnderecoDestinoId(null); setQuantidade(undefined); setMotivo('')
  }

  const produtos = (produtosResp?.data || []).map((p: any) => ({ value: p.id, label: `${p.codigo} — ${p.nome}` }))

  // Endereços com saldo do produto selecionado (para origem)
  const saldos = saldosResp?.data || []
  const origemOptions = saldos.map((s: any) => ({
    value: s.enderecoId || s.endereco?.id,
    label: `${s.endereco?.enderecoCompleto || '?'} — Saldo: ${Number(s.quantidade)}`,
  }))

  // Endereços para destino (todos, exceto a origem)
  const destinoOptions = (enderecosResp || [])
    .filter((e: any) => e.id !== enderecoOrigemId)
    .map((e: any) => ({
      value: e.id,
      label: `${e.enderecoCompleto} ${e.ocupado ? '(Ocupado)' : '(Livre)'}`,
    }))

  // Saldo disponível na origem selecionada
  const saldoOrigem = saldos.find((s: any) => (s.enderecoId || s.endereco?.id) === enderecoOrigemId)
  const saldoDisponivel = saldoOrigem ? Number(saldoOrigem.quantidade) : 0

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Transferência entre Endereços</Text>
      <Text size="xl" fw={600} mb="lg">Transferência entre Endereços</Text>

      <Card mb="md">
        <Text fw={600} mb="md">Nova Transferência</Text>

        <Select label="Produto *" data={produtos} value={produtoId}
          onChange={(v) => { setProdutoId(v); setEnderecoOrigemId(null); setQuantidade(undefined) }}
          searchable onSearchChange={setSearchProd} placeholder="Buscar produto..." mb="md" />

        {produtoId && (
          <>
            <SimpleGrid cols={{ base: 1, sm: 2 }} mb="md">
              <Select label="Endereço Origem *" data={origemOptions} value={enderecoOrigemId}
                onChange={(v) => { setEnderecoOrigemId(v); setQuantidade(undefined) }}
                searchable placeholder="Selecionar endereço com saldo..."
                disabled={saldos.length === 0} />
              <Select label="Endereço Destino *" data={destinoOptions} value={enderecoDestinoId}
                onChange={setEnderecoDestinoId}
                searchable placeholder="Selecionar endereço destino..." />
            </SimpleGrid>

            <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
              <NumberInput label="Quantidade *" min={1} max={saldoDisponivel || undefined}
                value={quantidade}
                onChange={(v) => setQuantidade(typeof v === 'number' ? v : undefined)}
                placeholder={saldoDisponivel > 0 ? `Máx: ${saldoDisponivel}` : ''} />
              <div>
                <Text size="sm" fw={500} mb={4}>Saldo Disponível</Text>
                <Text size="xl" fw={700} c={saldoDisponivel > 0 ? 'green' : 'red'}>
                  {saldoDisponivel}
                </Text>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <Button fullWidth leftSection={<IconArrowsExchange size={16} />}
                  onClick={() => transferir.mutate()} loading={transferir.isPending}
                  disabled={!enderecoOrigemId || !enderecoDestinoId || !quantidade || quantidade > saldoDisponivel}>
                  Transferir
                </Button>
              </div>
            </SimpleGrid>

            {quantidade && quantidade > saldoDisponivel && (
              <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" mb="md">
                Quantidade excede o saldo disponível ({saldoDisponivel}).
              </Alert>
            )}
          </>
        )}

        {produtoId && saldos.length === 0 && !loadSaldos && (
          <Alert icon={<IconAlertCircle size={16} />} color="orange" variant="light">
            Nenhum endereço com saldo para este produto.
          </Alert>
        )}
      </Card>

      {/* Saldos do produto selecionado */}
      {produtoId && saldos.length > 0 && (
        <Card pos="relative">
          <LoadingOverlay visible={loadSaldos} />
          <Text fw={600} mb="md">Saldos do Produto ({saldos.length} endereço(s))</Text>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Endereço</Table.Th><Table.Th>Rua</Table.Th><Table.Th>Prédio</Table.Th>
                <Table.Th>Nível</Table.Th><Table.Th>Lote</Table.Th><Table.Th>Quantidade</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {saldos.map((s: any) => (
                <Table.Tr key={s.id} bg={(s.enderecoId || s.endereco?.id) === enderecoOrigemId ? 'blue.0' : undefined}>
                  <Table.Td className="font-mono" fw={500}>{s.endereco?.enderecoCompleto || '—'}</Table.Td>
                  <Table.Td>{s.endereco?.codigoRua || '—'}</Table.Td>
                  <Table.Td>{s.endereco?.codigoPredio || '—'}</Table.Td>
                  <Table.Td>{s.endereco?.codigoNivel || '—'}</Table.Td>
                  <Table.Td>{s.lote || '—'}</Table.Td>
                  <Table.Td fw={600}>{Number(s.quantidade)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Card>
      )}
    </div>
  )
}
