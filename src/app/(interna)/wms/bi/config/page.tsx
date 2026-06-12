'use client'

import { useEffect } from 'react'
import {
  Card, Text, Button, NumberInput, LoadingOverlay, Stack, Group,
} from '@mantine/core'
import { IconDeviceFloppy } from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from '@mantine/form'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { notifications } from '@mantine/notifications'

export default function BiConfigPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Configuração Custos BI' }, [])

  const queryClient = useQueryClient()

  const form = useForm({
    initialValues: {
      custoHoraOperador: 0,
      custoHoraEquipamento: 0,
      custoM2Mes: 0,
      depreciacao: 0,
    },
    validate: {
      custoHoraOperador: (v) => (v < 0 ? 'Valor deve ser positivo' : null),
      custoHoraEquipamento: (v) => (v < 0 ? 'Valor deve ser positivo' : null),
      custoM2Mes: (v) => (v < 0 ? 'Valor deve ser positivo' : null),
      depreciacao: (v) => (v < 0 || v > 100 ? 'Deve estar entre 0 e 100%' : null),
    },
  })

  const { isLoading } = useQuery<any>({
    queryKey: ['bi-config'],
    queryFn: async () => {
      const { data } = await api.get('/bi/config')
      return data
    },
    select: (data) => {
      const cfg = data?.data || data
      if (cfg) {
        form.setValues({
          custoHoraOperador: cfg.custoHoraOperador ?? 0,
          custoHoraEquipamento: cfg.custoHoraEquipamento ?? 0,
          custoM2Mes: cfg.custoM2Mes ?? 0,
          depreciacao: cfg.depreciacao ?? 0,
        })
      }
      return cfg
    },
  })

  const salvar = useMutation({
    mutationFn: async (values: typeof form.values) => {
      await api.put('/bi/config', values)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bi-config'] })
      notifications.show({ title: 'Sucesso', message: 'Configuração de custos salva', color: 'green' })
    },
    onError: () => {
      notifications.show({ title: 'Erro', message: 'Falha ao salvar configuração', color: 'red' })
    },
  })

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / BI Avançado / Configuração</Text>
      <Text size="xl" fw={600} mb="lg">Configuração de Custos</Text>

      <Card withBorder pos="relative" maw={500}>
        <LoadingOverlay visible={isLoading} />

        <form onSubmit={form.onSubmit((values) => salvar.mutate(values))}>
          <Stack gap="md">
            <NumberInput
              label="Custo Hora Operador (R$)"
              description="Valor médio da hora de trabalho do operador"
              min={0}
              decimalScale={2}
              prefix="R$ "
              thousandSeparator="."
              decimalSeparator=","
              {...form.getInputProps('custoHoraOperador')}
            />

            <NumberInput
              label="Custo Hora Equipamento (R$)"
              description="Valor médio da hora de uso de equipamento (empilhadeira, etc)"
              min={0}
              decimalScale={2}
              prefix="R$ "
              thousandSeparator="."
              decimalSeparator=","
              {...form.getInputProps('custoHoraEquipamento')}
            />

            <NumberInput
              label="Custo m²/Mês (R$)"
              description="Valor do metro quadrado por mês de armazenagem"
              min={0}
              decimalScale={2}
              prefix="R$ "
              thousandSeparator="."
              decimalSeparator=","
              {...form.getInputProps('custoM2Mes')}
            />

            <NumberInput
              label="Depreciação (%)"
              description="Percentual de depreciação mensal dos equipamentos"
              min={0}
              max={100}
              decimalScale={2}
              suffix="%"
              {...form.getInputProps('depreciacao')}
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
