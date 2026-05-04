'use client'

import { useState, useEffect } from 'react'
import { Button, Card, Group, Text, Select, NumberInput, Table, LoadingOverlay } from '@mantine/core'
import { IconArrowLeft } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useRouter } from 'next/navigation'

interface ItemDevolucao {
  produtoId: string
  produtoNome: string
  quantidadeMax: number
  quantidade: number
  precoUnitario: number
}

export default function DevolucoesPage() {
  useModuloGuard('COMPRAS')
  useEffect(() => { document.title = 'VisioFab - Compras - Devoluções' }, [])
  const router = useRouter()
  const [compraId, setCompraId] = useState<string | null>(null)
  const [itens, setItens] = useState<ItemDevolucao[]>([])

  const { data: comprasData, isLoading: loadingCompras } = useQuery<any>({
    queryKey: ['compras', { page: 1, limit: 100 }],
    queryFn: async () => {
      const { data } = await api.get('/compras', { params: { limit: 100 } })
      return data
    },
  })

  const { data: compraDetalhe, isLoading: loadingDetalhe } = useQuery<any>({
    queryKey: ['compra-detalhe', compraId],
    queryFn: async () => {
      if (!compraId) return null
      const { data } = await api.get(`/compras/${compraId}`)
      return data
    },
    enabled: !!compraId,
  })

  // Quando compra é selecionada, popular itens
  const handleSelectCompra = (id: string | null) => {
    setCompraId(id)
    setItens([])
  }

  // Quando detalhe carrega, popular itens
  if (compraDetalhe && itens.length === 0 && compraDetalhe.pedidoCompra?.itens) {
    const novosItens = compraDetalhe.pedidoCompra.itens.map((item: any) => ({
      produtoId: item.produtoId,
      produtoNome: item.produto?.nome || item.produtoId,
      quantidadeMax: Number(item.quantidade),
      quantidade: 0,
      precoUnitario: Number(item.precoUnitario),
    }))
    setItens(novosItens)
  }

  const devolver = useMutation({
    mutationFn: async () => {
      const itensParaDevolver = itens.filter((i) => i.quantidade > 0)
      if (itensParaDevolver.length === 0) throw new Error('Selecione ao menos um item')
      const { data } = await api.post(`/compras/${compraId}/devolver`, {
        itens: itensParaDevolver.map((i) => ({
          produtoId: i.produtoId,
          quantidade: i.quantidade,
          precoUnitario: i.precoUnitario,
        })),
      })
      return data
    },
    onSuccess: () => {
      notifications.show({ title: 'Sucesso', message: 'Devolução registrada', color: 'green' })
      setCompraId(null)
      setItens([])
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' })
    },
  })

  const compraOptions = (comprasData?.data || []).map((c: any) => ({
    value: c.id,
    label: `Pedido #${c.pedidoCompra?.numero} — ${c.pedidoCompra?.fornecedor?.razaoSocial}`,
  }))

  const totalDevolucao = itens.reduce((sum, i) => sum + i.quantidade * i.precoUnitario, 0)

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Compras / Devoluções</Text>
      <Group mb="lg">
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => router.push('/compras/pedidos')}>Voltar</Button>
        <Text size="xl" fw={600}>Devolução de Compra</Text>
      </Group>

      <Card mb="md" pos="relative">
        <LoadingOverlay visible={loadingCompras} />
        <Select
          label="Selecione a compra efetivada"
          placeholder="Buscar compra..."
          data={compraOptions}
          value={compraId}
          onChange={handleSelectCompra}
          searchable
          clearable
          className="max-w-lg"
        />
      </Card>

      {compraId && itens.length > 0 && (
        <Card pos="relative">
          <LoadingOverlay visible={loadingDetalhe} />
          <Text fw={500} mb="sm">Itens para devolução</Text>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Produto</Table.Th>
                <Table.Th>Qtd. Recebida</Table.Th>
                <Table.Th>Qtd. Devolver</Table.Th>
                <Table.Th>Preço Unit.</Table.Th>
                <Table.Th>Subtotal</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {itens.map((item, idx) => (
                <Table.Tr key={item.produtoId}>
                  <Table.Td>{item.produtoNome}</Table.Td>
                  <Table.Td>{item.quantidadeMax}</Table.Td>
                  <Table.Td>
                    <NumberInput
                      min={0}
                      max={item.quantidadeMax}
                      value={item.quantidade}
                      onChange={(val) => {
                        const novo = [...itens]
                        novo[idx] = { ...novo[idx], quantidade: typeof val === 'number' ? val : 0 }
                        setItens(novo)
                      }}
                      size="xs"
                      className="w-28"
                    />
                  </Table.Td>
                  <Table.Td>{item.precoUnitario.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
                  <Table.Td fw={500}>{(item.quantidade * item.precoUnitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          <Group justify="space-between" mt="md">
            <Text size="lg" fw={600}>Total devolução: {totalDevolucao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Text>
            <Button onClick={() => devolver.mutate()} loading={devolver.isPending} disabled={totalDevolucao === 0}>
              Registrar Devolução
            </Button>
          </Group>
        </Card>
      )}
    </div>
  )
}
