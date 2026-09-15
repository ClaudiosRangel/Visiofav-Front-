'use client'

import { useEffect } from 'react'
import { Tabs, Title, Stack, Text } from '@mantine/core'
import { IconListTree, IconBook, IconScale, IconFileExport } from '@tabler/icons-react'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { PlanoContasTab } from './PlanoContasTab'
import { LancamentosTab } from './LancamentosTab'
import { BalanceteTab } from './BalanceteTab'
import { ExportacaoTab } from './ExportacaoTab'

export default function ContabilPage() {
  useModuloGuard('FINANCEIRO')
  useEffect(() => { document.title = 'Vizor - Financeiro - Contabilidade' }, [])

  return (
    <Stack>
      <div>
        <Text size="xs" c="dimmed">Início / Financeiro / Contabilidade</Text>
        <Title order={3}>Contabilidade</Title>
        <Text size="sm" c="dimmed">Plano de contas, lançamentos em partidas dobradas, balancete e exportação (ECD/CSV).</Text>
      </div>

      <Tabs defaultValue="plano">
        <Tabs.List>
          <Tabs.Tab value="plano" leftSection={<IconListTree size={16} />}>Plano de Contas</Tabs.Tab>
          <Tabs.Tab value="lancamentos" leftSection={<IconBook size={16} />}>Lançamentos</Tabs.Tab>
          <Tabs.Tab value="balancete" leftSection={<IconScale size={16} />}>Balancete</Tabs.Tab>
          <Tabs.Tab value="exportacao" leftSection={<IconFileExport size={16} />}>Exportação</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="plano" pt="md"><PlanoContasTab /></Tabs.Panel>
        <Tabs.Panel value="lancamentos" pt="md"><LancamentosTab /></Tabs.Panel>
        <Tabs.Panel value="balancete" pt="md"><BalanceteTab /></Tabs.Panel>
        <Tabs.Panel value="exportacao" pt="md"><ExportacaoTab /></Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
