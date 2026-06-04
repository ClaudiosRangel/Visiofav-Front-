'use client'

import { useEffect, useState } from 'react'
import { Title, Stack, Table, Group, Badge, Text, Loader, Center, Collapse, UnstyledButton, Card, ScrollArea, Button, Modal, NumberInput, Select, Textarea, Progress, ActionIcon } from '@mantine/core'
import { IconChevronDown, IconChevronRight, IconPlayerPlay, IconPlayerPause, IconCheck, IconClipboardCheck, IconAlertTriangle, IconCut } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

const PRIORIDADE_COLORS: Record<string, string> = { BAIXA: 'gray', NORMAL: 'blue', ALTA: 'orange', URGENTE: 'red' }
const STATUS_COLORS: Record<string, string> = { PENDENTE: 'gray', EM_ANDAMENTO: 'blue', PAUSADA: 'orange', CONCLUIDA: 'green' }

export default function ProgramacaoPage() {
  useEffect(() => { document.title = 'PCP - Painel Operacional' }, [])

  const [painel, setPainel] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [abertos, setAbertos] = useState<Record<string, boolean>>({})

  // Modais
  const [modalApontar, setModalApontar] = useState<{ etapaId: string; opNumero: number; descricao: string } | null>(null)
  const [modalPausar, setModalPausar] = useState<{ etapaId: string; opNumero: number } | null>(null)
  const [modalDesmembrar, setModalDesmembrar] = useState<{ etapaId: string; opNumero: number; quantidade: number; descricao: string } | null>(null)
  const [formApontar, setFormApontar] = useState({ quantidadeProduzida: 0, quantidadePerda: 0, motivoPerda: '', observacao: '' })
  const [formPausar, setFormPausar] = useState({ motivoParada: 'ACERTO_MAQUINA', observacao: '' })
  const [formDesmembrar, setFormDesmembrar] = useState<Array<{ centroProducaoId: string; quantidade: number }>>([{ centroProducaoId: '', quantidade: 0 }, { centroProducaoId: '', quantidade: 0 }])
  const [centrosDisponiveis, setCentrosDisponiveis] = useState<any[]>([])

  async function carregar() {
    setLoading(true)
    try {
      const [painelRes, centrosRes] = await Promise.all([
        api.get('/pcp/programacao/painel'),
        api.get('/centros-producao', { params: { limit: 50, status: 'true' } }),
      ])
      setPainel(painelRes.data)
      setCentrosDisponiveis((centrosRes.data.data || []).map((c: any) => ({ value: c.id, label: `${c.codigo} - ${c.descricao}` })))
      const ab: Record<string, boolean> = {}
      for (const c of (painelRes.data.centros || [])) { if (c.resumo.total > 0) ab[c.centro.id] = true }
      setAbertos(ab)
    } catch (err) { console.error(err) }
    finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [])

  function toggleCentro(id: string) { setAbertos(prev => ({ ...prev, [id]: !prev[id] })) }

  async function iniciarEtapa(etapaId: string) {
    try {
      await api.patch(`/pcp/etapas/${etapaId}/iniciar`, {})
      notifications.show({ title: 'Etapa iniciada', message: '', color: 'green' })
      carregar()
    } catch (err: any) { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) }
  }

  async function concluirEtapa(etapaId: string) {
    try {
      await api.patch(`/pcp/etapas/${etapaId}/concluir`, {})
      notifications.show({ title: 'Etapa concluída', message: '', color: 'green' })
      carregar()
    } catch (err: any) { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) }
  }

  async function enviarApontamento() {
    if (!modalApontar) return
    try {
      await api.post(`/pcp/etapas/${modalApontar.etapaId}/apontar`, {
        quantidadeProduzida: formApontar.quantidadeProduzida,
        quantidadePerda: formApontar.quantidadePerda,
        motivoPerda: formApontar.motivoPerda || undefined,
        observacao: formApontar.observacao || undefined,
      })
      notifications.show({ title: 'Apontamento registrado', message: `+${formApontar.quantidadeProduzida} produzidas`, color: 'green' })
      setModalApontar(null)
      setFormApontar({ quantidadeProduzida: 0, quantidadePerda: 0, motivoPerda: '', observacao: '' })
      carregar()
    } catch (err: any) { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) }
  }

  async function enviarPausa() {
    if (!modalPausar) return
    try {
      await api.patch(`/pcp/etapas/${modalPausar.etapaId}/pausar`, {
        motivoParada: formPausar.motivoParada,
        observacao: formPausar.observacao || undefined,
      })
      notifications.show({ title: 'Etapa pausada', message: formPausar.motivoParada, color: 'orange' })
      setModalPausar(null)
      setFormPausar({ motivoParada: 'ACERTO_MAQUINA', observacao: '' })
      carregar()
    } catch (err: any) { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) }
  }

  async function enviarDesmembramento() {
    if (!modalDesmembrar) return
    const partesValidas = formDesmembrar.filter(p => p.centroProducaoId && p.quantidade > 0)
    if (partesValidas.length < 2) {
      notifications.show({ title: 'Erro', message: 'Informe pelo menos 2 partes com centro e quantidade', color: 'red' })
      return
    }
    try {
      await api.post(`/pcp/etapas/${modalDesmembrar.etapaId}/desmembrar`, { partes: partesValidas })
      notifications.show({ title: 'Etapa desmembrada', message: `Dividida em ${partesValidas.length} partes`, color: 'green' })
      setModalDesmembrar(null)
      setFormDesmembrar([{ centroProducaoId: '', quantidade: 0 }, { centroProducaoId: '', quantidade: 0 }])
      carregar()
    } catch (err: any) { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) }
  }

  if (loading) return <Center py="xl"><Loader /></Center>
  if (!painel) return <Text c="red" ta="center">Erro ao carregar painel</Text>

  return (
    <Stack gap="md">
      <Title order={3}>Painel Operacional — Programação por Centro</Title>
      <Text size="sm" c="dimmed">Controle em tempo real: inicie, aponte produção, registre paradas e conclua etapas.</Text>

      {painel.centros.map((centro: any) => (
        <Card key={centro.centro.id} withBorder padding="xs">
          <UnstyledButton onClick={() => toggleCentro(centro.centro.id)} w="100%">
            <Group justify="space-between" py={4} px={8}>
              <Group gap="sm">
                {abertos[centro.centro.id] ? <IconChevronDown size={16} /> : <IconChevronRight size={16} />}
                <Text fw={700} c="teal">{centro.centro.descricao}</Text>
              </Group>
              <Group gap="xs">
                {centro.resumo.emAndamento > 0 && <Badge color="blue" size="sm">{centro.resumo.emAndamento} em andamento</Badge>}
                {centro.resumo.pausadas > 0 && <Badge color="orange" size="sm">{centro.resumo.pausadas} pausadas</Badge>}
                <Badge color="gray" size="sm">{centro.resumo.pendentes} pendentes</Badge>
              </Group>
            </Group>
          </UnstyledButton>

          <Collapse in={!!abertos[centro.centro.id]}>
            {centro.etapas.length === 0 ? (
              <Text size="sm" c="dimmed" ta="center" py="sm">Nenhuma OP na fila</Text>
            ) : (
              <ScrollArea>
                <Table striped highlightOnHover mt="xs" style={{ minWidth: 800 }}>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>OP</Table.Th>
                      <Table.Th>Operação</Table.Th>
                      <Table.Th>Quantidade</Table.Th>
                      <Table.Th>Produzido</Table.Th>
                      <Table.Th>Perda</Table.Th>
                      <Table.Th>Progresso</Table.Th>
                      <Table.Th>Entrega</Table.Th>
                      <Table.Th>Prioridade</Table.Th>
                      <Table.Th>Status</Table.Th>
                      <Table.Th>Ações</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {centro.etapas.map((etapa: any) => (
                      <Table.Tr key={etapa.id} style={{ background: etapa.status === 'PAUSADA' ? 'var(--mantine-color-orange-0)' : undefined }}>
                        <Table.Td fw={600}>{etapa.opNumero}</Table.Td>
                        <Table.Td style={{ maxWidth: 200 }}>{etapa.descricao}</Table.Td>
                        <Table.Td>{etapa.quantidade.toLocaleString('pt-BR')} {etapa.unidade}</Table.Td>
                        <Table.Td fw={600} c="green">{etapa.quantidadeProduzida.toLocaleString('pt-BR')}</Table.Td>
                        <Table.Td>{etapa.quantidadePerda > 0 ? <Text c="red" size="sm">{etapa.quantidadePerda}</Text> : '—'}</Table.Td>
                        <Table.Td w={100}><Progress value={etapa.percentual} size="lg" color={etapa.percentual >= 100 ? 'green' : 'blue'} /><Text size="xs" ta="center">{etapa.percentual}%</Text></Table.Td>
                        <Table.Td>{etapa.dataEntrega ? new Date(etapa.dataEntrega).toLocaleDateString('pt-BR') : '—'}</Table.Td>
                        <Table.Td><Badge color={PRIORIDADE_COLORS[etapa.prioridade]} size="xs">{etapa.prioridade}</Badge></Table.Td>
                        <Table.Td><Badge color={STATUS_COLORS[etapa.status]} size="sm">{etapa.status === 'EM_ANDAMENTO' ? 'ANDAMENTO' : etapa.status}</Badge></Table.Td>
                        <Table.Td>
                          <Group gap={2} wrap="nowrap">
                            {etapa.status === 'PENDENTE' && (
                              <>
                                <ActionIcon color="green" variant="light" size="sm" onClick={() => iniciarEtapa(etapa.id)} title="Iniciar">
                                  <IconPlayerPlay size={14} />
                                </ActionIcon>
                                <ActionIcon color="violet" variant="light" size="sm" onClick={() => { setModalDesmembrar({ etapaId: etapa.id, opNumero: etapa.opNumero, quantidade: etapa.quantidade, descricao: etapa.descricao }); setFormDesmembrar([{ centroProducaoId: '', quantidade: Math.floor(etapa.quantidade / 2) }, { centroProducaoId: '', quantidade: Math.ceil(etapa.quantidade / 2) }]) }} title="Desmembrar">
                                  <IconCut size={14} />
                                </ActionIcon>
                              </>
                            )}
                            {etapa.status === 'PAUSADA' && (
                              <ActionIcon color="green" variant="light" size="sm" onClick={() => iniciarEtapa(etapa.id)} title="Retomar">
                                <IconPlayerPlay size={14} />
                              </ActionIcon>
                            )}
                            {etapa.status === 'EM_ANDAMENTO' && (
                              <>
                                <ActionIcon color="blue" variant="light" size="sm" onClick={() => setModalApontar({ etapaId: etapa.id, opNumero: etapa.opNumero, descricao: etapa.descricao })} title="Apontar Produção">
                                  <IconClipboardCheck size={14} />
                                </ActionIcon>
                                <ActionIcon color="orange" variant="light" size="sm" onClick={() => setModalPausar({ etapaId: etapa.id, opNumero: etapa.opNumero })} title="Pausar">
                                  <IconPlayerPause size={14} />
                                </ActionIcon>
                                <ActionIcon color="green" variant="light" size="sm" onClick={() => concluirEtapa(etapa.id)} title="Concluir">
                                  <IconCheck size={14} />
                                </ActionIcon>
                              </>
                            )}
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </ScrollArea>
            )}
          </Collapse>
        </Card>
      ))}

      {/* Modal: Apontar Produção */}
      <Modal opened={!!modalApontar} onClose={() => setModalApontar(null)} title={`Apontar Produção — OP #${modalApontar?.opNumero}`} centered>
        <Stack gap="md">
          <Text size="sm" c="dimmed">{modalApontar?.descricao}</Text>
          <Group grow>
            <NumberInput label="Quantidade Produzida" value={formApontar.quantidadeProduzida} onChange={(v) => setFormApontar({ ...formApontar, quantidadeProduzida: typeof v === 'number' ? v : 0 })} min={0} />
            <NumberInput label="Quantidade Perda" value={formApontar.quantidadePerda} onChange={(v) => setFormApontar({ ...formApontar, quantidadePerda: typeof v === 'number' ? v : 0 })} min={0} />
          </Group>
          {formApontar.quantidadePerda > 0 && (
            <Select label="Motivo da Perda" data={['ACERTO', 'REFUGO', 'DEFEITO', 'APARA']} value={formApontar.motivoPerda} onChange={(v) => setFormApontar({ ...formApontar, motivoPerda: v || '' })} />
          )}
          <Textarea label="Observação" value={formApontar.observacao} onChange={(e) => setFormApontar({ ...formApontar, observacao: e.currentTarget.value })} />
          <Button onClick={enviarApontamento} fullWidth>Registrar Apontamento</Button>
        </Stack>
      </Modal>

      {/* Modal: Pausar Etapa */}
      <Modal opened={!!modalPausar} onClose={() => setModalPausar(null)} title={`Pausar Etapa — OP #${modalPausar?.opNumero}`} centered>
        <Stack gap="md">
          <Select label="Motivo da Parada" data={[
            { value: 'MANUTENCAO', label: 'Manutenção' },
            { value: 'FALTA_MATERIAL', label: 'Falta de Material' },
            { value: 'ACERTO_MAQUINA', label: 'Acerto de Máquina' },
            { value: 'TROCA_TURNO', label: 'Troca de Turno' },
            { value: 'OUTRO', label: 'Outro' },
          ]} value={formPausar.motivoParada} onChange={(v) => setFormPausar({ ...formPausar, motivoParada: v || 'OUTRO' })} />
          <Textarea label="Observação" placeholder="Descreva o motivo" value={formPausar.observacao} onChange={(e) => setFormPausar({ ...formPausar, observacao: e.currentTarget.value })} />
          <Button color="orange" onClick={enviarPausa} fullWidth leftSection={<IconAlertTriangle size={16} />}>Registrar Parada</Button>
        </Stack>
      </Modal>

      {/* Modal: Desmembrar Etapa */}
      <Modal opened={!!modalDesmembrar} onClose={() => setModalDesmembrar(null)} title={`Desmembrar — OP #${modalDesmembrar?.opNumero}`} centered size="lg">
        <Stack gap="md">
          <Text size="sm" c="dimmed">{modalDesmembrar?.descricao} — Total: <strong>{modalDesmembrar?.quantidade?.toLocaleString('pt-BR')} un</strong></Text>
          <Text size="xs" c="orange">A soma das partes deve ser igual à quantidade total ({modalDesmembrar?.quantidade?.toLocaleString('pt-BR')})</Text>

          {formDesmembrar.map((parte, idx) => (
            <Group key={idx} grow>
              <Select
                label={`Parte ${idx + 1} — Centro`}
                data={centrosDisponiveis}
                value={parte.centroProducaoId}
                onChange={(v) => { const novo = [...formDesmembrar]; novo[idx].centroProducaoId = v || ''; setFormDesmembrar(novo) }}
                searchable
                placeholder="Selecione a máquina"
              />
              <NumberInput
                label="Quantidade"
                value={parte.quantidade}
                onChange={(v) => { const novo = [...formDesmembrar]; novo[idx].quantidade = typeof v === 'number' ? v : 0; setFormDesmembrar(novo) }}
                min={1}
              />
            </Group>
          ))}

          <Group justify="space-between">
            <Button variant="light" size="xs" onClick={() => setFormDesmembrar([...formDesmembrar, { centroProducaoId: '', quantidade: 0 }])}>
              + Adicionar Parte
            </Button>
            <Text size="sm" fw={600} c={formDesmembrar.reduce((a, p) => a + p.quantidade, 0) === modalDesmembrar?.quantidade ? 'green' : 'red'}>
              Soma: {formDesmembrar.reduce((a, p) => a + p.quantidade, 0).toLocaleString('pt-BR')} / {modalDesmembrar?.quantidade?.toLocaleString('pt-BR')}
            </Text>
          </Group>

          <Button color="violet" onClick={enviarDesmembramento} fullWidth leftSection={<IconCut size={16} />} disabled={formDesmembrar.reduce((a, p) => a + p.quantidade, 0) !== modalDesmembrar?.quantidade}>
            Desmembrar Etapa
          </Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
