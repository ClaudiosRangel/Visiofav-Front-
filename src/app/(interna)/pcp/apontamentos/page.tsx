'use client'

import { useEffect, useState } from 'react'
import { Title, Stack, Table, Group, Button, Select, Pagination, Text, Loader, Center, Badge } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

export default function ApontamentosPage() {
  useEffect(() => { document.title = 'PCP - Apontamentos' }, [])
  const router = useRouter()
  const [data, setData] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  async function carregar() {
    setLoading(true)
    try {
      const res = await api.get('/apontamentos-producao', { params: { page, limit: 20 } })
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
        <Title order={3}>Apontamentos de Produção</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => router.push('/pcp/programacao')}>Novo Apontamento</Button>
      </Group>

      {loading ? (
        <Center py="xl"><Loader /></Center>
      ) : data.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">Nenhum apontamento registrado.</Text>
      ) : (
        <>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>OP</Table.Th>
                <Table.Th>Centro</Table.Th>
                <Table.Th>Qtd Produzida</Table.Th>
                <Table.Th>Qtd Rejeitada</Table.Th>
                <Table.Th>Tempo (min)</Table.Th>
                <Table.Th>Data</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.map((apt) => (
                <Table.Tr key={apt.id}>
                  <Table.Td fw={600}>#{apt.ordemProducao?.numero || '-'}</Table.Td>
                  <Table.Td>{apt.centroProducao?.descricao || '-'}</Table.Td>
                  <Table.Td>{Number(apt.quantidadeProduzida)}</Table.Td>
                  <Table.Td>{Number(apt.quantidadeRejeitada) > 0 ? <Badge color="red">{Number(apt.quantidadeRejeitada)}</Badge> : '0'}</Table.Td>
                  <Table.Td>{Number(apt.tempoProducaoMinutos)} min</Table.Td>
                  <Table.Td>{new Date(apt.criadoEm).toLocaleDateString('pt-BR')}</Table.Td>
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
