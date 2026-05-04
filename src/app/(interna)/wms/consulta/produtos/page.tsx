'use client'

import { useState, useEffect } from 'react'
import { Card, Group, Text, TextInput, Table, Badge, LoadingOverlay, Pagination, Drawer, ActionIcon, Tooltip, Button } from '@mantine/core'
import { IconSearch, IconPackage, IconRefresh } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import SkuPanel from '../../../configurador/produtos/SkuPanel'

export default function ConsultaProdutosPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - Consulta Produtos' }, [])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [skuDrawer, setSkuDrawer] = useState<{ id: string; nome: string } | null>(null)
  const limit = 20

  const { data: response, isLoading, refetch } = useQuery<any>({
    queryKey: ['produtos', { busca: search || undefined, page, limit }],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit }
      if (search) params.search = search
      const { data } = await api.get('/produtos', { params })
      return data
    },
  })

  const items = response?.data || []
  const total = response?.total || 0
  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Consulta / Produtos</Text>
      <Text size="xl" fw={600} mb="lg">Produtos</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Group justify="space-between" mb="md">
          <TextInput placeholder="Pesquisar por nome ou código..." leftSection={<IconSearch size={16} />} value={search} onChange={(e) => { setSearch(e.currentTarget.value); setPage(1) }} className="w-80" />
          <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Código</Table.Th><Table.Th>Nome</Table.Th><Table.Th>Unidade</Table.Th>
              <Table.Th>EAN</Table.Th><Table.Th>NCM</Table.Th><Table.Th>Status</Table.Th>
              <Table.Th className="w-20">SKU</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td className="font-mono">{item.codigo}</Table.Td>
                <Table.Td fw={500}>{item.nome || item.descricao}</Table.Td>
                <Table.Td>{item.unidade}</Table.Td>
                <Table.Td className="font-mono text-sm">{item.cEAN || '—'}</Table.Td>
                <Table.Td className="font-mono text-sm">{item.ncm || '—'}</Table.Td>
                <Table.Td><Badge color={item.status ? 'green' : 'gray'}>{item.status ? 'Ativo' : 'Inativo'}</Badge></Table.Td>
                <Table.Td>
                  <Tooltip label="SKUs / Embalagens">
                    <ActionIcon variant="light" color="blue" onClick={() => setSkuDrawer({ id: item.id, nome: item.nome || item.descricao || item.codigo })}>
                      <IconPackage size={18} />
                    </ActionIcon>
                  </Tooltip>
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && items.length === 0 && <Table.Tr><Table.Td colSpan={7} className="text-center py-8 text-zinc-500">Nenhum produto cadastrado</Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>
        {totalPages > 1 && <Group justify="center" mt="md"><Pagination total={totalPages} value={page} onChange={setPage} /></Group>}
      </Card>

      <Drawer opened={!!skuDrawer} onClose={() => setSkuDrawer(null)} title="SKUs / Embalagens" position="right" size="xl">
        {skuDrawer && <SkuPanel produtoId={skuDrawer.id} produtoNome={skuDrawer.nome} />}
      </Drawer>
    </div>
  )
}
