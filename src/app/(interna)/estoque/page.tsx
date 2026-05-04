'use client'

import { Card, Group, Text, SimpleGrid, ThemeIcon, Table, TextInput, Button, LoadingOverlay } from '@mantine/core'
import { IconPackage, IconMapPin, IconAlertTriangle, IconSearch, IconRefresh } from '@tabler/icons-react'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

export default function EstoquePage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - Estoque' }, [])
  const [search, setSearch] = useState('')

  const { data: prodResp } = useQuery<any>({
    queryKey: ['estoque-produtos-count'],
    queryFn: async () => { const { data } = await api.get('/produtos', { params: { limit: 1 } }); return data },
    staleTime: 1000 * 60 * 5,
  })

  const { data: saldosResp, isLoading, refetch } = useQuery<any>({
    queryKey: ['saldos', search],
    queryFn: async () => { const { data } = await api.get('/saldos', { params: { search: search || undefined } }); return data },
    staleTime: 1000 * 60,
  })

  const { data: estoqueResp } = useQuery<any>({
    queryKey: ['estoque-consolidado'],
    queryFn: async () => { const { data } = await api.get('/saldos', { params: { limit: 1 } }); return data },
    staleTime: 1000 * 60 * 5,
  })

  const saldos = saldosResp?.data || []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Estoque</Text>
      <Text size="xl" fw={600} mb="lg">Consulta de Estoque</Text>

      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="xl">
        <Card>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Produtos Cadastrados</Text>
              <Text size="xl" fw={700} mt={4}>{prodResp?.total || 0}</Text>
            </div>
            <ThemeIcon color="teal" variant="light" size={48} radius="md"><IconPackage size={24} /></ThemeIcon>
          </Group>
        </Card>
        <Card>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Posições com Saldo</Text>
              <Text size="xl" fw={700} mt={4}>{estoqueResp?.total || 0}</Text>
            </div>
            <ThemeIcon color="blue" variant="light" size={48} radius="md"><IconMapPin size={24} /></ThemeIcon>
          </Group>
        </Card>
        <Card>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Registros de Saldo</Text>
              <Text size="xl" fw={700} mt={4}>{saldosResp?.total || 0}</Text>
            </div>
            <ThemeIcon color="orange" variant="light" size={48} radius="md"><IconAlertTriangle size={24} /></ThemeIcon>
          </Group>
        </Card>
      </SimpleGrid>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Group justify="space-between" mb="md">
          <TextInput placeholder="Pesquisar por produto ou endereço..." leftSection={<IconSearch size={16} />}
            value={search} onChange={(e) => setSearch(e.currentTarget.value)} className="w-96" />
          <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetch()}>Atualizar</Button>
        </Group>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Endereço</Table.Th>
              <Table.Th>Produto</Table.Th>
              <Table.Th>Lote</Table.Th>
              <Table.Th>Validade</Table.Th>
              <Table.Th>Quantidade</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {saldos.map((item: any) => (
              <Table.Tr key={item.id}>
                <Table.Td><Text fw={500} ff="monospace" size="sm">{item.endereco?.enderecoCompleto || '—'}</Text></Table.Td>
                <Table.Td>{item.produto?.nome || item.produto?.descricao || '—'}</Table.Td>
                <Table.Td className="text-sm text-zinc-500">{item.lote || '—'}</Table.Td>
                <Table.Td>{item.validade ? new Date(item.validade).toLocaleDateString('pt-BR') : '—'}</Table.Td>
                <Table.Td><Text fw={600}>{Number(item.quantidade)}</Text></Table.Td>
              </Table.Tr>
            ))}
            {!isLoading && saldos.length === 0 && (
              <Table.Tr>
                <Table.Td colSpan={5} className="text-center py-8 text-zinc-500">
                  Nenhum saldo registrado. Os saldos serão gerados após o endereçamento das mercadorias conferidas.
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </div>
  )
}
