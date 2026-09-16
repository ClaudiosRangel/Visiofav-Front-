'use client'

/**
 * Financeiro — modal RICO de edição de título em aberto (Contas a Pagar /
 * Receber). Espelha o layout do formulário de inclusão (blocos Dados Gerais,
 * Financeiros e Classificação), permitindo editar parceiro, tipo, número do
 * documento, categoria, forma, conta, centro de custo, além de
 * descrição/valor/vencimento/observação. Só para títulos em aberto.
 */
import { useEffect, useState } from 'react'
import {
  Modal, Stack, Group, Select, TextInput, NumberInput, Textarea, Button, Divider, Text,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { ParceiroAutocomplete, type ParceiroValue } from './ParceiroAutocomplete'

const TIPOS_DOC = [
  { value: 'NF', label: 'Nota Fiscal' },
  { value: 'NFS', label: 'Nota de Serviço' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'DESPESA', label: 'Despesa/Fatura' },
  { value: 'IMPOSTO', label: 'Imposto/Guia' },
  { value: 'FINANCIAMENTO', label: 'Financiamento' },
  { value: 'RECORRENTE', label: 'Recorrente' },
  { value: 'REEMBOLSO', label: 'Reembolso' },
  { value: 'OUTRO', label: 'Outro' },
]
const FORMAS = [
  { value: 'DINHEIRO', label: 'Dinheiro' }, { value: 'BOLETO', label: 'Boleto' },
  { value: 'PIX', label: 'PIX' }, { value: 'CARTAO_CREDITO', label: 'Cartão Crédito' },
  { value: 'CHEQUE', label: 'Cheque' }, { value: 'TRANSFERENCIA', label: 'Transferência' },
]

interface Props {
  tipo: 'pagar' | 'receber'
  titulo: any | null
  opened: boolean
  onClose: () => void
  onSaved: () => void
}

export function EditarTituloModal({ tipo, titulo, opened, onClose, onSaved }: Props) {
  const endpoint = tipo === 'pagar' ? '/contas-pagar' : '/contas-receber'
  const parceiroTipo = tipo === 'pagar' ? 'fornecedor' : 'cliente'
  const queryClient = useQueryClient()

  const [tipoDoc, setTipoDoc] = useState<string | null>(null)
  const [parceiro, setParceiro] = useState<ParceiroValue>({})
  const [numeroDoc, setNumeroDoc] = useState('')
  const [categoriaId, setCategoriaId] = useState<string | null>(null)
  const [vencimento, setVencimento] = useState<Date | null>(null)
  const [valor, setValor] = useState<number | string>('')
  const [forma, setForma] = useState<string | null>(null)
  const [contaFinanceiraId, setContaFinanceiraId] = useState<string | null>(null)
  const [centroCustoId, setCentroCustoId] = useState<string | null>(null)
  const [descricao, setDescricao] = useState('')
  const [obs, setObs] = useState('')

  const { data: categorias = [] } = useQuery<any[]>({ queryKey: ['fin-categorias'], queryFn: async () => (await api.get('/financeiro/categorias')).data, enabled: opened })
  const { data: centros = [] } = useQuery<any[]>({ queryKey: ['fin-centros'], queryFn: async () => (await api.get('/financeiro/centros-custo')).data, enabled: opened })
  const { data: contas = [] } = useQuery<any[]>({ queryKey: ['fin-contas'], queryFn: async () => (await api.get('/financeiro/contas')).data, enabled: opened })

  // Popular ao abrir com os dados do título
  useEffect(() => {
    if (titulo && opened) {
      setTipoDoc(titulo.tipoDocumento ?? null)
      const pid = tipo === 'pagar' ? titulo.fornecedorId : titulo.clienteId
      setParceiro(
        pid
          ? { parceiroId: pid }
          : titulo.parceiroNomeLivre
            ? { parceiroNomeLivre: titulo.parceiroNomeLivre, parceiroDocLivre: titulo.parceiroDocLivre ?? undefined }
            : {},
      )
      setNumeroDoc(titulo.numeroDocumento ?? '')
      setCategoriaId(titulo.categoriaId ?? null)
      setVencimento(titulo.dataVencimento ? new Date(titulo.dataVencimento) : null)
      setValor(Number(titulo.valor) || '')
      setForma(titulo.formaPagamento ?? null)
      setContaFinanceiraId(titulo.contaFinanceiraId ?? null)
      setCentroCustoId(titulo.centroCustoId ?? null)
      setDescricao(titulo.descricao ?? '')
      setObs(titulo.observacao ?? '')
    }
  }, [titulo, opened, tipo])

  const salvar = useMutation({
    mutationFn: () => {
      const body: any = {
        descricao,
        valor: Number(valor),
        dataVencimento: (vencimento ?? new Date()).toISOString(),
        numeroDocumento: numeroDoc || null,
        categoriaId: categoriaId || null,
        centroCustoId: centroCustoId || null,
        contaFinanceiraId: contaFinanceiraId || null,
        formaPagamento: forma || null,
        tipoDocumento: tipoDoc || null,
        observacao: obs || null,
        [tipo === 'pagar' ? 'fornecedorId' : 'clienteId']: parceiro.parceiroId ?? null,
        parceiroNomeLivre: parceiro.parceiroNomeLivre ?? null,
        parceiroDocLivre: parceiro.parceiroDocLivre ?? null,
      }
      return api.put(`${endpoint}/${titulo.id}`, body).then((r) => r.data)
    },
    onSuccess: () => {
      notifications.show({ color: 'green', message: 'Título atualizado' })
      queryClient.invalidateQueries({ queryKey: [tipo === 'pagar' ? 'contas-pagar' : 'contas-receber'] })
      onSaved(); onClose()
    },
    onError: (e: any) => notifications.show({ color: 'red', message: e?.response?.data?.message || 'Falha ao editar' }),
  })

  const podeSalvar = descricao.trim().length > 0 && Number(valor) > 0 && !!vencimento

  return (
    <Modal opened={opened} onClose={onClose} title={`Editar ${tipo === 'pagar' ? 'Conta a Pagar' : 'Conta a Receber'}`} size="xl">
      <Stack>
        <Text fw={600} size="sm" c="dimmed">1. Dados Gerais</Text>
        <ParceiroAutocomplete tipo={parceiroTipo} value={parceiro} onChange={setParceiro} />
        <Group grow>
          <Select label="Tipo de documento" data={TIPOS_DOC} value={tipoDoc} onChange={setTipoDoc} clearable />
          <TextInput label="Número do documento" value={numeroDoc} onChange={(e) => setNumeroDoc(e.currentTarget.value)} />
          <Select label="Natureza (categoria)" data={categorias.map((c) => ({ value: c.id, label: `${c.codigo} - ${c.nome}` }))} value={categoriaId} onChange={setCategoriaId} searchable clearable />
        </Group>
        <TextInput label="Descrição" value={descricao} onChange={(e) => setDescricao(e.currentTarget.value)} required />

        <Divider />
        <Text fw={600} size="sm" c="dimmed">2. Dados Financeiros</Text>
        <Group grow>
          <DateInput label="Vencimento" value={vencimento} onChange={setVencimento} valueFormat="DD/MM/YYYY" required />
          <NumberInput label="Valor total" value={valor} onChange={setValor} decimalScale={2} thousandSeparator="." decimalSeparator="," min={0} prefix="R$ " />
        </Group>

        <Divider />
        <Text fw={600} size="sm" c="dimmed">3. Classificação e Pagamento</Text>
        <Group grow>
          <Select label="Forma de pagamento" data={FORMAS} value={forma} onChange={setForma} clearable />
          <Select label="Conta bancária" data={contas.filter((c) => c.status).map((c) => ({ value: c.id, label: c.nome }))} value={contaFinanceiraId} onChange={setContaFinanceiraId} searchable clearable />
          <Select label="Centro de custo" data={centros.filter((c) => c.status).map((c) => ({ value: c.id, label: `${c.codigo} - ${c.nome}` }))} value={centroCustoId} onChange={setCentroCustoId} searchable clearable />
        </Group>
        <Textarea label="Observações" value={obs} onChange={(e) => setObs(e.currentTarget.value)} autosize minRows={2} />

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>Cancelar</Button>
          <Button loading={salvar.isPending} disabled={!podeSalvar} onClick={() => salvar.mutate()}>Salvar</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
