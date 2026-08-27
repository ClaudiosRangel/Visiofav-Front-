'use client'
import { useEffect } from 'react'
import { Text } from '@mantine/core'
export default function Page() {
  useEffect(() => { document.title = 'Vizor WMS - Endereçamento' }, [])
  return (<div><Text size="xs" c="dimmed" mb={4}>WMS / Endereçamento</Text><Text size="xl" fw={600} mb="lg">Endereçamento</Text><Text c="dimmed">Funcionalidade em desenvolvimento para o modo standalone.</Text></div>)
}
