'use client'

import { useState } from 'react'
import { Button, Card, Group, Text, TextInput, Table, Badge, ActionIcon, Tooltip, LoadingOverlay, Pagination } from '@mantine/core'
import { IconPlus, IconSearch, IconEdit, IconBan, IconRefresh } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import FornecedorModal from './FornecedorModal'

export default function FornecedoresPage() {
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20

  const { data: response, isLoading, refetch } = useQuery<any>({
    queryKey: ['fornecedores', { busca: search || undefined, page, limit }],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit }
      if (search) params.busca = search
      const { data } = await api.get('/fornecedores', { params })
      return data
    },
  })

  const inativar = useMutation({
    mutationFn: async (id: string) => { await api.patch(`/fornecedores/${id}/inativar`) },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['fornecedores'] }); notifications.show({ title: 'Sucesso', message: 'Fornecedor inativado', color: 'green' }) },
    onError: () => { notifications.show({ title: 'Erro', message: 'Falha ao inativar', color: 'red' }) },
  })

  function handleNew() { setEditItem(null); setModalOpen(true) }
  function handleEdit(item: any) { setEditItem(item); setModalOpen(true) }

  const items = response?.data || []
  const total = response?.total || 0
  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Configurador / Fornecedores</Text>
      <Text size="xl" fw={600} mb="lg">Fornecedores</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Group justify="space-between" mb="md">
          <TextInput placeholder="Pesquisar por nome ou CNPJ..." leftSection={<IconSearch size={16} />} value={search} onChange={(e) => { setSearch(e.currentTarget.value); setPage(1) }} className="w-80" />
          <Group>
            <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
            <Button leftSection={<IconPlus size={16} />} onClick={handleNew}>Novo Fornecedor</Button>
          </Group>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Razão Social</Table.Th>
              <Table.Th>Nome Fantasia</Table.Th>
              <Table.Th>CNPJ</Table.Th>
              <Table.Th>Cidade/UF</Table.Th>
              <Table.Th>Telefone</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th className="w-24">Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td fw={500}>{item.razaoSocial}</Table.Td>
                <Table.Td>{item.nomeFantasia || '—'}</Table.Td>
                <Table.Td className="text-sm font-mono">{item.cnpj || '—'}</Table.Td>
                <Table.Td>{item.cidade ? `${item.cidade}/${item.uf}` : '—'}</Table.Td>
                <Table.Td>{item.telefone || '—'}</Table.Td>
                <Table.Td><Badge color={item.status ? 'green' : 'gray'}>{item.status ? 'Ativo' : 'Inativo'}</Badge></Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <Tooltip label="Editar"><ActionIcon variant="subtle" color="gray" onClick={() => handleEdit(item)}><IconEdit size={18} /></ActionIcon></Tooltip>
                    {item.status && (
                      <Tooltip label="Inativar"><ActionIcon variant="subtle" color="red" onClick={() => { if (confirm(`Inativar "${item.razaoSocial}"?`)) inativar.mutate(item.id) }}><IconBan size={18} /></ActionIcon></Tooltip>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && items.length === 0 && (
              <Table.Tr><Table.Td colSpan={7} className="text-center py-8 text-zinc-500">Nenhum fornecedor cadastrado</Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>

        {totalPages > 1 && <Group justify="center" mt="md"><Pagination total={totalPages} value={page} onChange={setPage} /></Group>}
      </Card>

      <FornecedorModal opened={modalOpen} onClose={() => { setModalOpen(false); setEditItem(null) }} editData={editItem} />
    </div>
  )
}
