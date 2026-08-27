'use client'
import { useEffect } from 'react'
import { Text } from '@mantine/core'
export default function Page() {
  useEffect(() => { document.title = 'Vizor WMS - Carregamento' }, [])
  return (<div><Text size="xs" c="dimmed" mb={4}>WMS / Carregamento</Text><Text size="xl" fw={600} mb="lg">Carregamento</Text><Text c="dimmed">Funcionalidade em desenvolvimento para o modo standalone.</Text></div>)
}
