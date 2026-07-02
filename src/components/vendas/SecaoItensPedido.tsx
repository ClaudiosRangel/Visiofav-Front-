'use client'

import { useState } from 'react'
import {
  Table,
  ActionIcon,
  Button,
  Group,
  Text,
  NumberInput,
  Select,
  Tooltip,
  Textarea,
  Collapse,
} from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { IconPlus, IconTrash, IconChevronDown, IconChevronRight } from '@tabler/icons-react'
import { Controller, useFormContext, useFieldArray } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { PedidoVendaFormValues } from '@/lib/schemas/pedidoVendaSchema'
import type { StatusPedido } from '@/data/hooks/vendas/types'
import { calcularTotalItem, isItemEditable } from './utils'

interface SecaoItensPedidoProps {
  disabled?: boolean
  status?: StatusPedido
}

export function SecaoItensPedido({ disabled, status }: SecaoItensPedidoProps) {
  const { control, watch, formState: { errors } } = useFormContext<PedidoVendaFormValues>()
  const { fields, append, remove } = useFieldArray({ control, name: 'itens' })
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({})

  const { data: produtosData } = useQuery<any>({
    queryKey: ['produtos-select'],
    queryFn: async () => {
      const { data } = await api.get('/produtos', { params: { limit: 200, status: 'true' } })
      return data
    },
    staleTime: 1000 * 60 * 5,
  })

  const produtoOptions = (produtosData?.data || []).map((p: any) => ({
    value: p.id,
    label: `${p.codigo} — ${p.nome}`,
  }))

  function toggleExpand(index: number) {
    setExpandedRows((prev) => ({ ...prev, [index]: !prev[index] }))
  }

  function handleAddItem() {
    append({
      produtoId: '',
      unidade: '',
      quantidade: 1,
      precoUnitario: 0,
      desconto: 0,
      descontoValor: 0,
      frete: 0,
      seguro: 0,
      outrasDespesas: 0,
      observacaoItem: '',
      dataEntregaItem: '',
      comissaoPercItem: undefined,
    })
  }

  function getItemEditable(index: number): boolean {
    if (!status) return !disabled
    const itens = watch('itens')
    const item = itens[index]
    if (!item) return !disabled
    // For items with quantidadeFaturada field (from loaded data)
    const itemWithFaturamento = item as any
    const quantidadeFaturada = itemWithFaturamento.quantidadeFaturada ?? 0
    return isItemEditable({ quantidadeFaturada }, status)
  }

  return (
    <div>
      <Group justify="space-between" mb="sm">
        <Text fw={500} size="sm">Itens do Pedido</Text>
        <Button
          size="xs"
          variant="light"
          leftSection={<IconPlus size={14} />}
          onClick={handleAddItem}
          disabled={disabled}
        >
          Adicionar Item
        </Button>
      </Group>

      {errors.itens?.message && (
        <Text size="xs" c="red" mb="xs">{errors.itens.message}</Text>
      )}

      <div style={{ overflowX: 'auto' }}>
        <Table striped withTableBorder>
          <Table.Thead>
            <Table.Tr>
              <Table.Th style={{ width: 30 }}></Table.Th>
              <Table.Th style={{ minWidth: 200 }}>Produto</Table.Th>
              <Table.Th style={{ width: 80 }}>Unid.</Table.Th>
              <Table.Th style={{ width: 90 }}>Qtd</Table.Th>
              <Table.Th style={{ width: 110 }}>Preço Unit.</Table.Th>
              <Table.Th style={{ width: 80 }}>Desc %</Table.Th>
              <Table.Th style={{ width: 100 }}>Desc Valor</Table.Th>
              <Table.Th style={{ width: 90 }}>Frete</Table.Th>
              <Table.Th style={{ width: 90 }}>Seguro</Table.Th>
              <Table.Th style={{ width: 100 }}>Outras Desp.</Table.Th>
              <Table.Th style={{ width: 100 }}>Total</Table.Th>
              <Table.Th style={{ width: 40 }}></Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {fields.map((field, idx) => {
              const itemValues = watch(`itens.${idx}`)
              const itemDisabled = disabled || !getItemEditable(idx)
              const totalItem = calcularTotalItem({
                precoUnitario: itemValues?.precoUnitario || 0,
                desconto: itemValues?.desconto || 0,
                descontoValor: itemValues?.descontoValor || 0,
                quantidade: itemValues?.quantidade || 0,
                frete: itemValues?.frete || 0,
                seguro: itemValues?.seguro || 0,
                outrasDespesas: itemValues?.outrasDespesas || 0,
              })
              const isExpanded = expandedRows[idx] || false
              const itemErrors = errors.itens?.[idx]

              return (
                <>
                  <Table.Tr key={field.id}>
                    <Table.Td>
                      <ActionIcon
                        variant="subtle"
                        size="xs"
                        onClick={() => toggleExpand(idx)}
                        aria-label="Expandir detalhes"
                      >
                        {isExpanded ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
                      </ActionIcon>
                    </Table.Td>
                    <Table.Td>
                      <Controller
                        name={`itens.${idx}.produtoId`}
                        control={control}
                        render={({ field: f }) => (
                          <Select
                            data={produtoOptions}
                            searchable
                            size="xs"
                            error={itemErrors?.produtoId?.message}
                            value={f.value}
                            onChange={(v) => {
                              f.onChange(v || '')
                              const prod = (produtosData?.data || []).find((p: any) => p.id === v)
                              if (prod) {
                                const itens = watch('itens')
                                const currentItem = itens[idx]
                                if (currentItem) {
                                  control._formValues.itens[idx].unidade = prod.unidade || 'UN'
                                }
                              }
                            }}
                            disabled={itemDisabled}
                            placeholder="Selecione..."
                          />
                        )}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Controller
                        name={`itens.${idx}.unidade`}
                        control={control}
                        render={({ field: f }) => (
                          <Select
                            data={['UN', 'KG', 'CX', 'PC', 'MT', 'LT', 'FD', 'SC'].map((u) => ({ value: u, label: u }))}
                            size="xs"
                            value={f.value || 'UN'}
                            onChange={(v) => f.onChange(v || 'UN')}
                            disabled={itemDisabled}
                          />
                        )}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Controller
                        name={`itens.${idx}.quantidade`}
                        control={control}
                        render={({ field: f }) => (
                          <NumberInput
                            min={0.0001}
                            decimalScale={4}
                            size="xs"
                            error={itemErrors?.quantidade?.message}
                            value={f.value}
                            onChange={(v) => f.onChange(typeof v === 'number' ? v : 0)}
                            disabled={itemDisabled}
                          />
                        )}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Controller
                        name={`itens.${idx}.precoUnitario`}
                        control={control}
                        render={({ field: f }) => (
                          <NumberInput
                            min={0}
                            decimalScale={4}
                            prefix="R$ "
                            size="xs"
                            value={f.value || 0}
                            onChange={(v) => f.onChange(typeof v === 'number' ? v : 0)}
                            disabled={itemDisabled}
                          />
                        )}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Controller
                        name={`itens.${idx}.desconto`}
                        control={control}
                        render={({ field: f }) => (
                          <NumberInput
                            min={0}
                            max={100}
                            decimalScale={2}
                            suffix="%"
                            size="xs"
                            value={f.value || 0}
                            onChange={(v) => f.onChange(typeof v === 'number' ? v : 0)}
                            disabled={itemDisabled}
                          />
                        )}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Controller
                        name={`itens.${idx}.descontoValor`}
                        control={control}
                        render={({ field: f }) => (
                          <NumberInput
                            min={0}
                            decimalScale={2}
                            prefix="R$ "
                            size="xs"
                            value={f.value || 0}
                            onChange={(v) => f.onChange(typeof v === 'number' ? v : 0)}
                            error={(itemErrors as any)?.descontoValor?.message}
                            disabled={itemDisabled}
                          />
                        )}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Controller
                        name={`itens.${idx}.frete`}
                        control={control}
                        render={({ field: f }) => (
                          <NumberInput
                            min={0}
                            decimalScale={2}
                            prefix="R$ "
                            size="xs"
                            value={f.value || 0}
                            onChange={(v) => f.onChange(typeof v === 'number' ? v : 0)}
                            disabled={itemDisabled}
                          />
                        )}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Controller
                        name={`itens.${idx}.seguro`}
                        control={control}
                        render={({ field: f }) => (
                          <NumberInput
                            min={0}
                            decimalScale={2}
                            prefix="R$ "
                            size="xs"
                            value={f.value || 0}
                            onChange={(v) => f.onChange(typeof v === 'number' ? v : 0)}
                            disabled={itemDisabled}
                          />
                        )}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Controller
                        name={`itens.${idx}.outrasDespesas`}
                        control={control}
                        render={({ field: f }) => (
                          <NumberInput
                            min={0}
                            decimalScale={2}
                            prefix="R$ "
                            size="xs"
                            value={f.value || 0}
                            onChange={(v) => f.onChange(typeof v === 'number' ? v : 0)}
                            disabled={itemDisabled}
                          />
                        )}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" fw={600} ta="right">
                        R$ {totalItem.toFixed(2)}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      {fields.length > 1 && !itemDisabled && (
                        <Tooltip label="Remover item">
                          <ActionIcon
                            variant="subtle"
                            color="red"
                            size="sm"
                            onClick={() => remove(idx)}
                          >
                            <IconTrash size={14} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Table.Td>
                  </Table.Tr>

                  {/* Expand detail row */}
                  {isExpanded && (
                    <Table.Tr key={`${field.id}-detail`}>
                      <Table.Td colSpan={12} style={{ padding: '8px 16px', background: 'var(--mantine-color-gray-0)' }}>
                        <Collapse in={isExpanded}>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 py-2">
                            <Controller
                              name={`itens.${idx}.observacaoItem`}
                              control={control}
                              render={({ field: f }) => (
                                <Textarea
                                  label="Observação do Item"
                                  placeholder="Observação específica para este item"
                                  maxLength={1000}
                                  minRows={2}
                                  value={f.value || ''}
                                  onChange={f.onChange}
                                  disabled={itemDisabled}
                                />
                              )}
                            />
                            <Controller
                              name={`itens.${idx}.dataEntregaItem`}
                              control={control}
                              render={({ field: f }) => (
                                <DateInput
                                  label="Data Entrega Item"
                                  placeholder="DD/MM/AAAA"
                                  valueFormat="DD/MM/YYYY"
                                  clearable
                                  value={f.value ? new Date(f.value) : null}
                                  onChange={(date) => f.onChange(date ? date.toISOString() : '')}
                                  disabled={itemDisabled}
                                />
                              )}
                            />
                            <Controller
                              name={`itens.${idx}.comissaoPercItem`}
                              control={control}
                              render={({ field: f }) => (
                                <NumberInput
                                  label="Comissão %"
                                  min={0}
                                  max={100}
                                  decimalScale={2}
                                  suffix="%"
                                  size="sm"
                                  value={f.value ?? ''}
                                  onChange={(v) => f.onChange(typeof v === 'number' ? v : undefined)}
                                  disabled={itemDisabled}
                                />
                              )}
                            />
                          </div>
                        </Collapse>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </>
              )
            })}
          </Table.Tbody>
        </Table>
      </div>
    </div>
  )
}
