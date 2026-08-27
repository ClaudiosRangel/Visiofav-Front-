'use client'
import { useEffect } from 'react'
import { Text } from '@mantine/core'
export default function Page() {
  useEffect(() => { document.title = 'Vizor WMS - Movimentações' }, [])
  return (<div><Text size="xs" c="dimmed" mb={4}>WMS / Movimentações</Text><Text size="xl" fw={600} mb="lg">Log de Movimentações</Text><Text c="dimmed">Funcionalidade em desenvolvimento para o modo standalone.</Text></div>)
}
