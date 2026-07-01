'use client'

import { useEffect, useState } from 'react'
import {
  Stack, Text, Title, Tabs, NumberInput, Button, Card, SimpleGrid,
  LoadingOverlay,
} from '@mantine/core'
import { IconCalculator } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useApuracao } from '@/data/hooks/fiscal/useApuracao'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const TABS_CONFIG = [
  { value: 'ICMS', label: 'ICMS' },
  { value: 'ICMS_ST', label: 'ICMS-ST' },
  { value: 'PIS_COFINS', label: 'PIS/COFINS' },
  { value: 'IPI', label: 'IPI' },
]

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export default function ApuracaoPage() {
  useModuloGuard('FISCAL')
  useEffect(() => { document.title = 'Vizor - Fiscal - Apuração' }, [])

  const { useConsultar, useCalcular } = useApuracao()
  const calcularMutation = useCalcular()

  const [activeTab, setActiveTab] = useState<string>('ICMS')
  const [mes, setMes] = useState<number | ''>(new Date().getMonth() + 1)
  const [ano, setAno] = useState<number | ''>(new Date().getFullYear())

  const periodo = mes && ano ? `${ano}-${String(mes).padStart(2, '0')}` : ''
  const { data: apuracao, isLoading } = useConsultar(activeTab, periodo)

  function handleRecalcular() {
    if (!activeTab || !periodo) {
      notifications.show({
        title: 'Campos obrigatórios',
        message: 'Informe o período (mês/ano) para recalcular.',
        color: 'orange',
      })
      return
    }

    calcularMutation.mutate(
      { tipo: activeTab, periodo },
      {
        onSuccess: () => {
          notifications.show({
            title: 'Apuração recalculada',
            message: `Apuração de ${activeTab} para ${periodo} recalculada com sucesso.`,
            color: 'green',
          })
        },
        onError: (error: any) => {
          notifications.show({
            title: 'Erro ao recalcular',
            message: error?.response?.data?.message || 'Não foi possível recalcular a apuração.',
            color: 'red',
          })
        },
      }
    )
  }

  const hasData = !!apuracao && !!apuracao.id

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">Início / Fiscal / Apuração</Text>
      <Title order={3}>Apuração de Impostos</Title>

      <Tabs value={activeTab} onChange={(val) => setActiveTab(val || 'ICMS')}>
        <Tabs.List>
          {TABS_CONFIG.map((tab) => (
            <Tabs.Tab key={tab.value} value={tab.value}>
              {tab.label}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        {TABS_CONFIG.map((tab) => (
          <Tabs.Panel key={tab.value} value={tab.value} pt="md">
            <Stack gap="md">
              <Card withBorder p="lg">
                <Stack gap="sm">
                  <Text fw={600}>Período — {tab.label}</Text>

                  <SimpleGrid cols={{ base: 1, sm: 3 }} spacing="md">
                    <NumberInput
                      label="Mês"
                      placeholder="MM"
                      min={1}
                      max={12}
                      value={mes}
                      onChange={(val) => setMes(val as number | '')}
                    />
                    <NumberInput
                      label="Ano"
                      placeholder="AAAA"
                      min={2000}
                      max={2100}
                      value={ano}
                      onChange={(val) => setAno(val as number | '')}
                    />
                    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <Button
                        leftSection={<IconCalculator size={16} />}
                        onClick={handleRecalcular}
                        loading={calcularMutation.isPending}
                        fullWidth
                      >
                        Recalcular
                      </Button>
                    </div>
                  </SimpleGrid>
                </Stack>
              </Card>

              <Card withBorder p="lg">
                <div style={{ position: 'relative', minHeight: 120 }}>
                  <LoadingOverlay visible={isLoading || calcularMutation.isPending} />

                  {!isLoading && !hasData ? (
                    <Stack align="center" py="xl">
                      <Text ta="center" c="dimmed">
                        Nenhum dado de apuração para o período selecionado.
                      </Text>
                      <Text ta="center" c="dimmed" size="sm">
                        Clique em &quot;Recalcular&quot; para gerar a apuração.
                      </Text>
                    </Stack>
                  ) : hasData ? (
                    <Stack gap="md">
                      <Text fw={600}>Resumo — {tab.label} ({periodo})</Text>
                      <SimpleGrid cols={{ base: 1, sm: 2, md: 4 }} spacing="md">
                        <Card withBorder p="md" radius="md">
                          <Text size="sm" c="dimmed">Base de Cálculo</Text>
                          <Text size="lg" fw={700}>
                            {formatCurrency((apuracao.totalDebitos ?? 0) + (apuracao.totalCreditos ?? 0))}
                          </Text>
                        </Card>
                        <Card withBorder p="md" radius="md">
                          <Text size="sm" c="dimmed">Créditos</Text>
                          <Text size="lg" fw={700} c="green">
                            {formatCurrency(apuracao.totalCreditos ?? 0)}
                          </Text>
                        </Card>
                        <Card withBorder p="md" radius="md">
                          <Text size="sm" c="dimmed">Débitos</Text>
                          <Text size="lg" fw={700} c="red">
                            {formatCurrency(apuracao.totalDebitos ?? 0)}
                          </Text>
                        </Card>
                        <Card withBorder p="md" radius="md">
                          <Text size="sm" c="dimmed">Saldo</Text>
                          <Text
                            size="lg"
                            fw={700}
                            c={apuracao.saldoFinal >= 0 ? 'green' : 'red'}
                          >
                            {formatCurrency(apuracao.saldoFinal ?? 0)}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {apuracao.saldoFinal >= 0 ? 'A compensar' : 'A pagar'}
                          </Text>
                        </Card>
                      </SimpleGrid>

                      {apuracao.fechado && (
                        <Text size="sm" c="dimmed" fs="italic">
                          Esta apuração está fechada e não pode ser alterada.
                        </Text>
                      )}
                    </Stack>
                  ) : null}
                </div>
              </Card>
            </Stack>
          </Tabs.Panel>
        ))}
      </Tabs>
    </Stack>
  )
}
