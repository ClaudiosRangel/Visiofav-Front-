'use client'

import { useState } from 'react'
import { Button, Card, Group, Text, TextInput, Table, Badge, ActionIcon, Tooltip, LoadingOverlay, Drawer } from '@mantine/core'
import { IconPlus, IconSearch, IconEdit, IconTrash, IconRefresh, IconBarcode, IconPackage, IconChartBar } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useProdutos, useExcluirProduto } from '@/data/hooks/useProduto'
import { api } from '@/lib/api'
import ProdutoModal from './ProdutoModal'
import SkuPanel from './SkuPanel'

const abcColor: Record<string, string> = { A: 'green', B: 'yellow', C: 'red' }

export default function ProdutosPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Record<string, any> | null>(null)
  const [search, setSearch] = useState('')
  const [skuDrawer, setSkuDrawer] = useState<{ id: string; nome: string } | null>(null)
  const [recalculando, setRecalculando] = useState(false)

  const { data: response, isLoading, refetch } = useProdutos({ search: search || undefined })
  const excluir = useExcluirProduto()

  function handleNew() { setEditItem(null); setModalOpen(true) }
  function handleEdit(item: any) { setEditItem(item); setModalOpen(true) }

  async function handleDelete(id: string, desc: string) {
    if (!confirm(`Deseja excluir "${desc}"?`)) return
    try { await excluir.mutateAsync(id); notifications.show({ title: 'Sucesso', message: 'Excluído', color: 'green' }) }
    catch { notifications.show({ title: 'Erro', message: 'Falha ao excluir', color: 'red' }) }
  }

  async function handleRecalcularCurvaAbc() {
    setRecalculando(true)
    try {
      const { data } = await api.post('/produtos/recalcular-curva-abc')
      notifications.show({
        title: 'Curva ABC recalculada',
        message: `Total: ${data.total} produtos — A: ${data.classificacao.A}, B: ${data.classificacao.B}, C: ${data.classificacao.C}`,
        color: 'green',
      })
      refetch()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao recalcular curva ABC', color: 'red' })
    } finally {
      setRecalculando(false)
    }
  }

  const items = response?.data || []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Configurador / Produtos</Text>
      <Text size="xl" fw={600} mb="lg">Produto / SKU</Text>
      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Group justify="space-between" mb="md">
          <TextInput placeholder="Pesquisar por descrição ou código de barras..." leftSection={<IconSearch size={16} />} value={search} onChange={(e) => setSearch(e.currentTarget.value)} className="w-96" />
          <Group>
            <Button variant="default" leftSection={<IconChartBar size={16} />} onClick={handleRecalcularCurvaAbc} loading={recalculando}>Recalcular Curva ABC</Button>
            <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
            <Button leftSection={<IconPlus size={16} />} onClick={handleNew}>Novo</Button>
          </Group>
        </Group>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Código</Table.Th><Table.Th>Descrição</Table.Th><Table.Th>Cód. Barras</Table.Th><Table.Th>Unidade</Table.Th><Table.Th>Curva ABC</Table.Th><Table.Th>Status</Table.Th><Table.Th className="w-24">Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td>{item.codigo}</Table.Td>
                <Table.Td>{item.nome}</Table.Td>
                <Table.Td>{item.cEAN && <Group gap={4}><IconBarcode size={14} className="text-zinc-400" /><Text size="sm" ff="monospace">{item.cEAN}</Text></Group>}</Table.Td>
                <Table.Td>{item.unidade}</Table.Td>
                <Table.Td>{item.curvaAbc && <Badge color={abcColor[item.curvaAbc] || 'gray'} variant="light">{item.curvaAbc}</Badge>}</Table.Td>
                <Table.Td><Badge color={item.status ? 'green' : 'gray'}>{item.status ? 'Ativo' : 'Inativo'}</Badge></Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <Tooltip label="SKUs / Embalagens"><ActionIcon variant="subtle" color="blue" onClick={() => setSkuDrawer({ id: item.id, nome: item.nome || item.codigo })}><IconPackage size={18} /></ActionIcon></Tooltip>
                    <Tooltip label="Editar"><ActionIcon variant="subtle" color="gray" onClick={() => handleEdit(item)}><IconEdit size={18} /></ActionIcon></Tooltip>
                    <Tooltip label="Excluir"><ActionIcon variant="subtle" color="red" onClick={() => handleDelete(item.id, item.nome)}><IconTrash size={18} /></ActionIcon></Tooltip>
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
      <ProdutoModal opened={modalOpen} onClose={() => { setModalOpen(false); setEditItem(null) }} editData={editItem} />
      <Drawer opened={!!skuDrawer} onClose={() => setSkuDrawer(null)} title="SKUs / Embalagens" position="right" size="xl">
        {skuDrawer && <SkuPanel produtoId={skuDrawer.id} produtoNome={skuDrawer.nome} />}
      </Drawer>
    </div>
  )
}
