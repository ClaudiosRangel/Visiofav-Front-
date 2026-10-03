'use client'

import { useEffect, useState } from 'react'
import { Stack, Text, Select, NumberInput, Group, Badge, Loader, Paper, SimpleGrid } from '@mantine/core'
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
  const [termoBusca, setTermoBusca] = useState('')
  const [debounced] = useDebouncedValue(termoBusca, 300)

  // Busca 100% server-side. O cadastro tem ~1700 papéis; filtrar no cliente
  // escondia a maioria (ex.: "Klabin Advanced Triplex 280"). Usamos Select com
  // `filter` que NÃO refiltra (retorna todas as options) — assim o dropdown
  // mostra exatamente o que o backend devolveu para o termo digitado.
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

  // Se já há um papel selecionado (voltar ao passo), garante que ele apareça
  // na lista de options mesmo sem busca.
  useEffect(() => {
    if (formData.papelId && formData.papelDescricao &&
        !materiais.some(m => m.id === formData.papelId)) {
      setMateriais(prev => [
        { id: formData.papelId!, descricao: formData.papelDescricao, precoUnitario: formData.precoKg || 0, unidade: 'KG' },
        ...prev,
      ])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.papelId])

  const handleSelect = (papelId: string | null) => {
    const found = materiais.find(m => m.id === papelId)
    if (found) {
      updateForm({
        papelId: found.id,
        papelDescricao: found.descricao,
        precoKg: found.precoUnitario,
      })
    } else {
      updateForm({ papelId: null })
    }
  }

  const options = materiais.map(m => ({ value: m.id, label: m.descricao }))

  return (
    <Stack gap="md">
      <Text fw={600} size="lg">Papel / Cartão</Text>
      <Text size="sm" c="dimmed">
        Digite parte do nome do papel/cartão (ex.: &quot;Triplex 280&quot;, &quot;Kraft&quot;, &quot;Accurate&quot;).
        A busca percorre o cadastro completo conforme você digita.
      </Text>

      <Select
        label="Tipo de Papel/Cartão"
        placeholder="Digite para buscar (ex.: Triplex 280)"
        leftSection={loading ? <Loader size={14} /> : <IconLeaf size={16} />}
        data={options}
        value={formData.papelId}
        onChange={handleSelect}
        searchable
        searchValue={termoBusca}
        onSearchChange={setTermoBusca}
        // Desliga o filtro client-side do Mantine: o backend já filtrou.
        filter={({ options }) => options}
        nothingFoundMessage={
          loading ? 'Buscando...' :
          termoBusca.trim().length < 2 ? 'Digite ao menos 2 letras' :
          'Nenhum papel encontrado'
        }
        comboboxProps={{ withinPortal: true }}
        clearable
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
