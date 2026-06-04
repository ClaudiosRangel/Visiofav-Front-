'use client'

import { useEffect, useState } from 'react'
import { Title, Stack, SimpleGrid, Card, Text, ThemeIcon, Group, Loader, Center, RingProgress } from '@mantine/core'
import { IconAlertTriangle, IconClipboardCheck, IconPackage, IconClock } from '@tabler/icons-react'
import { api } from '@/lib/api'

export default function DashboardPcpPage() {
  useEffect(() => { document.title = 'PCP - Dashboard' }, [])

  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  async function carregar() {
    try {
      const res = await api.get('/pcp/dashboard')
      setData(res.data)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { carregar() }, [])

  if (loading) return <Center py="xl"><Loader /></Center>
  if (!data) return <Text c="dimmed" ta="center">Erro ao carregar dashboard</Text>

  const { producao, estoque } = data

  return (
    <Stack gap="md">
      <Title order={3}>Dashboard PCP</Title>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }}>
        <Card withBorder>
          <Group>
            <ThemeIcon color="orange" variant="light" size={48} radius="md">
              <IconAlertTriangle size={24} />
            </ThemeIcon>
            <div>
              <Text size="xl" fw={700}>{producao.opsAtrasadas}</Text>
              <Text size="sm" c="dimmed">OPs Atrasadas</Text>
            </div>
          </Group>
        </Card>

        <Card withBorder>
          <Group>
            <ThemeIcon color="blue" variant="light" size={48} radius="md">
              <IconPackage size={24} />
            </ThemeIcon>
            <div>
              <Text size="xl" fw={700}>{producao.liberacoesPendentes}</Text>
              <Text size="sm" c="dimmed">Liberações Pendentes</Text>
            </div>
          </Group>
        </Card>

        <Card withBorder>
          <Group>
            <ThemeIcon color="green" variant="light" size={48} radius="md">
              <IconClipboardCheck size={24} />
            </ThemeIcon>
            <div>
              <Text size="xl" fw={700}>{producao.producaoHoje.apontamentos}</Text>
              <Text size="sm" c="dimmed">Apontamentos Hoje</Text>
            </div>
          </Group>
        </Card>

        <Card withBorder>
          <Group>
            <ThemeIcon color="red" variant="light" size={48} radius="md">
              <IconClock size={24} />
            </ThemeIcon>
            <div>
              <Text size="xl" fw={700}>{estoque.itensAbaixoMinimo}</Text>
              <Text size="sm" c="dimmed">Itens Estoque Baixo</Text>
            </div>
          </Group>
        </Card>
      </SimpleGrid>

      {producao.opsPorStatus.length > 0 && (
        <Card withBorder>
          <Text fw={600} mb="sm">OPs por Status</Text>
          <Group>
            {producao.opsPorStatus.map((s: any) => (
              <Card key={s.status} withBorder padding="xs" radius="sm">
                <Text size="xs" c="dimmed">{s.status}</Text>
                <Text size="lg" fw={700}>{s.total}</Text>
              </Card>
            ))}
          </Group>
        </Card>
      )}
    </Stack>
  )
}
