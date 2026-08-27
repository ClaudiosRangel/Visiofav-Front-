'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, NumberInput,
  SimpleGrid, ThemeIcon, Progress, Alert,
} from '@mantine/core'
import {
  IconChartBar, IconRefresh, IconTrendingUp,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const curvaCores: Record<string, string> = { A: 'green', B: 'yellow', C: 'red' }

export default function ClassificacaoAbcPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Classificação ABC' }, [])
  const queryClient = useQueryClient()

  const [faixaA, setFaixaA] = useState<number>(80)
  const [faixaB, setFaixaB] = useState<number>(95)
  const [resultado, setResultado] = useState<any>(null)

  // Buscar produtos com curva ABC definida
  const { data: produtosResp } = useQuery<any>({
    queryKey: ['produtos-abc'],
    queryFn: async () => {
      const { data } = await api.get('/produtos', { params: { limit: 200 } })
      return data
    },
  })

  const produtos = (produtosResp?.data || []).filter((p: any) => p.curvaAbc)

  const totalA = produtos.filter((p: any) => p.curvaAbc === 'A').length
  const totalB = produtos.filter((p: any) => p.curvaAbc === 'B').length
  const totalC = produtos.filter((p: any) => p.curvaAbc === 'C').length
  const totalClassificados = produtos.length

  // Calcular ABC
  const calcularAbc = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/bloqueio-wms/classificacao-abc/calcular', { faixaA, faixaB })
      return data
    },
    onSuccess: (data) => {
      setResultado(data)
      queryClient.invalidateQueries({ queryKey: ['produtos-abc'] })
      notifications.show({
        title: '✅ Classificação ABC calculada',
        message: `${data.atualizados} produto(s) classificado(s)`,
        color: 'green',
      })
    },
    onError: (err: any) => {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' })
    },
  })

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Estoque / Classificação ABC</Text>
      <Text size="xl" fw={600} mb="lg">Classificação ABC de Produtos</Text>

      <SimpleGrid cols={{ base: 1, sm: 4 }} mb="lg">
        <Card withBorder>
          <Group justify="space-between">
            <div>
              <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Curva A</Text>
              <Text size="xl" fw={700} c="green">{totalA}</Text>
            </div>
            <ThemeIcon color="green" variant="light" size={40} radius="md"><IconTrendingUp size={20} /></ThemeIcon>
          </Group>
          <Text size="xs" c="dimmed">Alto giro ({faixaA}% do faturamento)</Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Curva B</Text>
          <Text size="xl" fw={700} c="yellow">{totalB}</Text>
          <Text size="xs" c="dimmed">Médio giro ({faixaB - faixaA}% do faturamento)</Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Curva C</Text>
          <Text size="xl" fw={700} c="red">{totalC}</Text>
          <Text size="xs" c="dimmed">Baixo giro ({100 - faixaB}% do faturamento)</Text>
        </Card>
        <Card withBorder>
          <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Total Classificados</Text>
          <Text size="xl" fw={700}>{totalClassificados}</Text>
        </Card>
      </SimpleGrid>

      {/* Parâmetros e ação */}
      <Card withBorder mb="lg">
        <Text fw={600} mb="sm">Recalcular Classificação ABC</Text>
        <Text size="sm" c="dimmed" mb="md">
          Calcula a curva ABC com base nas vendas dos últimos 12 meses. 
          Produtos com maior representatividade no faturamento são classificados como A.
        </Text>
        <Group mb="md">
          <NumberInput label="Faixa A (% acumulado)" value={faixaA} onChange={(v) => setFaixaA(typeof v === 'number' ? v : 80)}
            min={50} max={95} className="w-40" suffix="%" />
          <NumberInput label="Faixa B (% acumulado)" value={faixaB} onChange={(v) => setFaixaB(typeof v === 'number' ? v : 95)}
            min={faixaA + 1} max={99} className="w-40" suffix="%" />
        </Group>
        <Button leftSection={<IconRefresh size={16} />} onClick={() => calcularAbc.mutate()} loading={calcularAbc.isPending}>
          Calcular ABC
        </Button>
        {resultado && (
          <Alert color="green" variant="light" mt="md">
            Classificação concluída: {resultado.atualizados} produto(s) atualizados
          </Alert>
        )}
      </Card>

      {/* Tabela de produtos classificados */}
      {produtos.length > 0 && (
        <Card>
          <Text fw={600} mb="sm">Produtos Classificados ({totalClassificados})</Text>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Código</Table.Th>
                <Table.Th>Produto</Table.Th>
                <Table.Th>Família</Table.Th>
                <Table.Th>Curva</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {produtos.slice(0, 50).map((p: any) => (
                <Table.Tr key={p.id}>
                  <Table.Td className="font-mono">{p.codigo}</Table.Td>
                  <Table.Td>{p.nome}</Table.Td>
                  <Table.Td>{p.familia || '—'}</Table.Td>
                  <Table.Td>
                    <Badge color={curvaCores[p.curvaAbc] || 'gray'} size="lg" variant="filled">
                      {p.curvaAbc}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          {produtos.length > 50 && (
            <Text size="sm" c="dimmed" mt="sm">Mostrando 50 de {produtos.length} produtos</Text>
          )}
        </Card>
      )}
    </div>
  )
}
