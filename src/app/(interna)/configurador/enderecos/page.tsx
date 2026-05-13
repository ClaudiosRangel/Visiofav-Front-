'use client'

import { useState } from 'react'
import { Button, Card, Group, Text, TextInput, Table, Badge, ActionIcon, Tooltip, LoadingOverlay, Tabs } from '@mantine/core'
import { IconPlus, IconSearch, IconEdit, IconTrash, IconRefresh, IconAutomation, IconPrinter, IconMapPin, IconTemplate } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useEnderecos, useExcluirEndereco } from '@/data/hooks/useEndereco'
import { api } from '@/lib/api'
import EnderecoModal from './EnderecoModal'
import EnderecoAutoModal from './EnderecoAutoModal'
import FormatosEnderecoTab from './FormatosEnderecoTab'

const estadoColor: Record<string, string> = { LIVRE: 'green', OCUPADO: 'blue', BLOQUEADO: 'red', RESERVADO: 'orange' }
const tipoColor: Record<string, string> = { ARMAZENAGEM: 'primary', PICKING: 'grape', DOCA: 'orange', AVARIA: 'red' }

export default function EnderecosPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [autoModalOpen, setAutoModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<Record<string, any> | null>(null)
  const [search, setSearch] = useState('')

  const { data: response, isLoading, refetch } = useEnderecos({ search: search || undefined, limit: 50 })
  const excluir = useExcluirEndereco()

  function handleNew() { setEditItem(null); setModalOpen(true) }
  function handleEdit(item: any) { setEditItem(item); setModalOpen(true) }

  async function handleDelete(id: string, end: string) {
    if (!confirm(`Deseja excluir "${end}"?`)) return
    try { await excluir.mutateAsync(id); notifications.show({ title: 'Sucesso', message: 'Excluído', color: 'green' }) }
    catch { notifications.show({ title: 'Erro', message: 'Falha ao excluir', color: 'red' }) }
  }

  const items = response?.data || []
  const countByEstado = (estado: string) => items.filter((i: any) => i.estado === estado).length

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Configurador / Endereços</Text>
      <Text size="xl" fw={600} mb="lg">Endereços</Text>

      <Tabs defaultValue="enderecos">
        <Tabs.List mb="md">
          <Tabs.Tab value="enderecos" leftSection={<IconMapPin size={16} />}>Endereços</Tabs.Tab>
          <Tabs.Tab value="formatos" leftSection={<IconTemplate size={16} />}>Formatos de Endereço</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="enderecos">
          <Card pos="relative">
            <LoadingOverlay visible={isLoading} />
            <Group justify="space-between" mb="md">
              <TextInput placeholder="Pesquisar endereço..." leftSection={<IconSearch size={16} />} value={search} onChange={(e) => setSearch(e.currentTarget.value)} className="w-72" />
              <Group>
                <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
                <Button variant="light" color="teal" leftSection={<IconPrinter size={16} />} disabled={items.length === 0}
                  onClick={async () => {
                    try {
                      const ids = items.map((i: any) => i.id)
                      const { data: html } = await api.post('/etiquetas/enderecos-html', { ids, quantidade: 1 }, { responseType: 'text' })
                      const w = window.open('', '_blank')
                      if (w) { w.document.write(html); w.document.close() }
                    } catch (err: any) { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao gerar etiquetas', color: 'red' }) }
                  }}>
                  Imprimir Etiquetas
                </Button>
                <Button variant="light" leftSection={<IconAutomation size={16} />} onClick={() => setAutoModalOpen(true)}>Gerar Automático</Button>
                <Button leftSection={<IconPlus size={16} />} onClick={handleNew}>Novo</Button>
              </Group>
            </Group>
            <Group mb="md" gap="lg">
              <Group gap={4}><div className="w-3 h-3 rounded-full bg-green-500" /><Text size="xs">Livre: {countByEstado('LIVRE')}</Text></Group>
              <Group gap={4}><div className="w-3 h-3 rounded-full bg-blue-500" /><Text size="xs">Ocupado: {countByEstado('OCUPADO')}</Text></Group>
              <Group gap={4}><div className="w-3 h-3 rounded-full bg-red-500" /><Text size="xs">Bloqueado: {countByEstado('BLOQUEADO')}</Text></Group>
              <Text size="xs" c="dimmed">Total: {response?.total || 0}</Text>
            </Group>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Endereço</Table.Th><Table.Th>Depósito</Table.Th><Table.Th>Zona</Table.Th><Table.Th>Estrutura</Table.Th><Table.Th>Tipo</Table.Th><Table.Th>Estado</Table.Th><Table.Th>Status</Table.Th><Table.Th className="w-24">Ações</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {items.map((item: any) => (
                  <Table.Tr key={item.id}>
                    <Table.Td><Text fw={500} size="sm" ff="monospace">{item.enderecoCompleto}</Text></Table.Td>
                    <Table.Td>{item.deposito?.descricao}</Table.Td>
                    <Table.Td>{item.zona?.descricao || item.codigoZona || '—'}</Table.Td>
                    <Table.Td className="text-sm text-zinc-500">{item.estrutura?.descricao}</Table.Td>
                    <Table.Td><Badge color={tipoColor[item.tipo] || 'gray'} variant="light">{item.tipo}</Badge></Table.Td>
                    <Table.Td><Badge color={estadoColor[item.estado] || 'gray'} variant="light">{item.estado}</Badge></Table.Td>
                    <Table.Td><Badge color={item.status ? 'green' : 'gray'}>{item.status ? 'Ativo' : 'Inativo'}</Badge></Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        <Tooltip label="Editar"><ActionIcon variant="subtle" color="gray" onClick={() => handleEdit(item)}><IconEdit size={18} /></ActionIcon></Tooltip>
                        <Tooltip label="Excluir"><ActionIcon variant="subtle" color="red" onClick={() => handleDelete(item.id, item.enderecoCompleto)}><IconTrash size={18} /></ActionIcon></Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {!isLoading && items.length === 0 && (
                  <Table.Tr><Table.Td colSpan={8} className="text-center py-8 text-zinc-500">Nenhum registro encontrado</Table.Td></Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Card>
          <EnderecoModal opened={modalOpen} onClose={() => { setModalOpen(false); setEditItem(null) }} editData={editItem} />
          <EnderecoAutoModal opened={autoModalOpen} onClose={() => setAutoModalOpen(false)} />
        </Tabs.Panel>

        <Tabs.Panel value="formatos">
          <FormatosEnderecoTab />
        </Tabs.Panel>
      </Tabs>
    </div>
  )
}
