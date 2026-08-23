'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Button, Card, Group, Text, Table, Badge, ActionIcon, Tooltip,
  LoadingOverlay, Modal, TextInput, Select, CopyButton, Switch, Stack,
} from '@mantine/core'
import {
  IconPlus, IconRefresh, IconEdit, IconUserOff, IconKey, IconAlertTriangle,
  IconCopy, IconCheck,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { usePerfilGuard } from '@/hooks/usePerfilGuard'
import {
  useRepresentantes,
  useCriarRepresentante,
  useEditarRepresentante,
  useVendedoresDisponiveis,
  useInativarRepresentante,
  useResetarSenha,
} from '@/data/hooks/portal-representante/useRepresentantes'
import { statusRepresentanteColors } from '@/data/hooks/portal-representante/types'
import type { Representante } from '@/data/hooks/portal-representante/types'

export function isValidEmail(value: string): boolean {
  if (!value) return false
  const atIndex = value.indexOf('@')
  if (atIndex < 1) return false
  const afterAt = value.slice(atIndex + 1)
  return afterAt.includes('.') && !afterAt.endsWith('.')
}

export default function RepresentantesPage() {
  usePerfilGuard(['ADMIN', 'SUPER_ADMIN'])
  useEffect(() => { document.title = 'Vizor - Portal Representante - Representantes' }, [])

  const router = useRouter()

  // Modal states (to be used by tasks 4.2, 4.3, 4.4)
  const [modalCriar, setModalCriar] = useState(false)
  const [modalEditar, setModalEditar] = useState(false)
  const [representanteEditando, setRepresentanteEditando] = useState<Representante | null>(null)
  const [senhaTemporariaDialog, setSenhaTemporariaDialog] = useState<string | null>(null)

  // Form state for creation modal
  const [email, setEmail] = useState('')
  const [vendedorId, setVendedorId] = useState<string | null>(null)
  const [erroForm, setErroForm] = useState<string | null>(null)

  // Form state for edit modal
  const [editEmail, setEditEmail] = useState('')
  const [editStatus, setEditStatus] = useState<string | null>(null)
  const [editNotificacaoEmail, setEditNotificacaoEmail] = useState(false)
  const [erroFormEditar, setErroFormEditar] = useState<string | null>(null)

  const { data: representantes, isLoading, error, refetch } = useRepresentantes()
  const { data: vendedoresDisponiveis } = useVendedoresDisponiveis()
  const criarRepresentante = useCriarRepresentante()
  const editarRepresentante = useEditarRepresentante()
  const inativar = useInativarRepresentante()
  const resetarSenha = useResetarSenha()

  const items = representantes || []

  function fecharModalCriar() {
    setModalCriar(false)
    setEmail('')
    setVendedorId(null)
    setErroForm(null)
  }

  function handleSubmitCriar() {
    if (!vendedorId) {
      setErroForm('Selecione um vendedor.')
      return
    }
    if (!isValidEmail(email)) {
      setErroForm('Formato de e-mail inválido.')
      return
    }
    setErroForm(null)
    criarRepresentante.mutate(
      { vendedorId, email },
      {
        onSuccess: (data) => {
          fecharModalCriar()
          setSenhaTemporariaDialog(data.senhaTemporaria)
        },
        onError: (err: any) => {
          if (err?.response?.status === 400 && err?.response?.data?.message?.toLowerCase().includes('empresa')) {
            router.replace('/selecionar-empresa')
            return
          }
          if (err?.response?.status === 403) {
            notifications.show({ title: 'Acesso negado', message: 'Apenas administradores podem acessar esta funcionalidade', color: 'red' })
            return
          }
          const msg = err?.response?.data?.message || 'Erro inesperado. Tente novamente.'
          setErroForm(msg)
        },
      },
    )
  }

  function handleEditar(rep: Representante) {
    setRepresentanteEditando(rep)
    setEditEmail(rep.email)
    setEditStatus(rep.status)
    setEditNotificacaoEmail(rep.notificacaoEmail)
    setErroFormEditar(null)
    setModalEditar(true)
  }

  function fecharModalEditar() {
    setModalEditar(false)
    setRepresentanteEditando(null)
    setErroFormEditar(null)
  }

  function handleSubmitEditar() {
    if (!representanteEditando) return
    if (!isValidEmail(editEmail)) {
      setErroFormEditar('Formato de e-mail inválido.')
      return
    }
    setErroFormEditar(null)
    editarRepresentante.mutate(
      {
        id: representanteEditando.id,
        data: {
          email: editEmail,
          status: editStatus as 'ATIVO' | 'INATIVO',
          notificacaoEmail: editNotificacaoEmail,
        },
      },
      {
        onSuccess: () => {
          fecharModalEditar()
          notifications.show({
            title: 'Representante atualizado',
            message: 'Os dados foram salvos com sucesso.',
            color: 'green',
          })
        },
        onError: (err: any) => {
          if (err?.response?.status === 400 && err?.response?.data?.message?.toLowerCase().includes('empresa')) {
            router.replace('/selecionar-empresa')
            return
          }
          if (err?.response?.status === 403) {
            notifications.show({ title: 'Acesso negado', message: 'Apenas administradores podem acessar esta funcionalidade', color: 'red' })
            return
          }
          const msg = err?.response?.data?.message || 'Erro ao salvar alterações. Tente novamente.'
          setErroFormEditar(msg)
        },
      },
    )
  }

  function handleInativar(rep: Representante) {
    const confirmed = confirm(
      `Tem certeza que deseja inativar a conta de ${rep.vendedorNome}? O acesso ao portal será revogado.`,
    )
    if (!confirmed) return
    inativar.mutate(rep.id, {
      onSuccess: () => {
        notifications.show({
          title: 'Conta inativada',
          message: `A conta de ${rep.vendedorNome} foi inativada com sucesso.`,
          color: 'green',
        })
      },
      onError: (err: any) => {
        if (err?.response?.status === 400 && err?.response?.data?.message?.toLowerCase().includes('empresa')) {
          router.replace('/selecionar-empresa')
          return
        }
        if (err?.response?.status === 403) {
          notifications.show({ title: 'Acesso negado', message: 'Apenas administradores podem acessar esta funcionalidade', color: 'red' })
          return
        }
        const msg = err?.response?.data?.message || 'Erro ao inativar conta. Tente novamente.'
        notifications.show({ title: 'Erro', message: msg, color: 'red' })
      },
    })
  }

  function handleResetarSenha(rep: Representante) {
    const confirmed = confirm(
      `Gerar nova senha temporária para ${rep.vendedorNome}? A senha atual será invalidada.`,
    )
    if (!confirmed) return
    resetarSenha.mutate(rep.id, {
      onSuccess: (data) => {
        setSenhaTemporariaDialog(data.senhaTemporaria)
      },
      onError: (err: any) => {
        if (err?.response?.status === 400 && err?.response?.data?.message?.toLowerCase().includes('empresa')) {
          router.replace('/selecionar-empresa')
          return
        }
        if (err?.response?.status === 403) {
          notifications.show({ title: 'Acesso negado', message: 'Apenas administradores podem acessar esta funcionalidade', color: 'red' })
          return
        }
        const msg = err?.response?.data?.message || 'Erro ao resetar senha. Tente novamente.'
        notifications.show({ title: 'Erro', message: msg, color: 'red' })
      },
    })
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Portal Representante / Representantes</Text>
      <Text size="xl" fw={600} mb="lg">Representantes</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />

        {/* Actions row */}
        <Group justify="flex-end" mb="md">
          <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>
            Atualizar
          </Button>
          <Button leftSection={<IconPlus size={16} />} onClick={() => setModalCriar(true)}>
            Novo Representante
          </Button>
        </Group>

        {/* Error state */}
        {error && !isLoading && (
          <Group justify="center" py="xl">
            <Text c="red" size="sm">
              Erro ao carregar representantes.{' '}
              <Text component="span" c="blue" style={{ cursor: 'pointer' }} onClick={() => refetch()}>
                Tentar novamente
              </Text>
            </Text>
          </Group>
        )}

        {/* Table */}
        {!error && (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nome do Vendedor</Table.Th>
                <Table.Th>E-mail</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Último Acesso</Table.Th>
                <Table.Th>Data de Criação</Table.Th>
                <Table.Th style={{ width: 130 }}>Ações</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {items.map((rep) => (
                <Table.Tr key={rep.id}>
                  <Table.Td>
                    <Group gap={6}>
                      <Text size="sm" fw={500}>{rep.vendedorNome}</Text>
                      {rep.senhaTemporaria && (
                        <Tooltip label="Senha temporária pendente">
                          <Badge
                            size="xs"
                            variant="light"
                            color="yellow"
                            leftSection={<IconAlertTriangle size={10} />}
                          >
                            Senha temp.
                          </Badge>
                        </Tooltip>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>{rep.email}</Table.Td>
                  <Table.Td>
                    <Badge color={statusRepresentanteColors[rep.status]}>
                      {rep.status}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    {rep.ultimoAcesso
                      ? new Date(rep.ultimoAcesso).toLocaleString('pt-BR')
                      : '—'}
                  </Table.Td>
                  <Table.Td>
                    {new Date(rep.criadoEm).toLocaleDateString('pt-BR')}
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <Tooltip label="Editar">
                        <ActionIcon variant="subtle" color="blue" onClick={() => handleEditar(rep)}>
                          <IconEdit size={18} />
                        </ActionIcon>
                      </Tooltip>
                      {rep.status === 'ATIVO' && (
                        <Tooltip label="Inativar">
                          <ActionIcon variant="subtle" color="red" onClick={() => handleInativar(rep)} disabled={inativar.isPending}>
                            <IconUserOff size={18} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                      <Tooltip label="Resetar Senha">
                        <ActionIcon variant="subtle" color="orange" onClick={() => handleResetarSenha(rep)} disabled={resetarSenha.isPending}>
                          <IconKey size={18} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {!isLoading && items.length === 0 && !error && (
                <Table.Tr>
                  <Table.Td colSpan={6} className="text-center py-8 text-zinc-500">
                    Nenhum representante encontrado
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {/* Modal de Criação de Representante */}
      <Modal
        opened={modalCriar}
        onClose={fecharModalCriar}
        title="Novo Representante"
        centered
      >
        <Select
          label="Vendedor"
          placeholder="Selecione um vendedor"
          data={(vendedoresDisponiveis || []).map((v) => ({ value: v.id, label: v.nome }))}
          value={vendedorId}
          onChange={setVendedorId}
          searchable
          mb="md"
        />
        <TextInput
          label="E-mail"
          placeholder="email@exemplo.com"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          error={erroForm && !vendedorId ? undefined : undefined}
          mb="md"
        />
        {erroForm && (
          <Text size="sm" c="red" mb="md">
            {erroForm}
          </Text>
        )}
        <Group justify="flex-end">
          <Button variant="default" onClick={fecharModalCriar}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmitCriar}
            loading={criarRepresentante.isPending}
            disabled={criarRepresentante.isPending}
          >
            Criar
          </Button>
        </Group>
      </Modal>

      {/* Modal de Edição de Representante */}
      <Modal
        opened={modalEditar}
        onClose={fecharModalEditar}
        title="Editar Representante"
        centered
      >
        <Stack gap="md">
          <Text size="sm" fw={500} c="dimmed">
            Vendedor: {representanteEditando?.vendedorNome}
          </Text>
          <TextInput
            label="E-mail"
            placeholder="email@exemplo.com"
            value={editEmail}
            onChange={(e) => setEditEmail(e.currentTarget.value)}
          />
          <Select
            label="Status"
            data={[
              { value: 'ATIVO', label: 'Ativo' },
              { value: 'INATIVO', label: 'Inativo' },
            ]}
            value={editStatus}
            onChange={setEditStatus}
          />
          <Switch
            label="Notificação por e-mail"
            checked={editNotificacaoEmail}
            onChange={(e) => setEditNotificacaoEmail(e.currentTarget.checked)}
          />
          {erroFormEditar && (
            <Text size="sm" c="red">
              {erroFormEditar}
            </Text>
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={fecharModalEditar}>
              Cancelar
            </Button>
            <Button
              onClick={handleSubmitEditar}
              loading={editarRepresentante.isPending}
              disabled={editarRepresentante.isPending}
            >
              Salvar
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Diálogo de Senha Temporária */}
      <Modal
        opened={senhaTemporariaDialog !== null}
        onClose={() => setSenhaTemporariaDialog(null)}
        title="Senha Temporária"
        centered
      >
        <Text size="sm" mb="xs">
          A senha temporária gerada para o representante é:
        </Text>
        <Group gap="xs" mb="md">
          <TextInput
            value={senhaTemporariaDialog || ''}
            readOnly
            style={{ flex: 1 }}
          />
          <CopyButton value={senhaTemporariaDialog || ''}>
            {({ copied, copy }) => (
              <ActionIcon color={copied ? 'teal' : 'blue'} variant="filled" onClick={copy}>
                {copied ? <IconCheck size={16} /> : <IconCopy size={16} />}
              </ActionIcon>
            )}
          </CopyButton>
        </Group>
        <Text size="xs" c="dimmed" mb="md">
          Copie e repasse esta senha ao representante. Ela não será exibida novamente.
        </Text>
        <Group justify="flex-end">
          <Button onClick={() => setSenhaTemporariaDialog(null)}>
            Fechar
          </Button>
        </Group>
      </Modal>
    </div>
  )
}
