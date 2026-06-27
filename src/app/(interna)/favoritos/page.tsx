'use client'

import { useEffect, useState } from 'react'
import { Title, Text, Card, Stack, Group, TextInput, ActionIcon, Badge, Center } from '@mantine/core'
import { IconStar, IconSearch, IconTrash, IconExternalLink } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

interface Favorito {
  id: string
  href: string
  label: string
  modulo: string
  ordem: number
}

export default function FavoritosPage() {
  useEffect(() => { document.title = 'Vizor - Favoritos' }, [])

  const router = useRouter()
  const [favoritos, setFavoritos] = useState<Favorito[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')

  useEffect(() => {
    api.get('/favoritos')
      .then(({ data }) => setFavoritos(data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function remover(id: string) {
    try {
      await api.delete(`/favoritos/${id}`)
      setFavoritos(prev => prev.filter(f => f.id !== id))
      notifications.show({ title: 'Removido', message: 'Favorito removido', color: 'green' })
    } catch {
      notifications.show({ title: 'Erro', message: 'Não foi possível remover', color: 'red' })
    }
  }

  const filtrados = favoritos.filter(f =>
    f.label.toLowerCase().includes(busca.toLowerCase()) ||
    f.modulo.toLowerCase().includes(busca.toLowerCase())
  )

  // Agrupar por módulo
  const agrupados = filtrados.reduce<Record<string, Favorito[]>>((acc, fav) => {
    const key = fav.modulo || 'Outros'
    if (!acc[key]) acc[key] = []
    acc[key].push(fav)
    return acc
  }, {})

  return (
    <div className="max-w-[900px] mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <Title order={2} fw={700}>Favoritos</Title>
          <Text size="sm" c="dimmed">Acesse rapidamente suas páginas marcadas</Text>
        </div>
        <Badge variant="light" size="lg">{favoritos.length}/20</Badge>
      </div>

      <TextInput
        placeholder="Buscar nos favoritos..."
        leftSection={<IconSearch size={16} />}
        value={busca}
        onChange={(e) => setBusca(e.currentTarget.value)}
        mb="lg"
      />

      {loading ? (
        <Text c="dimmed">Carregando...</Text>
      ) : favoritos.length === 0 ? (
        <Center py="xl">
          <Stack align="center" gap="sm">
            <IconStar size={48} className="text-gray-300" />
            <Text size="lg" fw={500} c="dimmed">Nenhum favorito ainda</Text>
            <Text size="sm" c="dimmed" ta="center">
              Clique no ícone ☆ no cabeçalho de qualquer página para adicioná-la aos favoritos.
            </Text>
          </Stack>
        </Center>
      ) : (
        <Stack gap="lg">
          {Object.entries(agrupados).map(([modulo, items]) => (
            <div key={modulo}>
              <Text size="xs" fw={600} c="dimmed" tt="uppercase" mb="xs">{modulo}</Text>
              <Stack gap="xs">
                {items.map(fav => (
                  <Card key={fav.id} shadow="xs" radius="md" p="sm" className="cursor-pointer hover:shadow-md transition-shadow">
                    <Group justify="space-between">
                      <Group gap="sm" onClick={() => router.push(fav.href)} className="flex-1 cursor-pointer">
                        <IconStar size={16} className="text-yellow-500" fill="currentColor" />
                        <Text size="sm" fw={500}>{fav.label}</Text>
                        <IconExternalLink size={12} className="text-gray-400" />
                      </Group>
                      <ActionIcon variant="subtle" color="red" size="sm" onClick={() => remover(fav.id)} aria-label="Remover favorito">
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                  </Card>
                ))}
              </Stack>
            </div>
          ))}
        </Stack>
      )}
    </div>
  )
}
