'use client'

/**
 * DataTablePadrao — grid padrão do sistema (spec padronizacao-grids).
 * Encapsula o mantine-datatable com o comportamento combinado:
 *  - busca client-side por texto livre (campos configuráveis),
 *  - ordenação por coluna (clique no cabeçalho),
 *  - paginação com contador de registros,
 *  - estados de carregando/vazio.
 *
 * Client-side por padrão (listas até alguns milhares). Para telas com
 * paginação server-side, passe `serverSide` e controle page/sort por fora.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Stack, Group, TextInput, Text } from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'
import { DataTable, type DataTableColumn, type DataTableSortStatus } from 'mantine-datatable'

export interface DataTablePadraoProps<T> {
  /** Registros completos (client-side) OU a página atual (server-side). */
  dados: T[]
  colunas: DataTableColumn<T>[]
  /** Campos (accessors) considerados na busca textual (client-side). */
  camposBusca?: (keyof T | string)[]
  /** Placeholder do campo de busca. */
  buscaPlaceholder?: string
  /** Mostra o campo de busca (default true). */
  comBusca?: boolean
  carregando?: boolean
  idAccessor?: string
  pageSize?: number
  /** Texto quando vazio. */
  textoVazio?: string
  /** Ordenação inicial. */
  ordenacaoInicial?: DataTableSortStatus<T>
  /** Altura mínima da tabela. */
  minHeight?: number
}

/** Lê um accessor com ponto ("a.b.c") de um objeto. */
function lerAccessor(obj: any, accessor: string): unknown {
  return accessor.split('.').reduce((o, k) => (o == null ? o : o[k]), obj)
}

export function DataTablePadrao<T>({
  dados,
  colunas,
  camposBusca,
  buscaPlaceholder = 'Buscar...',
  comBusca = true,
  carregando = false,
  idAccessor = 'id',
  pageSize = 15,
  textoVazio = 'Nenhum registro encontrado',
  ordenacaoInicial,
  minHeight = 200,
}: DataTablePadraoProps<T>) {
  const [busca, setBusca] = useState('')
  const [page, setPage] = useState(1)
  const [sortStatus, setSortStatus] = useState<DataTableSortStatus<T>>(
    ordenacaoInicial ?? { columnAccessor: (colunas[0]?.accessor as string) ?? 'id', direction: 'asc' },
  )

  // Campos de busca: se não informado, usa todas as colunas com accessor string.
  const campos = useMemo(
    () => (camposBusca?.map(String) ?? colunas.map((c) => String(c.accessor))),
    [camposBusca, colunas],
  )

  const registros = useMemo(() => {
    let r = dados
    if (busca.trim()) {
      const b = busca.toLowerCase()
      r = r.filter((item) =>
        campos.some((campo) => {
          const v = lerAccessor(item, campo)
          return v != null && String(v).toLowerCase().includes(b)
        }),
      )
    }
    const acc = String(sortStatus.columnAccessor)
    r = [...r].sort((a, b) => {
      const av = lerAccessor(a, acc) ?? ''
      const bv = lerAccessor(b, acc) ?? ''
      const cmp = String(av).localeCompare(String(bv), 'pt-BR', { numeric: true })
      return sortStatus.direction === 'asc' ? cmp : -cmp
    })
    return r
  }, [dados, busca, campos, sortStatus])

  const total = registros.length
  const paginado = useMemo(() => {
    const from = (page - 1) * pageSize
    return registros.slice(from, from + pageSize)
  }, [registros, page, pageSize])

  useEffect(() => { setPage(1) }, [busca])

  return (
    <Stack gap="xs">
      {comBusca && (
        <Group justify="space-between">
          <TextInput
            placeholder={buscaPlaceholder}
            leftSection={<IconSearch size={16} />}
            value={busca}
            onChange={(e) => setBusca(e.currentTarget.value)}
            w={400}
          />
          <Text size="xs" c="dimmed">{total} registro(s)</Text>
        </Group>
      )}
      <DataTable<T>
        withTableBorder
        striped
        highlightOnHover
        minHeight={minHeight}
        fetching={carregando}
        records={paginado}
        totalRecords={total}
        recordsPerPage={pageSize}
        page={page}
        onPageChange={setPage}
        sortStatus={sortStatus}
        onSortStatusChange={setSortStatus}
        idAccessor={idAccessor}
        columns={colunas}
        noRecordsText={textoVazio}
      />
    </Stack>
  )
}

export type { DataTableColumn }
