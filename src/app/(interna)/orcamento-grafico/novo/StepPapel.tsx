'use client'

import { useEffect, useState } from 'react'
import { Stack, Text, Autocomplete, NumberInput, Group, Badge, Loader, Paper, SimpleGrid } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
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
  const [loading, setLoading] = useState(false)
  const [busca, setBusca] = useState(formData.papelDescricao || '')
  const [debounced] = useDebouncedValue(busca, 300)

  // Busca server-side: o cadastro tem ~1700 papéis; carregar só os primeiros 50
  // escondia a maioria (ex.: "Klabin Advanced Triplex 280"). Agora o termo
  // digitado vai ao backend (param `busca`), que filtra por descricao.
  useEffect(() => {
    const termo = debounced.trim()
    setLoading(true)
    api.get('/orcamento-grafico/precos-mp', {
      params: { tipo: 'PAPEL', limit: 50, ...(termo.length >= 2 ? { busca: termo } : {}) },
    })
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
  }, [debounced])

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
        Digite parte do nome do papel/cartão (ex.: "Triplex 280", "Duplex", "Kraft").
        A busca é feita no cadastro completo conforme você digita.
      </Text>

      <Autocomplete
        label="Tipo de Papel/Cartão"
        placeholder="Busque pelo nome do papel"
        leftSection={loading ? <Loader size={14} /> : <IconLeaf size={16} />}
        data={materiais.map(m => m.descricao)}
        value={busca}
        onChange={(val) => {
          setBusca(val)
          updateForm({ papelDescricao: val, papelId: null })
        }}
        onOptionSubmit={handlePapelSelect}
        limit={50}
        comboboxProps={{ withinPortal: true }}
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
