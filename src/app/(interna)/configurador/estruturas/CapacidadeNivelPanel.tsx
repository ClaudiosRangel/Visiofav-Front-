'use client'

import { useState } from 'react'
import {
  Card, Group, Text, Table, Badge, Button, ActionIcon, Tooltip,
  Modal, TextInput, NumberInput, SimpleGrid, LoadingOverlay, Alert,
  Progress, Stack, Switch,
} from '@mantine/core'
import {
  IconPlus, IconEdit, IconTrash, IconCheck, IconX,
  IconWeight, IconCube, IconPackage, IconAlertTriangle,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import {
  useCapacidadesNivel,
  useOcupacaoNivel,
  useCriarCapacidadeNivel,
  useAtualizarCapacidadeNivel,
  useExcluirCapacidadeNivel,
  CapacidadeNivel,
  OcupacaoNivel,
} from '@/data/hooks/useCapacidadeNivel'

interface CapacidadeNivelPanelProps {
  estruturaId: string
  estruturaDescricao: string
  onClose: () => void
}

interface FormState {
  codigoNivel: string
  pesoMaximo: number | null
  volumeMaximo: number | null
  paletesMaximo: number | null
  status: boolean
}

const emptyForm: FormState = {
  codigoNivel: '',
  pesoMaximo: null,
  volumeMaximo: null,
  paletesMaximo: null,
  status: true,
}

function getAlertColor(alertLevel: string): string {
  switch (alertLevel) {
    case 'CRITICO': return 'red'
    case 'ALERTA': return 'yellow'
    default: return 'green'
  }
}

function getProgressColor(percentual: number): string {
  if (percentual >= 95) return 'red'
  if (percentual >= 80) return 'yellow'
  return 'green'
}

export default function CapacidadeNivelPanel({ estruturaId, estruturaDescricao, onClose }: CapacidadeNivelPanelProps) {
  const { data: capacidadesResp, isLoading } = useCapacidadesNivel(estruturaId)
  const { data: ocupacaoResp, isLoading: loadingOcupacao } = useOcupacaoNivel(estruturaId)
  const criarMutation = useCriarCapacidadeNivel()
  const atualizarMutation = useAtualizarCapacidadeNivel()
  const excluirMutation = useExcluirCapacidadeNivel()

  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const capacidades = capacidadesResp?.data || []
  const ocupacoes = ocupacaoResp?.data || []

  function getOcupacao(codigoNivel: string): OcupacaoNivel | undefined {
    return ocupacoes.find((o) => o.codigoNivel === codigoNivel)
  }

  function openNew() {
    setEditingId(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  function openEdit(item: CapacidadeNivel) {
    setEditingId(item.id)
    setForm({
      codigoNivel: item.codigoNivel,
      pesoMaximo: item.pesoMaximo != null ? Number(item.pesoMaximo) : null,
      volumeMaximo: item.volumeMaximo != null ? Number(item.volumeMaximo) : null,
      paletesMaximo: item.paletesMaximo,
      status: item.status,
    })
    setModalOpen(true)
  }

  async function handleSave() {
    if (!form.codigoNivel.trim()) {
      notifications.show({ title: 'Erro', message: 'Código do nível é obrigatório', color: 'red' })
      return
    }

    const peso = form.pesoMaximo ?? 0
    const volume = form.volumeMaximo ?? 0
    const paletes = form.paletesMaximo ?? 0
    if (peso <= 0 && volume <= 0 && paletes <= 0) {
      notifications.show({ title: 'Erro', message: 'Pelo menos um limite (peso, volume ou paletes) deve ser maior que zero', color: 'red' })
      return
    }

    try {
      if (editingId) {
        await atualizarMutation.mutateAsync({
          id: editingId,
          estruturaId,
          codigoNivel: form.codigoNivel,
          pesoMaximo: form.pesoMaximo,
          volumeMaximo: form.volumeMaximo,
          paletesMaximo: form.paletesMaximo,
          status: form.status,
        })
        notifications.show({ title: 'Sucesso', message: 'Capacidade atualizada', color: 'green' })
      } else {
        await criarMutation.mutateAsync({
          estruturaId,
          codigoNivel: form.codigoNivel,
          pesoMaximo: form.pesoMaximo,
          volumeMaximo: form.volumeMaximo,
          paletesMaximo: form.paletesMaximo,
          status: form.status,
        })
        notifications.show({ title: 'Sucesso', message: 'Capacidade criada', color: 'green' })
      }
      setModalOpen(false)
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao salvar', color: 'red' })
    }
  }

  async function handleDelete(id: string) {
    try {
      await excluirMutation.mutateAsync({ id, estruturaId })
      notifications.show({ title: 'Sucesso', message: 'Configuração excluída', color: 'green' })
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao excluir', color: 'red' })
    }
    setConfirmDeleteId(null)
  }

  return (
    <div>
      {/* Configuration Table */}
      <Card pos="relative" mb="md">
        <LoadingOverlay visible={isLoading} />
        <Group justify="space-between" mb="md">
          <div>
            <Text fw={600}>Capacidade por Nível</Text>
            <Text size="sm" c="dimmed">{estruturaDescricao}</Text>
          </div>
          <Group>
            <Button leftSection={<IconPlus size={16} />} onClick={openNew}>Novo Nível</Button>
            <Button variant="default" onClick={onClose}>Fechar</Button>
          </Group>
        </Group>

        {capacidades.length === 0 && !isLoading && (
          <Alert icon={<IconPackage size={16} />} color="blue" variant="light">
            Nenhuma configuração de capacidade por nível. Adicione níveis para controlar peso, volume e paletes.
          </Alert>
        )}

        {capacidades.length > 0 && (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nível</Table.Th>
                <Table.Th>Peso Máximo (kg)</Table.Th>
                <Table.Th>Volume Máximo (m³)</Table.Th>
                <Table.Th>Paletes Máximo</Table.Th>
                <Table.Th>Ocupação Atual</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th className="w-24">Ações</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {capacidades.map((item) => {
                const ocupacao = getOcupacao(item.codigoNivel)
                return (
                  <Table.Tr key={item.id}>
                    <Table.Td fw={600}>{item.codigoNivel}</Table.Td>
                    <Table.Td>{item.pesoMaximo != null ? Number(item.pesoMaximo).toLocaleString('pt-BR') : '—'}</Table.Td>
                    <Table.Td>{item.volumeMaximo != null ? Number(item.volumeMaximo).toLocaleString('pt-BR', { minimumFractionDigits: 3 }) : '—'}</Table.Td>
                    <Table.Td>{item.paletesMaximo ?? '—'}</Table.Td>
                    <Table.Td>
                      {ocupacao ? (
                        <Badge color={getAlertColor(ocupacao.alertLevel)} variant="light" size="sm">
                          {ocupacao.alertLevel}
                        </Badge>
                      ) : (
                        <Text size="sm" c="dimmed">—</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Badge color={item.status ? 'green' : 'gray'} variant="light" size="sm">
                        {item.status ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        <Tooltip label="Editar">
                          <ActionIcon variant="subtle" color="gray" onClick={() => openEdit(item)}>
                            <IconEdit size={18} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Excluir">
                          <ActionIcon variant="subtle" color="red" onClick={() => setConfirmDeleteId(item.id)}>
                            <IconTrash size={18} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
        )}
      </Card>

      {/* Occupancy Indicators */}
      {ocupacoes.length > 0 && (
        <Card pos="relative">
          <LoadingOverlay visible={loadingOcupacao} />
          <Group mb="md" gap="xs">
            <IconAlertTriangle size={20} className="text-orange-500" />
            <Text fw={600}>Indicadores de Ocupação</Text>
          </Group>

          <Stack gap="lg">
            {ocupacoes.map((ocupacao) => (
              <Card key={ocupacao.codigoNivel} withBorder p="sm">
                <Group justify="space-between" mb="xs">
                  <Text fw={600} size="sm">Nível {ocupacao.codigoNivel}</Text>
                  <Badge color={getAlertColor(ocupacao.alertLevel)} variant="filled" size="sm">
                    {ocupacao.alertLevel}
                  </Badge>
                </Group>

                <Stack gap="xs">
                  {/* Peso */}
                  {ocupacao.pesoMaximo != null && ocupacao.pesoMaximo > 0 && (
                    <div>
                      <Group justify="space-between" mb={2}>
                        <Group gap={4}>
                          <IconWeight size={14} className="text-zinc-500" />
                          <Text size="xs" c="dimmed">Peso</Text>
                        </Group>
                        <Text size="xs" c="dimmed">
                          {ocupacao.pesoAtual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} / {ocupacao.pesoMaximo.toLocaleString('pt-BR')} kg ({ocupacao.percentualPeso.toFixed(1)}%)
                        </Text>
                      </Group>
                      <Progress value={Math.min(ocupacao.percentualPeso, 100)} color={getProgressColor(ocupacao.percentualPeso)} size="sm" />
                    </div>
                  )}

                  {/* Volume */}
                  {ocupacao.volumeMaximo != null && ocupacao.volumeMaximo > 0 && (
                    <div>
                      <Group justify="space-between" mb={2}>
                        <Group gap={4}>
                          <IconCube size={14} className="text-zinc-500" />
                          <Text size="xs" c="dimmed">Volume</Text>
                        </Group>
                        <Text size="xs" c="dimmed">
                          {ocupacao.volumeAtual.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} / {ocupacao.volumeMaximo.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} m³ ({ocupacao.percentualVolume.toFixed(1)}%)
                        </Text>
                      </Group>
                      <Progress value={Math.min(ocupacao.percentualVolume, 100)} color={getProgressColor(ocupacao.percentualVolume)} size="sm" />
                    </div>
                  )}

                  {/* Paletes */}
                  {ocupacao.paletesMaximo != null && ocupacao.paletesMaximo > 0 && (
                    <div>
                      <Group justify="space-between" mb={2}>
                        <Group gap={4}>
                          <IconPackage size={14} className="text-zinc-500" />
                          <Text size="xs" c="dimmed">Paletes</Text>
                        </Group>
                        <Text size="xs" c="dimmed">
                          {ocupacao.paletesAtual} / {ocupacao.paletesMaximo} ({ocupacao.percentualPaletes.toFixed(1)}%)
                        </Text>
                      </Group>
                      <Progress value={Math.min(ocupacao.percentualPaletes, 100)} color={getProgressColor(ocupacao.percentualPaletes)} size="sm" />
                    </div>
                  )}
                </Stack>
              </Card>
            ))}
          </Stack>
        </Card>
      )}

      {/* Modal Create/Edit */}
      <Modal opened={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? 'Editar Capacidade do Nível' : 'Nova Capacidade de Nível'} centered closeOnClickOutside={false}>
        <TextInput
          label={<>Código do Nível <span style={{ color: 'red' }}>*</span></>}
          placeholder="Ex: 001, A, N1"
          maxLength={10}
          value={form.codigoNivel}
          onChange={(e) => setForm({ ...form, codigoNivel: e.currentTarget.value })}
          disabled={!!editingId}
          mb="md"
        />

        <SimpleGrid cols={3} mb="md">
          <NumberInput
            label="Peso Máximo (kg)"
            min={0}
            decimalScale={3}
            value={form.pesoMaximo ?? ''}
            onChange={(v) => setForm({ ...form, pesoMaximo: v === '' ? null : typeof v === 'number' ? v : null })}
            placeholder="0.000"
          />
          <NumberInput
            label="Volume Máximo (m³)"
            min={0}
            decimalScale={6}
            value={form.volumeMaximo ?? ''}
            onChange={(v) => setForm({ ...form, volumeMaximo: v === '' ? null : typeof v === 'number' ? v : null })}
            placeholder="0.000000"
          />
          <NumberInput
            label="Paletes Máximo"
            min={0}
            allowDecimal={false}
            value={form.paletesMaximo ?? ''}
            onChange={(v) => setForm({ ...form, paletesMaximo: v === '' ? null : typeof v === 'number' ? v : null })}
            placeholder="0"
          />
        </SimpleGrid>

        <Alert color="blue" variant="light" mb="md">
          <Text size="xs">Pelo menos um limite (peso, volume ou paletes) deve ser maior que zero.</Text>
        </Alert>

        <Switch
          label="Ativo"
          checked={form.status}
          onChange={(e) => setForm({ ...form, status: e.currentTarget.checked })}
          mb="md"
        />

        <Group justify="flex-end">
          <Button variant="default" onClick={() => setModalOpen(false)}>Cancelar</Button>
          <Button
            leftSection={<IconCheck size={16} />}
            onClick={handleSave}
            loading={criarMutation.isPending || atualizarMutation.isPending}
          >
            Salvar
          </Button>
        </Group>
      </Modal>

      {/* Modal Confirm Delete */}
      <Modal opened={!!confirmDeleteId} onClose={() => setConfirmDeleteId(null)} title="Confirmar Exclusão" centered size="sm">
        <Text mb="md">Tem certeza que deseja excluir esta configuração de capacidade? Esta ação não pode ser desfeita.</Text>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => setConfirmDeleteId(null)}>Cancelar</Button>
          <Button
            color="red"
            leftSection={<IconTrash size={16} />}
            onClick={() => confirmDeleteId && handleDelete(confirmDeleteId)}
            loading={excluirMutation.isPending}
          >
            Excluir
          </Button>
        </Group>
      </Modal>
    </div>
  )
}
