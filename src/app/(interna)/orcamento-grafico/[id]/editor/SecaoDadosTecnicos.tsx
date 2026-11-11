'use client'

/**
 * SecaoDadosTecnicos — seção "Dados Técnicos" do Editor de Item do Orçamento
 * Gráfico (experiência Calcgraf).
 *
 * Feature: orcamento-grafico-experiencia-calcgraf (Tarefa 5.2)
 * _Requirements: 1.6, 3.1, 3.2, 3.4, 3.5, 3.6, 4.4, 8.1_
 *
 * Reaproveita integralmente o sub-form `StepDadosTecnicos` (do wizard `/novo`)
 * para a EDIÇÃO dos campos técnicos de paridade com o Calcgraf (Sigla Acabado,
 * Tributação, Processo de Impressão, Cobertura de Tinta, Fabricante, Qtd.
 * Modelos, Arte, Microondulado, Fornecido, Observação, Obs. Áreas de OP,
 * Acondicionamento, Conteúdo por Volume) + geometria/montagem/formatos. Os
 * rótulos equivalentes ao Calcgraf já vivem no `StepDadosTecnicos`, então aqui
 * só os reaproveitamos (Req 8.1). A validação de tipo que impede salvar é do
 * backend/Zod + feedback existente — NÃO reimplementada aqui (Req 3.5).
 *
 * O que esta seção ADICIONA ao sub-form:
 *  - Um RESUMO no topo sinalizando quais Campo_Técnico ficaram VAZIOS após o
 *    Puxar Cálculo (Req 4.4 / 1.6), com rótulos amigáveis em PT.
 *  - A legenda de origem (● copiado / ○ manual / ⚠ vazio) via `BadgeOrigemCampo`
 *    ao lado de cada campo técnico listado no resumo.
 *
 * Os Campo_Técnico não afetam o custo (Req 3.6) — esta seção é só
 * apresentação/edição; não dispara recálculo.
 */

import { Alert, Group, Paper, Stack, Text } from '@mantine/core'
import { IconInfoCircle } from '@tabler/icons-react'

import StepDadosTecnicos from '../../novo/StepDadosTecnicos'
import type { WizardFormData } from '../../novo/page'
import BadgeOrigemCampo from './BadgeOrigemCampo'
import { CLASSE_CAMPO_TECNICO, origemCampoDoCampo } from './origem-campo'
import type { CampoCondicional } from './campos-por-linha'

interface Props {
  formData: WizardFormData
  updateForm: (partial: Partial<WizardFormData>) => void
  /**
   * Decide quais campos condicionais por Linha de Produto exibir. Quando
   * ausente, todos os campos são exibidos (comportamento legado). Repassado ao
   * `StepDadosTecnicos`, que oculta os inputs condicionais mapeáveis. Ocultar
   * NÃO apaga valores do formData (R2.6).
   */
  mostrarCampo?: (campo: CampoCondicional) => boolean
}

/**
 * Rótulos amigáveis (PT, terminologia Calcgraf) de cada Campo_Técnico, para o
 * resumo de vazios. A ordem reflete a disposição do pré-cálculo do Calcgraf.
 */
const ROTULO_CAMPO_TECNICO: Record<string, string> = {
  siglaAcabado: 'Sigla Acabado',
  tributacao: 'Tributação',
  processoImpressao: 'Processo de Impressão',
  coberturaTintaTexto: 'Cobertura de Tinta',
  fabricante: 'Fabricante',
  qtdModelos: 'Qtd. Modelos',
  arte: 'Arte',
  microondulado: 'Microondulado',
  fornecido: 'Fornecido',
  observacao: 'Observação',
  observacaoAreasOp: 'Obs. Áreas de OP',
  acondicionamento: 'Acondicionamento',
  conteudoVolume: 'Conteúdo por Volume',
}

/** Campos técnicos avaliados no resumo, na ordem de exibição. */
const CAMPOS_TECNICOS = Object.keys(ROTULO_CAMPO_TECNICO)

export default function SecaoDadosTecnicos({ formData, updateForm, mostrarCampo }: Props) {
  // Campos técnicos cujo estado derivado é "vazio" (COPIAVEL sem valor) ou
  // "manual-vazio" (MANUAL sem valor) — ou seja, precisam ser completados.
  const camposVazios = CAMPOS_TECNICOS.filter((campo) => {
    const origem = origemCampoDoCampo(campo, (formData as Record<string, unknown>)[campo])
    return origem === 'vazio' || origem === 'manual-vazio'
  })

  return (
    <Stack gap="md">
      {/* Resumo de origem dos campos técnicos (Req 4.4 / 1.6) */}
      {camposVazios.length > 0 ? (
        <Alert
          variant="light"
          color="yellow"
          icon={<IconInfoCircle size={18} />}
          title="Campos vazios após puxar"
        >
          <Text size="sm" mb="xs">
            Estes campos técnicos ficaram sem valor e precisam ser completados
            manualmente:
          </Text>
          <Group gap="md">
            {camposVazios.map((campo) => (
              <Group key={campo} gap={6} wrap="nowrap">
                <BadgeOrigemCampo
                  campo={campo}
                  valor={(formData as Record<string, unknown>)[campo]}
                />
                <Text span size="sm">
                  {ROTULO_CAMPO_TECNICO[campo]}
                  {CLASSE_CAMPO_TECNICO[campo] === 'COPIAVEL' ? ' (copiável)' : ''}
                </Text>
              </Group>
            ))}
          </Group>
        </Alert>
      ) : (
        <Alert variant="light" color="green" icon={<IconInfoCircle size={18} />}>
          Todos os campos técnicos preenchidos.
        </Alert>
      )}

      {/* Sub-form reaproveitado (rótulos Calcgraf + validação Zod existentes).
          `mostrarCampo` oculta os campos condicionais não pertencentes à Linha
          de Produto do orçamento (sem apagar valores — R2.6). */}
      <Paper withBorder p="md">
        <StepDadosTecnicos formData={formData} updateForm={updateForm} mostrarCampo={mostrarCampo} />
      </Paper>
    </Stack>
  )
}
