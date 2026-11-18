'use client'

/**
 * AbaComissoes — comissões do orçamento, calculadas no back (`GET /:id/comissoes`).
 * Uma linha por comissão, com os valores exatamente como retornados: o front não calcula,
 * não recalcula e não deriva valores de comissão. Estados distintos: carregando (até o prazo
 * de 10 s do hook), vazio (sucesso sem linhas) e erro (com "Tentar novamente").
 */

import { Alert, Button, Group, Loader, Stack, Text } from '@mantine/core'
import { IconAlertCircle } from '@tabler/icons-react'

import { DataTablePadrao, type DataTableColumn } from '@/components/ui/DataTablePadrao'

import type { ComissaoLinhaDTO, ComissoesDTO } from '../_hooks/hierarquia.types'
import { formatarMoeda, formatarPercentualOriginal } from './formatadores'

export interface AbaComissoesProps {
  dados: ComissoesDTO | null
  carregando?: boolean
  erro?: string | null
  onTentarNovamente?: () => void
}

type LinhaComId = ComissaoLinhaDTO & { _id: number }

const ROTULO_ORIGEM: Record<string, string> = { VENDEDOR: 'Vendedor' }

const colunas: DataTableColumn<LinhaComId>[] = [
  { accessor: 'origem', title: 'Origem', render: (l) => ROTULO_ORIGEM[l.origem] ?? l.origem },
  { accessor: 'descricao', title: 'Descrição' },
  { accessor: 'percentual', title: 'Percentual', textAlign: 'right', render: (l) => formatarPercentualOriginal(l.percentual) },
  { accessor: 'base', title: 'Base', textAlign: 'right', render: (l) => formatarMoeda(l.base) },
  {
    accessor: 'valor',
    title: 'Valor',
    textAlign: 'right',
    render: (l) => <Text size="sm" fw={600}>{formatarMoeda(l.valor)}</Text>,
  },
]

export default function AbaComissoes({ dados, carregando = false, erro, onTentarNovamente }: AbaComissoesProps) {
  if (erro) {
    return (
      <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />} title="Não foi possível carregar as comissões">
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm">{erro}</Text>
          {onTentarNovamente && (
            <Button size="xs" variant="default" onClick={onTentarNovamente} loading={carregando}>
              Tentar novamente
            </Button>
          )}
        </Group>
      </Alert>
    )
  }

  if (!dados) {
    return (
      <Group gap="xs" py="md">
        <Loader size="sm" />
        <Text size="sm" c="dimmed">{carregando ? 'Carregando comissões…' : 'Aguardando comissões.'}</Text>
      </Group>
    )
  }

  if (dados.linhas.length === 0) {
    return (
      <Text size="sm" c="dimmed" py="md" ta="center">
        Não há comissões a exibir para este orçamento.
      </Text>
    )
  }

  const linhas: LinhaComId[] = dados.linhas.map((l, i) => ({ ...l, _id: i }))

  return (
    <Stack gap="xs">
      <DataTablePadrao<LinhaComId>
        dados={linhas}
        colunas={colunas}
        comBusca={false}
        idAccessor="_id"
        pageSize={50}
        minHeight={120}
        carregando={carregando}
        ordenacaoInicial={{ columnAccessor: '_id', direction: 'asc' }}
      />
    </Stack>
  )
}
