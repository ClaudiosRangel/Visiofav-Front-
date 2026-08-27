'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card, Group, Text, Table, Badge, Button, Select, TextInput, NumberInput,
  LoadingOverlay, Modal, ActionIcon, Tooltip, Tabs,
} from '@mantine/core'
import {
  IconRefresh, IconShoppingCart, IconTrash, IconEdit, IconSearch, IconClipboardCheck,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const statusColors: Record<string, string> = {
  PENDENTE: 'orange', CONVERTIDA: 'green', CANCELADA: 'red',
}

interface Requisicao {
  id: string
  produtoId: string
  produtoCodigo: string | null
  produtoNome: string | null
  descricao: string
  quantidade: number
  unidadeMedida: string
  fornecedorId: string | null
  fornecedorNome: string | null
  dataNecessidade: string | null
  opNumero: string | number | null
  status: string
  pedidoCompraId: string | null
}

export default function RequisicoesCompraPage() {
  useModuloGuard('COMPRAS')
  useEffect(() => { document.title = 'Compras - Requisições de Compra' }, [])
  const router = useRouter()
  const queryClient = useQueryClient()

  const [statusFiltro, setStatusFiltro] = useState<string>('PENDENTE')
  const [busca, setBusca] = useState('')
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set())
  const [modalConverter, setModalConverter] = useState(false)
  const [fornecedorConversao, setFornecedorConversao] = useState<string | null>(null)
  const [editando, setEditando] = useState<Requisicao | null>(null)
  const [editQtd, setEditQtd] = useState<number | ''>('')

  // Lista de requisições
  const { data: resp, isLoading, refetch } = useQuery<any>({
    queryKey: ['requisicoes-compra', statusFiltro, busca],
    queryFn: async () => {
      const params: any = {}
      if (statusFiltro !== 'TODAS') params.status = statusFiltro
      if (busca) params.busca = busca
      const { data } = await api.get('/pcp/analise-producao/sugestoes-compra', { params })
      return data
    },
  })

  // Fornecedores para o modal de conversão
  const { data: fornecedoresResp } = useQuery<any>({
    queryKey: ['fornecedores-select'],
    queryFn: async () => { const { data } = await api.get('/fornecedores', { params: { limit: 200 } }); return data },
    staleTime: 1000 * 60 * 5,
  })

  const requisicoes: Requisicao[] = Array.isArray(resp) ? resp : resp?.data || resp || []
  const fornecedorOptions = (fornecedoresResp?.data || []).map((f: any) => ({
    value: f.id, label: f.nomeFantasia || f.razaoSocial,
  }))

  const pendentes = requisicoes.filter((r) => r.status === 'PENDENTE')

  function toggleSelecao(id: string) {
    setSelecionadas((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleSelecaoTodas() {
    const idsPendentes = pendentes.map((r) => r.id)
    setSelecionadas((prev) => {
      const todas = idsPendentes.every((id) => prev.has(id))
      return todas ? new Set() : new Set(idsPendentes)
    })
  }

  // Converter em pedido de compra
  const converter = useMutation({
    mutationFn: async () => {
      if (!fornecedorConversao) throw new Error('Selecione um fornecedor')
      const { data } = await api.post('/pcp/analise-producao/sugestoes-compra/converter', {
        sugestaoIds: Array.from(selecionadas),
        fornecedorId: fornecedorConversao,
      })
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['requisicoes-compra'] })
      setModalConverter(false)
      setSelecionadas(new Set())
      setFornecedorConversao(null)
      notifications.show({
        title: '✅ Pedido de compra gerado',
        message: `Pedido #${data.numero} criado com ${data.itensCriados} item(ns).`,
        color: 'green',
      })
      // Oferece navegar para o pedido criado
      if (data.pedidoCompraId) {
        setTimeout(() => router.push(`/compras/pedidos`), 800)
      }
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' })
    },
  })

  // Cancelar requisição
  const cancelar = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/pcp/analise-producao/sugestoes-compra/${id}`) },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisicoes-compra'] })
      notifications.show({ title: 'Requisição cancelada', message: 'A requisição foi cancelada', color: 'orange' })
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) },
  })

  // Editar quantidade
  const editar = useMutation({
    mutationFn: async () => {
      if (!editando) return
      await api.patch(`/pcp/analise-producao/sugestoes-compra/${editando.id}`, {
        quantidade: typeof editQtd === 'number' ? editQtd : undefined,
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requisicoes-compra'] })
      setEditando(null)
      notifications.show({ title: 'Requisição atualizada', message: 'Quantidade ajustada', color: 'green' })
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) },
  })

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Compras / Requisições de Compra</Text>
      <Text size="xl" fw={600} mb="lg">Requisições de Compra</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />

        {/* Filtros + ações */}
        <Group justify="space-between" mb="md" wrap="wrap">
          <Group>
            <TextInput
              placeholder="Buscar por produto..."
              leftSection={<IconSearch size={16} />}
              value={busca}
              onChange={(e) => setBusca(e.currentTarget.value)}
              w={240}
            />
            <Select
              data={[
                { value: 'PENDENTE', label: 'Pendentes' },
                { value: 'CONVERTIDA', label: 'Convertidas' },
                { value: 'CANCELADA', label: 'Canceladas' },
                { value: 'TODAS', label: 'Todas' },
              ]}
              value={statusFiltro}
              onChange={(v) => setStatusFiltro(v || 'PENDENTE')}
              w={160}
            />
          </Group>
          <Group>
            <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
            <Button
              leftSection={<IconShoppingCart size={16} />}
              disabled={selecionadas.size === 0}
              onClick={() => {
                // Pré-preenche o fornecedor com o sugerido da primeira selecionada
                const primeira = requisicoes.find((r) => selecionadas.has(r.id))
                setFornecedorConversao(primeira?.fornecedorId || null)
                setModalConverter(true)
              }}
            >
              Gerar Pedido de Compra ({selecionadas.size})
            </Button>
          </Group>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 30 }}>
                <input
                  type="checkbox"
                  onChange={toggleSelecaoTodas}
                  checked={pendentes.length > 0 && pendentes.every((r) => selecionadas.has(r.id))}
                  style={{ cursor: 'pointer' }}
                />
              </Table.Th>
              <Table.Th>Produto</Table.Th>
              <Table.Th>Qtd</Table.Th>
              <Table.Th>Fornecedor Sugerido</Table.Th>
              <Table.Th>OP Origem</Table.Th>
              <Table.Th>Necessidade</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {requisicoes.map((r) => (
              <Table.Tr key={r.id}>
                <Table.Td>
                  {r.status === 'PENDENTE' && (
                    <input
                      type="checkbox"
                      checked={selecionadas.has(r.id)}
                      onChange={() => toggleSelecao(r.id)}
                      style={{ cursor: 'pointer' }}
                    />
                  )}
                </Table.Td>
                <Table.Td>
                  <Text size="sm" fw={500}>{r.produtoCodigo ? `${r.produtoCodigo} — ` : ''}{r.produtoNome || r.descricao}</Text>
                </Table.Td>
                <Table.Td>{Number(r.quantidade).toLocaleString('pt-BR')} {r.unidadeMedida}</Table.Td>
                <Table.Td>{r.fornecedorNome || <Text c="dimmed" span size="sm">—</Text>}</Table.Td>
                <Table.Td>{r.opNumero ? `#${r.opNumero}` : '—'}</Table.Td>
                <Table.Td>{r.dataNecessidade ? new Date(r.dataNecessidade).toLocaleDateString('pt-BR') : '—'}</Table.Td>
                <Table.Td><Badge color={statusColors[r.status] || 'gray'} variant="light">{r.status}</Badge></Table.Td>
                <Table.Td>
                  <Group gap={4} wrap="nowrap">
                    {r.status === 'PENDENTE' && (
                      <>
                        <Tooltip label="Editar quantidade">
                          <ActionIcon variant="subtle" color="blue" onClick={() => { setEditando(r); setEditQtd(Number(r.quantidade)) }}>
                            <IconEdit size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Cancelar requisição">
                          <ActionIcon variant="subtle" color="red" onClick={() => {
                            if (confirm('Cancelar esta requisição?')) cancelar.mutate(r.id)
                          }}>
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </>
                    )}
                    {r.status === 'CONVERTIDA' && r.pedidoCompraId && (
                      <Button size="compact-xs" variant="light" onClick={() => router.push('/compras/pedidos')}>
                        Ver Pedido
                      </Button>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && requisicoes.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={8} className="text-center py-8 text-zinc-500">
                  Nenhuma requisição de compra. As requisições são geradas na Análise de Produção (PCP)
                  ao clicar em &quot;Gerar Requisições de Compra&quot;.
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      {/* Modal: converter em pedido */}
      <Modal opened={modalConverter} onClose={() => setModalConverter(false)} title={`Gerar Pedido de Compra (${selecionadas.size} requisição(ões))`} centered>
        <Text size="sm" c="dimmed" mb="md">
          As requisições selecionadas serão agrupadas em um único pedido de compra (rascunho).
          Confirme o fornecedor:
        </Text>
        <Select
          label="Fornecedor"
          placeholder="Selecione o fornecedor"
          data={fornecedorOptions}
          value={fornecedorConversao}
          onChange={setFornecedorConversao}
          searchable
          mb="md"
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setModalConverter(false)}>Cancelar</Button>
          <Button
            leftSection={<IconShoppingCart size={16} />}
            onClick={() => converter.mutate()}
            loading={converter.isPending}
            disabled={!fornecedorConversao}
          >
            Confirmar
          </Button>
        </Group>
      </Modal>

      {/* Modal: editar quantidade */}
      <Modal opened={!!editando} onClose={() => setEditando(null)} title="Editar Requisição" centered>
        <Text size="sm" mb="xs">{editando?.produtoNome || editando?.descricao}</Text>
        <NumberInput
          label="Quantidade"
          value={editQtd}
          onChange={(v) => setEditQtd(typeof v === 'number' ? v : '')}
          min={0.001}
          decimalScale={4}
          mb="md"
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setEditando(null)}>Cancelar</Button>
          <Button onClick={() => editar.mutate()} loading={editar.isPending}>Salvar</Button>
        </Group>
      </Modal>
    </div>
  )
}
