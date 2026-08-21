'use client'

import { Stack, Text, Group, Button, Paper, NumberInput, Select, ActionIcon, Slider, TextInput, Badge } from '@mantine/core'
import { IconPlus, IconTrash, IconPalette } from '@tabler/icons-react'
import type { WizardFormData, CorItem } from './page'

interface Props {
  formData: WizardFormData
  updateForm: (partial: Partial<WizardFormData>) => void
}

const COR_VAZIA: CorItem = {
  nome: '',
  tipo: 'PANTONE',
  coberturaPercent: 20,
  precoKg: 80,
  rendimentoM2Kg: 12000,
}

export default function StepCores({ formData, updateForm }: Props) {
  const { cores } = formData

  const updateCor = (index: number, field: keyof CorItem, value: any) => {
    const novasCores = [...cores]
    novasCores[index] = { ...novasCores[index], [field]: value }
    updateForm({ cores: novasCores })
  }

  const adicionarCor = () => {
    updateForm({ cores: [...cores, { ...COR_VAZIA }] })
  }

  const removerCor = (index: number) => {
    updateForm({ cores: cores.filter((_, i) => i !== index) })
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <div>
          <Text fw={600} size="lg">Cores de Impressão</Text>
          <Text size="sm" c="dimmed">
            Configure as cores (CMYK padrão + Pantone adicionais) com a cobertura estimada.
          </Text>
        </div>
        <Button
          variant="light"
          size="sm"
          leftSection={<IconPlus size={14} />}
          onClick={adicionarCor}
        >
          Adicionar Pantone
        </Button>
      </Group>

      <Stack gap="sm">
        {cores.map((cor, index) => (
          <Paper key={index} p="sm" withBorder>
            <Stack gap="xs">
              <Group justify="space-between" align="center">
                <Group gap="xs">
                  <IconPalette size={16} />
                  <Badge
                    variant="light"
                    color={cor.tipo === 'CMYK' ? 'blue' : 'grape'}
                    size="sm"
                  >
                    {cor.tipo}
                  </Badge>
                  <Text fw={500} size="sm">{cor.nome || 'Sem nome'}</Text>
                </Group>
                <ActionIcon
                  variant="subtle"
                  color="red"
                  size="sm"
                  onClick={() => removerCor(index)}
                >
                  <IconTrash size={14} />
                </ActionIcon>
              </Group>

              <Group grow gap="sm">
                <TextInput
                  label="Nome da cor"
                  placeholder="Ex: Ciano, Pantone 186C"
                  value={cor.nome}
                  onChange={(e) => updateCor(index, 'nome', e.currentTarget.value)}
                  size="xs"
                />
                <Select
                  label="Tipo"
                  data={[
                    { value: 'CMYK', label: 'CMYK' },
                    { value: 'PANTONE', label: 'Pantone' },
                  ]}
                  value={cor.tipo}
                  onChange={(val) => updateCor(index, 'tipo', val || 'CMYK')}
                  size="xs"
                />
              </Group>

              <div>
                <Text size="xs" fw={500} mb={4}>Cobertura: {cor.coberturaPercent}%</Text>
                <Slider
                  value={cor.coberturaPercent}
                  onChange={(val) => updateCor(index, 'coberturaPercent', val)}
                  min={0}
                  max={100}
                  step={5}
                  marks={[
                    { value: 0, label: '0%' },
                    { value: 25, label: '25%' },
                    { value: 50, label: '50%' },
                    { value: 75, label: '75%' },
                    { value: 100, label: '100%' },
                  ]}
                  size="sm"
                />
              </div>

              <Group grow gap="sm">
                <NumberInput
                  label="Preço/kg"
                  value={cor.precoKg}
                  onChange={(val) => updateCor(index, 'precoKg', typeof val === 'number' ? val : 0)}
                  prefix="R$ "
                  decimalScale={2}
                  min={0}
                  size="xs"
                />
                <NumberInput
                  label="Rendimento (m²/kg)"
                  value={cor.rendimentoM2Kg}
                  onChange={(val) => updateCor(index, 'rendimentoM2Kg', typeof val === 'number' ? val : 0)}
                  min={0}
                  size="xs"
                />
              </Group>
            </Stack>
          </Paper>
        ))}
      </Stack>

      {cores.length === 0 && (
        <Text c="dimmed" ta="center" py="md">
          Nenhuma cor configurada. Adicione ao menos uma cor para o orçamento.
        </Text>
      )}
    </Stack>
  )
}
