'use client'

import { Card, Group, Text, SimpleGrid, ThemeIcon, Table, Badge, Button } from '@mantine/core'
import { IconClipboardCheck, IconAlertCircle, IconCheck, IconPlus } from '@tabler/icons-react'

const stats = [
  { title: 'Inventários Abertos', value: '2', icon: IconClipboardCheck, color: 'orange' },
  { title: 'Divergências', value: '15', icon: IconAlertCircle, color: 'red' },
  { title: 'Concluídos este mês', value: '3', icon: IconCheck, color: 'green' },
]

const inventarios = [
  { id: '1', numero: 101, tipo: 'GERAL', dataInicio: '25/04/2026', enderecos: 120, contados: 85, divergencias: 8, status: 'EM_ANDAMENTO' },
  { id: '2', numero: 102, tipo: 'ROTATIVO', dataInicio: '27/04/2026', enderecos: 30, contados: 10, divergencias: 2, status: 'EM_ANDAMENTO' },
  { id: '3', numero: 100, tipo: 'ROTATIVO', dataInicio: '20/04/2026', enderecos: 50, contados: 50, divergencias: 5, status: 'CONCLUIDO' },
]

const statusColor: Record<string, string> = { EM_ANDAMENTO: 'blue', CONCLUIDO: 'green', CANCELADO: 'red' }

export default function InventarioPage() {
  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Inventário</Text>
      <Text size="xl" fw={600} mb="lg">Inventário</Text>

      <SimpleGrid cols={{ base: 1, sm: 3 }} mb="xl">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>{stat.title}</Text>
                <Text size="xl" fw={700} mt={4}>{stat.value}</Text>
              </div>
              <ThemeIcon color={stat.color} variant="light" size={48} radius="md"><stat.icon size={24} /></ThemeIcon>
            </Group>
          </Card>
        ))}
      </SimpleGrid>

      <Card>
        <Group justify="space-between" mb="md">
          <Text fw={600}>Inventários</Text>
          <Button leftSection={<IconPlus size={16} />}>Novo Inventário</Button>
        </Group>

        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Número</Table.Th>
              <Table.Th>Tipo</Table.Th>
              <Table.Th>Data Início</Table.Th>
              <Table.Th>Endereços</Table.Th>
              <Table.Th>Contados</Table.Th>
              <Table.Th>Divergências</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {inventarios.map((item) => (
              <Table.Tr key={item.id}>
                <Table.Td><Text fw={600}>#{item.numero}</Text></Table.Td>
                <Table.Td><Badge color="primary" variant="light">{item.tipo}</Badge></Table.Td>
                <Table.Td>{item.dataInicio}</Table.Td>
                <Table.Td>{item.enderecos}</Table.Td>
                <Table.Td>{item.contados} / {item.enderecos}</Table.Td>
                <Table.Td><Text c={item.divergencias > 0 ? 'red' : 'green'} fw={600}>{item.divergencias}</Text></Table.Td>
                <Table.Td><Badge color={statusColor[item.status]} variant="light">{item.status.replace('_', ' ')}</Badge></Table.Td>
                <Table.Td><Button size="xs" variant="subtle" color="gray">Detalhes</Button></Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>
    </div>
  )
}
