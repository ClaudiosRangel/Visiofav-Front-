'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Title, Text, Card, Table, Group, Select, TextInput, Stack, Center, Loader,
} from '@mantine/core'
import { IconSearch, IconBuildingBank } from '@tabler/icons-react'
import { useEmpresasFinanceiro } from '@/hooks/financeiro-vizor/useEmpresasFinanceiro'
import { useSuperAdminGuard } from '@/hooks/financeiro-vizor/useSuperAdminGuard'
import { filtrarEmpresas, type FiltroStatus } from '@/lib/financeiro-vizor/filtros'
import { formatarBRL } from '@/lib/financeiro-vizor/format'
import {
  StatusFinanceiroBadge,
  ROTULOS_STATUS_FINANCEIRO,
} from '@/components/financeiro-vizor/StatusFinanceiroBadge'
import type { StatusFinanceiro } from '@/lib/financeiro-vizor/types'

/**
 * Opções do filtro de status: "todos" + cada valor de `StatusFinanceiro` com
 * seu rótulo legível. (Req 2.7, 2.8)
 */
const STATUS_OPCOES: { value: FiltroStatus; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  ...(Object.keys(ROTULOS_STATUS_FINANCEIRO) as StatusFinanceiro[]).map((s) => ({
    value: s as FiltroStatus,
    label: ROTULOS_STATUS_FINANCEIRO[s],
  })),
]

/**
 * Página de listagem de empresas do painel Financeiro Vizor (Req 2).
 *
 * Exclusiva do SUPER_ADMIN via `useSuperAdminGuard`: enquanto verifica exibe um
 * loader; se negado, não renderiza dados de cobrança (o guard já notifica e/ou
 * redireciona); se permitido, renderiza a tela.
 */
export default function FinanceiroVizorListaPage() {
  const router = useRouter()
  const guarda = useSuperAdminGuard()

  const [termo, setTermo] = useState('')
  const [status, setStatus] = useState<FiltroStatus>('todos')

  useEffect(() => {
    document.title = 'Vizor - Financeiro Vizor'
  }, [])

  // Só habilita a query quando o acesso está liberado (evita chamada à API
  // enquanto o guard ainda verifica ou quando o acesso foi negado).
  const habilitado = guarda === 'permitido'
  const { data: empresas, isLoading } = useEmpresasFinanceiro()

  const filtradas = useMemo(
    () => filtrarEmpresas(empresas ?? [], { termo, status }),
    [empresas, termo, status],
  )

  // Verificação de acesso em andamento: loader neutro. (Req 1)
  if (guarda === 'verificando') {
    return (
      <Center h="60vh">
        <Loader />
      </Center>
    )
  }

  // Acesso negado: o guard já exibiu notificação e/ou redirecionou; não
  // renderiza dados de cobrança. (Req 1.3, 1.5)
  if (!habilitado) {
    return (
      <Center h="60vh">
        <Text c="dimmed">Acesso restrito.</Text>
      </Center>
    )
  }

  return (
    <div className="max-w-[1300px] mx-auto">
      <div className="mb-6">
        <Title order={2} fw={700}>Financeiro Vizor</Title>
        <Text size="sm" c="dimmed">
          Cobrança recorrente das empresas clientes do Vizor
        </Text>
      </div>

      <Card shadow="xs" radius="md" p="lg">
        <Group gap="sm" mb="md" align="flex-end">
          <TextInput
            label="Buscar por nome"
            placeholder="Nome da empresa"
            leftSection={<IconSearch size={14} />}
            value={termo}
            onChange={(e) => setTermo(e.currentTarget.value)}
            size="xs"
            style={{ minWidth: 260, flex: 1 }}
          />
          <Select
            label="Status"
            data={STATUS_OPCOES}
            value={status}
            onChange={(v) => setStatus((v as FiltroStatus) ?? 'todos')}
            size="xs"
            allowDeselect={false}
            style={{ minWidth: 200 }}
          />
        </Group>

        {isLoading ? (
          <Center py="xl">
            <Loader />
          </Center>
        ) : filtradas.length === 0 ? (
          <Center py="xl">
            <Stack align="center" gap="sm">
              <IconBuildingBank size={48} className="text-gray-300" />
              <Text c="dimmed">
                {(empresas ?? []).length === 0
                  ? 'Nenhuma empresa a exibir'
                  : 'Nenhuma empresa encontrada para os filtros selecionados'}
              </Text>
            </Stack>
          </Center>
        ) : (
          <Table.ScrollContainer minWidth={720}>
            <Table striped highlightOnHover verticalSpacing="sm">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Nome</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th ta="right">Total Mensal</Table.Th>
                  <Table.Th ta="right">Total Vencido</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {filtradas.map((empresa) => (
                  <Table.Tr
                    key={empresa.empresaId}
                    style={{ cursor: 'pointer' }}
                    onClick={() => router.push(`/financeiro-vizor/${empresa.empresaId}`)}
                  >
                    <Table.Td>
                      <Text size="sm" fw={500}>{empresa.nome}</Text>
                    </Table.Td>
                    <Table.Td>
                      <StatusFinanceiroBadge status={empresa.statusFinanceiro} />
                    </Table.Td>
                    <Table.Td ta="right">{formatarBRL(empresa.totalMensal)}</Table.Td>
                    <Table.Td ta="right">{formatarBRL(empresa.totalVencidoEmAberto)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}
      </Card>
    </div>
  )
}
