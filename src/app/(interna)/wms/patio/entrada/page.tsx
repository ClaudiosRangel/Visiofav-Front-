'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, TextInput, Select, Button, Alert,
} from '@mantine/core'
import { IconTruckLoading, IconCheck, IconAlertCircle } from '@tabler/icons-react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const TIPO_OPERACAO_OPTIONS = [
  { value: 'CARGA', label: 'Carga' },
  { value: 'DESCARGA', label: 'Descarga' },
]

function formatPlaca(value: string): string {
  const clean = value.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (clean.length <= 3) return clean
  if (clean.length <= 7) return clean.slice(0, 3) + '-' + clean.slice(3)
  return clean.slice(0, 3) + '-' + clean.slice(3, 7)
}

function isPlacaValida(placa: string): boolean {
  const clean = placa.replace(/[^A-Z0-9]/gi, '')
  // Placa antiga: AAA1234 ou Mercosul: AAA1A23
  return /^[A-Z]{3}[0-9]{4}$/.test(clean) || /^[A-Z]{3}[0-9][A-Z][0-9]{2}$/.test(clean)
}

export default function PatioEntradaPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'Vizor - WMS - Pátio - Entrada' }, [])

  const [placa, setPlaca] = useState('')
  const [motoristaNome, setMotoristaNome] = useState('')
  const [motoristaDocumento, setMotoristaDocumento] = useState('')
  const [transportadoraId, setTransportadoraId] = useState<string | null>(null)
  const [tipoOperacao, setTipoOperacao] = useState<string | null>(null)
  const [cdId, setCdId] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState<{ posicao: number } | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const { data: transportadoras } = useQuery<any[]>({
    queryKey: ['transportadoras-select'],
    queryFn: async () => {
      const { data } = await api.get('/transportadoras')
      return (data?.data || data || []).map((t: any) => ({
        value: String(t.id),
        label: t.nomeFantasia || t.razaoSocial || t.nome,
      }))
    },
  })

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

  const mutation = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/patio/veiculos/entrada', {
        placa: placa.replace('-', ''),
        motoristaNome,
        motoristaDocumento,
        transportadoraId: transportadoraId ? Number(transportadoraId) : undefined,
        tipoOperacao,
        cdId: cdId ? Number(cdId) : undefined,
      })
      return data
    },
    onSuccess: (data) => {
      setSucesso({ posicao: data.posicaoFila || data.posicao || 1 })
      setErro(null)
      setPlaca('')
      setMotoristaNome('')
      setMotoristaDocumento('')
      setTransportadoraId(null)
      setTipoOperacao(null)
    },
    onError: (err: any) => {
      setErro(err?.response?.data?.message || 'Erro ao registrar entrada')
      setSucesso(null)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)
    setSucesso(null)

    if (!isPlacaValida(placa)) {
      setErro('Placa inválida. Use formato AAA-1234 ou AAA-1A23')
      return
    }
    if (!motoristaNome.trim()) {
      setErro('Nome do motorista é obrigatório')
      return
    }
    if (!tipoOperacao) {
      setErro('Tipo de operação é obrigatório')
      return
    }

    mutation.mutate()
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Pátio / Entrada</Text>
      <Text size="xl" fw={600} mb="lg">Registrar Entrada de Veículo</Text>

      {sucesso && (
        <Alert icon={<IconCheck size={16} />} color="green" mb="md" withCloseButton onClose={() => setSucesso(null)}>
          Entrada registrada com sucesso! Posição na fila: <strong>{sucesso.posicao}</strong>
        </Alert>
      )}

      {erro && (
        <Alert icon={<IconAlertCircle size={16} />} color="red" mb="md" withCloseButton onClose={() => setErro(null)}>
          {erro}
        </Alert>
      )}

      <Card withBorder padding="lg">
        <form onSubmit={handleSubmit}>
          <TextInput
            label="Placa"
            placeholder="AAA-1234"
            value={placa}
            onChange={(e) => setPlaca(formatPlaca(e.currentTarget.value))}
            maxLength={8}
            required
            mb="md"
            className="font-mono"
          />

          <TextInput
            label="Nome do Motorista"
            placeholder="Nome completo"
            value={motoristaNome}
            onChange={(e) => setMotoristaNome(e.currentTarget.value)}
            required
            mb="md"
          />

          <TextInput
            label="Documento do Motorista"
            placeholder="CPF ou RG"
            value={motoristaDocumento}
            onChange={(e) => setMotoristaDocumento(e.currentTarget.value)}
            mb="md"
          />

          <Select
            label="Transportadora"
            placeholder="Selecione a transportadora"
            data={transportadoras || []}
            value={transportadoraId}
            onChange={setTransportadoraId}
            searchable
            clearable
            mb="md"
          />

          <Select
            label="Tipo de Operação"
            placeholder="Selecione"
            data={TIPO_OPERACAO_OPTIONS}
            value={tipoOperacao}
            onChange={setTipoOperacao}
            required
            mb="md"
          />

          <Select
            label="Centro de Distribuição"
            placeholder="Selecione o CD"
            data={cds || []}
            value={cdId}
            onChange={setCdId}
            searchable
            clearable
            mb="lg"
          />

          <Group>
            <Button
              type="submit"
              leftSection={<IconTruckLoading size={18} />}
              loading={mutation.isPending}
            >
              Registrar Entrada
            </Button>
          </Group>
        </form>
      </Card>
    </div>
  )
}
