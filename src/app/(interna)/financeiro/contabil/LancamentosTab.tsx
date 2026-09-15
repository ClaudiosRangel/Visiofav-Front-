'use client'

import { useMemo, useState } from 'react'
import {
  Button, Card, Group, Text, TextInput, Select, NumberInput, Table, Stack, Modal,
  LoadingOverlay, ActionIcon, Divider, Badge, Alert,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { IconPlus, IconTrash, IconAlertTriangle } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatarBRL, formatarData } from '@/lib/financeiro/format'

const contabilApi = {
  contas: () => api.get('/financeiro/contabil/contas').then((r) => r.data),
  listar: () => api.get('/financeiro/contabil/lancamentos').then((r) => r.data),
  criar: (body: any) => api.post('/financeiro/contabil/lancamentos', body).then((r) => r.data),
}

interface PartidaForm { contaId: string | null; tipo: 'DEBITO' | 'CREDITO'; valor: number | '' }

export function LancamentosTab() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(false)
  const [data, setData] = useState<Date | null>(new Date())
  const [historico, setHistorico] = useState('')
  const [partidas, setPartidas] = useState<PartidaForm[]>([
    { contaId: null, tipo: 'DEBITO', valor: '' },
    { contaId: null, tipo: 'CREDITO', valor: '' },
  ])

  const { data: contas = [] } = useQuery<any[]>({ queryKey: ['contabil-contas'], queryFn: contabilApi.contas })
  const { data: lancamentos = [], isLoading } = useQuery<any[]>({ queryKey: ['contabil-lancamentos'], queryFn: contabilApi.listar })

  const contasAnaliticas = contas.filter((c) => c.analitica)

  const totais = useMemo(() => {
    let d = 0, c = 0
    for (const p of partidas) {
      const v = Number(p.valor) || 0
      if (p.tipo === 'DEBITO') d += v; else c += v
    }
    return { debito: Math.round(d * 100) / 100, credito: Math.round(c * 100) / 100, balanceado: Math.abs(d - c) <= 0.01 && d > 0 }
  }, [partidas])

  const criar = useMutation({
    mutationFn: () => contabilApi.criar({
      data: (data ?? new Date()).toISOString(),
      historico,
      partidas: partidas.map((p) => ({ contaId: p.contaId, tipo: p.tipo, valor: Number(p.valor) || 0 })),
    }),
    onSuccess: () => {
      notifications.show({ color: 'green', message: 'Lançamento registrado' })
      setModal(false); setHistorico(''); setData(new Date())
      setPartidas([{ contaId: null, tipo: 'DEBITO', valor: '' }, { contaId: null, tipo: 'CREDITO', valor: '' }])
      qc.invalidateQueries({ queryKey: ['contabil-lancamentos'] })
    },
    onError: (e: any) => notifications.show({ color: 'red', message: e?.response?.data?.message ?? 'Erro' }),
  })

  const setPartida = (i: number, patch: Partial<PartidaForm>) =>
    setPartidas((ps) => ps.map((p, idx) => (idx === i ? { ...p, ...patch } : p)))

  const todasComConta = partidas.every((p) => p.contaId && Number(p.valor) > 0)
  const podeConfirmar = totais.balanceado && todasComConta && historico.trim().length > 0

  return (
    <Stack pos="relative">
      <LoadingOverlay visible={isLoading} />
      <Group justify="space-between">
        <Text fw={600}>Lançamentos Contábeis</Text>
        <Button leftSection={<IconPlus size={16} />} onClick={() => setModal(true)} disabled={contasAnaliticas.length < 2}>Novo lançamento</Button>
      </Group>
      {contasAnaliticas.length < 2 && <Alert color="yellow" variant="light">Cadastre ao menos 2 contas analíticas no Plano de Contas para lançar.</Alert>}

      <Card withBorder padding="sm">
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Data</Table.Th>
              <Table.Th>Histórico</Table.Th>
              <Table.Th>Origem</Table.Th>
              <Table.Th>Partidas</Table.Th>
              <Table.Th>Status</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {lancamentos.map((l) => (
              <Table.Tr key={l.id}>
                <Table.Td>{formatarData(l.data)}</Table.Td>
                <Table.Td>{l.historico}</Table.Td>
                <Table.Td><Badge variant="light" size="sm">{l.origem}</Badge></Table.Td>
                <Table.Td>
                  {(l.partidas ?? []).map((p: any) => (
                    <Text key={p.id} size="xs" ff="monospace">{p.tipo === 'DEBITO' ? 'D' : 'C'} {p.conta?.codigo} {formatarBRL(Number(p.valor))}</Text>
                  ))}
                </Table.Td>
                <Table.Td><Badge variant="light" color={l.status === 'LANCADO' ? 'green' : 'orange'}>{l.status}</Badge></Table.Td>
              </Table.Tr>
            ))}
            {lancamentos.length === 0 && !isLoading && (
              <Table.Tr><Table.Td colSpan={5}><Text c="dimmed" ta="center" py="md">Nenhum lançamento. Os pagamentos/recebimentos com de/para configurado geram lançamentos automaticamente; você também pode lançar manualmente.</Text></Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      <Modal opened={modal} onClose={() => setModal(false)} title="Novo lançamento contábil" size="lg">
        <Stack>
          <Group grow>
            <DateInput label="Data" value={data} onChange={setData} valueFormat="DD/MM/YYYY" />
            <TextInput label="Histórico" placeholder="Ex.: Integralização de capital" value={historico} onChange={(e) => setHistorico(e.currentTarget.value)} />
          </Group>

          <Divider label="Partidas (débitos e créditos)" />
          {partidas.map((p, i) => (
            <Group key={i} grow align="flex-end">
              <Select label={i === 0 ? 'Conta' : undefined} placeholder="Conta analítica" data={contasAnaliticas.map((c) => ({ value: c.id, label: `${c.codigo} — ${c.nome}` }))} value={p.contaId} onChange={(v) => setPartida(i, { contaId: v })} searchable />
              <Select label={i === 0 ? 'Tipo' : undefined} data={[{ value: 'DEBITO', label: 'Débito' }, { value: 'CREDITO', label: 'Crédito' }]} value={p.tipo} onChange={(v) => setPartida(i, { tipo: v as any })} />
              <NumberInput label={i === 0 ? 'Valor' : undefined} value={p.valor} onChange={(v) => setPartida(i, { valor: v as number })} decimalScale={2} thousandSeparator="." decimalSeparator="," min={0} prefix="R$ " />
              <ActionIcon color="red" variant="subtle" disabled={partidas.length <= 2} onClick={() => setPartidas((ps) => ps.filter((_, idx) => idx !== i))}><IconTrash size={16} /></ActionIcon>
            </Group>
          ))}
          <Button variant="light" size="xs" leftSection={<IconPlus size={14} />} onClick={() => setPartidas((ps) => [...ps, { contaId: null, tipo: 'DEBITO', valor: '' }])}>Adicionar partida</Button>

          <Card withBorder padding="sm" bg={totais.balanceado ? 'var(--mantine-color-green-light)' : 'var(--mantine-color-red-light)'}>
            <Group justify="space-between"><Text size="sm">Débitos</Text><Text size="sm">{formatarBRL(totais.debito)}</Text></Group>
            <Group justify="space-between"><Text size="sm">Créditos</Text><Text size="sm">{formatarBRL(totais.credito)}</Text></Group>
            <Group justify="space-between"><Text fw={700}>{totais.balanceado ? 'Lançamento fecha ✓' : 'Não fecha'}</Text></Group>
          </Card>
          {!totais.balanceado && Number(totais.debito) > 0 && (
            <Alert color="red" variant="light" icon={<IconAlertTriangle size={16} />}>A soma dos débitos deve ser igual à dos créditos.</Alert>
          )}

          <Button color="green" loading={criar.isPending} disabled={!podeConfirmar} onClick={() => criar.mutate()}>Registrar lançamento</Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
