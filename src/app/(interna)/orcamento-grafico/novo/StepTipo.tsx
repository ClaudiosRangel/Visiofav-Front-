'use client'

import { useEffect, useState } from 'react'
import { Stack, Text, SimpleGrid, Card, Group, Badge, Loader, Center } from '@mantine/core'
import { IconPackage, IconBox, IconRectangle, IconShoppingBag } from '@tabler/icons-react'
import { api } from '@/lib/api'
import type { WizardFormData } from './page'

interface Props {
  formData: WizardFormData
  updateForm: (partial: Partial<WizardFormData>) => void
}

interface TipoEmbalagem {
  id: string
  codigo: string
  descricao: string
  parametros: any[]
  processosObrigatorios: string[]
  imagemUrl?: string | null
}

const ICONS: Record<string, any> = {
  CARTUCHO: IconBox,
  CAIXA: IconPackage,
  DISPLAY: IconRectangle,
  SACOLA: IconShoppingBag,
}

function getIcon(codigo: string) {
  const upper = codigo.toUpperCase()
  for (const [key, Icon] of Object.entries(ICONS)) {
    if (upper.includes(key)) return Icon
  }
  return IconPackage
}

export default function StepTipo({ formData, updateForm }: Props) {
  const [tipos, setTipos] = useState<TipoEmbalagem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/orcamento-grafico/tipos-embalagem')
      .then(({ data }) => {
        setTipos(Array.isArray(data) ? data : data.data || [])
      })
      .catch(() => setTipos([]))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <Center py="xl"><Loader /></Center>
  }

  return (
    <Stack gap="md">
      <Text fw={600} size="lg">Tipo de Embalagem</Text>
      <Text size="sm" c="dimmed">
        Selecione o tipo de produto gráfico para este orçamento.
      </Text>

      <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="md">
        {tipos.map((tipo) => {
          const Icon = getIcon(tipo.codigo)
          const isSelected = formData.tipoEmbalagemId === tipo.id

          return (
            <Card
              key={tipo.id}
              shadow={isSelected ? 'md' : 'xs'}
              padding="lg"
              withBorder
              style={{
                cursor: 'pointer',
                borderColor: isSelected ? 'var(--mantine-color-blue-5)' : undefined,
                borderWidth: isSelected ? 2 : 1,
                backgroundColor: isSelected ? 'var(--mantine-color-blue-light)' : undefined,
                transition: 'all 150ms ease',
              }}
              onClick={() => {
                updateForm({
                  tipoEmbalagemId: tipo.id,
                  tipoEmbalagem: tipo,
                  medidas: {},
                })
              }}
            >
              <Stack gap="sm" align="center">
                <Icon size={40} stroke={1.5} color={isSelected ? 'var(--mantine-color-blue-6)' : 'var(--mantine-color-gray-6)'} />
                <Text fw={500} ta="center" size="sm">{tipo.descricao}</Text>
                <Group gap={4}>
                  {tipo.processosObrigatorios?.slice(0, 3).map(p => (
                    <Badge key={p} size="xs" variant="light" color="gray">
                      {p.replace(/_/g, ' ')}
                    </Badge>
                  ))}
                </Group>
              </Stack>
            </Card>
          )
        })}
      </SimpleGrid>

      {tipos.length === 0 && (
        <Text c="dimmed" ta="center" py="xl">
          Nenhum tipo de embalagem cadastrado. Cadastre em Orçamento Gráfico → Cadastros → Tipos de Embalagem.
        </Text>
      )}
    </Stack>
  )
}
