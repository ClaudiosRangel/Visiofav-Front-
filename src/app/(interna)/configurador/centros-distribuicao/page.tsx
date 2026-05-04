'use client'

import { useState } from 'react'
import { Button, Card, Group, Text, TextInput, Table, Badge, ActionIcon, Tooltip, LoadingOverlay } from '@mantine/core'
import { IconPlus, IconSearch, IconEdit, IconTrash, IconRefresh } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useCentrosDistribuicao, useExcluirCentroDistribuicao } from '@/data/hooks/useCentroDistribuicao'
import CentroDistModal from './CentroDistModal'

export default function CentrosDistribuicaoPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Record<string, unknown> | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)

  const { data: response, isLoading, refetch } = useCentrosDistribuicao({ page, limit: 20, search: search || undefined })
  const excluir = useExcluirCentroDistribuicao()

  function handleEdit(item: Record<string, unknown>) {
    setEditItem(item)
    setModalOpen(true)
  }

  function handleNew() {
    setEditItem(null)
    setModalOpen(true)
  }

  async function handleDelete(id: string, descricao: string) {
    if (!confirm(`Deseja excluir "${descricao}"?`)) return
    try {
      await excluir.mutateAsync(id)
      notifications.show({ title: 'Sucesso', message: 'Registro excluído', color: 'green' })
    } catch {
      notifications.show({ title: 'Erro', message: 'Não foi possível excluir', color: 'red' })
    }
  }

  const items = response?.data || []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Configurador / Centro de Distribuição</Text>
      <Text size="xl" fw={600} mb="lg">Centro de Distribuição</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Group justify="space-between" mb="md">
          <TextInput
            placeholder="Pesquisar..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => { setSearch(e.currentTarget.value); setPage(1) }}
            className="w-72"
          />
          <Group>
            <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
            <Button leftSection={<IconPlus size={16} />} onClick={handleNew}>Novo</Button>
          </Group>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Código</Table.Th>
              <Table.Th>Descrição</Table.Th>
              <Table.Th>Cidade</Table.Th>
              <Table.Th>UF</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th className="w-24">Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td>{item.codigo}</Table.Td>
                <Table.Td>{item.descricao}</Table.Td>
                <Table.Td>{item.cidade}</Table.Td>
                <Table.Td>{item.uf}</Table.Td>
                <Table.Td>
                  <Badge color={item.status ? 'green' : 'gray'}>{item.status ? 'Ativo' : 'Inativo'}</Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <Tooltip label="Editar"><ActionIcon variant="subtle" color="gray" onClick={() => handleEdit(item)}><IconEdit size={18} /></ActionIcon></Tooltip>
                    <Tooltip label="Excluir"><ActionIcon variant="subtle" color="red" onClick={() => handleDelete(item.id, item.descricao)} loading={excluir.isPending}><IconTrash size={18} /></ActionIcon></Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && items.length === 0 && (
              <Table.Tr><Table.Td colSpan={6} className="text-center py-8 text-zinc-500">Nenhum registro encontrado</Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>

        {response && response.totalPages > 1 && (
          <Group justify="center" mt="md">
            <Button size="xs" variant="default" disabled={page <= 1} onClick={() => setPage(page - 1)}>Anterior</Button>
            <Text size="sm">Página {response.page} de {response.totalPages} ({response.total} registros)</Text>
            <Button size="xs" variant="default" disabled={page >= response.totalPages} onClick={() => setPage(page + 1)}>Próxima</Button>
          </Group>
        )}
      </Card>

      <CentroDistModal opened={modalOpen} onClose={() => { setModalOpen(false); setEditItem(null) }} editData={editItem} />
    </div>
  )
}
