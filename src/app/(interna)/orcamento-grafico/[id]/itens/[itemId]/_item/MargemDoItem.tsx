'use client'

/**
 * MargemDoItem — bloco compacto e recolhível da margem do item (decisão G4).
 *
 * Fechado, mostra só o resumo "custo · preço · CM%" (`resumoMargem`, gross-up de `previa-margem`).
 * Aberto, mostra a `SecaoFechamento` do editor atual (fechamento do item e prévia de faixas de
 * margem), que só é montada ao abrir para não consultar nada antes da hora. Não tem upload de imagem
 * da faca (a imagem de corte vem da Ficha Master). Não recalcula nem grava por conta própria: a
 * margem e o fechamento seguem as regras já existentes de `SecaoFechamento`.
 */

import { useState } from 'react'
import { Anchor, Collapse, Group, Paper, Stack, Text, Title } from '@mantine/core'
import { IconChevronDown, IconChevronUp } from '@tabler/icons-react'

import type { WizardFormData } from '../../../../novo/page'
import SecaoFechamento from '../../../editor/SecaoFechamento'
import { resumoMargem } from './margem-item'

export interface MargemDoItemProps {
  formData: WizardFormData
  updateForm: (parcial: Partial<WizardFormData>) => void
  /** Custo de produção consolidado (base da prévia). */
  baseCusto?: number | null
  /** CEV (%) do consolidado. */
  cevPct?: number | null
  /** Margem (%) selecionada no consolidado. */
  margemAtualPct?: number | null
  /** Contribuição marginal (%) do consolidado, quando houver. */
  contribuicaoMarginalPerc?: number | null
  /** Abre já expandido (útil em testes). */
  abertaInicialmente?: boolean
}

function moeda(v: number, casas = 2): string {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: casas, maximumFractionDigits: casas })
}

export default function MargemDoItem({
  formData,
  updateForm,
  baseCusto,
  cevPct,
  margemAtualPct,
  contribuicaoMarginalPerc,
  abertaInicialmente = false,
}: MargemDoItemProps) {
  const [aberta, setAberta] = useState(abertaInicialmente)

  const resumo = resumoMargem({
    baseCusto,
    cevPct,
    margemAtualPct,
    quantidade: formData.quantidade,
    contribuicaoMarginalPerc,
  })

  return (
    <Paper withBorder radius="md" p="md" data-testid="margem-do-item">
      <Stack gap="sm">
        <Group justify="space-between" wrap="nowrap" gap="md">
          <Group gap="md" wrap="wrap">
            <Title order={6}>Margem do item</Title>
            {resumo ? (
              <Text size="sm" data-testid="margem-do-item-resumo">
                Custo {moeda(resumo.custo)}
                {' · '}Preço {resumo.preco !== null ? moeda(resumo.preco) : '—'}
                {' · '}CM {resumo.cmPerc !== null ? `${resumo.cmPerc.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%` : '—'}
              </Text>
            ) : (
              <Text size="sm" c="dimmed" data-testid="margem-do-item-sem-resumo">
                Calcule o item para ver custo, preço e CM.
              </Text>
            )}
          </Group>
          <Anchor
            component="button"
            type="button"
            size="sm"
            aria-expanded={aberta}
            onClick={() => setAberta((v) => !v)}
            style={{ whiteSpace: 'nowrap' }}
          >
            <Group gap={4} wrap="nowrap">
              {aberta ? 'Recolher' : 'Detalhar'}
              {aberta ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
            </Group>
          </Anchor>
        </Group>

        <Collapse in={aberta}>
          {aberta && (
            <SecaoFechamento
              formData={formData}
              updateForm={updateForm}
              baseCusto={baseCusto}
              cevPct={cevPct}
              margemAtualPct={margemAtualPct}
            />
          )}
        </Collapse>
      </Stack>
    </Paper>
  )
}
