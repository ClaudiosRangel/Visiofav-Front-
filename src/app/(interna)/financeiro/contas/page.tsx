'use client'

import { useEffect, useState } from 'react'
import {
  Button, Card, Group, Text, TextInput, NumberInput, Select, Table, Badge,
  ActionIcon, Tooltip, Modal, LoadingOverlay, Title, Stack,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { IconPlus, IconRefresh, IconArrowsExchange, IconBan } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { modals } from '@mantine/modals'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { financeiroApi, type ContaFinanceira } from '@/hooks/financeiro/useFinanceiroApi'
import { formatarBRL, TIPO_CONTA_LABELS } from '@/lib/financeiro/format'

const TIPOS = [
  { value: 'CAIXA', label: 'Caixa' },
  { value: 'BANCO', label: 'Banco' },
  { value: 'APLICACAO', label: 'Aplicação' },
]

export default function ContasFinanceirasPage() {
  useModuloGuard('FINANCEIRO')
  useEffect(() => { document.title = 'Vizor - Financeiro - Contas' }, [])
  const qc = useQueryClient()

  const [criarModal, setCriarModal] = useState(false)
  const [transfModal, setTransfModal] = useState(false)

  // form criar
  const [tipo, setTipo] = useState<string | null>('BANCO')
  const [nome, setNome] = useState('')
  const [banco, setBanco] = useState('')
  const [saldoInicial, setSaldoInicial] = useState<number | string>(0)

  // form transferência
  const [origem, setOrigem] = useState<string | null>(null)
  const [destino, setDestino] = useState<string | null>(null)
  const [valor, setValor] = useState<number | string>(0)
  const [dataTransf, setDataTransf] = useState<Date | null>(new Date())

  const { data: contas = [], isLoading, refetch } = useQuery<ContaFinanceira[]>({
    queryKey: ['fin-contas'],
    queryFn: financeiroApi.listarContas,
  })

  const criar = useMutation({
    mutationFn: () => financeiroApi.criarConta({ tipo: tipo as any, nome, banco: banco || undefined, saldoInicial: Number(saldoInicial) }),
    onSuccess: () => {
      notifications.show({ color: 'green', message: 'Conta criada' })
      setCriarModal(false); setNome(''); setBanco(''); setSaldoInicial(0)
      qc.invalidateQueries({ queryKey: ['fin-contas'] })
    },
    onError: (e: any) => notifications.show({ color: 'red', message: e?.response?.data?.message ?? 'Erro ao criar conta' }),
  })

  const transferir = useMutation({
    mutationFn: () => financeiroApi.transferir({ contaOrigemId: origem!, contaDestinoId: destino!, valor: Number(valor), data: (dataTransf ?? new Date()).toISOString() }),
    onSuccess: () => {
      notifications.show({ color: 'green', message: 'Transferência registrada' })
      setTransfModal(false); setOrigem(null); setDestino(null); setValor(0)
      qc.invalidateQueries({ queryKey: ['fin-contas'] })
    },
    onError: (e: any) => notifications.show({ color: 'red', message: e?.response?.data?.message ?? 'Erro na transferência' }),
  })

  const inativar = useMutation({
    mutationFn: (id: string) => financeiroApi.inativarConta(id),
    onSuccess: () => { notifications.show({ color: 'green', message: 'Conta inativada' }); qc.invalidateQueries({ queryKey: ['fin-contas'] }) },
    onError: (e: any) => notifications.show({ color: 'red', message: e?.response?.data?.message ?? 'Erro ao inativar' }),
  })

  const opcoesContas = contas.filter((c) => c.status).map((c) => ({ value: c.id, label: c.nome }))

  return (
    <Stack pos="relative">
      <LoadingOverlay visible={isLoading} />
      <Group justify="space-between">
        <Title order={3}>Contas Financeiras</Title>
        <Group>
          <Button variant="light" leftSection={<IconArrowsExchange size={16} />} onClick={() => setTransfModal(true)}>Transferir</Button>
          <Button leftSection={<IconPlus size={16} />} onClick={() => setCriarModal(true)}>Nova conta</Button>
          <Tooltip label="Atualizar"><ActionIcon variant="light" onClick={() => refetch()}><IconRefresh size={16} /></ActionIcon></Tooltip>
        </Group>
      </Group>

      <Card withBorder padding="sm">
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Nome</Table.Th><Table.Th>Tipo</Table.Th><Table.Th>Banco</Table.Th>
              <Table.Th ta="right">Saldo atual</Table.Th><Table.Th>Status</Table.Th><Table.Th />
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {contas.map((c) => (
              <Table.Tr key={c.id}>
                <Table.Td>{c.nome}</Table.Td>
                <Table.Td>{TIPO_CONTA_LABELS[c.tipo] ?? c.tipo}</Table.Td>
                <Table.Td>{c.banco ?? '—'}</Table.Td>
                <Table.Td ta="right">{formatarBRL(c.saldoAtual)}</Table.Td>
                <Table.Td><Badge variant="light" color={c.status ? 'green' : 'gray'}>{c.status ? 'Ativa' : 'Inativa'}</Badge></Table.Td>
                <Table.Td>
                  {c.status && (
                    <Tooltip label="Inativar">
                      <ActionIcon variant="subtle" color="red" onClick={() => modals.openConfirmModal({
                        title: 'Inativar conta', children: <Text size="sm">Confirmar inativação de "{c.nome}"?</Text>,
                        labels: { confirm: 'Inativar', cancel: 'Cancelar' }, confirmProps: { color: 'red' },
                        onConfirm: () => inativar.mutate(c.id),
                      })}><IconBan size={16} /></ActionIcon>
                    </Tooltip>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
            {contas.length === 0 && !isLoading && (
              <Table.Tr><Table.Td colSpan={6}><Text c="dimmed" ta="center" py="md">Nenhuma conta cadastrada</Text></Table.Td></Table.Tr>
            )}
          </Table.Tbody>
        </Table>
      </Card>

      <Modal opened={criarModal} onClose={() => setCriarModal(false)} title="Nova conta financeira">
        <Stack>
          <Select label="Tipo" data={TIPOS} value={tipo} onChange={setTipo} />
          <TextInput label="Nome" value={nome} onChange={(e) => setNome(e.currentTarget.value)} required />
          <TextInput label="Banco" value={banco} onChange={(e) => setBanco(e.currentTarget.value)} />
          <NumberInput label="Saldo inicial" value={saldoInicial} onChange={setSaldoInicial} decimalScale={2} thousandSeparator="." decimalSeparator="," />
          <Button loading={criar.isPending} disabled={!nome} onClick={() => criar.mutate()}>Salvar</Button>
        </Stack>
      </Modal>

      <Modal opened={transfModal} onClose={() => setTransfModal(false)} title="Transferência entre contas">
        <Stack>
          <Select label="Origem" data={opcoesContas} value={origem} onChange={setOrigem} searchable />
          <Select label="Destino" data={opcoesContas} value={destino} onChange={setDestino} searchable />
          <NumberInput label="Valor" value={valor} onChange={setValor} decimalScale={2} thousandSeparator="." decimalSeparator="," />
          <DateInput label="Data" value={dataTransf} onChange={setDataTransf} valueFormat="DD/MM/YYYY" />
          <Button loading={transferir.isPending} disabled={!origem || !destino || origem === destino || Number(valor) <= 0} onClick={() => transferir.mutate()}>Transferir</Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
