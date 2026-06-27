'use client'

import { useEffect, useState } from 'react'
import { Title, Text, Card, Stack, Group, TextInput, Textarea, Select, Button, Badge, Tabs, Table, Center } from '@mantine/core'
import { IconHeadset, IconPlus, IconBook, IconBell, IconPlugConnected, IconCircleCheck } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'

export default function SuportePage() {
  useEffect(() => { document.title = 'Vizor - Suporte' }, [])

  const [tab, setTab] = useState<string | null>('tickets')
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [prioridade, setPrioridade] = useState<string | null>('media')
  const [enviando, setEnviando] = useState(false)

  async function handleSubmit() {
    if (!titulo.trim() || !descricao.trim()) {
      notifications.show({ title: 'Atenção', message: 'Preencha título e descrição', color: 'yellow' })
      return
    }
    setEnviando(true)
    // TODO: Integrar com API quando backend estiver pronto
    setTimeout(() => {
      notifications.show({ title: 'Ticket criado', message: `Ticket #${Date.now().toString().slice(-6)} aberto com sucesso. Email enviado para suporte@vizorerp.com.br`, color: 'green' })
      setTitulo('')
      setDescricao('')
      setEnviando(false)
    }, 1000)
  }

  return (
    <div className="max-w-[1000px] mx-auto">
      <div className="mb-8">
        <Title order={2} fw={700}>Suporte</Title>
        <Text size="sm" c="dimmed">Abra chamados, consulte tutoriais e verifique o status dos serviços</Text>
      </div>

      <Tabs value={tab} onChange={setTab}>
        <Tabs.List mb="lg">
          <Tabs.Tab value="tickets" leftSection={<IconHeadset size={14} />}>Meus Tickets</Tabs.Tab>
          <Tabs.Tab value="novo" leftSection={<IconPlus size={14} />}>Abrir Ticket</Tabs.Tab>
          <Tabs.Tab value="kb" leftSection={<IconBook size={14} />}>Base de Conhecimento</Tabs.Tab>
          <Tabs.Tab value="status" leftSection={<IconPlugConnected size={14} />}>Status</Tabs.Tab>
        </Tabs.List>

        {/* Meus Tickets */}
        <Tabs.Panel value="tickets">
          <Card shadow="xs" radius="md" p="lg">
            <Center py="xl">
              <Stack align="center" gap="sm">
                <IconHeadset size={48} className="text-gray-300" />
                <Text c="dimmed">Nenhum ticket encontrado</Text>
                <Button variant="light" size="xs" onClick={() => setTab('novo')}>Abrir primeiro ticket</Button>
              </Stack>
            </Center>
          </Card>
        </Tabs.Panel>

        {/* Abrir Ticket */}
        <Tabs.Panel value="novo">
          <Card shadow="xs" radius="md" p="lg">
            <Stack gap="md">
              <TextInput
                label="Título"
                placeholder="Descreva brevemente o problema..."
                value={titulo}
                onChange={(e) => setTitulo(e.currentTarget.value)}
                maxLength={150}
                required
              />
              <Textarea
                label="Descrição"
                placeholder="Detalhe o problema, passos para reproduzir..."
                value={descricao}
                onChange={(e) => setDescricao(e.currentTarget.value)}
                maxLength={2000}
                minRows={4}
                required
              />
              <Select
                label="Prioridade"
                value={prioridade}
                onChange={setPrioridade}
                data={[
                  { value: 'baixa', label: 'Baixa' },
                  { value: 'media', label: 'Média' },
                  { value: 'alta', label: 'Alta' },
                  { value: 'critica', label: 'Crítica' },
                ]}
              />
              <Group justify="space-between" mt="sm">
                <Text size="xs" c="dimmed">Email de suporte: suporte@vizorerp.com.br</Text>
                <Button onClick={handleSubmit} loading={enviando}>Enviar Ticket</Button>
              </Group>
            </Stack>
          </Card>

          {/* SLA */}
          <Card shadow="xs" radius="md" p="lg" mt="md">
            <Text size="sm" fw={600} mb="sm">SLA de Atendimento</Text>
            <Group gap="lg">
              <Badge color="red" variant="light">Crítica: 2h</Badge>
              <Badge color="orange" variant="light">Alta: 4h</Badge>
              <Badge color="yellow" variant="light">Média: 8h</Badge>
              <Badge color="gray" variant="light">Baixa: 24h</Badge>
            </Group>
          </Card>
        </Tabs.Panel>

        {/* Base de Conhecimento */}
        <Tabs.Panel value="kb">
          <Card shadow="xs" radius="md" p="lg">
            <TextInput placeholder="Buscar artigos..." leftSection={<IconBook size={16} />} mb="md" />
            <Stack gap="sm">
              <Card withBorder p="sm" radius="sm">
                <Text size="sm" fw={500}>Como configurar endereços no WMS</Text>
                <Text size="xs" c="dimmed">Módulo: WMS • Atualizado: Jun/2026</Text>
              </Card>
              <Card withBorder p="sm" radius="sm">
                <Text size="sm" fw={500}>Como importar XML de NF-e</Text>
                <Text size="xs" c="dimmed">Módulo: Compras • Atualizado: Jun/2026</Text>
              </Card>
              <Card withBorder p="sm" radius="sm">
                <Text size="sm" fw={500}>Como criar ordens de produção</Text>
                <Text size="xs" c="dimmed">Módulo: PCP • Atualizado: Mai/2026</Text>
              </Card>
            </Stack>
          </Card>
        </Tabs.Panel>

        {/* Status dos Serviços */}
        <Tabs.Panel value="status">
          <Card shadow="xs" radius="md" p="lg">
            <Text size="sm" fw={600} mb="md">Status dos Serviços</Text>
            <Stack gap="sm">
              <Group justify="space-between">
                <Text size="sm">API Principal</Text>
                <Badge color="green" variant="light" leftSection={<IconCircleCheck size={10} />}>Operacional</Badge>
              </Group>
              <Group justify="space-between">
                <Text size="sm">Banco de Dados</Text>
                <Badge color="green" variant="light" leftSection={<IconCircleCheck size={10} />}>Operacional</Badge>
              </Group>
              <Group justify="space-between">
                <Text size="sm">Serviço de Email</Text>
                <Badge color="green" variant="light" leftSection={<IconCircleCheck size={10} />}>Operacional</Badge>
              </Group>
            </Stack>
          </Card>
        </Tabs.Panel>
      </Tabs>
    </div>
  )
}
