'use client'

import { useEffect, useState } from 'react'
import {
  Button, Card, Group, Text, TextInput, NumberInput, Select, Table, Badge, Title, Stack,
  LoadingOverlay, Modal, ActionIcon, Tooltip, Progress, Divider,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { IconPlus, IconEye } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { api } from '@/lib/api'
import { formatarBRL, formatarData } from '@/lib/financeiro/format'

const contratosApi = {
  listar: () => api.get('/financeiro/contratos').then((r) => r.data),
  criar: (body: any) => api.post('/financeiro/contratos', body).then((r) => r.data),
  detalhe: (id: string) => api.get(`/financeiro/contratos/${id}`).then((r) => r.data),
}

const TIPOS = [
  { value: 'FINANCIAMENTO', label: 'Financiamento' },
  { value: 'IMPOSTO', label: 'Imposto/Parcelamento' },
  { value: 'OUTRO', label: 'Outro' },
]

export default function ContratosPage() {
  useModuloGuard('FINANCEIRO')
  useEffect(() => { document.title = 'Vizor - Financeiro - Contratos/Parcelamentos' }, [])
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [detalheId, setDetalheId] = useState<string | null>(null)

  const [form, setForm] = useState<any>({ descricao: '', tipo: 'FINANCIAMENTO', valorTotal: '', entrada: '', numeroParcelas: 12, dataPrimeira: null as Date | null })

  const { data: contratos = [], isLoading } = useQuery<any[]>({ queryKey: ['fin-contratos'], queryFn: contratosApi.listar })
  const { data: detalhe } = useQuery<any>({ queryKey: ['fin-contrato', detalheId], queryFn: () => contratosApi.detalhe(detalheId!), enabled: Boolean(detalheId) })

  const criar = useMutation({
    mutationFn: () => contratosApi.criar({
      descricao: form.descricao, tipo: form.tipo,
      valorTotal: Number(form.valorTotal), entrada: form.entrada ? Number(form.entrada) : undefined,
      numeroParcelas: Number(form.numeroParcelas), dataPrimeira: (form.dataPrimeira ?? new Date()).toISOString(),
    }),
    onSuccess: () => { notifications.show({ color: 'green', message: 'Contrato criado com parcelas geradas' }); setModal(false); qc.invalidateQueries({ queryKey: ['fin-contratos'] }); qc.invalidateQueries({ queryKey: ['contas-pagar'] }) },
    onError: (e: any) => notifications.show({ color: 'red', message: e?.response?.data?.message ?? 'Erro' }),
  })

  const set = (k: string) => (v: any) => setForm((f: any) => ({ ...f, [k]: v?.currentTarget ? v.currentTarget.value : v }))

  return (
    <Stack pos="relative">
      <LoadingOverlay visible={isLoading} />
      <Group justify="space-between">
        <Title order={3}>Contratos / Parcelamentos</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setModal(true)}>Novo contrato</Button>
      </Group>

      <Card withBorder padding="sm">
        <Table striped highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th>Descrição</Table.Th><Table.Th>Tipo</Table.Th><Table.Th ta="right">Total</Table.Th><Table.Th ta="center">Parcelas</Table.Th><Table.Th>Status</Table.Th><Table.Th /></Table.Tr></Table.Thead>
          <Table.Tbody>
            {contratos.map((c) => (
              <Table.Tr key={c.id}>
                <Table.Td>{c.descricao}</Table.Td>
                <Table.Td><Badge variant="light">{c.tipo}</Badge></Table.Td>
                <Table.Td ta="right">{formatarBRL(c.valorTotal)}</Table.Td>
                <Table.Td ta="center">{c.numeroParcelas}</Table.Td>
                <Table.Td><Badge variant="light" color={c.status === 'ATIVO' ? 'green' : 'gray'}>{c.status}</Badge></Table.Td>
                <Table.Td><Tooltip label="Ver saldo"><ActionIcon variant="subtle" onClick={() => setDetalheId(c.id)}><IconEye size={16} /></ActionIcon></Tooltip></Table.Td>
              </Table.Tr>
            ))}
            {contratos.length === 0 && !isLoading && <Table.Tr><Table.Td colSpan={6}><Text c="dimmed" ta="center" py="md">Nenhum contrato. Use para financiamentos e parcelamentos de impostos.</Text></Table.Td></Table.Tr>}
          </Table.Tbody>
        </Table>
      </Card>

      {/* Criar */}
      <Modal opened={modal} onClose={() => setModal(false)} title="Novo contrato de parcelamento" size="lg">
        <Stack>
          <TextInput label="Descrição" placeholder="Financiamento veículo / Parcelamento DAS" value={form.descricao} onChange={set('descricao')} required />
          <Select label="Tipo" data={TIPOS} value={form.tipo} onChange={(v) => setForm((f: any) => ({ ...f, tipo: v }))} />
          <Group grow>
            <NumberInput label="Valor total" value={form.valorTotal} onChange={set('valorTotal')} decimalScale={2} thousandSeparator="." decimalSeparator="," min={0} />
            <NumberInput label="Entrada (opcional)" value={form.entrada} onChange={set('entrada')} decimalScale={2} thousandSeparator="." decimalSeparator="," min={0} />
          </Group>
          <Group grow>
            <NumberInput label="Nº de parcelas" value={form.numeroParcelas} onChange={set('numeroParcelas')} min={1} max={360} />
            <DateInput label="1ª parcela" value={form.dataPrimeira} onChange={(v) => setForm((f: any) => ({ ...f, dataPrimeira: v }))} valueFormat="DD/MM/YYYY" />
          </Group>
          <Button loading={criar.isPending} disabled={!form.descricao || Number(form.valorTotal) <= 0 || !form.dataPrimeira} onClick={() => criar.mutate()}>Criar e gerar parcelas</Button>
        </Stack>
      </Modal>

      {/* Detalhe / saldo */}
      <Modal opened={Boolean(detalheId)} onClose={() => setDetalheId(null)} title="Saldo do contrato" size="lg">
        {detalhe && (
          <Stack>
            <Text fw={600}>{detalhe.contrato.descricao}</Text>
            <Group grow>
              <Card withBorder padding="xs"><Text size="xs" c="dimmed">Total</Text><Text fw={700}>{formatarBRL(detalhe.contrato.valorTotal)}</Text></Card>
              <Card withBorder padding="xs"><Text size="xs" c="dimmed">Pago</Text><Text fw={700} c="green">{formatarBRL(detalhe.totalPago)}</Text></Card>
              <Card withBorder padding="xs"><Text size="xs" c="dimmed">Saldo devedor</Text><Text fw={700} c="red">{formatarBRL(detalhe.saldoDevedor)}</Text></Card>
            </Group>
            <Progress value={detalhe.contrato.valorTotal > 0 ? (detalhe.totalPago / detalhe.contrato.valorTotal) * 100 : 0} color="green" />
            <Divider label="Parcelas" />
            <Table>
              <Table.Thead><Table.Tr><Table.Th>Parcela</Table.Th><Table.Th ta="right">Valor</Table.Th><Table.Th>Vencimento</Table.Th><Table.Th>Status</Table.Th></Table.Tr></Table.Thead>
              <Table.Tbody>
                {detalhe.parcelas.map((p: any) => (
                  <Table.Tr key={p.id}>
                    <Table.Td>{p.parcela}/{p.totalParcelas}</Table.Td>
                    <Table.Td ta="right">{formatarBRL(p.valor)}</Table.Td>
                    <Table.Td>{formatarData(p.dataVencimento)}</Table.Td>
                    <Table.Td><Badge variant="light" color={p.status === 'PAGA' ? 'green' : p.status === 'CANCELADA' ? 'gray' : 'blue'}>{p.status}</Badge></Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Stack>
        )}
      </Modal>
    </Stack>
  )
}
