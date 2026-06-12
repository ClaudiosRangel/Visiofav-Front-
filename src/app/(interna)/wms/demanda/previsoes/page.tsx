'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, TextInput, LoadingOverlay,
  Pagination,
} from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const METODO_COLORS: Record<string, string> = {
  MEDIA_MOVEL: 'blue',
  SUAVIZACAO_EXPONENCIAL: 'grape',
  REGRESSAO_LINEAR: 'teal',
  SAZONALIDADE: 'orange',
}

export default function PrevisoesPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Previsões de Demanda' }, [])

  const [page, setPage] = useState(1)
  const [filtroProduto, setFiltroProduto] = useState('')
  const pageSize = 20

  const { data: resp, isLoading } = useQuery<any>({
    queryKey: ['demanda-previsoes', page, filtroProduto],
    queryFn: async () => {
      const params: any = { page, pageSize }
      if (filtroProduto) params.produto = filtroProduto
      const { data } = await api.get('/demanda/previsoes', { params })
      return data
    },
  })

  const items = resp?.data || resp?.items || []
  const total = resp?.total || resp?.totalItems || 0
  const totalPages = Math.ceil(total / pageSize) || 1

  function getConfiancaColor(confianca: number) {
    if (confianca >= 80) return 'green'
    if (confianca >= 60) return 'yellow'
    return 'red'
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Demanda / Previsões</Text>
      <Text size="xl" fw={600} mb="lg">Previsões de Demanda</Text>

      <Card withBorder mb="md">
        <Group>
          <TextInput
            placeholder="Filtrar por produto..."
            leftSection={<IconSearch size={16} />}
            value={filtroProduto}
            onChange={(e) => { setFiltroProduto(e.currentTarget.value); setPage(1) }}
            w={300}
          />
          <Text size="sm" c="dimmed">{total} previsões encontradas</Text>
        </Group>
      </Card>

      <Card withBorder pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Produto</Table.Th>
              <Table.Th>Data</Table.Th>
              <Table.Th>Qtd. Prevista</Table.Th>
              <Table.Th>Confiança</Table.Th>
              <Table.Th>Método</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any, idx: number) => (
              <Table.Tr key={item.id || idx}>
                <Table.Td>{item.produtoNome || item.sku}</Table.Td>
                <Table.Td>
                  {item.data
                    ? new Date(item.data).toLocaleDateString('pt-BR')
                    : '—'}
                </Table.Td>
                <Table.Td fw={500}>{item.quantidadePrevista}</Table.Td>
                <Table.Td>
                  <Badge color={getConfiancaColor(item.confianca)} variant="light">
                    {item.confianca?.toFixed(0)}%
                  </Badge>
                </Table.Td>
                <Table.Td>
                  <Badge color={METODO_COLORS[item.metodo] || 'gray'} variant="dot">
                    {item.metodo?.replace(/_/g, ' ') || '—'}
                  </Badge>
                </Table.Td>
              </Table.Tr>
            ))}
            {items.length === 0 && !isLoading && (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed" ta="center" py="sm">Nenhuma previsão encontrada</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>

        {totalPages > 1 && (
          <Group justify="center" mt="md">
            <Pagination value={page} onChange={setPage} total={totalPages} />
          </Group>
        )}
      </Card>
    </div>
  )
}
