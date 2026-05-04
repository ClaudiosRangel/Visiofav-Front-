'use client'

import { useEffect } from 'react'
import { Card, SimpleGrid, Text, Title, Center, Loader, Stack } from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { useEmpresa } from '@/providers/EmpresaProvider'

interface EmpresaItem {
  id: string
  razaoSocial: string
  nomeFantasia: string
  cnpj: string
}

export default function SelecionarEmpresaPage() {
  useEffect(() => { document.title = 'VisioFab - Selecionar Empresa' }, [])
  const router = useRouter()
  const { selecionarEmpresa } = useEmpresa()

  const { data: empresas, isLoading } = useQuery<EmpresaItem[]>({
    queryKey: ['empresas-minhas'],
    queryFn: async () => {
      const { data } = await api.get('/empresas/minhas')
      return Array.isArray(data) ? data : [data]
    },
  })

  const handleSelecionar = async (emp: EmpresaItem) => {
    await selecionarEmpresa(emp)
    router.push('/modulos')
  }

  if (isLoading) {
    return (
      <Center h="60vh">
        <Loader size="lg" />
      </Center>
    )
  }

  if (!empresas || empresas.length === 0) {
    return (
      <Center h="60vh">
        <Text size="lg" c="dimmed">
          Nenhuma empresa disponível
        </Text>
      </Center>
    )
  }

  return (
    <Stack gap="lg">
      <Title order={2}>Selecionar Empresa</Title>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }}>
        {empresas.map((emp) => (
          <Card
            key={emp.id}
            withBorder
            style={{ cursor: 'pointer' }}
            onClick={() => handleSelecionar(emp)}
          >
            <Text fw={600} size="lg">
              {emp.razaoSocial}
            </Text>
            {emp.nomeFantasia && (
              <Text size="sm" c="dimmed">
                {emp.nomeFantasia}
              </Text>
            )}
            <Text size="sm" c="dimmed" mt="xs">
              CNPJ: {emp.cnpj}
            </Text>
          </Card>
        ))}
      </SimpleGrid>
    </Stack>
  )
}
