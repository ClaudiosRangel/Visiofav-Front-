'use client'

import { useEffect, useState } from 'react'
import { Modal, Group, Stack, Text, Badge, Button, Progress, Divider, Box, NumberInput, Textarea, Select } from '@mantine/core'
import { IconPlayerPlay, IconPlayerPause, IconPlayerStop, IconTrash } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

interface ModalApontamentoCompletoProps {
  opened: boolean
  onClose: () => void
  etapa: {
    id: string
    opId: string
    opNumero: string
    clienteNome: string | null
    produtoNome: string | null
    descricao: string | null
    status: string
    quantidade: number
    quantidadeProduzida: number
    percentual: number
    dataEntrega: string | null
    dataInicioReal: string | null
    centroNome: string | null
    tipoProcessoCodigo: string | null
    tiragem: number | null
    tempoSetupMinutos?: number | null
    tempoOperacaoCalculado?: number | null
    prioridade: string
  } | null
  onAction: () => void // callback para recarregar o painel após ação
}

function formatarTempo(minutos: number | null | undefined): string {
  if (!minutos || minutos <= 0) return '00:00'
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function calcularTempoReal(dataInicioReal: string | null): string {
  if (!dataInicioReal) return '00:00'
  const inicio = new Date(dataInicioReal).getTime()
  const agora = Date.now()
  const minutos = Math.floor((agora - inicio) / 60000)
  if (minutos < 0) return '00:00'
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const MOTIVOS_PARADA = [
  { value: 'ACERTO_MAQUINA', label: 'Acerto de Máquina' },
  { value: 'MANUTENCAO', label: 'Manutenção' },
  { value: 'FALTA_MATERIAL', label: 'Falta de Material' },
  { value: 'TROCA_TURNO', label: 'Troca de Turno' },
  { value: 'OUTRO', label: 'Outro' },
]

export default function ModalApontamentoCompleto({ opened, onClose, etapa, onAction }: ModalApontamentoCompletoProps) {
  const [loading, setLoading] = useState('')
  const [tempoRealDisplay, setTempoRealDisplay] = useState('00:00')
  const [quantidadeApontar, setQuantidadeApontar] = useState<number>(0)
  const [quantidadePerda, setQuantidadePerda] = useState<number>(0)
  const [motivoParada, setMotivoParada] = useState('ACERTO_MAQUINA')
  const [observacao, setObservacao] = useState('')

  // Atualizar tempo real a cada segundo
  useEffect(() => {
    if (!opened || !etapa?.dataInicioReal || etapa.status !== 'EM_ANDAMENTO') return
    const interval = setInterval(() => {
      setTempoRealDisplay(calcularTempoReal(etapa.dataInicioReal))
    }, 1000)
    setTempoRealDisplay(calcularTempoReal(etapa.dataInicioReal))
    return () => clearInterval(interval)
  }, [opened, etapa?.dataInicioReal, etapa?.status])

  // Reset form quando abre
  useEffect(() => {
    if (opened) {
      setQuantidadeApontar(0)
      setQuantidadePerda(0)
      setObservacao('')
    }
  }, [opened])

  if (!etapa) return null

  const tempoPrevistoTotal = (etapa.tempoSetupMinutos || 0) + (etapa.tempoOperacaoCalculado || 0)
  const percentualProd = etapa.quantidade > 0
    ? Math.min(100, Math.round((etapa.quantidadeProduzida / etapa.quantidade) * 100))
    : 0
  const perdaPercent = etapa.quantidade > 0 && etapa.quantidadeProduzida > 0
    ? ((etapa.quantidadeProduzida > 0 ? quantidadePerda : 0) / etapa.quantidade * 100).toFixed(1)
    : '0.0'

  async function handleIniciar() {
    setLoading('iniciar')
    try {
      await api.patch(`/pcp/etapas/${etapa!.id}/iniciar`, {})
      notifications.show({ title: 'Sucesso', message: 'Produção iniciada', color: 'green' })
      onAction()
      onClose()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao iniciar', color: 'red' })
    } finally { setLoading('') }
  }

  async function handlePausar() {
    setLoading('pausar')
    try {
      await api.patch(`/pcp/etapas/${etapa!.id}/pausar`, {
        motivoParada,
        observacao: observacao || undefined,
      })
      notifications.show({ title: 'Sucesso', message: 'Produção pausada', color: 'orange' })
      onAction()
      onClose()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao pausar', color: 'red' })
    } finally { setLoading('') }
  }

  async function handleConcluir() {
    setLoading('concluir')
    try {
      // Se houver quantidade para apontar, registra antes de concluir
      if (quantidadeApontar > 0 || quantidadePerda > 0) {
        await api.post(`/pcp/etapas/${etapa!.id}/apontar`, {
          quantidadeProduzida: quantidadeApontar || 0,
          quantidadePerda: quantidadePerda || 0,
          observacao: observacao || undefined,
        })
      }
      await api.patch(`/pcp/etapas/${etapa!.id}/concluir`, {})
      notifications.show({ title: 'Sucesso', message: 'Produção concluída', color: 'green' })
      onAction()
      onClose()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao concluir', color: 'red' })
    } finally { setLoading('') }
  }

  async function handleApontar() {
    if (quantidadeApontar <= 0 && quantidadePerda <= 0) return
    setLoading('apontar')
    try {
      await api.post(`/pcp/etapas/${etapa!.id}/apontar`, {
        quantidadeProduzida: quantidadeApontar || 0,
        quantidadePerda: quantidadePerda || 0,
        observacao: observacao || undefined,
      })
      notifications.show({ title: 'Sucesso', message: 'Apontamento registrado', color: 'green' })
      onAction()
      onClose()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao apontar', color: 'red' })
    } finally { setLoading('') }
  }

  const statusColor = etapa.status === 'EM_ANDAMENTO' ? 'green' : etapa.status === 'PAUSADA' ? 'orange' : 'gray'
  const statusLabel = etapa.status === 'EM_ANDAMENTO' ? 'Em produção' : etapa.status === 'PAUSADA' ? 'Pausada' : 'Pendente'

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={null}
      size="lg"
      padding="lg"
      styles={{ header: { display: 'none' } }}
    >
      <Stack gap="md">
        {/* Header com status e info da máquina */}
        <Box p="md" style={{ background: 'var(--mantine-color-dark-6)', borderRadius: 8 }}>
          <Group justify="space-between" mb="xs">
            <Group gap="sm">
              <Text size="lg" fw={700}>{etapa.centroNome || 'Máquina'}</Text>
              <Badge color={statusColor} size="lg">{statusLabel}</Badge>
            </Group>
            <Badge color={etapa.prioridade === 'URGENTE' ? 'red' : etapa.prioridade === 'ALTA' ? 'orange' : 'blue'} variant="light">
              {etapa.prioridade}
            </Badge>
          </Group>

          {/* Dados da OP */}
          <Group gap="lg" wrap="wrap">
            <Box>
              <Text size="xs" c="dimmed">Nº OP</Text>
              <Text size="sm" fw={600}>{etapa.opNumero}</Text>
            </Box>
            <Box>
              <Text size="xs" c="dimmed">Cliente</Text>
              <Text size="sm">{etapa.clienteNome || '—'}</Text>
            </Box>
            <Box>
              <Text size="xs" c="dimmed">Serviço / Produto</Text>
              <Text size="sm">{etapa.produtoNome || '—'}</Text>
            </Box>
            <Box>
              <Text size="xs" c="dimmed">Entrega</Text>
              <Text size="sm">{etapa.dataEntrega ? new Date(etapa.dataEntrega).toLocaleDateString('pt-BR') : '—'}</Text>
            </Box>
            <Box>
              <Text size="xs" c="dimmed">Quantidade</Text>
              <Text size="sm" fw={600}>{etapa.quantidade?.toLocaleString('pt-BR')}</Text>
            </Box>
          </Group>
          {etapa.descricao && (
            <Text size="xs" c="dimmed" mt="xs">Atividade: {etapa.descricao}</Text>
          )}
        </Box>

        {/* Progresso */}
        <Box>
          <Group justify="space-between" mb={4}>
            <Text size="sm" fw={500}>Progresso</Text>
            <Text size="sm" c="dimmed">{etapa.quantidadeProduzida.toLocaleString('pt-BR')} / {etapa.quantidade.toLocaleString('pt-BR')}</Text>
          </Group>
          <Progress value={percentualProd} color="green" size="xl" />
          <Text ta="center" size="sm" fw={600} mt={4}>{percentualProd}%</Text>
        </Box>

        {/* Tempos */}
        <Group grow>
          <Box p="sm" style={{ background: 'var(--mantine-color-dark-6)', borderRadius: 8, textAlign: 'center' }}>
            <Text size="xs" c="dimmed">Previsto</Text>
            <Text size="lg" fw={700} style={{ fontFamily: 'monospace' }}>{formatarTempo(tempoPrevistoTotal)}</Text>
            <Text size="xs" c="dimmed">{etapa.tiragem?.toLocaleString('pt-BR') || '—'} tiragem</Text>
          </Box>
          <Box p="sm" style={{ background: 'var(--mantine-color-dark-6)', borderRadius: 8, textAlign: 'center' }}>
            <Text size="xs" c="dimmed">Realizado</Text>
            <Text size="lg" fw={700} style={{ fontFamily: 'monospace' }} c={etapa.status === 'EM_ANDAMENTO' ? 'green' : undefined}>
              {etapa.status === 'EM_ANDAMENTO' ? tempoRealDisplay : calcularTempoReal(etapa.dataInicioReal)}
            </Text>
            <Text size="xs" c="dimmed">{etapa.quantidadeProduzida.toLocaleString('pt-BR')} produzido</Text>
          </Box>
        </Group>

        {/* Início / Fim */}
        <Group grow>
          <Box>
            <Text size="xs" c="dimmed">Início Real</Text>
            <Text size="sm">
              {etapa.dataInicioReal ? new Date(etapa.dataInicioReal).toLocaleString('pt-BR') : '—'}
            </Text>
          </Box>
        </Group>

        <Divider />

        {/* Formulário de Apontamento */}
        {(etapa.status === 'EM_ANDAMENTO' || etapa.status === 'PAUSADA') && (
          <Group grow>
            <NumberInput
              label="Qtd Produzida"
              value={quantidadeApontar}
              onChange={(v) => setQuantidadeApontar(Number(v) || 0)}
              min={0}
              thousandSeparator="."
              decimalSeparator=","
            />
            <NumberInput
              label="Qtd Perda"
              value={quantidadePerda}
              onChange={(v) => setQuantidadePerda(Number(v) || 0)}
              min={0}
              thousandSeparator="."
              decimalSeparator=","
            />
          </Group>
        )}

        {/* Motivo de parada (só para ações de pausar) */}
        {etapa.status === 'EM_ANDAMENTO' && (
          <Select
            label="Motivo da Parada (para pausar)"
            data={MOTIVOS_PARADA}
            value={motivoParada}
            onChange={(v) => setMotivoParada(v || 'OUTRO')}
          />
        )}

        <Textarea
          label="Observação"
          value={observacao}
          onChange={(e) => setObservacao(e.target.value)}
          rows={2}
          placeholder="Observação opcional..."
        />

        <Divider />

        {/* Botões de Ação */}
        <Group justify="space-between" wrap="wrap">
          {/* Iniciar Acerto / Retomar */}
          {(etapa.status === 'PENDENTE' || etapa.status === 'PAUSADA') && (
            <Button
              leftSection={<IconPlayerPlay size={16} />}
              color="green"
              onClick={handleIniciar}
              loading={loading === 'iniciar'}
            >
              {etapa.status === 'PAUSADA' ? 'Retomar Produção' : 'Iniciar Acerto'}
            </Button>
          )}

          {/* Pausar */}
          {etapa.status === 'EM_ANDAMENTO' && (
            <Button
              leftSection={<IconPlayerPause size={16} />}
              color="orange"
              onClick={handlePausar}
              loading={loading === 'pausar'}
            >
              Pausar Produção
            </Button>
          )}

          {/* Apontar (registrar parcial) */}
          {(etapa.status === 'EM_ANDAMENTO' || etapa.status === 'PAUSADA') && (
            <Button
              variant="light"
              onClick={handleApontar}
              loading={loading === 'apontar'}
              disabled={quantidadeApontar <= 0 && quantidadePerda <= 0}
            >
              Apontar
            </Button>
          )}

          {/* Encerrar Produção */}
          {(etapa.status === 'EM_ANDAMENTO' || etapa.status === 'PAUSADA') && (
            <Button
              leftSection={<IconPlayerStop size={16} />}
              color="red"
              variant="light"
              onClick={handleConcluir}
              loading={loading === 'concluir'}
            >
              Encerrar Produção
            </Button>
          )}
        </Group>
      </Stack>
    </Modal>
  )
}
