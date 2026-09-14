'use client'

import { useEffect, useState } from 'react'
import { Button, Card, Group, Text, Select, Table, Title, Stack, LoadingOverlay, FileButton, Badge } from '@mantine/core'
import { IconUpload, IconLink } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { financeiroApi, type ContaFinanceira } from '@/hooks/financeiro/useFinanceiroApi'

export default function ConciliacaoPage() {
  useModuloGuard('FINANCEIRO')
  useEffect(() => { document.title = 'Vizor - Financeiro - Conciliação' }, [])
  const qc = useQueryClient()
  const [contaId, setContaId] = useState<string | null>(null)

  const { data: contas = [] } = useQuery<ContaFinanceira[]>({ queryKey: ['fin-contas'], queryFn: financeiroApi.listarContas })

  const { data: sugestoes = [], isLoading, refetch } = useQuery<any[]>({
    queryKey: ['fin-conciliacao-sugestoes', contaId],
    queryFn: () => financeiroApi.sugestoesConciliacao(contaId!),
    enabled: Boolean(contaId),
  })

  const importar = useMutation({
    mutationFn: async (file: File) => {
      const conteudo = await file.text()
      return financeiroApi.importarOfx(contaId!, conteudo)
    },
    onSuccess: (r: any) => {
      notifications.show({ color: 'green', message: `OFX importado: ${r.importadas} nova(s), ${r.ignoradas} já existia(m)` })
      refetch()
    },
    onError: (e: any) => notifications.show({ color: 'red', message: e?.response?.data?.message ?? 'Erro ao importar OFX' }),
  })

  const conciliar = useMutation({
    mutationFn: (s: any) => financeiroApi.conciliar(s.linhaId, s.tituloId, s.tipo),
    onSuccess: () => { notifications.show({ color: 'green', message: 'Conciliado' }); refetch(); qc.invalidateQueries({ queryKey: ['fin-contas'] }) },
    onError: (e: any) => notifications.show({ color: 'red', message: e?.response?.data?.message ?? 'Erro ao conciliar' }),
  })

  const opcoes = contas.filter((c) => c.status).map((c) => ({ value: c.id, label: c.nome }))

  return (
    <Stack pos="relative">
      <LoadingOverlay visible={isLoading} />
      <Title order={3}>Conciliação Bancária</Title>

      <Card withBorder padding="sm">
        <Group align="end">
          <Select label="Conta" data={opcoes} value={contaId} onChange={setContaId} searchable w={280} />
          <FileButton onChange={(f) => f && importar.mutate(f)} accept=".ofx,text/plain">
            {(props) => <Button {...props} leftSection={<IconUpload size={16} />} disabled={!contaId} loading={importar.isPending}>Importar OFX</Button>}
          </FileButton>
        </Group>
      </Card>

      <Card withBorder padding="sm">
        <Text fw={600} mb="sm">Sugestões de conciliação</Text>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr><Table.Th>Linha</Table.Th><Table.Th>Título</Table.Th><Table.Th>Tipo</Table.Th><Table.Th /></Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sugestoes.map((s, i) => (
              <Table.Tr key={i}>
                <Table.Td>{s.linhaId?.slice(0, 8)}</Table.Td>
                <Table.Td>{s.tituloId?.slice(0, 8)}</Table.Td>
                <Table.Td><Badge variant="light" color={s.tipo === 'RECEBER' ? 'green' : 'orange'}>{s.tipo}</Badge></Table.Td>
                <Table.Td>
                  <Button size="xs" variant="light" leftSection={<IconLink size={14} />} loading={conciliar.isPending} onClick={() => conciliar.mutate(s)}>Conciliar</Button>
                </Table.Td>
              </Table.Tr>
            ))}
            {sugestoes.length === 0 && !isLoading && (
              <Table.Tr><Table.Td colSpan={4}><Text c="dimmed" ta="center" py="md">{contaId ? 'Sem sugestões — importe um OFX' : 'Selecione uma conta'}</Text></Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>
    </Stack>
  )
}
