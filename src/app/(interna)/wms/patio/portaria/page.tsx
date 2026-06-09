'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, TextInput, Select, Button, Alert, Stack,
  SimpleGrid, Modal,
} from '@mantine/core'
import {
  IconTruckLoading, IconTruckReturn, IconCheck, IconAlertCircle,
  IconSearch,
} from '@tabler/icons-react'
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

export default function PatioPortariaPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - Pátio - Portaria' }, [])

  const [modo, setModo] = useState<'menu' | 'entrada' | 'saida'>('menu')
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null)

  // Entrada state
  const [placaEntrada, setPlacaEntrada] = useState('')
  const [motorista, setMotorista] = useState('')
  const [tipoOp, setTipoOp] = useState<string | null>(null)

  // Saída state
  const [placaSaida, setPlacaSaida] = useState('')
  const [veiculoEncontrado, setVeiculoEncontrado] = useState<any>(null)
  const [confirmSaidaOpen, setConfirmSaidaOpen] = useState(false)

  const mutationEntrada = useMutation({
    mutationFn: async () => {
      const { data } = await api.post('/patio/veiculos/entrada', {
        placa: placaEntrada.replace('-', ''),
        motoristaNome: motorista,
        tipoOperacao: tipoOp,
      })
      return data
    },
    onSuccess: (data) => {
      setMensagem({ tipo: 'success', texto: `Entrada registrada! Posição na fila: ${data.posicaoFila || data.posicao || 1}` })
      setPlacaEntrada('')
      setMotorista('')
      setTipoOp(null)
    },
    onError: (err: any) => {
      setMensagem({ tipo: 'error', texto: err?.response?.data?.message || 'Erro ao registrar entrada' })
    },
  })

  const mutationBuscaSaida = useMutation({
    mutationFn: async () => {
      const { data } = await api.get('/patio/veiculos/busca', {
        params: { placa: placaSaida.replace('-', '') },
      })
      return data
    },
    onSuccess: (data) => {
      if (data) {
        setVeiculoEncontrado(data)
        setConfirmSaidaOpen(true)
        setMensagem(null)
      } else {
        setMensagem({ tipo: 'error', texto: 'Veículo não encontrado no pátio' })
        setVeiculoEncontrado(null)
      }
    },
    onError: (err: any) => {
      setMensagem({ tipo: 'error', texto: err?.response?.data?.message || 'Veículo não encontrado' })
      setVeiculoEncontrado(null)
    },
  })

  const mutationSaida = useMutation({
    mutationFn: async () => {
      await api.post(`/patio/veiculos/${veiculoEncontrado.id}/saida`)
    },
    onSuccess: () => {
      setMensagem({ tipo: 'success', texto: 'Saída registrada com sucesso!' })
      setPlacaSaida('')
      setVeiculoEncontrado(null)
      setConfirmSaidaOpen(false)
    },
    onError: (err: any) => {
      setMensagem({ tipo: 'error', texto: err?.response?.data?.message || 'Erro ao registrar saída' })
    },
  })

  const handleEntrada = (e: React.FormEvent) => {
    e.preventDefault()
    setMensagem(null)
    if (!placaEntrada || !motorista || !tipoOp) {
      setMensagem({ tipo: 'error', texto: 'Preencha todos os campos' })
      return
    }
    mutationEntrada.mutate()
  }

  const handleBuscaSaida = (e: React.FormEvent) => {
    e.preventDefault()
    setMensagem(null)
    if (!placaSaida) {
      setMensagem({ tipo: 'error', texto: 'Informe a placa' })
      return
    }
    mutationBuscaSaida.mutate()
  }

  // Menu principal
  if (modo === 'menu') {
    return (
      <div style={{ padding: '1rem', maxWidth: 500, margin: '0 auto' }}>
        <Text size="xs" c="dimmed" mb={4} ta="center">WMS / Pátio / Portaria</Text>
        <Text size="xl" fw={600} mb="xl" ta="center">Portaria</Text>

        <Stack gap="lg">
          <Button
            size="xl"
            h={120}
            fullWidth
            color="green"
            leftSection={<IconTruckLoading size={32} />}
            onClick={() => { setModo('entrada'); setMensagem(null) }}
            styles={{ label: { fontSize: '1.5rem' } }}
          >
            Entrada
          </Button>

          <Button
            size="xl"
            h={120}
            fullWidth
            color="blue"
            leftSection={<IconTruckReturn size={32} />}
            onClick={() => { setModo('saida'); setMensagem(null) }}
            styles={{ label: { fontSize: '1.5rem' } }}
          >
            Saída
          </Button>
        </Stack>
      </div>
    )
  }

  // Formulário de Entrada
  if (modo === 'entrada') {
    return (
      <div style={{ padding: '1rem', maxWidth: 500, margin: '0 auto' }}>
        <Text size="xs" c="dimmed" mb={4} ta="center">WMS / Pátio / Portaria</Text>
        <Text size="xl" fw={600} mb="md" ta="center">Entrada de Veículo</Text>

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
          <form onSubmit={handleEntrada}>
            <TextInput
              label="Placa"
              placeholder="AAA-1234"
              value={placaEntrada}
              onChange={(e) => setPlacaEntrada(formatPlaca(e.currentTarget.value))}
              maxLength={8}
              size="lg"
              required
              mb="md"
              className="font-mono"
            />

            <TextInput
              label="Motorista"
              placeholder="Nome do motorista"
              value={motorista}
              onChange={(e) => setMotorista(e.currentTarget.value)}
              size="lg"
              required
              mb="md"
            />

            <Select
              label="Tipo de Operação"
              placeholder="Selecione"
              data={TIPO_OPERACAO_OPTIONS}
              value={tipoOp}
              onChange={setTipoOp}
              size="lg"
              required
              mb="lg"
            />

            <Stack gap="sm">
              <Button
                type="submit"
                size="lg"
                fullWidth
                color="green"
                leftSection={<IconTruckLoading size={20} />}
                loading={mutationEntrada.isPending}
              >
                Registrar Entrada
              </Button>
              <Button
                variant="default"
                size="lg"
                fullWidth
                onClick={() => { setModo('menu'); setMensagem(null) }}
              >
                Voltar
              </Button>
            </Stack>
          </form>
        </Card>
      </div>
    )
  }

  // Formulário de Saída
  return (
    <div style={{ padding: '1rem', maxWidth: 500, margin: '0 auto' }}>
      <Text size="xs" c="dimmed" mb={4} ta="center">WMS / Pátio / Portaria</Text>
      <Text size="xl" fw={600} mb="md" ta="center">Saída de Veículo</Text>

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
        <form onSubmit={handleBuscaSaida}>
          <TextInput
            label="Placa do Veículo"
            placeholder="AAA-1234"
            value={placaSaida}
            onChange={(e) => setPlacaSaida(formatPlaca(e.currentTarget.value))}
            maxLength={8}
            size="lg"
            required
            mb="lg"
            className="font-mono"
            leftSection={<IconSearch size={20} />}
          />

          <Stack gap="sm">
            <Button
              type="submit"
              size="lg"
              fullWidth
              color="blue"
              leftSection={<IconSearch size={20} />}
              loading={mutationBuscaSaida.isPending}
            >
              Buscar Veículo
            </Button>
            <Button
              variant="default"
              size="lg"
              fullWidth
              onClick={() => { setModo('menu'); setMensagem(null) }}
            >
              Voltar
            </Button>
          </Stack>
        </form>
      </Card>

      {/* Modal de Confirmação de Saída */}
      <Modal
        opened={confirmSaidaOpen}
        onClose={() => setConfirmSaidaOpen(false)}
        title="Confirmar Saída"
        centered
      >
        {veiculoEncontrado && (
          <div>
            <Text size="sm" mb="xs">
              <strong>Placa:</strong> {veiculoEncontrado.placa}
            </Text>
            <Text size="sm" mb="xs">
              <strong>Motorista:</strong> {veiculoEncontrado.motoristaNome}
            </Text>
            <Text size="sm" mb="xs">
              <strong>Operação:</strong> {veiculoEncontrado.tipoOperacao}
            </Text>
            <Text size="sm" mb="md">
              <strong>Entrada:</strong>{' '}
              {veiculoEncontrado.entradaEm
                ? new Date(veiculoEncontrado.entradaEm).toLocaleString('pt-BR')
                : '—'}
            </Text>

            <Group justify="flex-end">
              <Button variant="default" onClick={() => setConfirmSaidaOpen(false)}>
                Cancelar
              </Button>
              <Button
                color="blue"
                leftSection={<IconTruckReturn size={18} />}
                onClick={() => mutationSaida.mutate()}
                loading={mutationSaida.isPending}
              >
                Confirmar Saída
              </Button>
            </Group>
          </div>
        )}
      </Modal>
    </div>
  )
}
