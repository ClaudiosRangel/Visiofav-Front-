'use client'

import { useEffect, useState } from 'react'
import { Title, Text, Card, SimpleGrid, Tabs, Stack, Group, Badge, Button, Select, Center } from '@mantine/core'
import { IconFileText, IconDownload, IconClock, IconCalendar, IconPlus } from '@tabler/icons-react'

const RELATORIOS_PREDEFINIDOS = [
  { id: '1', nome: 'Estoque Atual', modulo: 'WMS', desc: 'Saldos por endereço e produto' },
  { id: '2', nome: 'Movimentações', modulo: 'WMS', desc: 'Entradas, saídas e transferências' },
  { id: '3', nome: 'Vendas por Período', modulo: 'Vendas', desc: 'Vendas efetivadas com totais' },
  { id: '4', nome: 'Comissões', modulo: 'Vendas', desc: 'Comissões por vendedor' },
  { id: '5', nome: 'Contas a Pagar', modulo: 'Financeiro', desc: 'Títulos em aberto e vencidos' },
  { id: '6', nome: 'Contas a Receber', modulo: 'Financeiro', desc: 'Recebíveis por vencimento' },
  { id: '7', nome: 'Produção por Centro', modulo: 'PCP', desc: 'Ordens por centro de produção' },
  { id: '8', nome: 'NF-e Emitidas', modulo: 'Fiscal', desc: 'Notas fiscais emitidas no período' },
]

export default function RelatoriosPage() {
  useEffect(() => { document.title = 'Vizor - Relatórios' }, [])

  const [tab, setTab] = useState<string | null>('catalogo')

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <Title order={2} fw={700}>Relatórios</Title>
          <Text size="sm" c="dimmed">Central unificada de relatórios de todos os módulos</Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} size="xs" variant="light">
          Novo Personalizado
        </Button>
      </div>

      <Tabs value={tab} onChange={setTab}>
        <Tabs.List mb="lg">
          <Tabs.Tab value="catalogo" leftSection={<IconFileText size={14} />}>Catálogo</Tabs.Tab>
          <Tabs.Tab value="historico" leftSection={<IconClock size={14} />}>Histórico</Tabs.Tab>
          <Tabs.Tab value="agendamentos" leftSection={<IconCalendar size={14} />}>Agendamentos</Tabs.Tab>
        </Tabs.List>

        {/* Catálogo */}
        <Tabs.Panel value="catalogo">
          <Group gap="sm" mb="md">
            <Select placeholder="Filtrar por módulo" data={['WMS', 'Vendas', 'Compras', 'Financeiro', 'PCP', 'Fiscal']} clearable size="xs" />
          </Group>
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="md">
            {RELATORIOS_PREDEFINIDOS.map(rel => (
              <Card key={rel.id} shadow="xs" radius="md" p="md" className="hover:shadow-md transition-shadow">
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm" fw={600}>{rel.nome}</Text>
                    <Badge size="xs" variant="light">{rel.modulo}</Badge>
                  </Group>
                  <Text size="xs" c="dimmed">{rel.desc}</Text>
                  <Group gap="xs" mt="xs">
                    <Button size="xs" variant="light" leftSection={<IconDownload size={12} />}>PDF</Button>
                    <Button size="xs" variant="subtle" leftSection={<IconDownload size={12} />}>Excel</Button>
                    <Button size="xs" variant="subtle" leftSection={<IconDownload size={12} />}>CSV</Button>
                  </Group>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        </Tabs.Panel>

        {/* Histórico */}
        <Tabs.Panel value="historico">
          <Card shadow="xs" radius="md" p="lg">
            <Center py="xl">
              <Stack align="center" gap="sm">
                <IconClock size={48} className="text-gray-300" />
                <Text c="dimmed">Histórico de execuções será exibido aqui</Text>
              </Stack>
            </Center>
          </Card>
        </Tabs.Panel>

        {/* Agendamentos */}
        <Tabs.Panel value="agendamentos">
          <Card shadow="xs" radius="md" p="lg">
            <Center py="xl">
              <Stack align="center" gap="sm">
                <IconCalendar size={48} className="text-gray-300" />
                <Text c="dimmed">Configure envios automáticos de relatórios por email</Text>
                <Button variant="light" size="xs">Criar Agendamento</Button>
              </Stack>
            </Center>
          </Card>
        </Tabs.Panel>
      </Tabs>
    </div>
  )
}
