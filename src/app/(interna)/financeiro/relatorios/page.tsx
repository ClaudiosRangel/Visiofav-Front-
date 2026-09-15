'use client'

import { useEffect, useState } from 'react'
import { Button, Card, Group, Text, Table, Title, Stack, LoadingOverlay, Tabs, Badge } from '@mantine/core'
import { IconDownload } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { financeiroApi, paraCsv } from '@/hooks/financeiro/useFinanceiroApi'
import { formatarBRL, formatarData } from '@/lib/financeiro/format'

function baixarCsv(nome: string, conteudo: string) {
  const blob = new Blob(['\ufeff' + conteudo], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = nome; a.click()
  URL.revokeObjectURL(url)
}

export default function RelatoriosPage() {
  useModuloGuard('FINANCEIRO')
  useEffect(() => { document.title = 'Vizor - Financeiro - Relatórios' }, [])

  const { data: inadimplentes = [], isLoading } = useQuery<any[]>({ queryKey: ['fin-inadimplencia'], queryFn: financeiroApi.inadimplencia })

  function exportarInadimplencia() {
    const rows = inadimplentes.flatMap((c) => c.titulos.map((t: any) => ({ cliente: c.nome, descricao: t.descricao, valor: t.valor, vencimento: formatarData(t.dataVencimento), diasAtraso: t.diasAtraso })))
    baixarCsv('inadimplencia.csv', paraCsv(rows, [
      { key: 'cliente', label: 'Cliente' }, { key: 'descricao', label: 'Descrição' },
      { key: 'valor', label: 'Valor' }, { key: 'vencimento', label: 'Vencimento' }, { key: 'diasAtraso', label: 'Dias em atraso' },
    ]))
  }

  return (
    <Stack pos="relative">
      <LoadingOverlay visible={isLoading} />
      <Title order={3}>Relatórios Financeiros</Title>
      <Tabs defaultValue="inadimplencia">
        <Tabs.List>
          <Tabs.Tab value="inadimplencia">Inadimplência</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="inadimplencia" pt="md">
          <Group justify="flex-end" mb="sm">
            <Button variant="light" leftSection={<IconDownload size={16} />} onClick={exportarInadimplencia} disabled={inadimplentes.length === 0}>Exportar CSV</Button>
          </Group>
          <Card withBorder padding="sm">
            <Table striped highlightOnHover>
              <Table.Thead><Table.Tr><Table.Th>Cliente</Table.Th><Table.Th ta="center">Títulos</Table.Th><Table.Th ta="right">Total vencido</Table.Th><Table.Th ta="center">Máx. atraso</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>
                {inadimplentes.map((c, i) => (
                  <Table.Tr key={i}>
                    <Table.Td>{c.nome}</Table.Td>
                    <Table.Td ta="center">{c.titulos.length}</Table.Td>
                    <Table.Td ta="right" c="red" fw={600}>{formatarBRL(c.totalVencido)}</Table.Td>
                    <Table.Td ta="center"><Badge color="red" variant="light">{c.diasAtrasoMax} dias</Badge></Table.Td>
                  </Table.Tr>
                ))}
                {inadimplentes.length === 0 && !isLoading && <Table.Tr><Table.Td colSpan={4}><Text c="dimmed" ta="center" py="md">Sem inadimplência 🎉</Text></Table.Td></Table.Tr>}
              </Table.Tbody>
            </Table>
          </Card>
        </Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
