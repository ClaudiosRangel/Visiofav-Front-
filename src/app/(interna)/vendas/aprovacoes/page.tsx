'use client'

import { useState, useEffect } from 'react'
import {
  Button, Card, Group, Text, Table, Badge, ActionIcon, Tooltip,
  LoadingOverlay, Pagination, Modal, TextInput, Textarea,
} from '@mantine/core'
import { IconPlus, IconRefresh, IconEdit, IconCheck, IconX } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import {
  useRegrasAprovacao, useCriarRegraAprovacao, useEditarRegraAprovacao,
  useSolicitacoesAprovacao, useAprovarSolicitacao, useRejeitarSolicitacao,
} from '@/data/hooks/vendas/useWorkflowAprovacao'

const statusColors: Record<string, string> = {
  PENDENTE: 'orange',
  APROVADA: 'green',
  REJEITADA: 'red',
}

export default function AprovacoesPage() {
  useModuloGuard('VENDAS')
  useEffect(() => { document.title = 'Vizor - Vendas - Workflow de Aprovação' }, [])

  const [pageRegras, setPageRegras] = useState(1)
  const [pageSolic, setPageSolic] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<any>(null)
  const [form, setForm] = useState({ nome: '', condicao: '', aprovadores: '' })

  const { data: regrasResp, isLoading: loadingRegras, refetch: refetchRegras } = useRegrasAprovacao({ page: pageRegras, limit: 20 })
  const { data: solicResp, isLoading: loadingSolic, refetch: refetchSolic } = useSolicitacoesAprovacao({ page: pageSolic, limit: 20 })

  const criarRegra = useCriarRegraAprovacao()
  const editarRegra = useEditarRegraAprovacao()
  const aprovar = useAprovarSolicitacao()
  const rejeitar = useRejeitarSolicitacao()

  const regras = regrasResp?.data || []
  const totalRegras = Math.ceil((regrasResp?.total || 0) / 20)
  const solicitacoes = solicResp?.data || []
  const totalSolic = Math.ceil((solicResp?.total || 0) / 20)

  function openCreate() {
    setEditItem(null)
    setForm({ nome: '', condicao: '', aprovadores: '' })
    setModalOpen(true)
  }

  function openEdit(item: any) {
    setEditItem(item)
    setForm({ nome: item.nome, condicao: item.condicao, aprovadores: (item.aprovadores || []).join(', ') })
    setModalOpen(true)
  }

  function handleSave() {
    const body = { ...form, aprovadores: form.aprovadores.split(',').map((s: string) => s.trim()).filter(Boolean) }
    if (editItem) {
      editarRegra.mutate({ id: editItem.id, ...body }, {
        onSuccess: () => { setModalOpen(false); notifications.show({ title: 'Sucesso', message: 'Regra atualizada', color: 'green' }) },
        onError: () => notifications.show({ title: 'Erro', message: 'Falha ao salvar', color: 'red' }),
      })
    } else {
      criarRegra.mutate(body, {
        onSuccess: () => { setModalOpen(false); notifications.show({ title: 'Sucesso', message: 'Regra criada', color: 'green' }) },
        onError: () => notifications.show({ title: 'Erro', message: 'Falha ao criar', color: 'red' }),
      })
    }
  }

  function handleAprovar(id: string) {
    aprovar.mutate(id, {
      onSuccess: () => notifications.show({ title: 'Sucesso', message: 'Solicitação aprovada', color: 'green' }),
    })
  }

  function handleRejeitar(id: string) {
    rejeitar.mutate({ id }, {
      onSuccess: () => notifications.show({ title: 'Sucesso', message: 'Solicitação rejeitada', color: 'green' }),
    })
  }

  function formatDate(d: string) {
    return d ? new Date(d).toLocaleDateString('pt-BR') : '—'
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Vendas / Aprovações</Text>
      <Text size="xl" fw={600} mb="lg">Workflow de Aprovação</Text>

      {/* Regras */}
      <Card pos="relative" mb="lg">
        <LoadingOverlay visible={loadingRegras} />
        <Group justify="space-between" mb="md">
          <Text size="lg" fw={500}>Regras de Aprovação</Text>
          <Group>
            <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetchRegras()}>Atualizar</Button>
            <Button leftSection={<IconPlus size={16} />} onClick={openCreate}>Nova Regra</Button>
          </Group>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nome</Table.Th>
              <Table.Th>Condição</Table.Th>
              <Table.Th>Aprovadores</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th style={{ width: 60 }}>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {regras.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td fw={500}>{item.nome}</Table.Td>
                <Table.Td>{item.condicao}</Table.Td>
                <Table.Td>{(item.aprovadores || []).join(', ')}</Table.Td>
                <Table.Td>
                  <Badge color={item.ativo ? 'green' : 'gray'}>{item.ativo ? 'Ativo' : 'Inativo'}</Badge>
                </Table.Td>
                <Table.Td>
                  <Tooltip label="Editar">
                    <ActionIcon variant="subtle" color="blue" onClick={() => openEdit(item)}>
                      <IconEdit size={18} />
                    </ActionIcon>
                  </Tooltip>
                </Table.Td>
              </Table.Tr>
            ))}
            {!loadingRegras && regras.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--mantine-color-dimmed)' }}>
                  Nenhuma regra encontrada
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>

        {totalRegras > 1 && (
          <Group justify="center" mt="md">
            <Pagination total={totalRegras} value={pageRegras} onChange={setPageRegras} />
          </Group>
        )}
      </Card>

      {/* Solicitações Pendentes */}
      <Card pos="relative">
        <LoadingOverlay visible={loadingSolic} />
        <Group justify="space-between" mb="md">
          <Text size="lg" fw={500}>Solicitações Pendentes</Text>
          <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetchSolic()}>Atualizar</Button>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Solicitante</Table.Th>
              <Table.Th>Data</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th style={{ width: 100 }}>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {solicitacoes.map((s: any) => (
              <Table.Tr key={s.id}>
                <Table.Td fw={500}>{s.tipo}</Table.Td>
                <Table.Td>{s.solicitante}</Table.Td>
                <Table.Td>{formatDate(s.criadoEm)}</Table.Td>
                <Table.Td>
                  <Badge color={statusColors[s.status] || 'gray'}>{s.status}</Badge>
                </Table.Td>
                <Table.Td>
                  {s.status === 'PENDENTE' && (
                    <Group gap={4}>
                      <Tooltip label="Aprovar">
                        <ActionIcon variant="subtle" color="green" onClick={() => handleAprovar(s.id)}>
                          <IconCheck size={18} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="Rejeitar">
                        <ActionIcon variant="subtle" color="red" onClick={() => handleRejeitar(s.id)}>
                          <IconX size={18} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
            {!loadingSolic && solicitacoes.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--mantine-color-dimmed)' }}>
                  Nenhuma solicitação pendente
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>

        {totalSolic > 1 && (
          <Group justify="center" mt="md">
            <Pagination total={totalSolic} value={pageSolic} onChange={setPageSolic} />
          </Group>
        )}
      </Card>

      {/* Modal Regra */}
      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title={editItem ? 'Editar Regra' : 'Nova Regra'} centered>
        <TextInput label="Nome" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.currentTarget.value })} mb="sm" />
        <Textarea label="Condição" value={form.condicao} onChange={(e) => setForm({ ...form, condicao: e.currentTarget.value })} mb="sm" />
        <TextInput label="Aprovadores (separados por vírgula)" value={form.aprovadores} onChange={(e) => setForm({ ...form, aprovadores: e.currentTarget.value })} mb="sm" />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button loading={criarRegra.isPending || editarRegra.isPending} onClick={handleSave}>Salvar</Button>
        </Group>
      </Modal>
    </div>
  )
}
