'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Button, Select, TextInput, Textarea, Table,
  LoadingOverlay, Stack, Badge,
} from '@mantine/core'
import { IconArrowLeft, IconCheck } from '@tabler/icons-react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

const CONDICAO_OPTIONS = [
  { value: 'PERFEITO', label: 'Perfeito' },
  { value: 'AVARIADO', label: 'Avariado' },
  { value: 'INCOMPLETO', label: 'Incompleto' },
]

interface InspecaoItem {
  itemId: string
  produtoNome: string
  quantidade: number
  condicao: string | null
  parecer: string
  fotos: string
}

export default function InspecaoPage() {
  useModuloGuard('WMS')
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const { data: resp, isLoading } = useQuery<any>({
    queryKey: ['logistica-reversa-ra', id],
    queryFn: async () => {
      const { data } = await api.get(`/logistica-reversa/ra/${id}`)
      return data.data || data
    },
    enabled: !!id,
  })

  const ra = resp || null
  const [itensInspecao, setItensInspecao] = useState<InspecaoItem[]>([])

  useEffect(() => {
    if (ra?.itens) {
      setItensInspecao(
        ra.itens.map((item: any) => ({
          itemId: item.id,
          produtoNome: item.produtoNome || item.produtoId,
          quantidade: Number(item.quantidade),
          condicao: item.condicao || null,
          parecer: item.parecerInspecao || '',
          fotos: (item.fotos || []).join(', '),
        })),
      )
    }
  }, [ra?.itens])

  useEffect(() => {
    if (ra?.numero) {
      document.title = `Vizor - WMS - Inspeção - ${ra.numero}`
    }
  }, [ra?.numero])

  const updateItem = (idx: number, field: keyof InspecaoItem, value: any) => {
    setItensInspecao((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)),
    )
  }

  const submeter = useMutation({
    mutationFn: async () => {
      const payload = {
        itens: itensInspecao.map((item) => ({
          itemId: item.itemId,
          condicao: item.condicao,
          parecer: item.parecer || undefined,
          fotos: item.fotos ? item.fotos.split(',').map((f) => f.trim()).filter(Boolean) : [],
        })),
      }
      await api.post(`/logistica-reversa/ra/${id}/inspecionar`, payload)
    },
    onSuccess: () => {
      notifications.show({
        title: 'Sucesso',
        message: 'Inspeção registrada com sucesso',
        color: 'green',
      })
      router.push(`/wms/logistica-reversa/${id}`)
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Erro',
        message: err?.response?.data?.message || 'Erro ao salvar inspeção',
        color: 'red',
      })
    },
  })

  const todosPreenchidos = itensInspecao.every((i) => i.condicao)

  if (isLoading) {
    return <LoadingOverlay visible />
  }

  if (!ra) {
    return <Text>RA não encontrada</Text>
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>
        WMS / Gestão / Logística Reversa / {ra.numero} / Inspeção
      </Text>

      <Group mb="lg">
        <Button
          component={Link}
          href={`/wms/logistica-reversa/${id}`}
          variant="subtle"
          leftSection={<IconArrowLeft size={16} />}
        >
          Voltar
        </Button>
        <Text size="xl" fw={600}>Inspeção - {ra.numero}</Text>
      </Group>

      <Stack gap="md">
        {itensInspecao.map((item, idx) => (
          <Card key={item.itemId} withBorder>
            <Group mb="sm">
              <Text fw={500}>{item.produtoNome}</Text>
              <Badge variant="light">Qtd: {item.quantidade}</Badge>
            </Group>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Select
                label="Condição"
                placeholder="Selecione"
                data={CONDICAO_OPTIONS}
                value={item.condicao}
                onChange={(val) => updateItem(idx, 'condicao', val)}
                required
              />
              <Textarea
                label="Parecer"
                placeholder="Observações da inspeção..."
                value={item.parecer}
                onChange={(e) => updateItem(idx, 'parecer', e.currentTarget.value)}
                rows={2}
              />
              <TextInput
                label="Fotos (URLs)"
                placeholder="URL1, URL2, ..."
                value={item.fotos}
                onChange={(e) => updateItem(idx, 'fotos', e.currentTarget.value)}
              />
            </div>
          </Card>
        ))}
      </Stack>

      <Group justify="flex-end" mt="lg">
        <Button
          variant="default"
          component={Link}
          href={`/wms/logistica-reversa/${id}`}
        >
          Cancelar
        </Button>
        <Button
          onClick={() => submeter.mutate()}
          loading={submeter.isPending}
          disabled={!todosPreenchidos}
          leftSection={<IconCheck size={16} />}
        >
          Salvar Inspeção
        </Button>
      </Group>
    </div>
  )
}
