'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { IconGripVertical } from '@tabler/icons-react'
import { Group, Box } from '@mantine/core'
import { ReactNode } from 'react'

interface SortableCentroItemProps {
  id: string
  children: ReactNode
}

export function SortableCentroItem({ id, children }: SortableCentroItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || undefined,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <Box ref={setNodeRef} style={style} {...attributes}>
      <Group gap="xs" wrap="nowrap" align="flex-start">
        <Box style={{ cursor: 'grab', paddingTop: 8 }} {...listeners}>
          <IconGripVertical size={18} color="gray" />
        </Box>
        <Box style={{ flex: 1 }}>
          {children}
        </Box>
      </Group>
    </Box>
  )
}
