'use client'

import { useState } from 'react'
import { Button, Card, Group, Text, TextInput, Table, Badge, ActionIcon, Tooltip, LoadingOverlay } from '@mantine/core'
import { IconPlus, IconSearch, IconEdit, IconTrash, IconRefresh } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useDepositos, useExcluirDeposito } from '@/data/hooks/useDeposito'
import DepositoModal from './DepositoModal'

export default function DepositosPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Record<string, any> | null>(null)
  const [search, setSearch] = useState('')

  const { data: response, isLoading, refetch } = useDepositos({ search: search || undefined })
  const excluir = useExcluirDeposito()

  function handleNew() { setEditItem(null); setModalOpen(true) }
  function handleEdit(item: any) { setEditItem(item); setModalOpen(true) }

  async function handleDelete(id: string, desc: string) {
    if (!confirm(`Deseja excluir "${desc}"?`)) return
    try { await excluir.mutateAsync(id); notifications.show({ title: 'Sucesso', message: 'Excluído', color: 'green' }) }
    catch { notifications.show({ title: 'Erro', message: 'Falha ao excluir', color: 'red' }) }
  }

  const items = response?.data || []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Configurador / Depósitos</Text>
      <Text size="xl" fw={600} mb="lg">Depósitos</Text>
      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Group justify="space-between" mb="md">
          <TextInput placeholder="Pesquisar..." leftSection={<IconSearch size={16} />} value={search} onChange={(e) => setSearch(e.currentTarget.value)} className="w-72" />
          <Group>
            <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
            <Button leftSection={<IconPlus size={16} />} onClick={handleNew}>Novo</Button>
          </Group>
        </Group>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Código</Table.Th><Table.Th>Descrição</Table.Th><Table.Th>Centro Distribuição</Table.Th><Table.Th>Cidade</Table.Th><Table.Th>UF</Table.Th><Table.Th>Status</Table.Th><Table.Th className="w-24">Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td>{item.codigo}</Table.Td>
                <Table.Td>{item.descricao}</Table.Td>
                <Table.Td className="text-sm text-zinc-500">{item.centroDistribuicao?.descricao}</Table.Td>
                <Table.Td>{item.cidade}</Table.Td>
                <Table.Td>{item.uf}</Table.Td>
                <Table.Td><Badge color={item.status ? 'green' : 'gray'}>{item.status ? 'Ativo' : 'Inativo'}</Badge></Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <Tooltip label="Editar"><ActionIcon variant="subtle" color="gray" onClick={() => handleEdit(item)}><IconEdit size={18} /></ActionIcon></Tooltip>
                    <Tooltip label="Excluir"><ActionIcon variant="subtle" color="red" onClick={() => handleDelete(item.id, item.descricao)}><IconTrash size={18} /></ActionIcon></Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && items.length === 0 && (
              <Table.Tr><Table.Td colSpan={7} className="text-center py-8 text-zinc-500">Nenhum registro encontrado</Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>
      <DepositoModal opened={modalOpen} onClose={() => { setModalOpen(false); setEditItem(null) }} editData={editItem} />
    </div>
  )
}
