'use client'

import { useEffect, useState } from 'react'
import {
  Modal, Stack, Group, Card, Text, Select, Button, Table, Badge, ScrollArea, Divider,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatarBRL, formatarData } from '@/lib/financeiro/format'

const FORMAS = [
  { value: 'DINHEIRO', label: 'Dinheiro' }, { value: 'BOLETO', label: 'Boleto' },
  { value: 'PIX', label: 'PIX' }, { value: 'CARTAO_CREDITO', label: 'Cartão Crédito' },
  { value: 'CHEQUE', label: 'Cheque' }, { value: 'TRANSFERENCIA', label: 'Transferência' },
]

export interface TituloLote {
  id: string
  descricao: string
  valor: number
  dataVencimento: string
}

interface Props {
  tipo: 'PAGAR' | 'RECEBER'
  titulos: TituloLote[]
  opened: boolean
  onClose: () => void
  onConfirm: (payload: { formaPagamento: string; dataPagamento?: string; contaFinanceiraId?: string }) => void
  loading?: boolean
}

/** Modal de baixa em lote enriquecido: data e conta comuns + lista dos títulos e
 *  total consolidado. Cada título é liquidado pelo seu valor total. */
export function BaixaLoteModal({ tipo, titulos, opened, onClose, onConfirm, loading }: Props) {
  const ehPagar = tipo === 'PAGAR'
  const [data, setData] = useState<Date | null>(new Date())
  const [contaId, setContaId] = useState<string | null>(null)
  const [forma, setForma] = useState<string | null>('PIX')

  useEffect(() => {
    if (opened) { setData(new Date()); setContaId(null); setForma('PIX') }
  }, [opened])

  const { data: contasData } = useQuery<any[]>({
    queryKey: ['fin-contas-baixa-lote'],
    queryFn: () => api.get('/financeiro/contas').then((r) => r.data),
    enabled: opened,
  })
  const contas: any[] = Array.isArray(contasData) ? contasData : (contasData as any)?.data ?? []

  const total = titulos.reduce((s, t) => s + Number(t.valor), 0)

  const confirmar = () => {
    onConfirm({
      formaPagamento: forma || 'PIX',
      dataPagamento: (data ?? new Date()).toISOString(),
      contaFinanceiraId: contaId || undefined,
    })
  }

  return (
    <Modal opened={opened} onClose={onClose} size="55rem" title={`${ehPagar ? 'Pagar' : 'Receber'} ${titulos.length} título(s) em lote`}>
      <Stack>
        <Card withBorder padding="sm" bg="var(--mantine-color-blue-light)">
          <Group justify="space-between">
            <Text fw={600}>Total selecionado</Text>
            <Text fw={700} size="lg">{formatarBRL(total)}</Text>
          </Group>
        </Card>

        <Group grow>
          <DateInput label={ehPagar ? 'Data de pagamento' : 'Data de recebimento'} value={data} onChange={setData} valueFormat="DD/MM/YYYY" />
          <Select label="Conta origem/destino" placeholder="Selecione" data={contas.map((c) => ({ value: c.id, label: c.nome }))} value={contaId} onChange={setContaId} searchable clearable />
          <Select label="Forma de pagamento" data={FORMAS} value={forma} onChange={setForma} />
        </Group>

        <Divider label="Títulos selecionados" />
        <ScrollArea.Autosize mah={260}>
          <Table striped>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Descrição</Table.Th>
                <Table.Th>Vencimento</Table.Th>
                <Table.Th ta="right">Valor</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {titulos.map((t) => {
                const vencido = new Date(t.dataVencimento) < new Date()
                return (
                  <Table.Tr key={t.id}>
                    <Table.Td>{t.descricao}</Table.Td>
                    <Table.Td>
                      {formatarData(t.dataVencimento)}{' '}
                      {vencido && <Badge color="red" size="xs" variant="light">Vencido</Badge>}
                    </Table.Td>
                    <Table.Td ta="right">{formatarBRL(Number(t.valor))}</Table.Td>
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea.Autosize>

        <Text size="sm" c="dimmed">Cada título será liquidado pelo seu valor total. Títulos já baixados ou cancelados são ignorados.</Text>

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose}>Cancelar</Button>
          <Button color="green" loading={loading} disabled={!forma} onClick={confirmar}>Confirmar baixa em lote</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
