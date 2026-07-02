'use client'

import { Grid, NumberInput, Select } from '@mantine/core'
import { Controller, useFormContext } from 'react-hook-form'
import type { PedidoVendaFormValues } from '@/lib/schemas/pedidoVendaSchema'

interface SecaoFinanceiroProps {
  disabled?: boolean
}

const TIPO_DESCONTO_OPTIONS = [
  { value: 'PERCENTUAL', label: 'Percentual (%)' },
  { value: 'VALOR_FIXO', label: 'Valor Fixo (R$)' },
]

const TIPO_ACRESCIMO_OPTIONS = [
  { value: 'FRETE', label: 'Frete' },
  { value: 'SEGURO', label: 'Seguro' },
  { value: 'OUTRAS_DESPESAS', label: 'Outras Despesas' },
]

export function SecaoFinanceiro({ disabled }: SecaoFinanceiroProps) {
  const { control, watch, formState: { errors } } = useFormContext<PedidoVendaFormValues>()

  const tipoDesconto = watch('tipoDesconto')
  const tipoAcrescimo = watch('tipoAcrescimo')

  return (
    <Grid>
      {/* Desconto */}
      <Grid.Col span={6}>
        <Controller
          name="tipoDesconto"
          control={control}
          render={({ field }) => (
            <Select
              label="Tipo de Desconto"
              placeholder="Selecione o tipo"
              data={TIPO_DESCONTO_OPTIONS}
              value={field.value ?? null}
              onChange={(val) => field.onChange(val ?? undefined)}
              error={errors.tipoDesconto?.message}
              disabled={disabled}
              clearable
            />
          )}
        />
      </Grid.Col>

      <Grid.Col span={6}>
        <Controller
          name="descontoGeral"
          control={control}
          render={({ field }) => (
            <NumberInput
              label="Desconto Geral"
              placeholder={tipoDesconto === 'PERCENTUAL' ? '0,00 %' : 'R$ 0,00'}
              value={field.value ?? ''}
              onChange={(val) => field.onChange(val === '' ? undefined : val)}
              error={errors.descontoGeral?.message}
              disabled={disabled || !tipoDesconto}
              decimalScale={2}
              fixedDecimalScale
              thousandSeparator="."
              decimalSeparator=","
              min={0}
              suffix={tipoDesconto === 'PERCENTUAL' ? ' %' : undefined}
              prefix={tipoDesconto === 'VALOR_FIXO' ? 'R$ ' : undefined}
            />
          )}
        />
      </Grid.Col>

      {/* Acréscimo */}
      <Grid.Col span={6}>
        <Controller
          name="tipoAcrescimo"
          control={control}
          render={({ field }) => (
            <Select
              label="Tipo de Acréscimo"
              placeholder="Selecione o tipo"
              data={TIPO_ACRESCIMO_OPTIONS}
              value={field.value ?? null}
              onChange={(val) => field.onChange(val ?? undefined)}
              error={errors.tipoAcrescimo?.message}
              disabled={disabled}
              clearable
            />
          )}
        />
      </Grid.Col>

      <Grid.Col span={6}>
        <Controller
          name="acrescimoGeral"
          control={control}
          render={({ field }) => (
            <NumberInput
              label="Acréscimo Geral"
              placeholder="R$ 0,00"
              value={field.value ?? ''}
              onChange={(val) => field.onChange(val === '' ? undefined : val)}
              error={errors.acrescimoGeral?.message}
              disabled={disabled || !tipoAcrescimo}
              decimalScale={2}
              fixedDecimalScale
              thousandSeparator="."
              decimalSeparator=","
              min={0}
              prefix="R$ "
            />
          )}
        />
      </Grid.Col>
    </Grid>
  )
}
