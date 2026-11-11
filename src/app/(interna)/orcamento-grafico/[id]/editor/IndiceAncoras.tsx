'use client'

/**
 * IndiceAncoras — índice de navegação por âncoras do Editor de Item do Orçamento
 * Gráfico (experiência Calcgraf).
 *
 * Feature: orcamento-grafico-experiencia-calcgraf (Tarefa 4.2)
 * _Requirements: 1.2, 1.3, 1.4, 4.4_
 *
 * - Lista exatamente as âncoras produzidas por `montarAncoras(item)` (fonte
 *   única; a âncora "Planos" só aparece quando o item tem planos — Req 5.2).
 * - Destaca a âncora ATIVA (seção visível) recebida do `useScrollSpy` (Req 1.4).
 * - Clique navega até a seção via `irPara` (scroll suave) (Req 1.3).
 * - Exibe, ao lado de cada seção, um marcador de STATUS (✓ ok / ⚠ erro / ○
 *   pendente) a partir de `statusPorAncora` (Req 4) — prop opcional/aditiva.
 * - Inclui a legenda `● copiado / ○ manual / ⚠ vazio` (Req 4.4), materializando
 *   a Tabela_De_Para_Puxar na própria tela.
 *
 * Componente de APRESENTAÇÃO puro (recebe âncora ativa + callback). Não observa
 * scroll por conta própria — isso é responsabilidade do `useScrollSpy`.
 */

import { NavLink, Paper, Stack, Text, Group, Box } from '@mantine/core'
import { IconCircleCheck, IconAlertTriangle, IconCircle } from '@tabler/icons-react'

import { ANCORA_LABEL, type AncoraId } from './ancoras'

/** Status de preenchimento de uma seção (Req 4). */
export type StatusAncora = 'ok' | 'pendente' | 'erro'

interface Props {
  /** Âncoras presentes (de `montarAncoras`), na ordem de renderização. */
  ancoras: AncoraId[]
  /** Âncora atualmente ativa (de `useScrollSpy`). */
  ativa: AncoraId | null
  /** Navega até a seção da âncora (de `useScrollSpy.irPara`). */
  onIrPara: (id: AncoraId) => void
  /**
   * Status de preenchimento por âncora (Req 4). Opcional e aditivo: quando
   * ausente (ou sem a chave de uma âncora), a seção é tratada como `pendente`
   * (marcador cinza neutro).
   */
  statusPorAncora?: Partial<Record<AncoraId, StatusAncora>>
}

/**
 * Marcador visual de status ao lado da seção (Req 4.2):
 *  - `ok`       → check verde (seção com os essenciais preenchidos);
 *  - `erro`     → triângulo de alerta vermelho (há erro de validação);
 *  - `pendente` → círculo cinza vazio (ainda falta preencher / sem status).
 */
function MarcadorStatus({ status }: { status: StatusAncora }) {
  if (status === 'ok') {
    return <IconCircleCheck size={16} color="var(--mantine-color-teal-6)" aria-label="Seção completa" />
  }
  if (status === 'erro') {
    return <IconAlertTriangle size={16} color="var(--mantine-color-red-6)" aria-label="Seção com erro" />
  }
  return <IconCircle size={16} color="var(--mantine-color-gray-5)" aria-label="Seção pendente" />
}

/** Item da legenda copiado/manual/vazio. */
function LegendaItem({ marcador, cor, texto }: { marcador: string; cor: string; texto: string }) {
  return (
    <Group gap={6} wrap="nowrap">
      <Text span fw={700} c={cor} style={{ width: 14, textAlign: 'center' }}>
        {marcador}
      </Text>
      <Text span size="xs" c="dimmed">
        {texto}
      </Text>
    </Group>
  )
}

export default function IndiceAncoras({ ancoras, ativa, onIrPara, statusPorAncora }: Props) {
  return (
    <Paper withBorder p="sm" component="nav" aria-label="Seções do item">
      <Stack gap="xs">
        <Text size="xs" fw={700} c="dimmed" tt="uppercase">
          Seções
        </Text>

        <Stack gap={2}>
          {ancoras.map((id) => (
            <NavLink
              key={id}
              component="button"
              type="button"
              label={ANCORA_LABEL[id]}
              active={ativa === id}
              onClick={() => onIrPara(id)}
              rightSection={<MarcadorStatus status={statusPorAncora?.[id] ?? 'pendente'} />}
            />
          ))}
        </Stack>

        <Box mt="xs">
          <Text size="xs" fw={700} c="dimmed" tt="uppercase" mb={4}>
            Legenda
          </Text>
          <Stack gap={2}>
            <LegendaItem marcador="●" cor="green" texto="copiado do cálculo" />
            <LegendaItem marcador="○" cor="gray" texto="preenchido manualmente" />
            <LegendaItem marcador="⚠" cor="yellow" texto="vazio (completar)" />
          </Stack>
        </Box>
      </Stack>
    </Paper>
  )
}
