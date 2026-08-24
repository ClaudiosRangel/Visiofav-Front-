'use client'

import { Center, Stack, Text, ThemeIcon } from '@mantine/core'
import { IconInbox } from '@tabler/icons-react'

interface EmptyStateProps {
  icon?: React.ElementType
  title: string
  description?: string
}

/**
 * Estado vazio genérico para listas sem dados.
 * Exibe ícone centralizado + título + descrição opcional.
 */
export function EmptyState({ icon: Icon = IconInbox, title, description }: EmptyStateProps) {
  return (
    <Center py="xl">
      <Stack align="center" gap="xs">
        <ThemeIcon variant="light" color="gray" size={48} radius="xl">
          <Icon size={28} stroke={1.5} />
        </ThemeIcon>
        <Text fw={500} c="gray.7" ta="center">
          {title}
        </Text>
        {description && (
          <Text size="sm" c="gray.5" ta="center" maw={300}>
            {description}
          </Text>
        )}
      </Stack>
    </Center>
  )
}
