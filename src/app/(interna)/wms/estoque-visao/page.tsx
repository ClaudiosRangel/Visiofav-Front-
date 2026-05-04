'use client'

import { useEffect, useState } from 'react'
import {
  Card, Group, Text, Button, Stack, SimpleGrid, LoadingOverlay,
  TextInput, Box, Popover,
} from '@mantine/core'
import {
  IconArrowLeft, IconSearch, IconPackages, IconLock,
  IconTruckDelivery, IconCheck,
} from '@tabler/icons-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useRouter } from 'next/navigation'

export default function EstoqueVisaoPage() {
  useModuloGuard('WMS')
  const router = useRouter()

  const [searchTerm, setSearchTerm] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedProduto, setSelectedProduto] = useState<any>(null)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  useEffect(() => {
    document.title = 'VisioFab - Visão Estoque'
  }, [])

  const { data: produtos, isFetching: buscando } = useQuery<any>({
    queryKey: ['produtos-search', searchQuery],
    queryFn: async () => {
      const { data } = await api.get(`/produtos?search=${encodeURIComponent(searchQuery)}&limit=10`)
      return data
    },
    enabled: searchQuery.length > 0,
  })

  const { data: visao, isLoading: loadingVisao } = useQuery<any>({
    queryKey: ['estoque-visao', selectedProduto?.id],
    queryFn: async () => {
      const { data } = await api.get(`/estoque/${selectedProduto.id}/visao`)
      return data
    },
    enabled: !!selectedProduto?.id,
  })

  const handleSearch = () => {
    if (searchTerm.trim()) {
      setSearchQuery(searchTerm.trim())
      setDropdownOpen(true)
    }
  }

  const handleSelectProduto = (produto: any) => {
    setSelectedProduto(produto)
    setSearchTerm(produto.nome || produto.descricao || produto.codigo || '')
    setDropdownOpen(false)
    setSearchQuery('')
  }

  const produtosList = produtos?.data ?? produtos ?? []

  return (
    <Box p="md" pos="relative">
      <LoadingOverlay visible={loadingVisao && !visao} />
      <Stack gap="md">
        <Group>
          <Button
            variant="subtle"
            leftSection={<IconArrowLeft size={16} />}
            onClick={() => router.back()}
          >
            Voltar
          </Button>
          <Text size="xl" fw={600}>Visão de Estoque</Text>
        </Group>

        <Card withBorder>
          <Text size="sm" fw={500} mb="xs">Buscar Produto</Text>
          <Popover opened={dropdownOpen && produtosList.length > 0} onClose={() => setDropdownOpen(false)} width="target" position="bottom-start">
            <Popover.Target>
              <Group>
                <TextInput
                  placeholder="Nome, código ou descrição do produto"
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.currentTarget.value)
                    if (!e.currentTarget.value.trim()) {
                      setDropdownOpen(false)
                      setSearchQuery('')
                    }
                  }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  style={{ flex: 1 }}
                  rightSection={buscando ? undefined : undefined}
                />
                <Button leftSection={<IconSearch size={16} />} onClick={handleSearch} loading={buscando}>
                  Buscar
                </Button>
              </Group>
            </Popover.Target>
            <Popover.Dropdown p={0}>
              {produtosList.map((produto: any) => (
                <Box
                  key={produto.id}
                  p="sm"
                  style={{ cursor: 'pointer', borderBottom: '1px solid var(--mantine-color-gray-2)' }}
                  onClick={() => handleSelectProduto(produto)}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--mantine-color-gray-0)' }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent' }}
                >
                  <Text size="sm" fw={500}>{produto.nome || produto.descricao}</Text>
                  {produto.codigo && <Text size="xs" c="dimmed">Código: {produto.codigo}</Text>}
                </Box>
              ))}
            </Popover.Dropdown>
          </Popover>
        </Card>

        {selectedProduto && (
          <Text size="sm" c="dimmed">
            Produto selecionado: <Text span fw={600}>{selectedProduto.nome || selectedProduto.descricao || selectedProduto.codigo}</Text>
          </Text>
        )}

        {visao && (
          <SimpleGrid cols={{ base: 2, sm: 4 }}>
            <Card withBorder style={{ borderLeft: '4px solid var(--mantine-color-blue-5)' }}>
              <Group justify="space-between">
                <div>
                  <Text size="xl" fw={700} c="blue">{visao.quantidadeTotal ?? 0}</Text>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Quantidade Total</Text>
                </div>
                <IconPackages size={28} color="var(--mantine-color-blue-5)" />
              </Group>
            </Card>
            <Card withBorder style={{ borderLeft: '4px solid var(--mantine-color-orange-5)' }}>
              <Group justify="space-between">
                <div>
                  <Text size="xl" fw={700} c="orange">{visao.reservado ?? 0}</Text>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Reservado</Text>
                </div>
                <IconLock size={28} color="var(--mantine-color-orange-5)" />
              </Group>
            </Card>
            <Card withBorder style={{ borderLeft: '4px solid var(--mantine-color-violet-5)' }}>
              <Group justify="space-between">
                <div>
                  <Text size="xl" fw={700} c="violet">{visao.emTransito ?? 0}</Text>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Em Trânsito</Text>
                </div>
                <IconTruckDelivery size={28} color="var(--mantine-color-violet-5)" />
              </Group>
            </Card>
            <Card withBorder style={{ borderLeft: '4px solid var(--mantine-color-teal-5)' }}>
              <Group justify="space-between">
                <div>
                  <Text size="xl" fw={700} c="teal">{visao.disponivel ?? 0}</Text>
                  <Text size="xs" c="dimmed" tt="uppercase" fw={600}>Disponível</Text>
                </div>
                <IconCheck size={28} color="var(--mantine-color-teal-5)" />
              </Group>
            </Card>
          </SimpleGrid>
        )}
      </Stack>
    </Box>
  )
}
