'use client'

import { useState, useEffect } from 'react'
import {
  Button, Card, Group, Text, Table, Badge, ActionIcon, Tooltip,
  LoadingOverlay, Select, Pagination, Modal, Textarea,
} from '@mantine/core'
import { IconPlus, IconRefresh, IconEye, IconSend, IconCheck, IconX, IconTransform } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useRouter } from 'next/navigation'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import {
  useOrcamentos, useEnviarOrcamento, useAprovarOrcamento,
  useReprovarOrcamento, useConverterOrcamento,
} from '@/data/hooks/vendas/useOrcamento'

const statusColors: Record<string, string> = {
  ABERTO: 'gray',
  ENVIADO: 'blue',
  APROVADO: 'green',
  REPROVADO: 'red',
  CONVERTIDO: 'teal',
  EXPIRADO: 'orange',
}

const STATUS_OPTIONS = [
  { value: 'ABERTO', label: 'Aberto' },
  { value: 'ENVIADO', label: 'Enviado' },
  { value: 'APROVADO', label: 'Aprovado' },
  { value: 'REPROVADO', label: 'Reprovado' },
  { value: 'CONVERTIDO', label: 'Convertido' },
  { value: 'EXPIRADO', label: 'Expirado' },
]

export default function OrcamentosPage() {
  useModuloGuard('VENDAS')
  useEffect(() => { document.title = 'Vizor - Vendas - Orçamentos' }, [])

  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [reprovarModal, setReprovarModal] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')

  useEffect(() => { setPage(1) }, [statusFilter])

  const { data: response, isLoading, refetch } = useOrcamentos({
    status: statusFilter || undefined,
    page,
    limit: 20,
  })

  const enviar = useEnviarOrcamento()
  const aprovar = useAprovarOrcamento()
  const reprovar = useReprovarOrcamento()
  const converter = useConverterOrcamento()

  const items = response?.data || []
  const total = response?.total || 0
  const totalPages = Math.ceil(total / 20)

  function formatCurrency(v: number) {
    return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('pt-BR')
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Vendas / Orçamentos</Text>
      <Text size="xl" fw={600} mb="lg">Orçamentos / Propostas</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />

        <Group justify="space-between" mb="md" wrap="wrap">
          <Group>
            <Select
              placeholder="Status"
              data={STATUS_OPTIONS}
              value={statusFilter}
              onChange={setStatusFilter}
              clearable
              style={{ minWidth: 150 }}
            />
          </Group>
          <Group>
            <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
            <Button leftSection={<IconPlus size={16} />} onClick={() => router.push('/vendas/orcamentos/novo')}>Novo Orçamento</Button>
          </Group>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Número</Table.Th>
              <Table.Th>Cliente</Table.Th>
              <Table.Th>Vendedor</Table.Th>
              <Table.Th>Valor Total</Table.Th>
              <Table.Th>Validade</Table.Th>
              <Table.Th>Itens</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th style={{ width: 160 }}>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((orc: any) => (
              <Table.Tr key={orc.id}>
                <Table.Td fw={500}>{orc.numero}</Table.Td>
                <Table.Td>{orc.cliente?.nomeFantasia || orc.cliente?.razaoSocial || '—'}</Table.Td>
                <Table.Td>{orc.vendedor?.nome || '—'}</Table.Td>
                <Table.Td>{formatCurrency(orc.valorTotal)}</Table.Td>
                <Table.Td>{formatDate(orc.validadeAte)}</Table.Td>
                <Table.Td>{orc._count?.itens || 0}</Table.Td>
                <Table.Td>
                  <Badge color={statusColors[orc.status] || 'gray'}>{orc.status}</Badge>
                </Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <Tooltip label="Ver detalhes">
                      <ActionIcon variant="subtle" color="gray" onClick={() => router.push(`/vendas/orcamentos/${orc.id}`)}>
                        <IconEye size={18} />
                      </ActionIcon>
                    </Tooltip>
                    {orc.status === 'ABERTO' && (
                      <Tooltip label="Enviar ao cliente">
                        <ActionIcon variant="subtle" color="blue" onClick={() => {
                          enviar.mutate(orc.id, {
                            onSuccess: () => notifications.show({ title: 'Sucesso', message: 'Orçamento marcado como enviado', color: 'green' }),
                          })
                        }}>
                          <IconSend size={18} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                    {['ABERTO', 'ENVIADO'].includes(orc.status) && (
                      <>
                        <Tooltip label="Aprovar">
                          <ActionIcon variant="subtle" color="green" onClick={() => {
                            aprovar.mutate(orc.id, {
                              onSuccess: () => notifications.show({ title: 'Sucesso', message: 'Orçamento aprovado', color: 'green' }),
                            })
                          }}>
                            <IconCheck size={18} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Reprovar">
                          <ActionIcon variant="subtle" color="red" onClick={() => setReprovarModal(orc.id)}>
                            <IconX size={18} />
                          </ActionIcon>
                        </Tooltip>
                      </>
                    )}
                    {orc.status === 'APROVADO' && (
                      <Tooltip label="Converter em Pedido">
                        <ActionIcon variant="subtle" color="teal" onClick={() => {
                          if (confirm('Converter este orçamento em pedido de venda?')) {
                            converter.mutate(orc.id, {
                              onSuccess: () => notifications.show({ title: 'Sucesso', message: 'Pedido de venda gerado', color: 'green' }),
                              onError: (err: any) => notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }),
                            })
                          }
                        }}>
                          <IconTransform size={18} />
                        </ActionIcon>
                      </Tooltip>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && items.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--mantine-color-dimmed)' }}>
                  Nenhum orçamento encontrado
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

      {/* Modal Reprovar */}
      <Modal opened={!!reprovarModal} onClose={() => { setReprovarModal(null); setMotivo('') }} title="Reprovar Orçamento" centered>
        <Textarea label="Motivo" placeholder="Motivo da reprovação..." minRows={3} value={motivo} onChange={(e) => setMotivo(e.currentTarget.value)} error={motivo.length > 0 && motivo.length < 5 ? 'Mínimo 5 caracteres' : undefined} />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => { setReprovarModal(null); setMotivo('') }}>Cancelar</Button>
          <Button color="red" disabled={motivo.length < 5} loading={reprovar.isPending} onClick={() => {
            reprovar.mutate({ id: reprovarModal!, motivo }, {
              onSuccess: () => { setReprovarModal(null); setMotivo(''); notifications.show({ title: 'Sucesso', message: 'Orçamento reprovado', color: 'green' }) },
            })
          }}>Reprovar</Button>
        </Group>
      </Modal>
    </div>
  )
}
