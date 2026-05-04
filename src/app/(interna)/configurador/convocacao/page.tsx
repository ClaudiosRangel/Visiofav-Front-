'use client'

import { Card, Text, Table, Badge, Group, Button, Switch } from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'

const mockData = [
  { id: '1', operacao: 'Endereçamento', prioridade: 1, ativo: true, autoConvocar: true },
  { id: '2', operacao: 'Separação', prioridade: 2, ativo: true, autoConvocar: true },
  { id: '3', operacao: 'Reposição de Picking', prioridade: 3, ativo: true, autoConvocar: false },
  { id: '4', operacao: 'Conferência', prioridade: 4, ativo: true, autoConvocar: true },
  { id: '5', operacao: 'Inventário', prioridade: 5, ativo: false, autoConvocar: false },
  { id: '6', operacao: 'Transferência', prioridade: 6, ativo: true, autoConvocar: false },
]

export default function ConvocacaoPage() {
  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>Início / Configurador / Convocação Ativa</Text>
      <Text size="xl" fw={600} mb="lg">Convocação Ativa</Text>

      <Card>
        <Group justify="space-between" mb="md">
          <Text size="sm" c="dimmed">Configure a prioridade e convocação automática de operações</Text>
          <Button variant="default" leftSection={<IconRefresh size={16} />}>Atualizar</Button>
        </Group>
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Prioridade</Table.Th>
              <Table.Th>Operação</Table.Th>
              <Table.Th>Ativo</Table.Th>
              <Table.Th>Auto Convocar</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {mockData.map((item) => (
              <Table.Tr key={item.id}>
                <Table.Td><Badge color="primary" variant="light" size="lg">{item.prioridade}</Badge></Table.Td>
                <Table.Td><Text fw={500}>{item.operacao}</Text></Table.Td>
                <Table.Td><Switch checked={item.ativo} readOnly color="primary" /></Table.Td>
                <Table.Td><Switch checked={item.autoConvocar} readOnly color="primary" /></Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Card>
    </div>
  )
}
