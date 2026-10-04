'use client'

import { useEffect, useState } from 'react'
import { Stack, Text, Select, NumberInput, Group, Badge, Loader, Paper, SimpleGrid, Alert } from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconLeaf, IconScale, IconStack2, IconAlertTriangle } from '@tabler/icons-react'
import { api } from '@/lib/api'
import type { WizardFormData } from './page'

interface Props {
  formData: WizardFormData
  updateForm: (partial: Partial<WizardFormData>) => void
}

interface SuporteItem {
  id: string
  descricao: string
}

interface MaterialPapel {
  id: string
  descricao: string
  precoUnitario: number
  unidade: string
  gramatura?: number
}

export default function StepPapel({ formData, updateForm }: Props) {
  // ------------------------------------------------------------------
  // Nível 1 — Suporte (Papel/Cartão) — paridade Calcgraf. O suporte carrega o
  // CoefTinta (fator SPANKS) e serve de filtro para os preços do papel.
  // ------------------------------------------------------------------
  const [suportes, setSuportes] = useState<SuporteItem[]>([])
  const [loadingSuportes, setLoadingSuportes] = useState(false)
  const [termoSuporte, setTermoSuporte] = useState('')
  const [debouncedSuporte] = useDebouncedValue(termoSuporte, 300)

  // ------------------------------------------------------------------
  // Nível 2 — Preço do papel/gramatura vinculado ao suporte selecionado.
  // ------------------------------------------------------------------
  const [materiais, setMateriais] = useState<MaterialPapel[]>([])
  const [loading, setLoading] = useState(false)
  const [buscouPrecos, setBuscouPrecos] = useState(false)
  const [termoBusca, setTermoBusca] = useState('')
  const [debounced] = useDebouncedValue(termoBusca, 300)

  // Busca de suportes 100% server-side (mesmo padrão do papel: Select com
  // `filter` que não refiltra).
  useEffect(() => {
    const termo = debouncedSuporte.trim()
    setLoadingSuportes(true)
    api.get('/orcamento-grafico/suportes', {
      params: { limit: 50, ...(termo.length >= 2 ? { busca: termo } : {}) },
    })
      .then(({ data }) => {
        const items = (Array.isArray(data) ? data : data.data || []).map((s: any) => ({
          id: s.id,
          descricao: s.descricao,
        }))
        setSuportes(items)
      })
      .catch(() => setSuportes([]))
      .finally(() => setLoadingSuportes(false))
  }, [debouncedSuporte])

  // Preserva o suporte selecionado ao voltar o passo (injeta a option mesmo
  // sem busca).
  useEffect(() => {
    if (formData.suporteId && formData.suporteNome &&
        !suportes.some(s => s.id === formData.suporteId)) {
      setSuportes(prev => [
        { id: formData.suporteId!, descricao: formData.suporteNome! },
        ...prev,
      ])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.suporteId])

  // Busca de preços do papel SEMPRE filtrada pelo suporte selecionado (nível 2).
  useEffect(() => {
    if (!formData.suporteId) {
      setMateriais([])
      setBuscouPrecos(false)
      return
    }
    const termo = debounced.trim()
    setLoading(true)
    api.get('/orcamento-grafico/precos-mp', {
      params: {
        tipo: 'PAPEL',
        suporteId: formData.suporteId,
        comPreco: 'true', // só papéis com preço > 0 (o resto não serve p/ orçar)
        limit: 50,
        ...(termo.length >= 2 ? { busca: termo } : {}),
      },
    })
      .then(({ data }) => {
        const items = (Array.isArray(data) ? data : data.data || []).map((m: any) => ({
          id: m.id,
          descricao: m.descricao,
          precoUnitario: Number(m.precoUnitario),
          unidade: m.unidade,
          gramatura: m.gramatura != null ? Number(m.gramatura) : undefined,
        }))
        setMateriais(items)
      })
      .catch(() => setMateriais([]))
      .finally(() => {
        setLoading(false)
        setBuscouPrecos(true)
      })
  }, [debounced, formData.suporteId])

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

  const handleSelectSuporte = (suporteId: string | null) => {
    const found = suportes.find(s => s.id === suporteId)
    if (found) {
      // Troca de suporte zera o papel vinculado (os preços são re-buscados).
      updateForm({
        suporteId: found.id,
        suporteNome: found.descricao,
        papelId: null,
        papelDescricao: '',
      })
    } else {
      updateForm({ suporteId: null, suporteNome: '', papelId: null, papelDescricao: '' })
    }
    setBuscouPrecos(false)
  }

  const handleSelect = (papelId: string | null) => {
    const found = materiais.find(m => m.id === papelId)
    if (found) {
      updateForm({
        papelId: found.id,
        papelDescricao: found.descricao,
        precoKg: found.precoUnitario,
        // gramatura do registro quando vier; senão não sobrescreve
        ...(found.gramatura && found.gramatura > 0 ? { gramatura: found.gramatura } : {}),
      })
    } else {
      updateForm({ papelId: null })
    }
  }

  const optionsSuporte = suportes.map(s => ({ value: s.id, label: s.descricao }))
  const options = materiais.map(m => ({ value: m.id, label: m.descricao }))

  // Suporte selecionado, busca concluída e sem nenhum preço vinculado → bloqueia.
  const suporteSemPreco = !!formData.suporteId && buscouPrecos && !loading && materiais.length === 0

  return (
    <Stack gap="md">
      <Text fw={600} size="lg">Papel / Cartão</Text>
      <Text size="sm" c="dimmed">
        Escolha primeiro o Suporte (ex.: &quot;Duplex 280&quot;, &quot;Triplex&quot;, &quot;Kraft&quot;) e,
        em seguida, o preço do papel/gramatura vinculado a ele.
      </Text>

      {/* Nível 1 — Suporte */}
      <Select
        label="Suporte (Papel/Cartão)"
        placeholder="Digite para buscar (ex.: Duplex 280)"
        leftSection={loadingSuportes ? <Loader size={14} /> : <IconStack2 size={16} />}
        data={optionsSuporte}
        value={formData.suporteId}
        onChange={handleSelectSuporte}
        searchable
        searchValue={termoSuporte}
        onSearchChange={setTermoSuporte}
        // Desliga o filtro client-side do Mantine: o backend já filtrou.
        filter={({ options }) => options}
        nothingFoundMessage={
          loadingSuportes ? 'Buscando...' :
          termoSuporte.trim().length < 2 ? 'Digite ao menos 2 letras' :
          'Nenhum suporte encontrado'
        }
        comboboxProps={{ withinPortal: true }}
        clearable
      />

      {/* Nível 2 — Preço do papel vinculado ao suporte */}
      <Select
        label="Preço do Papel / Gramatura"
        placeholder={formData.suporteId ? 'Digite para buscar o papel' : 'Selecione um suporte primeiro'}
        leftSection={loading ? <Loader size={14} /> : <IconLeaf size={16} />}
        data={options}
        value={formData.papelId}
        onChange={handleSelect}
        disabled={!formData.suporteId}
        searchable
        searchValue={termoBusca}
        onSearchChange={setTermoBusca}
        // Desliga o filtro client-side do Mantine: o backend já filtrou.
        filter={({ options }) => options}
        nothingFoundMessage={
          loading ? 'Buscando...' :
          !formData.suporteId ? 'Selecione um suporte primeiro' :
          'Nenhum papel encontrado'
        }
        comboboxProps={{ withinPortal: true }}
        clearable
      />

      {suporteSemPreco && (
        <Alert color="orange" icon={<IconAlertTriangle size={16} />} title="Suporte sem preço vinculado">
          Este suporte não tem preço de papel vinculado. Cadastre o preço em Preços de
          Materiais (vinculando ao suporte) antes de prosseguir.
        </Alert>
      )}

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
            {formData.suporteNome && (
              <Badge color="blue" variant="light" size="lg">
                {formData.suporteNome}
              </Badge>
            )}
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
