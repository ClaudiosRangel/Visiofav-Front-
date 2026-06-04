'use client'

import { useEffect, useState } from 'react'
import { Title, Stack, Table, Group, Button, Badge, Pagination, Text, Loader, Center } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { api } from '@/lib/api'

const STATUS_COLORS: Record<string, string> = {
  PENDENTE: 'yellow',
  SEPARANDO: 'blue',
  SEPARADA: 'indigo',
  ENTREGUE: 'green',
  CANCELADA: 'red',
}

export default function LiberacoesPage() {
  useEffect(() => { document.title = 'PCP - Liberação de Materiais' }, [])

  const [data, setData] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  async function carregar() {
    setLoading(true)
    try {
      const res = await api.get('/liberacoes-material', { params: { page, limit: 20 } })
      setData(res.data.data)
      setTotal(res.data.total)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar() }, [page])

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={3}>Liberação de Materiais</Title>
        <Button leftSection={<IconPlus size={16} />}>Nova Liberação</Button>
      </Group>

      {loading ? (
        <Center py="xl"><Loader /></Center>
      ) : data.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">Nenhuma liberação registrada.</Text>
      ) : (
        <>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nº</Table.Th>
                <Table.Th>OP</Table.Th>
                <Table.Th>Tipo</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Itens</Table.Th>
                <Table.Th>Data</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.map((lib) => (
                <Table.Tr key={lib.id}>
                  <Table.Td fw={600}>{lib.numero}</Table.Td>
                  <Table.Td>OP #{lib.ordemProducao?.numero || '-'}</Table.Td>
                  <Table.Td><Badge variant="light">{lib.tipo}</Badge></Table.Td>
                  <Table.Td><Badge color={STATUS_COLORS[lib.status] || 'gray'}>{lib.status}</Badge></Table.Td>
                  <Table.Td>{lib.itens?.length || 0}</Table.Td>
                  <Table.Td>{new Date(lib.criadoEm).toLocaleDateString('pt-BR')}</Table.Td>
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
