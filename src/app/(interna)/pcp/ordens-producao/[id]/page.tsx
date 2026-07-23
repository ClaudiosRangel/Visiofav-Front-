'use client'

import { useEffect, useState } from 'react'
import { Title, Stack, Card, Group, Badge, Text, Table, Tabs, Button, Loader, Center, Divider, Timeline } from '@mantine/core'
import { IconArrowLeft, IconPackage, IconRoute, IconClipboardCheck, IconTruck, IconPalette, IconFileTypePdf } from '@tabler/icons-react'
import { useRouter, useParams } from 'next/navigation'
import { api } from '@/lib/api'

const STATUS_COLORS: Record<string, string> = {
  RASCUNHO: 'gray', PLANEJADA: 'blue', PROGRAMADA: 'indigo', LIBERADA: 'cyan', EM_PRODUCAO: 'orange', CONCLUIDA: 'green', CANCELADA: 'red',
}
const PRIORIDADE_COLORS: Record<string, string> = { BAIXA: 'gray', NORMAL: 'blue', ALTA: 'orange', URGENTE: 'red' }

export default function DetalheOpPage() {
  const params = useParams()
  const id = params.id as string
  const router = useRouter()

  const [op, setOp] = useState<any>(null)
  const [variacoes, setVariacoes] = useState<any[]>([])
  const [programacoes, setProgramacoes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { document.title = 'PCP - Detalhe OP' }, [])

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      api.get(`/ordens-producao/${id}`),
      api.get(`/ordens-producao/${id}/variacoes`).catch(() => ({ data: { variacoes: [] } })),
      api.get(`/ordens-producao/${id}/programacao-entrega`).catch(() => ({ data: { programacoes: [] } })),
    ]).then(([opRes, varRes, progRes]) => {
      setOp(opRes.data)
      setVariacoes(varRes.data.variacoes || [])
      setProgramacoes(progRes.data.programacoes || [])
    }).finally(() => setLoading(false))
  }, [id])

  if (loading) return <Center py="xl"><Loader /></Center>
  if (!op) return <Text c="red" ta="center" py="xl">OP não encontrada</Text>

  async function alterarStatus(novoStatus: string) {
    try {
      const res = await api.patch(`/ordens-producao/${id}/status`, { status: novoStatus })
      // Mescla os campos atualizados (status, datas, etc.) no estado já
      // carregado, em vez de refazer o GET completo (que reprocessa itens,
      // etapas, apontamentos, logs e liberações) — evita uma segunda viagem
      // de rede pesada só para atualizar o badge de status.
      setOp((prev: any) => ({
        ...prev,
        ...res.data,
        logs: [
          { id: `temp-${Date.now()}`, statusAnterior: prev.status, statusNovo: novoStatus, criadoEm: new Date().toISOString(), observacao: null },
          ...(prev.logs || []),
        ],
      }))
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Erro ao alterar status')
    }
  }

  const transicoesPermitidas: Record<string, string[]> = {
    RASCUNHO: ['PLANEJADA', 'CANCELADA'],
    PLANEJADA: ['PROGRAMADA', 'CANCELADA'],
    PROGRAMADA: ['LIBERADA', 'CANCELADA'],
    LIBERADA: ['EM_PRODUCAO', 'CANCELADA'],
    EM_PRODUCAO: ['CONCLUIDA'],
    CONCLUIDA: [],
    CANCELADA: [],
  }

  const botoesStatus: Record<string, { label: string; color: string }> = {
    PLANEJADA: { label: '→ Planejar', color: 'blue' },
    PROGRAMADA: { label: '→ Programar', color: 'indigo' },
    LIBERADA: { label: '→ Liberar', color: 'cyan' },
    EM_PRODUCAO: { label: '→ Iniciar Produção', color: 'orange' },
    CONCLUIDA: { label: '→ Concluir', color: 'green' },
    CANCELADA: { label: '✕ Cancelar', color: 'red' },
  }

  const proximosStatus = transicoesPermitidas[op.status] || []

  return (
    <Stack gap="md">
      <Group>
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => router.push('/pcp/ordens-producao')}>Voltar</Button>
        <Title order={3}>OP #{op.referenciaExterna || op.numero}</Title>
        <Badge color={STATUS_COLORS[op.status]} size="lg">{op.status}</Badge>
        <Badge color={PRIORIDADE_COLORS[op.prioridade]} variant="light">{op.prioridade}</Badge>
        <Text size="sm" c="dimmed">{op.percentualConcluido}% concluído</Text>
        {op.origemImportacao === 'PDF_GPRINT' && (
          <Button
            size="xs"
            variant="light"
            color="red"
            leftSection={<IconFileTypePdf size={14} />}
            onClick={() => {
              const token = localStorage.getItem('visiofab-wms-token')
              const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api'
              window.open(`${apiUrl}/pcp/op-pdf/${id}?token=${token}`, '_blank')
            }}
          >
            Ver PDF
          </Button>
        )}
      </Group>

      {/* Botões de transição de status */}
      {proximosStatus.length > 0 && (
        <Group gap="xs">
          {proximosStatus.map((s) => {
            const config = botoesStatus[s]
            return config ? (
              <Button key={s} size="xs" color={config.color} variant={s === 'CANCELADA' ? 'outline' : 'filled'} onClick={() => alterarStatus(s)}>
                {config.label}
              </Button>
            ) : null
          })}
        </Group>
      )}

      {/* Cabeçalho */}
      <Card withBorder>
        <Group grow>
          <div><Text size="xs" c="dimmed">Produto</Text><Text fw={600}>{op.produtoNome || op.produtoId}</Text></div>
          <div><Text size="xs" c="dimmed">Quantidade</Text><Text fw={600}>{Number(op.quantidade)} {op.unidadeMedida}{Number(op.quantidadeExcedente) > 0 ? ` (+${Number(op.quantidadeExcedente)} excedente)` : ''}</Text></div>
          <div><Text size="xs" c="dimmed">Entrega Prevista</Text><Text fw={600}>{op.dataEntregaPrevista ? new Date(op.dataEntregaPrevista).toLocaleDateString('pt-BR') : '—'}</Text></div>
          <div><Text size="xs" c="dimmed">Cliente</Text><Text fw={600}>{op.clienteNome || '—'}</Text></div>
          <div><Text size="xs" c="dimmed">Lote</Text><Text fw={600}>{op.lote || '—'}</Text></div>
          <div><Text size="xs" c="dimmed">Cor</Text><Text fw={600}>{op.cor || '—'}</Text></div>
        </Group>
        {op.observacoes && <Text size="sm" c="dimmed" mt="sm">{op.observacoes}</Text>}
      </Card>

      <Tabs defaultValue="materiais">
        <Tabs.List>
          <Tabs.Tab value="materiais" leftSection={<IconPackage size={16} />}>Materiais ({op.itens?.length || 0})</Tabs.Tab>
          <Tabs.Tab value="etapas" leftSection={<IconRoute size={16} />}>Etapas ({op.etapas?.length || 0})</Tabs.Tab>
          <Tabs.Tab value="variacoes" leftSection={<IconPalette size={16} />}>Variações ({variacoes.length})</Tabs.Tab>
          <Tabs.Tab value="entregas" leftSection={<IconTruck size={16} />}>Entregas ({programacoes.length})</Tabs.Tab>
          <Tabs.Tab value="historico" leftSection={<IconClipboardCheck size={16} />}>Histórico</Tabs.Tab>
        </Tabs.List>

        {/* ABA MATERIAIS */}
        <Tabs.Panel value="materiais" pt="md">
          {op.itens?.length > 0 ? (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Material</Table.Th>
                  <Table.Th>Quantidade</Table.Th>
                  <Table.Th>Unidade</Table.Th>
                  <Table.Th>Liberado</Table.Th>
                  <Table.Th>Consumido</Table.Th>
                  <Table.Th>Perda</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {op.itens.map((item: any) => (
                  <Table.Tr key={item.id}>
                    <Table.Td>{item.descricaoProduto}</Table.Td>
                    <Table.Td fw={600}>{Number(item.quantidade)}</Table.Td>
                    <Table.Td>{item.unidadeMedida}</Table.Td>
                    <Table.Td>{Number(item.quantidadeLiberada)}</Table.Td>
                    <Table.Td>{Number(item.quantidadeConsumida)}</Table.Td>
                    <Table.Td>{Number(item.quantidadePerda) > 0 ? <Badge color="red" size="sm">{Number(item.quantidadePerda)}</Badge> : '0'}</Table.Td>
                    <Table.Td><Badge size="sm" color={item.status === 'PENDENTE' ? 'gray' : 'green'}>{item.status}</Badge></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : <Text c="dimmed" ta="center">Nenhum material</Text>}
        </Tabs.Panel>

        {/* ABA ETAPAS */}
        <Tabs.Panel value="etapas" pt="md">
          {op.etapas?.length > 0 ? (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Seq</Table.Th>
                  <Table.Th>Operação</Table.Th>
                  <Table.Th>Centro</Table.Th>
                  <Table.Th>Setup (min)</Table.Th>
                  <Table.Th>Operação (min)</Table.Th>
                  <Table.Th>Espera (min)</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {op.etapas.map((etapa: any) => (
                  <Table.Tr key={etapa.id}>
                    <Table.Td>{etapa.sequencia}</Table.Td>
                    <Table.Td>{etapa.descricao}</Table.Td>
                    <Table.Td>{etapa.centroProducao?.descricao || '—'}</Table.Td>
                    <Table.Td>{Number(etapa.tempoSetupMinutos)}</Table.Td>
                    <Table.Td>{Number(etapa.tempoOperacaoCalculado)}</Table.Td>
                    <Table.Td>{Number(etapa.tempoEsperaMinutos)}</Table.Td>
                    <Table.Td><Badge size="sm" color={etapa.status === 'PENDENTE' ? 'gray' : etapa.status === 'EM_ANDAMENTO' ? 'orange' : 'green'}>{etapa.status}</Badge></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : <Text c="dimmed" ta="center">Nenhuma etapa</Text>}
        </Tabs.Panel>

        {/* ABA VARIAÇÕES */}
        <Tabs.Panel value="variacoes" pt="md">
          {variacoes.length > 0 ? (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Seq</Table.Th>
                  <Table.Th>Código</Table.Th>
                  <Table.Th>Descrição</Table.Th>
                  <Table.Th>Cor</Table.Th>
                  <Table.Th>Quantidade</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {variacoes.map((v: any) => (
                  <Table.Tr key={v.id}>
                    <Table.Td>{v.sequencia}</Table.Td>
                    <Table.Td fw={600}>{v.codigoProduto}</Table.Td>
                    <Table.Td>{v.descricao}</Table.Td>
                    <Table.Td><Badge variant="light">{v.cor || '—'}</Badge></Table.Td>
                    <Table.Td fw={600}>{Number(v.quantidade)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : <Text c="dimmed" ta="center">Nenhuma variação</Text>}
        </Tabs.Panel>

        {/* ABA ENTREGAS */}
        <Tabs.Panel value="entregas" pt="md">
          {programacoes.length > 0 ? (
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Data Entrega</Table.Th>
                  <Table.Th>Quantidade</Table.Th>
                  <Table.Th>Pedido</Table.Th>
                  <Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {programacoes.map((p: any) => (
                  <Table.Tr key={p.id}>
                    <Table.Td>{new Date(p.dataEntrega).toLocaleDateString('pt-BR')}</Table.Td>
                    <Table.Td fw={600}>{Number(p.quantidade)}</Table.Td>
                    <Table.Td>{p.codigoPedido || '—'}</Table.Td>
                    <Table.Td><Badge color={p.status === 'EXPEDIDO' ? 'green' : p.status === 'PRODUZIDO' ? 'blue' : 'gray'}>{p.status}</Badge></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          ) : <Text c="dimmed" ta="center">Nenhuma entrega programada</Text>}
        </Tabs.Panel>

        {/* ABA HISTÓRICO */}
        <Tabs.Panel value="historico" pt="md">
          {op.logs?.length > 0 ? (
            <Timeline active={op.logs.length - 1} bulletSize={20} lineWidth={2}>
              {op.logs.map((log: any) => (
                <Timeline.Item key={log.id} title={`${log.statusAnterior || '—'} → ${log.statusNovo}`}>
                  <Text size="xs" c="dimmed">{new Date(log.criadoEm).toLocaleString('pt-BR')}</Text>
                  {log.observacao && <Text size="sm">{log.observacao}</Text>}
                </Timeline.Item>
              ))}
            </Timeline>
          ) : <Text c="dimmed" ta="center">Nenhum registro</Text>}
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
