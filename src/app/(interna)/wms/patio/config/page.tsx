'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, Select, NumberInput, Switch, Button, Alert,
  SimpleGrid,
} from '@mantine/core'
import { IconSettings, IconCheck, IconAlertCircle } from '@tabler/icons-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

export default function PatioConfigPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Pátio - Configuração' }, [])

  const queryClient = useQueryClient()
  const [cdId, setCdId] = useState<string | null>(null)
  const [limitePermMinutos, setLimitePermMinutos] = useState<number | ''>(240)
  const [alertaPermAtivo, setAlertaPermAtivo] = useState(true)
  const [prioridadeCarga, setPrioridadeCarga] = useState<number | ''>(5)
  const [prioridadeDescarga, setPrioridadeDescarga] = useState<number | ''>(5)
  const [prioridadeUrgente, setPrioridadeUrgente] = useState<number | ''>(10)
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)

  const { data: cds } = useQuery<any[]>({
    queryKey: ['cds-select'],
    queryFn: async () => {
      const { data } = await api.get('/centros-distribuicao')
      return (data?.data || data || []).map((cd: any) => ({
        value: String(cd.id),
        label: cd.nome,
      }))
    },
  })

  // Load config when CD is selected
  const { data: config } = useQuery<any>({
    queryKey: ['patio-config', cdId],
    queryFn: async () => {
      if (!cdId) return null
      const { data } = await api.get('/patio/config', { params: { cdId } })
      return data
    },
    enabled: !!cdId,
  })

  useEffect(() => {
    if (config) {
      setLimitePermMinutos(config.limitePermMinutos ?? 240)
      setAlertaPermAtivo(config.alertaPermAtivo ?? true)
      setPrioridadeCarga(config.prioridadeCarga ?? 5)
      setPrioridadeDescarga(config.prioridadeDescarga ?? 5)
      setPrioridadeUrgente(config.prioridadeUrgente ?? 10)
    }
  }, [config])

  const mutation = useMutation({
    mutationFn: async () => {
      await api.put('/patio/config', {
        cdId: cdId,
        limitePermMinutos: Number(limitePermMinutos),
        alertaPermAtivo,
        prioridadeAgendado: Number(prioridadeUrgente) || 10,
        prioridadeDescarga: Number(prioridadeDescarga) || 5,
        prioridadeCarga: Number(prioridadeCarga) || 3,
        prioridadePadrao: 1,
      })
    },
    onSuccess: () => {
      setMensagem({ tipo: 'success', texto: 'Configuração salva com sucesso!' })
      queryClient.invalidateQueries({ queryKey: ['patio-config'] })
    },
    onError: (err: any) => {
      setMensagem({ tipo: 'error', texto: err?.response?.data?.message || 'Erro ao salvar configuração' })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!cdId) {
      setMensagem({ tipo: 'error', texto: 'Selecione um Centro de Distribuição' })
      return
    }
    mutation.mutate()
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Pátio / Configuração</Text>
      <Text size="xl" fw={600} mb="lg">Configuração do Pátio</Text>

      {mensagem && (
        <Alert
          icon={mensagem.tipo === 'success' ? <IconCheck size={16} /> : <IconAlertCircle size={16} />}
          color={mensagem.tipo === 'success' ? 'green' : 'red'}
          mb="md"
          withCloseButton
          onClose={() => setMensagem(null)}
        >
          {mensagem.texto}
        </Alert>
      )}

      <Card withBorder padding="lg">
        <form onSubmit={handleSubmit}>
          <Select
            label="Centro de Distribuição"
            placeholder="Selecione o CD para configurar"
            data={cds || []}
            value={cdId}
            onChange={setCdId}
            searchable
            required
            mb="lg"
          />

          <Text fw={600} size="sm" mb="sm">Permanência</Text>
          <SimpleGrid cols={{ base: 1, sm: 2 }} mb="lg">
            <NumberInput
              label="Limite de Permanência (minutos)"
              description="Tempo máximo que um veículo pode ficar no pátio"
              min={30}
              max={1440}
              step={30}
              value={limitePermMinutos}
              onChange={(val) => setLimitePermMinutos(val as number)}
            />
            <div>
              <Text size="sm" fw={500} mb={4}>Alerta de Permanência</Text>
              <Switch
                label={alertaPermAtivo ? 'Ativo' : 'Inativo'}
                checked={alertaPermAtivo}
                onChange={(e) => setAlertaPermAtivo(e.currentTarget.checked)}
                size="md"
              />
              <Text size="xs" c="dimmed" mt={4}>
                Notifica quando veículo excede o limite
              </Text>
            </div>
          </SimpleGrid>

          <Text fw={600} size="sm" mb="sm">Prioridades Padrão</Text>
          <SimpleGrid cols={{ base: 1, sm: 3 }} mb="lg">
            <NumberInput
              label="Prioridade Carga"
              description="Padrão para operações de carga"
              min={1}
              max={10}
              value={prioridadeCarga}
              onChange={(val) => setPrioridadeCarga(val as number)}
            />
            <NumberInput
              label="Prioridade Descarga"
              description="Padrão para operações de descarga"
              min={1}
              max={10}
              value={prioridadeDescarga}
              onChange={(val) => setPrioridadeDescarga(val as number)}
            />
            <NumberInput
              label="Prioridade Urgente"
              description="Veículos marcados como urgentes"
              min={1}
              max={10}
              value={prioridadeUrgente}
              onChange={(val) => setPrioridadeUrgente(val as number)}
            />
          </SimpleGrid>

          <Group>
            <Button
              type="submit"
              leftSection={<IconSettings size={18} />}
              loading={mutation.isPending}
            >
              Salvar Configuração
            </Button>
          </Group>
        </form>
      </Card>
    </div>
  )
}
