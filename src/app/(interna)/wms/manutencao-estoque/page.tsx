'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, Select, NumberInput,
  TextInput, Textarea, LoadingOverlay, Alert, SimpleGrid, ThemeIcon,
  Tabs, Pagination,
} from '@mantine/core'
import {
  IconAdjustments, IconPlus, IconMinus, IconCheck, IconRefresh,
  IconSearch, IconAlertCircle, IconHistory, IconClipboardList,
} from '@tabler/icons-react'
import { DateInput } from '@mantine/dates'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const tipoOptions = [
  { value: 'AJUSTE_ENTRADA', label: 'Ajuste de Entrada (+)' },
  { value: 'AJUSTE_SAIDA', label: 'Ajuste de Saída (-)' },
  { value: 'INVENTARIO', label: 'Inventário' },
  { value: 'AVARIA', label: 'Avaria' },
  { value: 'VENCIMENTO', label: 'Vencimento' },
]

const tipoColors: Record<string, string> = {
  AJUSTE_ENTRADA: 'green', AJUSTE_SAIDA: 'red', INVENTARIO: 'blue',
  AVARIA: 'orange', VENCIMENTO: 'yellow', ENDERECAMENTO: 'teal', TRANSFERENCIA: 'grape',
}

export default function ManutencaoEstoquePage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - Manutenção de Estoque' }, [])
  const queryClient = useQueryClient()

  // Ajuste state
  const [produtoId, setProdutoId] = useState<string | null>(null)
  const [enderecoId, setEnderecoId] = useState<string | null>(null)
  const [quantidade, setQuantidade] = useState<number | undefined>()
  const [tipo, setTipo] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const [searchProd, setSearchProd] = useState('')

  // Histórico state
  const [histPage, setHistPage] = useState(1)
  const [histTipo, setHistTipo] = useState<string | null>(null)
  const [histProdutoId, setHistProdutoId] = useState<string | null>(null)
  const [histSearchProd, setHistSearchProd] = useState('')
  const [histDataInicio, setHistDataInicio] = useState<Date | null>(null)
  const [histDataFim, setHistDataFim] = useState<Date | null>(null)

  // Produtos
  const { data: produtosResp } = useQuery<any>({
    queryKey: ['manut-produtos', searchProd],
    queryFn: async () => { const { data } = await api.get('/produtos', { params: { limit: 50, search: searchProd || undefined } }); return data },
  })

  // Produtos para filtro do histórico
  const { data: histProdutosResp } = useQuery<any>({
    queryKey: ['manut-hist-produtos', histSearchProd],
    queryFn: async () => { const { data } = await api.get('/produtos', { params: { limit: 50, search: histSearchProd || undefined } }); return data },
  })

  // Endereços com saldo
  const { data: enderecosResp } = useQuery<any>({
    queryKey: ['manut-enderecos'],
    queryFn: async () => { const { data } = await api.get('/conferencia-entrada/enderecos-livres'); return data },
  })

  // Saldos atuais
  const { data: saldosResp, isLoading, refetch } = useQuery<any>({
    queryKey: ['manut-saldos'],
    queryFn: async () => { const { data } = await api.get('/saldos', { params: { limit: 100 } }); return data },
  })

  // Histórico de movimentações
  const { data: historicoResp, isLoading: loadingHist } = useQuery<any>({
    queryKey: ['manut-historico', histPage, histTipo, histProdutoId, histDataInicio?.toISOString(), histDataFim?.toISOString()],
    queryFn: async () => {
      const params: Record<string, any> = { page: histPage, limit: 20 }
      if (histTipo) params.tipo = histTipo
      if (histProdutoId) params.produtoId = histProdutoId
      if (histDataInicio) params.dataInicio = histDataInicio.toISOString().split('T')[0]
      if (histDataFim) params.dataFim = histDataFim.toISOString().split('T')[0]
      const { data } = await api.get('/manutencao-estoque/historico', { params })
      return data
    },
  })

  // Ajuste
  const ajustar = useMutation({
    mutationFn: async () => {
      if (!produtoId || !enderecoId || !quantidade || !tipo || !motivo) throw new Error('Preencha todos os campos')
      const qtdFinal = ['AJUSTE_SAIDA', 'AVARIA', 'VENCIMENTO'].includes(tipo) ? -Math.abs(quantidade) : Math.abs(quantidade)
      const { data } = await api.post('/manutencao-estoque/ajuste', {
        produtoId, enderecoId, quantidade: qtdFinal, tipo, motivo,
      })
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['manut-saldos'] })
      queryClient.invalidateQueries({ queryKey: ['manut-enderecos'] })
      queryClient.invalidateQueries({ queryKey: ['manut-historico'] })
      resetForm()
      notifications.show({ title: '✅ Ajuste realizado', message: `${data.tipo}: ${data.quantidade > 0 ? '+' : ''}${data.quantidade} | Saldo: ${data.saldoAnterior} → ${data.saldoNovo}`, color: 'green' })
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' }) },
  })

  function resetForm() {
    setProdutoId(null); setEnderecoId(null); setQuantidade(undefined); setTipo(null); setMotivo('')
  }

  const produtos = (produtosResp?.data || []).map((p: any) => ({ value: p.id, label: `${p.codigo} — ${p.nome}` }))
  const histProdutos = (histProdutosResp?.data || []).map((p: any) => ({ value: p.id, label: `${p.codigo} — ${p.nome}` }))
  const enderecos = (enderecosResp || []).map((e: any) => ({
    value: e.id,
    label: `${e.enderecoCompleto} ${e.ocupado ? '(Ocupado)' : '(Livre)'}`,
  }))
  const saldos = saldosResp?.data || []
  const historico = historicoResp?.data || []
  const histTotalPages = historicoResp?.totalPages || 1

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Manutenção de Estoque</Text>
      <Text size="xl" fw={600} mb="lg">Manutenção de Estoque</Text>

      <Card>
        <Tabs defaultValue="ajuste">
          <Tabs.List mb="md">
            <Tabs.Tab value="ajuste" leftSection={<IconAdjustments size={16} />}>Ajuste de Estoque</Tabs.Tab>
            <Tabs.Tab value="saldos" leftSection={<IconClipboardList size={16} />}>Saldos ({saldosResp?.total || 0})</Tabs.Tab>
            <Tabs.Tab value="historico" leftSection={<IconHistory size={16} />}>Histórico ({historicoResp?.total || 0})</Tabs.Tab>
          </Tabs.List>

          {/* ABA AJUSTE */}
          <Tabs.Panel value="ajuste">
            <Text fw={600} mb="md">Novo Ajuste</Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }} mb="md">
              <Select label="Produto *" data={produtos} value={produtoId} onChange={setProdutoId}
                searchable onSearchChange={setSearchProd} placeholder="Buscar produto..." />
              <Select label="Endereço *" data={enderecos} value={enderecoId} onChange={setEnderecoId}
                searchable placeholder="Selecionar endereço..." />
            </SimpleGrid>
            <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
              <Select label="Tipo de Ajuste *" data={tipoOptions} value={tipo} onChange={setTipo} />
              <NumberInput label="Quantidade *" min={0} value={quantidade}
                onChange={(v) => setQuantidade(typeof v === 'number' ? v : undefined)} />
              <Textarea label="Motivo *" placeholder="Descreva o motivo do ajuste..." value={motivo}
                onChange={(e) => setMotivo(e.currentTarget.value)} minRows={1} />
            </SimpleGrid>

            {tipo && ['AJUSTE_SAIDA', 'AVARIA', 'VENCIMENTO'].includes(tipo) && (
              <Alert icon={<IconMinus size={16} />} color="red" variant="light" mb="md">
                Este ajuste irá <strong>reduzir</strong> o estoque na quantidade informada.
              </Alert>
            )}

            <Group justify="flex-end">
              <Button variant="default" onClick={resetForm}>Limpar</Button>
              <Button leftSection={<IconCheck size={16} />} onClick={() => ajustar.mutate()}
                loading={ajustar.isPending} disabled={!produtoId || !enderecoId || !quantidade || !tipo || !motivo}>
                Realizar Ajuste
              </Button>
            </Group>
          </Tabs.Panel>

          {/* ABA SALDOS */}
          <Tabs.Panel value="saldos">
            <LoadingOverlay visible={isLoading} pos="relative" />
            <Group justify="space-between" mb="md">
              <Text fw={600}>Saldos por Endereço ({saldos.length})</Text>
              <Button variant="default" size="xs" leftSection={<IconRefresh size={14} />} onClick={() => refetch()}>Atualizar</Button>
            </Group>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Endereço</Table.Th><Table.Th>Produto</Table.Th><Table.Th>Lote</Table.Th>
                  <Table.Th>Validade</Table.Th><Table.Th>Quantidade</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {saldos.map((s: any) => (
                  <Table.Tr key={s.id}>
                    <Table.Td className="font-mono">{s.endereco?.enderecoCompleto || '—'}</Table.Td>
                    <Table.Td>{s.produto?.nome || s.produto?.codigo || '—'}</Table.Td>
                    <Table.Td>{s.lote || '—'}</Table.Td>
                    <Table.Td>{s.validade ? new Date(s.validade).toLocaleDateString('pt-BR') : '—'}</Table.Td>
                    <Table.Td fw={600}>{Number(s.quantidade)}</Table.Td>
                  </Table.Tr>
                ))}
                {saldos.length === 0 && (
                  <Table.Tr><Table.Td colSpan={5} className="text-center py-8 text-zinc-500">Nenhum saldo registrado</Table.Td></Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Tabs.Panel>

          {/* ABA HISTÓRICO */}
          <Tabs.Panel value="historico">
            <Group mb="md" gap="sm">
              <Select label="Tipo" data={[
                { value: 'AJUSTE_ENTRADA', label: 'Ajuste Entrada' },
                { value: 'AJUSTE_SAIDA', label: 'Ajuste Saída' },
                { value: 'INVENTARIO', label: 'Inventário' },
                { value: 'AVARIA', label: 'Avaria' },
                { value: 'VENCIMENTO', label: 'Vencimento' },
                { value: 'ENDERECAMENTO', label: 'Endereçamento' },
                { value: 'TRANSFERENCIA', label: 'Transferência' },
              ]} value={histTipo} onChange={(v) => { setHistTipo(v); setHistPage(1) }} clearable className="w-44" />
              <Select label="Produto" data={histProdutos} value={histProdutoId}
                onChange={(v) => { setHistProdutoId(v); setHistPage(1) }}
                searchable onSearchChange={setHistSearchProd} clearable className="w-64" placeholder="Todos" />
              <DateInput label="De" value={histDataInicio} onChange={(v) => { setHistDataInicio(v); setHistPage(1) }}
                valueFormat="DD/MM/YYYY" clearable className="w-36" />
              <DateInput label="Até" value={histDataFim} onChange={(v) => { setHistDataFim(v); setHistPage(1) }}
                valueFormat="DD/MM/YYYY" clearable className="w-36" />
            </Group>

            <div style={{ position: 'relative' }}>
              <LoadingOverlay visible={loadingHist} />
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Data/Hora</Table.Th>
                    <Table.Th>Tipo</Table.Th>
                    <Table.Th>Produto</Table.Th>
                    <Table.Th>Endereço</Table.Th>
                    <Table.Th>Quantidade</Table.Th>
                    <Table.Th>Saldo Anterior</Table.Th>
                    <Table.Th>Saldo Novo</Table.Th>
                    <Table.Th>Motivo</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {historico.map((h: any) => (
                    <Table.Tr key={h.id}>
                      <Table.Td className="text-sm">{new Date(h.criadoEm).toLocaleString('pt-BR')}</Table.Td>
                      <Table.Td>
                        <Badge color={tipoColors[h.tipo] || 'gray'} variant="light" size="sm">{h.tipo}</Badge>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" fw={500}>{h.produto?.nome || '—'}</Text>
                        <Text size="xs" c="dimmed" className="font-mono">{h.produto?.codigo || ''}</Text>
                      </Table.Td>
                      <Table.Td className="font-mono text-sm">{h.endereco?.enderecoCompleto || '—'}</Table.Td>
                      <Table.Td>
                        <Text fw={600} c={h.quantidade >= 0 ? 'green' : 'red'}>
                          {h.quantidade > 0 ? `+${h.quantidade}` : h.quantidade}
                        </Text>
                      </Table.Td>
                      <Table.Td className="text-sm">{h.saldoAnterior}</Table.Td>
                      <Table.Td className="text-sm" fw={500}>{h.saldoNovo}</Table.Td>
                      <Table.Td className="text-sm max-w-[200px] truncate">{h.motivo || '—'}</Table.Td>
                    </Table.Tr>
                  ))}
                  {historico.length === 0 && (
                    <Table.Tr><Table.Td colSpan={8} className="text-center py-8 text-zinc-500">Nenhuma movimentação registrada</Table.Td></Table.Tr>
                  )}
                </Table.Tbody>
              </Table>
            </div>

            {histTotalPages > 1 && (
              <Group justify="center" mt="md">
                <Pagination total={histTotalPages} value={histPage} onChange={setHistPage} />
              </Group>
            )}
          </Tabs.Panel>
        </Tabs>
      </Card>
    </div>
  )
}
