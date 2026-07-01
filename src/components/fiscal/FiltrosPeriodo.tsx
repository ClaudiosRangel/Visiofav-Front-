'use client'

import { Group } from '@mantine/core'
import { DateInput } from '@mantine/dates'

interface FiltrosPeriodoProps {
  dataInicio: Date | null
  dataFim: Date | null
  onChange: (value: { dataInicio: Date | null; dataFim: Date | null }) => void
}

export function FiltrosPeriodo({ dataInicio, dataFim, onChange }: FiltrosPeriodoProps) {
  return (
    <Group gap="md">
      <DateInput
        label="Data Início"
        placeholder="De"
        value={dataInicio}
        onChange={(value) => onChange({ dataInicio: value, dataFim })}
        valueFormat="DD/MM/YYYY"
        clearable
        className="w-36"
      />
      <DateInput
        label="Data Fim"
        placeholder="Até"
        value={dataFim}
        onChange={(value) => onChange({ dataInicio, dataFim: value })}
        valueFormat="DD/MM/YYYY"
        clearable
        className="w-36"
      />
    </Group>
  )
}
