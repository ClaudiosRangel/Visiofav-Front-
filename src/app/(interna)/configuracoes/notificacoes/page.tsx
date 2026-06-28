'use client'

import { useEffect } from 'react'
import { Title, Text, Card, Stack, Switch, Group, Button, Divider } from '@mantine/core'

export default function ConfigNotificacoesPage() {
  useEffect(() => { document.title = 'Vizor - Configurações > Notificações' }, [])

  return (
    <div className="max-w-[800px] mx-auto">
      <div className="mb-8">
        <Title order={2} fw={700}>Notificações</Title>
        <Text size="sm" c="dimmed">Configure quais alertas do sistema deseja ativar</Text>
      </div>

      <Card shadow="xs" radius="md" p="lg">
        <Stack gap="md">
          <Text size="sm" fw={600}>WMS</Text>
          <Switch label="Estoque mínimo atingido" defaultChecked />
          <Switch label="Nota fiscal rejeitada" defaultChecked />
          <Switch label="Conferência com divergência" defaultChecked />

          <Divider my="xs" />

          <Text size="sm" fw={600}>PCP</Text>
          <Switch label="Ordem de produção atrasada" defaultChecked />
          <Switch label="Material insuficiente" defaultChecked />

          <Divider my="xs" />

          <Text size="sm" fw={600}>Financeiro</Text>
          <Switch label="Conta a pagar vencendo" defaultChecked />
          <Switch label="Conta a receber em atraso" defaultChecked />

          <Group justify="flex-end" mt="md">
            <Button>Salvar</Button>
          </Group>
        </Stack>
      </Card>
    </div>
  )
}
