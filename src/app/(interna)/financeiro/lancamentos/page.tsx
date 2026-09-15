'use client'

import { useEffect, useState } from 'react'
import { Button, Card, Group, Text, TextInput, NumberInput, Select, Table, Badge, Title, Stack, LoadingOverlay, Modal, ActionIcon, Tooltip } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { IconPlus, IconArrowBackUp } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { modals } from '@mantine/modals'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { financeiroApi, type ContaFinanceira, type CategoriaFinanceira } from '@/hooks/financeiro/useFinanceiroApi'
import { formatarBRL, formatarData } from '@/lib/financeiro/format'

export default function LancamentosPage() {
  useModuloGuard('FINANCEIRO')
  useEffect(() => { document.title = 'Vizor - Financeiro - Lançamentos de Caixa' }, [])
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [contaId, setContaId] = useState<string | null>(null)
  const [tipo, setTipo] = useState<string | null>('ENTRADA')
  const [valor, setValor] = useState<number | string>(0)
  const [data, setData] = useState<Date | null>(new Date())
  const [descricao, setDescricao] = useState('')
  const [categoriaId, setCategoriaId] = useState<string | null>(null)

  const { data: contas = [] } = useQuery<ContaFinanceira[]>({ queryKey: ['fin-contas'], queryFn: financeiroApi.listarContas })
  const { data: categorias = [] } = useQuery<CategoriaFinanceira[]>({ queryKey: ['fin-categorias'], queryFn: financeiroApi.listarCategorias })
  const { data: lancs = [], isLoading } = useQuery<any[]>({ queryKey: ['fin-lancamentos'], queryFn: () => financeiroApi.listarLancamentos() })

  const criar = useMutation({
    mutationFn: () => financeiroApi.criarLancamento({ contaFinanceiraId: contaId, tipo, valor: Number(valor), data: (data ?? new Date()).toISOString(), descricao, categoriaId: categoriaId || undefined }),
    onSuccess: () => { notifications.show({ color: 'green', message: 'Lançamento criado' }); setModal(false); setValor(0); setDescricao(''); qc.invalidateQueries({ queryKey: ['fin-lancamentos'] }); qc.invalidateQueries({ queryKey: ['fin-contas'] }) },
    onError: (e: any) => notifications.show({ color: 'red', message: e?.response?.data?.message ?? 'Erro' }),
  })
  const estornar = useMutation({
    mutationFn: (id: string) => financeiroApi.estornarLancamento(id),
    onSuccess: () => { notifications.show({ color: 'green', message: 'Estornado' }); qc.invalidateQueries({ queryKey: ['fin-lancamentos'] }); qc.invalidateQueries({ queryKey: ['fin-contas'] }) },
    onError: (e: any) => notifications.show({ color: 'red', message: e?.response?.data?.message ?? 'Erro' }),
  })

  const nomeConta = (id: string) => contas.find((c) => c.id === id)?.nome ?? '—'

  return (
    <Stack pos="relative">
      <LoadingOverlay visible={isLoading} />
      <Group justify="space-between">
        <Title order={3}>Lançamentos de Caixa</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setModal(true)}>Novo lançamento</Button>
      </Group>
      <Card withBorder padding="sm">
        <Table striped highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th>Data</Table.Th><Table.Th>Conta</Table.Th><Table.Th>Descrição</Table.Th><Table.Th>Tipo</Table.Th><Table.Th ta="right">Valor</Table.Th><Table.Th /></Table.Tr></Table.Thead>
          <Table.Tbody>
            {lancs.map((l) => (
              <Table.Tr key={l.id} opacity={l.estornado ? 0.5 : 1}>
                <Table.Td>{formatarData(l.data)}</Table.Td>
                <Table.Td>{nomeConta(l.contaFinanceiraId)}</Table.Td>
                <Table.Td>{l.descricao}</Table.Td>
                <Table.Td><Badge variant="light" color={l.tipo === 'ENTRADA' ? 'green' : 'red'}>{l.tipo}</Badge></Table.Td>
                <Table.Td ta="right">{formatarBRL(Number(l.valor))}</Table.Td>
                <Table.Td>{!l.estornado && <Tooltip label="Estornar"><ActionIcon variant="subtle" color="orange" onClick={() => modals.openConfirmModal({ title: 'Estornar', children: <Text size="sm">Estornar este lançamento?</Text>, labels: { confirm: 'Estornar', cancel: 'Cancelar' }, confirmProps: { color: 'orange' }, onConfirm: () => estornar.mutate(l.id) })}><IconArrowBackUp size={16} /></ActionIcon></Tooltip>}{l.estornado && <Badge color="gray" variant="light">Estornado</Badge>}</Table.Td>
              </Table.Tr>
            ))}
            {lancs.length === 0 && !isLoading && <Table.Tr><Table.Td colSpan={6}><Text c="dimmed" ta="center" py="md">Nenhum lançamento</Text></Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>
      </Card>
      <Modal opened={modal} onClose={() => setModal(false)} title="Novo lançamento de caixa">
        <Stack>
          <Select label="Conta" data={contas.filter((c) => c.status).map((c) => ({ value: c.id, label: c.nome }))} value={contaId} onChange={setContaId} searchable required />
          <Select label="Tipo" data={[{ value: 'ENTRADA', label: 'Entrada' }, { value: 'SAIDA', label: 'Saída' }]} value={tipo} onChange={setTipo} />
          <NumberInput label="Valor" value={valor} onChange={setValor} decimalScale={2} thousandSeparator="." decimalSeparator="," />
          <DateInput label="Data" value={data} onChange={setData} valueFormat="DD/MM/YYYY" />
          <TextInput label="Descrição" value={descricao} onChange={(e) => setDescricao(e.currentTarget.value)} required />
          <Select label="Categoria (opcional)" data={categorias.filter((c) => c.status).map((c) => ({ value: c.id, label: `${c.codigo} - ${c.nome}` }))} value={categoriaId} onChange={setCategoriaId} searchable clearable />
          <Button loading={criar.isPending} disabled={!contaId || !descricao || Number(valor) <= 0} onClick={() => criar.mutate()}>Salvar</Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
