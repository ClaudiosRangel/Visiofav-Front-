'use client'

/**
 * PainelSelecoesNaoGravadas — lista as escolhas de material que não foram gravadas no
 * passe de seleções (spec orcamento-grafico-fase3-produto-embalagem, Req 10.2 e 10.4).
 *
 * Mostra, por atividade, a mensagem da API (ou aviso de tempo esgotado) e o indicador
 * "não gravada". Oferece "Tentar novamente" (reenvia só as não gravadas) e permite
 * trocar ou remover a escolha antes de repetir. Só tokens adaptativos do Mantine.
 */

import { Alert, Badge, Button, Group, Stack, Text } from '@mantine/core'
import { IconAlertTriangle, IconRefresh } from '@tabler/icons-react'

import type { FalhaSelecao } from './passe-selecao-puro'

interface Props {
  falhas: ReadonlyArray<FalhaSelecao>
  /** Reenvia somente as seleções não gravadas. */
  onTentarNovamente: () => void
  /** Leva o usuário a escolher outro material para a atividade (chave = `acabamentoId|planoId`). */
  onTrocar?: (chave: string) => void
  /** Descarta a escolha não gravada da atividade. */
  onRemover?: (chave: string) => void
  /** Retentativa em andamento. */
  carregando?: boolean
}

export default function PainelSelecoesNaoGravadas({ falhas, onTentarNovamente, onTrocar, onRemover, carregando }: Props) {
  if (falhas.length === 0) return null

  const total = falhas.length
  const titulo =
    total === 1
      ? 'O item foi salvo, mas 1 escolha de material não foi gravada'
      : `O item foi salvo, mas ${total} escolhas de material não foram gravadas`

  return (
    <Alert
      color="red"
      variant="light"
      title={titulo}
      icon={<IconAlertTriangle size={18} />}
      data-testid="painel-selecoes-nao-gravadas"
    >
      <Stack gap="xs">
        {falhas.map((f) => (
          <Group
            key={f.chave}
            justify="space-between"
            align="flex-start"
            wrap="nowrap"
            gap="sm"
            p="xs"
            style={{
              border: '1px solid var(--mantine-color-default-border)',
              borderRadius: 'var(--mantine-radius-sm)',
              background: 'var(--mantine-color-body)',
            }}
          >
            <Stack gap={2} style={{ minWidth: 0 }}>
              <Group gap="xs">
                <Text size="sm" fw={600}>
                  {f.atividadeNome}
                </Text>
                <Badge size="xs" color="red" variant="light">
                  não gravada
                </Badge>
              </Group>
              <Text size="xs" c="dimmed">
                {f.mensagem}
              </Text>
            </Stack>
            <Group gap="xs" wrap="nowrap">
              {onTrocar && (
                <Button size="compact-xs" variant="default" disabled={carregando} onClick={() => onTrocar(f.chave)}>
                  Trocar escolha
                </Button>
              )}
              {onRemover && (
                <Button
                  size="compact-xs"
                  variant="subtle"
                  color="red"
                  disabled={carregando}
                  onClick={() => onRemover(f.chave)}
                >
                  Remover escolha
                </Button>
              )}
            </Group>
          </Group>
        ))}
        <Group justify="flex-end">
          <Button
            size="xs"
            color="red"
            leftSection={<IconRefresh size={14} />}
            loading={carregando}
            onClick={onTentarNovamente}
          >
            Tentar novamente
          </Button>
        </Group>
      </Stack>
    </Alert>
  )
}
