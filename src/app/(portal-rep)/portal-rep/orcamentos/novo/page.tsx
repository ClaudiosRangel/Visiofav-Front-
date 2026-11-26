'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Card, Textarea, NumberInput, Select, Checkbox, Button, Stack, Group, Title,
  Collapse, TextInput, Divider, SegmentedControl, Switch, SimpleGrid, Text, Autocomplete, Modal, ActionIcon,
  Alert, Badge, Loader,
} from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { usePortalRepClientes, useConsultarCnpj, useCriarCliente } from '@/data/hooks/portal-rep-app/usePortalRepClientes'
import { useCriarSolicitacao } from '@/data/hooks/portal-rep-app/usePortalRepOrcamentos'
import { CidadeAutocomplete } from '@/components/portal-rep/CidadeAutocomplete'
import { portalRepApi } from '@/data/hooks/portal-rep-app/portal-rep-api'
import {
  SUG_MERCADO, SUG_CORES, SUG_ACONDICIONAMENTO,
} from '@/app/(interna)/orcamento-grafico/pedidos/sugestoes-rfq'

// ─── Catálogo comercial único (mesmas listas de Pedidos/Propostas) ───────────
interface CatalogoComercial {
  tiposEmbalagem: Array<{ id: string; codigo: string; descricao: string }>
  acabamentos: Array<{ id: string; codigo: string; nome: string }>
  acondicionamentos: Array<{ id: string; nome: string }>
  suportes: Array<{ id: string; descricao: string; tipoSuporte: string; gramaturas: string[] }>
  prazos: Array<{ id: string; descricao: string }>
}

function useCatalogoComercial() {
  return useQuery<CatalogoComercial>({
    queryKey: ['portal-rep-catalogo-comercial'],
    queryFn: async () => (await portalRepApi.get('/catalogo/comercial')).data,
    staleTime: 5 * 60 * 1000,
  })
}

// Produtos do representante (pedido de Repetição), opcionalmente do cliente escolhido
function useMeusProdutos(clienteId: string | null, ativo: boolean) {
  return useQuery<Array<{ id: string; codigo: string; nome: string; ultimoPedidoEm: string | null }>>({
    queryKey: ['portal-rep-catalogo-meus-produtos', clienteId],
    enabled: ativo,
    queryFn: async () => {
      const { data } = await portalRepApi.get('/catalogo/meus-produtos', {
        params: clienteId ? { clienteId } : undefined,
      })
      return data
    },
    staleTime: 60 * 1000,
  })
}

// Pedidos concluídos de um produto (o representante escolhe qual repetir).
interface DadosPedidoOrigem {
  tipoEmbalagem: string; medidasTexto: string; cartao: string; gramatura: string
  camadas: Array<{ funcao: string; suporte: string; gramatura: string }>
  acabamentos: Array<{ acabamentoId: string | null; nome: string }>
  variacoesArte: string; situacaoFaca: string; numeroMatriz: string
  cartaoFsc: boolean; corteInternoVerso: boolean; passtime: boolean
  quantidadePorVolume: string; acondicionamento: string; tiragensTexto: string
}
interface PedidoOrigem {
  chave: string; origem: 'PROPOSTA' | 'SOLICITACAO' | 'VENDA'; numero: number | null
  data: string; quantidade: number | null; situacao: string; resumo: string; dados: DadosPedidoOrigem | null
}

function usePedidosDoProduto(produtoId: string | null, clienteId: string | null) {
  return useQuery<{ pedidos: PedidoOrigem[] }>({
    queryKey: ['portal-rep-catalogo-pedidos-produto', produtoId, clienteId],
    enabled: !!produtoId,
    queryFn: async () => {
      const { data } = await portalRepApi.get(`/catalogo/meus-produtos/${produtoId}/pedidos`, {
        params: clienteId ? { clienteId } : undefined,
      })
      return data
    },
    staleTime: 60 * 1000,
  })
}

const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI',
  'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
]

type Composicao = 'CARTAO' | 'CARTAO_MICRO' | 'CARTAO_CARTAO'
const COMPOSICOES: Array<{ value: Composicao; label: string; camadas: string[] }> = [
  { value: 'CARTAO', label: 'Cartão', camadas: ['Cartão'] },
  { value: 'CARTAO_MICRO', label: 'Cartão + Microondulado', camadas: ['Cartão', 'Microondulado'] },
  { value: 'CARTAO_CARTAO', label: 'Cartão + Cartão', camadas: ['Cartão', 'Cartão (2ª camada)'] },
]

export default function NovaSolicitacaoPage() {
  const router = useRouter()
  const { data: clientes, isLoading: carregandoClientes } = usePortalRepClientes()
  const { data: catalogo, isLoading: carregandoCatalogo } = useCatalogoComercial()
  const queryClient = useQueryClient()

  // ─── Novo prazo de pagamento (vai para o mesmo cadastro do Comercial) ───────
  const [prazoModal, setPrazoModal] = useState(false)
  const [prazoDesc, setPrazoDesc] = useState('')
  const [prazoDias, setPrazoDias] = useState<number | ''>(0)
  const [prazoParcelas, setPrazoParcelas] = useState<number | ''>(1)
  const [salvandoPrazo, setSalvandoPrazo] = useState(false)

  /** "28/35/42" ou "30,60,90" → parcelas = 3 e prazo médio = média dos dias; "30 dias" → 1 parcela, 30 dias. */
  function sugerirPrazo(desc: string) {
    const nums = (desc.match(/\d+/g) ?? []).map(Number).filter((n) => n > 0 && n <= 720)
    if (/vista/i.test(desc)) { setPrazoDias(0); setPrazoParcelas(1); return }
    if (nums.length === 0) return
    setPrazoParcelas(Math.min(60, nums.length))
    setPrazoDias(Math.round(nums.reduce((a, b) => a + b, 0) / nums.length))
  }

  async function salvarPrazo() {
    const descricao = prazoDesc.trim()
    if (descricao.length < 2) {
      notifications.show({ message: 'Informe a descrição do prazo (ex.: 28/35/42).', color: 'red' })
      return
    }
    setSalvandoPrazo(true)
    try {
      const { data } = await portalRepApi.post('/catalogo/prazos-pagamento', {
        descricao,
        dias: prazoDias === '' ? 0 : prazoDias,
        parcelas: prazoParcelas === '' ? 1 : prazoParcelas,
      })
      await queryClient.invalidateQueries({ queryKey: ['portal-rep-catalogo-comercial'] })
      setW('prazoPagamentoId', data.id)
      notifications.show({
        message: data.reaproveitado ? 'Esse prazo já existia: foi selecionado.' : 'Prazo cadastrado e selecionado.',
        color: 'green',
      })
      setPrazoModal(false); setPrazoDesc(''); setPrazoDias(0); setPrazoParcelas(1)
    } catch (err: any) {
      notifications.show({ message: err?.response?.data?.message || 'Falha ao cadastrar o prazo.', color: 'red' })
    } finally {
      setSalvandoPrazo(false)
    }
  }
  const criarSolicitacao = useCriarSolicitacao()
  const consultarCnpj = useConsultarCnpj()
  const criarCliente = useCriarCliente()

  // ─── Cliente novo: CNPJ, telefone e cidade são obrigatórios ─────────────────
  const [mostrarNovoCliente, setMostrarNovoCliente] = useState(false)
  const [novoCliente, setNovoCliente] = useState({
    cpfCnpj: '', razaoSocial: '', nomeFantasia: '', telefone: '', email: '',
    logradouro: '', numero: '', bairro: '', cidade: '', uf: '', cep: '',
  })
  const setNC = (k: keyof typeof novoCliente, v: string) => setNovoCliente((c) => ({ ...c, [k]: v }))

  async function buscarCnpj() {
    try {
      const d = await consultarCnpj.mutateAsync(novoCliente.cpfCnpj)
      setNovoCliente((c) => ({
        ...c,
        cpfCnpj: d.cpfCnpj || c.cpfCnpj,
        razaoSocial: d.razaoSocial || '',
        nomeFantasia: d.nomeFantasia || '',
        telefone: d.telefone || c.telefone,
        email: d.email || c.email,
        logradouro: d.logradouro || '',
        numero: d.numero || '',
        bairro: d.bairro || '',
        cidade: d.cidade || '',
        uf: d.uf || '',
        cep: d.cep || '',
      }))
      notifications.show({ message: 'Dados do CNPJ preenchidos. Confira e salve.', color: 'green' })
    } catch (err: any) {
      notifications.show({
        message: err?.response?.data?.message || 'Não foi possível consultar o CNPJ. Preencha manualmente.',
        color: 'orange',
      })
    }
  }

  async function salvarNovoCliente() {
    const faltando: string[] = []
    if (novoCliente.cpfCnpj.replace(/\D/g, '').length < 11) faltando.push('CNPJ/CPF')
    if (!novoCliente.razaoSocial.trim()) faltando.push('razão social')
    if (novoCliente.telefone.replace(/\D/g, '').length < 8) faltando.push('telefone')
    if (!novoCliente.cidade.trim()) faltando.push('cidade')
    if (faltando.length) {
      notifications.show({ message: `Informe: ${faltando.join(', ')}.`, color: 'red' })
      return
    }
    try {
      const criado = await criarCliente.mutateAsync({
        razaoSocial: novoCliente.razaoSocial,
        nomeFantasia: novoCliente.nomeFantasia || undefined,
        cpfCnpj: novoCliente.cpfCnpj,
        telefone: novoCliente.telefone,
        email: novoCliente.email || undefined,
        logradouro: novoCliente.logradouro || undefined,
        numero: novoCliente.numero || undefined,
        bairro: novoCliente.bairro || undefined,
        cidade: novoCliente.cidade,
        uf: novoCliente.uf || undefined,
        cep: novoCliente.cep || undefined,
      })
      notifications.show({ message: 'Cliente cadastrado e selecionado.', color: 'green' })
      setClienteId(criado.id)
      setMostrarNovoCliente(false)
    } catch (err: any) {
      notifications.show({
        message: err?.response?.data?.message || 'Falha ao cadastrar cliente.',
        color: 'red',
      })
    }
  }

  // ─── Estado do pedido ───────────────────────────────────────────────────────
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [tipoPedido, setTipoPedido] = useState<'NOVO' | 'REPETICAO'>('NOVO')
  const [mostruario, setMostruario] = useState(false) // pedido (novo ou repetição) com amostra para teste
  const [solicitaAlteracao, setSolicitaAlteracao] = useState(false) // alteração de arte ou faca
  const [produtoId, setProdutoId] = useState<string | null>(null)
  const [alteraImpressao, setAlteraImpressao] = useState(false)
  const [alteracaoImpressao, setAlteracaoImpressao] = useState('')
  const [tipoEmbalagem, setTipoEmbalagem] = useState<string | null>(null)
  const [tiragensTexto, setTiragensTexto] = useState('')
  const [comprimento, setComprimento] = useState<number | ''>('')
  const [largura, setLargura] = useState<number | ''>('')
  const [altura, setAltura] = useState<number | ''>('')
  const [composicao, setComposicao] = useState<Composicao>('CARTAO')
  const [camadas, setCamadas] = useState<Array<{ suporte: string; gramatura: string }>>([
    { suporte: '', gramatura: '' },
  ])
  const [acabamentosIds, setAcabamentosIds] = useState<string[]>([])
  const [acabamentoDetalhes, setAcabamentoDetalhes] = useState<Record<string, string>>({})
  const [situacaoFaca, setSituacaoFaca] = useState<'NOVA' | 'EXISTENTE'>('NOVA')
  const [observacoes, setObservacoes] = useState('')
  const [entregaMesmoEndereco, setEntregaMesmoEndereco] = useState(true)
  const [pdfs, setPdfs] = useState<File[]>([])
  const [w, setWega] = useState({
    mercado: '', ufOrigem: '', cidade: '', produtoNome: '',
    tipoEntrega: 'UNICA' as 'UNICA' | 'FRACIONADA', entregaFracionadaDias: '',
    prazoPagamentoId: '', variacoesArte: '', cartaoFsc: false, corteInternoVerso: false, passtime: false,
    numeroMatriz: '', acondicionamento: '', quantidadePorVolume: '',
    anexo1Url: '', anexo2Url: '', discriminacao: '', entregaEndereco: '',
  })
  const setW = (k: keyof typeof w, v: string | boolean) => setWega((s) => ({ ...s, [k]: v }))

  const repeticao = tipoPedido === 'REPETICAO'
  const { data: meusProdutos, isLoading: carregandoProdutos } = useMeusProdutos(clienteId, repeticao)
  const { data: origemData, isLoading: carregandoPedidos } = usePedidosDoProduto(repeticao ? produtoId : null, clienteId)
  const pedidosOrigem = origemData?.pedidos ?? []
  const [pedidoOrigemChave, setPedidoOrigemChave] = useState<string | null>(null)
  const [acabamentosRep, setAcabamentosRep] = useState<Array<{ acabamentoId: string | null; nome: string }>>([])
  const origemSemDados = !!pedidoOrigemChave && !pedidosOrigem.find((p) => p.chave === pedidoOrigemChave)?.dados
  const semProdutosParaRepetir = repeticao && !!clienteId && !carregandoProdutos && (meusProdutos ?? []).length === 0

  // Preenche o formulário com os dados do pedido escolhido (tudo é mantido na repetição).
  function aplicarPedidoOrigem(p: PedidoOrigem) {
    setPedidoOrigemChave(p.chave)
    const d = p.dados
    if (!d) {
      notifications.show({ color: 'orange', message: 'Este pedido não tem a especificação gravada. Confira os campos com o Comercial.' })
      return
    }
    if (d.tipoEmbalagem) setTipoEmbalagem(d.tipoEmbalagem)
    if (d.tiragensTexto) setTiragensTexto(d.tiragensTexto)
    const nums = (d.medidasTexto.match(/\d+([.,]\d+)?/g) ?? []).map((n) => Number(n.replace(',', '.')))
    setComprimento(nums[0] ?? ''); setLargura(nums[1] ?? ''); setAltura(nums[2] ?? '')
    const lista = d.camadas.length
      ? d.camadas
      : d.cartao ? [{ funcao: 'Cartão', suporte: d.cartao, gramatura: d.gramatura }] : []
    if (lista.length) {
      const comp: Composicao = lista.some((c) => c.funcao === 'Microondulado')
        ? 'CARTAO_MICRO' : lista.length > 1 ? 'CARTAO_CARTAO' : 'CARTAO'
      setComposicao(comp)
      setCamadas(lista.map((c) => ({ suporte: c.suporte, gramatura: c.gramatura ?? '' })))
    }
    setAcabamentosRep(d.acabamentos)
    setSituacaoFaca(d.situacaoFaca === 'EXISTENTE' ? 'EXISTENTE' : 'NOVA')
    setWega((s) => ({
      ...s,
      variacoesArte: d.variacoesArte, numeroMatriz: d.numeroMatriz,
      cartaoFsc: d.cartaoFsc, corteInternoVerso: d.corteInternoVerso, passtime: d.passtime,
      quantidadePorVolume: d.quantidadePorVolume, acondicionamento: d.acondicionamento,
    }))
  }

  const clienteOptions = (clientes ?? []).map((c) => ({
    value: c.id,
    label: c.razaoSocial + (c.nomeFantasia ? ` (${c.nomeFantasia})` : ''),
  }))
  // Mesmo padrão de nome do Pedido/Proposta: só a descrição do cadastro. O valor atual entra na lista
  // (ex.: tipo de um pedido repetido que não está mais no catálogo) para o campo não ficar vazio.
  const tipoEmbalagemOptions = Array.from(new Set([
    ...(catalogo?.tiposEmbalagem ?? []).map((t) => t.descricao),
    ...(tipoEmbalagem ? [tipoEmbalagem] : []),
  ])).map((d) => ({ value: d, label: d }))
  const acabamentosOptions = (catalogo?.acabamentos ?? []).map((a) => ({ value: a.id, label: a.nome }))
  const prazoOptions = (catalogo?.prazos ?? []).map((p) => ({ value: p.id, label: p.descricao }))
  const acondicionamentoOptions = useMemo(() => {
    const nomes = [...(catalogo?.acondicionamentos ?? []).map((a) => a.nome), ...SUG_ACONDICIONAMENTO]
    return Array.from(new Set(nomes.map((n) => n.trim()).filter(Boolean)))
  }, [catalogo])

  const camadasDef = COMPOSICOES.find((c) => c.value === composicao)!.camadas
  function trocarComposicao(v: Composicao) {
    setComposicao(v)
    const n = COMPOSICOES.find((c) => c.value === v)!.camadas.length
    setCamadas((atual) => Array.from({ length: n }, (_, i) => atual[i] ?? { suporte: '', gramatura: '' }))
  }
  function suportesDaCamada(funcao: string) {
    const todos = catalogo?.suportes ?? []
    const micro = todos.filter((s) => /MICRO/i.test(s.tipoSuporte))
    const cartao = todos.filter((s) => !/MICRO/i.test(s.tipoSuporte))
    const lista = funcao === 'Microondulado' ? (micro.length ? micro : todos) : (cartao.length ? cartao : todos)
    const atual = camadas[camadasDef.indexOf(funcao)]?.suporte
    return Array.from(new Set([...lista.map((s) => s.descricao), ...(atual ? [atual] : [])]))
  }
  function gramaturasDe(suporte: string) {
    const s = (catalogo?.suportes ?? []).find((x) => x.descricao === suporte)
    return s?.gramaturas ?? []
  }

  // Tiragens: lista (a primeira é a quantidade principal).
  const tiragensValidas = tiragensTexto
    .split(/[,;]/)
    .map((s) => Number(s.replace(/\D/g, '')))
    .filter((n) => Number.isFinite(n) && n > 0)
    .slice(0, 6)
  const camadasPreenchidas = camadas.every((c) => c.suporte.trim())

  const cidadeInformada = !!w.cidade.trim()
  const formValido =
    !!clienteId && !!tipoEmbalagem && tiragensValidas.length > 0 && cidadeInformada && !!w.mercado.trim() &&
    (!repeticao || (!!produtoId && !!pedidoOrigemChave)) &&
    (entregaMesmoEndereco || !!w.entregaEndereco.trim()) &&
    (w.tipoEntrega !== 'FRACIONADA' || !!w.entregaFracionadaDias.trim()) &&
    (camadasPreenchidas || (repeticao && origemSemDados))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formValido || !clienteId || !tipoEmbalagem) return

    const acabamentosSel = (catalogo?.acabamentos ?? [])
      .filter((a) => acabamentosIds.includes(a.id))
      .map((a) => ({ acabamentoId: a.id, nome: a.nome, detalhe: acabamentoDetalhes[a.id] ?? '' }))
    const acabamentosEnviar: Array<{ acabamentoId: string | null; nome: string; detalhe?: string }> = repeticao ? acabamentosRep : acabamentosSel
    const prazo = (catalogo?.prazos ?? []).find((p) => p.id === w.prazoPagamentoId)
    const medidasTexto = [comprimento, largura, altura].every((m) => typeof m === 'number' && m > 0)
      ? `${comprimento} x ${largura} x ${altura}` : ''

    criarSolicitacao.mutate(
      {
        clienteId,
        tipoEmbalagem,
        quantidade: tiragensValidas[0],
        tiragensTexto: tiragensValidas.join(', '),
        ...(typeof comprimento === 'number' && comprimento > 0 ? { medidaComprimento: comprimento } : {}),
        ...(typeof largura === 'number' && largura > 0 ? { medidaLargura: largura } : {}),
        ...(typeof altura === 'number' && altura > 0 ? { medidaAltura: altura } : {}),
        ...(medidasTexto ? { medidasTexto } : {}),
        ...(acabamentosEnviar.length
          ? {
              acabamentos: acabamentosEnviar.map((a) => a.nome).join(', '),
              acabamentosSelecionados: acabamentosEnviar.map((a) => ({ ...(a.acabamentoId ? { acabamentoId: a.acabamentoId } : {}), nome: a.nome, ...(a.detalhe?.trim() ? { detalhe: a.detalhe.trim() } : {}) })),
            }
          : {}),
        ...(observacoes.trim() ? { observacoes: observacoes.trim() } : {}),
        tipoPedido,
        exigeAmostra: mostruario,
        solicitaAlteracao,
        ...(repeticao && produtoId ? { produtoId } : {}),
        ...(repeticao && alteraImpressao && alteracaoImpressao.trim()
          ? { alteracaoImpressao: alteracaoImpressao.trim() } : {}),
        jaCliente: true,
        mercado: w.mercado.trim(),
        ...(w.ufOrigem ? { ufOrigem: w.ufOrigem } : {}),
        cidade: w.cidade.trim(),
        ...(w.produtoNome.trim() ? { produtoNome: w.produtoNome.trim() } : {}),
        tipoEntrega: w.tipoEntrega,
        ...(w.tipoEntrega === 'FRACIONADA' ? { entregaFracionadaDias: w.entregaFracionadaDias.trim() } : {}),
        entregaMesmoEndereco,
        ...(!entregaMesmoEndereco ? { entregaEndereco: w.entregaEndereco.trim() } : {}),
        ...(w.prazoPagamentoId ? { prazoPagamentoId: w.prazoPagamentoId } : {}),
        ...(prazo ? { prazoPagamento: prazo.descricao } : {}),
        ...(w.variacoesArte.trim() ? { variacoesArte: w.variacoesArte.trim() } : {}),
        materiaPrimaCamadas: camadas
          .map((c, i) => ({
            funcao: camadasDef[i], suporte: c.suporte.trim(),
            ...(c.gramatura.trim() ? { gramatura: c.gramatura.trim() } : {}),
          }))
          .filter((c) => c.suporte),
        cartaoFsc: w.cartaoFsc,
        corteInternoVerso: w.corteInternoVerso,
        passtime: w.passtime,
        situacaoFaca,
        ...(situacaoFaca === 'EXISTENTE' && w.numeroMatriz.trim()
          ? { numeroMatriz: w.numeroMatriz.trim(), matriz: w.numeroMatriz.trim() } : {}),
        ...(w.acondicionamento ? { acondicionamento: w.acondicionamento } : {}),
        ...(w.quantidadePorVolume.trim() ? { quantidadePorVolume: w.quantidadePorVolume.trim() } : {}),
        ...(w.anexo1Url.trim() ? { anexo1Url: w.anexo1Url.trim() } : {}),
        ...(w.anexo2Url.trim() ? { anexo2Url: w.anexo2Url.trim() } : {}),
        ...(w.discriminacao.trim() ? { discriminacao: w.discriminacao.trim() } : {}),
      },
      {
        onSuccess: async (criada) => {
          // Anexos em PDF: enviados após a criação (vão para o Pedido/Proposta).
          let falhas = 0
          for (const arq of pdfs) {
            try {
              const fd = new FormData()
              fd.append('file', arq)
              await portalRepApi.post(`/solicitacoes-orcamento/${criada.id}/anexos`, fd)
            } catch { falhas++ }
          }
          notifications.show({
            message: falhas
              ? `Solicitação enviada, mas ${falhas} anexo(s) PDF não foram enviados. Reenvie pelo Comercial.`
              : 'Solicitação de orçamento enviada com sucesso!',
            color: falhas ? 'orange' : 'green',
          })
          router.push('/portal-rep/orcamentos')
        },
        onError: (error: Error & { response?: { data?: { message?: string } } }) => {
          const msg =
            (error as unknown as { response?: { data?: { message?: string } } })
              .response?.data?.message || 'Erro ao enviar solicitação. Tente novamente.'
          notifications.show({ message: msg, color: 'red' })
        },
      },
    )
  }

  return (
    <Stack gap="md" p="md">
      <Title order={3}>Nova Solicitação de Orçamento</Title>

      <form onSubmit={handleSubmit}>
        <Stack gap="md">
          {/* 1. Tipo de pedido */}
          <Card>
            <Text size="sm" fw={600} mb={6}>Tipo de pedido</Text>
            <SegmentedControl
              fullWidth
              value={tipoPedido}
              onChange={(v) => {
                setTipoPedido(v as typeof tipoPedido)
                if (v !== 'REPETICAO') { setProdutoId(null); setAlteraImpressao(false); setPedidoOrigemChave(null); setAcabamentosRep([]) }
              }}
              data={[{ label: 'Novo', value: 'NOVO' }, { label: 'Repetição', value: 'REPETICAO' }]}
            />
            <Switch
              mt="sm"
              label="Solicitar mostruário (amostra para teste de embalagem)"
              description="Aprovada a amostra, o pedido segue o fluxo de mostruário."
              checked={mostruario}
              onChange={(e) => setMostruario(e.currentTarget.checked)}
            />
            <Switch
              mt="sm"
              label="Solicitar alteração (arte ou faca)"
              description="O pedido segue o fluxo de alteração."
              checked={solicitaAlteracao}
              onChange={(e) => setSolicitaAlteracao(e.currentTarget.checked)}
            />
            {mostruario && solicitaAlteracao && (
              <Text size="xs" c="dimmed" mt={4}>
                Com mostruário e alteração marcados, vale o fluxo de mostruário.
              </Text>
            )}
          </Card>

          {/* 2. Cliente */}
          <Card>
            <Select
              label="Cliente"
              placeholder="Selecione o cliente"
              data={clienteOptions}
              value={clienteId}
              onChange={(v) => {
                setClienteId(v); setProdutoId(null); setPedidoOrigemChave(null); setAcabamentosRep([])
                // Prazo padrão = o mais usado pelo cliente (só quando ainda não há prazo escolhido).
                if (v && !w.prazoPagamentoId) {
                  portalRepApi
                    .get(`/catalogo/clientes/${v}/prazo-padrao`)
                    .then(({ data }) => {
                      const id = data?.padrao?.prazoId as string | null | undefined
                      if (id && (catalogo?.prazos ?? []).some((p) => p.id === id)) setW('prazoPagamentoId', id)
                    })
                    .catch(() => undefined)
                }
              }}
              searchable
              nothingFoundMessage="Nenhum cliente encontrado"
              disabled={carregandoClientes}
              withAsterisk
            />
            <Button variant="subtle" size="compact-sm" mt="xs" onClick={() => setMostrarNovoCliente((v) => !v)}>
              {mostrarNovoCliente ? 'Cancelar cadastro' : 'Não achou? Cadastrar cliente novo'}
            </Button>
            <Collapse in={mostrarNovoCliente}>
              <Divider my="sm" label="Novo cliente (CNPJ, telefone e cidade são obrigatórios)" labelPosition="left" />
              <Stack gap="xs">
                <Group align="flex-end" gap="xs">
                  <TextInput label="CNPJ" placeholder="Somente números" withAsterisk value={novoCliente.cpfCnpj}
                    onChange={(e) => setNC('cpfCnpj', e.currentTarget.value)} style={{ flex: 1 }} />
                  <Button variant="light" loading={consultarCnpj.isPending} onClick={buscarCnpj}>
                    Buscar na Receita
                  </Button>
                </Group>
                <TextInput label="Razão social" withAsterisk value={novoCliente.razaoSocial}
                  onChange={(e) => setNC('razaoSocial', e.currentTarget.value)} />
                <TextInput label="Nome fantasia" value={novoCliente.nomeFantasia}
                  onChange={(e) => setNC('nomeFantasia', e.currentTarget.value)} />
                <Group grow>
                  <TextInput label="Telefone" withAsterisk value={novoCliente.telefone}
                    onChange={(e) => setNC('telefone', e.currentTarget.value)} />
                  <TextInput label="E-mail" value={novoCliente.email}
                    onChange={(e) => setNC('email', e.currentTarget.value)} />
                </Group>
                <Group grow>
                  <Select label="UF" data={UFS} searchable clearable value={novoCliente.uf || null}
                    onChange={(v) => setNC('uf', v ?? '')} />
                  <CidadeAutocomplete withAsterisk uf={novoCliente.uf} value={novoCliente.cidade}
                    onChange={(v) => setNC('cidade', v)} />
                </Group>
                <Button onClick={salvarNovoCliente} loading={criarCliente.isPending}>
                  Salvar e selecionar cliente
                </Button>
              </Stack>
            </Collapse>
          </Card>

          {/* 3. Produto e especificação */}
          <Card>
            <Text size="sm" fw={600} mb="xs">Produto</Text>
            <Stack gap="sm">
              {semProdutosParaRepetir && (
                <Alert color="orange" variant="light" title="Nada para repetir ainda">
                  Ainda não existe pedido concluído para repetir deste cliente. Faça um pedido do tipo Novo.
                </Alert>
              )}
              {repeticao && !semProdutosParaRepetir && (
                <Select
                  label="Produto a repetir"
                  placeholder={!clienteId ? 'Selecione o cliente primeiro' : carregandoProdutos ? 'Carregando...' : 'Selecione um produto já fabricado'}
                  description="Itens dos seus pedidos concluídos para este cliente."
                  data={(meusProdutos ?? []).map((p) => ({ value: p.id, label: `${p.codigo} - ${p.nome}` }))}
                  value={produtoId}
                  onChange={(v) => {
                    setProdutoId(v)
                    setPedidoOrigemChave(null)
                    setAcabamentosRep([])
                    const p = (meusProdutos ?? []).find((x) => x.id === v)
                    if (p) setW('produtoNome', p.nome)
                  }}
                  searchable clearable withAsterisk
                  disabled={!clienteId || carregandoProdutos}
                  nothingFoundMessage="Nenhum produto encontrado para este cliente"
                />
              )}

              {repeticao && produtoId && (
                <Stack gap="xs">
                  <Text size="sm" fw={600}>Escolha o pedido que será repetido <Text span c="red">*</Text></Text>
                  {carregandoPedidos && <Loader size="sm" />}
                  {!carregandoPedidos && pedidosOrigem.length === 0 && (
                    <Alert color="orange" variant="light">
                      Este produto ainda não tem pedido concluído para repetir.
                    </Alert>
                  )}
                  {pedidosOrigem.map((p) => {
                    const ativo = p.chave === pedidoOrigemChave
                    return (
                      <Card
                        key={p.chave} withBorder padding="sm" radius="md"
                        onClick={() => aplicarPedidoOrigem(p)}
                        style={{
                          cursor: 'pointer',
                          borderColor: ativo ? 'var(--mantine-color-green-6)' : undefined,
                          background: ativo ? 'var(--mantine-color-green-light)' : undefined,
                        }}
                      >
                        <Group justify="space-between" wrap="nowrap" align="flex-start">
                          <div>
                            <Group gap={6}>
                              <Text size="sm" fw={600}>
                                {p.numero != null ? `Pedido nº ${p.numero}` : 'Pedido'}
                              </Text>
                              <Badge size="xs" variant="light">{p.situacao}</Badge>
                            </Group>
                            <Text size="xs" c="dimmed">
                              {new Date(p.data).toLocaleDateString('pt-BR')}
                              {p.quantidade != null ? ` · ${p.quantidade.toLocaleString('pt-BR')} un` : ''}
                            </Text>
                            {p.resumo && <Text size="xs" mt={2}>{p.resumo}</Text>}
                          </div>
                          {ativo && <Badge color="green">Selecionado</Badge>}
                        </Group>
                      </Card>
                    )
                  })}
                  {pedidoOrigemChave && (
                    <Text size="xs" c="dimmed">
                      Os dados do pedido escolhido foram preenchidos abaixo. Informe só a nova quantidade e, se houver, a alteração na impressão.
                    </Text>
                  )}
                </Stack>
              )}

              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput label="Nome do produto" value={w.produtoNome}
                  onChange={(e) => setW('produtoNome', e.currentTarget.value)} />
                <Select
                  label="Tipo de embalagem" placeholder="Selecione" withAsterisk searchable
                  data={tipoEmbalagemOptions} value={tipoEmbalagem} onChange={setTipoEmbalagem}
                  nothingFoundMessage="Nenhum tipo encontrado" disabled={carregandoCatalogo}
                />
              </SimpleGrid>

              {/* Tiragens (mais de uma) */}
              <TextInput
                label="Quantidade (tiragens)"
                withAsterisk
                description="Separe por vírgula: 1000, 5000, 8000"
                placeholder="1000, 5000, 8000, 10000"
                value={tiragensTexto}
                onChange={(e) => setTiragensTexto(e.currentTarget.value)}
              />

              {repeticao ? (
                <>
                  {pedidoOrigemChave && !origemSemDados && (
                    <Card withBorder padding="sm" radius="md">
                      <Text size="sm" fw={600} mb={4}>Especificação do pedido repetido</Text>
                      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="xs">
                        <Text size="xs"><b>Medidas (mm):</b> {[comprimento, largura, altura].filter((m) => m !== '').join(' x ') || '—'}</Text>
                        <Text size="xs"><b>Material:</b> {camadas.filter((c) => c.suporte).map((c) => `${c.suporte}${c.gramatura ? ` ${c.gramatura}` : ''}`).join(' + ') || '—'}</Text>
                        <Text size="xs"><b>Cores:</b> {w.variacoesArte || '—'}</Text>
                        <Text size="xs"><b>Faca / matriz:</b> {situacaoFaca === 'EXISTENTE' ? `Existente${w.numeroMatriz ? ` (${w.numeroMatriz})` : ''}` : 'Nova'}</Text>
                        <Text size="xs"><b>Acabamentos:</b> {acabamentosRep.map((a) => a.nome).join(', ') || '—'}</Text>
                        <Text size="xs"><b>Acondicionamento:</b> {w.acondicionamento || '—'}{w.quantidadePorVolume ? ` · ${w.quantidadePorVolume} por volume` : ''}</Text>
                      </SimpleGrid>
                    </Card>
                  )}
                  {origemSemDados && (
                    <Alert color="orange" variant="light">
                      Este pedido não tem a especificação gravada. O Comercial confere os dados ao receber a solicitação.
                    </Alert>
                  )}
                  <Divider label="Impressão" labelPosition="left" />
                  <Text size="xs" c="dimmed">
                    Na repetição, o produto mantém material, medidas e acabamentos. Somente a impressão pode ser alterada.
                  </Text>
                  <Switch label="Haverá alteração na impressão?" checked={alteraImpressao}
                    onChange={(e) => setAlteraImpressao(e.currentTarget.checked)} />
                  {alteraImpressao && (
                    <>
                      <Autocomplete label="Cores / variações de arte" placeholder="4x0, 5x0, 2x0..."
                        data={SUG_CORES} value={w.variacoesArte} onChange={(v) => setW('variacoesArte', v)} />
                      <Textarea label="Descreva a alteração" autosize minRows={2} value={alteracaoImpressao}
                        onChange={(e) => setAlteracaoImpressao(e.currentTarget.value)} />
                    </>
                  )}
                </>
              ) : (
                <>
                  <Divider label="Medidas (mm)" labelPosition="left" />
                  <SimpleGrid cols={{ base: 1, sm: 3 }}>
                    <NumberInput label="Comprimento" placeholder="mm" min={0} value={comprimento}
                      onChange={(v) => setComprimento(v === '' ? '' : Number(v))} />
                    <NumberInput label="Largura" placeholder="mm" min={0} value={largura}
                      onChange={(v) => setLargura(v === '' ? '' : Number(v))} />
                    <NumberInput label="Altura" placeholder="mm" min={0} value={altura}
                      onChange={(v) => setAltura(v === '' ? '' : Number(v))} />
                  </SimpleGrid>

                  <Divider label="Matéria-prima" labelPosition="left" />
                  <Select label="Composição" data={COMPOSICOES.map((c) => ({ value: c.value, label: c.label }))}
                    value={composicao} onChange={(v) => v && trocarComposicao(v as Composicao)} allowDeselect={false}
                    description="Caixa acoplada: escolha a composição com mais de uma camada." />
                  {camadasDef.map((funcao, i) => (
                    <SimpleGrid key={funcao + i} cols={{ base: 1, sm: 2 }}>
                      <Select label={`${funcao} - tipo`} placeholder="Selecione" searchable withAsterisk
                        description={!carregandoCatalogo && (catalogo?.suportes ?? []).length === 0
                          ? 'Nenhum cartão cadastrado. Peça ao Comercial para cadastrar em Suportes.' : undefined}
                        nothingFoundMessage="Nenhum cartão encontrado" disabled={carregandoCatalogo}
                        data={suportesDaCamada(funcao)} value={camadas[i]?.suporte || null}
                        onChange={(v) => setCamadas((arr) => arr.map((c, j) => (j === i ? { suporte: v ?? '', gramatura: '' } : c)))} />
                      <Autocomplete label={`${funcao} - gramatura`} placeholder="Ex.: 300"
                        data={gramaturasDe(camadas[i]?.suporte ?? '')} value={camadas[i]?.gramatura ?? ''}
                        onChange={(v) => setCamadas((arr) => arr.map((c, j) => (j === i ? { ...c, gramatura: v } : c)))} />
                    </SimpleGrid>
                  ))}

                  <Autocomplete label="Cores / variações de arte" placeholder="4x0, 5x0, 2x0..."
                    data={SUG_CORES} value={w.variacoesArte} onChange={(v) => setW('variacoesArte', v)} />

                  <SimpleGrid cols={{ base: 1, sm: 2 }}>
                    <Select label="Faca / matriz" allowDeselect={false} value={situacaoFaca}
                      onChange={(v) => setSituacaoFaca((v as 'NOVA' | 'EXISTENTE') ?? 'NOVA')}
                      data={[{ value: 'NOVA', label: 'Matriz nova' }, { value: 'EXISTENTE', label: 'Matriz existente' }]} />
                    {situacaoFaca === 'EXISTENTE' && (
                      <TextInput label="Nº da matriz" placeholder="Ex.: 2529B" value={w.numeroMatriz}
                        onChange={(e) => setW('numeroMatriz', e.currentTarget.value)} />
                    )}
                  </SimpleGrid>

                  <Group gap="lg">
                    <Switch label="Cartão FSC" checked={w.cartaoFsc} onChange={(e) => setW('cartaoFsc', e.currentTarget.checked)} />
                    <Switch label="Impressão interna" checked={w.corteInternoVerso} onChange={(e) => setW('corteInternoVerso', e.currentTarget.checked)} />
                    <Switch label="Passtime (visor)" checked={w.passtime} onChange={(e) => setW('passtime', e.currentTarget.checked)} />
                  </Group>

                  <div>
                    <Text size="sm" fw={500} mb={4}>Acabamentos (marque e detalhe)</Text>
                    {!carregandoCatalogo && acabamentosOptions.length === 0 && (
                      <Text size="xs" c="dimmed">
                        Nenhum acabamento disponível na lista comercial. Peça ao Comercial para liberar em Cadastros → Acabamentos.
                      </Text>
                    )}
                    <Stack gap={6}>
                      {acabamentosOptions.map((a) => {
                        const marcado = acabamentosIds.includes(a.value)
                        return (
                          <Group key={a.value} gap="xs" wrap="nowrap" align="center">
                            <Checkbox
                              label={a.label}
                              checked={marcado}
                              onChange={(e) => setAcabamentosIds((ids) =>
                                e.currentTarget.checked ? [...ids, a.value] : ids.filter((x) => x !== a.value))}
                              style={{ minWidth: 220 }}
                            />
                            {marcado && (
                              <TextInput
                                placeholder="Detalhe (ex.: verniz localizado no logo)"
                                size="xs"
                                value={acabamentoDetalhes[a.value] ?? ''}
                                onChange={(e) => {
                                  const v = e.currentTarget.value
                                  setAcabamentoDetalhes((d) => ({ ...d, [a.value]: v }))
                                }}
                                style={{ flex: 1 }}
                              />
                            )}
                          </Group>
                        )
                      })}
                    </Stack>
                  </div>

                  <SimpleGrid cols={{ base: 1, sm: 2 }}>
                    <Select label="Forma de acondicionamento" placeholder="Selecione" clearable searchable
                      data={Array.from(new Set([...acondicionamentoOptions, ...(w.acondicionamento ? [w.acondicionamento] : [])]))} value={w.acondicionamento || null}
                      onChange={(v) => setW('acondicionamento', v ?? '')} />
                    <TextInput label="Quant. por volume" value={w.quantidadePorVolume}
                      onChange={(e) => setW('quantidadePorVolume', e.currentTarget.value)} />
                  </SimpleGrid>
                </>
              )}

              <Textarea label="Observações" placeholder="Informações adicionais sobre a solicitação"
                value={observacoes} onChange={(e) => setObservacoes(e.currentTarget.value)} minRows={3} autosize />
            </Stack>
          </Card>

          {/* 4. Entrega e pagamento */}
          <Card>
            <Text size="sm" fw={600} mb="xs">Entrega e pagamento</Text>
            <Stack gap="sm">
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <Autocomplete label="Mercado atuante" withAsterisk placeholder="Ex.: Alimentício, Cosméticos"
                  data={SUG_MERCADO} value={w.mercado} onChange={(v) => setW('mercado', v)} />
                <Group gap={6} align="flex-end" wrap="nowrap">
                  <Select label="Prazo de pagamento" placeholder={prazoOptions.length ? 'Selecione' : 'Nenhum prazo cadastrado'}
                    data={prazoOptions} value={w.prazoPagamentoId || null} clearable style={{ flex: 1 }}
                    onChange={(v) => setW('prazoPagamentoId', v ?? '')} />
                  <ActionIcon variant="light" size={36} aria-label="Novo prazo de pagamento" title="Novo prazo de pagamento"
                    onClick={() => setPrazoModal(true)}>
                    <IconPlus size={18} />
                  </ActionIcon>
                </Group>
              </SimpleGrid>
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <Select label="UF" data={UFS} searchable clearable value={w.ufOrigem || null}
                  onChange={(v) => setW('ufOrigem', v ?? '')} />
                <CidadeAutocomplete label="Cidade de origem" withAsterisk uf={w.ufOrigem} value={w.cidade}
                  onChange={(v) => setW('cidade', v)} />
              </SimpleGrid>

              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <div>
                  <Text size="sm" mb={4}>Entrega</Text>
                  <SegmentedControl fullWidth value={w.tipoEntrega} onChange={(v) => setW('tipoEntrega', v)}
                    data={[{ label: 'Única', value: 'UNICA' }, { label: 'Fracionada', value: 'FRACIONADA' }]} />
                </div>
                {w.tipoEntrega === 'FRACIONADA' && (
                  <TextInput label="A cada quantos dias?" withAsterisk value={w.entregaFracionadaDias}
                    onChange={(e) => setW('entregaFracionadaDias', e.currentTarget.value)} />
                )}
              </SimpleGrid>

              <Switch label="Entrega no mesmo endereço do CNPJ" checked={entregaMesmoEndereco}
                onChange={(e) => setEntregaMesmoEndereco(e.currentTarget.checked)} />
              {!entregaMesmoEndereco && (
                <Textarea label="Endereço de entrega" withAsterisk autosize minRows={2}
                  placeholder="Rua, número, bairro, cidade, UF, CEP"
                  value={w.entregaEndereco} onChange={(e) => setW('entregaEndereco', e.currentTarget.value)} />
              )}
            </Stack>
          </Card>

          {/* 5. Anexos e discriminação */}
          <Card>
            <Text size="sm" fw={600} mb="xs">Anexos e discriminação</Text>
            <Stack gap="sm">
              <SimpleGrid cols={{ base: 1, sm: 2 }}>
                <TextInput label="Anexo 1 (link)" placeholder="Drive / WhatsApp" value={w.anexo1Url}
                  onChange={(e) => setW('anexo1Url', e.currentTarget.value)} />
                <TextInput label="Anexo 2 (link)" value={w.anexo2Url}
                  onChange={(e) => setW('anexo2Url', e.currentTarget.value)} />
              </SimpleGrid>
              <div>
                <Text size="sm" fw={500} mb={4}>Anexos em PDF (até 3 arquivos, 10 MB cada)</Text>
                <input
                  type="file" accept="application/pdf" multiple
                  onChange={(e) => {
                    const lista = Array.from(e.currentTarget.files ?? [])
                    const validos = lista.filter((f) => f.type === 'application/pdf' && f.size <= 10 * 1024 * 1024).slice(0, 3)
                    if (validos.length < lista.length) {
                      notifications.show({ message: 'Somente PDF até 10 MB, no máximo 3 arquivos.', color: 'orange' })
                    }
                    setPdfs(validos)
                  }}
                />
                {pdfs.length > 0 && (
                  <Text size="xs" c="dimmed" mt={4}>{pdfs.map((f) => f.name).join(', ')}</Text>
                )}
              </div>
              <Textarea label="Discriminação (itens do pedido)" placeholder="Produto / descrição / quantidade por item"
                value={w.discriminacao} onChange={(e) => setW('discriminacao', e.currentTarget.value)} autosize minRows={2} />
            </Stack>
          </Card>

          <Button type="submit" fullWidth loading={criarSolicitacao.isPending}
            disabled={!formValido || criarSolicitacao.isPending}>
            Enviar Solicitação
          </Button>
        </Stack>
      </form>

      <Modal opened={prazoModal} onClose={() => setPrazoModal(false)} title="Novo prazo de pagamento" centered>
        <Stack gap="sm">
          <TextInput
            label="Descrição" withAsterisk placeholder="Ex.: 28/35/42, 30 dias, À vista"
            value={prazoDesc}
            onChange={(e) => { setPrazoDesc(e.currentTarget.value); sugerirPrazo(e.currentTarget.value) }}
            data-autofocus
          />
          <SimpleGrid cols={2}>
            <NumberInput label="Prazo médio (dias)" min={0} max={720} value={prazoDias}
              onChange={(v) => setPrazoDias(v === '' ? '' : Number(v))} />
            <NumberInput label="Parcelas" min={1} max={60} value={prazoParcelas}
              onChange={(v) => setPrazoParcelas(v === '' ? '' : Number(v))} />
          </SimpleGrid>
          <Text size="xs" c="dimmed">
            Dias e parcelas são sugeridos pela descrição; confira antes de salvar. O prazo fica disponível para todo o Comercial.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setPrazoModal(false)}>Cancelar</Button>
            <Button loading={salvandoPrazo} onClick={salvarPrazo}>Salvar prazo</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
