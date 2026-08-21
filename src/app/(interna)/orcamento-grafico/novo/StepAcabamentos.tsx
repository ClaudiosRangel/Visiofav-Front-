'use client'

import { Stack, Text, Checkbox, Paper, NumberInput, SimpleGrid, Group, Collapse, Badge } from '@mantine/core'
import { IconSettings } from '@tabler/icons-react'
import type { WizardFormData, AcabamentoItem } from './page'

interface Props {
  formData: WizardFormData
  updateForm: (partial: Partial<WizardFormData>) => void
}

export default function StepAcabamentos({ formData, updateForm }: Props) {
  const { acabamentos } = formData

  const toggleAcabamento = (index: number) => {
    const novos = [...acabamentos]
    novos[index] = { ...novos[index], ativo: !novos[index].ativo }
    updateForm({ acabamentos: novos })
  }

  const updateParam = (index: number, field: keyof AcabamentoItem, value: any) => {
    const novos = [...acabamentos]
    novos[index] = { ...novos[index], [field]: value }
    updateForm({ acabamentos: novos })
  }

  return (
    <Stack gap="md">
      <Text fw={600} size="lg">Acabamentos</Text>
      <Text size="sm" c="dimmed">
        Selecione os acabamentos desejados e ajuste os parâmetros de custo se necessário.
      </Text>

      <Stack gap="sm">
        {acabamentos.map((acab, index) => (
          <Paper key={acab.tipo} p="md" withBorder>
            <Stack gap="sm">
              <Group justify="space-between">
                <Checkbox
                  label={
                    <Group gap="xs">
                      <Text fw={500}>{acab.label}</Text>
                      {acab.ativo && (
                        <Badge size="xs" color="green" variant="light">Ativo</Badge>
                      )}
                    </Group>
                  }
                  checked={acab.ativo}
                  onChange={() => toggleAcabamento(index)}
                />
                {acab.ativo && <IconSettings size={16} color="gray" />}
              </Group>

              <Collapse in={acab.ativo}>
                <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="sm" mt="xs">
                  <NumberInput
                    label="Custo/hora"
                    description="R$/hora da máquina"
                    value={acab.custoHora}
                    onChange={(val) => updateParam(index, 'custoHora', typeof val === 'number' ? val : 0)}
                    prefix="R$ "
                    decimalScale={2}
                    min={0}
                    size="xs"
                  />
                  <NumberInput
                    label="Velocidade"
                    description="Folhas/hora ou un/hora"
                    value={acab.velocidade}
                    onChange={(val) => updateParam(index, 'velocidade', typeof val === 'number' ? val : 0)}
                    min={0}
                    size="xs"
                  />
                  {(acab.tipo === 'VERNIZ_UV' || acab.tipo === 'LAMINACAO_BOPP' || acab.tipo === 'HOT_STAMPING') && (
                    <NumberInput
                      label="Custo material/m²"
                      description="R$/m² do insumo"
                      value={acab.custoMaterialM2}
                      onChange={(val) => updateParam(index, 'custoMaterialM2', typeof val === 'number' ? val : 0)}
                      prefix="R$ "
                      decimalScale={4}
                      min={0}
                      size="xs"
                    />
                  )}
                </SimpleGrid>
              </Collapse>
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Stack>
  )
}
