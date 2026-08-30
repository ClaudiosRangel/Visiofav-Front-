'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Button, Select, NumberInput, Switch, Alert, Divider, Stack, LoadingOverlay,
} from '@mantine/core'
import { IconStack2, IconRefresh, IconDeviceFloppy, IconInfoCircle } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

/**
 * Configuração do motor de endereçamento de pulmão (RF008).
 * Consome GET/PATCH /api/wms/putaway/config (backend wms-putaway-config.ts).
 */
export default function PutawayConfigPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Configuração de Endereçamento' }, [])
  const queryClient = useQueryClient()

  const [prediosVarreduraPorLado, setPrediosVarreduraPorLado] = useState<number>(3)
  const [usarClasseAbc, setUsarClasseAbc] = useState(false)
  const [politicaIncompleto, setPoliticaIncompleto] = useState<string>('BLOQUEAR')
  const [overflowCapacidadePadrao, setOverflowCapacidadePadrao] = useState<number>(200)
  const [dirty, setDirty] = useState(false)

  const { data: config, isLoading } = useQuery<any>({
    queryKey: ['wms-putaway-config'],
    queryFn: async () => { const { data } = await api.get('/wms/putaway/config'); return data },
  })

  useEffect(() => {
    if (config) {
      setPrediosVarreduraPorLado(config.prediosVarreduraPorLado ?? 3)
      setUsarClasseAbc(config.usarClasseAbc ?? false)
      setPoliticaIncompleto(config.politicaIncompleto ?? 'BLOQUEAR')
      setOverflowCapacidadePadrao(config.overflowCapacidadePadrao ?? 200)
      setDirty(false)
    }
  }, [config])

  const salvar = useMutation({
    mutationFn: async () => {
      const { data } = await api.patch('/wms/putaway/config', {
        prediosVarreduraPorLado,
        usarClasseAbc,
        politicaIncompleto,
        overflowCapacidadePadrao,
      })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wms-putaway-config'] })
      notifications.show({ title: '✅ Configuração salva', message: 'Regras de endereçamento atualizadas.', color: 'green' })
      setDirty(false)
    },
    onError: (err: any) => {
      const msg = err?.response?.status === 403
        ? 'Somente administradores podem alterar esta configuração.'
        : err?.response?.data?.message || 'Falha ao salvar'
      notifications.show({ title: 'Erro', message: msg, color: 'red' })
    },
  })

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Configurações / Endereçamento</Text>
      <Group justify="space-between" mb="lg">
        <Group gap="xs">
          <IconStack2 size={22} />
          <Text size="xl" fw={600}>Configuração de Endereçamento (Put-away)</Text>
        </Group>
        <Button variant="default" size="xs" leftSection={<IconRefresh size={14} />}
          onClick={() => queryClient.invalidateQueries({ queryKey: ['wms-putaway-config'] })}>
          Recarregar
        </Button>
      </Group>

      <Card pos="relative" maw={720}>
        <LoadingOverlay visible={isLoading} />

        <Alert color="blue" icon={<IconInfoCircle size={16} />} mb="md">
          Estas regras controlam como o sistema sugere os endereços de pulmão ao
          endereçar uma nota conferida (regra RF008). Alterações valem para toda a empresa.
        </Alert>

        <Stack gap="lg">
          {/* Política de put-away incompleto */}
          <div>
            <Select
              label="Quando a mercadoria não couber em nenhum endereço"
              description="Comportamento quando fixo, consolidação, livre e overflow não cobrem toda a quantidade."
              value={politicaIncompleto}
              onChange={(v) => { setPoliticaIncompleto(v || 'BLOQUEAR'); setDirty(true) }}
              data={[
                { value: 'BLOQUEAR', label: 'Bloquear — não permite confirmar com mercadoria sem destino (recomendado)' },
                { value: 'PARCIAL', label: 'Parcial — confirma o que couber e sinaliza a quantidade pendente' },
              ]}
              allowDeselect={false}
            />
          </div>

          <Divider />

          {/* Proximidade RF008 */}
          <NumberInput
            label="Prédios a varrer por lado (proximidade RF008)"
            description="A partir do prédio do picking, quantos prédios buscar à direita e à esquerda antes de varrer o restante da rua."
            min={0}
            max={50}
            value={prediosVarreduraPorLado}
            onChange={(v) => { setPrediosVarreduraPorLado(Number(v) || 0); setDirty(true) }}
          />

          <Divider />

          {/* Overflow */}
          <NumberInput
            label="Capacidade padrão do endereço de overflow (transbordo)"
            description="Teto físico de um endereço de overflow sem estrutura própria definida. Nunca capacidade infinita. 0 desativa overflow sem estrutura."
            min={0}
            value={overflowCapacidadePadrao}
            onChange={(v) => { setOverflowCapacidadePadrao(Number(v) || 0); setDirty(true) }}
          />

          <Divider />

          {/* ABC / giro */}
          <Switch
            label="Usar classificação ABC/giro na ordenação"
            description="Prioriza itens de classe A em posições mais acessíveis. Requer a curva ABC calculada (módulo de Slotting)."
            checked={usarClasseAbc}
            onChange={(e) => { setUsarClasseAbc(e.currentTarget.checked); setDirty(true) }}
          />
        </Stack>

        <Group justify="flex-end" mt="xl">
          <Button
            leftSection={<IconDeviceFloppy size={16} />}
            disabled={!dirty}
            loading={salvar.isPending}
            onClick={() => salvar.mutate()}
          >
            Salvar Configuração
          </Button>
        </Group>
      </Card>
    </div>
  )
}
