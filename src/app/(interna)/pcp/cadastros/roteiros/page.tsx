'use client'

import { useEffect, useState } from 'react'
import { Title, Stack, Card, Table, Group, Button, Select, Badge, Text, Loader, Center, Modal, TextInput, NumberInput, ActionIcon, Alert } from '@mantine/core'
import { IconPlus, IconTrash, IconRoute, IconCopy } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

export default function RoteirosProducaoPage() {
  useEffect(() => { document.title = 'PCP - Roteiros de Produção' }, [])

  const [produtos, setProdutos] = useState<any[]>([])
  const [centros, setCentros] = useState<any[]>([])
  const [produtoId, setProdutoId] = useState<string | null>(null)
  const [roteiros, setRoteiros] = useState<any[]>([])
  const [roteiroSelecionado, setRoteiroSelecionado] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)
  const [novaEtapa, setNovaEtapa] = useState({ sequencia: 1, descricao: '', centroProducaoId: '', tempoSetupMinutos: 0, tempoOperacaoMinutos: 0, tempoEsperaMinutos: 0 })

  useEffect(() => {
    Promise.all([
      api.get('/produtos', { params: { limit: 200, status: 'true' } }),
      api.get('/centros-producao', { params: { limit: 100, status: 'true' } }),
    ]).then(([prodRes, centrosRes]) => {
      setProdutos((prodRes.data.data || []).map((p: any) => ({ value: p.id, label: `${p.codigo} - ${p.nome}` })))
      setCentros((centrosRes.data.data || []).map((c: any) => ({ value: c.id, label: `${c.codigo} - ${c.descricao}` })))
    })
  }, [])

  async function carregarRoteiros(pid: string) {
    setLoading(true)
    try {
      const res = await api.get('/roteiros-producao', { params: { produtoId: pid } })
      setRoteiros(res.data.data || [])
      setRoteiroSelecionado(res.data.data?.[0] || null)
    } catch { setRoteiros([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (produtoId) carregarRoteiros(produtoId) }, [produtoId])

  async function criarRoteiro() {
    if (!produtoId) return
    try {
      await api.post('/roteiros-producao', { produtoId, status: 'ATIVO' })
      notifications.show({ title: 'Roteiro criado', message: '', color: 'green' })
      carregarRoteiros(produtoId)
    } catch (err: any) { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) }
  }

  async function adicionarEtapa() {
    if (!roteiroSelecionado || !novaEtapa.centroProducaoId) return
    try {
      await api.post(`/roteiros-producao/${roteiroSelecionado.id}/etapas`, novaEtapa)
      notifications.show({ title: 'Etapa adicionada', message: '', color: 'green' })
      carregarRoteiros(produtoId!)
      setModalAberto(false)
      setNovaEtapa({ sequencia: (roteiroSelecionado.etapas?.length || 0) + 2, descricao: '', centroProducaoId: '', tempoSetupMinutos: 0, tempoOperacaoMinutos: 0, tempoEsperaMinutos: 0 })
    } catch (err: any) { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) }
  }

  async function removerEtapa(etapaId: string) {
    if (!roteiroSelecionado) return
    try { await api.delete(`/roteiros-producao/${roteiroSelecionado.id}/etapas/${etapaId}`); carregarRoteiros(produtoId!) }
    catch (err: any) { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) }
  }

  async function duplicar() {
    if (!roteiroSelecionado) return
    try { await api.post(`/roteiros-producao/${roteiroSelecionado.id}/duplicar`); notifications.show({ title: 'Duplicado', message: '', color: 'green' }); carregarRoteiros(produtoId!) }
    catch (err: any) { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) }
  }

  return (
    <Stack gap="md">
      <Title order={3}>Roteiros de Produção</Title>

      <Card withBorder>
        <Group>
          <Select label="Selecione o Produto" data={produtos} value={produtoId} onChange={setProdutoId} searchable w={400} />
          {produtoId && <Button mt={24} leftSection={<IconPlus size={16} />} onClick={criarRoteiro}>Novo Roteiro</Button>}
        </Group>
      </Card>

      {loading && <Center py="xl"><Loader /></Center>}

      {!loading && produtoId && roteiros.length === 0 && (
        <Alert color="yellow">Nenhum roteiro cadastrado para este produto.</Alert>
      )}

      {roteiroSelecionado && (
        <Card withBorder>
          <Stack gap="md">
            <Group justify="space-between">
              <Group>
                <IconRoute size={20} />
                <Text fw={600}>Versão {roteiroSelecionado.versao}</Text>
                <Badge color={roteiroSelecionado.status === 'ATIVO' ? 'green' : 'gray'}>{roteiroSelecionado.status}</Badge>
              </Group>
              <Group>
                <Button size="xs" variant="light" leftSection={<IconCopy size={14} />} onClick={duplicar}>Duplicar</Button>
                <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setModalAberto(true)}>Adicionar Etapa</Button>
              </Group>
            </Group>

            {roteiroSelecionado.etapas?.length > 0 ? (
              <Table striped highlightOnHover>
                <Table.Thead><Table.Tr><Table.Th>Seq</Table.Th><Table.Th>Operação</Table.Th><Table.Th>Centro</Table.Th><Table.Th>Setup (min)</Table.Th><Table.Th>Operação (min)</Table.Th><Table.Th>Espera (min)</Table.Th><Table.Th>Total</Table.Th><Table.Th></Table.Th></Table.Tr></Table.Thead>
                <Table.Tbody>
                  {roteiroSelecionado.etapas.map((etapa: any) => (
                    <Table.Tr key={etapa.id}>
                      <Table.Td>{etapa.sequencia}</Table.Td>
                      <Table.Td>{etapa.descricao}</Table.Td>
                      <Table.Td>{etapa.centroProducao?.descricao || '—'}</Table.Td>
                      <Table.Td>{Number(etapa.tempoSetupMinutos)}</Table.Td>
                      <Table.Td>{Number(etapa.tempoOperacaoMinutos)}</Table.Td>
                      <Table.Td>{Number(etapa.tempoEsperaMinutos)}</Table.Td>
                      <Table.Td fw={600}>{Number(etapa.tempoTotalMinutos)}</Table.Td>
                      <Table.Td><ActionIcon color="red" variant="subtle" onClick={() => removerEtapa(etapa.id)}><IconTrash size={16} /></ActionIcon></Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : <Text c="dimmed" ta="center">Nenhuma etapa. Clique em "Adicionar Etapa".</Text>}
          </Stack>
        </Card>
      )}

      <Modal opened={modalAberto} onClose={() => setModalAberto(false)} title="Adicionar Etapa ao Roteiro" centered>
        <Stack gap="md">
          <NumberInput label="Sequência" value={novaEtapa.sequencia} onChange={(v) => setNovaEtapa({ ...novaEtapa, sequencia: typeof v === 'number' ? v : 1 })} min={1} />
          <TextInput label="Descrição da Operação" placeholder="Ex: Impressão Offset Plana" value={novaEtapa.descricao} onChange={(e) => setNovaEtapa({ ...novaEtapa, descricao: e.currentTarget.value })} required />
          <Select label="Centro de Produção (Máquina)" data={centros} value={novaEtapa.centroProducaoId} onChange={(v) => setNovaEtapa({ ...novaEtapa, centroProducaoId: v || '' })} searchable required />
          <Group grow>
            <NumberInput label="Setup (min)" value={novaEtapa.tempoSetupMinutos} onChange={(v) => setNovaEtapa({ ...novaEtapa, tempoSetupMinutos: typeof v === 'number' ? v : 0 })} min={0} />
            <NumberInput label="Operação (min/un)" value={novaEtapa.tempoOperacaoMinutos} onChange={(v) => setNovaEtapa({ ...novaEtapa, tempoOperacaoMinutos: typeof v === 'number' ? v : 0 })} min={0} decimalScale={4} />
            <NumberInput label="Espera (min)" value={novaEtapa.tempoEsperaMinutos} onChange={(v) => setNovaEtapa({ ...novaEtapa, tempoEsperaMinutos: typeof v === 'number' ? v : 0 })} min={0} />
          </Group>
          <Button onClick={adicionarEtapa} fullWidth>Adicionar Etapa</Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
