'use client'

/**
 * BlocosPorTipoPlano — blocos de suporte da Tela_Plano (R10.4 a R10.6, R10.8).
 *
 * Quais blocos aparecem vem de `blocosDaTela(tipo)` (= `resolverBlocosPlano` + o suporte principal
 * quando nenhum dos três é previsto). Nunca compara nome de tipo; `null` na previsão = mostrar.
 *  - Capa externa: Fabricante, Suporte, Fornecido e Fibra (Fibra só com `blocos.fibra`).
 *  - Microondulado: Fabricante, Suporte, Fornecido, Sentido da onda e Ajuste Corte Micro
 *    (−99,99 a 99,99) com o botão "Propriedades/Preview" ao lado (R13, decisão D2).
 *  - Capa interna: Fabricante, Suporte, Fornecido, Cores, Processo de Impressão e Cobertura de Tinta.
 *  - Suporte (principal): Fabricante, Suporte e Fornecido, só quando o tipo não prevê nenhum bloco.
 *
 * Componente controlado: não grava nada. `CamposImpressao` (Cores, Processo com Pré e cadeado,
 * Cobertura) também é usado no topo da Tela_Plano.
 */

import { useState, type ReactNode } from 'react'
import { ActionIcon, Autocomplete, Button, Group, Paper, SimpleGrid, Stack, Switch, TextInput, Title, Tooltip } from '@mantine/core'
import { IconLock, IconLockOpen } from '@tabler/icons-react'

import BotaoPropriedades from '../_item/BotaoPropriedades'
import BotaoSuporteNc from '../_item/BotaoSuporteNc'
import SeletorSuportePlano, { type OpcaoSuporte } from './SeletorSuportePlano'
import { MAX_PROCESSO_PLANO, MAX_TEXTO_CURTO, type BlocoSuporteForm, type BlocosTelaPlano, type ErrosTelaPlano, type EstadoTelaPlano } from './tela-plano'

// ─── Cores / Processo / Cobertura ───────────────────────────────────────────

export interface ValorImpressao {
  cores: string
  processoImpressao: string
  coberturaTinta: string
}

export interface CamposImpressaoProps {
  value: ValorImpressao
  onChange: (parcial: Partial<ValorImpressao>) => void
  /** Prefixo dos rótulos (ex.: "da capa interna"). */
  sufixoRotulo?: string
  processos: readonly string[]
  /** Processo padrão do produto para o tipo (botão Pré). */
  processoPre?: string | null
  erros?: { cores?: string; processoImpressao?: string; coberturaTinta?: string }
  disabled?: boolean
}

export function CamposImpressao({ value, onChange, sufixoRotulo, processos, processoPre, erros, disabled }: CamposImpressaoProps) {
  const [travado, setTravado] = useState(false)
  const r = (t: string) => (sufixoRotulo ? `${t} ${sufixoRotulo}` : t)
  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
      <TextInput
        label={r('Cores')}
        placeholder="Ex.: 4x0"
        description="Frente x verso, de 0 a 12"
        value={value.cores}
        onChange={(e) => onChange({ cores: e.currentTarget.value })}
        error={erros?.cores}
        disabled={disabled}
        required
      />
      <Group gap={6} align="flex-end" wrap="nowrap">
        <Autocomplete
          label={r('Processo de Impressão')}
          placeholder="Ex.: Offset Plana"
          maxLength={MAX_PROCESSO_PLANO}
          data={[...processos]}
          limit={20}
          value={value.processoImpressao}
          onChange={(v) => onChange({ processoImpressao: v })}
          error={erros?.processoImpressao}
          readOnly={travado}
          disabled={disabled}
          required
          style={{ flex: 1, minWidth: 0 }}
        />
        <Tooltip label="Aplicar o processo padrão do produto">
          <Button
            variant="default"
            size="sm"
            disabled={disabled || travado || !processoPre}
            onClick={() => processoPre && onChange({ processoImpressao: processoPre })}
          >
            Pré
          </Button>
        </Tooltip>
        <Tooltip label={travado ? 'Destravar o processo' : 'Travar o processo'}>
          <ActionIcon
            variant={travado ? 'filled' : 'default'}
            size={36}
            aria-label={travado ? `Destravar ${r('processo')}` : `Travar ${r('processo')}`}
            aria-pressed={travado}
            disabled={disabled}
            onClick={() => setTravado((v) => !v)}
          >
            {travado ? <IconLock size={16} /> : <IconLockOpen size={16} />}
          </ActionIcon>
        </Tooltip>
      </Group>
      <TextInput
        label={r('Cobertura de Tinta (%)')}
        placeholder="0,00"
        description="De 0 a 100"
        inputMode="decimal"
        value={value.coberturaTinta}
        onChange={(e) => onChange({ coberturaTinta: e.currentTarget.value })}
        error={erros?.coberturaTinta}
        disabled={disabled}
      />
    </SimpleGrid>
  )
}

// ─── Blocos de suporte ──────────────────────────────────────────────────────

export type ChaveBlocoSuporte = 'capaExterna' | 'microondulado' | 'capaInterna' | 'principal'

export interface BlocosPorTipoPlanoProps {
  blocos: BlocosTelaPlano
  value: Pick<EstadoTelaPlano, ChaveBlocoSuporte>
  /** Mudança de um campo de um bloco (`campo` é o nome no bloco, ex.: `suporteId`). */
  onChange: <K extends ChaveBlocoSuporte>(bloco: K, parcial: Partial<EstadoTelaPlano[K]>, campos: string[]) => void
  erros: ErrosTelaPlano
  processos: readonly string[]
  processoPre?: string | null
  /** Suportes permitidos pelo tipo de plano (vazio = sem restrição). */
  suportesPermitidos?: ReadonlyArray<OpcaoSuporte>
  orcamentoId: string
  disabled?: boolean
}

function CamposSuporte({
  bloco,
  valor,
  rotuloSuporte,
  onChange,
  erro,
  suportesPermitidos,
  disabled,
}: {
  bloco: ChaveBlocoSuporte
  valor: BlocoSuporteForm
  rotuloSuporte: string
  onChange: (parcial: Partial<BlocoSuporteForm>, campos: string[]) => void
  erro?: string
  suportesPermitidos?: ReadonlyArray<OpcaoSuporte>
  disabled?: boolean
}) {
  // Suportes criados pelo NC nesta tela: entram nas opções quando há lista restrita (`permitidos`).
  const [criadosNc, setCriadosNc] = useState<OpcaoSuporte[]>([])
  const permitidosEfetivos =
    suportesPermitidos && suportesPermitidos.length > 0
      ? [...suportesPermitidos, ...criadosNc.filter((c) => !suportesPermitidos.some((p) => p.value === c.value))]
      : suportesPermitidos

  return (
    <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md" data-testid={`campos-suporte-${bloco}`}>
      <TextInput
        label="Fabricante"
        placeholder="Fabricante"
        maxLength={MAX_TEXTO_CURTO}
        value={valor.fabricante}
        onChange={(e) => onChange({ fabricante: e.currentTarget.value }, ['fabricante'])}
        disabled={disabled}
      />
      <Group gap={6} align="flex-end" wrap="nowrap">
        <div style={{ flex: 1, minWidth: 0 }}>
          <SeletorSuportePlano
            label={rotuloSuporte}
            value={valor.suporteId}
            nomeAtual={valor.suporteNome}
            onChange={(id, nome) => onChange({ suporteId: id, suporteNome: nome }, ['suporteId'])}
            permitidos={permitidosEfetivos}
            error={erro}
            disabled={disabled}
            required
          />
        </div>
        <BotaoSuporteNc
          disabled={disabled}
          onCriado={(r) => {
            setCriadosNc((l) => [...l, { value: r.suporteId, label: r.nome }])
            onChange({ suporteId: r.suporteId, suporteNome: r.nome }, ['suporteId'])
          }}
        />
      </Group>
      <Switch
        label="Fornecido"
        checked={valor.fornecido}
        onChange={(e) => onChange({ fornecido: e.currentTarget.checked }, ['fornecido'])}
        disabled={disabled}
        mt={{ base: 0, sm: 'xl' }}
      />
    </SimpleGrid>
  )
}

function Bloco({ titulo, testId, children }: { titulo: string; testId: string; children: ReactNode }) {
  return (
    <Paper withBorder radius="md" p="md" data-testid={testId}>
      <Stack gap="sm">
        <Title order={6}>{titulo}</Title>
        {children}
      </Stack>
    </Paper>
  )
}

export default function BlocosPorTipoPlano({
  blocos,
  value,
  onChange,
  erros,
  processos,
  processoPre,
  suportesPermitidos,
  orcamentoId,
  disabled,
}: BlocosPorTipoPlanoProps) {
  return (
    <Stack gap="md" data-testid="blocos-por-tipo-plano">
      {blocos.capaExterna && (
        <Bloco titulo="Capa externa" testId="bloco-capa-externa">
          <CamposSuporte
            bloco="capaExterna"
            valor={value.capaExterna}
            rotuloSuporte="Suporte da capa externa"
            onChange={(p, c) => onChange('capaExterna', p, c)}
            erro={erros['capaExterna.suporteId']}
            suportesPermitidos={suportesPermitidos}
            disabled={disabled}
          />
          {blocos.fibra && (
            <TextInput
              label="Fibra da capa externa"
              placeholder="Ex.: Longitudinal"
              maxLength={MAX_TEXTO_CURTO}
              value={value.capaExterna.fibra}
              onChange={(e) => onChange('capaExterna', { fibra: e.currentTarget.value }, ['fibra'])}
              disabled={disabled}
              maw={360}
            />
          )}
        </Bloco>
      )}

      {blocos.microondulado && (
        <Bloco titulo="Microondulado" testId="bloco-microondulado">
          <CamposSuporte
            bloco="microondulado"
            valor={value.microondulado}
            rotuloSuporte="Suporte do microondulado"
            onChange={(p, c) => onChange('microondulado', p, c)}
            erro={erros['microondulado.suporteId']}
            suportesPermitidos={suportesPermitidos}
            disabled={disabled}
          />
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput
              label="Sentido da onda"
              placeholder="Ex.: Vertical"
              maxLength={MAX_TEXTO_CURTO}
              value={value.microondulado.sentidoOnda}
              onChange={(e) => onChange('microondulado', { sentidoOnda: e.currentTarget.value }, ['sentidoOnda'])}
              disabled={disabled}
            />
            <Group gap="sm" align="flex-end" wrap="nowrap">
              <TextInput
                label="Ajuste Corte Micro (mm)"
                placeholder="0,00"
                description="De −99,99 a 99,99"
                inputMode="decimal"
                value={value.microondulado.ajusteCorteMicro}
                onChange={(e) => onChange('microondulado', { ajusteCorteMicro: e.currentTarget.value }, ['ajusteCorteMicro'])}
                error={erros['microondulado.ajusteCorteMicro']}
                disabled={disabled}
                style={{ flex: 1, minWidth: 0 }}
              />
              <BotaoPropriedades orcamentoId={orcamentoId} />
            </Group>
          </SimpleGrid>
        </Bloco>
      )}

      {blocos.capaInterna && (
        <Bloco titulo="Capa interna" testId="bloco-capa-interna">
          <CamposSuporte
            bloco="capaInterna"
            valor={value.capaInterna}
            rotuloSuporte="Suporte da capa interna"
            onChange={(p, c) => onChange('capaInterna', p, c)}
            erro={erros['capaInterna.suporteId']}
            suportesPermitidos={suportesPermitidos}
            disabled={disabled}
          />
          <CamposImpressao
            sufixoRotulo="da capa interna"
            value={value.capaInterna}
            onChange={(p) => onChange('capaInterna', p, Object.keys(p))}
            processos={processos}
            processoPre={processoPre}
            erros={{
              cores: erros['capaInterna.cores'],
              processoImpressao: erros['capaInterna.processoImpressao'],
              coberturaTinta: erros['capaInterna.coberturaTinta'],
            }}
            disabled={disabled}
          />
        </Bloco>
      )}

      {blocos.principal && (
        <Bloco titulo="Suporte" testId="bloco-suporte-principal">
          <CamposSuporte
            bloco="principal"
            valor={value.principal}
            rotuloSuporte="Suporte"
            onChange={(p, c) => onChange('principal', p, c)}
            erro={erros['principal.suporteId']}
            suportesPermitidos={suportesPermitidos}
            disabled={disabled}
          />
        </Bloco>
      )}
    </Stack>
  )
}
