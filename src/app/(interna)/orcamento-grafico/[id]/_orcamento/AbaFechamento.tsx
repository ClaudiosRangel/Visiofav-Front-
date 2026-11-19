'use client'

/**
 * AbaFechamento — totalizador do ORÇAMENTO por tiragem, somando todos os itens com cálculo
 * (`GET /:id/fechamento-totalizador`): Tiragem | Margem | C.Marg. | Valor Unitário | Valor Total.
 * Só exibe valores persistidos que vêm do back; não recalcula nada.
 *
 * Itens sem cálculo ficam fora dos totais e são listados com aviso. Em erro de atualização os
 * últimos valores continuam na tela com aviso de "podem estar desatualizados".
 * O `FechamentoOrcamento` atual (sub-abas e `PUT /:id/fechamento`) entra em `detalhe`, numa
 * seção recolhida "Detalhe do fechamento".
 */

import { useState, type ReactNode } from 'react'
import { Alert, Button, Collapse, Group, Loader, Stack, Text } from '@mantine/core'
import { IconAlertCircle, IconAlertTriangle, IconChevronDown, IconChevronRight } from '@tabler/icons-react'

import { DataTablePadrao, type DataTableColumn } from '@/components/ui/DataTablePadrao'

import type { FechamentoTotalizadorDTO } from '../_hooks/hierarquia.types'
import { totalizarPorTiragem, type LinhaFechamentoExibicao } from './fechamentoTotais'
import { formatarInteiro, formatarMoeda, formatarPercentual2, pluralizar } from './formatadores'
import { formatarValorUnitario } from './formatacao'

type FechamentoLinhaDTO = LinhaFechamentoExibicao

export interface AbaFechamentoProps {
  dados: FechamentoTotalizadorDTO | null
  carregando?: boolean
  /** Erro da última leitura; com `dados` presentes, são os últimos valores bons. */
  erro?: string | null
  onTentarNovamente?: () => void
  /** Conteúdo da seção recolhida "Detalhe do fechamento". */
  detalhe?: ReactNode
}

const colunas: DataTableColumn<FechamentoLinhaDTO>[] = [
  { accessor: 'tiragem', title: 'Tiragem', textAlign: 'right', render: (l) => formatarInteiro(l.tiragem) },
  { accessor: 'margemPerc', title: 'Margem', textAlign: 'right', render: (l) => formatarPercentual2(l.margemPerc) },
  {
    accessor: 'contribuicaoMarginalPerc',
    title: 'C.Marg.',
    textAlign: 'right',
    render: (l) => formatarPercentual2(l.contribuicaoMarginalPerc),
  },
  { accessor: 'valorUnitario', title: 'Valor Unitário', textAlign: 'right', render: (l) => formatarValorUnitario(l.valorUnitario) },
  {
    accessor: 'valorTotal',
    title: 'Valor Total',
    textAlign: 'right',
    render: (l) => <Text size="sm" fw={600}>{formatarMoeda(l.valorTotal)}</Text>,
  },
]

export default function AbaFechamento({ dados, carregando = false, erro, onTentarNovamente, detalhe }: AbaFechamentoProps) {
  const [detalheAberto, setDetalheAberto] = useState(false)

  const botaoNovamente = onTentarNovamente && (
    <Button size="xs" variant="default" onClick={onTentarNovamente} loading={carregando}>
      Tentar novamente
    </Button>
  )

  let corpo
  if (!dados && carregando) {
    corpo = (
      <Group gap="xs" py="md">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">Carregando fechamento…</Text>
      </Group>
    )
  } else if (!dados && erro) {
    corpo = (
      <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />} title="Não foi possível carregar o fechamento">
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm">{erro}</Text>
          {botaoNovamente}
        </Group>
      </Alert>
    )
  } else if (dados) {
    const qtdSem = dados.quantidadeSemCalculo
    const linhasExibicao = totalizarPorTiragem(dados.linhas)
    corpo = (
      <Stack gap="sm">
        {erro && (
          <Alert color="yellow" variant="light" icon={<IconAlertTriangle size={16} />} title="Totais possivelmente desatualizados">
            <Group justify="space-between" wrap="nowrap">
              <Text size="sm">{erro} Os valores abaixo são os últimos carregados e podem estar desatualizados.</Text>
              {botaoNovamente}
            </Group>
          </Alert>
        )}

        {qtdSem > 0 && (
          <Alert color="yellow" variant="light" icon={<IconAlertTriangle size={16} />}>
            <Stack gap={4}>
              <Text size="sm" fw={500}>
                {qtdSem} {pluralizar(qtdSem, 'item sem cálculo foi excluído', 'itens sem cálculo foram excluídos')} dos totais.
              </Text>
              {dados.itensSemCalculo.map((i) => (
                <Text key={i.id} size="sm">
                  Item {i.sequencia} — {i.descricao ?? 'Sem descrição'}
                </Text>
              ))}
            </Stack>
          </Alert>
        )}

        {linhasExibicao.length === 0 ? (
          <Text size="sm" c="dimmed" py="md" ta="center">Não há valores a totalizar neste orçamento.</Text>
        ) : (
          <DataTablePadrao<FechamentoLinhaDTO>
            dados={linhasExibicao}
            colunas={colunas}
            comBusca={false}
            idAccessor="tiragem"
            pageSize={50}
            minHeight={120}
            ordenacaoInicial={{ columnAccessor: 'tiragem', direction: 'asc' }}
            textoVazio="Não há valores a totalizar neste orçamento."
          />
        )}
      </Stack>
    )
  } else {
    corpo = null
  }

  return (
    <Stack gap="md">
      {corpo}
      {detalhe && (
        <Stack gap="xs">
          <Button
            variant="subtle"
            size="xs"
            w="fit-content"
            leftSection={detalheAberto ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
            onClick={() => setDetalheAberto((v) => !v)}
          >
            Detalhe do fechamento
          </Button>
          <Collapse in={detalheAberto}>{detalhe}</Collapse>
        </Stack>
      )}
    </Stack>
  )
}
