'use client'

import { useState, useEffect } from 'react'
import {
  Button, Card, Group, Text, Table, Badge, ActionIcon, Tooltip,
  LoadingOverlay, Pagination, Modal, Code,
} from '@mantine/core'
import { IconRefresh, IconEye, IconX, IconFileText } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const statusColors: Record<string, string> = { PENDENTE: 'gray', AUTORIZADA: 'green', REJEITADA: 'red', CANCELADA: 'orange' }

export default function NfePage() {
  useModuloGuard('VENDAS')
  useEffect(() => { document.title = 'Vizor - Fiscal - NF-e' }, [])
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [xmlModal, setXmlModal] = useState<string | null>(null)
  const limit = 20

  const { data: response, isLoading, refetch } = useQuery<any>({
    queryKey: ['nfe', { page, limit }],
    queryFn: async () => { const { data } = await api.get('/nfe', { params: { page, limit } }); return data },
  })

  const cancelar = useMutation({
    mutationFn: async (id: string) => {
      const justificativa = prompt('Justificativa para cancelamento (mín. 15 caracteres):')
      if (!justificativa || justificativa.length < 15) throw new Error('Justificativa deve ter no mínimo 15 caracteres')
      const { data } = await api.post(`/nfe/${id}/cancelar`, { justificativa })
      return data
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['nfe'] }); notifications.show({ title: 'Sucesso', message: 'NF-e cancelada', color: 'green' }) },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' }) },
  })

  const gerarXml = useMutation({
    mutationFn: async (id: string) => {
      const { data } = await api.post(`/nfe/${id}/gerar-xml`)
      return data
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['nfe'] }); notifications.show({ title: '✅ XML gerado', message: 'XML da NF-e gerado com sucesso', color: 'green' }) },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao gerar XML', color: 'red' }) },
  })

  const verXml = async (id: string) => {
    try {
      const { data } = await api.get(`/nfe/${id}`)
      setXmlModal(data.xmlEnviado || 'XML não disponível')
    } catch { setXmlModal('Erro ao carregar XML') }
  }

  const items = response?.data || []
  const total = response?.total || 0
  const totalPages = Math.ceil(total / limit)

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Fiscal / NF-e</Text>
      <Text size="xl" fw={600} mb="lg">Notas Fiscais Eletrônicas</Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Group justify="flex-end" mb="md">
          <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Número</Table.Th>
              <Table.Th>Série</Table.Th>
              <Table.Th>Chave de Acesso</Table.Th>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Pedido</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Ambiente</Table.Th>
              <Table.Th className="w-32">Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td fw={500}>{item.numero}</Table.Td>
                <Table.Td>{item.serie}</Table.Td>
                <Table.Td><Text size="xs" className="font-mono">{item.chaveAcesso?.substring(0, 20)}...</Text></Table.Td>
                <Table.Td><Badge variant="light">{item.tipoNfe}</Badge></Table.Td>
                <Table.Td>{item.vendaEfetivada?.pedidoVenda?.numero ? `#${item.vendaEfetivada.pedidoVenda.numero}` : '—'}</Table.Td>
                <Table.Td><Badge color={statusColors[item.status] || 'gray'}>{item.status}</Badge></Table.Td>
                <Table.Td><Badge variant="light" color={item.ambiente === 1 ? 'red' : 'blue'}>{item.ambiente === 1 ? 'Produção' : 'Homologação'}</Badge></Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    {item.status === 'PENDENTE' && (
                      <Tooltip label="Gerar XML"><ActionIcon variant="subtle" color="blue" onClick={() => gerarXml.mutate(item.id)} loading={gerarXml.isPending}><IconFileText size={18} /></ActionIcon></Tooltip>
                    )}
                    <Tooltip label="Ver DANFE"><ActionIcon variant="subtle" color="teal" onClick={async () => {
                      try {
                        const { data } = await api.get(`/nfe/${item.id}/danfe`, { responseType: 'text' })
                        const w = window.open('', '_blank')
                        if (w) { w.document.write(data); w.document.close() }
                      } catch { notifications.show({ title: 'Erro', message: 'Falha ao carregar DANFE', color: 'red' }) }
                    }}><IconFileText size={18} /></ActionIcon></Tooltip>
                    <Tooltip label="Ver XML"><ActionIcon variant="subtle" color="gray" onClick={() => verXml(item.id)}><IconEye size={18} /></ActionIcon></Tooltip>
                    {item.status === 'AUTORIZADA' && <Tooltip label="Cancelar"><ActionIcon variant="subtle" color="red" onClick={() => cancelar.mutate(item.id)}><IconX size={18} /></ActionIcon></Tooltip>}
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && items.length === 0 && <Table.Tr><Table.Td colSpan={8} className="text-center py-8 text-zinc-500">Nenhuma NF-e emitida</Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>
        {totalPages > 1 && <Group justify="center" mt="md"><Pagination total={totalPages} value={page} onChange={setPage} /></Group>}
      </Card>

      <Modal opened={!!xmlModal} onClose={() => setXmlModal(null)} title="XML da NF-e" size="xl" centered>
        <Code block className="text-xs max-h-96 overflow-auto">{xmlModal}</Code>
      </Modal>
    </div>
  )
}
