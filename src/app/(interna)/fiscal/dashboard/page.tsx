'use client'

import { useEffect } from 'react'
import {
  Card, SimpleGrid, Text, Title, LoadingOverlay, Group, ThemeIcon, Stack,
} from '@mantine/core'
import {
  IconFileInvoice, IconClock, IconCurrencyReal,
  IconCertificate, IconAlertTriangle,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useDashboardFiscal } from '@/data/hooks/fiscal/useDashboardFiscal'
import { useModuloGuard } from '@/hooks/useModuloGuard'

export default function FiscalDashboardPage() {
  useModuloGuard('FISCAL')
  useEffect(() => { document.title = 'Vizor - Fiscal - Dashboard' }, [])

  const { data: metricas, isLoading, isError, error } = useDashboardFiscal()

  useEffect(() => {
    if (isError) {
      notifications.show({
        title: 'Erro ao carregar métricas',
        message: (error as any)?.response?.data?.message || 'Não foi possível carregar as métricas do dashboard fiscal.',
        color: 'red',
      })
    }
  }, [isError, error])

  const cards = [
    {
      label: 'NF-e Emitidas (mês)',
      value: metricas?.nfeEmitidasMes ?? 0,
      icon: IconFileInvoice,
      color: 'teal',
    },
    {
      label: 'NF-e Pendentes',
      value: metricas?.nfePendentes ?? 0,
      icon: IconClock,
      color: 'yellow',
    },
    {
      label: 'Valor Faturado (mês)',
      value: metricas?.valorFaturadoMes != null
        ? metricas.valorFaturadoMes.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : 'R$ 0,00',
      icon: IconCurrencyReal,
      color: 'green',
    },
    {
      label: 'Certificados Expirando',
      value: metricas?.certificadosProximoVencimento ?? 0,
      icon: IconCertificate,
      color: 'orange',
    },
    {
      label: 'Documentos em Contingência',
      value: metricas?.documentosContingencia ?? 0,
      icon: IconAlertTriangle,
      color: 'red',
    },
  ]

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">Início / Fiscal / Dashboard</Text>
      <Title order={3}>Dashboard Fiscal</Title>

      <div style={{ position: 'relative', minHeight: 120 }}>
        <LoadingOverlay visible={isLoading} />

        {isError && !isLoading ? (
          <Card withBorder p="xl">
            <Text ta="center" c="dimmed">
              Não foi possível carregar as métricas. Tente novamente mais tarde.
            </Text>
          </Card>
        ) : (
          <SimpleGrid cols={{ base: 1, sm: 2, lg: 5 }}>
            {cards.map((card) => (
              <Card key={card.label} withBorder padding="lg" radius="md">
                <Group justify="space-between" align="flex-start">
                  <div>
                    <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                      {card.label}
                    </Text>
                    <Text size="xl" fw={700} mt={4} c={card.color}>
                      {card.value}
                    </Text>
                  </div>
                  <ThemeIcon variant="light" color={card.color} size="lg" radius="md">
                    <card.icon size={20} />
                  </ThemeIcon>
                </Group>
              </Card>
            ))}
          </SimpleGrid>
        )}
      </div>
    </Stack>
  )
}
