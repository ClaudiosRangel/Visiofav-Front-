'use client'

/**
 * BlocoPlanoUnico — "Impressão e suporte" do Item de PLANO ÚNICO (plano implícito, sem grid de planos).
 *
 * Só aparece quando `layout.estrutura = PLANO_UNICO`; cada campo segue `layout.planoUnico.campos`
 * (cadastro do produto), nunca nome de produto. Campos: Cores (`NxM`), Processo de Impressão (com
 * botões Pré e cadeado), Cobertura de Tinta, Fabricante, Suporte, Fornecido, Microondulado, Fibra,
 * Montagem e Formato de Corte (somente leitura) e Ajuste Corte Micro (mm) com o botão
 * "Propriedades/Preview" ao lado.
 *
 * Componente CONTROLADO (`value`/`onChange`, valores como texto): não grava, não recalcula e nunca
 * cria plano. O Suporte (papel, gramatura e preço por kg, que formam o custo) é o seletor de papel
 * já existente, passado em `suporte`; o botão NC (Suporte não cadastrado) aparece ao lado quando
 * `onSuporteNcCriado` é informado.
 *
 * Botões do Processo (a spec não define o efeito; comportamento adotado):
 * - Pré: aplica o processo padrão do cadastro do produto (`processoPre`); fica desabilitado sem padrão.
 * - Cadeado: trava/destrava o campo Processo contra edição acidental (só visual, não grava).
 */

import { useState, type ReactNode } from 'react'
import { ActionIcon, Anchor, Autocomplete, Button, Group, SimpleGrid, Stack, Switch, Text, TextInput, Tooltip } from '@mantine/core'
import { IconLock, IconLockOpen, IconPrinter } from '@tabler/icons-react'
import CartaoSecao from './CartaoSecao'

import type { LayoutItem } from '../../../_layout/resolver-layout-item'
import { useCoberturasTinta, useProcessosImpressao } from '../../../_hooks/useOpcoesPlanoUnico'
import BotaoPropriedades from './BotaoPropriedades'
import BotaoTintas from './BotaoTintas'
import type { CorGravada } from './tintas-item'
import BotaoSuporteNc from './BotaoSuporteNc'
import type { SuporteNcCriadoInfo } from './SuporteNcModal'
import {
  MAX_COBERTURA,
  MAX_FABRICANTE,
  MAX_PROCESSO,
  campoVisivel,
  validarPlanoUnico,
  type ValorPlanoUnico,
} from './plano-unico-item'

export interface BlocoPlanoUnicoProps {
  value: ValorPlanoUnico
  onChange: (parcial: Partial<ValorPlanoUnico>) => void
  layout: Pick<LayoutItem, 'estrutura' | 'planoUnico'>
  /** Montagem calculada (somente leitura), ex.: `2x2`. */
  montagem?: string | null
  /** Formato de Corte calculado (somente leitura), ex.: `650 x 1225`. */
  formatoCorte?: string | null
  /** Seletor de Suporte existente (papel + gramatura + preço), sem botão NC. */
  suporte?: ReactNode
  /** Processo padrão do cadastro do produto (botão Pré). */
  processoPre?: string | null
  /** Orçamento do item: habilita o botão "Propriedades/Preview". */
  orcamentoId?: string
  /** Suporte criado pelo botão NC; o pai o seleciona no formulário. Sem esta prop o botão não aparece. */
  onSuporteNcCriado?: (r: SuporteNcCriadoInfo) => void
  /** Tintas do item (janela "Tintas" ao lado da Cobertura). Sem `onTintas` o botão não aparece. */
  tintas?: ReadonlyArray<Partial<CorGravada>> | null
  onTintas?: (cores: CorGravada[]) => void
  disabled?: boolean
}

export default function BlocoPlanoUnico({
  value,
  onChange,
  layout,
  montagem,
  formatoCorte,
  suporte,
  processoPre,
  orcamentoId,
  onSuporteNcCriado,
  tintas,
  onTintas,
  disabled,
}: BlocoPlanoUnicoProps) {
  const [processoTravado, setProcessoTravado] = useState(false)
  const processos = useProcessosImpressao(layout.estrutura === 'PLANO_UNICO')
  const coberturas = useCoberturasTinta(layout.estrutura === 'PLANO_UNICO')

  if (layout.estrutura !== 'PLANO_UNICO') return null

  const mostra = (c: Parameters<typeof campoVisivel>[1]) => campoVisivel(layout, c)
  const { erros } = validarPlanoUnico(value, layout)
  const erroListas = processos.erro ?? coberturas.erro

  return (
    <CartaoSecao titulo="Impressão e Suporte" icone={<IconPrinter size={16} />} data-testid="bloco-plano-unico">
      <Stack gap="md">

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {mostra('cores') && (
            <TextInput
              label="Cores"
              placeholder="Ex.: 5x0"
              description="Frente x verso, de 0 a 12"
              inputMode="text"
              value={value.cores}
              onChange={(e) => onChange({ cores: e.currentTarget.value })}
              error={erros.cores}
              disabled={disabled}
            />
          )}

          {mostra('processoImpressao') && (
            <Group gap={6} align="flex-end" wrap="nowrap">
              <Autocomplete
                label="Processo de Impressão"
                placeholder="Ex.: Offset Plana"
                maxLength={MAX_PROCESSO}
                data={processos.nomes}
                limit={20}
                value={value.processoImpressao}
                onChange={(v) => onChange({ processoImpressao: v })}
                error={erros.processoImpressao}
                readOnly={processoTravado}
                disabled={disabled}
                style={{ flex: 1, minWidth: 0 }}
              />
              <Tooltip label="Aplicar o processo padrão do produto">
                <Button
                  variant="default"
                  size="sm"
                  disabled={disabled || processoTravado || !processoPre}
                  onClick={() => processoPre && onChange({ processoImpressao: processoPre })}
                >
                  Pré
                </Button>
              </Tooltip>
              <Tooltip label={processoTravado ? 'Destravar o processo' : 'Travar o processo'}>
                <ActionIcon
                  variant={processoTravado ? 'filled' : 'default'}
                  size={36}
                  aria-label={processoTravado ? 'Destravar processo' : 'Travar processo'}
                  aria-pressed={processoTravado}
                  disabled={disabled}
                  onClick={() => setProcessoTravado((v) => !v)}
                >
                  {processoTravado ? <IconLock size={16} /> : <IconLockOpen size={16} />}
                </ActionIcon>
              </Tooltip>
            </Group>
          )}

          {mostra('coberturaTinta') && (
            <Group gap={6} align="flex-end" wrap="nowrap">
              <Autocomplete
                label="Cobertura de Tinta"
                placeholder="Ex.: Definição Manual"
                maxLength={MAX_COBERTURA}
                data={coberturas.nomes}
                limit={20}
                value={value.coberturaTintaTexto}
                onChange={(v) => onChange({ coberturaTintaTexto: v })}
                error={erros.coberturaTintaTexto}
                disabled={disabled}
                style={{ flex: 1, minWidth: 0 }}
              />
              {onTintas && <BotaoTintas value={tintas} onChange={onTintas} disabled={disabled} />}
            </Group>
          )}

          {mostra('fabricante') && (
            <TextInput
              label="Fabricante"
              placeholder="Fabricante"
              maxLength={MAX_FABRICANTE}
              value={value.fabricante}
              onChange={(e) => onChange({ fabricante: e.currentTarget.value })}
              error={erros.fabricante}
              disabled={disabled}
            />
          )}
        </SimpleGrid>

        {mostra('suporte') && suporte && (
          <Group gap={6} align="flex-end" wrap="nowrap" data-testid="bloco-plano-unico-suporte">
            <div style={{ flex: 1, minWidth: 0 }}>{suporte}</div>
            {onSuporteNcCriado && <BotaoSuporteNc onCriado={onSuporteNcCriado} disabled={disabled} />}
          </Group>
        )}

        <Group gap="xl">
          {mostra('fornecido') && (
            <Switch
              label="Fornecido"
              checked={value.fornecido}
              onChange={(e) => onChange({ fornecido: e.currentTarget.checked })}
              disabled={disabled}
            />
          )}
          {mostra('microondulado') && (
            <Switch
              label="Microondulado"
              checked={value.microondulado}
              onChange={(e) => onChange({ microondulado: e.currentTarget.checked })}
              disabled={disabled}
            />
          )}
          {mostra('fibra') && (
            <Switch
              label="Fibra"
              checked={value.fibra}
              onChange={(e) => onChange({ fibra: e.currentTarget.checked })}
              disabled={disabled}
            />
          )}
        </Group>

        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
          {mostra('montagem') && (
            <TextInput
              label="Montagem"
              description="Calculada"
              value={montagem ?? ''}
              placeholder="—"
              readOnly
              data-testid="plano-unico-montagem"
            />
          )}
          {mostra('formatoCorte') && (
            <TextInput
              label="Formato de Corte"
              description="Calculado, em mm"
              value={formatoCorte ?? ''}
              placeholder="—"
              readOnly
              data-testid="plano-unico-formato-corte"
            />
          )}
          {mostra('ajusteCorteMicro') && (
            <Group gap="sm" align="flex-end" wrap="nowrap">
              <TextInput
                label="Ajuste Corte Micro (mm)"
                placeholder="0,00"
                description="De 0 a 100,00"
                inputMode="decimal"
                value={value.ajusteCorteMicro}
                onChange={(e) => onChange({ ajusteCorteMicro: e.currentTarget.value })}
                error={erros.ajusteCorteMicro}
                disabled={disabled}
                style={{ flex: 1, minWidth: 0 }}
              />
              {orcamentoId && <BotaoPropriedades orcamentoId={orcamentoId} />}
            </Group>
          )}
        </SimpleGrid>

        {erroListas && (
          <Group gap="xs">
            <Text size="xs" c="red">
              {erroListas}
            </Text>
            <Anchor
              size="xs"
              component="button"
              type="button"
              onClick={() => {
                if (processos.erro) processos.tentarNovamente()
                if (coberturas.erro) coberturas.tentarNovamente()
              }}
            >
              Tentar novamente
            </Anchor>
          </Group>
        )}
      </Stack>
    </CartaoSecao>
  )
}
