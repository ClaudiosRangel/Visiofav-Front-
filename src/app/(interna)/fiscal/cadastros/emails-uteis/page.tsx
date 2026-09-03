'use client'

import { useState } from 'react'
import { Paper, Title, Table, Button, Group, TextInput, Switch, Modal, ActionIcon, Text, Badge, Stack } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconPlus, IconEdit, IconTrash } from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

interface EmailUtil {
  id: string
  nome: string
  email: string
  status: boolean
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function EmailsUteisPage() {
  useModuloGuard('FISCAL')
  const queryClient = useQueryClient()
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<EmailUtil | null>(null)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState(true)

  const { data: emails = [], isLoading } = useQuery<EmailUtil[]>({
    queryKey: ['fiscal', 'cte', 'emails-uteis'],
    queryFn: async () => { const { data } = await api.get('/fiscal/cte/emails-uteis'); return data },
  })

  const criarMutation = useMutation({
    mutationFn: async (payload: any) => { const { data } = await api.post('/fiscal/cte/emails-uteis', payload); return data },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['fiscal', 'cte', 'emails-uteis'] }); notifications.show({ title: 'Sucesso', message: 'Contato criado', color: 'green' }); fecharModal() },
    onError: (err: any) => notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }),
  })

  const atualizarMutation = useMutation({
    mutationFn: async ({ id, ...payload }: any) => { const { data } = await api.put(`/fiscal/cte/emails-uteis/${id}`, payload); return data },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['fiscal', 'cte', 'emails-uteis'] }); notifications.show({ title: 'Sucesso', message: 'Contato atualizado', color: 'green' }); fecharModal() },
    onError: (err: any) => notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }),
  })

  const excluirMutation = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/fiscal/cte/emails-uteis/${id}`) },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['fiscal', 'cte', 'emails-uteis'] }); notifications.show({ title: 'Excluído', message: '', color: 'green' }) },
  })

  function abrirCriacao() { setEditando(null); setNome(''); setEmail(''); setStatus(true); setModalOpen(true) }
  function abrirEdicao(e: EmailUtil) { setEditando(e); setNome(e.nome); setEmail(e.email); setStatus(e.status); setModalOpen(true) }
  function fecharModal() { setModalOpen(false); setEditando(null) }

  function salvar() {
    if (!nome.trim()) { notifications.show({ title: 'Atenção', message: 'Informe o nome', color: 'yellow' }); return }
    if (!EMAIL_RE.test(email.trim())) { notifications.show({ title: 'Atenção', message: 'E-mail inválido', color: 'yellow' }); return }
    const payload = { nome: nome.trim(), email: email.trim().toLowerCase(), status }
    if (editando) atualizarMutation.mutate({ id: editando.id, ...payload })
    else criarMutation.mutate(payload)
  }

  return (
    <Paper p="md">
      <Group justify="space-between" mb="md">
        <div>
          <Title order={3}>E-mails Úteis (CT-e)</Title>
          <Text size="sm" c="dimmed">Contatos frequentes para envio de CT-e por e-mail. Aparecem como sugestão no envio individual, em lote e em Baixar/Enviar Arquivos.</Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirCriacao}>Novo Contato</Button>
      </Group>

      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Nome</Table.Th>
            <Table.Th>E-mail</Table.Th>
            <Table.Th>Status</Table.Th>
            <Table.Th w={80}>Ações</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {isLoading && <Table.Tr><Table.Td colSpan={4}><Text c="dimmed">Carregando...</Text></Table.Td></Table.Tr>}
          {emails.map((e) => (
            <Table.Tr key={e.id}>
              <Table.Td><Text fw={500}>{e.nome}</Text></Table.Td>
              <Table.Td>{e.email}</Table.Td>
              <Table.Td><Badge color={e.status ? 'green' : 'gray'}>{e.status ? 'Ativo' : 'Inativo'}</Badge></Table.Td>
              <Table.Td>
                <Group gap={4}>
                  <ActionIcon variant="subtle" onClick={() => abrirEdicao(e)}><IconEdit size={16} /></ActionIcon>
                  <ActionIcon variant="subtle" color="red" onClick={() => { if (confirm('Excluir contato?')) excluirMutation.mutate(e.id) }}><IconTrash size={16} /></ActionIcon>
                </Group>
              </Table.Td>
            </Table.Tr>
          ))}
          {!isLoading && emails.length === 0 && (
            <Table.Tr><Table.Td colSpan={4}><Text c="dimmed" ta="center">Nenhum contato cadastrado</Text></Table.Td></Table.Tr>
          )}
        </Table.Tbody>
      </Table>

      <Modal opened={modalOpen} onClose={fecharModal} title={editando ? 'Editar Contato' : 'Novo Contato'}>
        <Stack gap="sm">
          <TextInput label="Nome" placeholder="Ex: Contador, Financeiro, Cliente X" value={nome} onChange={(e) => setNome(e.target.value)} required />
          <TextInput label="E-mail" placeholder="contato@exemplo.com" value={email} onChange={(e) => setEmail(e.target.value)} required
            error={email && !EMAIL_RE.test(email) ? 'E-mail inválido' : undefined} />
          <Switch label="Ativo" checked={status} onChange={(e) => setStatus(e.currentTarget.checked)} />
          <Group justify="flex-end" mt="md">
            <Button variant="subtle" onClick={fecharModal}>Cancelar</Button>
            <Button onClick={salvar} loading={criarMutation.isPending || atualizarMutation.isPending}>
              {editando ? 'Atualizar' : 'Criar'}
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Paper>
  )
}
