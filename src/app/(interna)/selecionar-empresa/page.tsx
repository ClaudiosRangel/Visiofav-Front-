'use client'

import { useEffect, useState } from 'react'
import {
  Card,
  SimpleGrid,
  Text,
  Title,
  Center,
  Loader,
  Stack,
  Button,
  Group,
  Table,
  Badge,
  ActionIcon,
  Tooltip,
} from '@mantine/core'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { notifications } from '@mantine/notifications'
import { IconEdit, IconTrash, IconPlus, IconSettings, IconArrowLeft } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { useEmpresa } from '@/providers/EmpresaProvider'
import { getUserPerfil } from '@/hooks/usePerfilGuard'
import EmpresaModal from './EmpresaModal'

interface EmpresaItem {
  id: string
  razaoSocial: string
  nomeFantasia: string
  cnpj: string
}

interface EmpresaAdmin {
  id: string
  razaoSocial: string
  nomeFantasia: string | null
  cnpj: string
  inscEstadual: string | null
  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  uf: string | null
  cep: string | null
  telefone: string | null
  email: string | null
  usaWms: boolean
  status: boolean
  criadoEm: string
}

const ADMIN_PROFILES = ['SUPER_ADMIN', 'ADMIN', 'DIRETOR']

export default function SelecionarEmpresaPage() {
  useEffect(() => { document.title = 'Vizor - Selecionar Empresa' }, [])
  const router = useRouter()
  const { selecionarEmpresa } = useEmpresa()
  const queryClient = useQueryClient()

  const [modoGerenciar, setModoGerenciar] = useState(false)
  const [modalOpened, setModalOpened] = useState(false)
  const [editData, setEditData] = useState<EmpresaAdmin | undefined>(undefined)

  const perfil = getUserPerfil()
  const isAdmin = perfil ? ADMIN_PROFILES.includes(perfil) : false

  // Query para seleção (todos os usuários)
  const { data: empresas, isLoading } = useQuery<EmpresaItem[]>({
    queryKey: ['empresas-minhas'],
    queryFn: async () => {
      const { data } = await api.get('/empresas/minhas')
      return Array.isArray(data) ? data : [data]
    },
  })

  // Query para gerenciamento (admin only)
  const { data: empresasAdmin, isLoading: isLoadingAdmin, error: errorAdmin } = useQuery<EmpresaAdmin[]>({
    queryKey: ['empresas-admin'],
    queryFn: async () => {
      const { data } = await api.get('/empresas')
      return data.data || data
    },
    enabled: isAdmin && modoGerenciar,
  })

  // Soft-delete mutation
  const inativar = useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/empresas/${id}`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['empresas-admin'] })
      queryClient.invalidateQueries({ queryKey: ['empresas-minhas'] })
      notifications.show({ title: 'Sucesso', message: 'Empresa inativada', color: 'green' })
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Erro',
        message: err?.response?.data?.message || 'Falha ao inativar',
        color: 'red',
      })
    },
  })

  const handleSelecionar = async (emp: EmpresaItem) => {
    await selecionarEmpresa(emp)
    router.push('/modulos')
  }

  const handleEditar = (emp: EmpresaAdmin) => {
    setEditData(emp)
    setModalOpened(true)
  }

  const handleInativar = (emp: EmpresaAdmin) => {
    if (window.confirm(`Deseja realmente inativar a empresa "${emp.razaoSocial}"?`)) {
      inativar.mutate(emp.id)
    }
  }

  const handleNovaEmpresa = () => {
    setEditData(undefined)
    setModalOpened(true)
  }

  if (isLoading) {
    return (
      <Center h="60vh">
        <Loader size="lg" />
      </Center>
    )
  }

  // === Management View ===
  if (modoGerenciar && isAdmin) {
    return (
      <Stack gap="lg">
        <Group justify="space-between">
          <Group>
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => setModoGerenciar(false)}
            >
              Voltar para Seleção
            </Button>
            <Title order={2}>Gerenciar Empresas</Title>
          </Group>
          <Button leftSection={<IconPlus size={16} />} onClick={handleNovaEmpresa}>
            Nova Empresa
          </Button>
        </Group>

        {isLoadingAdmin ? (
          <Center h="40vh">
            <Loader size="lg" />
          </Center>
        ) : (
          <Table striped highlightOnHover withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Razão Social</Table.Th>
                <Table.Th>Nome Fantasia</Table.Th>
                <Table.Th>CNPJ</Table.Th>
                <Table.Th>Cidade/UF</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Ações</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {empresasAdmin?.map((emp) => (
                <Table.Tr key={emp.id}>
                  <Table.Td>{emp.razaoSocial}</Table.Td>
                  <Table.Td>{emp.nomeFantasia || '—'}</Table.Td>
                  <Table.Td>{emp.cnpj}</Table.Td>
                  <Table.Td>
                    {emp.cidade && emp.uf ? `${emp.cidade}/${emp.uf}` : '—'}
                  </Table.Td>
                  <Table.Td>
                    <Badge color={emp.status ? 'green' : 'red'} variant="light">
                      {emp.status ? 'Ativa' : 'Inativa'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap="xs">
                      <Tooltip label="Editar">
                        <ActionIcon variant="subtle" color="blue" onClick={() => handleEditar(emp)}>
                          <IconEdit size={16} />
                        </ActionIcon>
                      </Tooltip>
                      {emp.status && (
                        <Tooltip label="Inativar">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            onClick={() => handleInativar(emp)}
                            loading={inativar.isPending}
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {(!empresasAdmin || empresasAdmin.length === 0) && (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text ta="center" c="dimmed" py="md">
                      Nenhuma empresa cadastrada
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        )}

        <EmpresaModal
          opened={modalOpened}
          onClose={() => { setModalOpened(false); setEditData(undefined) }}
          editData={editData}
        />
      </Stack>
    )
  }

  // === Selector View (default) ===
  if (!empresas || empresas.length === 0) {
    return (
      <Stack gap="lg">
        {isAdmin && (
          <Group justify="flex-end">
            <Button
              variant="light"
              leftSection={<IconSettings size={16} />}
              onClick={() => setModoGerenciar(true)}
            >
              Gerenciar Empresas
            </Button>
          </Group>
        )}
        <Center h="60vh">
          <Text size="lg" c="dimmed">
            Nenhuma empresa disponível
          </Text>
        </Center>
      </Stack>
    )
  }

  return (
    <Stack gap="lg">
      <Group justify="space-between">
        <Title order={2}>Selecionar Empresa</Title>
        {isAdmin && (
          <Button
            variant="light"
            leftSection={<IconSettings size={16} />}
            onClick={() => setModoGerenciar(true)}
          >
            Gerenciar Empresas
          </Button>
        )}
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {empresas.map((emp) => (
          <Card
            key={emp.id}
            withBorder
            style={{ cursor: 'pointer' }}
            onClick={() => handleSelecionar(emp)}
          >
            <Text fw={600} size="lg">
              {emp.razaoSocial}
            </Text>
            {emp.nomeFantasia && (
              <Text size="sm" c="dimmed">
                {emp.nomeFantasia}
              </Text>
            )}
            <Text size="sm" c="dimmed" mt="xs">
              CNPJ: {emp.cnpj}
            </Text>
          </Card>
        ))}
      </SimpleGrid>

      <EmpresaModal
        opened={modalOpened}
        onClose={() => { setModalOpened(false); setEditData(undefined) }}
        editData={editData}
      />
    </Stack>
  )
}
