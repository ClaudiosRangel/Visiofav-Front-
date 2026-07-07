'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Card, Group, Text, Table, Badge, Button, Tabs, LoadingOverlay,
  SimpleGrid, Alert, Divider,
} from '@mantine/core'
import {
  IconArrowLeft, IconFileText, IconCalendar, IconCash,
  IconCheck, IconAlertCircle, IconEdit,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import AgendamentoDocaModal from '@/components/wms/AgendamentoDocaModal'

const statusContaColors: Record<string, string> = {
  ABERTA: 'orange', PAGA: 'green', VENCIDA: 'red', CANCELADA: 'gray',
}

export default function CompraEfetivadaDetalhePage() {
  useModuloGuard('COMPRAS')
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [agendaModalOpen, setAgendaModalOpen] = useState(false)

  const { data: compra, isLoading } = useQuery<any>({
    queryKey: ['compra-detalhe', id],
    queryFn: async () => { const { data } = await api.get(`/compras/${id}`); return data },
    enabled: !!id,
  })

  if (isLoading) return <Card><LoadingOverlay visible /></Card>
  if (!compra) return <Card><Text c="dimmed" className="text-center py-8">Compra não encontrada</Text></Card>

  const pedido = compra.pedidoCompra
  const fornecedor = pedido?.fornecedor
  const contas = compra.contasPagar || []
  const agendamento = compra.agendamento
  const enderecada = compra.endereçada

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Compras / Compras Efetivadas / Detalhe</Text>
      <Group mb="lg">
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => router.push('/compras/compras-efetivadas')}>Voltar</Button>
        <Text size="xl" fw={600}>Compra Efetivada — Pedido #{pedido?.numero}</Text>
      </Group>

      {/* Resumo */}
      <SimpleGrid cols={{ base: 1, sm: 4 }} mb="md">
        <Card withBorder>
          <Text size="xs" c="dimmed">Fornecedor</Text>
          <Text fw={600}>{fornecedor?.nomeFantasia || fornecedor?.razaoSocial}</Text>
          <Text size="xs" c="dimmed" className="font-mono">{fornecedor?.cnpj}</Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed">Valor Total</Text>
          <Text fw={700} size="lg">{Number(compra.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed">Data Efetivação</Text>
          <Text fw={500}>{new Date(compra.dataEfetivacao).toLocaleDateString('pt-BR')}</Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed">Status Estoque</Text>
          <Badge color={enderecada ? 'green' : 'orange'} size="lg">{enderecada ? 'Endereçada' : 'Pendente'}</Badge>
        </Card>
      </SimpleGrid>

      <Card>
        <Tabs defaultValue="dados">
          <Tabs.List mb="md">
            <Tabs.Tab value="dados" leftSection={<IconFileText size={16} />}>Dados da Compra</Tabs.Tab>
            <Tabs.Tab value="agendamento" leftSection={<IconCalendar size={16} />}>
              Agendamento {agendamento ? <Badge size="xs" ml={4} color="green">1</Badge> : null}
            </Tabs.Tab>
            <Tabs.Tab value="financeiro" leftSection={<IconCash size={16} />}>
              Financeiro ({contas.length})
            </Tabs.Tab>
          </Tabs.List>

          {/* ABA DADOS */}
          <Tabs.Panel value="dados">
            <Text fw={600} mb="sm">Itens do Pedido</Text>
            <Table striped withTableBorder>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Código</Table.Th><Table.Th>Produto</Table.Th><Table.Th>Unidade</Table.Th><Table.Th>Qtd</Table.Th>
                  <Table.Th>Preço Unit.</Table.Th><Table.Th>Total</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {(pedido?.itens || []).map((item: any) => (
                  <Table.Tr key={item.id}>
                    <Table.Td className="font-mono">{item.produto?.codigo}</Table.Td>
                    <Table.Td fw={500}>{item.produto?.nome}</Table.Td>
                    <Table.Td>{item.unidade || item.produto?.unidade || '—'}</Table.Td>
                    <Table.Td>{Number(item.quantidade)}</Table.Td>
                    <Table.Td>{Number(item.precoUnitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
                    <Table.Td fw={500}>{Number(item.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            {compra.devolucoes?.length > 0 && (
              <>
                <Divider my="md" />
                <Text fw={600} mb="sm" c="red">Devoluções ({compra.devolucoes.length})</Text>
                {compra.devolucoes.map((dev: any) => (
                  <Card key={dev.id} withBorder mb="sm">
                    <Group justify="space-between" mb="xs">
                      <Text size="sm">Data: {new Date(dev.dataDevolucao).toLocaleDateString('pt-BR')}</Text>
                      <Text fw={600} c="red">{Number(dev.valorTotal).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Text>
                    </Group>
                    <Table striped>
                      <Table.Thead><Table.Tr><Table.Th>Produto</Table.Th><Table.Th>Qtd</Table.Th><Table.Th>Valor</Table.Th></Table.Tr></Table.Thead>
                      <Table.Tbody>
                        {dev.itens.map((item: any) => (
                          <Table.Tr key={item.id}>
                            <Table.Td>{item.produtoId}</Table.Td>
                            <Table.Td>{Number(item.quantidade)}</Table.Td>
                            <Table.Td>{Number(item.precoUnitario).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
                          </Table.Tr>
                        ))}
                      </Table.Tbody>
                    </Table>
                  </Card>
                ))}
              </>
            )}
          </Tabs.Panel>

          {/* ABA AGENDAMENTO */}
          <Tabs.Panel value="agendamento">
            {agendamento ? (
              <Card withBorder>
                <Group justify="space-between" mb="md">
                  <Text fw={600}>Agendamento de Recebimento</Text>
                  {!enderecada && (
                    <Button variant="light" leftSection={<IconEdit size={16} />} onClick={() => setAgendaModalOpen(true)}>
                      Alterar Agendamento
                    </Button>
                  )}
                </Group>
                <SimpleGrid cols={{ base: 1, sm: 3 }}>
                  <div>
                    <Text size="xs" c="dimmed">Data</Text>
                    <Text fw={500}>{agendamento.dataPrevista.slice(8, 10)}/{agendamento.dataPrevista.slice(5, 7)}/{agendamento.dataPrevista.slice(0, 4)}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Horário</Text>
                    <Text fw={500}>{agendamento.horaInicio || '—'} - {agendamento.horaFim || '—'}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Doca</Text>
                    <Text fw={500}>{agendamento.doca?.descricao || '—'}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Motorista</Text>
                    <Text fw={500}>{agendamento.motorista || '—'}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Placa</Text>
                    <Text fw={500} className="font-mono">{agendamento.placa || '—'}</Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">Status</Text>
                    <Badge color={agendamento.status === 'RECEBIDO' ? 'green' : agendamento.status === 'AGENDADO' ? 'blue' : 'orange'}>
                      {agendamento.status}
                    </Badge>
                  </div>
                </SimpleGrid>
                {enderecada && (
                  <Alert icon={<IconCheck size={16} />} color="green" variant="light" mt="md">
                    Mercadoria já endereçada no estoque. Agendamento não pode ser alterado.
                  </Alert>
                )}
              </Card>
            ) : (
              <Card withBorder>
                <Text c="dimmed" className="text-center py-4" mb="md">Nenhum agendamento vinculado a esta compra</Text>
                {!enderecada && (
                  <Group justify="center">
                    <Button leftSection={<IconCalendar size={16} />} onClick={() => setAgendaModalOpen(true)}>
                      Agendar Recebimento
                    </Button>
                  </Group>
                )}
              </Card>
            )}
          </Tabs.Panel>

          {/* ABA FINANCEIRO */}
          <Tabs.Panel value="financeiro">
            <Text fw={600} mb="sm">Contas a Pagar</Text>
            {contas.length > 0 ? (
              <Table striped withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Parcela</Table.Th><Table.Th>Descrição</Table.Th><Table.Th>Valor</Table.Th>
                    <Table.Th>Vencimento</Table.Th><Table.Th>Pagamento</Table.Th><Table.Th>Status</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {contas.map((conta: any) => (
                    <Table.Tr key={conta.id}>
                      <Table.Td fw={500}>{conta.parcela}/{conta.totalParcelas}</Table.Td>
                      <Table.Td>{conta.descricao}</Table.Td>
                      <Table.Td fw={600}>{Number(conta.valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</Table.Td>
                      <Table.Td>{new Date(conta.dataVencimento).toLocaleDateString('pt-BR')}</Table.Td>
                      <Table.Td>{conta.dataPagamento ? new Date(conta.dataPagamento).toLocaleDateString('pt-BR') : '—'}</Table.Td>
                      <Table.Td>
                        <Badge color={statusContaColors[conta.status] || 'gray'} variant="light">{conta.status}</Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <Text c="dimmed" className="text-center py-8">Nenhuma conta a pagar registrada</Text>
            )}

            {contas.length > 0 && (
              <Group justify="flex-end" mt="md">
                <Text fw={600}>
                  Total: {contas.reduce((s: number, c: any) => s + Number(c.valor), 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </Text>
              </Group>
            )}
          </Tabs.Panel>
        </Tabs>
      </Card>

      {/* Modal Agendamento */}
      <AgendamentoDocaModal
        opened={agendaModalOpen}
        onClose={() => setAgendaModalOpen(false)}
        onAgendado={() => {
          queryClient.invalidateQueries({ queryKey: ['compra-detalhe', id] })
          setAgendaModalOpen(false)
        }}
        pedidoCompraId={compra.pedidoCompraId}
        fornecedorId={pedido?.fornecedorId}
        agendamentoAtualId={agendamento?.id}
      />
    </div>
  )
}
