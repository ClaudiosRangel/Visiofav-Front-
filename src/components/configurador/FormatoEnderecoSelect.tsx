'use client'

import { Select } from '@mantine/core'
import { formatoEnderecoCrud } from '@/data/hooks/useFormatoEndereco'

interface FormatoEnderecoSelectProps {
  value: string | null
  onChange: (value: string | null) => void
  error?: string
  label?: string
}

export function FormatoEnderecoSelect({
  value,
  onChange,
  error,
  label = 'Formato de Endereço',
}: FormatoEnderecoSelectProps) {
  const { data: formatosResp } = formatoEnderecoCrud.useListar({ limit: 100 })
  const options = (formatosResp?.data || []).map((f: any) => ({
    value: f.id,
    label: f.nome,
  }))

  return (
    <Select
      label={label}
      data={options}
      value={value}
      onChange={onChange}
      error={error}
      searchable
      clearable
      placeholder="Selecione um formato (opcional)"
    />
  )
}
