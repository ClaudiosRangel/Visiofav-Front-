'use client'

import { useEffect, useState } from 'react'
import { Title, Stack, Table, Group, Button, Badge, Text, Loader, Center, Modal, TextInput, Select, NumberInput, ActionIcon, Divider, SimpleGrid } from '@mantine/core'
import { IconPlus, IconEdit, IconPower } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

export default function CentrosProducaoPage() {
  useEffect(() => { document.title = 'PCP - Centros de Produção' }, [])

  const [data, setData] = useState<any[]>([])
  const [tiposProcesso, setTiposProcesso] = useState<any[]>([])
  const [turnos, setTurnos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<any>(null)
  const [form, setForm] = useState({ codigo: '', descricao: '', tipo: 'MAQUINA', tipoProcessoId: null as string | null, turnoProducaoId: null as string | null, capacidadeHora: 0, custoHora: 0, velocidade: 0, unidadeVelocidade: null as string | null, formatoFolhaLargura: 0, formatoFolhaAltura: 0, pincaMm: 0 })

  async function carregar() {
    setLoading(true)
    try {
      const [resCentros, resTipos, resTurnos] = await Promise.all([
        api.get('/centros-producao', { params: { limit: 100 } }),
        api.get('/tipos-processo', { params: { status: 'true' } }),
        api.get('/turnos-producao', { params: { limit: 50 } }),
      ])
      setData(resCentros.data.data || [])
      setTiposProcesso(resTipos.data.data || [])
      setTurnos(resTurnos.data.data || resTurnos.data || [])
    }
    catch {} finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [])

  function abrirNovo() { setEditando(null); setForm({ codigo: '', descricao: '', tipo: 'MAQUINA', tipoProcessoId: null, turnoProducaoId: null, capacidadeHora: 0, custoHora: 0, velocidade: 0, unidadeVelocidade: null, formatoFolhaLargura: 0, formatoFolhaAltura: 0, pincaMm: 0 }); setModalAberto(true) }
  function abrirEdicao(item: any) { setEditando(item); setForm({ codigo: item.codigo, descricao: item.descricao, tipo: item.tipo, tipoProcessoId: item.tipoProcessoId || null, turnoProducaoId: item.turnoProducaoId || null, capacidadeHora: Number(item.capacidadeHora) || 0, custoHora: Number(item.custoHora) || 0, velocidade: Number(item.velocidade) || 0, unidadeVelocidade: item.unidadeVelocidade || null, formatoFolhaLargura: Number(item.formatoFolhaLargura) || 0, formatoFolhaAltura: Number(item.formatoFolhaAltura) || 0, pincaMm: Number(item.pincaMm) || 0 }); setModalAberto(true) }

  async function salvar() {
    if (!form.tipoProcessoId) {
      notifications.show({ title: 'Erro', message: 'Selecione o Tipo de Processo', color: 'red' })
      return
    }
    try {
      if (editando) { await api.put(`/centros-producao/${editando.id}`, form) }
      else { await api.post('/centros-producao', form) }
      notifications.show({ title: 'Salvo', message: '', color: 'green' })
      setModalAberto(false); carregar()
    } catch (err: any) { notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' }) }
  }

  async function toggleStatus(item: any) {
    try {
      await api.patch(`/centros-producao/${item.id}/${item.status ? 'inativar' : 'ativar'}`)
      carregar()
    } catch {}
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={3}>Centros de Produção</Title>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>Novo Centro</Button>
      </Group>

      {loading ? <Center py="xl"><Loader /></Center> : (
        <Table striped highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th>Código</Table.Th><Table.Th>Descrição</Table.Th><Table.Th>Tipo</Table.Th><Table.Th>Processo</Table.Th><Table.Th>Turno</Table.Th><Table.Th>Cap/Hora</Table.Th><Table.Th>Status</Table.Th><Table.Th></Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>
            {data.map((item) => (
              <Table.Tr key={item.id}>
                <Table.Td fw={600}>{item.codigo}</Table.Td>
                <Table.Td>{item.descricao}</Table.Td>
                <Table.Td><Badge variant="light">{item.tipo}</Badge></Table.Td>
                <Table.Td><Badge variant="light" color="teal">{item.tipoProcesso?.descricao || '—'}</Badge></Table.Td>
                <Table.Td>
                  {item.turnoProducao ? (
                    <Badge variant="light" color="indigo">{item.turnoProducao.descricao} ({item.turnoProducao.horaInicio}-{item.turnoProducao.horaFim})</Badge>
                  ) : (
                    <Text size="xs" c="dimmed">24h</Text>
                  )}
                </Table.Td>
                <Table.Td>{Number(item.capacidadeHora) || '—'}</Table.Td>
                <Table.Td><Badge color={item.status ? 'green' : 'red'}>{item.status ? 'Ativo' : 'Inativo'}</Badge></Table.Td>
                <Table.Td>
                  <Group gap={4}>
                    <ActionIcon variant="subtle" onClick={() => abrirEdicao(item)}><IconEdit size={16} /></ActionIcon>
                    <ActionIcon variant="subtle" color={item.status ? 'red' : 'green'} onClick={() => toggleStatus(item)}><IconPower size={16} /></ActionIcon>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      <Modal opened={modalAberto} onClose={() => setModalAberto(false)} title={editando ? 'Editar Centro' : 'Novo Centro'} centered>
        <Stack gap="md">
          <TextInput label="Código" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.currentTarget.value })} required />
          <TextInput label="Descrição" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.currentTarget.value })} required />
          <Select label="Tipo" data={['MAQUINA', 'SETOR', 'LINHA']} value={form.tipo} onChange={(v) => setForm({ ...form, tipo: v || 'MAQUINA' })} />
          <Select
            label="Tipo de Processo"
            placeholder="Selecione o processo"
            data={tiposProcesso.map((t) => ({ value: t.id, label: t.descricao }))}
            value={form.tipoProcessoId}
            onChange={(v) => setForm({ ...form, tipoProcessoId: v })}
            required
            nothingFoundMessage="Nenhum tipo cadastrado — cadastre em Cadastros → Tipo de Processo"
          />
          <Select
            label="Turno Operacional"
            placeholder="24h (sem restrição)"
            description="Define quando esta máquina opera — usado no Gantt para projetar horários reais"
            data={turnos.map((t: any) => ({ value: t.id, label: `${t.descricao} (${t.horaInicio}-${t.horaFim})` }))}
            value={form.turnoProducaoId}
            onChange={(v) => setForm({ ...form, turnoProducaoId: v })}
            clearable
            nothingFoundMessage="Nenhum turno cadastrado — cadastre em Cadastros → Turnos"
          />
          <Group grow>
            <NumberInput label="Capacidade/Hora" value={form.capacidadeHora} onChange={(v) => setForm({ ...form, capacidadeHora: typeof v === 'number' ? v : 0 })} min={0} />
            <NumberInput label="Custo/Hora (R$)" value={form.custoHora} onChange={(v) => setForm({ ...form, custoHora: typeof v === 'number' ? v : 0 })} min={0} decimalScale={2} />
          </Group>

          <Divider label="Parâmetros de Orçamento" labelPosition="left" mt="sm" />

          <Group grow>
            <NumberInput label="Velocidade" value={form.velocidade} onChange={(v) => setForm({ ...form, velocidade: typeof v === 'number' ? v : 0 })} min={0} decimalScale={2} />
            <Select
              label="Unidade de Velocidade"
              placeholder="Selecione"
              data={[
                { value: 'FOLHAS_HORA', label: 'Folhas/Hora' },
                { value: 'METROS_HORA', label: 'Metros/Hora' },
                { value: 'UNIDADES_HORA', label: 'Unidades/Hora' },
              ]}
              value={form.unidadeVelocidade}
              onChange={(v) => setForm({ ...form, unidadeVelocidade: v })}
              clearable
            />
          </Group>

          <SimpleGrid cols={3}>
            <NumberInput label="Formato Folha — Largura (mm)" value={form.formatoFolhaLargura} onChange={(v) => setForm({ ...form, formatoFolhaLargura: typeof v === 'number' ? v : 0 })} min={0} />
            <NumberInput label="Formato Folha — Altura (mm)" value={form.formatoFolhaAltura} onChange={(v) => setForm({ ...form, formatoFolhaAltura: typeof v === 'number' ? v : 0 })} min={0} />
            <NumberInput label="Pinça (mm)" value={form.pincaMm} onChange={(v) => setForm({ ...form, pincaMm: typeof v === 'number' ? v : 0 })} min={0} decimalScale={2} />
          </SimpleGrid>

          <Button onClick={salvar} fullWidth>{editando ? 'Salvar' : 'Criar'}</Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
