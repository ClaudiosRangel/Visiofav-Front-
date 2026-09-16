'use client'

/**
 * Financeiro D1 — formulário rico de inclusão de documento financeiro (4 blocos:
 * Dados Gerais, Financeiros, Classificação/Pagamento, Anexos). Reutilizado por
 * Contas a Pagar e Contas a Receber (prop `tipo`).
 */
import { useState } from 'react'
import {
  Modal, Stack, Group, Select, TextInput, NumberInput, Textarea, Button, Divider,
  Text, FileButton, Badge, ActionIcon, Tooltip,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { IconUpload, IconScan, IconX } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useMutation, useQuery } from '@tanstack/react-query'
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
  { value: 'DEBITO_AUTOMATICO', label: 'Débito Automático' },
]

interface Props {
  tipo: 'pagar' | 'receber'
  opened: boolean
  onClose: () => void
  onSaved: () => void
}

export function DocumentoFinanceiroForm({ tipo, opened, onClose, onSaved }: Props) {
  const endpoint = tipo === 'pagar' ? '/contas-pagar' : '/contas-receber'
  const parceiroTipo = tipo === 'pagar' ? 'fornecedor' : 'cliente'

  const [tipoDoc, setTipoDoc] = useState<string | null>('DESPESA')
  const [parceiro, setParceiro] = useState<ParceiroValue>({})
  const [numeroDoc, setNumeroDoc] = useState('')
  const [categoriaId, setCategoriaId] = useState<string | null>(null)
  const [dataEmissao, setDataEmissao] = useState<Date | null>(new Date())
  const [vencimento, setVencimento] = useState<Date | null>(null)
  const [valor, setValor] = useState<number | string>('')
  const [parcelas, setParcelas] = useState<number | string>(1)
  const [forma, setForma] = useState<string | null>(null)
  const [contaFinanceiraId, setContaFinanceiraId] = useState<string | null>(null)
  const [centroCustoId, setCentroCustoId] = useState<string | null>(null)
  const [codigoBarras, setCodigoBarras] = useState('')
  const [descricao, setDescricao] = useState('')
  const [obs, setObs] = useState('')
  const [anexo, setAnexo] = useState<{ nome: string; conteudo: string } | null>(null)

  const { data: categorias = [] } = useQuery<any[]>({ queryKey: ['fin-categorias'], queryFn: async () => (await api.get('/financeiro/categorias')).data, enabled: opened })
  const { data: centros = [] } = useQuery<any[]>({ queryKey: ['fin-centros'], queryFn: async () => (await api.get('/financeiro/centros-custo')).data, enabled: opened })
  const { data: contas = [] } = useQuery<any[]>({ queryKey: ['fin-contas'], queryFn: async () => (await api.get('/financeiro/contas')).data, enabled: opened })

  const interpretar = useMutation({
    mutationFn: () => api.post(`${endpoint}/interpretar-boleto`, { linhaDigitavel: codigoBarras }).then((r) => r.data),
    onSuccess: (r: any) => {
      if (r?.valor) setValor(r.valor)
      if (r?.vencimento) setVencimento(new Date(r.vencimento))
      notifications.show({ color: 'green', message: 'Boleto lido: valor e vencimento preenchidos' })
    },
    onError: () => notifications.show({ color: 'red', message: 'Linha digitável inválida' }),
  })

  const salvar = useMutation({
    mutationFn: () => {
      const body: any = {
        descricao,
        valor: Number(valor),
        dataVencimento: (vencimento ?? new Date()).toISOString(),
        dataEmissao: dataEmissao ? dataEmissao.toISOString() : undefined,
        numeroDocumento: numeroDoc || undefined,
        categoriaId: categoriaId || undefined,
        centroCustoId: centroCustoId || undefined,
        contaFinanceiraId: contaFinanceiraId || undefined,
        formaPagamento: forma || undefined,
        observacao: obs || undefined,
        parcelas: Number(parcelas) || 1,
        tipoDocumento: tipoDoc || undefined,
        anexoNome: anexo?.nome,
        anexoConteudo: anexo?.conteudo,
        ...(tipo === 'pagar' ? { codigoBarras: codigoBarras || undefined } : {}),
        [tipo === 'pagar' ? 'fornecedorId' : 'clienteId']: parceiro.parceiroId,
        parceiroNomeLivre: parceiro.parceiroNomeLivre,
        parceiroDocLivre: parceiro.parceiroDocLivre,
      }
      return api.post(endpoint, body).then((r) => r.data)
    },
    onSuccess: (r: any) => {
      notifications.show({ color: 'green', message: `Documento lançado${r?.parcelas > 1 ? ` em ${r.parcelas} parcelas` : ''}` })
      onSaved(); onClose(); resetar()
    },
    onError: (e: any) => notifications.show({ color: 'red', message: e?.response?.data?.message || 'Falha ao lançar' }),
  })

  function resetar() {
    setParceiro({}); setNumeroDoc(''); setValor(''); setParcelas(1); setDescricao(''); setObs(''); setCodigoBarras(''); setAnexo(null)
  }

  async function lerArquivo(file: File | null) {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setAnexo({ nome: file.name, conteudo: String(reader.result) })
    reader.readAsDataURL(file)
  }

  const podeSalvar = descricao.trim().length > 0 && Number(valor) > 0 && vencimento

  return (
    <Modal opened={opened} onClose={onClose} title={`Inclusão de ${tipo === 'pagar' ? 'Documento a Pagar' : 'Documento a Receber'}`} size="xl">
      <Stack>
        {/* Bloco 1 — Dados Gerais */}
        <Text fw={600} size="sm" c="dimmed">1. Dados Gerais</Text>
        <ParceiroAutocomplete tipo={parceiroTipo} value={parceiro} onChange={setParceiro} />
        <Group grow>
          <Select label="Tipo de documento" data={TIPOS_DOC} value={tipoDoc} onChange={setTipoDoc} />
          <TextInput label="Número do documento" value={numeroDoc} onChange={(e) => setNumeroDoc(e.currentTarget.value)} />
          <Select label="Natureza (categoria)" data={categorias.map((c) => ({ value: c.id, label: `${c.codigo} - ${c.nome}` }))} value={categoriaId} onChange={setCategoriaId} searchable clearable />
        </Group>
        <TextInput label="Descrição" value={descricao} onChange={(e) => setDescricao(e.currentTarget.value)} required />

        <Divider />
        {/* Bloco 2 — Dados Financeiros */}
        <Text fw={600} size="sm" c="dimmed">2. Dados Financeiros</Text>
        <Group grow>
          <DateInput label="Data de emissão" value={dataEmissao} onChange={setDataEmissao} valueFormat="DD/MM/YYYY" />
          <DateInput label="Vencimento" value={vencimento} onChange={setVencimento} valueFormat="DD/MM/YYYY" required />
          <NumberInput label="Valor total" value={valor} onChange={setValor} decimalScale={2} thousandSeparator="." decimalSeparator="," min={0} />
          <NumberInput label="Parcelas" value={parcelas} onChange={setParcelas} min={1} max={360} />
        </Group>

        <Divider />
        {/* Bloco 3 — Classificação e Pagamento */}
        <Text fw={600} size="sm" c="dimmed">3. Classificação e Pagamento</Text>
        <Group grow>
          <Select label="Forma de pagamento" data={FORMAS} value={forma} onChange={setForma} clearable />
          <Select label="Conta bancária" data={contas.filter((c) => c.status).map((c) => ({ value: c.id, label: c.nome }))} value={contaFinanceiraId} onChange={setContaFinanceiraId} searchable clearable />
          <Select label="Centro de custo" data={centros.filter((c) => c.status).map((c) => ({ value: c.id, label: `${c.codigo} - ${c.nome}` }))} value={centroCustoId} onChange={setCentroCustoId} searchable clearable />
        </Group>
        {tipo === 'pagar' && (
          <Group align="end">
            <TextInput label="Código de barras (boleto)" placeholder="Cole a linha digitável" value={codigoBarras} onChange={(e) => setCodigoBarras(e.currentTarget.value)} style={{ flex: 1 }} />
            <Tooltip label="Ler boleto (preenche valor e vencimento)">
              <ActionIcon size="lg" variant="light" disabled={!codigoBarras} loading={interpretar.isPending} onClick={() => interpretar.mutate()}><IconScan size={18} /></ActionIcon>
            </Tooltip>
          </Group>
        )}

        <Divider />
        {/* Bloco 4 — Anexos & Notas */}
        <Text fw={600} size="sm" c="dimmed">4. Anexos & Notas</Text>
        <Group>
          <FileButton onChange={lerArquivo} accept="image/*,application/pdf">
            {(props) => <Button {...props} variant="light" leftSection={<IconUpload size={16} />}>Anexar PDF/imagem</Button>}
          </FileButton>
          {anexo && <Badge variant="light" rightSection={<ActionIcon size="xs" variant="transparent" onClick={() => setAnexo(null)}><IconX size={12} /></ActionIcon>}>{anexo.nome}</Badge>}
        </Group>
        <Textarea label="Observações" value={obs} onChange={(e) => setObs(e.currentTarget.value)} autosize minRows={2} />

        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={onClose}>Cancelar</Button>
          <Button loading={salvar.isPending} disabled={!podeSalvar} onClick={() => salvar.mutate()}>Gravar Título</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
