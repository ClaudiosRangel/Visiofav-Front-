'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, Tabs, LoadingOverlay,
  NumberInput, Alert, Textarea, Modal, SimpleGrid, ThemeIcon, Divider, MultiSelect,
  Progress, FileInput, Image, Stack, Box, Loader, SegmentedControl, Select, TextInput,
} from '@mantine/core'
import {
  IconCheck, IconX, IconRefresh, IconMapPin, IconClipboardCheck,
  IconAlertCircle, IconArrowBack, IconEye, IconPrinter, IconCamera,
  IconClipboard, IconUpload,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import PendenciasLogisticasButton from '@/components/wms/PendenciasLogisticasButton'
import { ShelfLifeAlert } from '@/components/wms/ShelfLifeAlert'
import {
  useSugerirLote,
  useConfirmarLote,
  useProgressoEnderecamento,
  useValidarEndereco,
  useGerarEtiquetaEnderecamento,
  useGerarEtiquetaEnderecamentoZpl,
} from '@/data/hooks/useEnderecamento'
import {
  useDistribuicaoInteligente,
  useConfirmarDistribuicao,
  type DistribuicaoResult,
} from '@/data/hooks/useEnderecamentoInteligente'

const statusColors: Record<string, string> = {
  PENDENTE: 'orange', EM_CONFERENCIA: 'blue', CONFERIDA: 'green', REJEITADA: 'red', ENDERECADA: 'teal',
}

interface ItemConferido {
  itemNotaEntradaId: string
  quantidadeConferida: number
  lote?: string
}

interface OcrCampoItem {
  codigo: string
  quantidade: number
  confianca: number
}

export default function ConferenciaEntradaPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - Conferência de Entrada' }, [])
  const queryClient = useQueryClient()

  // Conferência state
  const [conferencia, setConferencia] = useState<any>(null)
  const [itensConferidos, setItensConferidos] = useState<Record<string, number>>({})
  const [itensLotes, setItensLotes] = useState<Record<string, string>>({})
  const [itensValidades, setItensValidades] = useState<Record<string, string>>({})
  const [resultado, setResultado] = useState<any>(null)
  const [etapa, setEtapa] = useState<'lista' | 'contagem' | 'resultado'>('lista')
  const [obsModal, setObsModal] = useState(false)
  const [observacao, setObservacao] = useState('')
  const [funcModal, setFuncModal] = useState(false)
  const [funcIds, setFuncIds] = useState<string[]>([])
  const [pendingNotaId, setPendingNotaId] = useState<string | null>(null)
  const [endFuncModal, setEndFuncModal] = useState(false)
  const [endFuncIds, setEndFuncIds] = useState<string[]>([])
  const [pendingEndNotaId, setPendingEndNotaId] = useState<string | null>(null)
  const [modoColetor, setModoColetor] = useState(false)

  // Acompanhamento (coletor) state
  const [acompanhamentoData, setAcompanhamentoData] = useState<any>(null)
  const acompanhamentoInterval = useRef<ReturnType<typeof setInterval> | null>(null)

  // Importar Folha (OCR) state
  const [ocrModalOpen, setOcrModalOpen] = useState(false)
  const [ocrFile, setOcrFile] = useState<File | null>(null)
  const [ocrPreview, setOcrPreview] = useState<string | null>(null)
  const [ocrFormat, setOcrFormat] = useState<'JPEG' | 'PNG' | 'PDF'>('JPEG')
  const [ocrCampos, setOcrCampos] = useState<OcrCampoItem[]>([])
  const [ocrEditedValues, setOcrEditedValues] = useState<Record<string, number>>({})
  const [ocrProcessed, setOcrProcessed] = useState(false)
  const [ocrFichaId, setOcrFichaId] = useState<string | null>(null)

  // Importar Valores (paste) state
  const [importValoresModal, setImportValoresModal] = useState(false)
  const [importValoresText, setImportValoresText] = useState('')

  // Endereçamento dual-mode state
  const [endModoAtivo, setEndModoAtivo] = useState<string | null>(null) // null = lista, 'manual' | 'coletor'
  const [endNotaSelecionada, setEndNotaSelecionada] = useState<any>(null)
  const [endDestinos, setEndDestinos] = useState<Record<string, string>>({}) // itemId -> enderecoId

  // Distribuição Inteligente state (Task 8.1)
  const [sugestoesInteligentes, setSugestoesInteligentes] = useState<Record<string, {
    loading: boolean
    resultado: DistribuicaoResult | null
    error?: string
  }>>({})

  // OCR Endereçamento state
  const [ocrEndModalOpen, setOcrEndModalOpen] = useState(false)
  const [ocrEndFile, setOcrEndFile] = useState<File | null>(null)
  const [ocrEndPreview, setOcrEndPreview] = useState<string | null>(null)
  const [ocrEndFormat, setOcrEndFormat] = useState<'JPEG' | 'PNG' | 'PDF'>('JPEG')
  const [ocrEndCampos, setOcrEndCampos] = useState<Array<{ codigo: string; endereco: string; confianca: number }>>([])
  const [ocrEndEditedValues, setOcrEndEditedValues] = useState<Record<string, string>>({})
  const [ocrEndProcessed, setOcrEndProcessed] = useState(false)

  // Funcionários para seleção
  // Funcionários para seleção (Task 10: enabled tied to modal open state, error handling with retry)
  const { data: funcionariosResp, isError: funcError, refetch: refetchFunc } = useQuery<any>({
    queryKey: ['conf-funcionarios'],
    queryFn: async () => { const { data } = await api.get('/funcionarios', { params: { limit: 50 } }); return data },
    enabled: funcModal || endFuncModal,
    retry: 2,
  })

  // Show error notification when employee API fails
  useEffect(() => {
    if (funcError && (funcModal || endFuncModal)) {
      notifications.show({
        title: 'Erro ao carregar funcionários',
        message: 'Falha ao buscar lista de funcionários. Clique para tentar novamente.',
        color: 'red',
        autoClose: 5000,
        onClick: () => refetchFunc(),
      })
    }
  }, [funcError, funcModal, endFuncModal, refetchFunc])

  const funcOptions = (funcionariosResp?.data || []).map((f: any) => ({ value: f.id, label: `${f.matricula} — ${f.nome}` }))

  // Notas pendentes
  const { data: notasResp, isLoading, refetch } = useQuery<any>({
    queryKey: ['conferencia-notas-pendentes'],
    queryFn: async () => { const { data } = await api.get('/conferencia-entrada/notas-pendentes'); return data },
  })

  // Notas conferidas + endereçadas (para aba Conferidas)
  const { data: conferidasResp } = useQuery<any>({
    queryKey: ['conferencia-notas-conferidas'],
    queryFn: async () => { const { data } = await api.get('/conferencia-entrada/notas-conferidas-todas'); return data },
  })

  // OS de endereçamento em execução (para desabilitar botão quando coletor está endereçando)
  const { data: osEndExecResp } = useQuery<any>({
    queryKey: ['os-end-executando'],
    queryFn: async () => { const { data } = await api.get('/os-wms', { params: { operacao: 'ENDERECAMENTO', status: 'EXECUTANDO', limit: 50 } }); return data },
    refetchInterval: 10000, // poll every 10s
  })
  const osEndExecutando = new Set((osEndExecResp?.data || []).map((os: any) => os.notaEntradaId))

  // Endereços livres
  const { data: enderecosResp } = useQuery<any>({
    queryKey: ['enderecos-livres'],
    queryFn: async () => { const { data } = await api.get('/conferencia-entrada/enderecos-livres'); return data },
  })

  // ===== Endereçamento dual-mode hooks =====
  const { data: sugestoesResp, isLoading: sugestoesLoading } = useSugerirLote(
    endModoAtivo === 'manual' ? endNotaSelecionada?.id : null
  )
  const confirmarLote = useConfirmarLote()
  const { data: progressoResp } = useProgressoEnderecamento(
    endNotaSelecionada?.id || null,
    endModoAtivo === 'coletor'
  )
  const gerarEtiquetaHtml = useGerarEtiquetaEnderecamento()
  const gerarEtiquetaZpl = useGerarEtiquetaEnderecamentoZpl()

  // ===== Distribuição Inteligente hooks (Task 8.1) =====
  const distribuicaoInteligente = useDistribuicaoInteligente()
  const confirmarDistribuicao = useConfirmarDistribuicao()

  // ===== Acompanhamento polling (coletor mode) =====
  const fetchAcompanhamento = useCallback(async () => {
    if (!conferencia?.nota?.id) return
    try {
      const { data } = await api.get(`/conferencia-entrada/${conferencia.nota.id}`)
      setAcompanhamentoData(data)
    } catch {
      // silently ignore polling errors
    }
  }, [conferencia?.nota?.id])

  useEffect(() => {
    if (modoColetor && etapa === 'contagem' && conferencia?.nota?.id) {
      // Initial fetch
      fetchAcompanhamento()
      // Poll every 5 seconds
      acompanhamentoInterval.current = setInterval(fetchAcompanhamento, 5000)
      return () => {
        if (acompanhamentoInterval.current) clearInterval(acompanhamentoInterval.current)
      }
    } else {
      if (acompanhamentoInterval.current) clearInterval(acompanhamentoInterval.current)
    }
  }, [modoColetor, etapa, conferencia?.nota?.id, fetchAcompanhamento])

  // ===== Task 8.1: Disparar distribuição inteligente ao entrar no modo manual =====
  useEffect(() => {
    if (endModoAtivo === 'manual' && endNotaSelecionada && sugestoesResp?.sugestoes) {
      const itensPendentes = sugestoesResp.sugestoes.filter(
        (s: any) => !s.distribuicao || s.distribuicao.alocacoes.length === 0
      )
      for (const item of itensPendentes) {
        // Skip if already loading or has result
        if (sugestoesInteligentes[item.itemId]?.loading || sugestoesInteligentes[item.itemId]?.resultado) continue

        setSugestoesInteligentes((prev) => ({
          ...prev,
          [item.itemId]: { loading: true, resultado: null },
        }))

        distribuicaoInteligente.mutate(
          {
            produtoId: item.produtoId,
            quantidade: item.quantidade,
            lote: item.lote || undefined,
            validade: item.validade || undefined,
          },
          {
            onSuccess: (data) => {
              setSugestoesInteligentes((prev) => ({
                ...prev,
                [item.itemId]: { loading: false, resultado: data },
              }))
            },
            onError: (err) => {
              setSugestoesInteligentes((prev) => ({
                ...prev,
                [item.itemId]: { loading: false, resultado: null, error: err.message || 'Erro ao buscar sugestão' },
              }))
            },
          }
        )
      }
    }
  }, [endModoAtivo, endNotaSelecionada, sugestoesResp?.sugestoes])

  // Compute acompanhamento stats
  const acompanhamentoItens = acompanhamentoData?.itens || conferencia?.itens || []
  const totalItensAcomp = acompanhamentoItens.length
  const itensConferidosAcomp = acompanhamentoItens.filter((i: any) => (i.quantidadeConferida ?? 0) > 0).length
  const progressAcomp = totalItensAcomp > 0 ? (itensConferidosAcomp / totalItensAcomp) * 100 : 0
  const todosConferidos = totalItensAcomp > 0 && itensConferidosAcomp === totalItensAcomp

  function getItemStatus(item: any): { label: string; color: string } {
    const qtdConferida = item.quantidadeConferida ?? 0
    const qtdEsperada = item.quantidadeNota ?? item.quantidade ?? 0
    if (qtdConferida === 0) return { label: 'Pendente', color: 'orange' }
    if (qtdConferida === qtdEsperada) return { label: 'Conferido', color: 'green' }
    return { label: 'Divergente', color: 'red' }
  }

  // Iniciar conferência
  const iniciarConf = useMutation({
    mutationFn: async (notaId: string) => {
      const { data } = await api.post(`/conferencia-entrada/iniciar/${notaId}`)
      // Se o POST não retornou itens (ou retornou vazio), buscar via GET
      if (!data.itens || data.itens.length === 0) {
        const { data: notaDetalhe } = await api.get(`/conferencia-entrada/${notaId}`)
        return {
          nota: data.nota || { id: notaDetalhe.id, numero: notaDetalhe.numero, serie: notaDetalhe.serie, fornecedor: notaDetalhe.fornecedor, fornecedorDoc: notaDetalhe.fornecedorDoc, status: notaDetalhe.status },
          itens: (notaDetalhe.itens || []).map((item: any) => ({
            id: item.id,
            item: item.item,
            descricao: item.descricao,
            codigoProduto: item.codigoProduto,
            unidade: item.unidade,
            lote: item.lote,
          })),
        }
      }
      return data
    },
    onSuccess: (data) => {
      setConferencia(data)
      setItensConferidos({})
      setResultado(null)
      setAcompanhamentoData(null)
      // Verificar se tem OS vinculada sem funcionários — abrir seleção
      checkOsAndStart(data)
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) },
  })

  async function checkOsAndStart(confData: any) {
    try {
      // Buscar OS de conferência aberta para esta nota
      const { data: osResp } = await api.get('/os-wms', { params: { status: 'ABERTO', operacao: 'CONFERENCIA', limit: 10 } })
      const osVinculada = (osResp?.data || []).find((os: any) => os.notaEntradaId === confData.nota.id)

      if (osVinculada && (!osVinculada.funcionarios || osVinculada.funcionarios.length === 0)) {
        // Sem funcionários designados — abrir modal de seleção
        setPendingNotaId(osVinculada.id)
        setFuncModal(true)
      } else {
        setEtapa('contagem')
      }
    } catch {
      setEtapa('contagem')
    }
  }

  // Designar funcionários e iniciar
  const designarFuncionarios = useMutation({
    mutationFn: async () => {
      if (!pendingNotaId || funcIds.length === 0) throw new Error('Selecione funcionários')
      const { data } = await api.patch(`/os-wms/${pendingNotaId}/iniciar`, { funcionarioIds: funcIds })
      return data
    },
    onSuccess: () => {
      setFuncModal(false); setFuncIds([]); setPendingNotaId(null)
      setEtapa('contagem')
      notifications.show({ title: '✅ Conferentes designados', message: 'Conferência iniciada', color: 'green' })
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' }) },
  })

  // Conferir todos os itens
  const conferirTodos = useMutation({
    mutationFn: async () => {
      if (!conferencia) throw new Error('Sem conferência')
      // Se modo coletor (acompanhamento), usar dados do acompanhamento
      const itensSource = modoColetor
        ? acompanhamentoItens.map((item: any) => ({
            itemNotaEntradaId: item.id,
            quantidadeConferida: item.quantidadeConferida ?? 0,
          }))
        : conferencia.itens.map((item: any) => ({
            itemNotaEntradaId: item.id,
            quantidadeConferida: itensConferidos[item.id] ?? 0,
            lote: itensLotes[item.id] || undefined,
            validade: itensValidades[item.id] || undefined,
          }))
      const { data } = await api.post(`/conferencia-entrada/conferir-todos/${conferencia.nota.id}`, { itens: itensSource })
      return data
    },
    onSuccess: (data) => {
      setResultado(data)
      setEtapa('resultado')
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) },
  })

  // Aprovar conferência
  const aprovarConf = useMutation({
    mutationFn: async () => {
      if (!conferencia) throw new Error('Sem conferência')
      const { data } = await api.post(`/conferencia-entrada/confirmar/${conferencia.nota.id}`, {
        acaoDivergencia: 'APROVAR',
        observacao: observacao || undefined,
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conferencia-notas-pendentes'] })
      queryClient.invalidateQueries({ queryKey: ['conferencia-notas-conferidas'] })
      resetConferencia()
      notifications.show({ title: '✅ Conferência aprovada', message: 'Nota pronta para endereçamento', color: 'green' })
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) },
  })

  // Rejeitar (recontar)
  const rejeitarConf = useMutation({
    mutationFn: async () => {
      if (!conferencia) throw new Error('Sem conferência')
      const { data } = await api.post(`/conferencia-entrada/rejeitar/${conferencia.nota.id}`, { motivo: observacao || 'Recontagem solicitada' })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conferencia-notas-pendentes'] })
      resetConferencia()
      notifications.show({ title: 'Conferência rejeitada', message: 'Nota voltou para recontagem', color: 'orange' })
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) },
  })

  // Endereçamento automático
  const enderecarAuto = useMutation({
    mutationFn: async (notaId: string) => { const { data } = await api.post(`/conferencia-entrada/enderecamento-automatico/${notaId}`); return data },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conferencia-notas-conferidas'] })
      queryClient.invalidateQueries({ queryKey: ['enderecos-livres'] })
      notifications.show({ title: '✅ Endereçamento concluído', message: `${data.itens?.length || 0} itens endereçados`, color: 'green' })
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) },
  })

  async function handleEnderecar(notaId: string) {
    try {
      // Verificar se tem OS de endereçamento aberta sem funcionários
      const { data: osResp } = await api.get('/os-wms', { params: { status: 'ABERTO', operacao: 'ENDERECAMENTO', limit: 10 } })
      const osVinculada = (osResp?.data || []).find((os: any) => os.notaEntradaId === notaId)

      if (osVinculada && (!osVinculada.funcionarios || osVinculada.funcionarios.length === 0)) {
        setPendingEndNotaId(notaId)
        setEndFuncIds([])
        setEndFuncModal(true)
        return
      }
    } catch { /* continua sem verificar */ }

    enderecarAuto.mutate(notaId)
  }

  // Designar funcionários para endereçamento e executar
  const designarEndFuncionarios = useMutation({
    mutationFn: async () => {
      // Buscar OS vinculada
      const { data: osResp } = await api.get('/os-wms', { params: { status: 'ABERTO', operacao: 'ENDERECAMENTO', limit: 10 } })
      const osVinculada = (osResp?.data || []).find((os: any) => os.notaEntradaId === pendingEndNotaId)
      if (osVinculada && endFuncIds.length > 0) {
        await api.patch(`/os-wms/${osVinculada.id}/iniciar`, { funcionarioIds: endFuncIds })
      }
      // Executar endereçamento
      const { data } = await api.post(`/conferencia-entrada/enderecamento-automatico/${pendingEndNotaId}`)
      return data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['conferencia-notas-conferidas'] })
      queryClient.invalidateQueries({ queryKey: ['enderecos-livres'] })
      setEndFuncModal(false); setEndFuncIds([]); setPendingEndNotaId(null)
      notifications.show({ title: '✅ Endereçamento concluído', message: `${data.itens?.length || 0} itens endereçados`, color: 'green' })
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' }) },
  })

  // ===== OCR: Importar Folha =====
  const processarOcr = useMutation({
    mutationFn: async ({ fichaOperacionalId, imagem, formato }: { fichaOperacionalId: string; imagem: string; formato: 'JPEG' | 'PNG' | 'PDF' }) => {
      const { data } = await api.post('/ocr/processar', { fichaOperacionalId, imagem, formato })
      return data
    },
  })

  function handleOcrFileChange(file: File | null) {
    setOcrFile(file)
    setOcrProcessed(false)
    setOcrCampos([])
    setOcrEditedValues({})

    if (!file) {
      setOcrPreview(null)
      return
    }

    // Determine format
    if (file.type === 'application/pdf') {
      setOcrFormat('PDF')
    } else if (file.type === 'image/png') {
      setOcrFormat('PNG')
    } else {
      setOcrFormat('JPEG')
    }

    const reader = new FileReader()
    reader.onload = () => {
      setOcrPreview(reader.result as string)
    }
    reader.readAsDataURL(file)
  }

  async function handleOcrProcessar() {
    if (!ocrPreview || !conferencia?.nota?.id) return

    try {
      const base64 = ocrPreview.split(',')[1] || ocrPreview

      if (ocrFormat === 'PDF') {
        // Direct PDF text extraction — no ficha needed
        const { data } = await api.post('/ocr/extrair-pdf', { imagem: base64 })

        const campos: OcrCampoItem[] = (data.campos || []).map((c: any) => ({
          codigo: c.nome || c.codigo || '',
          quantidade: parseFloat(c.valor) || 0,
          confianca: c.confianca ?? 100,
        }))
        setOcrCampos(campos)

        const initial: Record<string, number> = {}
        for (const campo of campos) {
          initial[campo.codigo] = campo.quantidade
        }
        setOcrEditedValues(initial)
        setOcrProcessed(true)
      } else {
        // Image OCR flow — requires ficha operacional
        let fichaId = ocrFichaId
        if (!fichaId) {
          const { data: fichaResp } = await api.post('/fichas-operacionais', {
            tipo: 'CONFERENCIA',
            referenciaId: conferencia.nota.id,
          })
          fichaId = fichaResp.id
          setOcrFichaId(fichaId)
        }

        processarOcr.mutate(
          { fichaOperacionalId: fichaId!, imagem: base64, formato: ocrFormat },
          {
            onSuccess: (data) => {
              const campos: OcrCampoItem[] = (data.campos || []).map((c: any) => ({
                codigo: c.nome || c.codigo || '',
                quantidade: parseFloat(c.valor) || 0,
                confianca: c.confianca ?? 0,
              }))
              setOcrCampos(campos)

              const initial: Record<string, number> = {}
              for (const campo of campos) {
                initial[campo.codigo] = campo.quantidade
              }
              setOcrEditedValues(initial)
              setOcrProcessed(true)
            },
          },
        )
      }
    } catch (err: any) {
      notifications.show({ title: 'Erro OCR', message: err?.response?.data?.message || 'Falha ao processar', color: 'red' })
    }
  }

  function handleOcrConfirmar() {
    if (!conferencia) return

    // Map OCR results to itensConferidos by matching codigoProduto
    const updated = { ...itensConferidos }
    for (const item of conferencia.itens) {
      const qty = ocrEditedValues[item.codigoProduto]
      if (qty !== undefined && qty >= 0) {
        updated[item.id] = qty
      }
    }
    setItensConferidos(updated)
    resetOcrModal()
    notifications.show({ title: '✅ Valores importados', message: 'Quantidades preenchidas a partir da folha digitalizada', color: 'green' })
  }

  function resetOcrModal() {
    setOcrModalOpen(false)
    setOcrFile(null)
    setOcrPreview(null)
    setOcrCampos([])
    setOcrEditedValues({})
    setOcrProcessed(false)
    setOcrFichaId(null)
  }

  // ===== Importar Valores (paste) =====
  function handleImportarValores() {
    if (!conferencia || !importValoresText.trim()) return

    const lines = importValoresText.trim().split('\n')
    const updated = { ...itensConferidos }
    let matched = 0

    for (const line of lines) {
      const parts = line.split('\t')
      if (parts.length < 2) continue
      const codigo = parts[0].trim()
      const quantidade = parseFloat(parts[1].trim())
      if (isNaN(quantidade)) continue

      const item = conferencia.itens.find((i: any) => i.codigoProduto === codigo)
      if (item) {
        updated[item.id] = quantidade
        matched++
      }
    }

    setItensConferidos(updated)
    setImportValoresModal(false)
    setImportValoresText('')
    notifications.show({
      title: '✅ Valores importados',
      message: `${matched} item(ns) preenchidos a partir dos dados colados`,
      color: 'green',
    })
  }

  function resetConferencia() {
    setConferencia(null); setItensConferidos({}); setResultado(null); setEtapa('lista'); setObservacao('')
    setModoColetor(false); setAcompanhamentoData(null)
  }

  // ===== Endereçamento dual-mode helpers =====

  function handleAbrirEnderecamento(nota: any) {
    setEndNotaSelecionada(nota)
    setEndModoAtivo('manual')
    setEndDestinos({})
  }

  function handleVoltarListaEnd() {
    setEndNotaSelecionada(null)
    setEndModoAtivo(null)
    setEndDestinos({})
    setSugestoesInteligentes({})
  }

  function handleAceitarSugestoes() {
    if (!sugestoesResp?.sugestoes) return
    const novosDestinos: Record<string, string> = {}
    for (const s of sugestoesResp.sugestoes) {
      // First try intelligent distribution suggestions
      const inteligente = sugestoesInteligentes[s.itemId]
      if (inteligente?.resultado?.alocacoes?.length) {
        novosDestinos[s.itemId] = inteligente.resultado.alocacoes[0].enderecoId
      } else if (s.distribuicao?.alocacoes?.length > 0) {
        novosDestinos[s.itemId] = s.distribuicao.alocacoes[0].enderecoId
      } else if (s.sugestao?.enderecoId) {
        novosDestinos[s.itemId] = s.sugestao.enderecoId
      }
    }
    setEndDestinos({ ...endDestinos, ...novosDestinos })
    notifications.show({ title: '✅ Sugestões aceitas', message: 'Endereços sugeridos preenchidos nos campos de destino', color: 'green' })
  }

  // Task 8.3: Confirmar endereçamento via useConfirmarDistribuicao
  function handleConfirmarDistribuicaoInteligente() {
    if (!sugestoesResp?.sugestoes) return

    const itensComDestino = sugestoesResp.sugestoes.filter((s: any) => endDestinos[s.itemId])

    if (itensComDestino.length === 0) {
      notifications.show({ title: 'Atenção', message: 'Preencha ao menos um endereço de destino', color: 'yellow' })
      return
    }

    // Group by produtoId and confirm each
    const porProduto: Record<string, { produtoId: string; lote?: string; validade?: string; alocacoes: Array<{ enderecoId: string; enderecoCompleto: string; quantidadeAlocada: number }> }> = {}

    for (const s of itensComDestino) {
      const enderecoId = endDestinos[s.itemId]
      if (!enderecoId) continue

      // Get enderecoCompleto from intelligent suggestions or sugestoes
      let enderecoCompleto = ''
      const inteligente = sugestoesInteligentes[s.itemId]
      if (inteligente?.resultado?.alocacoes?.length) {
        const aloc = inteligente.resultado.alocacoes.find((a) => a.enderecoId === enderecoId)
        enderecoCompleto = aloc?.enderecoCompleto || ''
      }
      if (!enderecoCompleto && s.distribuicao?.alocacoes?.length > 0) {
        const aloc = s.distribuicao.alocacoes.find((a: any) => a.enderecoId === enderecoId)
        enderecoCompleto = aloc?.enderecoCompleto || ''
      }
      if (!enderecoCompleto && s.sugestao?.enderecoId === enderecoId) {
        enderecoCompleto = s.sugestao.enderecoCompleto
      }
      if (!enderecoCompleto) enderecoCompleto = enderecoId

      if (!porProduto[s.produtoId]) {
        porProduto[s.produtoId] = {
          produtoId: s.produtoId,
          lote: s.lote || undefined,
          validade: s.validade || undefined,
          alocacoes: [],
        }
      }
      porProduto[s.produtoId].alocacoes.push({
        enderecoId,
        enderecoCompleto,
        quantidadeAlocada: s.quantidade,
      })
    }

    // Confirm each product's distribution
    const produtos = Object.values(porProduto)
    let confirmados = 0
    let erros = 0

    for (const prod of produtos) {
      confirmarDistribuicao.mutate(
        {
          produtoId: prod.produtoId,
          alocacoes: prod.alocacoes,
          lote: prod.lote,
          validade: prod.validade,
        },
        {
          onSuccess: () => {
            confirmados++
            if (confirmados + erros === produtos.length) {
              if (erros === 0) {
                notifications.show({
                  title: '✅ Endereçamento confirmado',
                  message: `${confirmados} produto(s) endereçados com sucesso via distribuição inteligente`,
                  color: 'green',
                })
                queryClient.invalidateQueries({ queryKey: ['conferencia-notas-conferidas'] })
                queryClient.invalidateQueries({ queryKey: ['enderecos-livres'] })
                handleVoltarListaEnd()
              } else {
                notifications.show({
                  title: '⚠️ Endereçamento parcial',
                  message: `${confirmados} confirmado(s), ${erros} com erro`,
                  color: 'yellow',
                })
              }
            }
          },
          onError: (err: any) => {
            erros++
            if (confirmados + erros === produtos.length) {
              notifications.show({
                title: 'Erro',
                message: err?.message || 'Falha ao confirmar endereçamento',
                color: 'red',
              })
            }
          },
        }
      )
    }
  }

  async function handleImprimirFichaEnd() {
    if (!endNotaSelecionada?.id) return
    try {
      const { data: fichaResp } = await api.post('/enderecamento-wms/gerar-ficha', {
        notaEntradaId: endNotaSelecionada.id,
      })
      const fichaId = fichaResp.id || fichaResp.fichaId
      if (fichaId) {
        // Buscar HTML via API (com auth) e abrir em nova aba
        const { data: html } = await api.get(`/enderecamento-wms/ficha/${fichaId}/html`, { responseType: 'text' })
        const w = window.open('', '_blank')
        if (w) {
          w.document.write(html)
          w.document.close()
        }
      }
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao gerar ficha', color: 'red' })
    }
  }

  async function handleConfirmarEnderecamento() {
    if (!endNotaSelecionada?.id || !sugestoesResp?.sugestoes) return

    const itens = sugestoesResp.sugestoes
      .filter((s) => endDestinos[s.itemId])
      .map((s) => ({
        itemNotaEntradaId: s.itemId,
        produtoId: s.produtoId,
        enderecoId: endDestinos[s.itemId],
        quantidade: s.quantidade,
        lote: s.lote || undefined,
        validade: s.validade || undefined,
      }))

    if (itens.length === 0) {
      notifications.show({ title: 'Atenção', message: 'Preencha ao menos um endereço de destino', color: 'yellow' })
      return
    }

    confirmarLote.mutate(
      { notaEntradaId: endNotaSelecionada.id, itens },
      {
        onSuccess: (data) => {
          notifications.show({
            title: '✅ Endereçamento concluído',
            message: `${data.itensEnderecados} itens endereçados com sucesso`,
            color: 'green',
          })

          // Generate labels HTML and open in new tab
          const etiquetaItens = data.etiquetas.map((et) => ({
            enderecoCompleto: et.enderecoCompleto,
            produtoCodigo: sugestoesResp.sugestoes.find((s) => s.itemId === et.itemId)?.produtoCodigo || '',
            produtoNome: et.produtoNome,
            quantidade: sugestoesResp.sugestoes.find((s) => s.itemId === et.itemId)?.quantidade || 0,
            lote: sugestoesResp.sugestoes.find((s) => s.itemId === et.itemId)?.lote || undefined,
            validade: sugestoesResp.sugestoes.find((s) => s.itemId === et.itemId)?.validade || undefined,
          }))

          if (etiquetaItens.length > 0) {
            gerarEtiquetaHtml.mutate(
              { itens: etiquetaItens, quantidade: 1 },
              {
                onSuccess: (html) => {
                  const w = window.open('', '_blank')
                  if (w) {
                    w.document.write(html)
                    w.document.close()
                  }
                },
                onError: () => {
                  notifications.show({ title: 'Aviso', message: 'Endereçamento concluído, mas falha ao gerar etiquetas', color: 'yellow' })
                },
              }
            )
          }

          queryClient.invalidateQueries({ queryKey: ['conferencia-notas-conferidas'] })
          queryClient.invalidateQueries({ queryKey: ['enderecos-livres'] })
          handleVoltarListaEnd()
        },
        onError: (err: any) => {
          notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao confirmar endereçamento', color: 'red' })
        },
      }
    )
  }

  function handleFinalizarColetor() {
    if (!progressoResp) return
    // All items addressed — offer label printing
    const etiquetaItens = progressoResp.itens
      .filter((i) => i.status === 'ENDERECADO' && i.enderecoDestino)
      .map((i) => ({
        enderecoCompleto: i.enderecoDestino!,
        produtoCodigo: i.codigoProduto,
        produtoNome: i.descricao,
        quantidade: i.quantidade,
        lote: i.lote || undefined,
        validade: i.validade || undefined,
      }))

    if (etiquetaItens.length > 0) {
      gerarEtiquetaHtml.mutate(
        { itens: etiquetaItens, quantidade: 1 },
        {
          onSuccess: (html) => {
            const w = window.open('', '_blank')
            if (w) {
              w.document.write(html)
              w.document.close()
            }
          },
        }
      )
    }

    notifications.show({ title: '✅ Endereçamento finalizado', message: 'Todos os itens foram endereçados', color: 'green' })
    queryClient.invalidateQueries({ queryKey: ['conferencia-notas-conferidas'] })
    queryClient.invalidateQueries({ queryKey: ['enderecos-livres'] })
    handleVoltarListaEnd()
  }

  // OCR Endereçamento helpers
  function handleOcrEndFileChange(file: File | null) {
    setOcrEndFile(file)
    setOcrEndProcessed(false)
    setOcrEndCampos([])
    setOcrEndEditedValues({})
    if (!file) { setOcrEndPreview(null); return }
    if (file.type === 'application/pdf') setOcrEndFormat('PDF')
    else if (file.type === 'image/png') setOcrEndFormat('PNG')
    else setOcrEndFormat('JPEG')
    const reader = new FileReader()
    reader.onload = () => setOcrEndPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function handleOcrEndProcessar() {
    if (!ocrEndPreview) return
    try {
      const base64 = ocrEndPreview.split(',')[1] || ocrEndPreview
      const { data } = await api.post('/ocr/extrair-pdf', { imagem: base64 })
      const campos = (data.campos || []).map((c: any) => ({
        codigo: c.nome || c.codigo || '',
        endereco: c.valor || '',
        confianca: c.confianca ?? 100,
      }))
      setOcrEndCampos(campos)
      const initial: Record<string, string> = {}
      for (const campo of campos) initial[campo.codigo] = campo.endereco
      setOcrEndEditedValues(initial)
      setOcrEndProcessed(true)
    } catch (err: any) {
      notifications.show({ title: 'Erro OCR', message: err?.response?.data?.message || 'Falha ao processar', color: 'red' })
    }
  }

  function handleOcrEndConfirmar() {
    if (!sugestoesResp?.sugestoes) return
    const updated = { ...endDestinos }
    for (const s of sugestoesResp.sugestoes) {
      const endVal = ocrEndEditedValues[s.produtoCodigo]
      if (endVal) {
        // Try to find matching endereco by enderecoCompleto
        updated[s.itemId] = endVal
      }
    }
    setEndDestinos(updated)
    resetOcrEndModal()
    notifications.show({ title: '✅ Endereços importados', message: 'Endereços preenchidos a partir da ficha digitalizada', color: 'green' })
  }

  function resetOcrEndModal() {
    setOcrEndModalOpen(false)
    setOcrEndFile(null)
    setOcrEndPreview(null)
    setOcrEndCampos([])
    setOcrEndEditedValues({})
    setOcrEndProcessed(false)
  }

  // Helper to get enderecoCompleto from sugestoes for display
  function getEnderecoDisplay(itemId: string): string {
    const endId = endDestinos[itemId]
    if (!endId) return ''
    // Check if it's a known suggestion enderecoId
    const sug = sugestoesResp?.sugestoes?.find((s) => s.itemId === itemId)
    if (sug?.sugestao?.enderecoId === endId) return sug.sugestao.enderecoCompleto
    return endId // fallback to showing the ID
  }

  function imprimirListaConferencia() {
    if (!conferencia) return

    // Buscar nomes dos conferentes da OS
    const conferentes = funcIds.length > 0
      ? funcIds.map(id => funcOptions.find((f: any) => f.value === id)?.label || '').filter(Boolean).join(', ')
      : ''

    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const itensHtml = conferencia.itens.map((item: any, idx: number) => `
      <tr>
        <td style="padding:6px;border:1px solid #ccc;text-align:center">${item.item || idx + 1}</td>
        <td style="padding:6px;border:1px solid #ccc;font-family:monospace">${item.codigoProduto || ''}</td>
        <td style="padding:6px;border:1px solid #ccc">${item.descricao || ''}</td>
        <td style="padding:6px;border:1px solid #ccc;text-align:center">${item.unidade || ''}</td>
        <td style="padding:6px;border:1px solid #ccc;width:100px"></td>
        <td style="padding:6px;border:1px solid #ccc;width:100px"></td>
        <td style="padding:6px;border:1px solid #ccc;width:80px"></td>
      </tr>
    `).join('')

    printWindow.document.write(`
      <html><head><title>Lista de Conferência Cega - NF ${conferencia.nota.numero}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
        h1 { font-size: 16px; margin-bottom: 4px; }
        h2 { font-size: 13px; color: #555; margin-bottom: 16px; }
        .info { display: flex; gap: 30px; margin-bottom: 16px; flex-wrap: wrap; }
        .info div { }
        .info label { font-size: 10px; color: #888; display: block; }
        .info span { font-weight: bold; }
        table { width: 100%; border-collapse: collapse; }
        th { padding: 6px; border: 1px solid #333; background: #f0f0f0; font-size: 11px; text-align: center; }
        td { font-size: 11px; }
        .footer { margin-top: 30px; font-size: 10px; color: #888; }
        .assinatura { margin-top: 50px; display: flex; gap: 60px; }
        .assinatura div { border-top: 1px solid #333; padding-top: 4px; width: 200px; text-align: center; font-size: 10px; }
        @media print { body { margin: 10px; } }
      </style></head><body>
      <h1>LISTAGEM DE CONFERÊNCIA CEGA</h1>
      <h2>Nota Fiscal: ${conferencia.nota.numero} | Fornecedor: ${conferencia.nota.fornecedor}</h2>
      <div class="info">
        <div><label>NF Número</label><span>${conferencia.nota.numero}</span></div>
        <div><label>Fornecedor</label><span>${conferencia.nota.fornecedor}</span></div>
        <div><label>CNPJ</label><span>${conferencia.nota.fornecedorDoc || ''}</span></div>
        <div><label>Data</label><span>${new Date().toLocaleDateString('pt-BR')}</span></div>
        ${conferentes ? `<div><label>Conferente(s)</label><span>${conferentes}</span></div>` : ''}
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th><th>Código</th><th>Produto</th><th>Unidade</th>
            <th>Qtd Contada</th><th>Lote</th><th>Validade</th>
          </tr>
        </thead>
        <tbody>${itensHtml}</tbody>
      </table>
      <div class="footer">
        <p>Conferência cega — as quantidades esperadas não são exibidas.</p>
        <p>Preencha a quantidade contada, lote e validade para cada item.</p>
      </div>
      <div class="assinatura">
        <div>Conferente</div>
        <div>Digitador</div>
        <div>Supervisor</div>
      </div>
      <script>window.print();</script>
      </body></html>
    `)
    printWindow.document.close()
  }

  const notas = notasResp?.data || []
  const conferidas = conferidasResp?.data || []
  const enderecos = enderecosResp || []

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Conferência de Entrada</Text>
      <Text size="xl" fw={600} mb="lg">Conferência de Entrada</Text>
      <PendenciasLogisticasButton />

      <Card>
        <Tabs defaultValue="conferencia">
          <Tabs.List mb="md">
            <Tabs.Tab value="conferencia" leftSection={<IconClipboardCheck size={16} />}>
              Conferência ({notas.length})
            </Tabs.Tab>
            <Tabs.Tab value="conferidas" leftSection={<IconCheck size={16} />}>
              Conferidas ({conferidas.length})
            </Tabs.Tab>
          </Tabs.List>

          {/* ===== ABA CONFERÊNCIA ===== */}
          <Tabs.Panel value="conferencia">

            {/* ETAPA 1: Lista de notas pendentes */}
            {etapa === 'lista' && (
              <>
                <LoadingOverlay visible={isLoading} />
                <Group justify="space-between" mb="sm">
                  <Text fw={500}>Notas Pendentes de Conferência</Text>
                  <Button variant="default" size="xs" leftSection={<IconRefresh size={14} />} onClick={() => refetch()}>Atualizar</Button>
                </Group>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>NF</Table.Th><Table.Th>Fornecedor</Table.Th><Table.Th>CNPJ</Table.Th>
                      <Table.Th>Itens</Table.Th><Table.Th>Status</Table.Th><Table.Th>Ações</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {notas.map((nota: any) => (
                      <Table.Tr key={nota.id}>
                        <Table.Td fw={500}>{nota.numero}</Table.Td>
                        <Table.Td>{nota.fornecedor || '—'}</Table.Td>
                        <Table.Td className="font-mono text-sm">{nota.fornecedorDoc || '—'}</Table.Td>
                        <Table.Td>{nota.itens?.length || 0}</Table.Td>
                        <Table.Td><Badge color={statusColors[nota.status] || 'gray'} variant="light">{nota.status}</Badge></Table.Td>
                        <Table.Td>
                          <Button size="xs" variant="light" leftSection={<IconClipboardCheck size={14} />}
                            onClick={() => iniciarConf.mutate(nota.id)} loading={iniciarConf.isPending}>
                            {nota.status === 'EM_CONFERENCIA' ? 'Continuar' : 'Iniciar Conferência'}
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                    {notas.length === 0 && (
                      <Table.Tr><Table.Td colSpan={6} className="text-center py-8 text-zinc-500">Nenhuma nota pendente de conferência</Table.Td></Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </>
            )}

            {/* ETAPA 2: Contagem cega */}
            {etapa === 'contagem' && conferencia && (
              <>
                <Alert icon={<IconClipboardCheck size={16} />} color="blue" variant="light" mb="md">
                  <Group justify="space-between">
                    <div>
                      <Text fw={600}>Conferência Cega — NF {conferencia.nota.numero}</Text>
                      <Text size="sm">Fornecedor: {conferencia.nota.fornecedor} | {modoColetor ? 'Modo Acompanhamento — monitorando conferência via coletor' : 'Informe a quantidade contada para cada item'}</Text>
                    </div>
                    <Button variant={modoColetor ? 'filled' : 'light'} color={modoColetor ? 'grape' : 'gray'} size="xs"
                      onClick={() => setModoColetor(!modoColetor)}>
                      {modoColetor ? '📱 Acompanhamento' : '⌨️ Digitação'}
                    </Button>
                  </Group>
                </Alert>

                {/* ===== Modo Acompanhamento (antigo Coletor) ===== */}
                {modoColetor && (
                  <Card withBorder mb="md" bg="grape.0">
                    <Group justify="space-between" mb="sm">
                      <Text fw={600} size="lg">📱 Acompanhamento em Tempo Real</Text>
                      <Badge color="grape" variant="light" size="lg" leftSection={<IconRefresh size={14} />}>
                        Atualiza a cada 5s
                      </Badge>
                    </Group>

                    <Text size="sm" c="dimmed" mb="md">
                      A conferência está sendo realizada pelo operador via coletor/app mobile.
                    </Text>

                    {/* Progress bar */}
                    <Group justify="space-between" mb={4}>
                      <Text size="sm" fw={500}>Progresso: {itensConferidosAcomp}/{totalItensAcomp} itens conferidos</Text>
                      <Text size="sm" fw={600} c={todosConferidos ? 'green' : 'blue'}>{Math.round(progressAcomp)}%</Text>
                    </Group>
                    <Progress value={progressAcomp} size="lg" radius="md" color={todosConferidos ? 'green' : 'blue'} mb="md" animated={!todosConferidos} />

                    {!todosConferidos && (
                      <Badge color="grape" variant="light" size="lg" mb="md">
                        📱 Aguardando conferência pelo coletor...
                      </Badge>
                    )}
                    {todosConferidos && (
                      <Badge color="green" variant="filled" size="lg" mb="md">
                        ✅ Todos os itens foram conferidos
                      </Badge>
                    )}

                    {/* Monitoring table */}
                    <Table striped withTableBorder>
                      <Table.Thead>
                        <Table.Tr>
                          <Table.Th>#</Table.Th>
                          <Table.Th>Código</Table.Th>
                          <Table.Th>Produto</Table.Th>
                          <Table.Th>Unidade</Table.Th>
                          <Table.Th>Qtd Esperada</Table.Th>
                          <Table.Th>Qtd Conferida</Table.Th>
                          <Table.Th>Status</Table.Th>
                        </Table.Tr>
                      </Table.Thead>
                      <Table.Tbody>
                        {acompanhamentoItens.map((item: any, idx: number) => {
                          const status = getItemStatus(item)
                          return (
                            <Table.Tr key={item.id} bg={status.color === 'red' ? 'red.0' : undefined}>
                              <Table.Td>{item.item || idx + 1}</Table.Td>
                              <Table.Td className="font-mono">{item.codigoProduto}</Table.Td>
                              <Table.Td fw={500}>{item.descricao}</Table.Td>
                              <Table.Td>{item.unidade}</Table.Td>
                              <Table.Td>{item.quantidadeNota ?? item.quantidade ?? '—'}</Table.Td>
                              <Table.Td fw={700}>{item.quantidadeConferida ?? 0}</Table.Td>
                              <Table.Td>
                                <Badge color={status.color} variant="light">{status.label}</Badge>
                              </Table.Td>
                            </Table.Tr>
                          )
                        })}
                        {acompanhamentoItens.length === 0 && (
                          <Table.Tr>
                            <Table.Td colSpan={7} className="text-center py-8 text-zinc-500">
                              Nenhum item encontrado. Aguardando dados do coletor...
                            </Table.Td>
                          </Table.Tr>
                        )}
                      </Table.Tbody>
                    </Table>
                  </Card>
                )}

                {/* ===== Modo Digitação (manual) ===== */}
                {!modoColetor && (
                <Table striped withTableBorder>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>#</Table.Th>
                      <Table.Th>Código</Table.Th>
                      <Table.Th>Produto</Table.Th>
                      <Table.Th>Unidade</Table.Th>
                      <Table.Th>Quantidade Contada</Table.Th>
                      <Table.Th>Lote</Table.Th>
                      <Table.Th>Validade</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {conferencia.itens && conferencia.itens.length > 0 ? conferencia.itens.map((item: any) => (
                      <Table.Tr key={item.id}>
                        <Table.Td>{item.item}</Table.Td>
                        <Table.Td className="font-mono">{item.codigoProduto}</Table.Td>
                        <Table.Td fw={500}>{item.descricao}</Table.Td>
                        <Table.Td>{item.unidade}</Table.Td>
                        <Table.Td>
                          <NumberInput
                            size="sm" min={0} decimalScale={4}
                            value={itensConferidos[item.id] ?? ''}
                            placeholder="Informe a qtd"
                            onChange={(v) => setItensConferidos({ ...itensConferidos, [item.id]: typeof v === 'number' ? v : 0 })}
                            className="w-36"
                          />
                        </Table.Td>
                        <Table.Td>
                          <TextInput
                            size="sm"
                            value={itensLotes[item.id] || ''}
                            placeholder="Lote"
                            onChange={(e) => setItensLotes({ ...itensLotes, [item.id]: e.currentTarget.value })}
                            className="w-28"
                          />
                        </Table.Td>
                        <Table.Td>
                          <TextInput
                            size="sm"
                            value={itensValidades[item.id] || ''}
                            placeholder="DD/MM/AAAA"
                            onChange={(e) => setItensValidades({ ...itensValidades, [item.id]: e.currentTarget.value })}
                            className="w-32"
                          />
                          <ShelfLifeAlert
                            dataVencimento={itensValidades[item.id] || null}
                            shelfLifeMinimo={item.produto?.shelfLifeMinimo ?? item.shelfLifeMinimo ?? null}
                          />
                        </Table.Td>
                      </Table.Tr>
                    )) : (
                      <Table.Tr>
                        <Table.Td colSpan={7} className="text-center py-8 text-zinc-500">
                          Nenhum item encontrado nesta nota. Verifique se a nota foi importada com itens.
                        </Table.Td>
                      </Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
                )}

                <Group justify="space-between" mt="md">
                  <Group>
                    <Button variant="default" leftSection={<IconArrowBack size={16} />} onClick={resetConferencia}>Cancelar</Button>
                    {!modoColetor && (
                      <>
                        <Button variant="light" leftSection={<IconPrinter size={16} />} onClick={imprimirListaConferencia}>
                          Imprimir Lista
                        </Button>
                        <Button variant="light" color="violet" leftSection={<IconCamera size={16} />} onClick={() => setOcrModalOpen(true)}>
                          📷 Importar Folha
                        </Button>
                        <Button variant="light" color="cyan" leftSection={<IconClipboard size={16} />} onClick={() => setImportValoresModal(true)}>
                          📋 Importar Valores
                        </Button>
                      </>
                    )}
                  </Group>
                  <Button color="blue" leftSection={<IconEye size={16} />}
                    onClick={() => conferirTodos.mutate()} loading={conferirTodos.isPending}>
                    Verificar Resultado
                  </Button>
                </Group>
              </>
            )}

            {/* ETAPA 3: Resultado com divergências */}
            {etapa === 'resultado' && resultado && conferencia && (
              <>
                {/* Resumo */}
                <SimpleGrid cols={{ base: 1, sm: 3 }} mb="md">
                  <Card withBorder>
                    <Group justify="space-between">
                      <div><Text size="xs" c="dimmed" tt="uppercase" fw={600}>Total Itens</Text><Text size="xl" fw={700}>{resultado.totalItens}</Text></div>
                      <ThemeIcon color="blue" variant="light" size={40} radius="md"><IconClipboardCheck size={20} /></ThemeIcon>
                    </Group>
                  </Card>
                  <Card withBorder>
                    <Group justify="space-between">
                      <div><Text size="xs" c="dimmed" tt="uppercase" fw={600}>Conformes</Text><Text size="xl" fw={700} c="green">{resultado.conformes}</Text></div>
                      <ThemeIcon color="green" variant="light" size={40} radius="md"><IconCheck size={20} /></ThemeIcon>
                    </Group>
                  </Card>
                  <Card withBorder>
                    <Group justify="space-between">
                      <div><Text size="xs" c="dimmed" tt="uppercase" fw={600}>Divergentes</Text><Text size="xl" fw={700} c="red">{resultado.divergentes}</Text></div>
                      <ThemeIcon color="red" variant="light" size={40} radius="md"><IconAlertCircle size={20} /></ThemeIcon>
                    </Group>
                  </Card>
                </SimpleGrid>

                {resultado.temDivergencia && (
                  <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light" mb="md">
                    <Text fw={600}>Divergência detectada!</Text>
                    <Text size="sm">
                      {resultado.divergentes} item(ns) com quantidade diferente da nota.
                      Você pode: Aprovar (aceitar a divergência), Recontar (rejeitar e conferir novamente) ou Adicionar observação.
                    </Text>
                  </Alert>
                )}

                {!resultado.temDivergencia && !resultado.falhasShelfLife && (
                  <Alert icon={<IconCheck size={16} />} color="green" variant="light" mb="md">
                    Todos os itens conferidos estão conformes. Pode aprovar a conferência.
                  </Alert>
                )}

                {resultado.falhasShelfLife && resultado.falhasShelfLife.length > 0 && (
                  <Alert icon={<IconAlertCircle size={16} />} color="orange" variant="light" mb="md">
                    <Text fw={600}>⚠️ Shelf Life insuficiente!</Text>
                    {resultado.falhasShelfLife.map((falha: any, idx: number) => (
                      <Text size="sm" key={idx} mt={4}>{falha.mensagem}</Text>
                    ))}
                    <Text size="sm" mt="xs" c="dimmed">
                      Estes itens foram bloqueados. Corrija a validade ou entre em contato com o fornecedor.
                    </Text>
                  </Alert>
                )}

                {/* Tabela de resultado */}
                <Table striped withTableBorder mb="md">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Produto</Table.Th>
                      <Table.Th>Qtd Nota</Table.Th>
                      <Table.Th>Qtd Conferida</Table.Th>
                      <Table.Th>Divergência</Table.Th>
                      <Table.Th>Tipo</Table.Th>
                      <Table.Th>Status</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {resultado.itens.map((item: any) => (
                      <Table.Tr key={item.itemId} bg={item.status === 'DIVERGENTE' ? 'red.0' : undefined}>
                        <Table.Td fw={500}>{item.descricao}</Table.Td>
                        <Table.Td>{item.quantidadeNota}</Table.Td>
                        <Table.Td fw={600}>{item.quantidadeConferida}</Table.Td>
                        <Table.Td>
                          <Text fw={600} c={item.divergencia === 0 ? 'green' : 'red'}>
                            {item.divergencia > 0 ? `+${item.divergencia}` : item.divergencia}
                          </Text>
                        </Table.Td>
                        <Table.Td>
                          {item.tipoDivergencia === 'EXCESSO' && <Badge color="orange" variant="light">Excesso</Badge>}
                          {item.tipoDivergencia === 'FALTA' && <Badge color="red" variant="light">Falta</Badge>}
                          {!item.tipoDivergencia && <Text c="green">—</Text>}
                        </Table.Td>
                        <Table.Td>
                          <Badge color={item.status === 'CONFORME' ? 'green' : 'red'} variant="filled">
                            {item.status}
                          </Badge>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>

                {/* Ações */}
                <Divider mb="md" />
                <Group justify="space-between">
                  <Group>
                    <Button variant="default" leftSection={<IconArrowBack size={16} />}
                      onClick={() => setEtapa('contagem')}>
                      ← Corrigir Contagem
                    </Button>
                    {resultado.temDivergencia && (
                      <Button color="orange" variant="light" leftSection={<IconX size={16} />}
                        onClick={() => { if (confirm('Rejeitar conferência e voltar para recontagem?')) rejeitarConf.mutate() }}
                        loading={rejeitarConf.isPending}>
                        Rejeitar / Recontar
                      </Button>
                    )}
                  </Group>
                  <Group>
                    {resultado.temDivergencia && (
                      <Button variant="light" onClick={() => setObsModal(true)}>
                        Adicionar Observação
                      </Button>
                    )}
                    <Button color="green" leftSection={<IconCheck size={16} />}
                      onClick={() => aprovarConf.mutate()} loading={aprovarConf.isPending}>
                      {resultado.temDivergencia ? 'Aprovar com Divergência' : 'Aprovar Conferência'}
                    </Button>
                  </Group>
                </Group>
              </>
            )}
          </Tabs.Panel>

          {/* ===== ABA ENDEREÇAMENTO ===== */}
          <Tabs.Panel value="conferidas">

            {/* Lista de notas conferidas (quando nenhuma nota selecionada) */}
            {!endNotaSelecionada && (
              <>
                <Text fw={500} mb="sm">Notas Conferidas — Pendentes de Endereçamento</Text>
                <Table striped highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>NF</Table.Th><Table.Th>Fornecedor</Table.Th><Table.Th>Itens</Table.Th>
                      <Table.Th>Status</Table.Th><Table.Th>Ações</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {conferidas.map((nota: any) => (
                      <Table.Tr key={nota.id}>
                        <Table.Td fw={500}>{nota.numero}</Table.Td>
                        <Table.Td>{nota.fornecedor || '—'}</Table.Td>
                        <Table.Td>{nota.itens?.length || 0}</Table.Td>
                        <Table.Td><Badge color={statusColors[nota.status] || 'green'} variant="light">{nota.status}</Badge></Table.Td>
                        <Table.Td>
                          {nota.status === 'ENDERECADA' ? (
                            <Badge color="teal" variant="light">ENDEREÇADA</Badge>
                          ) : osEndExecutando.has(nota.id) ? (
                            <Badge color="orange" variant="light">Em andamento (coletor)</Badge>
                          ) : (
                            <Button size="xs" color="teal" leftSection={<IconMapPin size={14} />}
                              onClick={() => handleAbrirEnderecamento(nota)}>
                              Endereçar
                            </Button>
                          )}
                        </Table.Td>
                      </Table.Tr>
                    ))}
                    {conferidas.length === 0 && (
                      <Table.Tr><Table.Td colSpan={5} className="text-center py-8 text-zinc-500">Nenhuma nota para endereçar</Table.Td></Table.Tr>
                    )}
                  </Table.Tbody>
                </Table>
              </>
            )}

            {/* Dual-mode view (quando nota selecionada) */}
            {endNotaSelecionada && (
              <>
                <Group justify="space-between" mb="md">
                  <div>
                    <Text fw={600} size="lg">Endereçamento — NF {endNotaSelecionada.numero}</Text>
                    <Text size="sm" c="dimmed">Fornecedor: {endNotaSelecionada.fornecedor || '—'}</Text>
                  </div>
                  <Button variant="default" leftSection={<IconArrowBack size={14} />} onClick={handleVoltarListaEnd}>
                    Voltar
                  </Button>
                </Group>

                {/* Mode Selector */}
                <SegmentedControl
                  value={endModoAtivo || 'manual'}
                  onChange={(v) => setEndModoAtivo(v)}
                  data={[
                    { label: '📝 Manual', value: 'manual' },
                    { label: '📱 Acompanhamento (Coletor)', value: 'coletor' },
                  ]}
                  mb="md"
                  fullWidth
                />

                {/* ===== Manual Mode View ===== */}
                {endModoAtivo === 'manual' && (
                  <>
                    <LoadingOverlay visible={sugestoesLoading} />

                    {sugestoesResp?.sugestoes && sugestoesResp.sugestoes.length > 0 ? (
                      <>
                        <Table striped withTableBorder mb="md">
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>#</Table.Th>
                              <Table.Th>Código</Table.Th>
                              <Table.Th>Produto</Table.Th>
                              <Table.Th>Qtd</Table.Th>
                              <Table.Th>Lote</Table.Th>
                              <Table.Th>Validade</Table.Th>
                              <Table.Th>Sugestão</Table.Th>
                              <Table.Th>% Ocupação</Table.Th>
                              <Table.Th>Destino</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {sugestoesResp.sugestoes.map((s: any, idx: number) => (
                              <Table.Tr key={s.itemId}>
                                <Table.Td>{idx + 1}</Table.Td>
                                <Table.Td className="font-mono">{s.produtoCodigo}</Table.Td>
                                <Table.Td fw={500}>{s.produtoNome}</Table.Td>
                                <Table.Td>{s.quantidade}</Table.Td>
                                <Table.Td>{s.lote || '—'}</Table.Td>
                                <Table.Td>{s.validade ? new Date(s.validade).toLocaleDateString('pt-BR') : '—'}</Table.Td>
                                <Table.Td>
                                  {s.distribuicao && s.distribuicao.alocacoes.length > 0 ? (
                                    <Stack gap={2}>
                                      {s.distribuicao.alocacoes.map((a: any, i: number) => (
                                        <Badge key={i} color={a.areaArmazenagem === 'PICKING' ? 'orange' : 'teal'} variant="light" size="sm">
                                          {a.enderecoCompleto} ({a.quantidadeAlocada} un) {a.areaArmazenagem === 'PICKING' ? '🅿' : ''}
                                        </Badge>
                                      ))}
                                      {!s.distribuicao.completa && (
                                        <Text size="xs" c="red">{s.distribuicao.quantidadeRestante} un sem endereço</Text>
                                      )}
                                    </Stack>
                                  ) : sugestoesInteligentes[s.itemId]?.loading ? (
                                    <Group gap={4}>
                                      <Loader size="xs" />
                                      <Text size="xs" c="dimmed">Buscando...</Text>
                                    </Group>
                                  ) : sugestoesInteligentes[s.itemId]?.resultado?.alocacoes?.length ? (
                                    <Stack gap={2}>
                                      {sugestoesInteligentes[s.itemId].resultado!.alocacoes.map((a, i) => (
                                        <Badge key={i} color="indigo" variant="light" size="sm">
                                          {a.enderecoCompleto} ({a.quantidadeAlocada} un)
                                        </Badge>
                                      ))}
                                      {!sugestoesInteligentes[s.itemId].resultado!.completa && (
                                        <Text size="xs" c="red">{sugestoesInteligentes[s.itemId].resultado!.quantidadeRestante} un sem endereço</Text>
                                      )}
                                    </Stack>
                                  ) : sugestoesInteligentes[s.itemId]?.error ? (
                                    <Text size="xs" c="orange">Nenhuma sugestão disponível</Text>
                                  ) : s.sugestao ? (
                                    <Badge color="teal" variant="light" size="sm">
                                      {s.sugestao.enderecoCompleto}
                                    </Badge>
                                  ) : (
                                    <Text size="xs" c="orange">Sem sugestão</Text>
                                  )}
                                </Table.Td>
                                <Table.Td>
                                  {sugestoesInteligentes[s.itemId]?.resultado?.alocacoes?.length ? (
                                    <Stack gap={2}>
                                      {sugestoesInteligentes[s.itemId].resultado!.alocacoes.map((a, i) => (
                                        <Text key={i} size="xs" fw={500}>
                                          {Math.round((a.quantidadeAlocada / (sugestoesInteligentes[s.itemId].resultado!.quantidadeTotal || 1)) * 100)}%
                                        </Text>
                                      ))}
                                    </Stack>
                                  ) : s.distribuicao?.alocacoes?.length > 0 ? (
                                    <Text size="xs" c="dimmed">—</Text>
                                  ) : sugestoesInteligentes[s.itemId]?.loading ? (
                                    <Loader size="xs" />
                                  ) : (
                                    <Text size="xs" c="dimmed">—</Text>
                                  )}
                                </Table.Td>
                                <Table.Td>
                                  <Select
                                    size="xs"
                                    placeholder="Selecionar endereço"
                                    searchable
                                    clearable
                                    value={endDestinos[s.itemId] || null}
                                    onChange={(val) => setEndDestinos({ ...endDestinos, [s.itemId]: val || '' })}
                                    data={
                                      s.distribuicao && s.distribuicao.alocacoes.length > 0
                                        ? s.distribuicao.alocacoes.map((a: any) => ({
                                            value: a.enderecoId,
                                            label: `${a.enderecoCompleto} (${a.quantidadeAlocada} un)${a.areaArmazenagem === 'PICKING' ? ' 🅿' : ''}`,
                                          }))
                                        : sugestoesInteligentes[s.itemId]?.resultado?.alocacoes?.length
                                          ? sugestoesInteligentes[s.itemId].resultado!.alocacoes.map((a) => ({
                                              value: a.enderecoId,
                                              label: `${a.enderecoCompleto} (${a.quantidadeAlocada} un)`,
                                            }))
                                          : s.sugestao
                                            ? [{ value: s.sugestao.enderecoId, label: s.sugestao.enderecoCompleto }]
                                            : []
                                    }
                                    className="w-56"
                                    styles={!endDestinos[s.itemId] && !s.sugestao && !sugestoesInteligentes[s.itemId]?.resultado ? { input: { borderColor: 'var(--mantine-color-orange-5)' } } : undefined}
                                  />
                                </Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>

                        {/* Warning for items without suggestions */}
                        {sugestoesResp.sugestoes.some((s: any) => !s.sugestao && !s.distribuicao?.alocacoes?.length && !sugestoesInteligentes[s.itemId]?.resultado?.alocacoes?.length) && (
                          <Alert icon={<IconAlertCircle size={16} />} color="orange" variant="light" mb="md">
                            Alguns itens não possuem sugestão de endereço. Preencha manualmente ou verifique os endereços disponíveis.
                          </Alert>
                        )}

                        {/* Action buttons */}
                        <Group justify="space-between">
                          <Group>
                            <Button variant="light" color="teal" onClick={handleAceitarSugestoes}
                              disabled={!sugestoesResp.sugestoes.some((s: any) => s.sugestao || s.distribuicao?.alocacoes?.length > 0 || sugestoesInteligentes[s.itemId]?.resultado?.alocacoes?.length)}>
                              Aceitar Sugestões
                            </Button>
                            <Button variant="light" leftSection={<IconPrinter size={14} />} onClick={handleImprimirFichaEnd}>
                              Imprimir Ficha
                            </Button>
                            <Button variant="light" color="violet" leftSection={<IconCamera size={14} />} onClick={() => setOcrEndModalOpen(true)}>
                              📷 Importar Ficha OCR
                            </Button>
                          </Group>
                          <Group>
                            <Button color="indigo" variant="light" leftSection={<IconCheck size={16} />}
                              onClick={handleConfirmarDistribuicaoInteligente}
                              loading={confirmarDistribuicao.isPending}
                              disabled={!Object.values(endDestinos).some(Boolean)}>
                              Confirmar Endereçamento
                            </Button>
                            <Button color="teal" leftSection={<IconCheck size={16} />}
                              onClick={handleConfirmarEnderecamento}
                              loading={confirmarLote.isPending}
                              disabled={!Object.values(endDestinos).some(Boolean)}>
                              Confirmar (Lote)
                            </Button>
                          </Group>
                        </Group>
                      </>
                    ) : !sugestoesLoading ? (
                      <Alert icon={<IconAlertCircle size={16} />} color="yellow" variant="light">
                        Nenhum item encontrado para endereçamento nesta nota.
                      </Alert>
                    ) : null}
                  </>
                )}

                {/* ===== Collector Monitoring View ===== */}
                {endModoAtivo === 'coletor' && (
                  <Card withBorder bg="grape.0">
                    <Group justify="space-between" mb="sm">
                      <Text fw={600} size="lg">📱 Acompanhamento em Tempo Real</Text>
                      <Badge color="grape" variant="light" size="lg" leftSection={<IconRefresh size={14} />}>
                        Atualiza a cada 5s
                      </Badge>
                    </Group>

                    {progressoResp ? (
                      <>
                        {/* Progress bar */}
                        <Group justify="space-between" mb={4}>
                          <Text size="sm" fw={500}>
                            Progresso: {progressoResp.itensEnderecados}/{progressoResp.totalItens} itens endereçados
                          </Text>
                          <Text size="sm" fw={600} c={progressoResp.percentual >= 100 ? 'green' : 'blue'}>
                            {Math.round(progressoResp.percentual)}%
                          </Text>
                        </Group>
                        <Progress
                          value={progressoResp.percentual}
                          size="lg" radius="md"
                          color={progressoResp.percentual >= 100 ? 'green' : 'blue'}
                          mb="md"
                          animated={progressoResp.percentual < 100}
                        />

                        {progressoResp.percentual < 100 && (
                          <Badge color="grape" variant="light" size="lg" mb="md">
                            📱 Aguardando endereçamento pelo coletor...
                          </Badge>
                        )}
                        {progressoResp.percentual >= 100 && (
                          <Badge color="green" variant="filled" size="lg" mb="md">
                            ✅ Todos os itens foram endereçados
                          </Badge>
                        )}

                        {/* Monitoring table */}
                        <Table striped withTableBorder mb="md">
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>#</Table.Th>
                              <Table.Th>Código</Table.Th>
                              <Table.Th>Produto</Table.Th>
                              <Table.Th>Qtd</Table.Th>
                              <Table.Th>Endereço Destino</Table.Th>
                              <Table.Th>Status</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {progressoResp.itens.map((item: any) => (
                              <Table.Tr key={item.itemId} bg={item.status === 'ENDERECADO' ? 'green.0' : undefined}>
                                <Table.Td>{item.item}</Table.Td>
                                <Table.Td className="font-mono">{item.codigoProduto}</Table.Td>
                                <Table.Td fw={500}>{item.descricao}</Table.Td>
                                <Table.Td>{item.quantidade}</Table.Td>
                                <Table.Td className="font-mono">{item.enderecoDestino || '—'}</Table.Td>
                                <Table.Td>
                                  <Badge
                                    color={item.status === 'ENDERECADO' ? 'green' : 'orange'}
                                    variant="light"
                                  >
                                    {item.status === 'ENDERECADO' ? '✅ Endereçado' : '⏳ Pendente'}
                                  </Badge>
                                </Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>

                        {/* Finalizar button */}
                        {progressoResp.percentual >= 100 && (
                          <Group justify="flex-end">
                            <Button color="green" leftSection={<IconCheck size={16} />}
                              onClick={handleFinalizarColetor}
                              loading={gerarEtiquetaHtml.isPending}>
                              Finalizar Endereçamento
                            </Button>
                          </Group>
                        )}
                      </>
                    ) : (
                      <Group justify="center" gap="sm" py="xl">
                        <Loader size="sm" />
                        <Text size="sm" c="dimmed">Carregando progresso...</Text>
                      </Group>
                    )}
                  </Card>
                )}
              </>
            )}

            {/* Endereços livres removidos — agora gerenciado na página de Endereçamento */}
          </Tabs.Panel>
        </Tabs>
      </Card>

      {/* Modal Seleção de Funcionários para Endereçamento */}
      <Modal opened={endFuncModal} onClose={() => { setEndFuncModal(false); setPendingEndNotaId(null) }}
        title="Designar Funcionários para Endereçamento" centered closeOnClickOutside={false}>
        <Alert icon={<IconMapPin size={16} />} color="teal" variant="light" mb="md">
          Selecione os funcionários que irão realizar o endereçamento.
        </Alert>
        <MultiSelect label="Funcionário(s) *" data={funcOptions} value={endFuncIds} onChange={setEndFuncIds}
          searchable placeholder="Selecione os funcionários..." mb="md" />
        <Group justify="flex-end">
          <Button variant="default" onClick={() => { setEndFuncModal(false); if (pendingEndNotaId) enderecarAuto.mutate(pendingEndNotaId) }}>Pular</Button>
          <Button onClick={() => designarEndFuncionarios.mutate()} loading={designarEndFuncionarios.isPending}
            disabled={endFuncIds.length === 0} leftSection={<IconCheck size={16} />} color="teal">
            Designar e Endereçar
          </Button>
        </Group>
      </Modal>

      {/* Modal Seleção de Conferentes */}
      <Modal opened={funcModal} onClose={() => { setFuncModal(false); setEtapa('contagem') }}
        title="Designar Conferentes" centered closeOnClickOutside={false}>
        <Alert icon={<IconClipboardCheck size={16} />} color="blue" variant="light" mb="md">
          Nenhum conferente designado para esta OS. Selecione os funcionários que irão realizar a conferência.
        </Alert>
        <MultiSelect label="Conferente(s) *" data={funcOptions} value={funcIds} onChange={setFuncIds}
          searchable placeholder="Selecione os conferentes..." mb="md" />
        <Group justify="flex-end">
          <Button variant="default" onClick={() => { setFuncModal(false); setEtapa('contagem') }}>Pular</Button>
          <Button onClick={() => designarFuncionarios.mutate()} loading={designarFuncionarios.isPending}
            disabled={funcIds.length === 0} leftSection={<IconCheck size={16} />}>
            Designar e Iniciar
          </Button>
        </Group>
      </Modal>

      {/* Modal Observação */}
      <Modal opened={obsModal} onClose={() => setObsModal(false)} title="Observação da Conferência" centered>
        <Textarea label="Observação / Motivo da divergência" placeholder="Descreva o motivo da divergência..."
          value={observacao} onChange={(e) => setObservacao(e.currentTarget.value)}
          minRows={3} maxRows={6} mb="md" />
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setObsModal(false)}>Cancelar</Button>
          <Button onClick={() => { setObsModal(false); notifications.show({ title: 'Observação salva', message: 'A observação será registrada ao aprovar', color: 'blue' }) }}>
            Salvar
          </Button>
        </Group>
      </Modal>

      {/* ===== Modal Importar Folha (OCR) ===== */}
      <Modal opened={ocrModalOpen} onClose={resetOcrModal} title="📷 Importar Folha de Conferência" size="lg" centered>
        <Stack gap="md">
          {!ocrProcessed && (
            <>
              <Text size="sm" c="dimmed">
                Faça upload de uma imagem (JPEG, PNG) ou PDF da folha de conferência preenchida.
                O sistema irá extrair as quantidades automaticamente via OCR.
              </Text>

              <FileInput
                label="Selecione o arquivo"
                placeholder="Clique para selecionar imagem ou PDF"
                accept="image/jpeg,image/png,application/pdf"
                value={ocrFile}
                onChange={handleOcrFileChange}
                leftSection={<IconUpload size={16} />}
                clearable
              />

              {/* Image preview */}
              {ocrPreview && ocrFormat !== 'PDF' && (
                <Box>
                  <Text size="sm" fw={500} mb="xs">Preview</Text>
                  <Image src={ocrPreview} alt="Preview da folha" mah={250} fit="contain" radius="sm" />
                </Box>
              )}

              {ocrPreview && ocrFormat === 'PDF' && (
                <Alert color="blue" icon={<IconUpload size={16} />}>
                  Arquivo PDF selecionado. Clique em &quot;Processar OCR&quot; para extrair os dados.
                </Alert>
              )}

              {ocrPreview && (
                <Button onClick={handleOcrProcessar} loading={processarOcr.isPending} fullWidth>
                  Processar OCR
                </Button>
              )}

              {processarOcr.isPending && (
                <Group justify="center" gap="sm">
                  <Loader size="sm" />
                  <Text size="sm" c="dimmed">Processando imagem…</Text>
                </Group>
              )}

              {processarOcr.isError && (
                <Alert icon={<IconAlertCircle size={16} />} color="red" title="Erro no OCR">
                  {processarOcr.error instanceof Error ? processarOcr.error.message : 'Erro ao processar imagem'}
                </Alert>
              )}
            </>
          )}

          {/* OCR Results — review extracted fields */}
          {ocrProcessed && ocrCampos.length > 0 && (
            <>
              <Text size="sm" fw={500}>Campos extraídos — revise os valores antes de confirmar</Text>
              <Table striped withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Código</Table.Th>
                    <Table.Th>Quantidade</Table.Th>
                    <Table.Th>Confiança</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {ocrCampos.map((campo, idx) => (
                    <Table.Tr key={`${campo.codigo}-${idx}`} bg={campo.confianca < 80 ? 'yellow.0' : undefined}>
                      <Table.Td className="font-mono">{campo.codigo}</Table.Td>
                      <Table.Td>
                        <NumberInput
                          size="sm" min={0} decimalScale={4}
                          value={ocrEditedValues[campo.codigo] ?? campo.quantidade}
                          onChange={(v) => setOcrEditedValues({ ...ocrEditedValues, [campo.codigo]: typeof v === 'number' ? v : 0 })}
                          className="w-28"
                          styles={campo.confianca < 80 ? { input: { backgroundColor: 'var(--mantine-color-yellow-0)', borderColor: 'var(--mantine-color-yellow-5)' } } : undefined}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Progress value={campo.confianca} size="sm" w={60} color={campo.confianca >= 80 ? 'green' : 'yellow'} />
                          <Text size="xs" c="dimmed">{campo.confianca}%</Text>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>

              <Group justify="flex-end">
                <Button variant="default" onClick={resetOcrModal}>Cancelar</Button>
                <Button variant="light" onClick={() => { setOcrProcessed(false); setOcrCampos([]); setOcrFile(null); setOcrPreview(null) }}>
                  Trocar Imagem
                </Button>
                <Button color="green" leftSection={<IconCheck size={16} />} onClick={handleOcrConfirmar}>
                  Confirmar e Preencher
                </Button>
              </Group>
            </>
          )}

          {ocrProcessed && ocrCampos.length === 0 && (
            <>
              <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
                Nenhum campo foi extraído da imagem. Tente com outra imagem ou preencha manualmente.
              </Alert>
              <Group justify="flex-end">
                <Button variant="default" onClick={resetOcrModal}>Fechar</Button>
                <Button variant="light" onClick={() => { setOcrProcessed(false); setOcrCampos([]); setOcrFile(null); setOcrPreview(null) }}>
                  Tentar Novamente
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Modal>

      {/* ===== Modal Importar Valores (paste) ===== */}
      <Modal opened={importValoresModal} onClose={() => { setImportValoresModal(false); setImportValoresText('') }}
        title="📋 Importar Valores" size="lg" centered>
        <Stack gap="md">
          <Text size="sm" c="dimmed">
            Cole abaixo os valores no formato <strong>código{'\t'}quantidade</strong> (separados por TAB), um item por linha.
            Os códigos serão associados aos produtos da nota automaticamente.
          </Text>

          <Textarea
            label="Dados (código TAB quantidade)"
            placeholder={`Exemplo:\nPROD001\t10\nPROD002\t25\nPROD003\t5`}
            value={importValoresText}
            onChange={(e) => setImportValoresText(e.currentTarget.value)}
            minRows={8}
            maxRows={15}
            autosize
            styles={{ input: { fontFamily: 'monospace' } }}
          />

          {importValoresText.trim() && (
            <Text size="xs" c="dimmed">
              {importValoresText.trim().split('\n').filter(l => l.includes('\t')).length} linha(s) detectada(s) com formato válido
            </Text>
          )}

          <Group justify="flex-end">
            <Button variant="default" onClick={() => { setImportValoresModal(false); setImportValoresText('') }}>Cancelar</Button>
            <Button color="cyan" leftSection={<IconCheck size={16} />} onClick={handleImportarValores}
              disabled={!importValoresText.trim()}>
              Importar e Preencher
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* ===== Modal Importar Ficha OCR Endereçamento ===== */}
      <Modal opened={ocrEndModalOpen} onClose={resetOcrEndModal} title="📷 Importar Ficha de Endereçamento (OCR)" size="lg" centered>
        <Stack gap="md">
          {!ocrEndProcessed && (
            <>
              <Text size="sm" c="dimmed">
                Faça upload de uma imagem (JPEG, PNG) ou PDF da ficha de endereçamento preenchida.
                O sistema irá extrair os endereços automaticamente via OCR.
              </Text>

              <FileInput
                label="Selecione o arquivo"
                placeholder="Clique para selecionar imagem ou PDF"
                accept="image/jpeg,image/png,application/pdf"
                value={ocrEndFile}
                onChange={handleOcrEndFileChange}
                leftSection={<IconUpload size={16} />}
                clearable
              />

              {ocrEndPreview && ocrEndFormat !== 'PDF' && (
                <Box>
                  <Text size="sm" fw={500} mb="xs">Preview</Text>
                  <Image src={ocrEndPreview} alt="Preview da ficha" mah={250} fit="contain" radius="sm" />
                </Box>
              )}

              {ocrEndPreview && ocrEndFormat === 'PDF' && (
                <Alert color="blue" icon={<IconUpload size={16} />}>
                  Arquivo PDF selecionado. Clique em &quot;Processar OCR&quot; para extrair os dados.
                </Alert>
              )}

              {ocrEndPreview && (
                <Button onClick={handleOcrEndProcessar} fullWidth>
                  Processar OCR
                </Button>
              )}
            </>
          )}

          {ocrEndProcessed && ocrEndCampos.length > 0 && (
            <>
              <Text size="sm" fw={500}>Endereços extraídos — revise antes de confirmar</Text>
              <Table striped withTableBorder>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Código Produto</Table.Th>
                    <Table.Th>Endereço</Table.Th>
                    <Table.Th>Confiança</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {ocrEndCampos.map((campo, idx) => (
                    <Table.Tr key={`${campo.codigo}-${idx}`} bg={campo.confianca < 80 ? 'yellow.0' : undefined}>
                      <Table.Td className="font-mono">{campo.codigo}</Table.Td>
                      <Table.Td>
                        <TextInput
                          size="sm"
                          value={ocrEndEditedValues[campo.codigo] ?? campo.endereco}
                          onChange={(e) => setOcrEndEditedValues({ ...ocrEndEditedValues, [campo.codigo]: e.currentTarget.value })}
                          className="w-40"
                          styles={campo.confianca < 80 ? { input: { backgroundColor: 'var(--mantine-color-yellow-0)', borderColor: 'var(--mantine-color-yellow-5)' } } : undefined}
                        />
                      </Table.Td>
                      <Table.Td>
                        <Group gap="xs">
                          <Progress value={campo.confianca} size="sm" w={60} color={campo.confianca >= 80 ? 'green' : 'yellow'} />
                          <Text size="xs" c="dimmed">{campo.confianca}%</Text>
                        </Group>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>

              <Group justify="flex-end">
                <Button variant="default" onClick={resetOcrEndModal}>Cancelar</Button>
                <Button variant="light" onClick={() => { setOcrEndProcessed(false); setOcrEndCampos([]); setOcrEndFile(null); setOcrEndPreview(null) }}>
                  Trocar Imagem
                </Button>
                <Button color="green" leftSection={<IconCheck size={16} />} onClick={handleOcrEndConfirmar}>
                  Confirmar e Preencher
                </Button>
              </Group>
            </>
          )}

          {ocrEndProcessed && ocrEndCampos.length === 0 && (
            <>
              <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
                Nenhum endereço foi extraído da imagem. Tente com outra imagem ou preencha manualmente.
              </Alert>
              <Group justify="flex-end">
                <Button variant="default" onClick={resetOcrEndModal}>Fechar</Button>
                <Button variant="light" onClick={() => { setOcrEndProcessed(false); setOcrEndCampos([]); setOcrEndFile(null); setOcrEndPreview(null) }}>
                  Tentar Novamente
                </Button>
              </Group>
            </>
          )}
        </Stack>
      </Modal>
    </div>
  )
}
