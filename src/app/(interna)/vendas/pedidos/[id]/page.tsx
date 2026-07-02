'use client'

import { useState } from 'react'
import {
  Button, Card, Group, Text, Table, Badge, LoadingOverlay, Modal, Textarea,
} from '@mantine/core'
import { IconArrowLeft, IconCheck, IconX, IconFileInvoice } from '@tabler/icons-react'
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
      <Group mb="lg">
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => router.push('/vendas/pedidos')}>Voltar</Button>
        <Text size="xl" fw={600}>Pedido de Venda #{pedido.numero}</Text>
        <Badge color={statusColors[pedido.status] || 'gray'} size="lg">{pedido.status}</Badge>
      </Group>

      {/* Card: Dados do Pedido */}
      <Card mb="md">
        <Text fw={500} mb="sm">Dados do Pedido</Text>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div><Text size="sm" c="dimmed">Cliente</Text><Text fw={500}>{pedido.cliente?.nomeFantasia || pedido.cliente?.razaoSocial}</Text></div>
          <div><Text size="sm" c="dimmed">Vendedor</Text><Text>{pedido.vendedor?.nome || '—'}</Text></div>
          <div><Text size="sm" c="dimmed">Tabela de Preço</Text><Text>{pedido.tabelaPreco?.nome || '—'}</Text></div>
          <div><Text size="sm" c="dimmed">Valor Total</Text><Text fw={600} size="lg">{formatCurrency(pedido.valorTotal)}</Text></div>
          <div><Text size="sm" c="dimmed">Prioridade</Text><BadgePrioridade prioridade={pedido.prioridade} /></div>
          <div><Text size="sm" c="dimmed">Origem</Text><Badge variant="light" size="sm">{pedido.origemPedido}</Badge></div>
          {pedido.numeroPedidoCliente && (
            <div><Text size="sm" c="dimmed">Nº Pedido Cliente</Text><Text>{pedido.numeroPedidoCliente}</Text></div>
          )}
          {pedido.dataValidade && (
            <div><Text size="sm" c="dimmed">Data Validade</Text><Text>{formatDate(pedido.dataValidade)}</Text></div>
          )}
        </div>
        {pedido.prioridade === 'URGENTE' && pedido.dataLimiteAtendimento && (
          <div className="mt-4">
            <Badge color="red" variant="filled" size="lg">
              Limite de Atendimento (SLA): {formatDate(pedido.dataLimiteAtendimento)}
            </Badge>
          </div>
        )}
      </Card>

      {/* Card: Entrega e Transporte */}
      <Card mb="md">
        <Text fw={500} mb="sm">Entrega e Transporte</Text>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div><Text size="sm" c="dimmed">Data de Entrega</Text><Text>{formatDate(pedido.dataEntrega)}</Text></div>
          <div><Text size="sm" c="dimmed">Transportadora</Text><Text>{pedido.transportadora?.razaoSocial || '—'}</Text></div>
          <div><Text size="sm" c="dimmed">Modalidade de Frete</Text><Text>{getModalidadeFreteLabel(pedido.modalidadeFrete)}</Text></div>
          {pedido.enderecoEntrega && (
            <div className="md:col-span-4">
              <Text size="sm" c="dimmed">Endereço de Entrega</Text>
              <Text>{formatarEnderecoEntrega(pedido.enderecoEntrega)}</Text>
            </div>
          )}
        </div>
      </Card>

      {/* Card: Financeiro */}
      <Card mb="md">
        <Text fw={500} mb="sm">Financeiro</Text>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div><Text size="sm" c="dimmed">Tipo Desconto</Text><Text>{pedido.tipoDesconto || '—'}</Text></div>
          <div><Text size="sm" c="dimmed">Desconto Geral</Text><Text>{pedido.descontoGeral != null ? (pedido.tipoDesconto === 'PERCENTUAL' ? `${pedido.descontoGeral}%` : formatCurrency(pedido.descontoGeral)) : '—'}</Text></div>
          <div><Text size="sm" c="dimmed">Tipo Acréscimo</Text><Text>{pedido.tipoAcrescimo || '—'}</Text></div>
          <div><Text size="sm" c="dimmed">Acréscimo Geral</Text><Text>{pedido.acrescimoGeral != null ? formatCurrency(pedido.acrescimoGeral) : '—'}</Text></div>
        </div>
      </Card>

      {/* Card: Itens */}
      <Card mb="md">
        <Text fw={500} mb="sm">Itens ({pedido.itens?.length || 0})</Text>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Produto</Table.Th>
              <Table.Th>Unidade</Table.Th>
              <Table.Th>Quantidade</Table.Th>
              <Table.Th>Preço Unit.</Table.Th>
              <Table.Th>Preço Final</Table.Th>
              <Table.Th>Desc Valor</Table.Th>
              <Table.Th>Frete</Table.Th>
              <Table.Th>Seguro</Table.Th>
              <Table.Th>Outras Desp.</Table.Th>
              <Table.Th>Qtd Faturada</Table.Th>
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
                <Table.Td fw={500}>{formatCurrency(item.valorTotal)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        <Group justify="flex-end" mt="md">
          <Text size="lg" fw={600}>Total: {formatCurrency(pedido.valorTotal)}</Text>
        </Group>
      </Card>

      {/* Card: Observações (somente se presente) */}
      {(pedido.observacao || pedido.observacaoNota) && (
        <Card mb="md">
          <Text fw={500} mb="sm">Observações</Text>
          {pedido.observacao && (
            <div className="mb-2">
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
        </Card>
      )}

      {/* Card: Histórico de Faturamentos (somente se há vendas efetivadas) */}
      {pedido.vendasEfetivadas && pedido.vendasEfetivadas.length > 0 && (
        <Card mb="md">
          <Text fw={500} mb="sm">Histórico de Faturamentos</Text>
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
        </Card>
      )}

      {/* Motivo cancelamento */}
      {pedido.motivoCancelamento && (
        <Card mb="md"><Text fw={500} mb="sm">Motivo do Cancelamento</Text><Text>{pedido.motivoCancelamento}</Text></Card>
      )}

      {/* Actions */}
      <Group justify="flex-end">
        {pedido.status === 'RASCUNHO' && (
          <>
            <Button variant="light" onClick={() => router.push(`/vendas/pedidos/novo?editId=${id}`)}>Editar Itens</Button>
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
        {pedido.status === 'EM_SEPARACAO' && (
          <Badge color="orange" size="lg">Aguardando separação no WMS</Badge>
        )}
        {['RASCUNHO', 'CONFIRMADO'].includes(pedido.status) && (
          <Button color="red" variant="light" leftSection={<IconX size={16} />} onClick={() => setCancelModal(true)}>Cancelar Pedido</Button>
        )}
      </Group>

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
