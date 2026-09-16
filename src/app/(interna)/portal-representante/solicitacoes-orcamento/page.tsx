'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Card, Group, Text, Table, Badge, Button, ActionIcon, Tooltip,
  LoadingOverlay, Select, Pagination, TextInput, Modal, Stack,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { useDebouncedValue, useDisclosure } from '@mantine/hooks'
import { IconRefresh, IconSearch, IconSend, IconX, IconExternalLink } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { usePerfilGuard } from '@/hooks/usePerfilGuard'
import {
  useSolicitacoesOrcamento,
  useEnviarParaOrcamento,
  useRecusarSolicitacao,
  useTiposEmbalagem,
} from '@/data/hooks/portal-representante/useSolicitacoesOrcamento'
import type { StatusSolicitacao, SolicitacoesFilters } from '@/data/hooks/portal-representante/types'
import { statusSolicitacaoColors, statusSolicitacaoLabels } from '@/data/hooks/portal-representante/types'

const STATUS_OPTIONS = [
  { value: 'PENDENTE', label: 'Pendente' },
  { value: 'EM_ORCAMENTO', label: 'Em orçamento' },
  { value: 'PRECIFICADA', label: 'Precificada' },
  { value: 'CONVERTIDA', label: 'Convertida' },
  { value: 'RECUSADA', label: 'Recusada' },
  { value: 'CANCELADA', label: 'Cancelada' },
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
  const enviarOrcamento = useEnviarParaOrcamento()
  const recusar = useRecusarSolicitacao()
  const { data: tiposEmbalagem = [] } = useTiposEmbalagem()

  // Modal de seleção de Tipo de Embalagem (fallback quando o texto não casa)
  const [tipoModalAberto, tipoModal] = useDisclosure(false)
  const [solicitacaoParaTipo, setSolicitacaoParaTipo] = useState<string | null>(null)
  const [tipoSelecionado, setTipoSelecionado] = useState<string | null>(null)

  function enviarComTipo(id: string, tipoEmbalagemId?: string) {
    enviarOrcamento.mutate(
      { id, tipoEmbalagemId },
      {
        onSuccess: (data) => {
          notifications.show({ title: 'Orçamento gerado', message: data.message, color: 'green' })
          tipoModal.close()
          setSolicitacaoParaTipo(null)
          setTipoSelecionado(null)
          refetch()
        },
        onError: (err: any) => {
          if (err?.response?.data?.code === 'TIPO_EMBALAGEM_NAO_RESOLVIDO') {
            // Abrir modal para o Comercial escolher o tipo de embalagem
            setSolicitacaoParaTipo(id)
            tipoModal.open()
            return
          }
          notifications.show({
            title: 'Erro',
            message: err?.response?.data?.message || 'Falha ao enviar para orçamento',
            color: 'red',
          })
        },
      },
    )
  }

  function handleEnviarOrcamento(id: string) {
    if (confirm('Enviar esta solicitação para orçamento? Um Orçamento Gráfico será criado.')) {
      enviarComTipo(id)
    }
  }

  function handleRecusar(id: string) {
    const motivo = prompt('Informe o motivo da recusa:')
    if (motivo && motivo.trim()) {
      recusar.mutate(
        { id, motivoRecusa: motivo.trim() },
        {
          onSuccess: () => {
            notifications.show({ title: 'Recusada', message: 'Solicitação recusada', color: 'orange' })
            refetch()
          },
          onError: (err: any) => {
            notifications.show({
              title: 'Erro',
              message: err?.response?.data?.message || 'Falha ao recusar',
              color: 'red',
            })
          },
        },
      )
    }
  }

  const items = response?.solicitacoes || []
  const total = response?.total || 0
  const totalPages = Math.ceil(total / pageSize)

  function abrirOrcamentoGrafico(orcamentoGraficoId: string) {
    router.push(`/orcamento-grafico?id=${orcamentoGraficoId}`)
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
                <Table.Td>{item.clienteNomeExibicao || item.clienteNome || '—'}</Table.Td>
                <Table.Td>
                  <Badge color={statusSolicitacaoColors[item.status] || 'gray'}>
                    {statusSolicitacaoLabels[item.status] || item.status}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {new Date(item.criadoEm).toLocaleDateString('pt-BR')}
                </Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    {item.status === 'PENDENTE' && (
                      <Tooltip label="Enviar para orçamento">
                        <ActionIcon
                          variant="subtle"
                          color="indigo"
                          onClick={() => handleEnviarOrcamento(item.id)}
                          loading={enviarOrcamento.isPending && solicitacaoParaTipo === item.id}
                        >
                          <IconSend size={18} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                    {(item.status === 'EM_ORCAMENTO' || item.status === 'PRECIFICADA') && item.orcamentoGraficoId && (
                      <Tooltip label="Abrir Orçamento Gráfico">
                        <ActionIcon variant="subtle" color="blue" onClick={() => abrirOrcamentoGrafico(item.orcamentoGraficoId!)}>
                          <IconExternalLink size={18} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                    {['EM_ORCAMENTO', 'PRECIFICADA'].includes(item.status) && (
                      <Tooltip label="Recusar">
                        <ActionIcon variant="subtle" color="red" onClick={() => handleRecusar(item.id)}>
                          <IconX size={18} />
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

      <Modal
        opened={tipoModalAberto}
        onClose={() => { tipoModal.close(); setSolicitacaoParaTipo(null); setTipoSelecionado(null) }}
        title="Selecione o Tipo de Embalagem"
      >
        <Stack>
          <Text size="sm" c="dimmed">
            Não foi possível identificar automaticamente o tipo de embalagem desta
            solicitação. Escolha um Tipo de Embalagem cadastrado para gerar o Orçamento Gráfico.
          </Text>
          <Select
            label="Tipo de Embalagem"
            placeholder="Selecione"
            data={tiposEmbalagem.map((t) => ({ value: t.id, label: `${t.codigo} - ${t.descricao}` }))}
            value={tipoSelecionado}
            onChange={setTipoSelecionado}
            searchable
          />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => { tipoModal.close(); setSolicitacaoParaTipo(null); setTipoSelecionado(null) }}>
              Cancelar
            </Button>
            <Button
              disabled={!tipoSelecionado || !solicitacaoParaTipo}
              loading={enviarOrcamento.isPending}
              onClick={() => solicitacaoParaTipo && tipoSelecionado && enviarComTipo(solicitacaoParaTipo, tipoSelecionado)}
            >
              Gerar Orçamento
            </Button>
          </Group>
        </Stack>
      </Modal>
    </div>
  )
}
