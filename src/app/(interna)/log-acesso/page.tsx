'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Title, Text, Card, Table, Badge, Group, Select, TextInput, Stack, Center,
  Pagination, Loader, Button,
} from '@mantine/core'
import { IconHistory, IconSearch, IconRefresh } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { getUserPerfil } from '@/hooks/usePerfilGuard'

interface AcessoItem {
  id: string
  usuarioNome: string
  usuarioEmail: string | null
  usuarioPerfil: string | null
  empresaId: string | null
  empresaNome: string | null
  modulo: string
  rota: string | null
  ip: string | null
  userAgent: string | null
  dataHora: string
}

interface EmpresaOpt {
  id: string
  razaoSocial: string | null
  nomeFantasia: string | null
}

function formatDataHora(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function LogAcessoPage() {
  const router = useRouter()
  const perfil = getUserPerfil()
  const isSuperAdmin = perfil === 'SUPER_ADMIN'

  useEffect(() => { document.title = 'Vizor - Log de Acesso' }, [])

  // Guard de acesso: só SUPER_ADMIN
  useEffect(() => {
    if (perfil !== null && !isSuperAdmin) {
      router.replace('/selecionar-empresa')
    }
  }, [perfil, isSuperAdmin, router])

  const [empresaId, setEmpresaId] = useState<string | null>(null)
  const [modulo, setModulo] = useState('')
  const [dataInicio, setDataInicio] = useState('')
  const [dataFim, setDataFim] = useState('')
  const [page, setPage] = useState(1)

  const { data: empresasData } = useQuery({
    queryKey: ['log-acesso-empresas'],
    queryFn: async () => {
      const { data } = await api.get('/acesso-log/empresas')
      return data.empresas as EmpresaOpt[]
    },
    enabled: isSuperAdmin,
  })

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['log-acesso', empresaId, modulo, dataInicio, dataFim, page],
    queryFn: async () => {
      const params: Record<string, string | number> = { page, limit: 50 }
      if (empresaId) params.empresaId = empresaId
      if (modulo.trim()) params.modulo = modulo.trim()
      if (dataInicio) params.dataInicio = dataInicio
      if (dataFim) params.dataFim = dataFim
      const { data } = await api.get('/acesso-log/log', { params })
      return data as { items: AcessoItem[]; total: number; page: number; totalPages: number }
    },
    enabled: isSuperAdmin,
  })

  if (!isSuperAdmin) {
    return (
      <Center h="60vh">
        <Text c="dimmed">Acesso restrito.</Text>
      </Center>
    )
  }

  const empresaOptions = (empresasData || []).map((e) => ({
    value: e.id,
    label: e.nomeFantasia || e.razaoSocial || e.id,
  }))

  return (
    <div className="max-w-[1300px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <Title order={2} fw={700}>Log de Acesso</Title>
          <Text size="sm" c="dimmed">Histórico completo de acessos por usuário e módulo</Text>
        </div>
        <Button variant="light" leftSection={<IconRefresh size={16} />} size="xs" onClick={() => refetch()}>
          Atualizar
        </Button>
      </div>

      <Card shadow="xs" radius="md" p="lg">
        <Group gap="sm" mb="md" align="flex-end">
          <Select
            label="Empresa"
            placeholder="Todas"
            data={empresaOptions}
            value={empresaId}
            onChange={(v) => { setEmpresaId(v); setPage(1) }}
            clearable
            searchable
            size="xs"
            style={{ minWidth: 220 }}
          />
          <TextInput
            label="Módulo"
            placeholder="Ex.: PCP, Fiscal, WMS"
            leftSection={<IconSearch size={14} />}
            value={modulo}
            onChange={(e) => { setModulo(e.currentTarget.value); setPage(1) }}
            size="xs"
          />
          <TextInput
            label="De"
            type="date"
            value={dataInicio}
            onChange={(e) => { setDataInicio(e.currentTarget.value); setPage(1) }}
            size="xs"
          />
          <TextInput
            label="Até"
            type="date"
            value={dataFim}
            onChange={(e) => { setDataFim(e.currentTarget.value); setPage(1) }}
            size="xs"
          />
        </Group>

        {isLoading || isFetching ? (
          <Center py="xl"><Loader /></Center>
        ) : !data || data.items.length === 0 ? (
          <Center py="xl">
            <Stack align="center" gap="sm">
              <IconHistory size={48} className="text-gray-300" />
              <Text c="dimmed">Nenhum acesso registrado para os filtros selecionados</Text>
            </Stack>
          </Center>
        ) : (
          <>
            <Table.ScrollContainer minWidth={900}>
              <Table striped highlightOnHover verticalSpacing="xs">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Data/Hora</Table.Th>
                    <Table.Th>Usuário</Table.Th>
                    <Table.Th>Perfil</Table.Th>
                    <Table.Th>Empresa</Table.Th>
                    <Table.Th>Módulo</Table.Th>
                    <Table.Th>IP</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.items.map((item) => (
                    <Table.Tr key={item.id}>
                      <Table.Td style={{ whiteSpace: 'nowrap' }}>{formatDataHora(item.dataHora)}</Table.Td>
                      <Table.Td>
                        <Text size="sm">{item.usuarioNome}</Text>
                        {item.usuarioEmail && <Text size="xs" c="dimmed">{item.usuarioEmail}</Text>}
                      </Table.Td>
                      <Table.Td>
                        {item.usuarioPerfil && <Badge size="sm" variant="light">{item.usuarioPerfil}</Badge>}
                      </Table.Td>
                      <Table.Td>{item.empresaNome || '—'}</Table.Td>
                      <Table.Td><Badge size="sm" color="teal" variant="light">{item.modulo}</Badge></Table.Td>
                      <Table.Td><Text size="xs" c="dimmed">{item.ip || '—'}</Text></Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>

            <Group justify="space-between" mt="md">
              <Text size="xs" c="dimmed">{data.total} registro(s)</Text>
              {data.totalPages > 1 && (
                <Pagination value={page} onChange={setPage} total={data.totalPages} size="sm" />
              )}
            </Group>
          </>
        )}
      </Card>
    </div>
  )
}
