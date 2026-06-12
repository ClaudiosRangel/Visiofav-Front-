'use client'

import { useState, useEffect } from 'react'
import { Card, Group, Text, TextInput, Table, Badge, LoadingOverlay, Pagination, Alert } from '@mantine/core'
import { IconSearch, IconLock } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

export default function ConsultaClientesPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Consulta Clientes' }, [])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20

  const { data: response, isLoading } = useQuery<any>({
    queryKey: ['clientes', { busca: search || undefined, page, limit }],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit }
      if (search) params.busca = search
      const { data } = await api.get('/clientes', { params })
      return data
    },
  })

  const items = response?.data || []
  const total = response?.total || 0
  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Consulta / Clientes</Text>
      <Text size="xl" fw={600} mb="lg">Clientes (Consulta)</Text>

      <Alert icon={<IconLock size={16} />} color="blue" variant="light" mb="md">
        Visualização somente leitura. Para cadastrar ou editar clientes, acesse o módulo de Vendas.
      </Alert>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Group mb="md">
          <TextInput placeholder="Pesquisar por nome ou CPF/CNPJ..." leftSection={<IconSearch size={16} />} value={search} onChange={(e) => { setSearch(e.currentTarget.value); setPage(1) }} className="w-80" />
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Razão Social</Table.Th><Table.Th>Nome Fantasia</Table.Th><Table.Th>CPF/CNPJ</Table.Th>
              <Table.Th>Cidade/UF</Table.Th><Table.Th>Telefone</Table.Th><Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td fw={500}>{item.razaoSocial}</Table.Td>
                <Table.Td>{item.nomeFantasia || '—'}</Table.Td>
                <Table.Td className="font-mono text-sm">{item.cpfCnpj || '—'}</Table.Td>
                <Table.Td>{item.cidade ? `${item.cidade}/${item.uf}` : '—'}</Table.Td>
                <Table.Td>{item.telefone || '—'}</Table.Td>
                <Table.Td><Badge color={item.status ? 'green' : 'gray'}>{item.status ? 'Ativo' : 'Inativo'}</Badge></Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && items.length === 0 && <Table.Tr><Table.Td colSpan={6} className="text-center py-8 text-zinc-500">Nenhum cliente cadastrado</Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>
        {totalPages > 1 && <Group justify="center" mt="md"><Pagination total={totalPages} value={page} onChange={setPage} /></Group>}
      </Card>
    </div>
  )
}
