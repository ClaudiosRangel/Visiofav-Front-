'use client'

// Req 8 (pcp-gantt-melhorias): unificação das telas de Gantt.
// Esta era a tela de Gantt LEGADA (tabela read-only duplicada). O Gantt oficial,
// rico e editável, é `/pcp/gantt`. Para não quebrar links/menu externos, esta
// rota agora apenas REDIRECIONA para `/pcp/gantt`.
//
// Usamos `router.replace` num Client Component (em vez do `redirect()` de
// servidor) porque a página é `'use client'` — o replace é seguro e não quebra
// o build do Next App Router.

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Center, Loader, Stack, Text } from '@mantine/core'

export default function GanttLegadoRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/pcp/gantt')
  }, [router])

  return (
    <Center h="calc(100vh - 80px)">
      <Stack align="center" gap="sm">
        <Loader size="lg" />
        <Text c="dimmed" size="sm">Redirecionando para o Gantt de Produção…</Text>
      </Stack>
    </Center>
  )
}
