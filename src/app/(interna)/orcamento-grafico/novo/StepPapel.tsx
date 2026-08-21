'use client'

import { useEffect, useState } from 'react'
import { Stack, Text, Autocomplete, NumberInput, Group, Badge, Loader, Paper, SimpleGrid } from '@mantine/core'
import { IconLeaf, IconScale } from '@tabler/icons-react'
import { api } from '@/lib/api'
import type { WizardFormData } from './page'

interface Props {
  formData: WizardFormData
  updateForm: (partial: Partial<WizardFormData>) => void
}

interface MaterialPapel {
  id: string
  descricao: string
  precoUnitario: number
  unidade: string
}

export default function StepPapel({ formData, updateForm }: Props) {
  const [materiais, setMateriais] = useState<MaterialPapel[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/orcamento-grafico/precos-mp', { params: { tipo: 'PAPEL' } })
      .then(({ data }) => {
        const items = (Array.isArray(data) ? data : data.data || []).map((m: any) => ({
          id: m.id,
          descricao: m.descricao,
          precoUnitario: Number(m.precoUnitario),
          unidade: m.unidade,
        }))
        setMateriais(items)
      })
      .catch(() => setMateriais([]))
      .finally(() => setLoading(false))
  }, [])

  const handlePapelSelect = (descricao: string) => {
    const found = materiais.find(m => m.descricao === descricao)
    if (found) {
      updateForm({
        papelId: found.id,
        papelDescricao: found.descricao,
        precoKg: found.precoUnitario,
      })
    } else {
      updateForm({ papelId: null, papelDescricao: descricao })
    }
  }

  return (
    <Stack gap="md">
      <Text fw={600} size="lg">Papel / Cartão</Text>
      <Text size="sm" c="dimmed">
        Selecione o tipo de papel e informe a gramatura.
      </Text>

      <Autocomplete
        label="Tipo de Papel/Cartão"
        placeholder={loading ? 'Carregando...' : 'Busque pelo nome do papel'}
        leftSection={loading ? <Loader size={14} /> : <IconLeaf size={16} />}
        data={materiais.map(m => m.descricao)}
        value={formData.papelDescricao}
        onChange={(val) => {
          updateForm({ papelDescricao: val, papelId: null })
        }}
        onOptionSubmit={handlePapelSelect}
        limit={20}
      />

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        <NumberInput
          label="Gramatura"
          description="Peso do papel em g/m²"
          placeholder="Ex: 300"
          leftSection={<IconScale size={14} />}
          value={formData.gramatura || ''}
          onChange={(val) => updateForm({ gramatura: typeof val === 'number' ? val : 0 })}
          min={0}
          max={2000}
          suffix=" g/m²"
        />

        <NumberInput
          label="Preço/kg"
          description="Custo por quilograma"
          placeholder="Ex: 4.50"
          prefix="R$ "
          value={formData.precoKg || ''}
          onChange={(val) => updateForm({ precoKg: typeof val === 'number' ? val : 0 })}
          min={0}
          decimalScale={4}
        />
      </SimpleGrid>

      {formData.papelId && formData.precoKg > 0 && (
        <Paper p="sm" withBorder>
          <Group gap="md">
            <Badge color="green" variant="light" size="lg">
              {formData.papelDescricao}
            </Badge>
            <Text size="sm" c="dimmed">
              R$ {formData.precoKg.toFixed(4)}/{materiais.find(m => m.id === formData.papelId)?.unidade || 'KG'}
            </Text>
          </Group>
        </Paper>
      )}
    </Stack>
  )
}
