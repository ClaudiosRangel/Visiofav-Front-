'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card, Group, Text, Table, Badge, Button, ActionIcon, Tooltip,
  LoadingOverlay, Select, Pagination, TextInput,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { useDebouncedValue } from '@mantine/hooks'
import { IconCalculator, IconRefresh, IconSearch, IconReceipt } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { usePerfilGuard } from '@/hooks/usePerfilGuard'
import { useSolicitacoesOrcamento, useCalcularOrcamento, useConverterEmPedido } from '@/data/hooks/portal-representante/useSolicitacoesOrcamento'
import type { StatusSolicitacao, SolicitacoesFilters } from '@/data/hooks/portal-representante/types'
import { statusSolicitacaoColors } from '@/data/hooks/portal-representante/types'

const STATUS_OPTIONS = [
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'CALCULADO', label: 'Calculado' },
  { value: 'ENVIADO', label: 'Enviado' },
  { value: 'ACEITO', label: 'Aceito' },
  { value: 'RECUSADO', label: 'Recusado' },
]

export default function SolicitacoesOrcamentoPage() {
  usePerfilGuard(['ADMIN', 'SUPER_ADMIN'])
  useEffect(() => { document.title = 'Vizor - Portal Representante - Solicitações de Orçamento' }, [])

  const router = useRouter()

  // Filter state
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [vendedorFilter, setVendedorFilter] = useState('')
  const [clienteNome, setClienteNome] = useState('')
  const [debouncedClienteNome] = useDebouncedValue(clienteNome, 400)
  const [dataInicio, setDataInicio] = useState<Date | null>(null)
  const [dataFim, setDataFim] = useState<Date | null>(null)
  const [page, setPage] = useState(1)
  const pageSize = 20

  // Reset page when any filter changes
  useEffect(() => { setPage(1) }, [statusFilter, vendedorFilter, debouncedClienteNome, dataInicio, dataFim])

  // Build filters object
  const filters: SolicitacoesFilters = {
    page,
    pageSize,
    ...(statusFilter ? { status: statusFilter as StatusSolicitacao } : {}),
    ...(vendedorFilter.trim() ? { vendedorId: vendedorFilter.trim() } : {}),
    ...(debouncedClienteNome.trim() ? { clienteNome: debouncedClienteNome.trim() } : {}),
    ...(dataInicio ? { dataInicio: dataInicio.toISOString().split('T')[0] } : {}),
    ...(dataFim ? { dataFim: dataFim.toISOString().split('T')[0] } : {}),
  }

  const { data: response, isLoading, refetch } = useSolicitacoesOrcamento(filters)
  const calcular = useCalcularOrcamento()
  const converter = useConverterEmPedido()

  const items = response?.solicitacoes || []
  const total = response?.total || 0
  const totalPages = Math.ceil(total / pageSize)

  // Track which item is being calculated
  const [calculandoId, setCalculandoId] = useState<string | null>(null)
  const [convertendoId, setConvertendoId] = useState<string | null>(null)

  function handleCalcular(id: string) {
    if (confirm('Confirmar cálculo do orçamento? O orçamento será processado pelo motor de cálculo.')) {
      setCalculandoId(id)
      calcular.mutate(id, {
        onSuccess: () => {
          notifications.show({ title: 'Sucesso', message: 'Orçamento calculado com sucesso', color: 'green' })
          setCalculandoId(null)
        },
        onError: (err: any) => {
          if (err?.response?.status === 400 && err?.response?.data?.message?.toLowerCase().includes('empresa')) {
            router.replace('/selecionar-empresa')
            setCalculandoId(null)
            return
          }
          if (err?.response?.status === 403) {
            notifications.show({ title: 'Acesso negado', message: 'Apenas administradores podem acessar esta funcionalidade', color: 'red' })
            setCalculandoId(null)
            return
          }
          notifications.show({
            title: 'Erro',
            message: err?.response?.data?.message || 'Falha ao calcular orçamento',
            color: 'red',
          })
          setCalculandoId(null)
        },
      })
    }
  }

  function handleConverter(id: string) {
    if (confirm('Converter este orçamento em Pedido de Venda? O pedido será criado com status CONFIRMADO.')) {
      setConvertendoId(id)
      converter.mutate(id, {
        onSuccess: (data) => {
          notifications.show({ title: 'Sucesso', message: data.message, color: 'green' })
          setConvertendoId(null)
        },
        onError: (err: any) => {
          notifications.show({
            title: 'Erro',
            message: err?.response?.data?.message || 'Falha ao converter em pedido',
            color: 'red',
          })
          setConvertendoId(null)
        },
      })
    }
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Portal Representante / Solicitações de Orçamento</Text>
      <Text size="xl" fw={600} mb="lg">Solicitações de Orçamento</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />

        {/* Filters row */}
        <Group justify="space-between" mb="md" wrap="wrap">
          <Group wrap="wrap">
            <Select
              placeholder="Status"
              data={STATUS_OPTIONS}
              value={statusFilter}
              onChange={setStatusFilter}
              clearable
              style={{ minWidth: 140 }}
            />
            <TextInput
              placeholder="Vendedor/Representante"
              value={vendedorFilter}
              onChange={(e) => setVendedorFilter(e.currentTarget.value)}
              style={{ minWidth: 180 }}
            />
            <TextInput
              placeholder="Nome do cliente"
              leftSection={<IconSearch size={16} />}
              value={clienteNome}
              onChange={(e) => setClienteNome(e.currentTarget.value)}
              style={{ minWidth: 180 }}
            />
            <DateInput
              placeholder="Data início"
              value={dataInicio}
              onChange={setDataInicio}
              valueFormat="DD/MM/YYYY"
              clearable
              style={{ minWidth: 140 }}
            />
            <DateInput
              placeholder="Data fim"
              value={dataFim}
              onChange={setDataFim}
              valueFormat="DD/MM/YYYY"
              clearable
              style={{ minWidth: 140 }}
            />
          </Group>
          <Group>
            <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
          </Group>
        </Group>

        {/* Table */}
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Representante</Table.Th>
              <Table.Th>Cliente</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Data de Criação</Table.Th>
              <Table.Th style={{ width: 100 }}>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item) => (
              <Table.Tr key={item.id}>
                <Table.Td>{item.representante?.vendedor?.nome || item.representanteNome || '—'}</Table.Td>
                <Table.Td>{item.clienteNome || '—'}</Table.Td>
                <Table.Td>
                  <Badge color={statusSolicitacaoColors[item.status] || 'gray'}>
                    {item.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {new Date(item.criadoEm).toLocaleDateString('pt-BR')}
                </Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    {item.status === 'PENDENTE' && (
                      <Tooltip label="Calcular orçamento">
                        <ActionIcon
                          variant="subtle"
                          color="blue"
                          onClick={() => handleCalcular(item.id)}
                          disabled={calcular.isPending && calculandoId === item.id}
                          loading={calcular.isPending && calculandoId === item.id}
                        >
                          <IconCalculator size={18} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                    {item.status === 'CALCULADO' && (
                      <Tooltip label="Converter em Pedido de Venda">
                        <ActionIcon
                          variant="subtle"
                          color="green"
                          onClick={() => handleConverter(item.id)}
                          disabled={converter.isPending && convertendoId === item.id}
                          loading={converter.isPending && convertendoId === item.id}
                        >
                          <IconReceipt size={18} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && items.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={5} className="text-center py-8 text-zinc-500">
                  Nenhuma solicitação encontrada
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
    </div>
  )
}
