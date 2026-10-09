'use client'

import { useEffect, useState } from 'react'
import {
  Stack, Text, Group, Button, Paper, NumberInput, Select, ActionIcon, Slider,
  TextInput, Badge, SegmentedControl, Alert, Divider,
} from '@mantine/core'
import { IconPlus, IconTrash, IconPalette, IconAlertCircle, IconPrinter } from '@tabler/icons-react'
import { api } from '@/lib/api'
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

  // Máquinas de impressão IMPRESSAO ativas (paridade Calcgraf: o acerto-por-cor
  // e o custo-hora da máquina escolhida alimentam o Custo de Transformação).
  const [maquinas, setMaquinas] = useState<{ value: string; label: string }[]>([])

  useEffect(() => {
    api.get('/centros-producao', { params: { limit: 100, status: 'true' } })
      .then(({ data }) => {
        const items = (data.data || data || [])
          .filter((c: any) =>
            (c?.tipoProcesso?.codigo === 'IMPRESSAO' || /impress/i.test(c?.tipoProcesso?.descricao || '')) &&
            (c?.status === true || c?.status === 'true' || c?.status === undefined),
          )
          .map((c: any) => ({ value: c.id, label: c.descricao || c.codigo }))
        setMaquinas(items)
      })
      .catch(() => setMaquinas([]))
  }, [])

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

  const tintaModo = formData.tintaModo ?? 'COBERTURA'
  const semMaquinaCadastrada = maquinas.length === 0
  const pendenteMaquina = cores.length >= 1 && !formData.maquinaId

  return (
    <Stack gap="md">
      {/* ================= Impressão (máquina + tinta + matriz) ================= */}
      <Paper p="md" withBorder>
        <Stack gap="md">
          <Group gap="xs">
            <IconPrinter size={18} />
            <Text fw={600} size="lg">Impressão</Text>
          </Group>

          {/* 1) Máquina de impressão */}
          <Select
            label="Máquina de impressão"
            description="Máquina usada no cálculo da impressão"
            placeholder="Selecione a máquina"
            data={maquinas}
            value={formData.maquinaId ?? null}
            onChange={(v) => updateForm({ maquinaId: v })}
            clearable
            searchable
          />
          {semMaquinaCadastrada && (
            <Alert color="yellow" variant="light" icon={<IconAlertCircle size={16} />}>
              Nenhuma máquina de impressão ativa cadastrada
            </Alert>
          )}
          {pendenteMaquina && (
            <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />}>
              Selecione a máquina de impressão
            </Alert>
          )}

          <Divider />

          {/* 2) Modo de cálculo da tinta */}
          <div>
            <Text size="sm" fw={500} mb={6}>Cálculo da tinta</Text>
            <SegmentedControl
              value={tintaModo}
              onChange={(v) => updateForm({ tintaModo: v as 'COBERTURA' | 'CONSUMO_DIRETO' })}
              data={[
                { value: 'COBERTURA', label: 'Por cobertura' },
                { value: 'CONSUMO_DIRETO', label: 'Consumo direto' },
              ]}
            />
            <Text size="xs" c="dimmed" mt={6}>
              No modo consumo direto, o consumo informado em kg substitui o cálculo
              por cobertura das cores.
            </Text>
          </div>

          {tintaModo === 'CONSUMO_DIRETO' && (
            <Group grow gap="sm">
              <NumberInput
                label="Consumo de tinta (kg)"
                value={formData.tintaConsumoKg ?? undefined}
                onChange={(val) => updateForm({ tintaConsumoKg: typeof val === 'number' ? val : null })}
                min={0.001}
                decimalScale={3}
              />
              <NumberInput
                label="Preço da tinta (R$/kg)"
                value={formData.tintaPrecoKg ?? undefined}
                onChange={(val) => updateForm({ tintaPrecoKg: typeof val === 'number' ? val : null })}
                prefix="R$ "
                min={0.01}
                decimalScale={2}
              />
            </Group>
          )}

          <Divider />

          {/* 3) Matriz de impressão */}
          <div>
            <Text size="sm" fw={500} mb={6}>Matriz de impressão</Text>
            <Group grow gap="sm">
              <NumberInput
                label="Qtd. matrizes"
                value={formData.matrizQuantidade ?? undefined}
                onChange={(val) => updateForm({ matrizQuantidade: typeof val === 'number' ? val : null })}
                min={0}
                decimalScale={0}
              />
              <NumberInput
                label="Preço unitário da matriz (R$)"
                value={formData.matrizPrecoUnitario ?? undefined}
                onChange={(val) => updateForm({ matrizPrecoUnitario: typeof val === 'number' ? val : null })}
                prefix="R$ "
                min={0}
                decimalScale={2}
              />
            </Group>
            <Text size="xs" c="dimmed" mt={6}>
              A matriz entra no Material Direto como custo fixo.
            </Text>
          </div>
        </Stack>
      </Paper>

      {/* ================= Cores ================= */}
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
