'use client'

import { useEffect, useState } from 'react'
import { Card, Group, Text, Table, Title, Stack, LoadingOverlay, Badge, SimpleGrid } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { useQuery } from '@tanstack/react-query'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { financeiroApi, type LinhaDre, type CategoriaFinanceira } from '@/hooks/financeiro/useFinanceiroApi'
import { formatarBRL } from '@/lib/financeiro/format'

export default function DrePage() {
  useModuloGuard('FINANCEIRO')
  useEffect(() => { document.title = 'Vizor - Financeiro - DRE' }, [])
  const hoje = new Date()
  const [de, setDe] = useState<Date | null>(new Date(hoje.getFullYear(), hoje.getMonth(), 1))
  const [ate, setAte] = useState<Date | null>(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0))

  const params = { de: (de ?? new Date()).toISOString(), ate: (ate ?? new Date()).toISOString() }
  const { data: linhas = [], isLoading } = useQuery<LinhaDre[]>({ queryKey: ['fin-dre', params], queryFn: () => financeiroApi.dre(params) })
  const { data: categorias = [] } = useQuery<CategoriaFinanceira[]>({ queryKey: ['fin-categorias'], queryFn: financeiroApi.listarCategorias })

  const nomeCat = (id: string | null) => id ? (categorias.find((c) => c.id === id)?.nome ?? 'Categoria') : 'Sem categoria'
  const receitas = linhas.filter((l) => l.tipo === 'RECEITA')
  const despesas = linhas.filter((l) => l.tipo === 'DESPESA')
  const totalRec = receitas.reduce((a, l) => a + l.total, 0)
  const totalDesp = despesas.reduce((a, l) => a + l.total, 0)

  return (
    <Stack pos="relative">
      <LoadingOverlay visible={isLoading} />
      <Title order={3}>DRE Gerencial</Title>
      <Card withBorder padding="sm">
        <Group>
          <DateInput label="De" value={de} onChange={setDe} valueFormat="DD/MM/YYYY" />
          <DateInput label="Até" value={ate} onChange={setAte} valueFormat="DD/MM/YYYY" />
        </Group>
      </Card>
      <SimpleGrid cols={{ base: 1, sm: 3 }}>
        <Card withBorder padding="md"><Text size="xs" c="dimmed">Receitas</Text><Text fw={700} c="green">{formatarBRL(totalRec)}</Text></Card>
        <Card withBorder padding="md"><Text size="xs" c="dimmed">Despesas</Text><Text fw={700} c="red">{formatarBRL(totalDesp)}</Text></Card>
        <Card withBorder padding="md"><Text size="xs" c="dimmed">Resultado</Text><Text fw={700} c={totalRec - totalDesp >= 0 ? 'green' : 'red'}>{formatarBRL(totalRec - totalDesp)}</Text></Card>
      </SimpleGrid>
      <SimpleGrid cols={{ base: 1, lg: 2 }}>
        <Card withBorder padding="sm">
          <Text fw={600} mb="sm" c="green">Receitas por categoria</Text>
          <Table><Table.Tbody>
            {receitas.map((l, i) => <Table.Tr key={i}><Table.Td>{nomeCat(l.categoriaId)}</Table.Td><Table.Td ta="right">{formatarBRL(l.total)}</Table.Td></Table.Tr>)}
            {receitas.length === 0 && <Table.Tr><Table.Td colSpan={2}><Text c="dimmed" ta="center" py="sm">Sem receitas</Text></Table.Td></Table.Tr>}
          </Table.Tbody></Table>
        </Card>
        <Card withBorder padding="sm">
          <Text fw={600} mb="sm" c="red">Despesas por categoria</Text>
          <Table><Table.Tbody>
            {despesas.map((l, i) => <Table.Tr key={i}><Table.Td>{nomeCat(l.categoriaId)}</Table.Td><Table.Td ta="right">{formatarBRL(l.total)}</Table.Td></Table.Tr>)}
            {despesas.length === 0 && <Table.Tr><Table.Td colSpan={2}><Text c="dimmed" ta="center" py="sm">Sem despesas</Text></Table.Td></Table.Tr>}
          </Table.Tbody></Table>
        </Card>
      </SimpleGrid>
    </Stack>
  )
}
