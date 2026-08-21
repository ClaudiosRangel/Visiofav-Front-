'use client'

import { Stack, Text, NumberInput, SimpleGrid, Alert, Badge, Group } from '@mantine/core'
import { IconRuler, IconAlertCircle } from '@tabler/icons-react'
import type { WizardFormData } from './page'

interface Props {
  formData: WizardFormData
  updateForm: (partial: Partial<WizardFormData>) => void
}

interface Parametro {
  nome: string
  label: string
  unidade: string
  obrigatorio: boolean
  default?: number
}

export default function StepMedidas({ formData, updateForm }: Props) {
  const tipo = formData.tipoEmbalagem
  const parametros: Parametro[] = tipo?.parametros || []

  if (!tipo) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} color="yellow">
        Selecione um tipo de embalagem no passo anterior.
      </Alert>
    )
  }

  const handleChange = (nome: string, value: number | string) => {
    const numVal = typeof value === 'string' ? parseFloat(value) || 0 : value
    updateForm({
      medidas: { ...formData.medidas, [nome]: numVal },
    })
  }

  return (
    <Stack gap="md">
      <Text fw={600} size="lg">Medidas da Embalagem</Text>
      <Text size="sm" c="dimmed">
        Informe as medidas conforme o tipo selecionado: <strong>{tipo.descricao}</strong>
      </Text>

      {parametros.length === 0 && (
        <Alert icon={<IconAlertCircle size={16} />} color="blue">
          Este tipo de embalagem não possui parâmetros de medida configurados.
        </Alert>
      )}

      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
        {parametros.map((param) => (
          <NumberInput
            key={param.nome}
            label={
              <Group gap={4}>
                <Text size="sm">{param.label}</Text>
                {param.obrigatorio && <Badge size="xs" color="red" variant="light">obrigatório</Badge>}
              </Group>
            }
            description={`Unidade: ${param.unidade}`}
            placeholder={param.default ? `Padrão: ${param.default}` : `Informe ${param.label.toLowerCase()}`}
            leftSection={<IconRuler size={14} />}
            value={formData.medidas[param.nome] || param.default || ''}
            onChange={(val) => handleChange(param.nome, val)}
            min={0}
            decimalScale={2}
            suffix={` ${param.unidade}`}
          />
        ))}
      </SimpleGrid>
    </Stack>
  )
}
