'use client'

/**
 * ComplementosDoItem — Itens Diversos, Itens Fornecidos, Campos Livres, Observação,
 * Obs. Áreas de Op (até 2.000 caracteres cada) e Informações Complementares (até 1.000, só quando
 * o layout do produto a exibe).
 *
 * Reaproveita `SecaoItensComplementares` para as três listas. Os painéis são recolhíveis, mas o
 * conteúdo vive SEMPRE no `value` do pai: abrir, fechar ou trocar de painel não descarta nada
 * que ainda não foi salvo.
 *
 * Componente CONTROLADO (`value`/`onChange`), sem gravação e sem chamada ao motor.
 */

import { useMemo, useState } from 'react'
import { Accordion, Badge, Group, Paper, Stack, Textarea, ThemeIcon, Title } from '@mantine/core'
import { IconNotes } from '@tabler/icons-react'

import type { WizardFormData } from '../../../../novo/page'
import type { OpcaoSugerida } from '../../../editor/campos-livres-puro'
import type { CatalogoDoItem } from '../../../editor/catalogo/catalogo.types'
import SecaoItensComplementares from '../../../editor/SecaoItensComplementares'
import { INITIAL_ITEM } from '../../../itemFormShared'
import type { LayoutItem } from '../../../_layout/resolver-layout-item'
import {
  MAX_INFO_COMPLEMENTARES,
  MAX_OBSERVACAO,
  MAX_OBS_AREAS_OP,
  validarComplementos,
  type ValorComplementos,
} from './produto-final-item'

export type ValorComplementosItem = ValorComplementos &
  Pick<WizardFormData, 'itensDiversos' | 'itensFornecidos' | 'camposLivres'>

export interface ComplementosDoItemProps {
  value: ValorComplementosItem
  onChange: (parcial: Partial<ValorComplementosItem>) => void
  /** Layout do produto (decide se Informações Complementares aparece). */
  layout: Pick<LayoutItem, 'informacoesComplementaresVisiveis'> | null
  /** Catálogo do produto (sugestão de itens diversos). */
  catalogo?: CatalogoDoItem | null
  sugestoesRotulos?: ReadonlyArray<string>
  opcoesPorRotulo?: Readonly<Record<string, ReadonlyArray<OpcaoSugerida>>>
  obrigatorios?: ReadonlySet<string>
  avisoCamposLivres?: string | null
  disabled?: boolean
}

export interface CampoInformacoesComplementaresProps {
  value: string
  onChange: (texto: string) => void
  erro?: string
  disabled?: boolean
}

/** Campo de texto livre (até 1.000). Exportado para ficar logo abaixo da lista de Atividades. */
export function CampoInformacoesComplementares({ value, onChange, erro, disabled }: CampoInformacoesComplementaresProps) {
  return (
    <Textarea
      label="Informações Complementares"
      autosize
      minRows={3}
      maxRows={8}
      maxLength={MAX_INFO_COMPLEMENTARES}
      description={`${value.length}/${MAX_INFO_COMPLEMENTARES.toLocaleString('pt-BR')}`}
      value={value}
      onChange={(e) => onChange(e.currentTarget.value)}
      error={erro}
      disabled={disabled}
      data-testid="campo-informacoes-complementares"
    />
  )
}

const PAINEIS = { listas: 'listas', observacao: 'observacao', areas: 'areas' } as const

export default function ComplementosDoItem({
  value,
  onChange,
  layout,
  catalogo,
  sugestoesRotulos,
  opcoesPorRotulo,
  obrigatorios,
  avisoCamposLivres,
  disabled,
}: ComplementosDoItemProps) {
  // Só estado de apresentação (quais painéis estão abertos). Nenhum dado fica aqui.
  const [abertos, setAbertos] = useState<string[]>([])

  const exibeInfo = layout?.informacoesComplementaresVisiveis === true
  const { erros } = useMemo(
    () => validarComplementos(value, { informacoesComplementaresVisiveis: exibeInfo }),
    [value, exibeInfo],
  )

  // `SecaoItensComplementares` conversa com o formulário do wizard; aqui só passam as 3 listas.
  const formData = useMemo<WizardFormData>(
    () => ({
      ...INITIAL_ITEM,
      itensDiversos: value.itensDiversos ?? [],
      itensFornecidos: value.itensFornecidos ?? [],
      camposLivres: value.camposLivres ?? [],
    }),
    [value.itensDiversos, value.itensFornecidos, value.camposLivres],
  )

  const atualizarListas = (p: Partial<WizardFormData>) => {
    const parcial: Partial<ValorComplementosItem> = {}
    if ('itensDiversos' in p) parcial.itensDiversos = p.itensDiversos
    if ('itensFornecidos' in p) parcial.itensFornecidos = p.itensFornecidos
    if ('camposLivres' in p) parcial.camposLivres = p.camposLivres
    if (Object.keys(parcial).length > 0) onChange(parcial)
  }

  const qtdListas =
    (value.itensDiversos?.length ?? 0) + (value.itensFornecidos?.length ?? 0) + (value.camposLivres?.length ?? 0)

  return (
    <Paper withBorder radius="md" p="lg" shadow="xs" data-testid="complementos-do-item">
      <Stack gap="md">
        <Group gap="sm" wrap="nowrap">
          <ThemeIcon variant="light" color="cyan" size={32} radius="md">
            <IconNotes size={18} stroke={1.5} />
          </ThemeIcon>
          <Title order={5}>Complementos do item</Title>
        </Group>

        {exibeInfo && (
          <CampoInformacoesComplementares
            value={value.informacoesComplementares}
            onChange={(texto) => onChange({ informacoesComplementares: texto })}
            erro={erros.informacoesComplementares}
            disabled={disabled}
          />
        )}

        <Accordion multiple variant="separated" radius="md" value={abertos} onChange={setAbertos}>
          <Accordion.Item value={PAINEIS.listas}>
            <Accordion.Control>
              <Group gap="xs">
                Itens Diversos, Itens Fornecidos e Campos Livres
                {qtdListas > 0 && (
                  <Badge size="sm" variant="light" color="blue">
                    {qtdListas}
                  </Badge>
                )}
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <SecaoItensComplementares
                formData={formData}
                updateForm={atualizarListas}
                catalogo={catalogo}
                sugestoesRotulos={sugestoesRotulos}
                opcoesPorRotulo={opcoesPorRotulo}
                obrigatorios={obrigatorios}
                avisoCamposLivres={avisoCamposLivres}
              />
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value={PAINEIS.observacao}>
            <Accordion.Control>
              <Group gap="xs">
                Observação
                {value.observacao.trim() !== '' && (
                  <Badge size="sm" variant="light" color="teal">
                    preenchida
                  </Badge>
                )}
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Textarea
                aria-label="Observação"
                autosize
                minRows={3}
                maxRows={10}
                maxLength={MAX_OBSERVACAO}
                description={`${value.observacao.length.toLocaleString('pt-BR')}/${MAX_OBSERVACAO.toLocaleString('pt-BR')}`}
                value={value.observacao}
                onChange={(e) => onChange({ observacao: e.currentTarget.value })}
                error={erros.observacao}
                disabled={disabled}
                data-testid="campo-observacao"
              />
            </Accordion.Panel>
          </Accordion.Item>

          <Accordion.Item value={PAINEIS.areas}>
            <Accordion.Control>
              <Group gap="xs">
                Obs. Áreas de Op
                {value.observacaoAreasOp.trim() !== '' && (
                  <Badge size="sm" variant="light" color="teal">
                    preenchida
                  </Badge>
                )}
              </Group>
            </Accordion.Control>
            <Accordion.Panel>
              <Textarea
                aria-label="Obs. Áreas de Op"
                autosize
                minRows={3}
                maxRows={10}
                maxLength={MAX_OBS_AREAS_OP}
                description={`${value.observacaoAreasOp.length.toLocaleString('pt-BR')}/${MAX_OBS_AREAS_OP.toLocaleString('pt-BR')}`}
                value={value.observacaoAreasOp}
                onChange={(e) => onChange({ observacaoAreasOp: e.currentTarget.value })}
                error={erros.observacaoAreasOp}
                disabled={disabled}
                data-testid="campo-obs-areas-op"
              />
            </Accordion.Panel>
          </Accordion.Item>
        </Accordion>
      </Stack>
    </Paper>
  )
}
