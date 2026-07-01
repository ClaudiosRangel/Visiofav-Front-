'use client'

import { useState } from 'react'
import {
  Card,
  Group,
  Text,
  Table,
  Pagination,
  TextInput,
  LoadingOverlay,
  Button,
  Badge,
  Select,
} from '@mantine/core'
import { IconSearch, IconPlus } from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useDebouncedValue } from '@mantine/hooks'
import Link from 'next/link'

// --- Interfaces ---

export interface ColumnDef<T> {
  key: keyof T | string
  label: string
  render?: (value: any, item: T) => React.ReactNode
  width?: number | string
}

export interface FilterConfig {
  key: string
  label: string
  type: 'text' | 'select' | 'date' | 'daterange'
  options?: { value: string; label: string }[]
}

interface ListResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface ListagemFiscalProps<T> {
  queryKey: string[]
  endpoint: string
  columns: ColumnDef<T>[]
  filters?: FilterConfig[]
  actions?: (item: T) => React.ReactNode
  title: string
  breadcrumb: string
  createButton?: { label: string; href: string }
  statusColors?: Record<string, string>
}

// --- Component ---

export function ListagemFiscal<T extends Record<string, any>>({
  queryKey,
  endpoint,
  columns,
  filters,
  actions,
  title,
  breadcrumb,
  createButton,
  statusColors,
}: ListagemFiscalProps<T>) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch] = useDebouncedValue(search, 300)
  const [filterValues, setFilterValues] = useState<Record<string, string>>({})
  const limit = 20

  const { data: response, isLoading } = useQuery<ListResponse<T>>({
    queryKey: [...queryKey, { page, limit, search: debouncedSearch, ...filterValues }],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit }
      if (debouncedSearch) params.search = debouncedSearch
      // Append filter values
      Object.entries(filterValues).forEach(([key, value]) => {
        if (value) params[key] = value
      })
      const { data } = await api.get(endpoint, { params })
      return data
    },
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  })

  const items = response?.data ?? []
  const totalPages = response?.totalPages ?? 1

  function getCellValue(item: T, key: string): any {
    return (item as any)[key]
  }

  function handleFilterChange(key: string, value: string | null) {
    setFilterValues((prev) => ({ ...prev, [key]: value ?? '' }))
    setPage(1)
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>
        {breadcrumb}
      </Text>
      <Text size="xl" fw={600} mb="lg">
        {title}
      </Text>

      <Card pos="relative">
        <LoadingOverlay visible={isLoading} />

        <Group justify="space-between" mb="md">
          <Group>
            <TextInput
              placeholder="Buscar..."
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => {
                setSearch(e.currentTarget.value)
                setPage(1)
              }}
              style={{ minWidth: 250 }}
            />
            {filters?.map((filter) => {
              if (filter.type === 'select' && filter.options) {
                return (
                  <Select
                    key={filter.key}
                    placeholder={filter.label}
                    data={filter.options}
                    value={filterValues[filter.key] || null}
                    onChange={(value) => handleFilterChange(filter.key, value)}
                    clearable
                    style={{ minWidth: 160 }}
                  />
                )
              }
              if (filter.type === 'text') {
                return (
                  <TextInput
                    key={filter.key}
                    placeholder={filter.label}
                    value={filterValues[filter.key] || ''}
                    onChange={(e) => handleFilterChange(filter.key, e.currentTarget.value)}
                    style={{ minWidth: 160 }}
                  />
                )
              }
              return null
            })}
          </Group>

          {createButton && (
            <Button
              component={Link}
              href={createButton.href}
              leftSection={<IconPlus size={16} />}
            >
              {createButton.label}
            </Button>
          )}
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              {columns.map((col) => (
                <Table.Th key={String(col.key)} style={col.width ? { width: col.width } : undefined}>
                  {col.label}
                </Table.Th>
              ))}
              {actions && <Table.Th>Ações</Table.Th>}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {items.length === 0 && !isLoading ? (
              <Table.Tr>
                <Table.Td
                  colSpan={columns.length + (actions ? 1 : 0)}
                  style={{ textAlign: 'center', padding: '2rem 0' }}
                >
                  <Text c="dimmed">Nenhum registro encontrado</Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              items.map((item, index) => (
                <Table.Tr key={(item as any).id ?? index}>
                  {columns.map((col) => {
                    const value = getCellValue(item, String(col.key))
                    return (
                      <Table.Td key={String(col.key)}>
                        {col.render
                          ? col.render(value, item)
                          : statusColors && String(col.key).toLowerCase() === 'status'
                            ? (
                              <Badge
                                color={statusColors[value] || 'gray'}
                                variant="light"
                              >
                                {value}
                              </Badge>
                            )
                            : (value ?? '—')}
                      </Table.Td>
                    )
                  })}
                  {actions && <Table.Td>{actions(item)}</Table.Td>}
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>

        {totalPages > 1 && (
          <Group justify="center" mt="md">
            <Pagination
              total={totalPages}
              value={page}
              onChange={setPage}
            />
          </Group>
        )}
      </Card>
    </div>
  )
}
