'use client'

import { useEffect, useState } from 'react'
import { Modal, Group, Stack, Text, Badge, Table, Select, NumberInput, Button, Loader, Center, Box } from '@mantine/core'
import { IconDeviceFloppy } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

interface ModalMaquinasTemposProps {
  opened: boolean
  onClose: () => void
  opId: string | null
  onSaved?: () => void
}

interface EtapaCompleta {
  id: string
  sequencia: number
  descricao: string | null
  status: string
  centroProducaoId: string | null
  centroNome: string | null
  tipoProcesso: string | null
  tempoSetupMinutos: number
  tempoOperacaoMinutos: number
  tempoOperacaoCalculado: number
  tempoEsperaMinutos: number
  quantidadeProduzida: number
  quantidadePerda: number
  quantidadePrevista: number
  dataInicioReal: string | null
  dataFimReal: string | null
}

interface OpInfo {
  id: string
  numero: number
  referenciaExterna: string | null
  quantidade: number
  unidadeMedida: string | null
  dataEntregaPrevista: string | null
  dataEmissao: string | null
  clienteNome: string | null
  produtoNome: string | null
  prioridade: string
  status: string
}

interface EtapaEdit {
  centroProducaoId: string | null
  tempoSetupMinutos: number
  tempoOperacaoCalculado: number
  dirty: boolean
}

const STATUS_COLORS: Record<string, string> = { PENDENTE: 'gray', EM_ANDAMENTO: 'blue', PAUSADA: 'orange', CONCLUIDA: 'green' }

export default function ModalMaquinasTempos({ opened, onClose, opId, onSaved }: ModalMaquinasTemposProps) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [op, setOp] = useState<OpInfo | null>(null)
  const [etapas, setEtapas] = useState<EtapaCompleta[]>([])
  const [centrosDisponiveis, setCentrosDisponiveis] = useState<Array<{ value: string; label: string }>>([])
  const [edits, setEdits] = useState<Record<string, EtapaEdit>>({})

  useEffect(() => {
    if (!opened || !opId) return
    setLoading(true)
    api.get(`/pcp/ordens-producao/${opId}/etapas-completas`)
      .then(({ data }) => {
        setOp(data.op)
        setEtapas(data.etapas)
        setCentrosDisponiveis(data.centrosDisponiveis)
        // Inicializar edits
        const initial: Record<string, EtapaEdit> = {}
        for (const e of data.etapas) {
          initial[e.id] = {
            centroProducaoId: e.centroProducaoId,
            tempoSetupMinutos: e.tempoSetupMinutos,
            tempoOperacaoCalculado: e.tempoOperacaoCalculado,
            dirty: false,
          }
        }
        setEdits(initial)
      })
      .catch(() => {
        notifications.show({ title: 'Erro', message: 'Falha ao carregar dados da OP', color: 'red' })
      })
      .finally(() => setLoading(false))
  }, [opened, opId])

  function updateEdit(etapaId: string, field: keyof EtapaEdit, value: any) {
    setEdits(prev => ({
      ...prev,
      [etapaId]: { ...prev[etapaId], [field]: value, dirty: true },
    }))
  }

  async function salvarAlteracoes() {
    const alterados = Object.entries(edits).filter(([, e]) => e.dirty)
    if (alterados.length === 0) {
      onClose()
      return
    }

    setSaving(true)
    let sucesso = 0
    for (const [etapaId, edit] of alterados) {
      try {
        const payload: any = {}
        const original = etapas.find(e => e.id === etapaId)
        if (edit.centroProducaoId && edit.centroProducaoId !== original?.centroProducaoId) {
          payload.centroProducaoId = edit.centroProducaoId
        }
        if (edit.tempoSetupMinutos !== original?.tempoSetupMinutos) {
          payload.tempoSetupMinutos = edit.tempoSetupMinutos
        }
        if (edit.tempoOperacaoCalculado !== original?.tempoOperacaoCalculado) {
          payload.tempoOperacaoCalculado = edit.tempoOperacaoCalculado
        }
        if (Object.keys(payload).length > 0) {
          await api.patch(`/pcp/etapas/${etapaId}/atribuir-maquina`, payload)
          sucesso++
        }
      } catch (err: any) {
        notifications.show({
          title: 'Erro',
          message: `Falha ao salvar etapa: ${err?.response?.data?.message || 'erro'}`,
          color: 'red',
        })
      }
    }

    if (sucesso > 0) {
      notifications.show({ title: 'Sucesso', message: `${sucesso} etapa(s) atualizada(s)`, color: 'green' })
      onSaved?.()
    }
    setSaving(false)
    onClose()
  }

  const opNumeroDisplay = op?.referenciaExterna || (op?.numero ? String(op.numero) : '—')

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={<Text fw={700} size="lg">Máquinas e Tempos — OP {opNumeroDisplay}</Text>}
      size="xl"
      padding="lg"
    >
      {loading ? (
        <Center py="xl"><Loader /></Center>
      ) : (
        <Stack gap="md">
          {/* Header da OP */}
          {op && (
            <Box p="sm" style={{ background: 'var(--mantine-color-dark-6)', borderRadius: 8 }}>
              <Group gap="lg" wrap="wrap">
                <Box>
                  <Text size="xs" c="dimmed">Nº OP</Text>
                  <Text size="sm" fw={600}>{opNumeroDisplay}</Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed">Emissão</Text>
                  <Text size="sm">{op.dataEmissao ? new Date(op.dataEmissao).toLocaleDateString('pt-BR') : '—'}</Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed">Cliente</Text>
                  <Text size="sm">{op.clienteNome || '—'}</Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed">Quantidade</Text>
                  <Text size="sm" fw={600}>{op.quantidade?.toLocaleString('pt-BR')}</Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed">Serviço / Produto</Text>
                  <Text size="sm">{op.produtoNome || '—'}</Text>
                </Box>
                <Box>
                  <Text size="xs" c="dimmed">Entrega</Text>
                  <Text size="sm">{op.dataEntregaPrevista ? new Date(op.dataEntregaPrevista).toLocaleDateString('pt-BR') : '—'}</Text>
                </Box>
              </Group>
            </Box>
          )}

          {/* Tabela de etapas */}
          <Box style={{ overflowX: 'auto' }}>
            <Table striped highlightOnHover withTableBorder withColumnBorders>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th style={{ width: 40 }}>#</Table.Th>
                  <Table.Th>Componente / Descrição</Table.Th>
                  <Table.Th>Atividade / Processo</Table.Th>
                  <Table.Th style={{ width: 220 }}>Máquina</Table.Th>
                  <Table.Th style={{ width: 100 }}>T. Acerto (min)</Table.Th>
                  <Table.Th style={{ width: 120 }}>T. Produção (min)</Table.Th>
                  <Table.Th style={{ width: 80 }}>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {etapas.map((etapa) => {
                  const edit = edits[etapa.id]
                  const isEditable = etapa.status === 'PENDENTE' || etapa.status === 'PAUSADA'
                  return (
                    <Table.Tr key={etapa.id}>
                      <Table.Td>{etapa.sequencia}</Table.Td>
                      <Table.Td>
                        <Text size="sm" lineClamp={1}>
                          {etapa.descricao || '—'}
                        </Text>
                      </Table.Td>
                      <Table.Td>
                        <Text size="sm" c="dimmed">{etapa.tipoProcesso || '—'}</Text>
                      </Table.Td>
                      <Table.Td>
                        {isEditable ? (
                          <Select
                            size="xs"
                            data={centrosDisponiveis}
                            value={edit?.centroProducaoId || null}
                            onChange={(v) => updateEdit(etapa.id, 'centroProducaoId', v)}
                            searchable
                            clearable={false}
                          />
                        ) : (
                          <Text size="sm">{etapa.centroNome || '—'}</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {isEditable ? (
                          <NumberInput
                            size="xs"
                            value={edit?.tempoSetupMinutos ?? 0}
                            onChange={(v) => updateEdit(etapa.id, 'tempoSetupMinutos', Number(v) || 0)}
                            min={0}
                          />
                        ) : (
                          <Text size="sm">{etapa.tempoSetupMinutos}</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        {isEditable ? (
                          <NumberInput
                            size="xs"
                            value={edit?.tempoOperacaoCalculado ?? 0}
                            onChange={(v) => updateEdit(etapa.id, 'tempoOperacaoCalculado', Number(v) || 0)}
                            min={0}
                          />
                        ) : (
                          <Text size="sm">{etapa.tempoOperacaoCalculado}</Text>
                        )}
                      </Table.Td>
                      <Table.Td>
                        <Badge color={STATUS_COLORS[etapa.status] || 'gray'} size="sm">
                          {etapa.status === 'EM_ANDAMENTO' ? 'Andamento' : etapa.status === 'CONCLUIDA' ? 'Concluída' : etapa.status}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  )
                })}
              </Table.Tbody>
            </Table>
          </Box>

          {/* Botões */}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>Cancelar</Button>
            <Button
              leftSection={<IconDeviceFloppy size={16} />}
              onClick={salvarAlteracoes}
              loading={saving}
              disabled={!Object.values(edits).some(e => e.dirty)}
            >
              Salvar Alterações
            </Button>
          </Group>
        </Stack>
      )}
    </Modal>
  )
}
