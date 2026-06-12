'use client'

import { useEffect } from 'react'
import {
  Card, Group, Text, Button, Select, Slider, NumberInput, LoadingOverlay, Stack,
} from '@mantine/core'
import { IconDeviceFloppy } from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from '@mantine/form'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { notifications } from '@mantine/notifications'

const METODOS = [
  { value: 'MEDIA_MOVEL', label: 'Média Móvel' },
  { value: 'SUAVIZACAO_EXPONENCIAL', label: 'Suavização Exponencial' },
  { value: 'REGRESSAO_LINEAR', label: 'Regressão Linear' },
  { value: 'SAZONALIDADE', label: 'Sazonalidade' },
]

export default function DemandaConfigPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Configuração Demanda' }, [])

  const queryClient = useQueryClient()

  const form = useForm({
    initialValues: {
      periodoHistoricoDias: 90,
      metodoPreferido: 'MEDIA_MOVEL',
      estoqueSegurancaDias: 7,
    },
  })

  const { isLoading } = useQuery<any>({
    queryKey: ['demanda-config'],
    queryFn: async () => {
      const { data } = await api.get('/demanda/config')
      return data
    },
    select: (data) => {
      const cfg = data?.data || data
      if (cfg) {
        form.setValues({
          periodoHistoricoDias: cfg.periodoHistoricoDias ?? 90,
          metodoPreferido: cfg.metodoPreferido ?? 'MEDIA_MOVEL',
          estoqueSegurancaDias: cfg.estoqueSegurancaDias ?? 7,
        })
      }
      return cfg
    },
  })

  const salvar = useMutation({
    mutationFn: async (values: typeof form.values) => {
      await api.put('/demanda/config', values)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['demanda-config'] })
      notifications.show({ title: 'Sucesso', message: 'Configuração salva com sucesso', color: 'green' })
    },
    onError: () => {
      notifications.show({ title: 'Erro', message: 'Falha ao salvar configuração', color: 'red' })
    },
  })

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Demanda / Configuração</Text>
      <Text size="xl" fw={600} mb="lg">Configuração de Demanda</Text>

      <Card withBorder pos="relative" maw={600}>
        <LoadingOverlay visible={isLoading} />

        <form onSubmit={form.onSubmit((values) => salvar.mutate(values))}>
          <Stack gap="lg">
            <div>
              <Text size="sm" fw={500} mb="xs">
                Período Histórico: {form.values.periodoHistoricoDias} dias
              </Text>
              <Slider
                min={7}
                max={365}
                step={1}
                marks={[
                  { value: 7, label: '7d' },
                  { value: 30, label: '30d' },
                  { value: 90, label: '90d' },
                  { value: 180, label: '180d' },
                  { value: 365, label: '365d' },
                ]}
                value={form.values.periodoHistoricoDias}
                onChange={(v) => form.setFieldValue('periodoHistoricoDias', v)}
              />
            </div>

            <Select
              label="Método Preferido de Previsão"
              data={METODOS}
              {...form.getInputProps('metodoPreferido')}
            />

            <NumberInput
              label="Estoque de Segurança (dias)"
              min={1}
              max={90}
              {...form.getInputProps('estoqueSegurancaDias')}
            />

            <Group justify="flex-end">
              <Button
                type="submit"
                leftSection={<IconDeviceFloppy size={16} />}
                loading={salvar.isPending}
              >
                Salvar Configuração
              </Button>
            </Group>
          </Stack>
        </form>
      </Card>
    </div>
  )
}
