'use client'
import { useEffect } from 'react'
import { Text } from '@mantine/core'
export default function Page() {
  useEffect(() => { document.title = 'Vizor WMS - Conferência de Saída' }, [])
  return (<div><Text size="xs" c="dimmed" mb={4}>WMS / Conferência de Saída</Text><Text size="xl" fw={600} mb="lg">Conferência de Saída</Text><Text c="dimmed">Funcionalidade em desenvolvimento para o modo standalone.</Text></div>)
}
