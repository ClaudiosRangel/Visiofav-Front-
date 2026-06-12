'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Button, Select, Badge, LoadingOverlay, Stack,
} from '@mantine/core'
import { IconArrowLeft, IconCheck } from '@tabler/icons-react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { notifications } from '@mantine/notifications'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

const DISPOSICAO_OPTIONS = [
  { value: 'REESTOQUE', label: 'Reestoque' },
  { value: 'AVARIA', label: 'Avaria' },
  { value: 'DESCARTE', label: 'Descarte' },
  { value: 'RETORNO_FORNECEDOR', label: 'Retorno ao Fornecedor' },
]

const CONDICAO_COLORS: Record<string, string> = {
  PERFEITO: 'green',
  AVARIADO: 'red',
  INCOMPLETO: 'orange',
}

interface DisposicaoItem {
  itemId: string
  produtoNome: string
  quantidade: number
  condicao: string
  disposicao: string | null
}

export default function DisposicaoPage() {
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
  const [itensDisposicao, setItensDisposicao] = useState<DisposicaoItem[]>([])

  useEffect(() => {
    if (ra?.itens) {
      setItensDisposicao(
        ra.itens
          .filter((item: any) => item.condicao) // only inspected items
          .map((item: any) => ({
            itemId: item.id,
            produtoNome: item.produtoNome || item.produtoId,
            quantidade: Number(item.quantidade),
            condicao: item.condicao,
            disposicao: item.disposicao || null,
          })),
      )
    }
  }, [ra?.itens])

  useEffect(() => {
    if (ra?.numero) {
      document.title = `Vizor - WMS - Disposição - ${ra.numero}`
    }
  }, [ra?.numero])

  const updateDisposicao = (idx: number, value: string | null) => {
    setItensDisposicao((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, disposicao: value } : item)),
    )
  }

  const submeter = useMutation({
    mutationFn: async () => {
      const payload = {
        itens: itensDisposicao.map((item) => ({
          itemId: item.itemId,
          disposicao: item.disposicao,
        })),
      }
      await api.post(`/logistica-reversa/ra/${id}/dispor`, payload)
    },
    onSuccess: () => {
      notifications.show({
        title: 'Sucesso',
        message: 'Disposição definida com sucesso',
        color: 'green',
      })
      router.push(`/wms/logistica-reversa/${id}`)
    },
    onError: (err: any) => {
      notifications.show({
        title: 'Erro',
        message: err?.response?.data?.message || 'Erro ao salvar disposição',
        color: 'red',
      })
    },
  })

  const todosPreenchidos = itensDisposicao.every((i) => i.disposicao)

  if (isLoading) {
    return <LoadingOverlay visible />
  }

  if (!ra) {
    return <Text>RA não encontrada</Text>
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>
        WMS / Gestão / Logística Reversa / {ra.numero} / Disposição
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
        <Text size="xl" fw={600}>Disposição - {ra.numero}</Text>
      </Group>

      <Stack gap="md">
        {itensDisposicao.map((item, idx) => (
          <Card key={item.itemId} withBorder>
            <Group mb="sm">
              <Text fw={500}>{item.produtoNome}</Text>
              <Badge variant="light">Qtd: {item.quantidade}</Badge>
              <Badge variant="light" color={CONDICAO_COLORS[item.condicao] || 'gray'}>
                {item.condicao}
              </Badge>
            </Group>

            <Select
              label="Disposição"
              placeholder="Selecione a disposição"
              data={DISPOSICAO_OPTIONS}
              value={item.disposicao}
              onChange={(val) => updateDisposicao(idx, val)}
              required
              w={300}
            />
          </Card>
        ))}

        {itensDisposicao.length === 0 && (
          <Card withBorder>
            <Text c="dimmed" ta="center" py="lg">
              Nenhum item inspecionado disponível para disposição
            </Text>
          </Card>
        )}
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
          disabled={!todosPreenchidos || itensDisposicao.length === 0}
          leftSection={<IconCheck size={16} />}
        >
          Confirmar Disposição
        </Button>
      </Group>
    </div>
  )
}
