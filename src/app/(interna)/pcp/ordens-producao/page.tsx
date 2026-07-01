'use client'

import { useEffect, useState } from 'react'
import { Title, Stack, Table, Badge, Group, Button, TextInput, Select, Pagination, ActionIcon, Text, Loader, Center } from '@mantine/core'
import { IconPlus, IconSearch, IconEye, IconTrash } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

const STATUS_COLORS: Record<string, string> = {
  RASCUNHO: 'gray',
  PLANEJADA: 'blue',
  PROGRAMADA: 'indigo',
  LIBERADA: 'cyan',
  EM_PRODUCAO: 'orange',
  CONCLUIDA: 'green',
  CANCELADA: 'red',
}

const PRIORIDADE_COLORS: Record<string, string> = {
  BAIXA: 'gray',
  NORMAL: 'blue',
  ALTA: 'orange',
  URGENTE: 'red',
}

export default function OrdensProducaoPage() {
  useEffect(() => { document.title = 'PCP - Ordens de Produção' }, [])
  const router = useRouter()

  const [data, setData] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [busca, setBusca] = useState('')
  const [statusFilter, setStatusFilter] = useState<string | null>(null)

  async function carregarOps() {
    setLoading(true)
    try {
      const params: any = { page, limit: 20 }
      if (statusFilter) params.status = statusFilter
      if (busca) params.numero = busca
      const res = await api.get('/ordens-producao', { params })
      setData(res.data.data)
      setTotal(res.data.total)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  async function excluirOp(opId: string, opNumero: string | number) {
    if (!confirm(`Excluir OP #${opNumero}?\n\nEsta ação remove a OP e todas as suas etapas da programação.\nSó é possível excluir OPs que não foram iniciadas e não possuem apontamentos.`)) return
    try {
      await api.delete(`/ordens-producao/${opId}`)
      notifications.show({ title: 'OP excluída', message: `OP #${opNumero} removida com sucesso da programação`, color: 'green' })
      carregarOps()
    } catch (err: any) {
      notifications.show({ title: 'Não é possível excluir', message: err?.response?.data?.message || 'Falha ao excluir OP', color: 'red' })
    }
  }

  useEffect(() => { carregarOps() }, [page, statusFilter])

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={3}>Ordens de Produção</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => router.push('/pcp/ordens-producao/nova')}>
          Nova OP
        </Button>
      </Group>

      <Group>
        <TextInput
          placeholder="Buscar por número..."
          leftSection={<IconSearch size={16} />}
          value={busca}
          onChange={(e) => setBusca(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') carregarOps() }}
          w={200}
        />
        <Select
          placeholder="Status"
          clearable
          data={['RASCUNHO', 'PLANEJADA', 'PROGRAMADA', 'LIBERADA', 'EM_PRODUCAO', 'CONCLUIDA', 'CANCELADA']}
          value={statusFilter}
          onChange={setStatusFilter}
          w={180}
        />
      </Group>

      {loading ? (
        <Center py="xl"><Loader /></Center>
      ) : data.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">Nenhuma ordem de produção encontrada.</Text>
      ) : (
        <>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nº</Table.Th>
                <Table.Th>Produto</Table.Th>
                <Table.Th>Quantidade</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Prioridade</Table.Th>
                <Table.Th>Entrega</Table.Th>
                <Table.Th>% Concluído</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.map((op) => (
                <Table.Tr key={op.id}>
                  <Table.Td fw={600}>{op.referenciaExterna || op.numero}</Table.Td>
                  <Table.Td>{op.produtoNome || op.produtoId?.substring(0, 8)}</Table.Td>
                  <Table.Td>{Number(op.quantidade)} {op.unidadeMedida}</Table.Td>
                  <Table.Td><Badge color={STATUS_COLORS[op.status] || 'gray'}>{op.status}</Badge></Table.Td>
                  <Table.Td><Badge color={PRIORIDADE_COLORS[op.prioridade] || 'gray'} variant="light">{op.prioridade}</Badge></Table.Td>
                  <Table.Td>{op.dataEntregaPrevista ? new Date(op.dataEntregaPrevista).toLocaleDateString('pt-BR') : '-'}</Table.Td>
                  <Table.Td>{op.percentualConcluido}%</Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      <ActionIcon variant="subtle" onClick={() => router.push(`/pcp/ordens-producao/${op.id}`)} title="Visualizar">
                        <IconEye size={18} />
                      </ActionIcon>
                      {!['CONCLUIDA', 'CANCELADA'].includes(op.status) && op.percentualConcluido === 0 && (
                        <ActionIcon variant="subtle" color="red" onClick={() => excluirOp(op.id, op.referenciaExterna || op.numero)} title="Excluir OP">
                          <IconTrash size={18} />
                        </ActionIcon>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>

          <Group justify="center">
            <Pagination total={Math.ceil(total / 20)} value={page} onChange={setPage} />
          </Group>
        </>
      )}
    </Stack>
  )
}
