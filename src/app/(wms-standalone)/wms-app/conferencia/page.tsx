'use client'
import { useEffect } from 'react'
import { Text } from '@mantine/core'
export default function Page() {
  useEffect(() => { document.title = 'Vizor WMS - Conferência' }, [])
  return (<div><Text size="xs" c="dimmed" mb={4}>WMS / Conferência</Text><Text size="xl" fw={600} mb="lg">Conferência de Entrada</Text><Text c="dimmed">Funcionalidade em desenvolvimento para o modo standalone.</Text></div>)
}
