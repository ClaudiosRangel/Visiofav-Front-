'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, Modal, TextInput, Select, LoadingOverlay, ActionIcon, Tooltip,
} from '@mantine/core'
import { IconPlus, IconEdit, IconTrash, IconSearch } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

export default function PortalUsuariosPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Portal Usuários' }, [])
  const queryClient = useQueryClient()

  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [busca, setBusca] = useState('')

  // Form state
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [clienteId, setClienteId] = useState<string | null>(null)

  const { data: response, isLoading } = useQuery<any>({
    queryKey: ['portal-usuarios'],
    queryFn: async () => { const { data } = await api.get('/portal/admin/usuarios'); return data },
  })

  const { data: clientes } = useQuery<any>({
    queryKey: ['portal-clientes'],
    queryFn: async () => { const { data } = await api.get('/portal/admin/clientes'); return data },
  })

  const salvar = useMutation({
    mutationFn: async () => {
      if (editando) {
        const { data } = await api.put(`/portal/admin/usuarios/${editando.id}`, { nome, email, clienteId, senha: senha || undefined })
        return data
      }
      const { data } = await api.post('/portal/admin/usuarios', { nome, email, senha, clienteId })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-usuarios'] })
      fecharModal()
      notifications.show({ title: 'Sucesso', message: editando ? 'Usuário atualizado' : 'Usuário criado', color: 'green' })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao salvar', color: 'red' })
    },
  })

  const excluir = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.delete(`/portal/admin/usuarios/${id}`)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['portal-usuarios'] })
      notifications.show({ title: 'Sucesso', message: 'Usuário removido', color: 'green' })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao excluir', color: 'red' })
    },
  })

  function abrirNovo() {
    setEditando(null)
    setNome(''); setEmail(''); setSenha(''); setClienteId(null)
    setModalOpen(true)
  }

  function abrirEditar(usuario: any) {
    setEditando(usuario)
    setNome(usuario.nome || '')
    setEmail(usuario.email || '')
    setSenha('')
    setClienteId(usuario.clienteId || null)
    setModalOpen(true)
  }

  function fecharModal() {
    setModalOpen(false)
    setEditando(null)
    setNome(''); setEmail(''); setSenha(''); setClienteId(null)
  }

  const usuarios = (response?.data || []).filter((u: any) =>
    !busca || u.nome?.toLowerCase().includes(busca.toLowerCase()) || u.email?.toLowerCase().includes(busca.toLowerCase())
  )

  const clientesOptions = (clientes?.data || []).map((c: any) => ({
    value: c.id, label: c.nome || c.razaoSocial || c.id,
  }))

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Portal 3PL / Usuários</Text>
      <Text size="xl" fw={600} mb="lg">Gestão de Usuários do Portal</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />

        <Group justify="space-between" mb="md">
          <TextInput
            placeholder="Buscar por nome ou email..."
            leftSection={<IconSearch size={16} />}
            value={busca}
            onChange={(e) => setBusca(e.currentTarget.value)}
            className="w-72"
          />
          <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>
            Novo Usuário
          </Button>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nome</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Cliente</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Último Acesso</Table.Th>
              <Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {usuarios.map((u: any) => (
              <Table.Tr key={u.id}>
                <Table.Td fw={500}>{u.nome}</Table.Td>
                <Table.Td>{u.email}</Table.Td>
                <Table.Td>{u.cliente?.nome || '—'}</Table.Td>
                <Table.Td>
                  <Badge color={u.ativo ? 'green' : 'red'} variant="light">
                    {u.ativo ? 'Ativo' : 'Inativo'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {u.ultimoAcesso ? new Date(u.ultimoAcesso).toLocaleString('pt-BR') : '—'}
                </Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <Tooltip label="Editar">
                      <ActionIcon variant="light" color="blue" onClick={() => abrirEditar(u)}>
                        <IconEdit size={16} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Excluir">
                      <ActionIcon variant="light" color="red" onClick={() => {
                        if (confirm(`Excluir usuário ${u.nome}?`)) excluir.mutate(u.id)
                      }}>
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {usuarios.length === 0 && (
              <Table.Tr><Table.Td colSpan={6} className="text-center py-8 text-zinc-500">Nenhum usuário encontrado</Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      {/* Modal Criar/Editar */}
      <Modal opened={modalOpen} onClose={fecharModal} title={editando ? 'Editar Usuário' : 'Novo Usuário'} centered>
        <Select
          label="Cliente *"
          placeholder="Selecione o cliente"
          data={clientesOptions}
          value={clienteId}
          onChange={setClienteId}
          searchable
          mb="sm"
        />
        <TextInput label="Nome *" value={nome} onChange={(e) => setNome(e.currentTarget.value)} mb="sm" />
        <TextInput label="Email *" type="email" value={email} onChange={(e) => setEmail(e.currentTarget.value)} mb="sm" />
        <TextInput
          label={editando ? 'Nova Senha (deixe vazio para manter)' : 'Senha *'}
          type="password"
          value={senha}
          onChange={(e) => setSenha(e.currentTarget.value)}
          mb="md"
        />
        <Group justify="flex-end">
          <Button variant="default" onClick={fecharModal}>Cancelar</Button>
          <Button onClick={() => salvar.mutate()} loading={salvar.isPending} disabled={!nome || !email || !clienteId || (!editando && !senha)}>
            {editando ? 'Salvar' : 'Criar'}
          </Button>
        </Group>
      </Modal>
    </div>
  )
}
