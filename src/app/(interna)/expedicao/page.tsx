'use client'

import { useState, useEffect } from 'react'
import {
  Card, Group, Text, SimpleGrid, ThemeIcon, Badge, Table, Button, Tabs,
  LoadingOverlay, Modal, TextInput, Select, MultiSelect, ActionIcon, Tooltip, Progress,
  Checkbox, Alert,
} from '@mantine/core'
import {
  IconPackage, IconListCheck, IconTruck, IconChecklist, IconRefresh,
  IconPlus, IconCheck, IconPrinter, IconAlertCircle, IconEye,
} from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useModuloGuard } from '@/hooks/useModuloGuard'

const statusColors: Record<string, string> = {
  PENDENTE: 'orange', EM_SEPARACAO: 'blue', SEPARADA: 'grape',
  CONFERIDA: 'cyan', EMBALADA: 'teal', CONCLUIDA: 'green', CANCELADA: 'red',
}

export default function ExpedicaoPage() {
  useModuloGuard('WMS')
  useEffect(() => { document.title = 'VisioFab - WMS - Expedição' }, [])
  const queryClient = useQueryClient()
  const [carregModal, setCarregModal] = useState(false)
  const [docaId, setDocaId] = useState<string | null>(null)
  const [placa, setPlaca] = useState('')
  const [vincularModal, setVincularModal] = useState<any>(null)
  const [selectedVolumes, setSelectedVolumes] = useState<Set<string>>(new Set())
  const [carregFuncIds, setCarregFuncIds] = useState<string[]>([])

  // Ondas
  const { data: ondasResp, isLoading: loadingOndas } = useQuery<any>({
    queryKey: ['ondas-separacao', { limit: 100 }],
    queryFn: async () => { const { data } = await api.get('/ondas-separacao', { params: { limit: 100 } }); return data },
  })

  // Carregamentos
  const { data: carregResp, isLoading: loadingCarreg, refetch: refetchCarreg } = useQuery<any>({
    queryKey: ['carregamentos', { limit: 50 }],
    queryFn: async () => { const { data } = await api.get('/carregamentos', { params: { limit: 50 } }); return data },
  })

  // Volumes disponíveis (EMBALADO, não vinculados)
  const { data: volumesResp } = useQuery<any>({
    queryKey: ['etiq-volumes-exp'],
    queryFn: async () => { const { data } = await api.get('/etiquetas/volumes', { params: { limit: 100 } }); return data },
    enabled: !!vincularModal,
  })

  // Docas
  const { data: docasData } = useQuery<any>({
    queryKey: ['docas-select'],
    queryFn: async () => { const { data } = await api.get('/docas', { params: { limit: 50 } }); return data },
    enabled: carregModal,
  })

  // Funcionários para carregamento
  const { data: funcCarregData } = useQuery<any>({
    queryKey: ['funcionarios-select-carreg'],
    queryFn: async () => { const { data } = await api.get('/funcionarios', { params: { limit: 100 } }); return data },
    enabled: carregModal,
  })

  const criarCarreg = useMutation({
    mutationFn: async () => {
      if (!docaId || !placa) throw new Error('Preencha doca e placa')
      if (carregFuncIds.length === 0) throw new Error('Selecione ao menos um funcionário')
      const { data } = await api.post('/carregamentos', { docaId, veiculoPlaca: placa })
      // Assign employees to OS
      if (data.ordemServico?.id && carregFuncIds.length > 0) {
        try {
          await api.patch(`/os-wms/${data.ordemServico.id}/iniciar`, { funcionarioIds: carregFuncIds })
        } catch { /* non-blocking */ }
      }
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carregamentos'] })
      setCarregModal(false); setDocaId(null); setPlaca(''); setCarregFuncIds([])
      notifications.show({ title: 'Sucesso', message: 'Carregamento criado com funcionários', color: 'green' })
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' }) },
  })

  const vincularVolumes = useMutation({
    mutationFn: async () => {
      if (!vincularModal || selectedVolumes.size === 0) throw new Error('Selecione volumes')
      const volumes = Array.from(selectedVolumes).map((volumeId, idx) => ({
        volumeId,
        sequencia: idx + 1,
      }))
      const { data } = await api.post(`/carregamentos/${vincularModal.id}/volumes`, { volumes })
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carregamentos'] })
      setVincularModal(null); setSelectedVolumes(new Set())
      notifications.show({ title: 'Sucesso', message: 'Volumes vinculados ao carregamento', color: 'green' })
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || err.message, color: 'red' }) },
  })

  const confirmarCarreg = useMutation({
    mutationFn: async (id: string) => { const { data } = await api.patch(`/carregamentos/${id}/confirmar`); return data },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['carregamentos'] })
      queryClient.invalidateQueries({ queryKey: ['ondas-separacao'] })
      notifications.show({ title: 'Sucesso', message: 'Carregamento concluído — pedidos faturados', color: 'green' })
    },
    onError: (err: any) => { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) },
  })

  function imprimirRomaneio(carreg: any) {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const volumesHtml = (carreg.volumes || []).map((cv: any, idx: number) => `
      <tr>
        <td style="padding:6px;border:1px solid #ccc;text-align:center">${idx + 1}</td>
        <td style="padding:6px;border:1px solid #ccc;text-align:center">${cv.volume?.codigo || '—'}</td>
        <td style="padding:6px;border:1px solid #ccc">${cv.volume?.tipo || '—'}</td>
        <td style="padding:6px;border:1px solid #ccc;text-align:right">${cv.volume?.pesoKg ? Number(cv.volume.pesoKg).toFixed(1) + ' kg' : '—'}</td>
        <td style="padding:6px;border:1px solid #ccc">${cv.carregadoEm ? '✅' : '⬜'}</td>
      </tr>
    `).join('')

    printWindow.document.write(`
      <html><head><title>Romaneio - ${carreg.veiculoPlaca}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; font-size: 12px; }
        h1 { font-size: 16px; } h2 { font-size: 13px; color: #555; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th { padding: 6px; border: 1px solid #333; background: #f0f0f0; font-size: 11px; }
        .info { display: flex; gap: 40px; margin-bottom: 16px; }
        .info label { font-size: 10px; color: #888; display: block; }
        .info span { font-weight: bold; }
        .assinatura { margin-top: 40px; display: flex; gap: 60px; }
        .assinatura div { border-top: 1px solid #333; padding-top: 4px; width: 200px; text-align: center; font-size: 10px; }
      </style></head><body>
      <h1>ROMANEIO DE CARGA</h1>
      <div class="info">
        <div><label>Veículo</label><span>${carreg.veiculoPlaca}</span></div>
        <div><label>Status</label><span>${carreg.status}</span></div>
        <div><label>Total Volumes</label><span>${carreg.totalVolumes || 0}</span></div>
        <div><label>Peso Total</label><span>${(carreg.pesoTotal || 0).toFixed(1)} kg</span></div>
        <div><label>Data</label><span>${new Date().toLocaleDateString('pt-BR')}</span></div>
      </div>
      <table>
        <thead><tr><th>Seq</th><th>Volume</th><th>Tipo</th><th>Peso</th><th>Carregado</th></tr></thead>
        <tbody>${volumesHtml}</tbody>
      </table>
      <div class="assinatura">
        <div>Conferente</div><div>Motorista</div><div>Responsável</div>
      </div>
      <script>window.print();</script>
      </body></html>
    `)
    printWindow.document.close()
  }

  const ondas = ondasResp?.data || []
  const carregamentos = carregResp?.data || []
  const volumesDisponiveis = (volumesResp?.data || []).filter((v: any) => v.status === 'EMBALADO')

  const pendentes = ondas.filter((o: any) => o.status === 'PENDENTE').length
  const emSeparacao = ondas.filter((o: any) => o.status === 'EM_SEPARACAO').length
  const embaladas = ondas.filter((o: any) => o.status === 'EMBALADA').length
  const concluidas = ondas.filter((o: any) => o.status === 'CONCLUIDA').length

  const stats = [
    { title: 'Pendentes', value: String(pendentes), icon: IconListCheck, color: 'orange' },
    { title: 'Em Separação', value: String(emSeparacao), icon: IconPackage, color: 'blue' },
    { title: 'Prontas p/ Carga', value: String(embaladas), icon: IconTruck, color: 'grape' },
    { title: 'Expedidas', value: String(concluidas), icon: IconChecklist, color: 'green' },
  ]

  const docaOptions = (docasData?.data || []).map((d: any) => ({ value: d.id, label: d.descricao || d.id.substring(0, 8) }))
  const funcCarregOptions = (funcCarregData?.data || []).map((f: any) => ({ value: f.id, label: f.nome || f.matricula }))

  function toggleVolume(id: string) {
    const newSet = new Set(selectedVolumes)
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id)
    setSelectedVolumes(newSet)
  }

  return (
    <div>
      <Text size="xs" c="dimmed" mb={4}>WMS / Expedição</Text>
      <Text size="xl" fw={600} mb="lg">Expedição</Text>

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 4 }} mb="xl">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <Group justify="space-between">
              <div>
                <Text size="xs" c="dimmed" tt="uppercase" fw={600}>{stat.title}</Text>
                <Text size="xl" fw={700} mt={4}>{stat.value}</Text>
              </div>
              <ThemeIcon color={stat.color} variant="light" size={48} radius="md"><stat.icon size={24} /></ThemeIcon>
            </Group>
          </Card>
        ))}
      </SimpleGrid>

      <Card>
        <Tabs defaultValue="separacao">
          <Tabs.List mb="md">
            <Tabs.Tab value="separacao">Separação</Tabs.Tab>
            <Tabs.Tab value="carga">Montagem de Carga</Tabs.Tab>
            <Tabs.Tab value="mapa">Carregamentos ({carregamentos.length})</Tabs.Tab>
          </Tabs.List>

          {/* Aba Separação */}
          <Tabs.Panel value="separacao">
            <LoadingOverlay visible={loadingOndas} />
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Onda</Table.Th><Table.Th>Pedidos</Table.Th><Table.Th>Itens</Table.Th>
                  <Table.Th>Progresso</Table.Th><Table.Th>Status</Table.Th><Table.Th>Ações</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {ondas.filter((o: any) => !['CONCLUIDA', 'CANCELADA'].includes(o.status)).map((o: any) => (
                  <Table.Tr key={o.id}>
                    <Table.Td fw={500}>#{o.numero}</Table.Td>
                    <Table.Td>{o.totalPedidos || 0}</Table.Td>
                    <Table.Td>{o.progresso?.separados || 0} / {o.progresso?.totalItens || 0}</Table.Td>
                    <Table.Td className="w-40">
                      <Group gap={8}>
                        <Progress value={o.progresso?.percentual || 0} size="lg" className="flex-1" color={o.progresso?.percentual === 100 ? 'green' : 'blue'} />
                        <Text size="xs" fw={600}>{o.progresso?.percentual || 0}%</Text>
                      </Group>
                    </Table.Td>
                    <Table.Td><Badge color={statusColors[o.status] || 'gray'} variant="light">{o.status}</Badge></Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        <Tooltip label="Monitor (Coletor)"><ActionIcon variant="subtle" color="cyan" onClick={() => window.open(`/wms/picking/monitor?ondaId=${o.id}`, '_blank')}><IconChecklist size={16} /></ActionIcon></Tooltip>
                        <Tooltip label="Imprimir Ficha"><ActionIcon variant="subtle" color="teal" onClick={async () => {
                          try { const { data } = await api.get(`/ondas-separacao/${o.id}/ficha-acompanhamento/separacao`, { responseType: 'text' }); const w = window.open('', '_blank'); if (w) { w.document.write(data); w.document.close() } } catch { notifications.show({ title: 'Erro', message: 'Falha ao gerar ficha', color: 'red' }) }
                        }}><IconPrinter size={16} /></ActionIcon></Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {ondas.filter((o: any) => !['CONCLUIDA', 'CANCELADA'].includes(o.status)).length === 0 && (
                  <Table.Tr><Table.Td colSpan={6} className="text-center py-8 text-zinc-500">Nenhuma onda ativa</Table.Td></Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Tabs.Panel>

          {/* Aba Montagem de Carga */}
          <Tabs.Panel value="carga">
            <LoadingOverlay visible={loadingOndas} />

            {/* Ondas CONFERIDAS — prontas para embalagem */}
            {ondas.filter((o: any) => o.status === 'CONFERIDA').length > 0 && (
              <>
                <Text fw={500} mb="sm" c="cyan">Ondas conferidas — prontas para embalagem</Text>
                <Table striped highlightOnHover mb="lg">
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Onda</Table.Th><Table.Th>Pedidos</Table.Th><Table.Th>Itens</Table.Th><Table.Th>Status</Table.Th><Table.Th>Ação</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {ondas.filter((o: any) => o.status === 'CONFERIDA').map((o: any) => (
                      <Table.Tr key={o.id}>
                        <Table.Td fw={500}>#{o.numero}</Table.Td>
                        <Table.Td>{o.totalPedidos || 0}</Table.Td>
                        <Table.Td>{o.progresso?.totalItens || 0}</Table.Td>
                        <Table.Td><Badge color="cyan" variant="light">CONFERIDA</Badge></Table.Td>
                        <Table.Td>
                          <Button size="xs" color="grape" leftSection={<IconPackage size={14} />}
                            onClick={() => window.open(`/expedicao/embalagem/${o.id}`, '_self')}>
                            Embalar
                          </Button>
                        </Table.Td>
                      </Table.Tr>
                    ))}
                  </Table.Tbody>
                </Table>
              </>
            )}

            {/* Ondas EMBALADAS — prontas para carregamento */}
            <Text fw={500} mb="sm">Ondas prontas para carregamento (EMBALADA)</Text>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Onda</Table.Th><Table.Th>Pedidos</Table.Th><Table.Th>Volumes</Table.Th><Table.Th>Status</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {ondas.filter((o: any) => o.status === 'EMBALADA').map((o: any) => (
                  <Table.Tr key={o.id}>
                    <Table.Td fw={500}>#{o.numero}</Table.Td>
                    <Table.Td>{o.totalPedidos || 0}</Table.Td>
                    <Table.Td>{o.volumes?.length || 0}</Table.Td>
                    <Table.Td><Badge color="teal" variant="light">EMBALADA</Badge></Table.Td>
                  </Table.Tr>
                ))}
                {ondas.filter((o: any) => o.status === 'EMBALADA').length === 0 && (
                  <Table.Tr><Table.Td colSpan={4} className="text-center py-8 text-zinc-500">Nenhuma onda pronta para carga</Table.Td></Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Tabs.Panel>

          {/* Aba Carregamentos */}
          <Tabs.Panel value="mapa">
            <LoadingOverlay visible={loadingCarreg} />
            <Group justify="flex-end" mb="md">
              <Button variant="default" leftSection={<IconRefresh size={16} />} onClick={() => refetchCarreg()}>Atualizar</Button>
              <Button leftSection={<IconPlus size={16} />} onClick={() => setCarregModal(true)}>Novo Carregamento</Button>
            </Group>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Veículo</Table.Th><Table.Th>Volumes</Table.Th>
                  <Table.Th>Peso Total</Table.Th><Table.Th>Status</Table.Th><Table.Th className="w-40">Ações</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {carregamentos.map((c: any) => (
                  <Table.Tr key={c.id}>
                    <Table.Td fw={500} className="font-mono">{c.veiculoPlaca}</Table.Td>
                    <Table.Td>{c.volumesCarregados || 0} / {c.totalVolumes || 0}</Table.Td>
                    <Table.Td>{(c.pesoTotal || 0).toFixed(1)} kg</Table.Td>
                    <Table.Td><Badge color={c.status === 'CONCLUIDO' ? 'green' : c.status === 'EM_CARREGAMENTO' ? 'blue' : 'orange'} variant="light">{c.status}</Badge></Table.Td>
                    <Table.Td>
                      <Group gap={4}>
                        {c.status !== 'CONCLUIDO' && (
                          <Tooltip label="Vincular volumes">
                            <ActionIcon variant="subtle" color="blue" onClick={() => { setVincularModal(c); setSelectedVolumes(new Set()) }}>
                              <IconPackage size={18} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        {c.status === 'EM_CARREGAMENTO' && (
                          <Tooltip label="Confirmar carregamento">
                            <ActionIcon variant="subtle" color="green" onClick={() => { if (confirm('Confirmar carregamento? Pedidos serão faturados.')) confirmarCarreg.mutate(c.id) }}>
                              <IconCheck size={18} />
                            </ActionIcon>
                          </Tooltip>
                        )}
                        <Tooltip label="Imprimir romaneio">
                          <ActionIcon variant="subtle" color="gray" onClick={() => imprimirRomaneio(c)}>
                            <IconPrinter size={18} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Monitor (Coletor)">
                          <ActionIcon variant="subtle" color="cyan" onClick={() => window.open(`/wms/carregamento/monitor?carregamentoId=${c.id}`, '_blank')}>
                            <IconEye size={18} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
                {carregamentos.length === 0 && (
                  <Table.Tr><Table.Td colSpan={5} className="text-center py-8 text-zinc-500">Nenhum carregamento</Table.Td></Table.Tr>
                )}
              </Table.Tbody>
            </Table>
          </Tabs.Panel>
        </Tabs>
      </Card>

      {/* Modal Novo Carregamento */}
      <Modal opened={carregModal} onClose={() => setCarregModal(false)} title="Novo Carregamento" centered>
        <Select label="Doca *" data={docaOptions} value={docaId} onChange={setDocaId} searchable mb="sm" />
        <TextInput label="Placa do Veículo *" placeholder="ABC1D23" value={placa} onChange={(e) => setPlaca(e.currentTarget.value.toUpperCase())} mb="sm" className="font-mono" />
        <MultiSelect label={<>Funcionário(s) <span style={{ color: 'red' }}>*</span></>} data={funcCarregOptions} value={carregFuncIds} onChange={setCarregFuncIds} searchable placeholder="Selecione..." mb="sm" />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setCarregModal(false)}>Cancelar</Button>
          <Button onClick={() => criarCarreg.mutate()} loading={criarCarreg.isPending} disabled={!docaId || !placa || carregFuncIds.length === 0}>Criar</Button>
        </Group>
      </Modal>

      {/* Modal Vincular Volumes */}
      <Modal opened={!!vincularModal} onClose={() => { setVincularModal(null); setSelectedVolumes(new Set()) }}
        title={`Vincular Volumes — ${vincularModal?.veiculoPlaca}`} size="lg" centered>
        {volumesDisponiveis.length === 0 ? (
          <Alert icon={<IconAlertCircle size={16} />} color="orange" variant="light">
            Nenhum volume disponível para vincular (status EMBALADO).
          </Alert>
        ) : (
          <>
            <Text size="sm" c="dimmed" mb="md">Selecione os volumes para adicionar ao carregamento:</Text>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th><Checkbox checked={selectedVolumes.size === volumesDisponiveis.length && volumesDisponiveis.length > 0}
                    onChange={() => {
                      if (selectedVolumes.size === volumesDisponiveis.length) setSelectedVolumes(new Set())
                      else setSelectedVolumes(new Set(volumesDisponiveis.map((v: any) => v.id)))
                    }} /></Table.Th>
                  <Table.Th>Código</Table.Th><Table.Th>Tipo</Table.Th><Table.Th>Peso</Table.Th><Table.Th>Itens</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {volumesDisponiveis.map((v: any) => (
                  <Table.Tr key={v.id}>
                    <Table.Td><Checkbox checked={selectedVolumes.has(v.id)} onChange={() => toggleVolume(v.id)} /></Table.Td>
                    <Table.Td className="font-mono" fw={500}>{v.codigo}</Table.Td>
                    <Table.Td>{v.tipo}</Table.Td>
                    <Table.Td>{v.peso ? `${v.peso} kg` : '—'}</Table.Td>
                    <Table.Td>{v.totalItens || 0}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </>
        )}
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setVincularModal(null)}>Cancelar</Button>
          <Button onClick={() => vincularVolumes.mutate()} loading={vincularVolumes.isPending}
            disabled={selectedVolumes.size === 0} leftSection={<IconCheck size={16} />}>
            Vincular ({selectedVolumes.size})
          </Button>
        </Group>
      </Modal>
    </div>
  )
}
