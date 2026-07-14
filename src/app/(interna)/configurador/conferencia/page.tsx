'use client'

import { useEffect, useState } from 'react'
import { Card, Text, Switch, Stack, Button, Group, Divider, Loader, NumberInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { IconArrowLeft, IconEyeOff, IconPackage, IconClipboardCheck, IconPercentage } from '@tabler/icons-react'
import Link from 'next/link'
import { api } from '@/lib/api'

interface ConfigConferencia {
  conferenciaQuantidadeCega: boolean
  conferenciaLoteCega: boolean
  permiteRecebimentoParcial: boolean
  toleranciaQuantidadePercentualPadrao: number | null
}

export default function ConfigConferenciaPage() {
  const [config, setConfig] = useState<ConfigConferencia>({
    conferenciaQuantidadeCega: false,
    conferenciaLoteCega: false,
    permiteRecebimentoParcial: false,
    toleranciaQuantidadePercentualPadrao: null,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    document.title = 'Vizor - Configuração de Conferência'
    loadConfig()
  }, [])

  async function loadConfig() {
    try {
      const { data } = await api.get('/empresas/minha')
      setConfig({
        conferenciaQuantidadeCega: data.conferenciaQuantidadeCega ?? false,
        conferenciaLoteCega: data.conferenciaLoteCega ?? false,
        permiteRecebimentoParcial: data.permiteRecebimentoParcial ?? false,
        toleranciaQuantidadePercentualPadrao: data.toleranciaQuantidadePercentualPadrao ?? null,
      })
    } catch {
      notifications.show({ title: 'Erro', message: 'Não foi possível carregar configurações', color: 'red' })
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    try {
      await api.put('/empresas/minha', config)
      notifications.show({ title: 'Salvo', message: 'Configurações de conferência atualizadas', color: 'green' })
    } catch {
      notifications.show({ title: 'Erro', message: 'Falha ao salvar configurações', color: 'red' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader />
      </div>
    )
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>
        Início / Configurador / Conferência
      </Text>
      <Group mb="lg">
        <Button variant="subtle" size="compact-sm" component={Link} href="/configurador" leftSection={<IconArrowLeft size={16} />}>
          Voltar
        </Button>
        <Text size="xl" fw={600}>Configuração de Conferência</Text>
      </Group>

      <Card shadow="sm" padding="lg" radius="md" className="max-w-xl">
        <Stack gap="xl">
          {/* Conferência cega de quantidade */}
          <div>
            <Group gap="sm" mb={4}>
              <IconEyeOff size={20} className="text-teal-600" />
              <Text fw={500}>Conferência Cega de Quantidade</Text>
            </Group>
            <Text size="xs" c="dimmed" mb="sm">
              O conferente não vê a quantidade da NF e precisa digitar o que contou fisicamente.
            </Text>
            <Switch
              checked={config.conferenciaQuantidadeCega}
              onChange={(e) => setConfig({ ...config, conferenciaQuantidadeCega: e.currentTarget.checked })}
              label={config.conferenciaQuantidadeCega ? 'Ativa' : 'Inativa'}
              color="teal"
            />
          </div>

          <Divider />

          {/* Conferência cega de lote */}
          <div>
            <Group gap="sm" mb={4}>
              <IconPackage size={20} className="text-teal-600" />
              <Text fw={500}>Conferência Cega de Lote</Text>
            </Group>
            <Text size="xs" c="dimmed" mb="sm">
              O conferente não vê o lote da NF e precisa digitar/ler o lote real do produto. Quando ativa, também exige a digitação da validade.
            </Text>
            <Switch
              checked={config.conferenciaLoteCega}
              onChange={(e) => setConfig({ ...config, conferenciaLoteCega: e.currentTarget.checked })}
              label={config.conferenciaLoteCega ? 'Ativa' : 'Inativa'}
              color="teal"
            />
          </div>

          <Divider />

          {/* Recebimento parcial */}
          <div>
            <Group gap="sm" mb={4}>
              <IconClipboardCheck size={20} className="text-teal-600" />
              <Text fw={500}>Recebimento Parcial</Text>
            </Group>
            <Text size="xs" c="dimmed" mb="sm">
              Permite aceitar quantidade menor que a NF, registrando saldo pendente para recebimento futuro.
            </Text>
            <Switch
              checked={config.permiteRecebimentoParcial}
              onChange={(e) => setConfig({ ...config, permiteRecebimentoParcial: e.currentTarget.checked })}
              label={config.permiteRecebimentoParcial ? 'Ativa' : 'Inativa'}
              color="teal"
            />
          </div>

          <Divider />

          {/* Tolerância de quantidade padrão */}
          <div>
            <Group gap="sm" mb={4}>
              <IconPercentage size={20} className="text-teal-600" />
              <Text fw={500}>Tolerância de Quantidade (Padrão)</Text>
            </Group>
            <Text size="xs" c="dimmed" mb="sm">
              Percentual de desvio de quantidade aceito automaticamente na conferência
              de entrada, sem gerar divergência. Aplicado a produtos sem tolerância
              própria configurada no cadastro do produto.
            </Text>
            <NumberInput
              placeholder="Sem tolerância (0%)"
              min={0}
              max={100}
              decimalScale={2}
              suffix="%"
              value={config.toleranciaQuantidadePercentualPadrao ?? ''}
              onChange={(v) => setConfig({ ...config, toleranciaQuantidadePercentualPadrao: v === '' ? null : Number(v) })}
              w={220}
            />
          </div>

          <Divider />

          <Button onClick={handleSave} loading={saving} color="teal" fullWidth>
            Salvar Configurações
          </Button>
        </Stack>
      </Card>
    </div>
  )
}
