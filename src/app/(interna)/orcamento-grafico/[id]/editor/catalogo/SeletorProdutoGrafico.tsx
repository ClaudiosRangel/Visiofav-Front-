'use client'

/**
 * SeletorProdutoGrafico — escolha opcional do Produto Gráfico do item
 * (Fase 2, spec orcamento-grafico-catalogo-no-editor, tarefa 4.2).
 *
 * - Lista os produtos ativos; filtra pela Linha de Produto do orçamento quando houver.
 * - Opcional e limpável (limpar volta ao comportamento atual do item).
 * - Produto salvo e hoje inativo aparece como inativo, sem poder ser escolhido de novo.
 * - Aviso discreto quando o produto não pertence à linha atual (nunca apaga a escolha).
 * - Não altera o Tipo de Embalagem nem o cálculo; só informa a escolha ao editor.
 */

import { useEffect, useMemo, useState } from 'react'
import { Alert, Group, Loader, Select, Stack, Text } from '@mantine/core'
import { IconAlertCircle, IconInfoCircle } from '@tabler/icons-react'

import { mensagemErroApi, produtosApi } from '../../../cadastros/_shared/cadastros-graficos.api'
import type { ProdutoGrafico } from '../../../cadastros/_shared/cadastros-graficos.types'
import type { UseCatalogoItemResultado } from './useCatalogoItem'

export interface ProdutoEscolhido {
  id: string
  nome: string
}

interface Props {
  /** Produto gravado/escolhido no item (indefinido ou null = nenhum). */
  value: string | null | undefined
  /** Linha de Produto do orçamento (filtra a lista quando informada). */
  linhaProdutoId?: string | null
  /** Estado do catálogo (carregando, erro, vazio) para mensagens abaixo do seletor. */
  catalogo?: UseCatalogoItemResultado
  disabled?: boolean
  onChange: (produto: ProdutoEscolhido | null) => void
}

export default function SeletorProdutoGrafico({ value, linhaProdutoId, catalogo, disabled, onChange }: Props) {
  const [produtos, setProdutos] = useState<ProdutoGrafico[]>([])
  const [carregandoLista, setCarregandoLista] = useState(false)
  const [erroLista, setErroLista] = useState<string | null>(null)
  // Produto gravado que não está entre os ativos (inativo ou de outra linha).
  const [extra, setExtra] = useState<ProdutoGrafico | null>(null)

  useEffect(() => {
    let cancelado = false
    setCarregandoLista(true)
    setErroLista(null)
    produtosApi
      .listar({ situacao: 'ativo', ...(linhaProdutoId ? { linhaProdutoId } : {}) })
      .then((lista) => {
        if (!cancelado) setProdutos(Array.isArray(lista) ? lista : [])
      })
      .catch((err) => {
        if (cancelado) return
        setProdutos([])
        setErroLista(mensagemErroApi(err, 'Não foi possível carregar os produtos gráficos.'))
      })
      .finally(() => {
        if (!cancelado) setCarregandoLista(false)
      })
    return () => {
      cancelado = true
    }
  }, [linhaProdutoId])

  // Produto escolhido fora da lista (inativo ou de outra linha): busca para exibir o nome.
  useEffect(() => {
    if (!value || carregandoLista || produtos.some((p) => p.id === value)) {
      setExtra(null)
      return
    }
    let cancelado = false
    produtosApi
      .obter(value)
      .then((p) => {
        if (!cancelado) setExtra(p)
      })
      .catch(() => {
        if (!cancelado) setExtra(null)
      })
    return () => {
      cancelado = true
    }
  }, [value, produtos, carregandoLista])

  const opcoes = useMemo(() => {
    const base = produtos.map((p) => ({ value: p.id, label: p.nome }))
    if (extra && !base.some((o) => o.value === extra.id)) {
      base.unshift({
        value: extra.id,
        label: extra.status ? extra.nome : `${extra.nome} (inativo)`,
        // Produto inativo não pode ser escolhido de novo.
        ...(extra.status ? {} : { disabled: true }),
      } as { value: string; label: string })
    }
    return base
  }, [produtos, extra])

  const atual = value ? produtos.find((p) => p.id === value) ?? extra : null
  const foraDaLinha =
    !!atual && !!linhaProdutoId && !!atual.linhaProdutoId && atual.linhaProdutoId !== linhaProdutoId

  return (
    <Stack gap={6}>
      <Select
        label="Produto Gráfico"
        placeholder="Selecione o produto (opcional)"
        description="Define as atividades, os planos e os padrões oferecidos neste item."
        data={opcoes}
        value={value ?? null}
        searchable
        clearable
        disabled={disabled}
        nothingFoundMessage={carregandoLista ? 'Carregando...' : 'Nenhum produto encontrado'}
        rightSection={carregandoLista || catalogo?.carregando ? <Loader size={14} /> : undefined}
        comboboxProps={{ withinPortal: true }}
        maw={420}
        onChange={(v) => {
          if (!v) return onChange(null)
          const p = produtos.find((x) => x.id === v) ?? extra
          onChange({ id: v, nome: p?.nome ?? '' })
        }}
      />

      {erroLista && (
        <Text size="xs" c="red">
          {erroLista}
        </Text>
      )}

      {foraDaLinha && (
        <Group gap={6} wrap="nowrap" align="flex-start">
          <IconInfoCircle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
          <Text size="xs" c="dimmed">
            Este produto não pertence à Linha de Produto atual do orçamento. A escolha foi mantida.
          </Text>
        </Group>
      )}

      {catalogo?.erro && (
        <Alert variant="light" color="orange" icon={<IconAlertCircle size={16} />} p="xs">
          <Group justify="space-between" gap="xs" wrap="nowrap">
            <Text size="xs">{catalogo.erro} As listas gerais continuam disponíveis.</Text>
            <Text size="xs" c="blue" style={{ cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={catalogo.recarregar}>
              Tentar de novo
            </Text>
          </Group>
        </Alert>
      )}

      {catalogo?.vazio && (
        <Text size="xs" c="dimmed">
          Nenhuma atividade cadastrada para este produto. As listas gerais continuam disponíveis.
        </Text>
      )}
    </Stack>
  )
}
