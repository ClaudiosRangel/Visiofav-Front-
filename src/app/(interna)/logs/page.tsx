'use client'

import { useEffect, useState } from 'react'
import { Title, Text, Card, Tabs, Table, Badge, Group, Select, Stack, Center, Button } from '@mantine/core'
import { IconFileText, IconLogin, IconAlertTriangle, IconDownload } from '@tabler/icons-react'

export default function LogsPage() {
  useEffect(() => { document.title = 'Vizor - Logs' }, [])

  const [tab, setTab] = useState<string | null>('atividades')

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <Title order={2} fw={700}>Logs de Auditoria</Title>
          <Text size="sm" c="dimmed">Registro completo de ações realizadas no sistema</Text>
        </div>
        <Button variant="light" leftSection={<IconDownload size={16} />} size="xs">
          Exportar
        </Button>
      </div>

      <Tabs value={tab} onChange={setTab}>
        <Tabs.List mb="lg">
          <Tabs.Tab value="atividades" leftSection={<IconFileText size={14} />}>Atividades</Tabs.Tab>
          <Tabs.Tab value="sessoes" leftSection={<IconLogin size={14} />}>Sessões</Tabs.Tab>
          <Tabs.Tab value="criticos" leftSection={<IconAlertTriangle size={14} />}>Alterações Críticas</Tabs.Tab>
        </Tabs.List>

        {/* Atividades */}
        <Tabs.Panel value="atividades">
          <Card shadow="xs" radius="md" p="lg">
            {/* Filtros */}
            <Group gap="sm" mb="md">
              <Select placeholder="Módulo" data={['WMS', 'PCP', 'Vendas', 'Compras', 'Financeiro', 'Fiscal']} clearable size="xs" />
              <Select placeholder="Ação" data={['Criar', 'Editar', 'Excluir', 'Aprovar']} clearable size="xs" />
            </Group>

            <Center py="xl">
              <Stack align="center" gap="sm">
                <IconFileText size={48} className="text-gray-300" />
                <Text c="dimmed">Logs serão exibidos aqui após integração com a API</Text>
              </Stack>
            </Center>
          </Card>
        </Tabs.Panel>

        {/* Sessões */}
        <Tabs.Panel value="sessoes">
          <Card shadow="xs" radius="md" p="lg">
            <Center py="xl">
              <Stack align="center" gap="sm">
                <IconLogin size={48} className="text-gray-300" />
                <Text c="dimmed">Histórico de login/logout será exibido aqui</Text>
              </Stack>
            </Center>
          </Card>
        </Tabs.Panel>

        {/* Alterações Críticas */}
        <Tabs.Panel value="criticos">
          <Card shadow="xs" radius="md" p="lg">
            <Center py="xl">
              <Stack align="center" gap="sm">
                <IconAlertTriangle size={48} className="text-gray-300" />
                <Text c="dimmed">Alterações críticas (preço, estoque, permissões) serão destacadas aqui</Text>
              </Stack>
            </Center>
          </Card>
        </Tabs.Panel>
      </Tabs>
    </div>
  )
}
