'use client'

import { useState } from 'react'
import { Card, Stack, Group, Text, Badge, ActionIcon, Tooltip, UnstyledButton, Collapse } from '@mantine/core'
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
 * Grupos/centros sem nenhuma OS na fila — compartilhado entre o Modelo 1
 * (Grid) e o Modelo 2 (Detalhado) do painel de Programação. Renderiza cada
 * centro vazio como um card individual, no MESMO formato dos cards de
 * grupo com fila (Card colapsável, nome do centro, badge de pendentes,
 * botão "+"), em vez de agrupar tudo dentro de um único card.
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
    <Stack gap="xs">
      {centros.map(({ centro }) => {
        const aberto = !!abertos[centro.id]
        return (
          <Card key={centro.id} withBorder padding="xs">
            <Group justify="space-between" py={4} px={8}>
              <Group gap="sm" style={{ flex: 1 }}>
                <UnstyledButton onClick={() => setAbertos((prev) => ({ ...prev, [centro.id]: !prev[centro.id] }))}>
                  {aberto ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                </UnstyledButton>
                <Text fw={700} c="teal">{centro.descricao}</Text>
              </Group>
              <Group gap="xs">
                <Badge color="gray" size="sm">0 pendentes</Badge>
                <Tooltip label="Adicionar OS a este grupo">
                  <ActionIcon color="teal" variant="light" size="sm" onClick={() => abrirAdicionarOS(centro.id, centro.descricao)}><IconPlus size={14} /></ActionIcon>
                </Tooltip>
              </Group>
            </Group>
            <Collapse in={aberto}>
              <Text size="sm" c="dimmed" ta="center" py="sm">Nenhuma OP na fila</Text>
            </Collapse>
          </Card>
        )
      })}
    </Stack>
  )
}
