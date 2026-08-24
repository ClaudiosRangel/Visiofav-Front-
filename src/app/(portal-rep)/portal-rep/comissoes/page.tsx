'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  ActionIcon,
  Card,
  Group,
  Select,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { IconChevronLeft, IconChevronRight, IconSearch } from '@tabler/icons-react'
import {
  usePortalRepComissoes,
  usePortalRepComissoesDetalhe,
} from '@/data/hooks/portal-rep-app/usePortalRepComissoes'
import { formatarMoeda } from '@/components/portal-rep/formatters'
import { PullToRefresh } from '@/components/portal-rep/PullToRefresh'
import { SkeletonCard } from '@/components/portal-rep/SkeletonCard'
import { EmptyState } from '@/components/portal-rep/EmptyState'

const MESES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

function getMesAnoAtual() {
  const now = new Date()
  return { mes: now.getMonth() + 1, ano: now.getFullYear() }
}

export default function ComissoesPage() {
  const [mesAno, setMesAno] = useState(getMesAnoAtual)
  const [filtroCliente, setFiltroCliente] = useState('')
  const [filtroPeriodo, setFiltroPeriodo] = useState<string | null>(null)

  // Resumo mensal
  const resumoQuery = usePortalRepComissoes({ mes: mesAno.mes, ano: mesAno.ano })

  // Detalhamento — passa filtros ao hook
  const detalheParams = useMemo(() => {
    const params: Record<string, unknown> = { mes: mesAno.mes, ano: mesAno.ano }
    if (filtroPeriodo) params.periodo = filtroPeriodo
    if (filtroCliente.trim()) params.cliente = filtroCliente.trim()
    return params
  }, [mesAno, filtroPeriodo, filtroCliente])

  const detalheQuery = usePortalRepComissoesDetalhe(detalheParams)

  // Navegação entre meses
  const irMesAnterior = useCallback(() => {
    setMesAno((prev) => {
      if (prev.mes === 1) return { mes: 12, ano: prev.ano - 1 }
      return { mes: prev.mes - 1, ano: prev.ano }
    })
  }, [])

  const irMesProximo = useCallback(() => {
    setMesAno((prev) => {
      if (prev.mes === 12) return { mes: 1, ano: prev.ano + 1 }
      return { mes: prev.mes + 1, ano: prev.ano }
    })
  }, [])

  // Totalizador
  const totalComissao = useMemo(() => {
    if (!detalheQuery.data) return 0
    return detalheQuery.data.reduce((acc, item) => acc + item.valorComissao, 0)
  }, [detalheQuery.data])

  // Pull to refresh
  const handleRefresh = useCallback(async () => {
    await Promise.all([resumoQuery.refetch(), detalheQuery.refetch()])
  }, [resumoQuery, detalheQuery])

  return (
    <PullToRefresh onRefresh={handleRefresh}>
      <Stack gap="md" p="md">
        <Title order={3}>Comissões</Title>

        {/* Card de Resumo Mensal */}
        {resumoQuery.isLoading ? (
          <SkeletonCard lines={3} />
        ) : (
          <Card>
            <Stack gap="sm">
              {/* Navegação de mês */}
              <Group justify="space-between" align="center">
                <ActionIcon
                  variant="subtle"
                  color="green"
                  onClick={irMesAnterior}
                  aria-label="Mês anterior"
                  size="lg"
                >
                  <IconChevronLeft size={20} />
                </ActionIcon>

                <Text fw={600} size="lg">
                  {MESES[mesAno.mes - 1]} {mesAno.ano}
                </Text>

                <ActionIcon
                  variant="subtle"
                  color="green"
                  onClick={irMesProximo}
                  aria-label="Próximo mês"
                  size="lg"
                >
                  <IconChevronRight size={20} />
                </ActionIcon>
              </Group>

              {/* Valores grandes de comissão */}
              <Group justify="center" gap="xl" mt="sm">
                <Stack gap={0} align="center">
                  <Text size="xs" c="dimmed">
                    Projetada
                  </Text>
                  <Text fw={700} size="xl" c="green">
                    {formatarMoeda(resumoQuery.data?.projetada ?? 0)}
                  </Text>
                </Stack>
                <Stack gap={0} align="center">
                  <Text size="xs" c="dimmed">
                    Realizada
                  </Text>
                  <Text fw={700} size="xl">
                    {formatarMoeda(resumoQuery.data?.realizada ?? 0)}
                  </Text>
                </Stack>
              </Group>
            </Stack>
          </Card>
        )}

        {/* Filtros do detalhamento */}
        <Group gap="sm">
          <TextInput
            placeholder="Filtrar por cliente"
            leftSection={<IconSearch size={16} />}
            value={filtroCliente}
            onChange={(e) => setFiltroCliente(e.currentTarget.value)}
            style={{ flex: 1 }}
          />
          <Select
            placeholder="Período"
            clearable
            value={filtroPeriodo}
            onChange={setFiltroPeriodo}
            data={[
              { value: 'mes-atual', label: 'Mês atual' },
              { value: 'mes-anterior', label: 'Mês anterior' },
              { value: 'trimestre', label: 'Trimestre' },
              { value: 'semestre', label: 'Semestre' },
            ]}
            style={{ minWidth: 140 }}
          />
        </Group>

        {/* Detalhamento por pedido */}
        {detalheQuery.isLoading ? (
          <SkeletonCard lines={5} />
        ) : !detalheQuery.data || detalheQuery.data.length === 0 ? (
          <EmptyState
            title="Nenhuma comissão encontrada"
            description="Não há comissões para o período selecionado."
          />
        ) : (
          <Card p={0} style={{ overflow: 'auto' }}>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Pedido</Table.Th>
                  <Table.Th>Cliente</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Valor Venda</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>%</Table.Th>
                  <Table.Th style={{ textAlign: 'right' }}>Comissão</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {detalheQuery.data.map((item, idx) => (
                  <Table.Tr key={`${item.pedidoNumero}-${idx}`}>
                    <Table.Td>{item.pedidoNumero}</Table.Td>
                    <Table.Td>{item.clienteNome}</Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      {formatarMoeda(item.valorVenda)}
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      {item.percentualComissao.toFixed(1)}%
                    </Table.Td>
                    <Table.Td style={{ textAlign: 'right' }}>
                      {formatarMoeda(item.valorComissao)}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
              {/* Totalizador */}
              <Table.Tfoot>
                <Table.Tr>
                  <Table.Td colSpan={4}>
                    <Text fw={700}>Total</Text>
                  </Table.Td>
                  <Table.Td style={{ textAlign: 'right' }}>
                    <Text fw={700}>{formatarMoeda(totalComissao)}</Text>
                  </Table.Td>
                </Table.Tr>
              </Table.Tfoot>
            </Table>
          </Card>
        )}
      </Stack>
    </PullToRefresh>
  )
}
