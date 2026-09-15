'use client'

import { useEffect, useState } from 'react'
import { Card, Group, Text, Select, Table, Title, Stack, LoadingOverlay, Badge } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { useQuery } from '@tanstack/react-query'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { financeiroApi, type ContaFinanceira } from '@/hooks/financeiro/useFinanceiroApi'
import { formatarBRL, formatarData } from '@/lib/financeiro/format'

export default function ExtratoPage() {
  useModuloGuard('FINANCEIRO')
  useEffect(() => { document.title = 'Vizor - Financeiro - Extrato' }, [])
  const hoje = new Date()
  const [contaId, setContaId] = useState<string | null>(null)
  const [de, setDe] = useState<Date | null>(new Date(hoje.getFullYear(), hoje.getMonth(), 1))
  const [ate, setAte] = useState<Date | null>(new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0))

  const { data: contas = [] } = useQuery<ContaFinanceira[]>({ queryKey: ['fin-contas'], queryFn: financeiroApi.listarContas })
  const { data: extrato, isLoading } = useQuery({
    queryKey: ['fin-extrato', contaId, de, ate],
    queryFn: () => financeiroApi.extrato(contaId!, (de ?? new Date()).toISOString(), (ate ?? new Date()).toISOString()),
    enabled: Boolean(contaId),
  })

  return (
    <Stack pos="relative">
      <LoadingOverlay visible={isLoading} />
      <Title order={3}>Extrato de Conta</Title>
      <Card withBorder padding="sm">
        <Group>
          <Select label="Conta" data={contas.map((c) => ({ value: c.id, label: c.nome }))} value={contaId} onChange={setContaId} searchable w={280} />
          <DateInput label="De" value={de} onChange={setDe} valueFormat="DD/MM/YYYY" />
          <DateInput label="Até" value={ate} onChange={setAte} valueFormat="DD/MM/YYYY" />
        </Group>
      </Card>
      {extrato && (
        <Card withBorder padding="sm">
          <Group justify="space-between" mb="sm">
            <Text>Saldo inicial: <b>{formatarBRL(extrato.saldoInicial)}</b></Text>
            <Text>Saldo final: <b>{formatarBRL(extrato.saldoFinal)}</b></Text>
          </Group>
          <Table striped highlightOnHover>
            <Table.Thead><Table.Tr><Table.Th>Data</Table.Th><Table.Th>Descrição</Table.Th><Table.Th>Origem</Table.Th><Table.Th ta="right">Valor</Table.Th><Table.Th ta="right">Saldo</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {extrato.linhas.map((l, i) => (
                <Table.Tr key={i}>
                  <Table.Td>{formatarData(l.data)}</Table.Td>
                  <Table.Td>{l.descricao}</Table.Td>
                  <Table.Td><Badge variant="light" size="sm">{l.origem}</Badge></Table.Td>
                  <Table.Td ta="right" c={l.tipo === 'ENTRADA' ? 'green' : 'red'}>{l.tipo === 'ENTRADA' ? '+' : '-'} {formatarBRL(l.valor)}</Table.Td>
                  <Table.Td ta="right" fw={600}>{formatarBRL(l.saldoCorrente)}</Table.Td>
                </Table.Tr>
              ))}
              {extrato.linhas.length === 0 && <Table.Tr><Table.Td colSpan={5}><Text c="dimmed" ta="center" py="md">Sem movimento no período</Text></Table.Td></Table.Tr>}
            </Table.Tbody>
          </Table>
        </Card>
      )}
      {!contaId && <Text c="dimmed">Selecione uma conta para ver o extrato</Text>}
    </Stack>
  )
}
