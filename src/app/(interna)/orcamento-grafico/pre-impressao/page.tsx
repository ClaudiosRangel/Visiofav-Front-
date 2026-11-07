'use client'

/**
 * Board da Pré-Impressão (spec comercial-pre-impressao-board).
 * Lista os pedidos em EM_PRE_IMPRESSAO e, ao abrir um, mostra as 4 etapas
 * (Mockup → Arte → Padrão → Ficha Técnica) com ações de iniciar/concluir/voltar.
 * Consome /orcamento-grafico/pre-impressao/pedidos e /pedidos-proposta/:id/board.
 */
import { useCallback, useEffect, useState } from 'react'
import {
  Title, Stack, Group, Paper, Text, Badge, Button, Loader, Center, Progress,
  Modal, Textarea, Tooltip, TextInput, Image, FileButton, NumberInput, Select, SimpleGrid,
} from '@mantine/core'
import {
  IconRefresh, IconLayoutColumns, IconPlayerPlay, IconCheck, IconArrowBackUp,
  IconUpload, IconPhotoOff,
} from '@tabler/icons-react'
import { api } from '@/lib/api'
import { getAuthToken } from '@/lib/authStorage'
import { notifications } from '@mantine/notifications'

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3333/api'

interface AnexoMeta { id: string; nome: string; tipo: string }

interface FichaForm {
  cartao: string; gramatura: string; numCores: number | ''
  coresDescricao: string; acabamentos: string; observacoes: string
  numeroMatriz: string; imagemFaca: string | null
  dimensoes: Array<{ tipo: string; larguraMm: number | ''; alturaMm: number | ''; profundidadeMm: number | '' }>
}
const FICHA_VAZIA: FichaForm = {
  cartao: '', gramatura: '', numCores: '', coresDescricao: '', acabamentos: '', observacoes: '',
  numeroMatriz: '', imagemFaca: null, dimensoes: [],
}
const TIPOS_DIM = [
  { value: 'PRODUTO_FINAL', label: 'Produto final' },
  { value: 'PLANIFICADO', label: 'Planificado' },
  { value: 'FOLHA', label: 'Folha' },
]

interface ResumoPedido {
  pedidoId: string
  numero: number
  clienteNome: string | null
  produtoNome: string | null
  caminho: 'CONFERENCIA' | 'PARCIAL' | 'COMPLETA'
  concluidas: number
  totalRelevantes: number
  setorResponsavel: string | null
  tempoParadoMinutos: number | null
}

interface EtapaView {
  etapa: 'MOCKUP' | 'ARTE' | 'PADRAO' | 'FICHA_TECNICA'
  status: 'PENDENTE' | 'EM_ANDAMENTO' | 'CONCLUIDA'
  ordem: number
  relevante: boolean
  observacao: string | null
  dataInicio: string | null
  dataConclusao: string | null
}

const ETAPA_LABEL: Record<string, string> = {
  MOCKUP: 'Mockup', ARTE: 'Arte', PADRAO: 'Padrão', FICHA_TECNICA: 'Ficha Técnica',
}
const STATUS_CFG: Record<string, { color: string; label: string }> = {
  PENDENTE: { color: 'gray', label: 'Pendente' },
  EM_ANDAMENTO: { color: 'blue', label: 'Em andamento' },
  CONCLUIDA: { color: 'teal', label: 'Concluída' },
}
const CAMINHO_LABEL: Record<string, string> = {
  CONFERENCIA: 'Conferência (repetição)', PARCIAL: 'Parcial (alteração)', COMPLETA: 'Completa (produto novo)',
}

function fmtTempo(min: number | null): string {
  if (min == null) return '—'
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} h`
  return `${Math.floor(h / 24)} d`
}

export default function PreImpressaoPage() {
  useEffect(() => { document.title = 'Pré-Impressão' }, [])
  const [lista, setLista] = useState<ResumoPedido[]>([])
  const [loading, setLoading] = useState(true)
  const [aberto, setAberto] = useState<ResumoPedido | null>(null)
  const [etapas, setEtapas] = useState<EtapaView[]>([])
  const [caminho, setCaminho] = useState<string>('')
  const [concluido, setConcluido] = useState(false)
  const [loadingBoard, setLoadingBoard] = useState(false)
  const [acao, setAcao] = useState(false)
  const [obsAlvo, setObsAlvo] = useState<{ etapa: string; status: string } | null>(null)
  const [obs, setObs] = useState('')
  // Ficha Master em RASCUNHO (preenchida aqui; só vai ao cadastro do produto
  // depois que o cliente aprova a arte).
  const [fm, setFm] = useState<FichaForm>(FICHA_VAZIA)
  const [fmInfo, setFmInfo] = useState<{ produtoId: string | null; aprovada: boolean; publicadaEm: string | null; provisorio: boolean }>(
    { produtoId: null, aprovada: false, publicadaEm: null, provisorio: false },
  )
  const [salvandoFaca, setSalvandoFaca] = useState(false)
  const [publicando, setPublicando] = useState(false)
  const [imgAmpliada, setImgAmpliada] = useState(false)
  // Pré-cálculo (auxiliar da pré-impressão; não substitui o envio ao orçamento)
  const [preCalc, setPreCalc] = useState<{ status: string; solicitadoEm: string | null; observacao: string | null }>(
    { status: 'NENHUM', solicitadoEm: null, observacao: null },
  )
  const [preCalcObs, setPreCalcObs] = useState('')
  const [preCalcBusy, setPreCalcBusy] = useState(false)

  async function solicitarPreCalculo() {
    if (!aberto) return
    setPreCalcBusy(true)
    try {
      const { data } = await api.post(`/orcamento-grafico/pedidos-proposta/${aberto.pedidoId}/pre-calculo/solicitar`, { observacao: preCalcObs.trim() || undefined })
      setPreCalc(data)
      notifications.show({ message: 'Pré-cálculo solicitado ao Orçamento.', color: 'green' })
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao solicitar pré-cálculo', color: 'red' })
    } finally {
      setPreCalcBusy(false)
    }
  }

  async function concluirPreCalculo() {
    if (!aberto) return
    setPreCalcBusy(true)
    try {
      const { data } = await api.post(`/orcamento-grafico/pedidos-proposta/${aberto.pedidoId}/pre-calculo/concluir`, { observacao: preCalcObs.trim() || undefined })
      setPreCalc(data)
      notifications.show({ message: 'Pré-cálculo marcado como concluído.', color: 'green' })
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao concluir pré-cálculo', color: 'red' })
    } finally {
      setPreCalcBusy(false)
    }
  }

  function aplicarFicha(d: any) {
    const r = d?.rascunho ?? {}
    setFm({
      cartao: r.cartao ?? '', gramatura: r.gramatura ?? '', numCores: r.numCores ?? '',
      coresDescricao: r.coresDescricao ?? '', acabamentos: r.acabamentos ?? '',
      observacoes: r.observacoes ?? '', numeroMatriz: d?.numeroMatriz ?? '',
      imagemFaca: d?.imagemFaca ?? null,
      dimensoes: (r.dimensoes ?? []).map((x: any) => ({
        tipo: x.tipo, larguraMm: x.larguraMm ?? '', alturaMm: x.alturaMm ?? '', profundidadeMm: x.profundidadeMm ?? '',
      })),
    })
    setFmInfo({ produtoId: d?.produtoId ?? null, aprovada: !!d?.artePorClienteAprovada, publicadaEm: d?.publicadaEm ?? null, provisorio: !!d?.produtoProvisorio })
  }

  function payloadFicha(f: FichaForm) {
    const n = (v: number | '') => (v === '' ? null : v)
    return {
      rascunho: {
        cartao: f.cartao || null, gramatura: f.gramatura || null, numCores: n(f.numCores),
        coresDescricao: f.coresDescricao || null, acabamentos: f.acabamentos || null,
        observacoes: f.observacoes || null,
        dimensoes: f.dimensoes.map((d) => ({
          tipo: d.tipo, larguraMm: n(d.larguraMm), alturaMm: n(d.alturaMm), profundidadeMm: n(d.profundidadeMm),
        })),
      },
      imagemFaca: f.imagemFaca,
      numeroMatriz: f.numeroMatriz.trim() || null,
    }
  }
  // Imagens da arte (anexos do pedido) — são as que o cliente vê no link de aprovação
  const [artes, setArtes] = useState<AnexoMeta[]>([])
  const [artePreview, setArtePreview] = useState<string | null>(null)
  const [enviandoArte, setEnviandoArte] = useState(false)

  function urlArte(pedidoId: string, anexoId: string) {
    return `${API_BASE}/orcamento-grafico/pedidos-proposta/${pedidoId}/anexos/${anexoId}?token=${getAuthToken() ?? ''}`
  }

  async function enviarArte(file: File | null) {
    if (!file || !aberto) return
    if (artes.length >= 5) {
      notifications.show({ message: 'Limite de 5 imagens atingido.', color: 'orange' })
      return
    }
    setEnviandoArte(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await api.post(`/orcamento-grafico/pedidos-proposta/${aberto.pedidoId}/anexos`, fd)
      const { data } = await api.get(`/orcamento-grafico/pedidos-proposta/${aberto.pedidoId}/anexos`)
      setArtes(Array.isArray(data) ? data : [])
    } catch (err: any) {
      const code = err?.response?.data?.code
      const msg = code === 'LIMITE_ANEXOS' ? 'Limite de 5 imagens.'
        : code === 'MIME_INVALIDO' ? 'Apenas imagens são aceitas.'
        : code === 'ARQUIVO_GRANDE' ? 'Imagem acima de 10MB.'
        : err?.response?.data?.message || 'Falha ao enviar imagem.'
      notifications.show({ title: 'Arte', message: msg, color: 'red' })
    } finally {
      setEnviandoArte(false)
    }
  }

  async function removerArte(anexoId: string) {
    if (!aberto) return
    try {
      await api.delete(`/orcamento-grafico/pedidos-proposta/${aberto.pedidoId}/anexos/${anexoId}`)
      setArtes((a) => a.filter((x) => x.id !== anexoId))
    } catch {
      notifications.show({ title: 'Arte', message: 'Falha ao remover.', color: 'red' })
    }
  }

  async function salvarFaca(dados: FichaForm) {
    if (!aberto) return
    setSalvandoFaca(true)
    try {
      const { data } = await api.put(
        `/orcamento-grafico/pedidos-proposta/${aberto.pedidoId}/ficha-rascunho`, payloadFicha(dados),
      )
      aplicarFicha(data)
      notifications.show({ message: 'Ficha Master (rascunho) salva neste pedido.', color: 'green' })
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao salvar a ficha', color: 'red' })
    } finally {
      setSalvandoFaca(false)
    }
  }

  async function publicarFicha() {
    if (!aberto) return
    setPublicando(true)
    try {
      await api.post(`/orcamento-grafico/pedidos-proposta/${aberto.pedidoId}/ficha-rascunho/publicar`)
      const { data } = await api.get(`/orcamento-grafico/pedidos-proposta/${aberto.pedidoId}/ficha-rascunho`)
      aplicarFicha(data)
      notifications.show({ message: 'Ficha publicada na Ficha Master do produto.', color: 'green' })
    } catch (err: any) {
      notifications.show({ title: 'Não foi possível publicar', message: err?.response?.data?.message || 'Falha', color: 'orange' })
    } finally {
      setPublicando(false)
    }
  }

  function escolherImagem(file: File | null) {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      notifications.show({ message: 'A imagem deve ter no máximo 5MB.', color: 'red' })
      return
    }
    const r = new FileReader()
    r.onload = () => setFm((f) => ({ ...f, imagemFaca: r.result as string }))
    r.readAsDataURL(file)
  }

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/orcamento-grafico/pre-impressao/pedidos')
      setLista(Array.isArray(data) ? data : [])
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao carregar', color: 'red' })
      setLista([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  // Abre direto o board quando a URL traz ?pedido=<id> (clique no status macro).
  useEffect(() => {
    if (loading || aberto) return
    const alvo = new URLSearchParams(window.location.search).get('pedido')
    if (!alvo) return
    const p = lista.find((x) => x.pedidoId === alvo)
    if (p) abrirBoard(p)
    // se não está na lista (ex.: saiu da pré-impressão), ignora silenciosamente
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, lista])

  const abrirBoard = useCallback(async (p: ResumoPedido) => {
    setAberto(p)
    setLoadingBoard(true)
    try {
      const { data } = await api.get(`/orcamento-grafico/pedidos-proposta/${p.pedidoId}/board`)
      setEtapas(data.etapas ?? [])
      setCaminho(data.caminho ?? '')
      setConcluido(!!data.concluido)
      try {
        const f = await api.get(`/orcamento-grafico/pedidos-proposta/${p.pedidoId}/ficha-rascunho`)
        aplicarFicha(f.data)
      } catch { /* ficha é complementar — não bloqueia o board */ }
      try {
        const a = await api.get(`/orcamento-grafico/pedidos-proposta/${p.pedidoId}/anexos`)
        setArtes(Array.isArray(a.data) ? a.data : [])
      } catch { setArtes([]) }
      try {
        const pc = await api.get(`/orcamento-grafico/pedidos-proposta/${p.pedidoId}/pre-calculo`)
        setPreCalc(pc.data); setPreCalcObs(pc.data?.observacao ?? '')
      } catch { setPreCalc({ status: 'NENHUM', solicitadoEm: null, observacao: null }) }
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao abrir board', color: 'red' })
    } finally {
      setLoadingBoard(false)
    }
  }, [])

  async function mudar(etapa: string, status: string, observacao?: string) {
    if (!aberto) return
    setAcao(true)
    try {
      await api.patch(`/orcamento-grafico/pedidos-proposta/${aberto.pedidoId}/board/${etapa}`, { status, observacao })
      await abrirBoard(aberto)
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao atualizar etapa', color: 'red' })
    } finally {
      setAcao(false)
    }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Pré-Impressão</Title>
          <Text size="sm" c="dimmed">Pedidos em pré-impressão: Mockup → Arte → Padrão → Ficha Técnica. {lista.length} pedido(s).</Text>
        </div>
        <Button variant="light" leftSection={<IconRefresh size={16} />} onClick={carregar}>Atualizar</Button>
      </Group>

      {loading ? (
        <Center py="xl"><Loader /></Center>
      ) : lista.length === 0 ? (
        <Paper p="xl" withBorder><Text c="dimmed" ta="center">Nenhum pedido em pré-impressão.</Text></Paper>
      ) : (
        <Stack gap="sm">
          {lista.map((p) => {
            const pct = p.totalRelevantes > 0 ? Math.round((p.concluidas / p.totalRelevantes) * 100) : 0
            return (
              <Paper key={p.pedidoId} p="md" withBorder>
                <Group justify="space-between" wrap="nowrap">
                  <Group gap="xs" wrap="nowrap" style={{ minWidth: 0 }}>
                    <Text fw={700}>Pedido {p.numero}</Text>
                    <Text size="sm" c="dimmed" truncate="end">{p.clienteNome || '—'}</Text>
                    <Badge variant="light" color="grape">{CAMINHO_LABEL[p.caminho] || p.caminho}</Badge>
                  </Group>
                  <Group gap="md" wrap="nowrap">
                    <div style={{ width: 160 }}>
                      <Text size="xs" c="dimmed" ta="right">{p.concluidas}/{p.totalRelevantes} etapas</Text>
                      <Progress value={pct} color={pct === 100 ? 'teal' : 'blue'} />
                    </div>
                    <Text size="xs" c="dimmed">parado {fmtTempo(p.tempoParadoMinutos)}</Text>
                    <Button size="compact-sm" variant="light" leftSection={<IconLayoutColumns size={14} />}
                      onClick={() => abrirBoard(p)}>
                      Abrir board
                    </Button>
                  </Group>
                </Group>
              </Paper>
            )
          })}
        </Stack>
      )}

      {/* Board do pedido */}
      <Modal opened={!!aberto} onClose={() => setAberto(null)} size="xl"
        title={aberto ? `Pré-Impressão — Pedido ${aberto.numero} (${aberto.clienteNome || ''})` : ''}>
        {loadingBoard ? (
          <Center py="xl"><Loader /></Center>
        ) : (
          <Stack gap="md">
            <Group gap="xs">
              <Badge variant="light" color="grape">{CAMINHO_LABEL[caminho] || caminho}</Badge>
              {concluido && <Badge color="teal" leftSection={<IconCheck size={12} />}>Pré-impressão concluída</Badge>}
            </Group>
            <Group align="stretch" grow wrap="nowrap">
              {etapas.map((e) => {
                const cfg = STATUS_CFG[e.status]
                return (
                  <Paper key={e.etapa} p="sm" withBorder style={{ opacity: e.relevante ? 1 : 0.5 }}>
                    <Stack gap={6}>
                      <Group justify="space-between" gap={4}>
                        <Text fw={600} size="sm">{ETAPA_LABEL[e.etapa]}</Text>
                        {!e.relevante && <Tooltip label="Não exigida neste tipo de pedido"><Badge size="xs" variant="outline" color="gray">opc.</Badge></Tooltip>}
                      </Group>
                      <Badge color={cfg.color} variant="light">{cfg.label}</Badge>
                      {e.observacao && <Text size="xs" c="dimmed" fs="italic">“{e.observacao}”</Text>}
                      <Group gap={4} mt={4}>
                        {e.status !== 'EM_ANDAMENTO' && e.status !== 'CONCLUIDA' && (
                          <Button size="compact-xs" variant="light" color="blue" leftSection={<IconPlayerPlay size={12} />}
                            loading={acao} onClick={() => mudar(e.etapa, 'EM_ANDAMENTO')}>Iniciar</Button>
                        )}
                        {e.status !== 'CONCLUIDA' && (
                          <Button size="compact-xs" color="teal" leftSection={<IconCheck size={12} />}
                            loading={acao} onClick={() => { setObsAlvo({ etapa: e.etapa, status: 'CONCLUIDA' }); setObs('') }}>Concluir</Button>
                        )}
                        {e.status === 'CONCLUIDA' && (
                          <Button size="compact-xs" variant="subtle" color="orange" leftSection={<IconArrowBackUp size={12} />}
                            loading={acao} onClick={() => mudar(e.etapa, 'EM_ANDAMENTO')}>Voltar</Button>
                        )}
                      </Group>
                    </Stack>
                  </Paper>
                )
              })}
            </Group>

            {/* Arte / mockup para aprovação do cliente (aparece no link público) */}
            <Paper p="sm" withBorder>
              <Group justify="space-between" mb={2}>
                <Text fw={600} size="sm">Imagens da arte (aprovação do cliente)</Text>
                <Badge variant="light" color="gray">{artes.length}/5</Badge>
              </Group>
              <Text size="xs" c="dimmed" mb="sm">
                Estas são as imagens que o cliente vê no link de aprovação de arte. Anexe aqui o mockup/arte antes de enviar o link.
              </Text>
              <Group gap="sm" align="flex-end">
                {aberto && artes.map((a) => (
                  <div key={a.id} style={{ position: 'relative' }}>
                    <Image src={urlArte(aberto.pedidoId, a.id)} alt={a.nome} h={90} w={90} fit="cover" radius="sm"
                      style={{ cursor: 'zoom-in', border: '1px solid var(--mantine-color-default-border)' }}
                      onClick={() => setArtePreview(urlArte(aberto.pedidoId, a.id))} />
                    <Button size="compact-xs" variant="subtle" color="red" onClick={() => removerArte(a.id)}>Remover</Button>
                  </div>
                ))}
                {artes.length < 5 && (
                  <FileButton accept="image/*" onChange={enviarArte}>
                    {(props) => (
                      <Button {...props} size="xs" variant="light" leftSection={<IconUpload size={14} />} loading={enviandoArte}>
                        Anexar imagem
                      </Button>
                    )}
                  </FileButton>
                )}
              </Group>
            </Paper>

            {/* Pré-cálculo (auxiliar — não substitui o envio ao orçamento) */}
            <Paper p="sm" withBorder>
              <Group justify="space-between" mb={2}>
                <Text fw={600} size="sm">Pré-cálculo</Text>
                {preCalc.status === 'SOLICITADO' ? (
                  <Badge color="orange" variant="light">Solicitado</Badge>
                ) : preCalc.status === 'CONCLUIDO' ? (
                  <Badge color="teal" variant="light">Concluído</Badge>
                ) : (
                  <Badge color="gray" variant="light">Não solicitado</Badge>
                )}
              </Group>
              <Text size="xs" c="dimmed" mb="sm">
                Estimativa opcional durante a pré-impressão. NÃO substitui o cálculo oficial — o pedido sempre vai ao Orçamento depois.
              </Text>
              <Textarea placeholder="Observação (opcional): o que estimar" autosize minRows={2}
                value={preCalcObs} onChange={(e) => setPreCalcObs(e.currentTarget.value)} />
              <Group justify="flex-end" mt="xs" gap="xs">
                <Button size="xs" variant="light" loading={preCalcBusy} onClick={solicitarPreCalculo}>
                  {preCalc.status === 'NENHUM' ? 'Solicitar pré-cálculo' : 'Reenviar solicitação'}
                </Button>
                {preCalc.status === 'SOLICITADO' && (
                  <Button size="xs" color="teal" variant="light" loading={preCalcBusy} onClick={concluirPreCalculo}>
                    Marcar concluído
                  </Button>
                )}
              </Group>
            </Paper>

            {/* Faca do produto — responsabilidade da Pré-Impressão */}
            <Paper p="sm" withBorder>
              <Group justify="space-between" mb={2}>
                <Text fw={600} size="sm">Ficha Master do produto (rascunho)</Text>
                {fmInfo.publicadaEm ? (
                  <Badge color="teal" variant="light">Produto definitivo</Badge>
                ) : fmInfo.provisorio ? (
                  <Badge color="orange" variant="light">Produto provisório (aguarda aprovação)</Badge>
                ) : (
                  <Badge color="yellow" variant="light">Rascunho</Badge>
                )}
              </Group>
              <Text size="xs" c="dimmed" mb="sm">
                Preencha a ficha técnica aqui. Ao salvar, o produto é criado como PROVISÓRIO e fica registrado (histórico preservado), mas inativo e fora do uso normal. Quando o cliente aprovar a arte, ele vira DEFINITIVO e entra no cadastro.
              </Text>

              <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="xs">
                <TextInput label="Cartão" value={fm.cartao} onChange={(e) => setFm({ ...fm, cartao: e.currentTarget.value })} />
                <TextInput label="Gramatura" value={fm.gramatura} onChange={(e) => setFm({ ...fm, gramatura: e.currentTarget.value })} />
                <NumberInput label="Nº de cores" min={0} max={20} value={fm.numCores}
                  onChange={(v) => setFm({ ...fm, numCores: typeof v === 'number' ? v : '' })} />
              </SimpleGrid>
              <TextInput mt="xs" label="Cores (descrição)" value={fm.coresDescricao}
                onChange={(e) => setFm({ ...fm, coresDescricao: e.currentTarget.value })} />
              <Textarea mt="xs" label="Acabamentos" autosize minRows={2} value={fm.acabamentos}
                onChange={(e) => setFm({ ...fm, acabamentos: e.currentTarget.value })} />

              <Text size="sm" fw={500} mt="sm" mb={4}>Faca / matriz</Text>
              <Group align="flex-end" gap="md" wrap="nowrap">
                {fm.imagemFaca ? (
                  <Image src={fm.imagemFaca} alt="Faca" h={90} w={90} fit="contain" radius="sm"
                    style={{ cursor: 'zoom-in', border: '1px solid var(--mantine-color-default-border)' }}
                    onClick={() => setImgAmpliada(true)} />
                ) : (
                  <Center h={90} w={90} style={{ border: '1px dashed var(--mantine-color-default-border)', borderRadius: 8 }}>
                    <IconPhotoOff size={24} opacity={0.5} />
                  </Center>
                )}
                <Group gap={6}>
                  <FileButton accept="image/*" onChange={escolherImagem}>
                    {(props) => (
                      <Button {...props} size="xs" variant="light" leftSection={<IconUpload size={14} />}>
                        {fm.imagemFaca ? 'Trocar imagem' : 'Anexar imagem'}
                      </Button>
                    )}
                  </FileButton>
                  {fm.imagemFaca && (
                    <Button size="xs" variant="subtle" color="red" onClick={() => setFm({ ...fm, imagemFaca: null })}>Remover</Button>
                  )}
                </Group>
                <TextInput label="Nº da matriz" placeholder="ex.: 2529B" style={{ flex: 1 }}
                  value={fm.numeroMatriz} onChange={(e) => setFm({ ...fm, numeroMatriz: e.currentTarget.value })} />
              </Group>

              <Text size="sm" fw={500} mt="sm" mb={4}>Dimensões (mm)</Text>
              <Stack gap={6}>
                {fm.dimensoes.map((d, i) => (
                  <Group key={i} gap="xs" wrap="nowrap" align="flex-end">
                    <Select w={150} size="xs" data={TIPOS_DIM} value={d.tipo} allowDeselect={false}
                      onChange={(v) => setFm({ ...fm, dimensoes: fm.dimensoes.map((x, j) => j === i ? { ...x, tipo: v || 'PRODUTO_FINAL' } : x) })} />
                    <NumberInput w={90} size="xs" placeholder="Larg." min={0} value={d.larguraMm}
                      onChange={(v) => setFm({ ...fm, dimensoes: fm.dimensoes.map((x, j) => j === i ? { ...x, larguraMm: typeof v === 'number' ? v : '' } : x) })} />
                    <NumberInput w={90} size="xs" placeholder="Alt." min={0} value={d.alturaMm}
                      onChange={(v) => setFm({ ...fm, dimensoes: fm.dimensoes.map((x, j) => j === i ? { ...x, alturaMm: typeof v === 'number' ? v : '' } : x) })} />
                    <NumberInput w={90} size="xs" placeholder="Prof." min={0} value={d.profundidadeMm}
                      onChange={(v) => setFm({ ...fm, dimensoes: fm.dimensoes.map((x, j) => j === i ? { ...x, profundidadeMm: typeof v === 'number' ? v : '' } : x) })} />
                    <Button size="compact-xs" variant="subtle" color="red"
                      onClick={() => setFm({ ...fm, dimensoes: fm.dimensoes.filter((_, j) => j !== i) })}>Remover</Button>
                  </Group>
                ))}
                {fm.dimensoes.length < 10 && (
                  <div>
                    <Button size="compact-xs" variant="light"
                      onClick={() => setFm({ ...fm, dimensoes: [...fm.dimensoes, { tipo: 'PRODUTO_FINAL', larguraMm: '', alturaMm: '', profundidadeMm: '' }] })}>
                      + Adicionar dimensão
                    </Button>
                  </div>
                )}
              </Stack>

              <Textarea mt="sm" label="Observações técnicas" autosize minRows={2} value={fm.observacoes}
                onChange={(e) => setFm({ ...fm, observacoes: e.currentTarget.value })} />

              <Group justify="space-between" mt="md">
                <Text size="xs" c="dimmed">
                  {fmInfo.aprovada ? 'Arte aprovada pelo cliente.' : 'Aguardando aprovação da arte pelo cliente.'}
                </Text>
                <Group gap="xs">
                  {fmInfo.aprovada && !fmInfo.publicadaEm && fmInfo.produtoId && (
                    <Button size="xs" color="teal" variant="light" loading={publicando} onClick={publicarFicha}>
                      Tornar produto definitivo
                    </Button>
                  )}
                  <Button size="xs" loading={salvandoFaca} onClick={() => salvarFaca(fm)}>Salvar rascunho</Button>
                </Group>
              </Group>
            </Paper>
          </Stack>
        )}
      </Modal>

      <Modal opened={!!artePreview} onClose={() => setArtePreview(null)} size="xl">
        {artePreview && <Image src={artePreview} alt="Arte" fit="contain" />}
      </Modal>

      <Modal opened={imgAmpliada} onClose={() => setImgAmpliada(false)} size="xl">
        {fm.imagemFaca && <Image src={fm.imagemFaca} alt="Faca" fit="contain" />}
      </Modal>

      {/* Observação ao concluir */}
      <Modal opened={!!obsAlvo} onClose={() => setObsAlvo(null)} title="Concluir etapa" centered>
        <Stack gap="md">
          <Text size="sm" c="dimmed">Observação (opcional) sobre a conclusão da etapa {obsAlvo ? ETAPA_LABEL[obsAlvo.etapa] : ''}.</Text>
          <Textarea minRows={3} value={obs} onChange={(e) => setObs(e.currentTarget.value)} placeholder="Ex.: arte aprovada internamente, aguardando cliente" />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setObsAlvo(null)}>Cancelar</Button>
            <Button color="teal" loading={acao} onClick={async () => {
              if (!obsAlvo) return
              await mudar(obsAlvo.etapa, obsAlvo.status, obs.trim() || undefined)
              setObsAlvo(null)
            }}>Concluir</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
