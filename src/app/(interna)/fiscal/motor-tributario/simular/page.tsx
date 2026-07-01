'use client'

import { useState, useEffect } from 'react'
import {
  TextInput,
  Select,
  Button,
  Badge,
  Alert,
  Card,
  Stack,
  Title,
  Text,
  SimpleGrid,
  LoadingOverlay,
} from '@mantine/core'
import { IconSearch, IconAlertTriangle } from '@tabler/icons-react'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useMotorTributario } from '@/data/hooks/fiscal/useMotorTributario'
import type { SimulacaoMotorResponse } from '@/data/hooks/fiscal/types'

const UF_OPTIONS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
].map((uf) => ({ value: uf, label: uf }))

const REGIME_OPTIONS = [
  { value: '1', label: '1 - Simples Nacional' },
  { value: '2', label: '2 - SN Excesso' },
  { value: '3', label: '3 - Regime Normal' },
]

const FALLBACK_COLORS: Record<string, string> = {
  EXATO: 'green',
  NCM_PARCIAL: 'teal',
  CFOP_GENERICO: 'yellow',
  PADRAO_REGIME: 'orange',
}

const FALLBACK_LABELS: Record<string, string> = {
  EXATO: 'Exato',
  NCM_PARCIAL: 'NCM Parcial',
  CFOP_GENERICO: 'CFOP Genérico',
  PADRAO_REGIME: 'Padrão Regime',
}

export default function SimularMotorTributarioPage() {
  useModuloGuard('FISCAL')
  useEffect(() => { document.title = 'Vizor - Fiscal - Motor Tributário - Simular' }, [])

  const [ncm, setNcm] = useState('')
  const [cfop, setCfop] = useState('')
  const [ufOrigem, setUfOrigem] = useState<string | null>(null)
  const [ufDestino, setUfDestino] = useState<string | null>(null)
  const [regime, setRegime] = useState<string | null>(null)
  const [resultado, setResultado] = useState<SimulacaoMotorResponse | null>(null)

  const { useSimular } = useMotorTributario()
  const simular = useSimular()

  function handleSimular() {
    if (!ncm || !cfop || !ufOrigem || !ufDestino || !regime) return

    simular.mutate(
      {
        ncm,
        cfop,
        ufOrigem,
        ufDestino,
        regime,
      },
      {
        onSuccess: (data) => {
          setResultado(data)
        },
      },
    )
  }

  const isFormValid = ncm && cfop && ufOrigem && ufDestino && regime

  return (
    <Stack gap="md">
      <Text size="sm" c="dimmed">Início / Fiscal / Motor Tributário / Simular</Text>
      <Title order={3}>Simulação do Motor Tributário</Title>

      <Card withBorder p="lg" radius="md">
        <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
          <TextInput
            label="NCM"
            placeholder="00000000"
            value={ncm}
            onChange={(e) => setNcm(e.currentTarget.value)}
            maxLength={8}
          />
          <TextInput
            label="CFOP"
            placeholder="0000"
            value={cfop}
            onChange={(e) => setCfop(e.currentTarget.value)}
            maxLength={4}
          />
          <Select
            label="UF Origem"
            placeholder="Selecione"
            data={UF_OPTIONS}
            value={ufOrigem}
            onChange={setUfOrigem}
            searchable
          />
          <Select
            label="UF Destino"
            placeholder="Selecione"
            data={UF_OPTIONS}
            value={ufDestino}
            onChange={setUfDestino}
            searchable
          />
          <Select
            label="Regime Tributário"
            placeholder="Selecione"
            data={REGIME_OPTIONS}
            value={regime}
            onChange={setRegime}
          />
        </SimpleGrid>

        <Button
          mt="md"
          leftSection={<IconSearch size={16} />}
          onClick={handleSimular}
          loading={simular.isPending}
          disabled={!isFormValid}
        >
          Simular
        </Button>
      </Card>

      {/* Result area */}
      <div style={{ position: 'relative', minHeight: simular.isPending ? 80 : 0 }}>
        <LoadingOverlay visible={simular.isPending} />

        {resultado && resultado.encontrada && resultado.regra && (
          <Card withBorder p="lg" radius="md">
            <Stack gap="sm">
              <Title order={5}>
                Regra Encontrada{' '}
                {resultado.nivelFallback && (
                  <Badge
                    color={FALLBACK_COLORS[resultado.nivelFallback] || 'gray'}
                    variant="filled"
                    size="sm"
                    ml="xs"
                  >
                    {FALLBACK_LABELS[resultado.nivelFallback] || resultado.nivelFallback}
                  </Badge>
                )}
              </Title>

              <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="sm">
                <Text size="sm">
                  <Text span fw={600}>NCM:</Text> {resultado.regra.ncm}
                </Text>
                <Text size="sm">
                  <Text span fw={600}>CFOP:</Text> {resultado.regra.cfop}
                </Text>
                <Text size="sm">
                  <Text span fw={600}>UF Origem:</Text> {resultado.regra.ufOrigem}
                </Text>
                <Text size="sm">
                  <Text span fw={600}>UF Destino:</Text> {resultado.regra.ufDestino}
                </Text>
                <Text size="sm">
                  <Text span fw={600}>Regime:</Text> {resultado.regra.regime}
                </Text>
                <Text size="sm">
                  <Text span fw={600}>CST/CSOSN:</Text> {resultado.regra.cstCsosn || '—'}
                </Text>
                <Text size="sm">
                  <Text span fw={600}>Alíq. ICMS:</Text> {resultado.regra.aliqIcms}%
                </Text>
                <Text size="sm">
                  <Text span fw={600}>Alíq. PIS:</Text> {resultado.regra.aliqPis}%
                </Text>
                <Text size="sm">
                  <Text span fw={600}>Alíq. COFINS:</Text> {resultado.regra.aliqCofins}%
                </Text>
                <Text size="sm">
                  <Text span fw={600}>Alíq. IPI:</Text> {resultado.regra.aliqIpi}%
                </Text>
              </SimpleGrid>
            </Stack>
          </Card>
        )}

        {resultado && !resultado.encontrada && (
          <Alert
            icon={<IconAlertTriangle size={20} />}
            title="Nenhuma regra encontrada"
            color="red"
            variant="light"
          >
            Nenhuma regra tributária atende aos critérios informados. O item seria bloqueado na emissão.
          </Alert>
        )}
      </div>
    </Stack>
  )
}
