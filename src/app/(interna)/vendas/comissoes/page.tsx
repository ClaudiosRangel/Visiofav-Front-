'use client'

import { useEffect } from 'react'
import { Button, Card, Group, Text, Table, LoadingOverlay } from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

export default function ComissoesPage() {
  useModuloGuard('VENDAS')
  useEffect(() => { document.title = 'VisioFab - Vendas - Comissões' }, [])

  const { data: vendas, isLoading, refetch } = useQuery<any[]>({
    queryKey: ['comissoes'],
    queryFn: async () => { const { data } = await api.get('/vendas/comissoes'); return data },
  })

  // Agrupar por vendedor
  const porVendedor = (vendas || []).reduce((acc: Record<string, { nome: string; totalVendas: number; totalComissao: number; qtd: number }>, v: any) => {
    const vendedor = v.pedidoVenda?.vendedor
    if (!vendedor) return acc
    if (!acc[vendedor.id]) acc[vendedor.id] = { nome: vendedor.nome, totalVendas: 0, totalComissao: 0, qtd: 0 }
    acc[vendedor.id].totalVendas += Number(v.valorTotal)
    acc[vendedor.id].totalComissao += Number(v.comissaoValor || 0)
    acc[vendedor.id].qtd += 1
    return acc
  }, {})

  const resumo = Object.values(porVendedor)
  const totalGeral = resumo.reduce((s, v) => s + v.totalComissao, 0)

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Vendas / Comissões</Text>
      <Text size="xl" fw={600} mb="lg">Relatório de Comissões</Text>

      <Card pos="relative" mb="md">
        <LoadingOverlay visible={isLoading} />
        <Group justify="flex-end" mb="md">
          <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Vendedor</Table.Th>
              <Table.Th>Vendas</Table.Th>
              <Table.Th>Total Vendido</Table.Th>
              <Table.Th>Total Comissão</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {resumo.map((v, idx) => (
              <Table.Tr key={idx}>
                <Table.Td fw={500}>{v.nome}</Table.Td>
                <Table.Td>{v.qtd}</Table.Td>
                <Table.Td>{v.totalVendas.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
                <Table.Td fw={600} c="green">{v.totalComissao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && resumo.length === 0 && <Table.Tr><Table.Td colSpan={4} className="text-center py-8 text-zinc-500">Nenhuma comissão registrada</Table.Td></Table.Tr>}
          </Table.Tbody>
          {resumo.length > 0 && (
            <Table.Tfoot>
              <Table.Tr>
                <Table.Td colSpan={3} fw={600}>Total Geral</Table.Td>
                <Table.Td fw={700} c="green">{totalGeral.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
              </Table.Tr>
            </Table.Tfoot>
          )}
        </Table>
      </Card>

      {/* Detalhamento */}
      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Text fw={500} mb="sm">Detalhamento por Venda</Text>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Pedido #</Table.Th>
              <Table.Th>Cliente</Table.Th>
              <Table.Th>Vendedor</Table.Th>
              <Table.Th>Valor Venda</Table.Th>
              <Table.Th>% Comissão</Table.Th>
              <Table.Th>Valor Comissão</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(vendas || []).map((v: any) => (
              <Table.Tr key={v.id}>
                <Table.Td>{v.pedidoVenda?.numero}</Table.Td>
                <Table.Td>{v.pedidoVenda?.cliente?.razaoSocial}</Table.Td>
                <Table.Td>{v.pedidoVenda?.vendedor?.nome || '—'}</Table.Td>
                <Table.Td>{Number(v.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
                <Table.Td>{v.pedidoVenda?.vendedor?.comissao ? `${Number(v.pedidoVenda.vendedor.comissao).toFixed(2)}%` : '—'}</Table.Td>
                <Table.Td fw={500}>{v.comissaoValor ? Number(v.comissaoValor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '—'}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>
    </div>
  )
}
