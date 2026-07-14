'use client'

import { Checkbox, Stack, Text, NumberInput, Divider } from '@mantine/core'
import { IconInfoCircle } from '@tabler/icons-react'
import { Control, Controller, useWatch } from 'react-hook-form'

interface Props {
  control: Control<any>
}

export function BloqueioConferenciaSection({ control }: Props) {
  const aceitarSenha = useWatch({ control, name: 'aceitarSenha' })
  const aceitarCcePendente = useWatch({ control, name: 'aceitarCcePendente' })

  const ambosDesativados = !aceitarSenha && !aceitarCcePendente

  return (
    <Stack gap="sm">
      <Text size="sm" fw={600}>Bloqueio de Conferência</Text>
      <Text size="xs" c="dimmed">
        Defina como o sistema deve tratar divergências de lote e validade na conferência de entrada.
      </Text>

      <Controller
        name="aceitarSenha"
        control={control}
        render={({ field }) => (
          <Checkbox
            label="Aceitar com senha supervisor"
            description="Permite liberar divergência com autorização do supervisor"
            checked={field.value ?? false}
            onChange={(e) => field.onChange(e.currentTarget.checked)}
          />
        )}
      />

      <Controller
        name="aceitarCcePendente"
        control={control}
        render={({ field }) => (
          <Checkbox
            label="Aceitar com CCE Automática ou Pendente"
            description="Permite aceitar divergência gerando CC-e automática ou pendência"
            checked={field.value ?? false}
            onChange={(e) => field.onChange(e.currentTarget.checked)}
          />
        )}
      />

      {ambosDesativados && (
        <Text size="xs" c="orange" className="flex items-center gap-1">
          <IconInfoCircle size={14} />
          Bloqueio total — reconferência obrigatória quando houver divergência.
        </Text>
      )}

      <Divider my={4} />

      <Text size="sm" fw={600}>Tolerância de Quantidade na Conferência</Text>
      <Text size="xs" c="dimmed">
        Percentual de desvio de quantidade aceito automaticamente na conferência de
        entrada, sem gerar divergência nem exigir segunda conferência. Deixe vazio
        para usar o padrão da empresa (Configurador → Conferência).
      </Text>

      <Controller
        name="toleranciaQuantidadePercentual"
        control={control}
        render={({ field }) => (
          <NumberInput
            label="Tolerância (%)"
            placeholder="Usar padrão da empresa"
            min={0}
            max={100}
            decimalScale={2}
            suffix="%"
            value={field.value ?? ''}
            onChange={(v) => field.onChange(v === '' ? null : Number(v))}
            w={220}
          />
        )}
      />
    </Stack>
  )
}
