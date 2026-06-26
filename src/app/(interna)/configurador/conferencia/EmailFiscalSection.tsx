'use client'

import { useEffect, useState } from 'react'
import { Card, TextInput, Button, Stack, Group, Text, Divider } from '@mantine/core'
import { IconMail } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useConfigEmailFiscal, useSalvarConfigEmailFiscal } from '@/data/hooks/useConfigEmailFiscal'

export function EmailFiscalSection({ inline }: { inline?: boolean }) {
  const { data: config, isLoading } = useConfigEmailFiscal()
  const salvar = useSalvarConfigEmailFiscal()

  const [email, setEmail] = useState('')

  useEffect(() => {
    if (config) {
      setEmail(config.email || '')
    }
  }, [config])

  async function handleSalvar() {
    try {
      await salvar.mutateAsync({ email })
      notifications.show({ title: 'Sucesso', message: 'E-mail fiscal salvo', color: 'green' })
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message
        || err?.response?.data?.message
        || 'Erro ao salvar e-mail fiscal'
      notifications.show({ title: 'Erro', message: msg, color: 'red' })
    }
  }

  if (isLoading) return null

  const content = (
    <Stack gap="md">
      <Group gap="sm">
        <IconMail size={20} className="text-teal-600" />
        <Text fw={500}>E-mail do Setor Fiscal</Text>
      </Group>
      <Text size="xs" c="dimmed">
        Endereço de e-mail que receberá notificações de divergência quando não houver integração ativa.
      </Text>

      <TextInput
        label="E-mail"
        placeholder="fiscal@empresa.com.br"
        maxLength={254}
        value={email}
        onChange={(e) => setEmail(e.currentTarget.value)}
      />

      <Button
        onClick={handleSalvar}
        loading={salvar.isPending}
        color="teal"
      >
        Salvar E-mail
      </Button>
    </Stack>
  )

  if (inline) return content

  return (
    <Card shadow="sm" padding="lg" radius="md" className="max-w-xl" mt="lg">
      {content}
    </Card>
  )
}
