'use client'
import { useEffect } from 'react'
import { Text } from '@mantine/core'
export default function Page() {
  useEffect(() => { document.title = 'Vizor WMS - KPIs' }, [])
  return (<div><Text size="xs" c="dimmed" mb={4}>WMS / KPIs</Text><Text size="xl" fw={600} mb="lg">KPIs Operacionais</Text><Text c="dimmed">Funcionalidade em desenvolvimento para o modo standalone.</Text></div>)
}
