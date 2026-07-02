'use client'

import { Controller, useFormContext } from 'react-hook-form'
import { Grid, Select, TextInput, Title, Text } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { useTransportadoras } from '@/data/hooks/vendas/useTransportadoras'
import { MODALIDADE_FRETE_OPTIONS } from './utils'
import type { PedidoVendaFormValues } from '@/lib/schemas/pedidoVendaSchema'

const UFS_VALIDAS = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS',
  'MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO',
]

const UF_OPTIONS = UFS_VALIDAS.map((uf) => ({ value: uf, label: uf }))

interface SecaoEntregaTransporteProps {
  disabled?: boolean
}

export function SecaoEntregaTransporte({ disabled }: SecaoEntregaTransporteProps) {
  const { control, formState: { errors } } = useFormContext<PedidoVendaFormValues>()
  const { data: transportadorasData } = useTransportadoras()

  const transportadoraOptions = (transportadorasData?.data ?? []).map((t) => ({
    value: t.id,
    label: t.razaoSocial,
  }))

  return (
    <>
      <Grid>
        <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
          <Controller
            name="dataEntrega"
            control={control}
            render={({ field }) => (
              <DateInput
                label="Data de Entrega"
                placeholder="Selecione a data"
                disabled={disabled}
                value={field.value ? new Date(field.value) : null}
                onChange={(date) => field.onChange(date ? date.toISOString().split('T')[0] : undefined)}
                error={errors.dataEntrega?.message}
                clearable
              />
            )}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
          <Controller
            name="transportadoraId"
            control={control}
            render={({ field }) => (
              <Select
                label="Transportadora"
                placeholder="Selecione a transportadora"
                data={transportadoraOptions}
                searchable
                clearable
                disabled={disabled}
                value={field.value ?? null}
                onChange={(value) => field.onChange(value ?? undefined)}
                error={errors.transportadoraId?.message}
              />
            )}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
          <Controller
            name="modalidadeFrete"
            control={control}
            render={({ field }) => (
              <Select
                label="Modalidade de Frete"
                placeholder="Selecione a modalidade"
                data={MODALIDADE_FRETE_OPTIONS}
                clearable
                disabled={disabled}
                value={field.value != null ? String(field.value) : null}
                onChange={(value) => field.onChange(value != null ? Number(value) : undefined)}
                error={errors.modalidadeFrete?.message}
              />
            )}
          />
        </Grid.Col>
      </Grid>

      {/* Sub-seção: Endereço de Entrega Alternativo */}
      <Title order={5} mt="lg" mb="sm">
        Endereço de Entrega Alternativo
      </Title>
      <Text size="xs" c="dimmed" mb="sm">
        Preencha apenas se o endereço de entrega for diferente do cadastro do cliente.
      </Text>

      <Grid>
        <Grid.Col span={{ base: 12, sm: 8 }}>
          <Controller
            name="enderecoEntrega.logradouro"
            control={control}
            render={({ field }) => (
              <TextInput
                label="Logradouro"
                placeholder="Rua, Av, etc."
                maxLength={200}
                disabled={disabled}
                value={field.value ?? ''}
                onChange={field.onChange}
                error={errors.enderecoEntrega?.logradouro?.message}
              />
            )}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 4 }}>
          <Controller
            name="enderecoEntrega.numero"
            control={control}
            render={({ field }) => (
              <TextInput
                label="Número"
                placeholder="Nº"
                maxLength={20}
                disabled={disabled}
                value={field.value ?? ''}
                onChange={field.onChange}
                error={errors.enderecoEntrega?.numero?.message}
              />
            )}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 4 }}>
          <Controller
            name="enderecoEntrega.complemento"
            control={control}
            render={({ field }) => (
              <TextInput
                label="Complemento"
                placeholder="Apto, Bloco, etc."
                maxLength={100}
                disabled={disabled}
                value={field.value ?? ''}
                onChange={field.onChange}
                error={errors.enderecoEntrega?.complemento?.message}
              />
            )}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 4 }}>
          <Controller
            name="enderecoEntrega.bairro"
            control={control}
            render={({ field }) => (
              <TextInput
                label="Bairro"
                placeholder="Bairro"
                maxLength={100}
                disabled={disabled}
                value={field.value ?? ''}
                onChange={field.onChange}
                error={errors.enderecoEntrega?.bairro?.message}
              />
            )}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 4 }}>
          <Controller
            name="enderecoEntrega.cidade"
            control={control}
            render={({ field }) => (
              <TextInput
                label="Cidade"
                placeholder="Cidade"
                maxLength={100}
                disabled={disabled}
                value={field.value ?? ''}
                onChange={field.onChange}
                error={errors.enderecoEntrega?.cidade?.message}
              />
            )}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 3 }}>
          <Controller
            name="enderecoEntrega.uf"
            control={control}
            render={({ field }) => (
              <Select
                label="UF"
                placeholder="UF"
                data={UF_OPTIONS}
                searchable
                clearable
                disabled={disabled}
                value={field.value ?? null}
                onChange={(value) => field.onChange(value ?? undefined)}
                error={errors.enderecoEntrega?.uf?.message}
              />
            )}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 3 }}>
          <Controller
            name="enderecoEntrega.cep"
            control={control}
            render={({ field }) => (
              <TextInput
                label="CEP"
                placeholder="00000000"
                maxLength={8}
                disabled={disabled}
                value={field.value ?? ''}
                onChange={field.onChange}
                error={errors.enderecoEntrega?.cep?.message}
              />
            )}
          />
        </Grid.Col>
      </Grid>
    </>
  )
}
