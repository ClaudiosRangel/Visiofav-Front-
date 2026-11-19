'use client'

import { useCallback, useEffect, useState } from 'react'
import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconSearch } from '@tabler/icons-react'
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
  onUsado,
  onCriado,
}: SeletorCalculoPadraoProps) {
  const [filtros, setFiltros] = useState<FiltrosCalculoValores>(() => filtrosCalculoVazios(linhaInicial))
  const [itens, setItens] = useState<ResumoCalculo[]>([])
  const [quantidade, setQuantidade] = useState(0)
  const [limitado, setLimitado] = useState(false)
  const [buscou, setBuscou] = useState(false)
  const [erroBusca, setErroBusca] = useState<string | null>(null)
  const [selecionado, setSelecionado] = useState<ResumoCalculo | null>(null)
  const [carregando, setCarregando] = useState(false)
  const [usando, setUsando] = useState(false)

  // Ao abrir: grade vazia, "Quantidade de cálculos: 0" e filtro Linha pré-preenchido.
  useEffect(() => {
    if (!opened) return
    setFiltros(filtrosCalculoVazios(linhaInicial))
    setItens([])
    setQuantidade(0)
    setLimitado(false)
    setBuscou(false)
    setErroBusca(null)
    setSelecionado(null)
  }, [opened, linhaInicial])

  const pesquisar = useCallback(async () => {
    if (validarNumeroCalculo(filtros.numero)) return
    setCarregando(true)
    setErroBusca(null)
    try {
      const res = await api.get('/calculo-grafico', {
        params: { modo: 'SELETOR', ...montarParamsBuscaCalculo(filtros) },
      })
      const data: RespostaBuscaCalculo = res.data
      setItens(data.itens ?? [])
      setQuantidade(data.quantidadeCalculos ?? data.itens?.length ?? 0)
      setLimitado(Boolean(data.limitado))
      setBuscou(true)
      setSelecionado(null)
    } catch (err: any) {
      // Erro preserva filtros e a grade anterior.
      setErroBusca(err?.response?.data?.message || 'Falha ao buscar cálculos. Tente novamente.')
    } finally {
      setCarregando(false)
    }
  }, [filtros])

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
        <FiltrosCalculo valores={filtros} onChange={setFiltros} onEnter={pesquisar} disabled={carregando || usando} />

        <Group justify="space-between">
          <Text fw={600}>Quantidade de cálculos: {quantidade}</Text>
          <Button
            leftSection={<IconSearch size={16} />}
            onClick={pesquisar}
            loading={carregando}
            disabled={Boolean(validarNumeroCalculo(filtros.numero))}
          >
            Pesquisar
          </Button>
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
