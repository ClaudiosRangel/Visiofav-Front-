'use client'

/**
 * SugestaoItensDiversos — bloco "Sugeridos pelo plano" da seção Itens Complementares.
 *
 * Lista os itens diversos automáticos do plano que ainda não estão no item
 * (dedupe por descrição normalizada, feito em `sugerirItensDiversos`). Nunca
 * adiciona sozinho: só quando o usuário clica em "Adicionar" ou "Adicionar todos".
 * Linhas sem custo cadastrado ficam marcadas para o usuário informar o valor.
 * Só renderiza quando há sugestões.
 */

import { useMemo } from 'react'
import { Badge, Button, Group, Paper, Stack, Text } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { sugerirItensDiversos, type SugestaoItemDiverso } from './catalogo-puro'
import type { CatalogoDoItem } from './catalogo.types'

type ItemForm = { descricao: string; quantidade: number; valor: number; fixo: boolean }

interface Props {
  catalogo?: CatalogoDoItem | null
  itensAtuais: ReadonlyArray<{ descricao?: string | null }> | undefined
  onAdicionar: (novos: ItemForm[]) => void
}

function paraItemForm(s: SugestaoItemDiverso): ItemForm {
  return { descricao: s.descricao, quantidade: s.quantidade, valor: s.valor, fixo: s.fixo }
}

export default function SugestaoItensDiversos({ catalogo, itensAtuais, onAdicionar }: Props) {
  const sugestoes = useMemo(
    () => sugerirItensDiversos(catalogo?.planoFixo?.itensDiversosAutomaticos, itensAtuais),
    [catalogo, itensAtuais],
  )

  if (!catalogo || sugestoes.length === 0) return null

  return (
    <Paper withBorder p="sm" radius="md" bg="var(--mantine-color-default)" mb="md">
      <Group justify="space-between" mb="xs" wrap="nowrap">
        <Text fw={600} size="sm">
          Sugeridos pelo plano
        </Text>
        <Button
          size="xs"
          variant="light"
          leftSection={<IconPlus size={14} />}
          onClick={() => onAdicionar(sugestoes.map(paraItemForm))}
        >
          Adicionar todos
        </Button>
      </Group>
      <Stack gap={6}>
        {sugestoes.map((s) => (
          <Group key={s.origemId} justify="space-between" wrap="nowrap">
            <Group gap="xs" wrap="wrap">
              <Text size="sm">{s.descricao}</Text>
              <Text size="xs" c="dimmed">
                qtd {s.quantidade}
                {s.fixo ? ' (fixo)' : ''}
              </Text>
              {s.semCusto && (
                <Badge size="xs" variant="light" color="orange">
                  Sem custo cadastrado
                </Badge>
              )}
            </Group>
            <Button size="compact-xs" variant="default" onClick={() => onAdicionar([paraItemForm(s)])}>
              Adicionar
            </Button>
          </Group>
        ))}
      </Stack>
    </Paper>
  )
}
