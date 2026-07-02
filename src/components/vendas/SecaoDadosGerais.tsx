'use client'

import { Select, TextInput } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { Controller, useFormContext } from 'react-hook-form'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { PedidoVendaFormValues } from '@/lib/schemas/pedidoVendaSchema'

interface SecaoDadosGeraisProps {
  disabled?: boolean
}

export function SecaoDadosGerais({ disabled }: SecaoDadosGeraisProps) {
  const { control, watch, formState: { errors } } = useFormContext<PedidoVendaFormValues>()

  const { data: clientesData } = useQuery<any>({
    queryKey: ['clientes-select'],
    queryFn: async () => {
      const { data } = await api.get('/clientes', { params: { limit: 100, status: 'true' } })
      return data
    },
    staleTime: 1000 * 60 * 5,
  })

  const { data: vendedoresData } = useQuery<any>({
    queryKey: ['vendedores-select'],
    queryFn: async () => {
      const { data } = await api.get('/vendedores', { params: { limit: 100, status: 'true' } })
      return data
    },
    staleTime: 1000 * 60 * 5,
  })

  const { data: tabelasData } = useQuery<any>({
    queryKey: ['tabelas-preco-select'],
    queryFn: async () => {
      const { data } = await api.get('/tabelas-preco', { params: { limit: 50 } })
      return data
    },
    staleTime: 1000 * 60 * 5,
  })

  const tabelaPrecoId = watch('tabelaPrecoId')
  const origemPedido = watch('origemPedido')

  const tabelaSelecionada = (tabelasData?.data || []).find((t: any) => t.id === tabelaPrecoId)
  const condicaoOptions = (tabelaSelecionada?.condicoes || []).map((c: any) => ({
    value: c.id,
    label: `${c.formaPagamento} ${c.parcelas}x ${Number(c.percentual) > 0 ? '+' : ''}${Number(c.percentual).toFixed(1)}%`,
  }))

  const clienteOptions = (clientesData?.data || []).map((c: any) => ({ value: c.id, label: c.razaoSocial }))
  const vendedorOptions = (vendedoresData?.data || []).map((v: any) => ({ value: v.id, label: v.nome }))
  const tabelaOptions = (tabelasData?.data || []).filter((t: any) => t.status).map((t: any) => ({ value: t.id, label: t.nome }))

  const prioridadeOptions = [
    { value: 'BAIXA', label: 'Baixa' },
    { value: 'NORMAL', label: 'Normal' },
    { value: 'URGENTE', label: 'Urgente' },
  ]

  const origemOptions = [
    { value: 'MANUAL', label: 'Manual' },
    { value: 'ECOMMERCE', label: 'E-commerce' },
    { value: 'EDI', label: 'EDI' },
    { value: 'ORCAMENTO', label: 'Orçamento' },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Controller
        name="clienteId"
        control={control}
        render={({ field }) => (
          <Select
            label={<>Cliente <span style={{ color: 'red' }}>*</span></>}
            data={clienteOptions}
            searchable
            error={errors.clienteId?.message}
            value={field.value}
            onChange={(v) => field.onChange(v || '')}
            disabled={disabled}
          />
        )}
      />

      <Controller
        name="vendedorId"
        control={control}
        render={({ field }) => (
          <Select
            label="Vendedor"
            data={vendedorOptions}
            searchable
            clearable
            value={field.value || null}
            onChange={(v) => field.onChange(v || '')}
            disabled={disabled}
          />
        )}
      />

      <Controller
        name="tabelaPrecoId"
        control={control}
        render={({ field }) => (
          <Select
            label={<>Tabela de Preço <span style={{ color: 'red' }}>*</span></>}
            data={tabelaOptions}
            searchable
            error={errors.tabelaPrecoId?.message}
            value={field.value}
            onChange={(v) => field.onChange(v || '')}
            disabled={disabled}
          />
        )}
      />

      <Controller
        name="condicaoPagId"
        control={control}
        render={({ field }) => (
          <Select
            label="Condição de Pagamento"
            data={condicaoOptions}
            clearable
            disabled={disabled || !tabelaPrecoId}
            value={field.value || null}
            onChange={(v) => field.onChange(v || '')}
          />
        )}
      />

      <Controller
        name="prioridade"
        control={control}
        render={({ field }) => (
          <Select
            label="Prioridade"
            data={prioridadeOptions}
            error={errors.prioridade?.message}
            value={field.value}
            onChange={(v) => field.onChange(v || 'NORMAL')}
            disabled={disabled}
          />
        )}
      />

      <Controller
        name="origemPedido"
        control={control}
        render={({ field }) => (
          <Select
            label="Origem do Pedido"
            data={origemOptions}
            error={errors.origemPedido?.message}
            value={field.value}
            onChange={(v) => field.onChange(v || 'MANUAL')}
            disabled={disabled}
          />
        )}
      />

      <Controller
        name="numeroPedidoCliente"
        control={control}
        render={({ field }) => (
          <TextInput
            label="Nº Pedido Cliente"
            placeholder="Referência externa"
            maxLength={60}
            value={field.value || ''}
            onChange={field.onChange}
            disabled={disabled}
          />
        )}
      />

      <Controller
        name="dataValidade"
        control={control}
        render={({ field }) => (
          <DateInput
            label="Data de Validade"
            placeholder="DD/MM/AAAA"
            valueFormat="DD/MM/YYYY"
            clearable
            value={field.value ? new Date(field.value) : null}
            onChange={(date) => field.onChange(date ? date.toISOString() : '')}
            error={errors.dataValidade?.message}
            disabled={disabled}
          />
        )}
      />

      {origemPedido === 'ORCAMENTO' && (
        <Controller
          name="orcamentoOrigemId"
          control={control}
          render={({ field }) => (
            <TextInput
              label="Orçamento de Origem"
              placeholder="ID do orçamento"
              value={field.value || ''}
              onChange={field.onChange}
              disabled={disabled}
            />
          )}
        />
      )}
    </div>
  )
}
