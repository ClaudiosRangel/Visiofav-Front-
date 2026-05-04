'use client'

import { useState } from 'react'
import { Button, Card, Group, Text, TextInput, PasswordInput, Table, Badge, ActionIcon, Tooltip, Modal, Select, LoadingOverlay } from '@mantine/core'
import { IconPlus, IconSearch, IconEdit, IconTrash, IconRefresh } from '@tabler/icons-react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'

const schema = z.object({
  nome: z.string().min(3, 'Nome é obrigatório'),
  email: z.string().email('Email inválido'),
  senha: z.string().min(6, 'Mínimo 6 caracteres'),
  perfil: z.enum(['ADMIN', 'SUPERVISOR', 'OPERADOR']).default('OPERADOR'),
})
type FormValues = z.infer<typeof schema>

const PERFIS = [
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'OPERADOR', label: 'Operador' },
]

const perfilColor: Record<string, string> = { ADMIN: 'red', SUPERVISOR: 'orange', OPERADOR: 'blue' }

export default function UsuariosPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [search, setSearch] = useState('')

  const { data: usuarios, isLoading, refetch } = useQuery<any[]>({
    queryKey: ['usuarios'],
    queryFn: async () => {
      // Busca via Prisma Studio ou endpoint customizado — por enquanto usa o endpoint de auth
      // Vamos criar um endpoint GET /api/usuarios
      const { data } = await api.get('/usuarios')
      return data
    },
    staleTime: 1000 * 60 * 5,
  })

  const qc = useQueryClient()
  const criar = useMutation({
    mutationFn: async (body: FormValues) => {
      const { data } = await api.post('/auth/registrar', body)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  })

  const excluir = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/usuarios/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  })

  const { control, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { perfil: 'OPERADOR' },
  })

  function handleNew() { reset({ nome: '', email: '', senha: '', perfil: 'OPERADOR' }); setModalOpen(true) }

  async function onSubmit(data: FormValues) {
    try {
      await criar.mutateAsync(data)
      notifications.show({ title: 'Sucesso', message: 'Usuário criado', color: 'green' })
      setModalOpen(false)
    } catch {
      notifications.show({ title: 'Erro', message: 'Falha ao criar (email já existe?)', color: 'red' })
    }
  }

  async function handleDelete(id: string, nome: string) {
    if (!confirm(`Excluir "${nome}"?`)) return
    try { await excluir.mutateAsync(id); notifications.show({ title: 'Sucesso', message: 'Excluído', color: 'green' }) }
    catch { notifications.show({ title: 'Erro', message: 'Falha', color: 'red' }) }
  }

  const items = (usuarios || []).filter((u: any) =>
    u.nome?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Configurador / Usuários</Text>
      <Text size="xl" fw={600} mb="lg">Usuários do Sistema</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Group justify="space-between" mb="md">
          <TextInput placeholder="Pesquisar por nome ou email..." leftSection={<IconSearch size={16} />} value={search} onChange={(e) => setSearch(e.currentTarget.value)} className="w-80" />
          <Group>
            <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
            <Button leftSection={<IconPlus size={16} />} onClick={handleNew}>Novo Usuário</Button>
          </Group>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nome</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Perfil</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th className="w-24">Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td>{item.nome}</Table.Td>
                <Table.Td className="text-sm text-zinc-500">{item.email}</Table.Td>
                <Table.Td><Badge color={perfilColor[item.perfil] || 'gray'} variant="light">{PERFIS.find(p => p.value === item.perfil)?.label || item.perfil}</Badge></Table.Td>
                <Table.Td><Badge color={item.status ? 'green' : 'gray'}>{item.status ? 'Ativo' : 'Inativo'}</Badge></Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <Tooltip label="Excluir"><ActionIcon variant="subtle" color="red" onClick={() => handleDelete(item.id, item.nome)}><IconTrash size={18} /></ActionIcon></Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && items.length === 0 && (
              <Table.Tr><Table.Td colSpan={5} className="text-center py-8 text-zinc-500">Nenhum usuário</Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title="Novo Usuário" centered closeOnClickOutside={false}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-col gap-4">
            <Controller name="nome" control={control} render={({ field }) => (
              <TextInput label={<>Nome <span style={{ color: 'red' }}>*</span></>} error={errors.nome?.message} {...field} />
            )} />
            <Controller name="email" control={control} render={({ field }) => (
              <TextInput label={<>Email <span style={{ color: 'red' }}>*</span></>} error={errors.email?.message} {...field} />
            )} />
            <Controller name="senha" control={control} render={({ field }) => (
              <PasswordInput label={<>Senha <span style={{ color: 'red' }}>*</span></>} error={errors.senha?.message} {...field} />
            )} />
            <Controller name="perfil" control={control} render={({ field }) => (
              <Select label="Perfil" data={PERFIS} {...field} />
            )} />
          </div>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button type="submit" loading={criar.isPending}>Salvar</Button>
          </Group>
        </form>
      </Modal>
    </div>
  )
}
