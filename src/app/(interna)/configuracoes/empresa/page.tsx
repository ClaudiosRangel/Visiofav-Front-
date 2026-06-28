'use client'

import { useEffect } from 'react'
import { Title, Text, Card, Stack, TextInput, Button, Group } from '@mantine/core'
import { IconBuilding } from '@tabler/icons-react'
import { useEmpresa } from '@/providers/EmpresaProvider'

export default function ConfigEmpresaPage() {
  useEffect(() => { document.title = 'Vizor - Configurações > Empresa' }, [])
  const { empresa } = useEmpresa()

  return (
    <div className="max-w-[800px] mx-auto">
      <div className="mb-8">
        <Title order={2} fw={700}>Dados da Empresa</Title>
        <Text size="sm" c="dimmed">Gerencie as informações cadastrais da empresa</Text>
      </div>

      <Card shadow="xs" radius="md" p="lg">
        <Stack gap="md">
          <TextInput label="Razão Social" defaultValue={empresa?.razaoSocial || ''} />
          <TextInput label="Nome Fantasia" defaultValue={empresa?.nomeFantasia || ''} />
          <TextInput label="CNPJ" defaultValue={empresa?.cnpj || ''} />
          <TextInput label="Endereço" placeholder="Rua, número, bairro, cidade - UF" />
          <Group justify="flex-end" mt="md">
            <Button>Salvar</Button>
          </Group>
        </Stack>
      </Card>
    </div>
  )
}
