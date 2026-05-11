'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, ActionIcon, Tooltip,
  TextInput, Select, Pagination, LoadingOverlay,
} from '@mantine/core'
import { IconPlus, IconSearch, IconEdit, IconTrash, IconToggleLeft, IconToggleRight, IconRefresh } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useDepara, useDeparaDelete, useDeparaUpdate, DeparaFornecedor } from '@/data/hooks/useDepara'
import DeparaModal from './DeparaModal'

export default function DeparaFornecedorPage() {
  useEffect(() => { document.title = 'VisioFab - Cadastros - De-Para Fornecedor' }, [])

  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<DeparaFornecedor | null>(null)
  const [page, setPage] = useState(1)
  const [busca, setBusca] = useState('')
  const [fornecedorId, setFornecedorId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const limit = 20

  // Buscar fornecedores para o filtro
  const { data: fornecedoresResp } = useQuery<{ data: Array<{ id: string; razaoSocial: string }> }>({
    queryKey: ['fornecedores', { limit: 200 }],
    queryFn: async () => {
      const { data } = await api.get('/fornecedores', { params: { limit: 200 } })
      return data
    },
    staleTime: 1000 * 60 * 10,
  })

  const filtros = {
    page,
    limit,
    ...(busca ? { busca } : {}),
    ...(fornecedorId ? { fornecedorId } : {}),
    ...(statusFilter ? { status: statusFilter } : {}),
  }

  const { data: response, isLoading, refetch } = useDepara(filtros)
  const deleteMut = useDeparaDelete()
  const updateMut = useDeparaUpdate()

  const items = response?.data || []
  const total = response?.total || 0
  const totalPages = Math.ceil(total / limit)

  const fornecedoresOptions = (fornecedoresResp?.data || []).map(f => ({
    value: f.id,
    label: f.razaoSocial,
  }))

  function handleNew() {
    setEditItem(null)
    setModalOpen(true)
  }

  function handleEdit(item: DeparaFornecedor) {
    setEditItem(item)
    setModalOpen(true)
  }

  async function handleToggleStatus(item: DeparaFornecedor) {
    try {
      await updateMut.mutateAsync({ id: item.id, status: !item.status })
      notifications.show({
        title: 'Sucesso',
        message: `De-Para ${item.status ? 'desativado' : 'ativado'}`,
        color: 'green',
      })
    } catch {
      notifications.show({ title: 'Erro', message: 'Falha ao alterar status', color: 'red' })
    }
  }

  async function handleDelete(item: DeparaFornecedor) {
    if (!confirm(`Excluir mapeamento "${item.codigoProdutoFornecedor}" → "${item.produto?.nome || ''}"?`)) return
    try {
      await deleteMut.mutateAsync(item.id)
      notifications.show({ title: 'Sucesso', message: 'De-Para excluído', color: 'green' })
    } catch {
      notifications.show({ title: 'Erro', message: 'Falha ao excluir', color: 'red' })
    }
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Cadastros / De-Para Fornecedor</Text>
      <Text size="xl" fw={600} mb="lg">De-Para Fornecedor × Produto</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />

        {/* Filtros */}
        <Group justify="space-between" mb="md" wrap="wrap">
          <Group gap="sm" wrap="wrap">
            <TextInput
              placeholder="Buscar código ou descrição..."
              leftSection={<IconSearch size={16} />}
              value={busca}
              onChange={(e) => { setBusca(e.currentTarget.value); setPage(1) }}
              className="w-64"
            />
            <Select
              placeholder="Fornecedor"
              data={fornecedoresOptions}
              value={fornecedorId}
              onChange={(v) => { setFornecedorId(v); setPage(1) }}
              clearable
              searchable
              className="w-56"
            />
            <Select
              placeholder="Status"
              data={[
                { value: 'true', label: 'Ativo' },
                { value: 'false', label: 'Inativo' },
              ]}
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v); setPage(1) }}
              clearable
              className="w-32"
            />
          </Group>
          <Group gap="sm">
            <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>
              Atualizar
            </Button>
            <Button leftSection={<IconPlus size={16} />} onClick={handleNew}>
              Novo De-Para
            </Button>
          </Group>
        </Group>

        {/* Tabela */}
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Fornecedor</Table.Th>
              <Table.Th>Cód. Produto Fornecedor</Table.Th>
              <Table.Th>Descrição</Table.Th>
              <Table.Th>Produto Interno</Table.Th>
              <Table.Th>Unidade</Table.Th>
              <Table.Th>Fator Conversão</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th className="w-28">Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item) => (
              <Table.Tr key={item.id}>
                <Table.Td>{item.fornecedor?.razaoSocial || '—'}</Table.Td>
                <Table.Td className="font-mono">{item.codigoProdutoFornecedor}</Table.Td>
                <Table.Td>{item.descricaoFornecedor || '—'}</Table.Td>
                <Table.Td>
                  {item.produto ? (
                    <Text size="sm">{item.produto.codigo} — {item.produto.nome}</Text>
                  ) : '—'}
                </Table.Td>
                <Table.Td>{item.unidadeFornecedor}</Table.Td>
                <Table.Td>{Number(item.fatorConversao)}</Table.Td>
                <Table.Td>
                  <Badge color={item.status ? 'green' : 'gray'} variant="light" size="sm">
                    {item.status ? 'Ativo' : 'Inativo'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <Tooltip label="Editar">
                      <ActionIcon variant="subtle" color="gray" onClick={() => handleEdit(item)}>
                        <IconEdit size={18} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label={item.status ? 'Desativar' : 'Ativar'}>
                      <ActionIcon variant="subtle" color={item.status ? 'orange' : 'green'} onClick={() => handleToggleStatus(item)}>
                        {item.status ? <IconToggleRight size={18} /> : <IconToggleLeft size={18} />}
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Excluir">
                      <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(item)}>
                        <IconTrash size={18} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && items.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={8} className="text-center py-8 text-zinc-500">
                  Nenhum mapeamento De-Para encontrado
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>

        {totalPages > 1 && (
          <Group justify="center" mt="md">
            <Pagination total={totalPages} value={page} onChange={setPage} />
          </Group>
        )}
      </Card>

      <DeparaModal
        opened={modalOpen}
        onClose={() => { setModalOpen(false); setEditItem(null) }}
        editData={editItem}
      />
    </div>
  )
}
