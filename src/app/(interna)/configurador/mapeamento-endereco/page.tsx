'use client'

import { Card, Text, Table, Badge, Group, Button } from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'

const mockData = [
  { id: '1', zona: 'Zona A', deposito: 'Depósito Principal', totalEnderecos: 120, ocupados: 85, livres: 30, bloqueados: 5 },
  { id: '2', zona: 'Zona B', deposito: 'Depósito Principal', totalEnderecos: 80, ocupados: 45, livres: 32, bloqueados: 3 },
  { id: '3', zona: 'Zona C', deposito: 'Depósito Seco', totalEnderecos: 60, ocupados: 55, livres: 3, bloqueados: 2 },
]

export default function MapeamentoEnderecoPage() {
  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Configurador / Mapeamento de Endereço</Text>
      <Text size="xl" fw={600} mb="lg">Mapeamento de Endereço</Text>
      <Card>
        <Group justify="space-between" mb="md">
          <Text size="sm" c="dimmed">Visão geral da ocupação por zona e depósito</Text>
          <Button variant="default" leftSection={<IconRefresh size={16} />}>Atualizar</Button>
        </Group>
        <Table striped highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th>Zona</Table.Th><Table.Th>Depósito</Table.Th><Table.Th>Total</Table.Th><Table.Th>Ocupados</Table.Th><Table.Th>Livres</Table.Th><Table.Th>Bloqueados</Table.Th><Table.Th>Ocupação</Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>{mockData.map((item) => {
            const perc = Math.round((item.ocupados / item.totalEnderecos) * 100)
            return (
              <Table.Tr key={item.id}>
                <Table.Td><Text fw={500}>{item.zona}</Text></Table.Td>
                <Table.Td>{item.deposito}</Table.Td>
                <Table.Td>{item.totalEnderecos}</Table.Td>
                <Table.Td><Badge color="blue" variant="light">{item.ocupados}</Badge></Table.Td>
                <Table.Td><Badge color="green" variant="light">{item.livres}</Badge></Table.Td>
                <Table.Td><Badge color="red" variant="light">{item.bloqueados}</Badge></Table.Td>
                <Table.Td><Badge color={perc > 90 ? 'red' : perc > 70 ? 'orange' : 'green'} variant="light">{perc}%</Badge></Table.Td>
              </Table.Tr>
            )
          })}</Table.Tbody>
        </Table>
      </Card>
    </div>
  )
}
