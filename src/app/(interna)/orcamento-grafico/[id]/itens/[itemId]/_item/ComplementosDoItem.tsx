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
import { Badge, Group, Paper, Stack, Tabs, Text, Textarea } from '@mantine/core'
import { IconBuildingFactory2, IconFileText, IconListDetails, IconPackages, IconTruck } from '@tabler/icons-react'

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

const ABAS = { diversos: 'diversos', fornecidos: 'fornecidos', livres: 'livres', observacao: 'observacao', areas: 'areas' } as const

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
  // Só estado de apresentação (aba aberta). Nenhum dado fica aqui: trocar de aba não descarta nada.
  const [aba, setAba] = useState<string>(ABAS.diversos)

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

  const marca = (n: number | boolean) =>
    (typeof n === 'number' ? n > 0 : n) ? (
      <Badge size="xs" variant="light" circle={typeof n === 'number'}>
        {typeof n === 'number' ? n : '•'}
      </Badge>
    ) : null

  return (
    <Paper withBorder radius="md" shadow="xs" style={{ overflow: 'hidden' }} data-testid="complementos-do-item">
        <Tabs value={aba} onChange={(v) => v && setAba(v)} variant="pills" radius="md">
          <Group
            justify="space-between"
            wrap="wrap"
            gap="sm"
            px="md"
            py="xs"
            bg="var(--mantine-color-default-hover)"
            style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
          >
          <Tabs.List>
            <Tabs.Tab value={ABAS.diversos} leftSection={<IconPackages size={14} />} rightSection={marca(value.itensDiversos?.length ?? 0)}>
              Itens Diversos
            </Tabs.Tab>
            <Tabs.Tab value={ABAS.fornecidos} leftSection={<IconTruck size={14} />} rightSection={marca(value.itensFornecidos?.length ?? 0)}>
              Itens Fornecidos
            </Tabs.Tab>
            <Tabs.Tab value={ABAS.livres} leftSection={<IconListDetails size={14} />} rightSection={marca(value.camposLivres?.length ?? 0)}>
              Campos Livres
            </Tabs.Tab>
            <Tabs.Tab value={ABAS.observacao} leftSection={<IconFileText size={14} />} rightSection={marca(value.observacao.trim() !== '')}>
              Observação
            </Tabs.Tab>
            <Tabs.Tab value={ABAS.areas} leftSection={<IconBuildingFactory2 size={14} />} rightSection={marca(value.observacaoAreasOp.trim() !== '')}>
              Obs. Áreas de Op
            </Tabs.Tab>
          </Tabs.List>
          <Text size="xs" c="dimmed" visibleFrom="sm">
            Informações complementares do item
          </Text>
          </Group>

          <Stack gap="md" p="md">
          {exibeInfo && (
            <CampoInformacoesComplementares
              value={value.informacoesComplementares}
              onChange={(texto) => onChange({ informacoesComplementares: texto })}
              erro={erros.informacoesComplementares}
              disabled={disabled}
            />
          )}

          {(['diversos', 'fornecidos', 'livres'] as const).map((s) => (
            <Tabs.Panel key={s} value={ABAS[s]} >
              <SecaoItensComplementares
                formData={formData}
                updateForm={atualizarListas}
                catalogo={catalogo}
                sugestoesRotulos={sugestoesRotulos}
                opcoesPorRotulo={opcoesPorRotulo}
                obrigatorios={obrigatorios}
                avisoCamposLivres={avisoCamposLivres}
                secao={s}
              />
            </Tabs.Panel>
          ))}

          <Tabs.Panel value={ABAS.observacao} >
            <Textarea
              label="Observação"
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
          </Tabs.Panel>

          <Tabs.Panel value={ABAS.areas} >
            <Textarea
              label="Obs. Áreas de Op"
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
          </Tabs.Panel>
          </Stack>
        </Tabs>
    </Paper>
  )
}
