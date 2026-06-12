'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, Select, LoadingOverlay,
} from '@mantine/core'
import { IconDownload, IconRefresh } from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { notifications } from '@mantine/notifications'

const CRITERIOS = [
  { value: 'FREQUENCIA', label: 'Frequência de Saída' },
  { value: 'VALOR', label: 'Valor Monetário' },
  { value: 'VOLUME', label: 'Volume Movimentado' },
]

const CLASS_COLORS: Record<string, string> = {
  A: 'green',
  B: 'yellow',
  C: 'red',
}

export default function ClassificacaoAbcPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Classificação ABC' }, [])

  const queryClient = useQueryClient()
  const [criterio, setCriterio] = useState<string>('FREQUENCIA')

  const { data: resp, isLoading } = useQuery<any>({
    queryKey: ['demanda-abc', criterio],
    queryFn: async () => {
      const { data } = await api.get('/demanda/abc', { params: { criterio } })
      return data
    },
  })

  const recalcular = useMutation({
    mutationFn: async () => {
      await api.post('/demanda/abc/recalcular', { criterio })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demanda-abc'] })
      notifications.show({ title: 'Sucesso', message: 'Classificação ABC recalculada', color: 'green' })
    },
    onError: () => {
      notifications.show({ title: 'Erro', message: 'Falha ao recalcular ABC', color: 'red' })
    },
  })

  const items = resp?.data || resp || []

  async function exportarCSV() {
    try {
      const response = await api.get('/demanda/abc/exportar', {
        params: { criterio },
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `classificacao-abc-${criterio.toLowerCase()}.csv`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch {
      notifications.show({ title: 'Erro', message: 'Falha ao exportar CSV', color: 'red' })
    }
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Demanda / Classificação ABC</Text>

      <Group justify="space-between" mb="lg">
        <Text size="xl" fw={600}>Classificação ABC</Text>
        <Group>
          <Button
            variant="light"
            leftSection={<IconRefresh size={16} />}
            loading={recalcular.isPending}
            onClick={() => recalcular.mutate()}
          >
            Recalcular ABC
          </Button>
          <Button
            variant="light"
            color="green"
            leftSection={<IconDownload size={16} />}
            onClick={exportarCSV}
          >
            Exportar CSV
          </Button>
        </Group>
      </Group>

      <Card withBorder mb="md">
        <Group>
          <Select
            label="Critério de Classificação"
            data={CRITERIOS}
            value={criterio}
            onChange={(v) => v && setCriterio(v)}
            w={250}
          />
        </Group>
      </Card>

      <Card withBorder pos="relative">
        <LoadingOverlay visible={isLoading} />
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Produto</Table.Th>
              <Table.Th>SKU</Table.Th>
              <Table.Th>Classificação</Table.Th>
              <Table.Th>Valor</Table.Th>
              <Table.Th>% Acumulado</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.map((item: any) => (
              <Table.Tr key={item.produtoId || item.sku}>
                <Table.Td>{item.nome || item.produto}</Table.Td>
                <Table.Td>{item.sku}</Table.Td>
                <Table.Td>
                  <Badge color={CLASS_COLORS[item.classificacao] || 'gray'} variant="filled">
                    {item.classificacao}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {typeof item.valor === 'number'
                    ? item.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
                    : item.valor}
                </Table.Td>
                <Table.Td>{item.percentualAcumulado?.toFixed(1)}%</Table.Td>
              </Table.Tr>
            ))}
            {items.length === 0 && !isLoading && (
              <Table.Tr>
                <Table.Td colSpan={5}>
                  <Text c="dimmed" ta="center" py="sm">Nenhum dado de classificação encontrado</Text>
                </Table.Td>
              </Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </div>
  )
}
