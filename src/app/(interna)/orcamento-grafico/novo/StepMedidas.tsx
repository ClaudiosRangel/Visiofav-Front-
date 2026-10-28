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

/**
 * Normalização determinística dos rótulos EXIBIDOS dos parâmetros de medida.
 *
 * A chave de DADO continua sendo `param.nome` (L/A/P) — o que o Motor_Calculo
 * consome via `medidas[param.nome]`. Aqui apenas o TEXTO exibido é padronizado,
 * para que os três campos principais apareçam sempre como
 * "Comprimento, Largura, Altura" (nessa ordem), sem duplicados, independente
 * do que estiver gravado em `parametros[].label` no cadastro da base.
 *
 * Para parâmetros que NÃO são L/A/P (ex.: ABA, SANGRIA, PINÇA), mantém-se o
 * `label` do cadastro.
 */
const ROTULOS_MEDIDA_POR_NOME: Record<string, string> = {
  L: 'Comprimento',
  A: 'Largura',
  P: 'Altura',
}

function rotuloExibido(param: Parametro): string {
  const chave = (param.nome || '').trim().toUpperCase()
  return ROTULOS_MEDIDA_POR_NOME[chave] ?? param.label
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
        {parametros.map((param) => {
          // Rótulo EXIBIDO normalizado (Comprimento/Largura/Altura por nome L/A/P);
          // a chave de DADO permanece `param.nome` (mapeamento intacto — Req 5.3).
          const rotulo = rotuloExibido(param)
          return (
            <NumberInput
              key={param.nome}
              label={
                <Group gap={4}>
                  <Text size="sm">{rotulo}</Text>
                  {param.obrigatorio && <Badge size="xs" color="red" variant="light">obrigatório</Badge>}
                </Group>
              }
              description={`Unidade: ${param.unidade}`}
              placeholder={param.default ? `Padrão: ${param.default}` : `Informe ${rotulo.toLowerCase()}`}
              leftSection={<IconRuler size={14} />}
              value={formData.medidas[param.nome] || param.default || ''}
              onChange={(val) => handleChange(param.nome, val)}
              min={0}
              decimalScale={2}
              suffix={` ${param.unidade}`}
            />
          )
        })}
      </SimpleGrid>
    </Stack>
  )
}
