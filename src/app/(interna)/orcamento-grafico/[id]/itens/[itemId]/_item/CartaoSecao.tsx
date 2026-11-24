'use client'

/**
 * CartaoSecao — cartão padrão das seções da tela do item e da gaveta do plano: faixa de cabeçalho
 * (ícone, título em caixa alta, contador opcional e área à direita) e corpo. Cores só por tokens do
 * tema (claro e escuro).
 */

import type { ReactNode } from 'react'
import { Badge, Box, Group, Paper, Text, ThemeIcon } from '@mantine/core'

export interface CartaoSecaoProps {
  titulo: string
  icone?: ReactNode
  /** Número ao lado do título (ex.: quantidade de planos). */
  contador?: number | null
  /** Conteúdo à direita do cabeçalho (botões, texto de apoio). */
  direita?: ReactNode
  /** Corpo sem padding (tabelas de borda a borda). */
  semPadding?: boolean
  /** `ponto`: cabeçalho leve, com um ponto na cor do tema no lugar do ícone (seções da gaveta do plano). */
  variante?: 'faixa' | 'ponto'
  children: ReactNode
  'data-testid'?: string
}

export default function CartaoSecao({
  titulo,
  icone,
  contador,
  direita,
  semPadding,
  variante = 'faixa',
  children,
  ...resto
}: CartaoSecaoProps) {
  const ponto = variante === 'ponto'
  return (
    <Paper withBorder radius="md" shadow="xs" style={{ overflow: 'hidden' }} data-testid={resto['data-testid']}>
      <Group
        justify="space-between"
        wrap="wrap"
        gap="sm"
        px="md"
        py={ponto ? 'xs' : 'sm'}
        bg={ponto ? undefined : 'var(--mantine-color-default-hover)'}
        style={{ borderBottom: '1px solid var(--mantine-color-default-border)' }}
      >
        <Group gap="xs" wrap="nowrap">
          {ponto ? (
            <Box w={8} h={8} style={{ borderRadius: '50%', background: 'var(--mantine-primary-color-filled)' }} />
          ) : (
            icone && (
              <ThemeIcon variant="light" size={26} radius="md">
                {icone}
              </ThemeIcon>
            )
          )}
          <Text size={ponto ? 'xs' : 'sm'} fw={700} tt="uppercase" style={{ letterSpacing: '0.04em' }}>
            {titulo}
          </Text>
          {contador != null && (
            <Badge size="sm" variant="light" radius="xl">
              {contador}
            </Badge>
          )}
        </Group>
        {direita}
      </Group>
      <Box p={semPadding ? 0 : 'md'}>{children}</Box>
    </Paper>
  )
}
