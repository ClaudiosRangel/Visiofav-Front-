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
  Autocomplete, Checkbox, Modal,
} from '@mantine/core'
import { IconArrowLeft, IconSearch, IconUpload, IconTrash, IconDeviceFloppy, IconPlus } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { getAuthToken } from '@/lib/authStorage'
import { notifications } from '@mantine/notifications'
import { ativarGuardaNavegacao, desativarGuardaNavegacao } from '@/lib/navigationGuardStore'

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
  // Revisão 3
  clienteId: string | null
  produtoId: string | null
  prazoPagamentoId: string | null
  acabamentosSelecionados: Array<{ acabamentoId?: string | null; nome: string; marcado: boolean; detalhe?: string | null }>
}

interface ClienteOpc { id: string; razaoSocial: string; nomeFantasia?: string | null; cpfCnpj: string; uf?: string | null; cidade?: string | null }
interface ProdutoOpc { id: string; nome: string; codigo: string; imagemUrl?: string | null; descricao?: string | null; gramatura?: number | string | null }
interface PrazoOpc { id: string; descricao: string; dias: number; parcelas: number }
interface AcabamentoOpc { id: string; nome: string }

const VAZIO: FormState = {
  origem: 'INTERNA', tipoPedido: 'NOVO', clienteNome: '', clienteCpfCnpj: '', jaCliente: false,
  mercado: '', ufOrigem: '', cidade: '', tipoEntrega: '', entregaFracionadaDias: '', prazoPagamento: '',
  produtoNome: '', tipoEmbalagem: '', quantidade: '', cartao: '', gramatura: '', medidasTexto: '',
  cartaoFsc: false, corteInternoVerso: false, passtime: false, acabamentos: '', matriz: '',
  acabamentoManual: false, quantidadePorVolume: '', variacoesArte: '', exportacao: '', dataValidade: '',
  discriminacao: '', observacoes: '', exigeAmostra: false,
  clienteId: null, produtoId: null, prazoPagamentoId: null, acabamentosSelecionados: [],
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

  // Revisão 3 — busca cliente/produto, prazos e checklist de acabamentos.
  const [clienteOpcoes, setClienteOpcoes] = useState<ClienteOpc[]>([])
  const [clienteBusca, setClienteBusca] = useState('')
  const [produtoOpcoes, setProdutoOpcoes] = useState<ProdutoOpc[]>([])
  const [produtoBusca, setProdutoBusca] = useState('')
  const [produtoSel, setProdutoSel] = useState<ProdutoOpc | null>(null)
  const [prazos, setPrazos] = useState<PrazoOpc[]>([])
  const [acabamentosCad, setAcabamentosCad] = useState<AcabamentoOpc[]>([])
  const [dirty, setDirty] = useState(false)

  // Ponto 2 — modal "novo prazo" inline (sem sair do cadastro)
  const [prazoModal, setPrazoModal] = useState(false)
  const [prazoDesc, setPrazoDesc] = useState('')
  const [prazoDias, setPrazoDias] = useState<number | ''>(0)
  const [prazoParc, setPrazoParc] = useState<number | ''>(1)
  const [salvandoPrazo, setSalvandoPrazo] = useState(false)

  // Ponto 4 — modal "novo cliente" inline
  const [clienteModal, setClienteModal] = useState(false)
  const [novoCli, setNovoCli] = useState({ razaoSocial: '', nomeFantasia: '', cpfCnpj: '', uf: '', cidade: '' })
  const [salvandoCli, setSalvandoCli] = useState(false)

  // Acabamento livre (quando não está no cadastro) — nome digitado
  const [acabLivre, setAcabLivre] = useState('')

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => { setForm((f) => ({ ...f, [k]: v })); setDirty(true) }

  useEffect(() => {
    if (!pedidoId) return
    setLoading(true)
    api.get(`/orcamento-grafico/pedidos-proposta/${pedidoId}`)
      .then(({ data }) => {
        setForm({ ...VAZIO, ...sanitizar(data) })
        setAnexos(Array.isArray(data.anexos) ? data.anexos : [])
        // Carrega a foto/características do produto vinculado (se houver).
        if (data.produtoId) {
          api.get(`/produtos/${data.produtoId}`)
            .then((r) => setProdutoSel(r.data))
            .catch(() => { /* produto removido — ignora */ })
        }
      })
      .catch(() => notifications.show({ title: 'Erro', message: 'Falha ao carregar o pedido.', color: 'red' }))
      .finally(() => setLoading(false))
  }, [pedidoId])

  function sanitizar(d: any): Partial<FormState> {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(VAZIO) as (keyof FormState)[]) {
      if (d[k] !== undefined && d[k] !== null) out[k] = d[k]
    }
    if (Array.isArray(d.acabamentosSelecionados)) out.acabamentosSelecionados = d.acabamentosSelecionados
    return out as Partial<FormState>
  }

  // Ponto 3 — guarda de navegação: enquanto houver alterações não salvas,
  // avisa ao sair da tela (menu lateral usa confirmarNavegacaoOuBloquear) e
  // ao fechar/recarregar a aba (beforeunload).
  useEffect(() => {
    if (dirty) {
      ativarGuardaNavegacao('Há alterações não salvas neste pedido/proposta. Deseja sair sem salvar?')
    } else {
      desativarGuardaNavegacao()
    }
    return () => desativarGuardaNavegacao()
  }, [dirty])

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  // Carrega prazos (Select) e acabamentos cadastrados (checklist) uma vez.
  useEffect(() => {
    api.get('/orcamento-grafico/pedidos-proposta/prazos-pagamento')
      .then(({ data }) => setPrazos(Array.isArray(data) ? data : []))
      .catch(() => setPrazos([]))
    api.get('/orcamento-grafico/acabamentos', { params: { limit: 200 } })
      .then(({ data }) => setAcabamentosCad(Array.isArray(data?.data) ? data.data : (Array.isArray(data) ? data : [])))
      .catch(() => setAcabamentosCad([]))
  }, [])

  // Busca de cliente do cadastro (debounce simples).
  useEffect(() => {
    if (!clienteBusca.trim() || clienteBusca.trim().length < 2) { setClienteOpcoes([]); return }
    const t = setTimeout(() => {
      api.get('/clientes', { params: { busca: clienteBusca.trim(), limit: 10 } })
        .then(({ data }) => setClienteOpcoes(Array.isArray(data?.data) ? data.data : []))
        .catch(() => setClienteOpcoes([]))
    }, 300)
    return () => clearTimeout(t)
  }, [clienteBusca])

  // Busca de produto do cadastro (debounce simples).
  useEffect(() => {
    if (!produtoBusca.trim() || produtoBusca.trim().length < 2) { setProdutoOpcoes([]); return }
    const t = setTimeout(() => {
      api.get('/produtos', { params: { busca: produtoBusca.trim(), limit: 10 } })
        .then(({ data }) => setProdutoOpcoes(Array.isArray(data?.data) ? data.data : []))
        .catch(() => setProdutoOpcoes([]))
    }, 300)
    return () => clearTimeout(t)
  }, [produtoBusca])

  // Ao escolher um cliente do cadastro, preenche nome/CNPJ/UF/cidade + vincula.
  function selecionarCliente(c: ClienteOpc) {
    setForm((f) => ({
      ...f,
      clienteId: c.id,
      clienteNome: c.razaoSocial,
      clienteCpfCnpj: c.cpfCnpj || f.clienteCpfCnpj,
      ufOrigem: c.uf || f.ufOrigem,
      cidade: c.cidade || f.cidade,
      jaCliente: true,
    }))
    setDirty(true)
    setClienteOpcoes([])
    setClienteBusca('')
  }

  // Ao escolher um produto do cadastro, traz nome/foto + busca características
  // (cartão/gramatura/cores/medidas/formato) do CalculoGrafico migrado e preenche
  // os campos VAZIOS (não sobrescreve o que o usuário já digitou).
  async function selecionarProduto(p: ProdutoOpc) {
    setProdutoSel(p)
    setForm((f) => ({
      ...f,
      produtoId: p.id,
      produtoNome: p.nome || f.produtoNome,
      tipoPedido: 'REPETICAO', // produto do cadastro = repetição
    }))
    setDirty(true)
    setProdutoOpcoes([])
    setProdutoBusca('')
    try {
      const { data } = await api.get(`/orcamento-grafico/pedidos-proposta/caracteristicas-produto/${p.id}`)
      if (data?.produto?.imagemUrl) setProdutoSel((s) => (s ? { ...s, imagemUrl: data.produto.imagemUrl } : s))
      const c = data?.caracteristicas
      if (c) {
        setForm((f) => ({
          ...f,
          cartao: f.cartao || c.cartao || f.cartao,
          gramatura: f.gramatura || c.gramatura || f.gramatura,
          medidasTexto: f.medidasTexto || c.medidasTexto || f.medidasTexto,
          // cores da engenharia vão para "Variações de arte" (campo textual livre
          // mais próximo) + acabamentos ricos não alteram o checklist aqui.
          variacoesArte: f.variacoesArte || c.cores || f.variacoesArte,
        }))
        if (c.temCalculo) {
          notifications.show({ title: 'Características', message: 'Dados do cálculo (Calcgraf) preenchidos nos campos vazios.', color: 'green' })
        }
      }
    } catch { /* sem características — mantém o que já está */ }
  }

  // Alterna/edita um acabamento no checklist.
  function toggleAcabamento(nome: string, acabamentoId: string | null, marcado: boolean) {
    setForm((f) => {
      const lista = [...f.acabamentosSelecionados]
      const idx = lista.findIndex((a) => a.nome === nome)
      if (idx >= 0) lista[idx] = { ...lista[idx], marcado }
      else lista.push({ acabamentoId, nome, marcado, detalhe: '' })
      return { ...f, acabamentosSelecionados: lista }
    })
    setDirty(true)
  }
  function setDetalheAcabamento(nome: string, detalhe: string) {
    setForm((f) => {
      const lista = [...f.acabamentosSelecionados]
      const idx = lista.findIndex((a) => a.nome === nome)
      if (idx >= 0) lista[idx] = { ...lista[idx], detalhe }
      return { ...f, acabamentosSelecionados: lista }
    })
    setDirty(true)
  }
  function estadoAcabamento(nome: string) {
    return form.acabamentosSelecionados.find((a) => a.nome === nome)
  }

  // Adiciona um acabamento LIVRE (fora do cadastro) ao checklist, já marcado.
  function adicionarAcabamentoLivre() {
    const nome = acabLivre.trim()
    if (!nome) return
    if (form.acabamentosSelecionados.some((a) => a.nome === nome)) { setAcabLivre(''); return }
    setForm((f) => ({ ...f, acabamentosSelecionados: [...f.acabamentosSelecionados, { acabamentoId: null, nome, marcado: true, detalhe: '' }] }))
    setDirty(true)
    setAcabLivre('')
  }

  // Ponto 2 — cria um prazo e já seleciona, sem fechar o cadastro do pedido.
  async function salvarPrazoInline() {
    if (!prazoDesc.trim()) { notifications.show({ message: 'Informe a descrição do prazo.', color: 'red' }); return }
    setSalvandoPrazo(true)
    try {
      const { data } = await api.post('/orcamento-grafico/pedidos-proposta/prazos-pagamento', {
        descricao: prazoDesc.trim(),
        dias: prazoDias === '' ? 0 : Number(prazoDias),
        parcelas: prazoParc === '' ? 1 : Number(prazoParc),
      })
      // Recarrega e seleciona o recém-criado.
      const { data: lista } = await api.get('/orcamento-grafico/pedidos-proposta/prazos-pagamento')
      setPrazos(Array.isArray(lista) ? lista : [])
      setForm((f) => ({ ...f, prazoPagamentoId: data.id, prazoPagamento: data.descricao }))
      setDirty(true)
      setPrazoModal(false)
      setPrazoDesc(''); setPrazoDias(0); setPrazoParc(1)
      notifications.show({ title: 'Prazo criado', message: data.descricao, color: 'green' })
    } catch (err: any) {
      const msg = err?.response?.data?.code === 'DUPLICADO' ? 'Já existe um prazo com essa descrição.' : (err?.response?.data?.message || 'Falha ao criar prazo')
      notifications.show({ title: 'Erro', message: msg, color: 'red' })
    } finally {
      setSalvandoPrazo(false)
    }
  }

  // Ponto 4 — cadastra um cliente novo na tabela de clientes e vincula ao RFQ.
  async function salvarClienteInline() {
    if (!novoCli.razaoSocial.trim() || !novoCli.cpfCnpj.trim()) {
      notifications.show({ message: 'Informe razão social e CPF/CNPJ.', color: 'red' }); return
    }
    setSalvandoCli(true)
    try {
      const { data } = await api.post('/clientes', {
        razaoSocial: novoCli.razaoSocial.trim(),
        nomeFantasia: novoCli.nomeFantasia.trim() || undefined,
        cpfCnpj: novoCli.cpfCnpj.replace(/\D/g, ''),
        uf: novoCli.uf.trim() || undefined,
        cidade: novoCli.cidade.trim() || undefined,
      })
      selecionarCliente({ id: data.id, razaoSocial: data.razaoSocial, cpfCnpj: data.cpfCnpj, uf: data.uf, cidade: data.cidade })
      setClienteModal(false)
      setNovoCli({ razaoSocial: '', nomeFantasia: '', cpfCnpj: '', uf: '', cidade: '' })
      notifications.show({ title: 'Cliente cadastrado', message: data.razaoSocial, color: 'green' })
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao cadastrar cliente', color: 'red' })
    } finally {
      setSalvandoCli(false)
    }
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
      setDirty(false) // alterações persistidas — libera a navegação
      desativarGuardaNavegacao()
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
          <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => {
            if (dirty && !window.confirm('Há alterações não salvas. Deseja sair sem salvar?')) return
            desativarGuardaNavegacao()
            router.push('/orcamento-grafico/pedidos')
          }}>
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
        <Group align="flex-end" gap="xs" mb="sm">
          <Autocomplete
            label="Buscar no cadastro de clientes"
            placeholder="Digite razão social, nome fantasia, CNPJ ou código..."
            leftSection={<IconSearch size={16} />}
            data={clienteOpcoes.map((c) => ({
              value: c.id,
              label: `${c.razaoSocial}${c.nomeFantasia ? ` (${c.nomeFantasia})` : ''}${c.cpfCnpj ? ` — ${c.cpfCnpj}` : ''}`,
            }))}
            value={clienteBusca}
            onChange={setClienteBusca}
            onOptionSubmit={(id) => { const c = clienteOpcoes.find((x) => x.id === id); if (c) selecionarCliente(c) }}
            comboboxProps={{ withinPortal: true }}
            style={{ flex: 1 }}
          />
          <Button variant="light" leftSection={<IconPlus size={16} />} onClick={() => {
            setNovoCli({ razaoSocial: form.clienteNome || '', nomeFantasia: '', cpfCnpj: form.clienteCpfCnpj || '', uf: form.ufOrigem || '', cidade: form.cidade || '' })
            setClienteModal(true)
          }}>
            Cadastrar novo
          </Button>
        </Group>
        {form.clienteId && (
          <Badge color="teal" variant="light" mb="sm">Cliente do cadastro vinculado</Badge>
        )}
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
          <div>
            <Group gap={4} align="flex-end" wrap="nowrap">
              <Select
                label="Prazo de pagamento (cadastro)"
                placeholder={prazos.length ? 'Selecione...' : 'Nenhum prazo cadastrado'}
                data={prazos.map((p) => ({ value: p.id, label: p.descricao }))}
                value={form.prazoPagamentoId}
                onChange={(v) => {
                  set('prazoPagamentoId', v)
                  const p = prazos.find((x) => x.id === v)
                  if (p) set('prazoPagamento', p.descricao) // espelha no texto livre p/ proposta/PDF
                }}
                clearable
                searchable
                comboboxProps={{ withinPortal: true }}
                style={{ flex: 1 }}
              />
              <ActionIcon variant="light" size="lg" aria-label="Novo prazo" onClick={() => setPrazoModal(true)}>
                <IconPlus size={18} />
              </ActionIcon>
            </Group>
          </div>
          <TextInput label="Prazo (texto livre)" description="Use quando não estiver no cadastro" value={form.prazoPagamento} onChange={(e) => set('prazoPagamento', e.currentTarget.value)} />
        </SimpleGrid>
      </Paper>

      {/* Produto / técnico */}
      <Paper withBorder p="md">
        <Text fw={600} mb="sm">Produto e especificação</Text>
        <Group align="flex-start" mb="sm" wrap="nowrap">
          <Autocomplete
            label="Localizar no cadastro de produtos"
            placeholder="Digite nome, código ou EAN..."
            leftSection={<IconSearch size={16} />}
            data={produtoOpcoes.map((p) => ({ value: p.id, label: `${p.codigo} — ${p.nome}` }))}
            value={produtoBusca}
            onChange={setProdutoBusca}
            onOptionSubmit={(id) => { const p = produtoOpcoes.find((x) => x.id === id); if (p) selecionarProduto(p) }}
            comboboxProps={{ withinPortal: true }}
            style={{ flex: 1 }}
          />
          {produtoSel?.imagemUrl && (
            <Image src={produtoSel.imagemUrl} alt={produtoSel.nome} w={90} h={90} fit="cover" radius="sm" />
          )}
        </Group>
        {form.produtoId && produtoSel && (
          <Text size="xs" c="dimmed" mb="sm">
            Produto vinculado: {produtoSel.codigo} — {produtoSel.nome}
            {produtoSel.descricao ? ` · ${produtoSel.descricao}` : ''}
          </Text>
        )}
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
        {/* Checklist de acabamentos (cadastrados + livres) + detalhe por item */}
        <div style={{ marginTop: 12 }}>
          <Text size="sm" fw={600} mb={4}>Acabamentos (marque e detalhe)</Text>
          <Stack gap={6}>
            {acabamentosCad.map((a) => {
                const est = estadoAcabamento(a.nome)
                const marcado = !!est?.marcado
                return (
                  <Group key={a.id} gap="xs" wrap="nowrap" align="center">
                    <Checkbox
                      label={a.nome}
                      checked={marcado}
                      onChange={(e) => toggleAcabamento(a.nome, a.id, e.currentTarget.checked)}
                      style={{ minWidth: 220 }}
                    />
                    {marcado && (
                      <TextInput
                        placeholder="Detalhe (ex.: verniz localizado no logo)"
                        size="xs"
                        value={est?.detalhe ?? ''}
                        onChange={(e) => setDetalheAcabamento(a.nome, e.currentTarget.value)}
                        style={{ flex: 1 }}
                      />
                    )}
                  </Group>
                )
              })}

              {/* Acabamentos LIVRES já adicionados (fora do cadastro) */}
              {form.acabamentosSelecionados
                .filter((a) => !a.acabamentoId && !acabamentosCad.some((c) => c.nome === a.nome))
                .map((a) => (
                  <Group key={`livre-${a.nome}`} gap="xs" wrap="nowrap" align="center">
                    <Checkbox
                      label={a.nome}
                      checked={!!a.marcado}
                      onChange={(e) => toggleAcabamento(a.nome, null, e.currentTarget.checked)}
                      style={{ minWidth: 220 }}
                    />
                    <TextInput
                      placeholder="Detalhe"
                      size="xs"
                      value={a.detalhe ?? ''}
                      onChange={(e) => setDetalheAcabamento(a.nome, e.currentTarget.value)}
                      style={{ flex: 1 }}
                    />
                  </Group>
                ))}

              {/* Adicionar acabamento livre */}
              <Group gap="xs" wrap="nowrap">
                <TextInput
                  placeholder="Outro acabamento (não listado)..."
                  size="xs"
                  value={acabLivre}
                  onChange={(e) => setAcabLivre(e.currentTarget.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); adicionarAcabamentoLivre() } }}
                  style={{ flex: 1 }}
                />
                <Button size="compact-sm" variant="light" leftSection={<IconPlus size={14} />} onClick={adicionarAcabamentoLivre}>
                  Adicionar
                </Button>
              </Group>
            </Stack>
            {acabamentosCad.length === 0 && (
              <Text size="xs" c="dimmed" mt={4}>Nenhum acabamento no cadastro — use o campo acima para adicionar.</Text>
            )}
          </div>
        <Textarea label="Acabamentos (texto livre / complemento)" mt="sm" minRows={2} value={form.acabamentos} onChange={(e) => set('acabamentos', e.currentTarget.value)} />
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

      {/* Modal — novo prazo (inline, sem sair do cadastro) */}
      <Modal opened={prazoModal} onClose={() => setPrazoModal(false)} title="Novo prazo de pagamento" centered>
        <Stack gap="md">
          <TextInput label="Descrição" placeholder="Ex.: 28/35/42, 30 dias, À vista" required value={prazoDesc} onChange={(e) => setPrazoDesc(e.currentTarget.value)} />
          <Group grow>
            <NumberInput label="Prazo médio (dias)" min={0} value={prazoDias} onChange={(v) => setPrazoDias(v === '' ? '' : Number(v))} />
            <NumberInput label="Parcelas" min={1} value={prazoParc} onChange={(v) => setPrazoParc(v === '' ? '' : Number(v))} />
          </Group>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setPrazoModal(false)}>Cancelar</Button>
            <Button loading={salvandoPrazo} onClick={salvarPrazoInline}>Salvar prazo</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Modal — novo cliente (grava na tabela de clientes e vincula) */}
      <Modal opened={clienteModal} onClose={() => setClienteModal(false)} title="Cadastrar novo cliente" centered>
        <Stack gap="md">
          <TextInput label="Razão social" required value={novoCli.razaoSocial} onChange={(e) => setNovoCli((c) => ({ ...c, razaoSocial: e.currentTarget.value }))} />
          <TextInput label="Nome fantasia" value={novoCli.nomeFantasia} onChange={(e) => setNovoCli((c) => ({ ...c, nomeFantasia: e.currentTarget.value }))} />
          <TextInput label="CPF/CNPJ" required value={novoCli.cpfCnpj} onChange={(e) => setNovoCli((c) => ({ ...c, cpfCnpj: e.currentTarget.value }))} />
          <Group grow>
            <TextInput label="UF" maxLength={2} value={novoCli.uf} onChange={(e) => setNovoCli((c) => ({ ...c, uf: e.currentTarget.value.toUpperCase() }))} />
            <TextInput label="Cidade" value={novoCli.cidade} onChange={(e) => setNovoCli((c) => ({ ...c, cidade: e.currentTarget.value }))} />
          </Group>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setClienteModal(false)}>Cancelar</Button>
            <Button loading={salvandoCli} onClick={salvarClienteInline}>Cadastrar e vincular</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}

// Center helper (evita import extra só p/ isso).
function Center({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>{children}</div>
}
