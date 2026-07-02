'use client'

import { Textarea, Stack, Text } from '@mantine/core'
import { Controller, useFormContext } from 'react-hook-form'
import type { PedidoVendaFormValues } from '@/lib/schemas/pedidoVendaSchema'

interface SecaoObservacoesProps {
  disabled?: boolean
}

export function SecaoObservacoes({ disabled }: SecaoObservacoesProps) {
  const { control } = useFormContext<PedidoVendaFormValues>()

  return (
    <Stack>
      <Controller
        name="observacao"
        control={control}
        render={({ field, fieldState }) => (
          <div>
            <Textarea
              label="Observação Interna"
              placeholder="Observações internas do pedido"
              maxLength={1000}
              minRows={3}
              disabled={disabled}
              error={fieldState.error?.message}
              {...field}
              value={field.value ?? ''}
            />
            <Text size="xs" c="dimmed" ta="right" mt={4}>
              {(field.value ?? '').length}/1000
            </Text>
          </div>
        )}
      />

      <Controller
        name="observacaoNota"
        control={control}
        render={({ field, fieldState }) => (
          <div>
            <Textarea
              label="Observação para Nota Fiscal"
              placeholder="Observações que serão impressas na nota fiscal"
              maxLength={2000}
              minRows={3}
              disabled={disabled}
              error={fieldState.error?.message}
              {...field}
              value={field.value ?? ''}
            />
            <Text size="xs" c="dimmed" ta="right" mt={4}>
              {(field.value ?? '').length}/2000
            </Text>
          </div>
        )}
      />
    </Stack>
  )
}
