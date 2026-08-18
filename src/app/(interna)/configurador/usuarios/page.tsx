'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Button, Card, Group, Text, TextInput, PasswordInput, Table, Badge, ActionIcon,
  Tooltip, Modal, Select, LoadingOverlay, Switch, Checkbox, Pagination, Stack,
  Avatar, FileButton,
} from '@mantine/core'
import { IconPlus, IconSearch, IconEdit, IconTrash, IconRefresh } from '@tabler/icons-react'
import { useForm, Controller } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { usePerfilGuard } from '@/hooks/usePerfilGuard'

// ─── Types ───────────────────────────────────────────────────────────────────

interface Usuario {
  id: string
  nome: string
  email: string
  perfil: string
  status: boolean
  criadoEm: string
  funcionario: { id: string; nome: string } | null
}

interface UsuarioDetalhado extends Usuario {
  empresas: { empresaId: string; modulos: string }[]
  avatarUrl?: string | null
}

interface Funcionario {
  id: string
  nome: string
  codigo: number
  matricula: string
}

interface PaginatedResponse {
  data: Usuario[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PERFIS = [
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'SUPERVISOR', label: 'Supervisor' },
  { value: 'OPERADOR', label: 'Operador' },
]

const ALL_MODULES = ['WMS', 'COMPRAS', 'VENDAS', 'FINANCEIRO', 'FISCAL', 'PCP']

const perfilColor: Record<string, string> = { ADMIN: 'red', SUPERVISOR: 'orange', OPERADOR: 'blue' }

// ─── Schemas ─────────────────────────────────────────────────────────────────

const createSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  email: z.string().email('Email inválido'),
  senha: z.string().min(6, 'Mínimo 6 caracteres'),
  perfil: z.enum(['ADMIN', 'SUPERVISOR', 'OPERADOR']).default('OPERADOR'),
  funcionarioId: z.string().optional().or(z.literal('')),
  senhaPrimeiroAcesso: z.boolean().default(false),
  cadastrarPin: z.boolean().default(false),
  pin: z.string().regex(/^\d{6}$/, 'PIN deve ter exatamente 6 dígitos').optional().or(z.literal('')),
})

const editSchema = z.object({
  nome: z.string().min(3, 'Nome deve ter pelo menos 3 caracteres'),
  perfil: z.enum(['ADMIN', 'SUPERVISOR', 'OPERADOR']),
  status: z.boolean(),
  senha: z.string().min(6, 'Mínimo 6 caracteres').optional().or(z.literal('')),
})

type CreateFormValues = z.infer<typeof createSchema>
type EditFormValues = z.infer<typeof editSchema>

// ─── Page Component ──────────────────────────────────────────────────────────

export default function UsuariosPage() {
  usePerfilGuard(['ADMIN', 'SUPERVISOR'])

  const [modalOpen, setModalOpen] = useState(false)
  const [editItem, setEditItem] = useState<UsuarioDetalhado | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(1)

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  const qc = useQueryClient()

  const { data: response, isLoading, refetch } = useQuery<PaginatedResponse>({
    queryKey: ['usuarios', page, debouncedSearch],
    queryFn: async () => {
      const params: any = { page, limit: 20 }
      if (debouncedSearch) params.search = debouncedSearch
      const { data } = await api.get('/usuarios', { params })
      return data
    },
  })

  const items = response?.data || []
  const totalPages = response?.totalPages || 1

  // ─── Deactivate ──────────────────────────────────────────────────────────

  const deactivate = useMutation({
    mutationFn: async (id: string) => { await api.delete(`/usuarios/${id}`) },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usuarios'] }),
  })

  async function handleDeactivate(id: string, nome: string) {
    if (!confirm(`Deseja desativar o usuário ${nome}?`)) return
    try {
      await deactivate.mutateAsync(id)
      notifications.show({ title: 'Sucesso', message: 'Usuário desativado', color: 'green' })
    } catch {
      notifications.show({ title: 'Erro', message: 'Falha ao desativar', color: 'red' })
    }
  }

  // ─── Open Edit Modal ─────────────────────────────────────────────────────

  async function handleEdit(usuario: Usuario) {
    try {
      const { data } = await api.get(`/usuarios/${usuario.id}`)
      setEditItem(data)
      setModalOpen(true)
    } catch {
      notifications.show({ title: 'Erro', message: 'Falha ao carregar dados do usuário', color: 'red' })
    }
  }

  function handleNew() {
    setEditItem(null)
    setModalOpen(true)
  }

  function handleCloseModal() {
    setModalOpen(false)
    setEditItem(null)
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Configurador / Usuários</Text>
      <Text size="xl" fw={600} mb="lg">Usuários do Sistema</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Group justify="space-between" mb="md">
          <TextInput
            placeholder="Pesquisar por nome ou email..."
            leftSection={<IconSearch size={16} />}
            value={search}
            onChange={(e) => setSearch(e.currentTarget.value)}
            className="w-80"
          />
          <Group>
            <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
            <Button leftSection={<IconPlus size={16} />} onClick={handleNew}>Novo</Button>
          </Group>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nome</Table.Th>
              <Table.Th>Email</Table.Th>
              <Table.Th>Perfil</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Coletor</Table.Th>
              <Table.Th className="w-24">Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item) => (
              <Table.Tr key={item.id}>
                <Table.Td>{item.nome}</Table.Td>
                <Table.Td className="text-sm text-zinc-500">{item.email}</Table.Td>
                <Table.Td>
                  <Badge color={perfilColor[item.perfil] || 'gray'} variant="light">
                    {PERFIS.find(p => p.value === item.perfil)?.label || item.perfil}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge color={item.status ? 'green' : 'gray'}>
                    {item.status ? 'Ativo' : 'Inativo'}
                  </Badge>
                </Table.Td>
                <Table.Td className="text-sm">
                  {item.funcionario ? item.funcionario.nome : '—'}
                </Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <Tooltip label="Editar">
                      <ActionIcon variant="subtle" color="gray" onClick={() => handleEdit(item)}>
                        <IconEdit size={18} />
                      </ActionIcon>
                    </Tooltip>
                    <Tooltip label="Desativar">
                      <ActionIcon variant="subtle" color="red" onClick={() => handleDeactivate(item.id, item.nome)}>
                        <IconTrash size={18} />
                      </ActionIcon>
                    </Tooltip>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && items.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={6} className="text-center py-8 text-zinc-500">
                  Nenhum registro encontrado
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

      <UserFormModal
        opened={modalOpen}
        onClose={handleCloseModal}
        editItem={editItem}
      />
    </div>
  )
}

// ─── UserFormModal Component ─────────────────────────────────────────────────

function UserFormModal({
  opened,
  onClose,
  editItem,
}: {
  opened: boolean
  onClose: () => void
  editItem: UsuarioDetalhado | null
}) {
  const isEdit = !!editItem
  const qc = useQueryClient()

  // ─── Create Form ─────────────────────────────────────────────────────────
  const createForm = useForm<CreateFormValues>({
    resolver: zodResolver(createSchema),
    defaultValues: { nome: '', email: '', senha: '', perfil: 'OPERADOR', funcionarioId: '', senhaPrimeiroAcesso: false, cadastrarPin: false, pin: '' },
  })

  // ─── Edit Form ───────────────────────────────────────────────────────────
  const editForm = useForm<EditFormValues>({
    resolver: zodResolver(editSchema),
  })

  // ─── Permissions State ───────────────────────────────────────────────────
  const [selectedModules, setSelectedModules] = useState<string[]>([])

  // ─── Coletor State ───────────────────────────────────────────────────────
  const [coletorEnabled, setColetorEnabled] = useState(false)
  const [selectedFuncionarioId, setSelectedFuncionarioId] = useState<string | null>(null)
  const [coletorError, setColetorError] = useState('')

  // ─── Funcionarios for create form ────────────────────────────────────────
  const { data: funcionariosDisponiveis } = useQuery<Funcionario[]>({
    queryKey: ['funcionarios-disponiveis', editItem?.id],
    queryFn: async () => {
      const params: any = {}
      if (editItem?.id) params.usuarioId = editItem.id
      const { data } = await api.get('/usuarios/funcionarios-disponiveis', { params })
      return data
    },
    enabled: opened,
  })

  const funcOptions = (funcionariosDisponiveis || []).map((f) => ({
    value: f.id,
    label: `${f.nome} (${f.matricula})`,
  }))

  // ─── Reset forms when modal opens ───────────────────────────────────────
  useEffect(() => {
    if (!opened) return

    if (editItem) {
      editForm.reset({
        nome: editItem.nome,
        perfil: editItem.perfil as 'ADMIN' | 'SUPERVISOR' | 'OPERADOR',
        status: editItem.status,
        senha: '',
      })

      // Parse modules
      const empresaVinculo = editItem.empresas?.[0]
      if (empresaVinculo) {
        if (empresaVinculo.modulos === '*') {
          setSelectedModules([...ALL_MODULES])
        } else {
          setSelectedModules(empresaVinculo.modulos ? empresaVinculo.modulos.split(',').filter(Boolean) : [])
        }
      } else {
        setSelectedModules([])
      }

      // Coletor state
      if (editItem.funcionario) {
        setColetorEnabled(true)
        setSelectedFuncionarioId(editItem.funcionario.id)
      } else {
        setColetorEnabled(false)
        setSelectedFuncionarioId(null)
      }
      setColetorError('')
    } else {
      createForm.reset({ nome: '', email: '', senha: '', perfil: 'OPERADOR', funcionarioId: '', senhaPrimeiroAcesso: false, cadastrarPin: false, pin: '' })
      setSelectedModules([])
      setColetorEnabled(false)
      setSelectedFuncionarioId(null)
      setColetorError('')
    }
  }, [opened, editItem])

  // ─── Mutations ───────────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: async (body: CreateFormValues) => {
      const payload: any = {
        nome: body.nome,
        email: body.email,
        senha: body.senha,
        perfil: body.perfil,
        senhaPrimeiroAcesso: body.senhaPrimeiroAcesso,
        cadastrarPin: body.cadastrarPin,
      }
      if (body.funcionarioId) payload.funcionarioId = body.funcionarioId
      if (body.cadastrarPin && body.pin) payload.pin = body.pin
      const { data } = await api.post('/usuarios', payload)
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios'] })
      notifications.show({ title: 'Sucesso', message: 'Usuário criado com sucesso', color: 'green' })
      onClose()
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Falha ao criar usuário'
      notifications.show({ title: 'Erro', message: msg, color: 'red' })
    },
  })

  const editMutation = useMutation({
    mutationFn: async (body: EditFormValues) => {
      const payload: any = { nome: body.nome, perfil: body.perfil, status: body.status }
      if (body.senha && body.senha.length > 0) payload.senha = body.senha
      await api.put(`/usuarios/${editItem!.id}`, payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['usuarios'] })
    },
  })

  const modulosMutation = useMutation({
    mutationFn: async (modulos: string[]) => {
      await api.put(`/usuarios/${editItem!.id}/modulos`, { modulos })
    },
  })

  const coletorMutation = useMutation({
    mutationFn: async (payload: { enabled: boolean; funcionarioId?: string }) => {
      await api.put(`/usuarios/${editItem!.id}/coletor`, payload)
    },
  })

  // ─── Submit Handlers ─────────────────────────────────────────────────────
  async function onCreateSubmit(data: CreateFormValues) {
    await createMutation.mutateAsync(data)
  }

  async function onEditSubmit(data: EditFormValues) {
    // Validate coletor
    if (coletorEnabled && !selectedFuncionarioId) {
      setColetorError('Selecione um funcionário para habilitar o acesso ao coletor')
      return
    }

    try {
      await editMutation.mutateAsync(data)
      await modulosMutation.mutateAsync(selectedModules)
      await coletorMutation.mutateAsync({
        enabled: coletorEnabled,
        funcionarioId: coletorEnabled ? selectedFuncionarioId! : undefined,
      })
      notifications.show({ title: 'Sucesso', message: 'Usuário atualizado com sucesso', color: 'green' })
      onClose()
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Falha ao atualizar usuário'
      notifications.show({ title: 'Erro', message: msg, color: 'red' })
    }
  }

  // ─── Module Helpers ──────────────────────────────────────────────────────
  function toggleModule(mod: string) {
    setSelectedModules((prev) =>
      prev.includes(mod) ? prev.filter((m) => m !== mod) : [...prev, mod]
    )
  }

  function toggleAllModules() {
    if (selectedModules.length === ALL_MODULES.length) {
      setSelectedModules([])
    } else {
      setSelectedModules([...ALL_MODULES])
    }
  }

  const isPending = createMutation.isPending || editMutation.isPending || modulosMutation.isPending || coletorMutation.isPending

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={isEdit ? 'Editar Usuário' : 'Novo Usuário'}
      centered
      closeOnClickOutside={false}
      size="lg"
    >
      {!isEdit ? (
        // ─── Create Form ─────────────────────────────────────────────────
        <form onSubmit={createForm.handleSubmit(onCreateSubmit)}>
          <Stack gap="sm">
            <Controller name="nome" control={createForm.control} render={({ field }) => (
              <TextInput label={<>Nome <span style={{ color: 'red' }}>*</span></>} error={createForm.formState.errors.nome?.message} {...field} />
            )} />
            <Controller name="email" control={createForm.control} render={({ field }) => (
              <TextInput label={<>Email <span style={{ color: 'red' }}>*</span></>} error={createForm.formState.errors.email?.message} {...field} />
            )} />
            <Controller name="senha" control={createForm.control} render={({ field }) => (
              <PasswordInput label={<>Senha <span style={{ color: 'red' }}>*</span></>} error={createForm.formState.errors.senha?.message} {...field} />
            )} />
            <Controller name="perfil" control={createForm.control} render={({ field }) => (
              <Select label="Perfil" data={PERFIS} value={field.value} onChange={field.onChange} />
            )} />
            <Controller name="funcionarioId" control={createForm.control} render={({ field }) => (
              <Select
                label="Vincular Funcionário (opcional)"
                data={funcOptions}
                value={field.value || null}
                onChange={(val) => field.onChange(val || '')}
                clearable
                searchable
                placeholder="Selecione um funcionário..."
              />
            )} />

            {/* ─── Opções de Primeiro Acesso ────────────────────────────── */}
            <Text size="sm" fw={600} mt="xs">Opções de Acesso</Text>
            <Controller name="senhaPrimeiroAcesso" control={createForm.control} render={({ field }) => (
              <Checkbox
                label="Senha no primeiro acesso (forçar troca no login)"
                checked={field.value}
                onChange={(e) => field.onChange(e.currentTarget.checked)}
              />
            )} />
            <Controller name="cadastrarPin" control={createForm.control} render={({ field }) => (
              <Checkbox
                label="Cadastrar PIN (Checkout de Apontamento)"
                checked={field.value}
                onChange={(e) => field.onChange(e.currentTarget.checked)}
                disabled={!createForm.watch('funcionarioId')}
              />
            )} />
            {createForm.watch('cadastrarPin') && (
              <Controller name="pin" control={createForm.control} render={({ field }) => (
                <TextInput
                  label="PIN (6 dígitos numéricos)"
                  placeholder="000000"
                  maxLength={6}
                  error={createForm.formState.errors.pin?.message}
                  {...field}
                />
              )} />
            )}
            {createForm.watch('cadastrarPin') && !createForm.watch('funcionarioId') && (
              <Text size="xs" c="orange">Vincule um funcionário para cadastrar o PIN</Text>
            )}
          </Stack>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={isPending}>Salvar</Button>
          </Group>
        </form>
      ) : (
        // ─── Edit Form ───────────────────────────────────────────────────
        <form onSubmit={editForm.handleSubmit(onEditSubmit)}>
          <Stack gap="sm">
            <TextInput label="Email" value={editItem.email} readOnly disabled />
            <Controller name="nome" control={editForm.control} render={({ field }) => (
              <TextInput label={<>Nome <span style={{ color: 'red' }}>*</span></>} error={editForm.formState.errors.nome?.message} {...field} />
            )} />
            <Controller name="senha" control={editForm.control} render={({ field }) => (
              <PasswordInput label="Senha" placeholder="Deixe vazio para manter" error={editForm.formState.errors.senha?.message} {...field} />
            )} />
            <Button
              variant="light"
              color="orange"
              size="xs"
              onClick={async () => {
                if (!confirm('Resetar a senha deste usuário para "123456"? Ele precisará alterar no próximo login.')) return
                try {
                  await api.put(`/usuarios/${editItem!.id}/resetar-senha`, {})
                  notifications.show({ title: 'Sucesso', message: 'Senha resetada. O usuário deverá alterar no próximo acesso.', color: 'green' })
                } catch {
                  notifications.show({ title: 'Erro', message: 'Falha ao resetar senha', color: 'red' })
                }
              }}
            >
              Resetar Senha (forçar troca)
            </Button>
            <Controller name="perfil" control={editForm.control} render={({ field }) => (
              <Select label="Perfil" data={PERFIS} value={field.value} onChange={field.onChange} />
            )} />
            <Controller name="status" control={editForm.control} render={({ field }) => (
              <Switch
                label="Usuário ativo"
                checked={field.value}
                onChange={(e) => field.onChange(e.currentTarget.checked)}
              />
            )} />

            {/* ─── Avatar / Foto ────────────────────────────────────── */}
            <Text size="sm" fw={600} mt="xs">Foto do Usuário</Text>
            <AvatarUpload userId={editItem.id} currentAvatar={editItem.avatarUrl} />

            {/* ─── Permissions Section ──────────────────────────────────── */}
            <Text size="sm" fw={600} mt="xs">Permissões de Módulos</Text>
            <Checkbox
              label="Selecionar todos"
              checked={selectedModules.length === ALL_MODULES.length}
              indeterminate={selectedModules.length > 0 && selectedModules.length < ALL_MODULES.length}
              onChange={toggleAllModules}
            />
            <Group gap="sm">
              {ALL_MODULES.map((mod) => (
                <Checkbox
                  key={mod}
                  label={mod}
                  checked={selectedModules.includes(mod)}
                  onChange={() => toggleModule(mod)}
                />
              ))}
            </Group>
            {selectedModules.length === 0 && (
              <Text size="xs" c="orange">Usuário ficará sem acesso a módulos</Text>
            )}

            {/* ─── Coletor Section ─────────────────────────────────────── */}
            <Text size="sm" fw={600} mt="xs">Acesso ao Coletor</Text>
            <Switch
              label="Habilitar acesso ao coletor"
              checked={coletorEnabled}
              onChange={(e) => {
                setColetorEnabled(e.currentTarget.checked)
                setColetorError('')
              }}
            />
            {coletorEnabled && (
              <Select
                label="Funcionário"
                data={funcOptions}
                value={selectedFuncionarioId}
                onChange={(val) => { setSelectedFuncionarioId(val); setColetorError('') }}
                searchable
                placeholder="Selecione um funcionário..."
                error={coletorError || undefined}
              />
            )}
          </Stack>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={onClose}>Cancelar</Button>
            <Button type="submit" loading={isPending}>Salvar</Button>
          </Group>
        </form>
      )}
    </Modal>
  )
}

// ─── AvatarUpload Component ──────────────────────────────────────────────────

function AvatarUpload({ userId, currentAvatar }: { userId: string; currentAvatar?: string | null }) {
  const [preview, setPreview] = useState<string | null>(currentAvatar || null)
  const [uploading, setUploading] = useState(false)

  async function handleFile(file: File | null) {
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      notifications.show({ title: 'Arquivo grande', message: 'Máximo 2MB', color: 'red' })
      return
    }
    if (!file.type.startsWith('image/')) {
      notifications.show({ title: 'Formato inválido', message: 'Selecione uma imagem (JPG, PNG)', color: 'red' })
      return
    }

    // Converter para base64
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = reader.result as string
      setPreview(base64)
      setUploading(true)
      try {
        await api.put(`/usuarios/${userId}`, { avatarUrl: base64 })
        // Salvar no localStorage para o header pegar imediatamente
        try {
          const stored = localStorage.getItem('visiofab-wms-user')
          if (stored) {
            const parsed = JSON.parse(stored)
            parsed.avatarUrl = base64
            localStorage.setItem('visiofab-wms-user', JSON.stringify(parsed))
          }
        } catch {}
        notifications.show({ title: 'Foto salva', message: 'Avatar atualizado com sucesso', color: 'green' })
      } catch (err: any) {
        notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao salvar foto', color: 'red' })
      }
      setUploading(false)
    }
    reader.readAsDataURL(file)
  }

  async function handleRemover() {
    setPreview(null)
    setUploading(true)
    try {
      await api.put(`/usuarios/${userId}`, { avatarUrl: null })
      notifications.show({ title: 'Foto removida', message: '', color: 'green' })
    } catch {
      notifications.show({ title: 'Erro', message: 'Falha ao remover foto', color: 'red' })
    }
    setUploading(false)
  }

  const initials = 'U'

  return (
    <Group gap="md">
      <Avatar src={preview || undefined} size="lg" radius="xl" color="primary">
        {initials}
      </Avatar>
      <Stack gap={4}>
        <FileButton onChange={handleFile} accept="image/png,image/jpeg,image/webp">
          {(props) => (
            <Button variant="light" size="xs" loading={uploading} {...props}>
              {preview ? 'Trocar foto' : 'Enviar foto'}
            </Button>
          )}
        </FileButton>
        {preview && (
          <Button variant="subtle" size="xs" color="red" onClick={handleRemover} disabled={uploading}>
            Remover
          </Button>
        )}
        <Text size="xs" c="dimmed">JPG, PNG ou WebP. Máximo 2MB.</Text>
      </Stack>
    </Group>
  )
}
