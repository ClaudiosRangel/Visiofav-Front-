'use client'

import { useState } from 'react'
import {
  Button, Card, Group, Text, Table, Badge, LoadingOverlay, Modal, Textarea,
  SimpleGrid, Paper, Tabs, Divider,
} from '@mantine/core'
import { IconArrowLeft, IconCheck, IconX, IconFileInvoice, IconPackage, IconTruck, IconCash, IconNotes, IconHistory } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQueryClient } from '@tanstack/react-query'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useRouter, useParams } from 'next/navigation'
import { usePedidoVenda, useConfirmarPedido, useCancelarPedido } from '@/data/hooks/vendas/usePedidoVenda'
import { BadgePrioridade } from '@/components/vendas/BadgePrioridade'
import { formatarEnderecoEntrega, getProgressColor, MODALIDADE_FRETE_OPTIONS } from '@/components/vendas/utils'
import { ModalFaturamentoParcial } from '@/components/vendas/ModalFaturamentoParcial'
import { api } from '@/lib/api'
import { useMutation } from '@tanstack/react-query'

const statusColors: Record<string, string> = {
  RASCUNHO: 'gray', CONFIRMADO: 'blue', EM_SEPARACAO: 'orange', EFETIVADO: 'teal', FATURADO: 'green', CANCELADO: 'red',
}

function formatCurrency(value: number | undefined | null): string {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function formatDate(dateStr: string | undefined | null): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('pt-BR')
}

function getModalidadeFreteLabel(modalidade: number | undefined | null): string {
  if (modalidade === undefined || modalidade === null) return '—'
  const option = MODALIDADE_FRETE_OPTIONS.find(o => o.value === String(modalidade))
  return option?.label || String(modalidade)
}

export default function DetalhePedidoVendaPage() {
  useModuloGuard('VENDAS')
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const queryClient = useQueryClient()
  const [cancelModal, setCancelModal] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [faturarModalOpen, setFaturarModalOpen] = useState(false)

  const { data: pedido, isLoading } = usePedidoVenda(id)

  const confirmar = useConfirmarPedido()
  const cancelarMutation = useCancelarPedido()

  const efetivar = useMutation({
    mutationFn: async () => {
      const { data: vendaResp } = await api.post('/vendas/efetivar', {
        pedidoVendaId: id,
        condicaoPagamento: { formaPagamento: 'BOLETO', parcelas: 1 },
      })
      return vendaResp
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pedidos-venda', id] })
      notifications.show({ title: '✅ Venda efetivada', message: 'Pedido enviado para separação no WMS. Contas a receber geradas.', color: 'green' })
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao efetivar', color: 'red' }) },
  })

  const handleConfirmar = () => {
    if (confirm('Confirmar pedido?')) {
      confirmar.mutate(id, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ['pedidos-venda', id] })
          notifications.show({ title: 'Sucesso', message: 'Pedido confirmado', color: 'green' })
        },
        onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) },
      })
    }
  }

  const handleCancelar = () => {
    cancelarMutation.mutate({ id, motivo }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ['pedidos-venda', id] })
        setCancelModal(false)
        setMotivo('')
        notifications.show({ title: 'Sucesso', message: 'Pedido cancelado', color: 'green' })
      },
      onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) },
    })
  }

  if (isLoading) return <Card pos="relative" mih={200}><LoadingOverlay visible /></Card>
  if (!pedido) return <div><Text>Pedido não encontrado</Text><Button mt="md" onClick={() => router.push('/vendas/pedidos')}>Voltar</Button></div>

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Vendas / Pedidos / #{pedido.numero}</Text>

      {/* ═══ HEADER (estilo ERP) ═══ */}
      <Group justify="space-between" mb="md">
        <Group>
          <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => router.push('/vendas/pedidos')}>Voltar</Button>
          <Text size="xl" fw={600}>Pedido #{pedido.numero}</Text>
          <Badge color={statusColors[pedido.status] || 'gray'} size="lg">{pedido.status}</Badge>
          <BadgePrioridade prioridade={pedido.prioridade} />
        </Group>

        {/* Actions no header (estilo Sankhya) */}
        <Group>
          {pedido.status === 'RASCUNHO' && (
            <>
              <Button variant="light" onClick={() => router.push(`/vendas/pedidos/novo?editId=${id}`)}>Editar</Button>
              <Button color="blue" leftSection={<IconCheck size={16} />} onClick={handleConfirmar}>Confirmar</Button>
            </>
          )}
          {pedido.status === 'CONFIRMADO' && (
            <>
              <Button color="orange" variant="light" leftSection={<IconFileInvoice size={16} />} onClick={() => setFaturarModalOpen(true)}>
                Faturar Parcial
              </Button>
              <Button color="green" leftSection={<IconCheck size={16} />} onClick={() => { if (confirm('Efetivar venda? Isso irá gerar contas a receber e enviar para separação no WMS.')) efetivar.mutate() }} loading={efetivar.isPending}>
                Efetivar Venda
              </Button>
            </>
          )}
          {['RASCUNHO', 'CONFIRMADO'].includes(pedido.status) && (
            <Button color="red" variant="light" leftSection={<IconX size={16} />} onClick={() => setCancelModal(true)}>Cancelar</Button>
          )}
        </Group>
      </Group>

      {/* ═══ CABEÇALHO COMPACTO — Dados-chave sempre visíveis ═══ */}
      <Card withBorder mb="md" p="md">
        <SimpleGrid cols={{ base: 2, sm: 4, lg: 6 }}>
          <div>
            <Text size="xs" c="dimmed">Cliente</Text>
            <Text fw={500} size="sm">{pedido.cliente?.nomeFantasia || pedido.cliente?.razaoSocial}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">Vendedor</Text>
            <Text size="sm">{pedido.vendedor?.nome || '—'}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">Tabela de Preço</Text>
            <Text size="sm">{pedido.tabelaPreco?.nome || '—'}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">Origem</Text>
            <Badge variant="light" size="sm">{pedido.origemPedido}</Badge>
          </div>
          {pedido.numeroPedidoCliente && (
            <div>
              <Text size="xs" c="dimmed">Nº Pedido Cliente</Text>
              <Text size="sm">{pedido.numeroPedidoCliente}</Text>
            </div>
          )}
          {pedido.dataValidade && (
            <div>
              <Text size="xs" c="dimmed">Data Validade</Text>
              <Text size="sm">{formatDate(pedido.dataValidade)}</Text>
            </div>
          )}
        </SimpleGrid>
        {pedido.prioridade === 'URGENTE' && pedido.dataLimiteAtendimento && (
          <div style={{ marginTop: 12 }}>
            <Badge color="red" variant="filled" size="lg">
              SLA: {formatDate(pedido.dataLimiteAtendimento)}
            </Badge>
          </div>
        )}
      </Card>

      {/* ═══ CORPO — Tabs (Itens | Entrega | Financeiro | Observações | Histórico) ═══ */}
      <Card withBorder mb="md" p={0}>
        <Tabs defaultValue="itens">
          <Tabs.List>
            <Tabs.Tab value="itens" leftSection={<IconPackage size={16} />}>
              Itens ({pedido.itens?.length || 0})
            </Tabs.Tab>
            <Tabs.Tab value="entrega" leftSection={<IconTruck size={16} />}>
              Entrega / Transporte
            </Tabs.Tab>
            <Tabs.Tab value="financeiro" leftSection={<IconCash size={16} />}>
              Financeiro
            </Tabs.Tab>
            {(pedido.observacao || pedido.observacaoNota) && (
              <Tabs.Tab value="observacoes" leftSection={<IconNotes size={16} />}>
                Observações
              </Tabs.Tab>
            )}
            {pedido.vendasEfetivadas && pedido.vendasEfetivadas.length > 0 && (
              <Tabs.Tab value="historico" leftSection={<IconHistory size={16} />}>
                Faturamentos ({pedido.vendasEfetivadas.length})
              </Tabs.Tab>
            )}
          </Tabs.List>

          <div style={{ padding: '16px' }}>
            {/* Tab: Itens */}
            <Tabs.Panel value="itens">
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Produto</Table.Th>
                    <Table.Th>Unidade</Table.Th>
                    <Table.Th>Qtd</Table.Th>
                    <Table.Th>Preço Unit.</Table.Th>
                    <Table.Th>Preço Final</Table.Th>
                    <Table.Th>Desc Valor</Table.Th>
                    <Table.Th>Frete</Table.Th>
                    <Table.Th>Seguro</Table.Th>
                    <Table.Th>Outras Desp.</Table.Th>
                    <Table.Th>Faturado</Table.Th>
                    <Table.Th>Total</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {(pedido.itens || []).map((item) => (
                    <Table.Tr key={item.id}>
                      <Table.Td fw={500}>{item.produto?.nome || item.produtoId}</Table.Td>
                      <Table.Td>{item.unidade || item.produto?.unidade || '—'}</Table.Td>
                      <Table.Td>{Number(item.quantidade)}</Table.Td>
                      <Table.Td>{formatCurrency(item.precoUnitario)}</Table.Td>
                      <Table.Td>{formatCurrency(item.precoFinal)}</Table.Td>
                      <Table.Td>{formatCurrency(item.descontoValor)}</Table.Td>
                      <Table.Td>{formatCurrency(item.frete)}</Table.Td>
                      <Table.Td>{formatCurrency(item.seguro)}</Table.Td>
                      <Table.Td>{formatCurrency(item.outrasDespesas)}</Table.Td>
                      <Table.Td>
                        <Badge color={getProgressColor(item.quantidadeFaturada, item.quantidade)} size="sm">
                          {item.quantidadeFaturada}/{item.quantidade}
                        </Badge>
                      </Table.Td>
                      <Table.Td fw={600}>{formatCurrency(item.valorTotal)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Tabs.Panel>

            {/* Tab: Entrega e Transporte */}
            <Tabs.Panel value="entrega">
              <SimpleGrid cols={{ base: 1, sm: 3 }}>
                <div><Text size="sm" c="dimmed">Data de Entrega</Text><Text>{formatDate(pedido.dataEntrega)}</Text></div>
                <div><Text size="sm" c="dimmed">Transportadora</Text><Text>{pedido.transportadora?.razaoSocial || '—'}</Text></div>
                <div><Text size="sm" c="dimmed">Modalidade de Frete</Text><Text>{getModalidadeFreteLabel(pedido.modalidadeFrete)}</Text></div>
              </SimpleGrid>
              {pedido.enderecoEntrega && (
                <div style={{ marginTop: 16 }}>
                  <Text size="sm" c="dimmed">Endereço de Entrega Alternativo</Text>
                  <Text>{formatarEnderecoEntrega(pedido.enderecoEntrega)}</Text>
                </div>
              )}
            </Tabs.Panel>

            {/* Tab: Financeiro */}
            <Tabs.Panel value="financeiro">
              <SimpleGrid cols={{ base: 2, sm: 4 }}>
                <div><Text size="sm" c="dimmed">Tipo Desconto</Text><Text>{pedido.tipoDesconto || '—'}</Text></div>
                <div><Text size="sm" c="dimmed">Desconto Geral</Text><Text>{pedido.descontoGeral != null ? (pedido.tipoDesconto === 'PERCENTUAL' ? `${pedido.descontoGeral}%` : formatCurrency(pedido.descontoGeral)) : '—'}</Text></div>
                <div><Text size="sm" c="dimmed">Tipo Acréscimo</Text><Text>{pedido.tipoAcrescimo || '—'}</Text></div>
                <div><Text size="sm" c="dimmed">Acréscimo Geral</Text><Text>{pedido.acrescimoGeral != null ? formatCurrency(pedido.acrescimoGeral) : '—'}</Text></div>
              </SimpleGrid>
            </Tabs.Panel>

            {/* Tab: Observações */}
            {(pedido.observacao || pedido.observacaoNota) && (
              <Tabs.Panel value="observacoes">
                {pedido.observacao && (
                  <div style={{ marginBottom: 12 }}>
                    <Text size="sm" c="dimmed">Observação Interna</Text>
                    <Text>{pedido.observacao}</Text>
                  </div>
                )}
                {pedido.observacaoNota && (
                  <div>
                    <Text size="sm" c="dimmed">Observação para Nota Fiscal</Text>
                    <Text>{pedido.observacaoNota}</Text>
                  </div>
                )}
              </Tabs.Panel>
            )}

            {/* Tab: Histórico de Faturamentos */}
            {pedido.vendasEfetivadas && pedido.vendasEfetivadas.length > 0 && (
              <Tabs.Panel value="historico">
                <Table striped>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Data Efetivação</Table.Th>
                      <Table.Th>Valor Total</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {pedido.vendasEfetivadas.map((venda) => (
                      <Table.Tr key={venda.id}>
                        <Table.Td>{formatDate(venda.dataEfetivacao)}</Table.Td>
                        <Table.Td>{formatCurrency(venda.valorTotal)}</Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </Tabs.Panel>
            )}
          </div>
        </Tabs>
      </Card>

      {/* ═══ RODAPÉ TOTALIZADOR — Sempre visível (estilo Sankhya/TOTVS) ═══ */}
      <Paper withBorder p="md" radius="md">
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          <div>
            <Text size="xs" c="dimmed">Itens</Text>
            <Text fw={600}>{pedido.itens?.length || 0}</Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">Desconto</Text>
            <Text fw={600} c="red">
              {pedido.descontoGeral && Number(pedido.descontoGeral) > 0
                ? (pedido.tipoDesconto === 'PERCENTUAL' ? `${pedido.descontoGeral}%` : formatCurrency(pedido.descontoGeral))
                : '—'}
            </Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">Acréscimo</Text>
            <Text fw={600} c="teal">
              {pedido.acrescimoGeral && Number(pedido.acrescimoGeral) > 0
                ? formatCurrency(pedido.acrescimoGeral)
                : '—'}
            </Text>
          </div>
          <div>
            <Text size="xs" c="dimmed">Total do Pedido</Text>
            <Text fw={700} size="xl" c="blue">
              {formatCurrency(pedido.valorTotal)}
            </Text>
          </div>
        </SimpleGrid>
      </Paper>

      {/* Motivo cancelamento */}
      {pedido.motivoCancelamento && (
        <Card withBorder mt="md"><Text fw={500} mb="sm">Motivo do Cancelamento</Text><Text>{pedido.motivoCancelamento}</Text></Card>
      )}

      {pedido.status === 'EM_SEPARACAO' && (
        <Group justify="center" mt="md">
          <Badge color="orange" size="lg">Aguardando separação no WMS</Badge>
        </Group>
      )}

      {/* Modal Cancelar */}
      <Modal opened={cancelModal} onClose={() => { setCancelModal(false); setMotivo('') }} title="Cancelar Pedido" centered>
        <Textarea label="Motivo" description="Mínimo 10 caracteres" placeholder="Informe o motivo..." minRows={3} value={motivo} onChange={(e) => setMotivo(e.currentTarget.value)} error={motivo.length > 0 && motivo.length < 10 ? 'Mínimo 10 caracteres' : undefined} />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => { setCancelModal(false); setMotivo('') }}>Voltar</Button>
          <Button color="red" onClick={handleCancelar} loading={cancelarMutation.isPending} disabled={motivo.length < 10}>Confirmar Cancelamento</Button>
        </Group>
      </Modal>

      {/* Modal Faturamento Parcial */}
      {faturarModalOpen && (
        <ModalFaturamentoParcial
          opened={faturarModalOpen}
          onClose={() => setFaturarModalOpen(false)}
          itens={pedido.itens}
          pedidoId={id}
        />
      )}
    </div>
  )
}
