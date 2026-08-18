'use client'

import { useState } from 'react'
import { Paper, Title, Table, Button, Group, TextInput, Textarea, Modal, ActionIcon, Text, Badge } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

interface ObservacaoPadrao {
  id: string
  codigo: string
  texto: string
  ativo: boolean
}

export default function ObservacoesCTePage() {
  useModuloGuard('FISCAL')
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<ObservacaoPadrao | null>(null)
  const [codigo, setCodigo] = useState('')
  const [texto, setTexto] = useState('')

  const { data: observacoes = [], isLoading } = useQuery<ObservacaoPadrao[]>({
    queryKey: ['fiscal', 'cte', 'observacoes-padrao'],
    queryFn: async () => {
      const { data } = await api.get('/fiscal/cte/observacoes-padrao')
      return data
    },
  })

  const criarMutation = useMutation({
    mutationFn: async (payload: { codigo: string; texto: string }) => {
      const { data } = await api.post('/fiscal/cte/observacoes-padrao', payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal', 'cte', 'observacoes-padrao'] })
      notifications.show({ title: 'Sucesso', message: 'Observação criada', color: 'green' })
      fecharModal()
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Erro ao criar', color: 'red' })
    },
  })

  const atualizarMutation = useMutation({
    mutationFn: async ({ id, ...payload }: { id: string; codigo?: string; texto?: string; ativo?: boolean }) => {
      const { data } = await api.put(`/fiscal/cte/observacoes-padrao/${id}`, payload)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal', 'cte', 'observacoes-padrao'] })
      notifications.show({ title: 'Sucesso', message: 'Observação atualizada', color: 'green' })
      fecharModal()
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Erro ao atualizar', color: 'red' })
    },
  })

  const excluirMutation = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/fiscal/cte/observacoes-padrao/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fiscal', 'cte', 'observacoes-padrao'] })
      notifications.show({ title: 'Sucesso', message: 'Observação excluída', color: 'green' })
    },
  })

  function abrirCriacao() {
    setEditando(null)
    setCodigo('')
    setTexto('')
    setModalOpen(true)
  }

  function abrirEdicao(obs: ObservacaoPadrao) {
    setEditando(obs)
    setCodigo(obs.codigo)
    setTexto(obs.texto)
    setModalOpen(true)
  }

  function fecharModal() {
    setModalOpen(false)
    setEditando(null)
    setCodigo('')
    setTexto('')
  }

  function salvar() {
    if (!codigo.trim() || !texto.trim()) {
      notifications.show({ title: 'Atenção', message: 'Preencha código e texto', color: 'yellow' })
      return
    }
    if (editando) {
      atualizarMutation.mutate({ id: editando.id, codigo: codigo.trim(), texto: texto.trim() })
    } else {
      criarMutation.mutate({ codigo: codigo.trim(), texto: texto.trim() })
    }
  }

  return (
    <Paper p="md">
      <Group justify="space-between" mb="md">
        <Title order={3}>Observações Padrão CT-e</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirCriacao}>Nova Observação</Button>
      </Group>

      <Text size="sm" c="dimmed" mb="md">
        Cadastre textos de observação frequentes para reutilizar na emissão de CT-e.
      </Text>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Código</Table.Th>
            <Table.Th>Texto</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th w={100}>Ações</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {isLoading && <Table.Tr><Table.Td colSpan={4}><Text c="dimmed">Carregando...</Text></Table.Td></Table.Tr>}
          {observacoes.map((obs) => (
            <Table.Tr key={obs.id}>
              <Table.Td><Text fw={500}>{obs.codigo}</Text></Table.Td>
              <Table.Td><Text size="sm" lineClamp={2}>{obs.texto}</Text></Table.Td>
              <Table.Td><Badge color={obs.ativo ? 'green' : 'gray'}>{obs.ativo ? 'Ativo' : 'Inativo'}</Badge></Table.Td>
              <Table.Td>
                <Group gap={4}>
                  <ActionIcon variant="subtle" onClick={() => abrirEdicao(obs)}><IconEdit size={16} /></ActionIcon>
                  <ActionIcon variant="subtle" color="red" onClick={() => excluirMutation.mutate(obs.id)}><IconTrash size={16} /></ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
          {!isLoading && observacoes.length === 0 && (
            <Table.Tr><Table.Td colSpan={4}><Text c="dimmed" ta="center">Nenhuma observação cadastrada</Text></Table.Td></Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <Modal opened={modalOpen} onClose={fecharModal} title={editando ? 'Editar Observação' : 'Nova Observação'}>
        <TextInput label="Código" placeholder="Ex: FRETE, SEGURO, OBS1" value={codigo} onChange={(e) => setCodigo(e.target.value)} mb="sm" required maxLength={20} />
        <Textarea label="Texto" placeholder="Texto da observação que será inserido no CT-e" value={texto} onChange={(e) => setTexto(e.target.value)} minRows={3} required mb="md" />
        <Group justify="flex-end">
          <Button variant="subtle" onClick={fecharModal}>Cancelar</Button>
          <Button onClick={salvar} loading={criarMutation.isPending || atualizarMutation.isPending}>
            {editando ? 'Atualizar' : 'Criar'}
          </Button>
        </Group>
      </Modal>
    </Paper>
  )
}
