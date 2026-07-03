'use client'

import { useState } from 'react'
import {
  Button, Card, Group, Text, Table, Badge, LoadingOverlay,
  SimpleGrid, Paper, Modal, Textarea,
} from '@mantine/core'
import { IconArrowLeft, IconSend, IconCheck, IconX, IconTransform } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useRouter, useParams } from 'next/navigation'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import {
  useOrcamento, useEnviarOrcamento, useAprovarOrcamento,
  useReprovarOrcamento, useConverterOrcamento,
} from '@/data/hooks/vendas/useOrcamento'

const statusColors: Record<string, string> = {
  ABERTO: 'gray', ENVIADO: 'blue', APROVADO: 'green', REPROVADO: 'red', CONVERTIDO: 'teal', EXPIRADO: 'orange',
}

function formatCurrency(v: number) { return Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) }
function formatDate(d: string) { return d ? new Date(d).toLocaleDateString('pt-BR') : '—' }

export default function DetalheOrcamentoPage() {
  useModuloGuard('VENDAS')
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [reprovarModal, setReprovarModal] = useState(false)
  const [motivo, setMotivo] = useState('')

  const { data: orc, isLoading } = useOrcamento(id)
  const enviar = useEnviarOrcamento()
  const aprovar = useAprovarOrcamento()
  const reprovar = useReprovarOrcamento()
  const converter = useConverterOrcamento()

  if (isLoading) return <Card pos="relative" mih={200}><LoadingOverlay visible /></Card>
  if (!orc) return <div><Text>Orçamento não encontrado</Text><Button mt="md" onClick={() => router.push('/vendas/orcamentos')}>Voltar</Button></div>

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Vendas / Orçamentos / #{orc.numero}</Text>
      <Group justify="space-between" mb="md">
        <Group>
          <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => router.push('/vendas/orcamentos')}>Voltar</Button>
          <Text size="xl" fw={600}>Orçamento #{orc.numero}</Text>
          <Badge color={statusColors[orc.status] || 'gray'} size="lg">{orc.status}</Badge>
        </Group>
        <Group>
          {orc.status === 'ABERTO' && (
            <Button color="blue" leftSection={<IconSend size={16} />} onClick={() => enviar.mutate(id, { onSuccess: () => notifications.show({ title: 'Sucesso', message: 'Enviado', color: 'green' }) })} loading={enviar.isPending}>Enviar</Button>
          )}
          {['ABERTO', 'ENVIADO'].includes(orc.status) && (
            <>
              <Button color="green" leftSection={<IconCheck size={16} />} onClick={() => aprovar.mutate(id, { onSuccess: () => notifications.show({ title: 'Sucesso', message: 'Aprovado', color: 'green' }) })} loading={aprovar.isPending}>Aprovar</Button>
              <Button color="red" variant="light" leftSection={<IconX size={16} />} onClick={() => setReprovarModal(true)}>Reprovar</Button>
            </>
          )}
          {orc.status === 'APROVADO' && (
            <Button color="teal" leftSection={<IconTransform size={16} />} onClick={() => {
              if (confirm('Converter em pedido de venda?')) converter.mutate(id, {
                onSuccess: () => { notifications.show({ title: 'Sucesso', message: 'Pedido gerado', color: 'green' }); router.push('/vendas/pedidos') },
                onError: (err: any) => notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }),
              })
            }} loading={converter.isPending}>Converter em Pedido</Button>
          )}
        </Group>
      </Group>

      {/* Cabeçalho */}
      <Card withBorder mb="md" p="md">
        <SimpleGrid cols={{ base: 2, sm: 4 }}>
          <div><Text size="xs" c="dimmed">Cliente</Text><Text fw={500}>{orc.cliente?.nomeFantasia || orc.cliente?.razaoSocial}</Text></div>
          <div><Text size="xs" c="dimmed">Vendedor</Text><Text>{orc.vendedor?.nome || '—'}</Text></div>
          <div><Text size="xs" c="dimmed">Validade</Text><Text>{formatDate(orc.validadeAte)}</Text></div>
          <div><Text size="xs" c="dimmed">Criado em</Text><Text>{formatDate(orc.criadoEm)}</Text></div>
          {orc.contatoNome && <div><Text size="xs" c="dimmed">Contato</Text><Text>{orc.contatoNome}</Text></div>}
          {orc.contatoEmail && <div><Text size="xs" c="dimmed">E-mail</Text><Text>{orc.contatoEmail}</Text></div>}
        </SimpleGrid>
        {orc.observacao && <div style={{ marginTop: 12 }}><Text size="xs" c="dimmed">Observação</Text><Text>{orc.observacao}</Text></div>}
        {orc.motivoReprovacao && <div style={{ marginTop: 12 }}><Text size="xs" c="dimmed" fw={500}>Motivo da Reprovação</Text><Text c="red">{orc.motivoReprovacao}</Text></div>}
      </Card>

      {/* Itens */}
      <Card withBorder mb="md" p="md">
        <Text fw={500} mb="sm">Itens ({orc.itens?.length || 0})</Text>
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Produto</Table.Th>
              <Table.Th>Unidade</Table.Th>
              <Table.Th>Qtd</Table.Th>
              <Table.Th>Preço Unit.</Table.Th>
              <Table.Th>Desc %</Table.Th>
              <Table.Th>Total</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {(orc.itens || []).map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td fw={500}>{item.produto?.nome || item.produtoId}</Table.Td>
                <Table.Td>{item.unidade}</Table.Td>
                <Table.Td>{Number(item.quantidade)}</Table.Td>
                <Table.Td>{formatCurrency(item.precoUnitario)}</Table.Td>
                <Table.Td>{Number(item.desconto)}%</Table.Td>
                <Table.Td fw={600}>{formatCurrency(item.valorTotal)}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>

      {/* Totalizador */}
      <Paper withBorder p="md" radius="md">
        <SimpleGrid cols={{ base: 2, sm: 3 }}>
          <div><Text size="xs" c="dimmed">Desconto</Text><Text fw={600} c="red">{orc.tipoDesconto && Number(orc.descontoGeral) > 0 ? (orc.tipoDesconto === 'PERCENTUAL' ? `${orc.descontoGeral}%` : formatCurrency(Number(orc.descontoGeral))) : '—'}</Text></div>
          <div><Text size="xs" c="dimmed">Total do Orçamento</Text><Text fw={700} size="xl" c="blue">{formatCurrency(Number(orc.valorTotal))}</Text></div>
        </SimpleGrid>
      </Paper>

      {/* Modal Reprovar */}
      <Modal opened={reprovarModal} onClose={() => { setReprovarModal(false); setMotivo('') }} title="Reprovar Orçamento" centered>
        <Textarea label="Motivo" placeholder="Motivo da reprovação..." minRows={3} value={motivo} onChange={(e) => setMotivo(e.currentTarget.value)} />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => { setReprovarModal(false); setMotivo('') }}>Cancelar</Button>
          <Button color="red" disabled={motivo.length < 5} loading={reprovar.isPending} onClick={() => {
            reprovar.mutate({ id, motivo }, {
              onSuccess: () => { setReprovarModal(false); setMotivo(''); notifications.show({ title: 'Sucesso', message: 'Reprovado', color: 'green' }) },
            })
          }}>Reprovar</Button>
        </Group>
      </Modal>
    </div>
  )
}
