'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Alert, Button, Group, Loader, Modal, Stack, Text } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'
import FiltrosCalculo, {
  filtrosCalculoVazios,
  montarParamsBuscaCalculo,
  validarNumeroCalculo,
  type FiltrosCalculoValores,
} from './FiltrosCalculo'
import GradeCalculos, { type RespostaBuscaCalculo, type ResumoCalculo } from './ColunasCalculo'

export type { ResumoCalculo } from './ColunasCalculo'

/** Aviso devolvido por POST /orcamento-grafico/:id/itens/usar-calculo. */
type AvisoUsoCalculo = { codigo: string; [chave: string]: unknown }

const MENSAGEM_AVISO: Record<string, string> = {
  PRODUTO_NAO_RESOLVIDO: 'Não foi possível identificar o produto do cadastro. Selecione-o no item.',
  TIPO_PLANO_NAO_RESOLVIDO: 'Não foi possível identificar o tipo de plano. Selecione-o no item.',
  FOTO_SEM_CAMPOS: 'Alguns dados de margem do cálculo de origem não estavam disponíveis.',
  DECOMPOSICAO_INDISPONIVEL: 'A decomposição de custos do cálculo de origem não está disponível. O custo total foi mantido.',
  PLANO_BASE_NAO_PREENCHIDO: 'O plano base não pôde ser preenchido. O valor do item foi mantido.',
}

function mensagemDoAviso(a: AvisoUsoCalculo): string {
  return MENSAGEM_AVISO[a.codigo] ?? 'O item foi criado com um aviso.'
}

export interface ClienteDoSeletor {
  /** O código do cliente pode vir como número (codigoCalcgraf é inteiro). */
  codigo?: string | number | null
  nome?: string | null
}

const texto = (v: unknown): string => (v == null ? '' : String(v)).trim()

/** Filtros ao abrir: linha escolhida e o cliente do orçamento (código, se houver; senão o nome). */
export function filtrosIniciais(linhaInicial?: string | null, cliente?: ClienteDoSeletor | null): FiltrosCalculoValores {
  const f = filtrosCalculoVazios(linhaInicial)
  const codigo = texto(cliente?.codigo)
  const nome = texto(cliente?.nome)
  if (codigo) f.clienteCodigo = codigo
  else if (nome) f.clienteNome = nome
  return f
}

interface SeletorCalculoPadraoProps {
  opened: boolean
  onClose: () => void
  /**
   * Presente: "Usar" copia o cálculo para um item deste orçamento.
   * Ausente: "Usar" cria um orçamento novo a partir do cálculo (lista de orçamentos).
   */
  orcamentoId?: string
  /** Linha de produto já escolhida no diálogo de linha; pré-preenche o filtro Linha. */
  linhaInicial?: string | null
  /** Cliente do orçamento: a busca abre já filtrada por ele (o filtro pode ser limpo). */
  clienteInicial?: ClienteDoSeletor | null
  /** Chamado após criar o item (recarrega a grade/orçamento). */
  onUsado?: () => void
  /** Chamado após criar o orçamento a partir do cálculo. */
  onCriado?: (orcamentoId: string) => void
}

export default function SeletorCalculoPadrao({
  opened,
  onClose,
  orcamentoId,
  linhaInicial,
  clienteInicial,
  onUsado,
  onCriado,
}: SeletorCalculoPadraoProps) {
  const [filtros, setFiltros] = useState<FiltrosCalculoValores>(() => filtrosIniciais(linhaInicial, clienteInicial))
  // Pesquisa enquanto digita (espera 300 ms), sem botão "Pesquisar".
  const [filtrosAtrasados] = useDebouncedValue(filtros, 300)
  const [itens, setItens] = useState<ResumoCalculo[]>([])
  const [quantidade, setQuantidade] = useState(0)
  const [limitado, setLimitado] = useState(false)
  const [buscou, setBuscou] = useState(false)
  const [erroBusca, setErroBusca] = useState<string | null>(null)
  const [selecionado, setSelecionado] = useState<ResumoCalculo | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [usando, setUsando] = useState(false)
  const requisicao = useRef(0)
  const clienteCodigo = clienteInicial?.codigo ?? null
  const clienteNome = clienteInicial?.nome ?? null

  // Ao abrir: grade vazia e filtros Linha/Cliente pré-preenchidos.
  useEffect(() => {
    if (!opened) return
    setFiltros(filtrosIniciais(linhaInicial, { codigo: clienteCodigo, nome: clienteNome }))
    setItens([])
    setQuantidade(0)
    setLimitado(false)
    setBuscou(false)
    setErroBusca(null)
    setSelecionado(null)
  }, [opened, linhaInicial, clienteCodigo, clienteNome])

  const pesquisar = useCallback(async (f: FiltrosCalculoValores) => {
    if (validarNumeroCalculo(f.numero)) return
    const id = ++requisicao.current
    setCarregando(true)
    setErroBusca(null)
    try {
      const res = await api.get('/calculo-grafico', {
        params: { modo: 'SELETOR', ...montarParamsBuscaCalculo(f) },
      })
      if (id !== requisicao.current) return
      const data: RespostaBuscaCalculo = res.data
      setItens(data.itens ?? [])
      setQuantidade(data.quantidadeCalculos ?? data.itens?.length ?? 0)
      setLimitado(Boolean(data.limitado))
      setBuscou(true)
      setSelecionado(null)
    } catch (err: any) {
      if (id !== requisicao.current) return
      // Erro preserva filtros e a grade anterior.
      setErroBusca(err?.response?.data?.message || 'Falha ao buscar cálculos. Tente novamente.')
    } finally {
      if (id === requisicao.current) setCarregando(false)
    }
  }, [])

  useEffect(() => {
    if (opened) void pesquisar(filtrosAtrasados)
  }, [opened, filtrosAtrasados, pesquisar])

  const usar = async () => {
    if (!selecionado) return
    setUsando(true)
    try {
      if (orcamentoId) {
        const res = await api.post(`/orcamento-grafico/${orcamentoId}/itens/usar-calculo`, {
          calculoId: selecionado.id,
        })
        const avisos: AvisoUsoCalculo[] = res.data?.avisos ?? []
        notifications.show({
          title: 'Item criado',
          message: `Item criado a partir do cálculo ${res.data?.numeroCalculo ?? selecionado.numero ?? ''}.`.trim(),
          color: 'green',
        })
        avisos.forEach((a) =>
          notifications.show({ title: 'Atenção', message: mensagemDoAviso(a), color: 'yellow' }),
        )
        onUsado?.()
        onClose()
      } else {
        const res = await api.post('/orcamento-grafico/de-calculo', { calculoId: selecionado.id })
        notifications.show({
          title: 'Orçamento criado',
          message: 'Orçamento criado a partir do cálculo.',
          color: 'green',
        })
        onCriado?.(res.data.id)
        onClose()
      }
    } catch (err: any) {
      notifications.show({
        title: 'Erro',
        message: err?.response?.data?.message || 'Falha ao usar o cálculo.',
        color: 'red',
      })
    } finally {
      setUsando(false)
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title="Localizar Cálculo Padrão" size="80rem">
      <Stack gap="md">
        <FiltrosCalculo valores={filtros} onChange={setFiltros} onEnter={() => void pesquisar(filtros)} disabled={usando} />

        <Group justify="space-between">
          <Text fw={600}>Quantidade de cálculos: {quantidade}</Text>
          {carregando && <Loader size="xs" aria-label="Pesquisando" />}
        </Group>

        {erroBusca && (
          <Alert color="red" title="Erro na busca">
            {erroBusca}
          </Alert>
        )}

        {limitado && (
          <Alert color="yellow">
            O resultado foi limitado a 500 cálculos. Refine os filtros para ver os demais.
          </Alert>
        )}

        <GradeCalculos
          itens={itens}
          selecionadoId={selecionado?.id ?? null}
          onSelecionar={setSelecionado}
          mensagemVazia={buscou ? 'Nenhum cálculo encontrado' : ''}
        />

        <Group justify="flex-end">
          <Button variant="default" onClick={onClose} disabled={usando}>
            Sair
          </Button>
          <Button onClick={usar} disabled={!selecionado} loading={usando}>
            Usar
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
