'use client'

import { useEffect, useState } from 'react'
import { Title, Text, Card, Stack, TextInput, Switch, Button, Group, NumberInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'

export default function ConfigEmailPage() {
  useEffect(() => { document.title = 'Vizor - Configurações > Email/SMTP' }, [])

  const [testando, setTestando] = useState(false)

  function handleTestar() {
    setTestando(true)
    setTimeout(() => {
      notifications.show({ title: 'Teste', message: 'Email de teste enviado (simulação)', color: 'green' })
      setTestando(false)
    }, 1500)
  }

  return (
    <div className="max-w-[800px] mx-auto">
      <div className="mb-8">
        <Title order={2} fw={700}>Email / SMTP</Title>
        <Text size="sm" c="dimmed">Configure o servidor de email para notificações e suporte</Text>
      </div>

      <Card shadow="xs" radius="md" p="lg">
        <Stack gap="md">
          <TextInput label="Host SMTP" placeholder="smtp.gmail.com" />
          <NumberInput label="Porta" defaultValue={587} />
          <TextInput label="Usuário" placeholder="seu-email@dominio.com" />
          <TextInput label="Senha" type="password" placeholder="••••••••" />
          <Switch label="Usar TLS" defaultChecked />
          <TextInput label="Email de Suporte" defaultValue="suporte@vizorerp.com.br" />
          <Group justify="space-between" mt="md">
            <Button variant="light" onClick={handleTestar} loading={testando}>Enviar Email de Teste</Button>
            <Button>Salvar</Button>
          </Group>
        </Stack>
      </Card>
    </div>
  )
}
