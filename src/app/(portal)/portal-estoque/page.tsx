'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Button, LoadingOverlay, TextInput, Pagination,
} from '@mantine/core'
import { IconSearch, IconDownload } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { portalApi } from '@/lib/portalApi'

export default function PortalEstoquePage() {
  useEffect(() => { document.title = 'Portal 3PL - Meu Estoque' }, [])

  const [busca, setBusca] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 20

  const { data: response, isLoading } = useQuery<any>({
    queryKey: ['portal-meu-estoque', page, busca],
    queryFn: async () => {
      const { data } = await portalApi.get('/portal/estoque', {
        params: { page, pageSize, busca: busca || undefined },
      })
      return data
    },
  })

  const itens = response?.data || []
  const total = response?.total || 0
  const totalPages = Math.ceil(total / pageSize)

  async function exportar() {
    try {
      const { data } = await portalApi.get('/portal/estoque/export', { responseType: 'blob' })
      const url = window.URL.createObjectURL(new Blob([data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `estoque-${new Date().toISOString().split('T')[0]}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      // silenciar erro de export
    }
  }

  return (
    <div>
      <Text size="xl" fw={600} mb="lg">Meu Estoque</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />

        <Group justify="space-between" mb="md">
          <TextInput
            placeholder="Buscar produto..."
            leftSection={<IconSearch size={16} />}
            value={busca}
            onChange={(e) => { setBusca(e.currentTarget.value); setPage(1) }}
            className="w-72"
          />
          <Button variant="light" leftSection={<IconDownload size={16} />} onClick={exportar}>
            Exportar
          </Button>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Produto</Table.Th>
              <Table.Th>Quantidade</Table.Th>
              <Table.Th>Lote</Table.Th>
              <Table.Th>Validade</Table.Th>
              <Table.Th>Endereço</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {itens.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td fw={500}>{item.produto?.nome || item.produtoNome || '—'}</Table.Td>
                <Table.Td>{item.quantidade}</Table.Td>
                <Table.Td className="font-mono">{item.lote || '—'}</Table.Td>
                <Table.Td>
                  {item.validade ? new Date(item.validade).toLocaleDateString('pt-BR') : '—'}
                </Table.Td>
                <Table.Td className="font-mono">{item.endereco || '—'}</Table.Td>
              </Table.Tr>
            ))}
            {itens.length === 0 && (
              <Table.Tr><Table.Td colSpan={5} className="text-center py-8 text-zinc-500">Nenhum item em estoque</Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>

        {totalPages > 1 && (
          <Group justify="center" mt="md">
            <Pagination total={totalPages} value={page} onChange={setPage} />
          </Group>
        )}
      </Card>
    </div>
  )
}
