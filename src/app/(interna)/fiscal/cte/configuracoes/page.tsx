'use client'

import { useEffect, useState } from 'react'
import { Paper, Title, Text, Select, Button, Group, Divider, Grid, TextInput, NumberInput } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { useModuloGuard } from '@/hooks/useModuloGuard'
import { useCte } from '@/data/hooks/fiscal/useCte'

export default function CteConfiguracoesPage() {
  useModuloGuard('FISCAL')

  const { useDefaults, useSalvarDefaults } = useCte()
  const { data: defaults, isLoading } = useDefaults()
  const salvarMutation = useSalvarDefaults()

  const [naturezaOp, setNaturezaOp] = useState('')
  const [modal, setModal] = useState('01')
  const [serie, setSerie] = useState(1)
  const [rntrc, setRntrc] = useState('')
  const [cstIcms, setCstIcms] = useState('00')
  const [aliqIcms, setAliqIcms] = useState(12)
  const [seguradora, setSeguradora] = useState('')
  const [apolice, setApolice] = useState('')
  const [dacteModelo, setDacteModelo] = useState('1')
  const [dacteOrientacao, setDacteOrientacao] = useState('retrato')

  useEffect(() => {
    if (defaults) {
      setNaturezaOp(defaults.naturezaOp || '')
      setModal(defaults.modal || '01')
      setSerie(defaults.serie || 1)
      setRntrc(defaults.rntrc || '')
      setCstIcms(defaults.cstIcms || '00')
      setAliqIcms(defaults.aliqIcms || 12)
      setSeguradora(defaults.seguradora || '')
      setApolice(defaults.apolice || '')
      setDacteModelo((defaults as any).dacteModelo || '1')
      setDacteOrientacao((defaults as any).dacteOrientacao || 'retrato')
    }
  }, [defaults])

  function salvar() {
    salvarMutation.mutate({
      naturezaOp,
      modal,
      serie,
      rntrc,
      cstIcms,
      aliqIcms,
      seguradora,
      apolice,
      dacteModelo,
      dacteOrientacao,
    }, {
      onSuccess: () => notifications.show({ title: 'Salvo', message: 'Configurações atualizadas', color: 'green' }),
      onError: (err: any) => notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao salvar', color: 'red' }),
    })
  }

  if (isLoading) return <Paper p="md"><Text>Carregando...</Text></Paper>

  return (
    <Paper p="md">
      <Title order={3} mb="md">Configurações CT-e</Title>
      <Text size="sm" c="dimmed" mb="lg">
        Defina os valores padrão para emissão de CT-e e a preferência de layout do DACTE.
      </Text>

      <Grid>
        <Grid.Col span={6}>
          <TextInput label="Natureza da Operação" value={naturezaOp} onChange={(e) => setNaturezaOp(e.target.value)} />
        </Grid.Col>
        <Grid.Col span={3}>
          <Select label="Modal" data={[
            { value: '01', label: '01 - Rodoviário' },
            { value: '02', label: '02 - Aéreo' },
            { value: '03', label: '03 - Aquaviário' },
            { value: '04', label: '04 - Ferroviário' },
            { value: '05', label: '05 - Dutoviário' },
            { value: '06', label: '06 - Multimodal' },
          ]} value={modal} onChange={(v) => setModal(v || '01')} />
        </Grid.Col>
        <Grid.Col span={3}>
          <NumberInput label="Série" value={serie} onChange={(v) => setSerie(Number(v) || 1)} min={1} />
        </Grid.Col>

        <Grid.Col span={4}>
          <TextInput label="RNTRC" value={rntrc} onChange={(e) => setRntrc(e.target.value)} maxLength={8} />
        </Grid.Col>
        <Grid.Col span={4}>
          <Select label="CST ICMS" data={[
            { value: '00', label: '00 - Tributação normal' },
            { value: '20', label: '20 - Com redução de BC' },
            { value: '40', label: '40 - Isenta' },
            { value: '41', label: '41 - Não tributada' },
            { value: '60', label: '60 - ICMS cobrado por ST' },
            { value: '90', label: '90 - Outros' },
            { value: 'SN', label: 'SN - Simples Nacional' },
          ]} value={cstIcms} onChange={(v) => setCstIcms(v || '00')} />
        </Grid.Col>
        <Grid.Col span={4}>
          <NumberInput label="Alíquota ICMS (%)" value={aliqIcms} onChange={(v) => setAliqIcms(Number(v) || 0)} decimalScale={2} />
        </Grid.Col>

        <Grid.Col span={6}>
          <TextInput label="Seguradora Padrão" value={seguradora} onChange={(e) => setSeguradora(e.target.value)} />
        </Grid.Col>
        <Grid.Col span={6}>
          <TextInput label="Apólice Padrão" value={apolice} onChange={(e) => setApolice(e.target.value)} />
        </Grid.Col>
      </Grid>

      <Divider my="lg" label="Layout do DACTE" labelPosition="center" />

      <Grid>
        <Grid.Col span={6}>
          <Select
            label="Modelo do DACTE"
            description="Modelo 1: layout original. Modelo 2: estilo ACBr com canhoto no topo."
            data={[
              { value: '1', label: 'Modelo 1 — Padrão' },
              { value: '2', label: 'Modelo 2 — Com canhoto e QR Code' },
            ]}
            value={dacteModelo}
            onChange={(v) => setDacteModelo(v || '1')}
          />
        </Grid.Col>
        <Grid.Col span={6}>
          <Select
            label="Orientação do DACTE"
            description="Retrato (vertical) ou Paisagem (horizontal)"
            data={[
              { value: 'retrato', label: 'Retrato (A4 vertical)' },
              { value: 'paisagem', label: 'Paisagem (A4 horizontal)' },
            ]}
            value={dacteOrientacao}
            onChange={(v) => setDacteOrientacao(v || 'retrato')}
          />
        </Grid.Col>
      </Grid>

      <Group justify="flex-end" mt="xl">
        <Button onClick={salvar} loading={salvarMutation.isPending}>
          Salvar Configurações
        </Button>
      </Group>
    </Paper>
  )
}
