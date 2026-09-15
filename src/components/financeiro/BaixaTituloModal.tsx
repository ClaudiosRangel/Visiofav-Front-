'use client'

import { useMemo, useState, useEffect } from 'react'
import {
  Modal, Stack, Group, Grid, Card, Text, Select, NumberInput, Button, Divider,
  FileButton, Badge, Alert,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { IconUpload, IconAlertTriangle, IconCheck } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatarBRL } from '@/lib/financeiro/format'
import { calcularLiquidoBaixa, type TipoBaixa } from '@/lib/financeiro/baixa'

const FORMAS = [
  { value: 'DINHEIRO', label: 'Dinheiro' }, { value: 'BOLETO', label: 'Boleto' },
  { value: 'PIX', label: 'PIX' }, { value: 'CARTAO_CREDITO', label: 'Cartão Crédito' },
  { value: 'CHEQUE', label: 'Cheque' }, { value: 'TRANSFERENCIA', label: 'Transferência' },
]

export interface TituloBaixa {
  id: string
  descricao: string
  valor: number
  dataVencimento: string
}

interface Props {
  tipo: TipoBaixa
  titulo: TituloBaixa | null
  opened: boolean
  onClose: () => void
  onConfirm: (payload: any) => void
  loading?: boolean
}

/** Modal de baixa profissional: ajustes de valor, conta, data, comprovante e
 *  resumo de cálculo em tempo real. Usado por Contas a Pagar e a Receber. */
export function BaixaTituloModal({ tipo, titulo, opened, onClose, onConfirm, loading }: Props) {
  const ehPagar = tipo === 'PAGAR'
  const [data, setData] = useState<Date | null>(new Date())
  const [contaId, setContaId] = useState<string | null>(null)
  const [forma, setForma] = useState<string | null>('PIX')
  const [juros, setJuros] = useState<number | ''>('')
  const [multa, setMulta] = useState<number | ''>('')
  const [desconto, setDesconto] = useState<number | ''>('')
  const [tarifa, setTarifa] = useState<number | ''>('')
  const [comprovante, setComprovante] = useState<{ nome: string; conteudo: string } | null>(null)

  useEffect(() => {
    if (opened) {
      setData(new Date()); setContaId(null); setForma('PIX')
      setJuros(''); setMulta(''); setDesconto(''); setTarifa(''); setComprovante(null)
    }
  }, [opened, titulo?.id])

  const { data: contasData } = useQuery<any[]>({
    queryKey: ['fin-contas-baixa'],
    queryFn: () => api.get('/financeiro/contas').then((r) => r.data),
    enabled: opened,
  })
  const contas: any[] = Array.isArray(contasData) ? contasData : (contasData as any)?.data ?? []

  const valor = titulo ? Number(titulo.valor) : 0
  const resumo = useMemo(() => calcularLiquidoBaixa(tipo, {
    valor,
    juros: Number(juros) || 0,
    multa: Number(multa) || 0,
    desconto: Number(desconto) || 0,
    tarifa: Number(tarifa) || 0,
  }), [tipo, valor, juros, multa, desconto, tarifa])

  const handleFile = async (file: File | null) => {
    if (!file) { setComprovante(null); return }
    const reader = new FileReader()
    reader.onload = () => setComprovante({ nome: file.name, conteudo: String(reader.result) })
    reader.readAsDataURL(file)
  }

  const confirmar = () => {
    const base: any = {
      formaPagamento: forma,
      contaFinanceiraId: contaId || undefined,
      juros: Number(juros) || undefined,
      multa: Number(multa) || undefined,
      desconto: Number(desconto) || undefined,
      tarifa: Number(tarifa) || undefined,
      comprovanteNome: comprovante?.nome,
      comprovanteConteudo: comprovante?.conteudo,
    }
    if (ehPagar) {
      base.valorPago = valor
      base.dataPagamento = (data ?? new Date()).toISOString()
    } else {
      base.valorRecebido = valor
      base.dataRecebimento = (data ?? new Date()).toISOString()
    }
    onConfirm(base)
  }

  return (
    <Modal opened={opened} onClose={onClose} size="60rem" title={ehPagar ? 'Baixa / Liquidação — Pagamento' : 'Baixa / Liquidação — Recebimento'}>
      {titulo && (
        <Grid>
          {/* Coluna esquerda — dados e ajustes */}
          <Grid.Col span={{ base: 12, md: 7 }}>
            <Stack>
              <Card withBorder padding="sm">
                <Text fw={600}>{titulo.descricao}</Text>
                <Text size="sm" c="dimmed">Valor do título: {formatarBRL(valor)}</Text>
              </Card>

              <Text fw={600} size="sm">Dados de Liquidação</Text>
              <Group grow>
                <DateInput label="Data" value={data} onChange={setData} valueFormat="DD/MM/YYYY" />
                <Select label="Conta origem/destino" placeholder="Selecione" data={contas.map((c) => ({ value: c.id, label: c.nome }))} value={contaId} onChange={setContaId} searchable clearable />
                <Select label="Forma" data={FORMAS} value={forma} onChange={setForma} />
              </Group>

              <Text fw={600} size="sm" mt="xs">Ajustes de Valor</Text>
              <Group grow>
                <NumberInput label="Juros" value={juros} onChange={(v) => setJuros(v as number)} decimalScale={2} thousandSeparator="." decimalSeparator="," min={0} prefix="R$ " />
                <NumberInput label="Multa" value={multa} onChange={(v) => setMulta(v as number)} decimalScale={2} thousandSeparator="." decimalSeparator="," min={0} prefix="R$ " />
              </Group>
              <Group grow>
                <NumberInput label="Desconto" value={desconto} onChange={(v) => setDesconto(v as number)} decimalScale={2} thousandSeparator="." decimalSeparator="," min={0} prefix="R$ " />
                <NumberInput label="Tarifa bancária" value={tarifa} onChange={(v) => setTarifa(v as number)} decimalScale={2} thousandSeparator="." decimalSeparator="," min={0} prefix="R$ " />
              </Group>

              <Group>
                <FileButton onChange={handleFile} accept="image/png,image/jpeg,application/pdf">
                  {(props) => <Button {...props} variant="light" leftSection={<IconUpload size={16} />}>Anexar comprovante</Button>}
                </FileButton>
                {comprovante && <Badge color="green" leftSection={<IconCheck size={12} />}>{comprovante.nome}</Badge>}
              </Group>
            </Stack>
          </Grid.Col>

          {/* Coluna direita — resumo de cálculo */}
          <Grid.Col span={{ base: 12, md: 5 }}>
            <Card withBorder padding="md" bg="var(--mantine-color-blue-light)">
              <Text fw={700} mb="sm">Resumo e Cálculos</Text>
              <Group justify="space-between"><Text size="sm">Título</Text><Text size="sm">{formatarBRL(valor)}</Text></Group>
              <Group justify="space-between"><Text size="sm" c="red">Acréscimos (juros/multa)</Text><Text size="sm" c="red">{formatarBRL(resumo.acrescimos)}</Text></Group>
              <Group justify="space-between"><Text size="sm" c="green">Descontos</Text><Text size="sm" c="green">- {formatarBRL(resumo.desconto)}</Text></Group>
              <Group justify="space-between"><Text size="sm">Tarifa bancária {ehPagar ? '(+)' : '(-)'}</Text><Text size="sm">{formatarBRL(resumo.tarifa)}</Text></Group>
              <Divider my="sm" />
              <Group justify="space-between">
                <Text fw={700}>Valor líquido {ehPagar ? 'a pagar' : 'a receber'}</Text>
                <Text fw={700} size="lg" c={resumo.valido ? 'blue' : 'red'}>{formatarBRL(resumo.liquido)}</Text>
              </Group>
              {!resumo.valido && (
                <Alert color="red" variant="light" mt="sm" icon={<IconAlertTriangle size={16} />}>
                  O desconto deixa o valor líquido negativo. Ajuste antes de confirmar.
                </Alert>
              )}
            </Card>
          </Grid.Col>

          <Grid.Col span={12}>
            <Group justify="flex-end">
              <Button variant="default" onClick={onClose}>Cancelar</Button>
              <Button color="green" loading={loading} disabled={!resumo.valido || !forma} onClick={confirmar}>
                Confirmar baixa
              </Button>
            </Group>
          </Grid.Col>
        </Grid>
      )}
    </Modal>
  )
}
