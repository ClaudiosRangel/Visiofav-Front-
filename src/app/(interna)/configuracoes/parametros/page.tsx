'use client'

import { useEffect } from 'react'
import { Title, Text, Card, Stack, Select, Group, Button } from '@mantine/core'

export default function ConfigParametrosPage() {
  useEffect(() => { document.title = 'Vizor - Configurações > Parâmetros' }, [])

  return (
    <div className="max-w-[800px] mx-auto">
      <div className="mb-8">
        <Title order={2} fw={700}>Parâmetros Gerais</Title>
        <Text size="sm" c="dimmed">Configurações globais do sistema</Text>
      </div>

      <Card shadow="xs" radius="md" p="lg">
        <Stack gap="md">
          <Select label="Moeda" defaultValue="BRL" data={['BRL', 'USD', 'EUR']} />
          <Select label="Fuso Horário" defaultValue="America/Sao_Paulo" data={['America/Sao_Paulo', 'America/Manaus', 'America/Bahia']} />
          <Select label="Formato de Data" defaultValue="DD/MM/YYYY" data={['DD/MM/YYYY', 'YYYY-MM-DD', 'MM/DD/YYYY']} />
          <Select label="Casas Decimais" defaultValue="2" data={['0', '1', '2', '3', '4']} />
          <Group justify="flex-end" mt="md">
            <Button>Salvar</Button>
          </Group>
        </Stack>
      </Card>
    </div>
  )
}
