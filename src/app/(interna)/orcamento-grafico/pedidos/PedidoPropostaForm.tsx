'use client'

/**
 * Formulário do Pedido/Proposta (RFQ) — campos da planilha Carton Wega +
 * consulta CNPJ + galeria de até 5 imagens. Spec comercial-pedido-proposta.
 * Usado por /pedidos/novo (criação) e /pedidos/[id] (edição).
 */
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Stack, Group, Title, Button, Paper, TextInput, Select, Textarea, Switch,
  NumberInput, SimpleGrid, Text, Image, ActionIcon, Loader, Divider, Badge,
} from '@mantine/core'
import { IconArrowLeft, IconSearch, IconUpload, IconTrash, IconDeviceFloppy } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { getAuthToken } from '@/lib/authStorage'
import { notifications } from '@mantine/notifications'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api'

interface AnexoMeta { id: string; nome: string; tipo: string; tamanho: number }

interface FormState {
  origem: 'REPRESENTANTE' | 'VENDEDOR' | 'INTERNA'
  representanteId?: string | null
  vendedorId?: string | null
  tipoPedido: 'REPETICAO' | 'MOSTRUARIO' | 'NOVO'
  clienteNome: string
  clienteCpfCnpj: string
  jaCliente: boolean
  mercado: string
  ufOrigem: string
  cidade: string
  tipoEntrega: 'UNICA' | 'FRACIONADA' | ''
  entregaFracionadaDias: string
  prazoPagamento: string
  produtoNome: string
  tipoEmbalagem: string
  quantidade: number | ''
  cartao: string
  gramatura: string
  medidasTexto: string
  cartaoFsc: boolean
  corteInternoVerso: boolean
  passtime: boolean
  acabamentos: string
  matriz: string
  acabamentoManual: boolean
  quantidadePorVolume: string
  variacoesArte: string
  exportacao: 'COMUM' | 'EXPORTACAO' | ''
  dataValidade: string
  discriminacao: string
  observacoes: string
  exigeAmostra: boolean
}

const VAZIO: FormState = {
  origem: 'INTERNA', tipoPedido: 'NOVO', clienteNome: '', clienteCpfCnpj: '', jaCliente: false,
  mercado: '', ufOrigem: '', cidade: '', tipoEntrega: '', entregaFracionadaDias: '', prazoPagamento: '',
  produtoNome: '', tipoEmbalagem: '', quantidade: '', cartao: '', gramatura: '', medidasTexto: '',
  cartaoFsc: false, corteInternoVerso: false, passtime: false, acabamentos: '', matriz: '',
  acabamentoManual: false, quantidadePorVolume: '', variacoesArte: '', exportacao: '', dataValidade: '',
  discriminacao: '', observacoes: '', exigeAmostra: false,
}

export default function PedidoPropostaForm({ pedidoId }: { pedidoId?: string }) {
  const router = useRouter()
  const editando = !!pedidoId
  const [form, setForm] = useState<FormState>(VAZIO)
  const [loading, setLoading] = useState(editando)
  const [salvando, setSalvando] = useState(false)
  const [buscandoCnpj, setBuscandoCnpj] = useState(false)
  const [anexos, setAnexos] = useState<AnexoMeta[]>([])
  const [idAtual, setIdAtual] = useState<string | undefined>(pedidoId)
  const fileRef = useRef<HTMLInputElement>(null)

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => {
    if (!pedidoId) return
    setLoading(true)
    api.get(`/orcamento-grafico/pedidos-proposta/${pedidoId}`)
      .then(({ data }) => {
        setForm({ ...VAZIO, ...sanitizar(data) })
        setAnexos(Array.isArray(data.anexos) ? data.anexos : [])
      })
      .catch(() => notifications.show({ title: 'Erro', message: 'Falha ao carregar o pedido.', color: 'red' }))
      .finally(() => setLoading(false))
  }, [pedidoId])

  function sanitizar(d: any): Partial<FormState> {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(VAZIO) as (keyof FormState)[]) {
      if (d[k] !== undefined && d[k] !== null) out[k] = d[k]
    }
    return out as Partial<FormState>
  }

  async function buscarCnpj() {
    const digits = form.clienteCpfCnpj.replace(/\D/g, '')
    if (digits.length !== 14) {
      notifications.show({ message: 'Informe um CNPJ com 14 dígitos.', color: 'red' })
      return
    }
    setBuscandoCnpj(true)
    try {
      const { data } = await api.get(`/orcamento-grafico/cnpj/${digits}`)
      set('clienteNome', data?.razaoSocial || data?.nomeFantasia || form.clienteNome)
      if (data?.uf) set('ufOrigem', data.uf)
      if (data?.cidade || data?.municipio) set('cidade', data.cidade || data.municipio)
      set('jaCliente', false)
      notifications.show({ title: 'CNPJ', message: 'Dados preenchidos a partir da Receita.', color: 'green' })
    } catch (err: any) {
      notifications.show({ title: 'CNPJ', message: err?.response?.data?.message || 'Não encontrado.', color: 'orange' })
    } finally {
      setBuscandoCnpj(false)
    }
  }

  function montarPayload() {
    const p: Record<string, unknown> = { ...form }
    p.quantidade = form.quantidade === '' ? null : Number(form.quantidade)
    p.tipoEntrega = form.tipoEntrega || null
    p.exportacao = form.exportacao || null
    return p
  }

  async function salvar() {
    if (!form.mercado.trim()) {
      notifications.show({ message: 'O campo Mercado é obrigatório.', color: 'red' })
      return
    }
    if (form.tipoEntrega === 'FRACIONADA' && !form.entregaFracionadaDias.trim()) {
      notifications.show({ message: 'Informe o intervalo de dias da entrega fracionada.', color: 'red' })
      return
    }
    setSalvando(true)
    try {
      if (idAtual) {
        await api.put(`/orcamento-grafico/pedidos-proposta/${idAtual}`, montarPayload())
        notifications.show({ title: 'Salvo', message: 'Pedido/Proposta atualizado.', color: 'green' })
      } else {
        const { data } = await api.post('/orcamento-grafico/pedidos-proposta', montarPayload())
        setIdAtual(data.id)
        notifications.show({ title: 'Criado', message: `Pedido/Proposta nº ${data.numero} criado.`, color: 'green' })
        router.replace(`/orcamento-grafico/pedidos/${data.id}`)
      }
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao salvar.', color: 'red' })
    } finally {
      setSalvando(false)
    }
  }

  async function enviarImagem(file: File) {
    if (!idAtual) {
      notifications.show({ message: 'Salve o pedido antes de anexar imagens.', color: 'orange' })
      return
    }
    if (anexos.length >= 5) {
      notifications.show({ message: 'Limite de 5 imagens atingido.', color: 'orange' })
      return
    }
    const fd = new FormData()
    fd.append('file', file)
    try {
      await api.post(`/orcamento-grafico/pedidos-proposta/${idAtual}/anexos`, fd)
      const { data } = await api.get(`/orcamento-grafico/pedidos-proposta/${idAtual}/anexos`)
      setAnexos(Array.isArray(data) ? data : [])
    } catch (err: any) {
      const code = err?.response?.data?.code
      const msg = code === 'LIMITE_ANEXOS' ? 'Limite de 5 imagens.'
        : code === 'MIME_INVALIDO' ? 'Apenas imagens são aceitas.'
        : code === 'ARQUIVO_GRANDE' ? 'Imagem acima de 10MB.'
        : err?.response?.data?.message || 'Falha ao enviar imagem.'
      notifications.show({ title: 'Imagem', message: msg, color: 'red' })
    }
  }

  async function removerImagem(anexoId: string) {
    if (!idAtual) return
    try {
      await api.delete(`/orcamento-grafico/pedidos-proposta/${idAtual}/anexos/${anexoId}`)
      setAnexos((a) => a.filter((x) => x.id !== anexoId))
    } catch {
      notifications.show({ title: 'Imagem', message: 'Falha ao remover.', color: 'red' })
    }
  }

  function urlAnexo(anexoId: string): string {
    const token = getAuthToken()
    return `${API_BASE}/orcamento-grafico/pedidos-proposta/${idAtual}/anexos/${anexoId}?token=${token ?? ''}`
  }

  if (loading) return <Center><Loader /></Center>

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group>
          <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => router.push('/orcamento-grafico/pedidos')}>
            Voltar
          </Button>
          <Title order={3}>{editando ? 'Editar Pedido / Proposta' : 'Novo Pedido / Proposta'}</Title>
        </Group>
        <Button leftSection={<IconDeviceFloppy size={16} />} loading={salvando} onClick={salvar}>Salvar</Button>
      </Group>

      {/* Origem / tipo */}
      <Paper withBorder p="md">
        <Text fw={600} mb="sm">Origem e tipo</Text>
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <Select label="Origem" data={[
            { value: 'REPRESENTANTE', label: 'Representante' },
            { value: 'VENDEDOR', label: 'Vendedor' },
            { value: 'INTERNA', label: 'Venda interna' },
          ]} value={form.origem} onChange={(v) => set('origem', (v as FormState['origem']) || 'INTERNA')} />
          <Select label="Tipo de pedido" data={[
            { value: 'NOVO', label: 'Novo' },
            { value: 'REPETICAO', label: 'Repetição' },
            { value: 'MOSTRUARIO', label: 'Mostruário' },
          ]} value={form.tipoPedido} onChange={(v) => set('tipoPedido', (v as FormState['tipoPedido']) || 'NOVO')} />
          <Switch label="Exige amostra" checked={form.exigeAmostra} onChange={(e) => set('exigeAmostra', e.currentTarget.checked)} mt="lg" />
        </SimpleGrid>
      </Paper>

      {/* Cliente */}
      <Paper withBorder p="md">
        <Text fw={600} mb="sm">Cliente</Text>
        <SimpleGrid cols={{ base: 1, sm: 2 }}>
          <Group align="flex-end" gap="xs">
            <TextInput label="CNPJ" placeholder="00.000.000/0000-00" value={form.clienteCpfCnpj}
              onChange={(e) => set('clienteCpfCnpj', e.currentTarget.value)} style={{ flex: 1 }} />
            <Button variant="light" leftSection={<IconSearch size={16} />} loading={buscandoCnpj} onClick={buscarCnpj}>Receita</Button>
          </Group>
          <TextInput label="Razão social / Nome" value={form.clienteNome} onChange={(e) => set('clienteNome', e.currentTarget.value)} />
          <Switch label="Já é cliente" checked={form.jaCliente} onChange={(e) => set('jaCliente', e.currentTarget.checked)} />
          <TextInput label="Mercado (obrigatório)" required value={form.mercado} onChange={(e) => set('mercado', e.currentTarget.value)} />
          <TextInput label="UF de origem" maxLength={2} value={form.ufOrigem} onChange={(e) => set('ufOrigem', e.currentTarget.value.toUpperCase())} />
          <TextInput label="Cidade" value={form.cidade} onChange={(e) => set('cidade', e.currentTarget.value)} />
        </SimpleGrid>
      </Paper>

      {/* Entrega / pagamento */}
      <Paper withBorder p="md">
        <Text fw={600} mb="sm">Entrega e pagamento</Text>
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <Select label="Entrega" clearable data={[
            { value: 'UNICA', label: 'Única' }, { value: 'FRACIONADA', label: 'Fracionada' },
          ]} value={form.tipoEntrega || null} onChange={(v) => set('tipoEntrega', (v as FormState['tipoEntrega']) || '')} />
          {form.tipoEntrega === 'FRACIONADA' && (
            <TextInput label="A cada quantos dias?" value={form.entregaFracionadaDias} onChange={(e) => set('entregaFracionadaDias', e.currentTarget.value)} />
          )}
          <TextInput label="Prazo de pagamento" value={form.prazoPagamento} onChange={(e) => set('prazoPagamento', e.currentTarget.value)} />
        </SimpleGrid>
      </Paper>

      {/* Produto / técnico */}
      <Paper withBorder p="md">
        <Text fw={600} mb="sm">Produto e especificação</Text>
        <SimpleGrid cols={{ base: 1, sm: 3 }}>
          <TextInput label="Nome do produto" value={form.produtoNome} onChange={(e) => set('produtoNome', e.currentTarget.value)} />
          <TextInput label="Tipo de embalagem" placeholder="Cartucho / Caixa / Sacola..." value={form.tipoEmbalagem} onChange={(e) => set('tipoEmbalagem', e.currentTarget.value)} />
          <NumberInput label="Quantidade (tiragem)" value={form.quantidade} onChange={(v) => set('quantidade', v === '' ? '' : Number(v))} min={0} />
          <TextInput label="Cartão" value={form.cartao} onChange={(e) => set('cartao', e.currentTarget.value)} />
          <TextInput label="Gramatura" value={form.gramatura} onChange={(e) => set('gramatura', e.currentTarget.value)} />
          <TextInput label="Medidas (C x L x A mm)" value={form.medidasTexto} onChange={(e) => set('medidasTexto', e.currentTarget.value)} />
          <TextInput label="Variações de arte" value={form.variacoesArte} onChange={(e) => set('variacoesArte', e.currentTarget.value)} />
          <Select label="Exportação" clearable data={[
            { value: 'COMUM', label: 'Comum' }, { value: 'EXPORTACAO', label: 'Exportação' },
          ]} value={form.exportacao || null} onChange={(v) => set('exportacao', (v as FormState['exportacao']) || '')} />
          <TextInput label="Matriz (nova / anterior)" value={form.matriz} onChange={(e) => set('matriz', e.currentTarget.value)} />
          <TextInput label="Qtd. por volume" value={form.quantidadePorVolume} onChange={(e) => set('quantidadePorVolume', e.currentTarget.value)} />
          <TextInput label="Validade" value={form.dataValidade} onChange={(e) => set('dataValidade', e.currentTarget.value)} />
        </SimpleGrid>
        <Group mt="sm" gap="lg">
          <Switch label="Cartão FSC" checked={form.cartaoFsc} onChange={(e) => set('cartaoFsc', e.currentTarget.checked)} />
          <Switch label="Corte interno (verso)" checked={form.corteInternoVerso} onChange={(e) => set('corteInternoVerso', e.currentTarget.checked)} />
          <Switch label="Passtime (visor)" checked={form.passtime} onChange={(e) => set('passtime', e.currentTarget.checked)} />
          <Switch label="Acabamento manual" checked={form.acabamentoManual} onChange={(e) => set('acabamentoManual', e.currentTarget.checked)} />
        </Group>
        <Textarea label="Acabamentos" mt="sm" minRows={2} value={form.acabamentos} onChange={(e) => set('acabamentos', e.currentTarget.value)} />
        <Textarea label="Discriminação (itens)" mt="sm" minRows={2} value={form.discriminacao} onChange={(e) => set('discriminacao', e.currentTarget.value)} />
        <Textarea label="Observações" mt="sm" minRows={2} value={form.observacoes} onChange={(e) => set('observacoes', e.currentTarget.value)} />
      </Paper>

      {/* Imagens */}
      <Paper withBorder p="md">
        <Group justify="space-between" mb="sm">
          <Group gap="xs">
            <Text fw={600}>Imagens da amostra/arte</Text>
            <Badge variant="light" color="gray">{anexos.length}/5</Badge>
          </Group>
          <Button variant="light" leftSection={<IconUpload size={16} />} disabled={!idAtual || anexos.length >= 5}
            onClick={() => fileRef.current?.click()}>
            Adicionar imagem
          </Button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }}
            onChange={(e) => { const f = e.currentTarget.files?.[0]; if (f) enviarImagem(f); e.currentTarget.value = '' }} />
        </Group>
        {!idAtual && <Text size="xs" c="dimmed">Salve o pedido para habilitar o anexo de imagens.</Text>}
        {anexos.length > 0 && (
          <SimpleGrid cols={{ base: 2, sm: 5 }}>
            {anexos.map((a) => (
              <div key={a.id} style={{ position: 'relative' }}>
                <Image src={urlAnexo(a.id)} alt={a.nome} radius="sm" h={120} fit="cover" />
                <ActionIcon color="red" variant="filled" size="sm" style={{ position: 'absolute', top: 4, right: 4 }}
                  onClick={() => removerImagem(a.id)}>
                  <IconTrash size={14} />
                </ActionIcon>
              </div>
            ))}
          </SimpleGrid>
        )}
      </Paper>

      <Divider />
      <Group justify="flex-end">
        <Button leftSection={<IconDeviceFloppy size={16} />} loading={salvando} onClick={salvar}>Salvar</Button>
      </Group>
    </Stack>
  )
}

// Center helper (evita import extra só p/ isso).
function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>{children}</div>
}
