'use client'

import { useState } from 'react'
import { Button, Card, Group, Text, Table, Stack, LoadingOverlay, Badge, Alert } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { IconRefresh } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatarBRL } from '@/lib/financeiro/format'

function isoDia(d: Date | null): string | undefined {
  if (!d) return undefined
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function BalanceteTab() {
  const [inicio, setInicio] = useState<Date | null>(null)
  const [fim, setFim] = useState<Date | null>(null)

  const { data, isLoading, refetch, isFetching } = useQuery<any>({
    queryKey: ['contabil-balancete'],
    queryFn: () => api.get('/financeiro/contabil/balancete', { params: { inicio: isoDia(inicio), fim: isoDia(fim) } }).then((r) => r.data),
  })

  const contas: any[] = data?.contas ?? []

  return (
    <Stack pos="relative">
      <LoadingOverlay visible={isLoading} />
      <Group justify="space-between" align="flex-end">
        <Group align="flex-end">
          <DateInput label="Início" value={inicio} onChange={setInicio} valueFormat="DD/MM/YYYY" clearable />
          <DateInput label="Fim" value={fim} onChange={setFim} valueFormat="DD/MM/YYYY" clearable />
          <Button variant="light" leftSection={<IconRefresh size={16} />} loading={isFetching} onClick={() => refetch()}>Atualizar</Button>
        </Group>
        {data && (
          <Badge size="lg" variant="light" color={data.fecha ? 'green' : 'red'}>{data.fecha ? 'Balancete fecha ✓' : 'Não fecha'}</Badge>
        )}
      </Group>

      <Card withBorder padding="sm">
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Código</Table.Th>
              <Table.Th>Conta</Table.Th>
              <Table.Th ta="right">Débitos</Table.Th>
              <Table.Th ta="right">Créditos</Table.Th>
              <Table.Th ta="right">Saldo</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {contas.map((c, i) => (
              <Table.Tr key={i}>
                <Table.Td ff="monospace">{c.codigo}</Table.Td>
                <Table.Td>{c.nome}</Table.Td>
                <Table.Td ta="right">{formatarBRL(Number(c.debito))}</Table.Td>
                <Table.Td ta="right">{formatarBRL(Number(c.credito))}</Table.Td>
                <Table.Td ta="right" fw={600}>{formatarBRL(Number(c.saldo))}</Table.Td>
              </Table.Tr>
            ))}
            {contas.length === 0 && !isLoading && (
              <Table.Tr><Table.Td colSpan={5}><Text c="dimmed" ta="center" py="md">Sem movimento contábil no período.</Text></Table.Td></Table.Tr>
            )}
          </Table.Tbody>
          {contas.length > 0 && (
            <Table.Tfoot>
              <Table.Tr>
                <Table.Td colSpan={2} fw={700}>Total</Table.Td>
                <Table.Td ta="right" fw={700}>{formatarBRL(Number(data?.totalDebito))}</Table.Td>
                <Table.Td ta="right" fw={700}>{formatarBRL(Number(data?.totalCredito))}</Table.Td>
                <Table.Td />
              </Table.Tr>
            </Table.Tfoot>
          )}
        </Table>
      </Card>
    </Stack>
  )
}
