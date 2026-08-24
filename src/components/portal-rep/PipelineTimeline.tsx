'use client'

import { Group, Text, ThemeIcon } from '@mantine/core'
import {
  IconFileInvoice,
  IconReceipt,
  IconAssembly,
  IconSettings,
  IconTruck,
  IconCheck,
} from '@tabler/icons-react'
import type { StatusPedido } from '@/data/hooks/portal-rep-app/types'

interface PipelineTimelineProps {
  statusAtual: StatusPedido
  compacto?: boolean
  datas?: Record<string, string | null>
}

const STAGES: { status: StatusPedido; label: string; icon: typeof IconCheck }[] = [
  { status: 'ORCAMENTO', label: 'Orçamento', icon: IconFileInvoice },
  { status: 'PV', label: 'PV', icon: IconReceipt },
  { status: 'OP', label: 'OP', icon: IconAssembly },
  { status: 'PRODUCAO', label: 'Produção', icon: IconSettings },
  { status: 'EXPEDICAO', label: 'Expedição', icon: IconTruck },
  { status: 'ENTREGUE', label: 'Entregue', icon: IconCheck },
]

const STATUS_ORDER: StatusPedido[] = [
  'ORCAMENTO',
  'PV',
  'OP',
  'PRODUCAO',
  'EXPEDICAO',
  'ENTREGUE',
]

function getStageState(
  stageStatus: StatusPedido,
  currentStatus: StatusPedido
): 'completed' | 'current' | 'future' {
  const stageIndex = STATUS_ORDER.indexOf(stageStatus)
  const currentIndex = STATUS_ORDER.indexOf(currentStatus)

  if (stageIndex < currentIndex) return 'completed'
  if (stageIndex === currentIndex) return 'current'
  return 'future'
}

export function PipelineTimeline({
  statusAtual,
  compacto = false,
  datas,
}: PipelineTimelineProps) {
  const iconSize = compacto ? 20 : 28
  const themeIconSize = compacto ? 28 : 38

  return (
    <Group
      gap={0}
      wrap="nowrap"
      style={{ width: '100%', justifyContent: 'space-between' }}
    >
      {STAGES.map((stage, index) => {
        const state = getStageState(stage.status, statusAtual)
        const StageIcon = state === 'completed' ? IconCheck : stage.icon

        const color =
          state === 'current'
            ? 'green'
            : state === 'completed'
              ? 'green.3'
              : 'gray.4'

        const variant: 'filled' | 'light' | 'outline' =
          state === 'current'
            ? 'filled'
            : state === 'completed'
              ? 'light'
              : 'outline'

        const dateStr = datas?.[stage.status]

        return (
          <div
            key={stage.status}
            style={{
              display: 'flex',
              alignItems: 'center',
              flex: index < STAGES.length - 1 ? 1 : undefined,
            }}
          >
            {/* Stage icon + label */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                minWidth: compacto ? 28 : 48,
              }}
            >
              <ThemeIcon
                size={themeIconSize}
                radius="xl"
                variant={variant}
                color={color}
              >
                <StageIcon size={iconSize} stroke={1.5} />
              </ThemeIcon>

              {!compacto && (
                <Text
                  size="xs"
                  c={state === 'future' ? 'dimmed' : 'dark'}
                  ta="center"
                  mt={4}
                  fw={state === 'current' ? 600 : 400}
                  style={{ lineHeight: 1.2 }}
                >
                  {stage.label}
                </Text>
              )}

              {!compacto && dateStr && (
                <Text size="xs" c="dimmed" ta="center" mt={2}>
                  {dateStr}
                </Text>
              )}
            </div>

            {/* Connecting line */}
            {index < STAGES.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 2,
                  marginInline: compacto ? 2 : 6,
                  marginBottom: compacto ? 0 : (dateStr ? 32 : 20),
                  backgroundColor:
                    getStageState(STAGES[index + 1].status, statusAtual) !== 'future'
                      ? 'var(--mantine-color-green-3)'
                      : 'var(--mantine-color-gray-3)',
                  borderRadius: 1,
                }}
              />
            )}
          </div>
        )
      })}
    </Group>
  )
}
