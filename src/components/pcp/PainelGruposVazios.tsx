'use client'

import { useState } from 'react'
import { Box, Card, Stack, Group, Text, Badge, ActionIcon, Tooltip, Divider, UnstyledButton, Collapse } from '@mantine/core'
import { IconChevronDown, IconChevronRight, IconPlus } from '@tabler/icons-react'

interface CentroVazio {
  centro: { id: string; descricao: string }
}

interface Props {
  /** Centros já filtrados pelo caller (sem nenhuma etapa na fila). */
  centros: CentroVazio[]
  /** Abre o modal "Adicionar OS" para o centro clicado — mesma ação do botão "+" já usado nos grupos com fila. */
  abrirAdicionarOS: (centroId: string, centroDescricao: string) => void
}

/**
 * Painel "Grupos sem OS na fila" — compartilhado entre o Modelo 1 (Grid) e o
 * Modelo 2 (Detalhado) do painel de Programação, para exibir no mesmo
 * formato visual os centros de produção que não têm nenhuma etapa
 * pendente/em andamento/pausada no momento.
 *
 * Componente isolado propositalmente: recebe a lista já filtrada via prop,
 * sem depender de nenhum estado/lógica interna dos dois layouts — assim
 * pode ser plugado em ambos sem alterar o comportamento existente de
 * nenhum dos dois.
 */
export default function PainelGruposVazios({ centros, abrirAdicionarOS }: Props) {
  const [abertos, setAbertos] = useState<Record<string, boolean>>({})

  if (centros.length === 0) return null

  return (
    <Card withBorder padding={0}>
      <Group justify="space-between" px="md" py="sm">
        <Text size="sm" fw={700} c="dimmed">GRUPOS SEM OS NA FILA</Text>
        <Badge color="gray" variant="light">{centros.length}</Badge>
      </Group>
      <Divider />
      <Stack gap={0}>
        {centros.map(({ centro }) => {
          const aberto = !!abertos[centro.id]
          return (
            <Box key={centro.id}>
              <Group justify="space-between" px="md" py={8} wrap="nowrap" style={{ borderBottom: '1px solid var(--mantine-color-gray-1)' }}>
                <UnstyledButton
                  onClick={() => setAbertos((prev) => ({ ...prev, [centro.id]: !prev[centro.id] }))}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}
                >
                  {aberto ? <IconChevronDown size={14} color="var(--mantine-color-teal-6)" /> : <IconChevronRight size={14} color="var(--mantine-color-teal-6)" />}
                  <Text size="sm" fw={600} c="teal" truncate>{centro.descricao}</Text>
                </UnstyledButton>
                <Group gap={8} wrap="nowrap">
                  <Badge color="gray" variant="light" size="sm">0 PENDENTES</Badge>
                  <Tooltip label="Adicionar OS a este grupo">
                    <ActionIcon color="teal" variant="light" size="sm" onClick={() => abrirAdicionarOS(centro.id, centro.descricao)}><IconPlus size={14} /></ActionIcon>
                  </Tooltip>
                </Group>
              </Group>
              <Collapse in={aberto}>
                <Text size="sm" c="dimmed" ta="center" py="md">Nenhuma OP na fila</Text>
              </Collapse>
            </Box>
          )
        })}
      </Stack>
    </Card>
  )
}
