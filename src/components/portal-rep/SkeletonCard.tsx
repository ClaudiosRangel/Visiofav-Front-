'use client'

import { Card, Skeleton, Stack } from '@mantine/core'

interface SkeletonCardProps {
  lines?: number
}

/**
 * Skeleton animado simulando um card sendo carregado.
 * A primeira linha é mais alta (simula título), as demais são menores (corpo).
 */
export function SkeletonCard({ lines = 3 }: SkeletonCardProps) {
  return (
    <Card>
      <Stack gap="sm">
        {Array.from({ length: lines }, (_, i) => (
          <Skeleton
            key={i}
            height={i === 0 ? 20 : 14}
            width={i === lines - 1 ? '60%' : '100%'}
            radius="sm"
          />
        ))}
      </Stack>
    </Card>
  )
}
