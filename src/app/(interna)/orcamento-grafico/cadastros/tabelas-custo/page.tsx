'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Title, Stack, Table, Group, Button, Badge, Text, Loader, Center, Modal,
  TextInput, Switch, ActionIcon, ScrollArea, Alert,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { IconPlus, IconEdit, IconAlertTriangle } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

// Tabelas de Custo por vigência (paridade TabelasCusto do Calcgraf). O backend
// bloqueia vigência sobreposta (409). Spec configurador-grafico-calcgraf (Req 4).

interface TabelaCusto {
  id: string
  nome: string
  vigenciaInicio: string
  vigenciaFim: string | null
  ativo: boolean
}

const fmtData = (s: string | null) => (s ? new Date(s).toLocaleDateString('pt-BR') : 'em aberto')

export default function TabelasCustoPage() {
  useEffect(() => { document.title = 'Orçamento Gráfico - Tabelas de Custo' }, [])

  const [itens, setItens] = useState<TabelaCusto[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<TabelaCusto | null>(null)
  const [nome, setNome] = useState('')
  const [inicio, setInicio] = useState<Date | null>(new Date())
  const [fim, setFim] = useState<Date | null>(null)
  const [ativo, setAtivo] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/configurador-grafico/tabelas-custo')
      setItens(data.tabelas || [])
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao carregar.', color: 'red' })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { carregar() }, [carregar])

  function abrirNovo() {
    setEditando(null)
    setNome('')
    setInicio(new Date())
    setFim(null)
    setAtivo(true)
    setErro(null)
    setModalAberto(true)
  }

  function abrirEdicao(t: TabelaCusto) {
    setEditando(t)
    setNome(t.nome)
    setInicio(new Date(t.vigenciaInicio))
    setFim(t.vigenciaFim ? new Date(t.vigenciaFim) : null)
    setAtivo(t.ativo)
    setErro(null)
    setModalAberto(true)
  }

  async function salvar() {
    if (!nome.trim() || !inicio) {
      setErro('Informe o nome e a data de início de vigência.')
      return
    }
    setErro(null)
    setSalvando(true)
    const body = {
      nome,
      vigenciaInicio: inicio.toISOString().slice(0, 10),
      vigenciaFim: fim ? fim.toISOString().slice(0, 10) : null,
      ativo,
    }
    try {
      if (editando) {
        await api.put(`/configurador-grafico/tabelas-custo/${editando.id}`, body)
      } else {
        await api.post('/configurador-grafico/tabelas-custo', body)
      }
      notifications.show({ title: 'Salvo', message: 'Tabela de custo salva.', color: 'green' })
      setModalAberto(false)
      carregar()
    } catch (err: any) {
      // 409 = conflito de vigência sobreposta → mostra a mensagem clara no modal.
      const msg = err?.response?.data?.message || 'Falha ao salvar.'
      if (err?.response?.status === 409) {
        setErro(msg)
      } else {
        notifications.show({ title: 'Erro', message: msg, color: 'red' })
      }
    } finally {
      setSalvando(false)
    }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Tabelas de Custo</Title>
          <Text size="sm" c="dimmed">
            Versões de valores com validade por período. Não é permitido coexistir
            versões cobrindo a mesma data (vigência não pode se sobrepor).
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>Nova Versão</Button>
      </Group>

      {loading ? (
        <Center py="xl"><Loader /></Center>
      ) : (
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nome</Table.Th>
                <Table.Th>Vigência início</Table.Th>
                <Table.Th>Vigência fim</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th ta="center">Ações</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {itens.map((t) => (
                <Table.Tr key={t.id}>
                  <Table.Td fw={500}>{t.nome}</Table.Td>
                  <Table.Td>{fmtData(t.vigenciaInicio)}</Table.Td>
                  <Table.Td>{fmtData(t.vigenciaFim)}</Table.Td>
                  <Table.Td><Badge color={t.ativo ? 'green' : 'gray'}>{t.ativo ? 'Ativa' : 'Inativa'}</Badge></Table.Td>
                  <Table.Td ta="center">
                    <ActionIcon variant="subtle" onClick={() => abrirEdicao(t)}><IconEdit size={18} /></ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
              {itens.length === 0 && (
                <Table.Tr><Table.Td colSpan={5}><Text ta="center" c="dimmed" py="md">Nenhuma tabela de custo cadastrada</Text></Table.Td></Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}

      <Modal opened={modalAberto} onClose={() => setModalAberto(false)} title={editando ? 'Editar Versão' : 'Nova Versão'} size="md">
        <Stack gap="sm">
          {erro && (
            <Alert color="orange" variant="light" icon={<IconAlertTriangle size={16} />}>{erro}</Alert>
          )}
          <TextInput label="Nome" placeholder="Ex.: Padrão, Teste 2026" value={nome} onChange={(e) => setNome(e.currentTarget.value)} required />
          <Group grow>
            <DatePickerInput label="Vigência início" value={inicio} onChange={setInicio} valueFormat="DD/MM/YYYY" required />
            <DatePickerInput label="Vigência fim (opcional)" value={fim} onChange={setFim} valueFormat="DD/MM/YYYY" clearable />
          </Group>
          <Switch label="Ativa" checked={ativo} onChange={(e) => setAtivo(e.currentTarget.checked)} />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={() => setModalAberto(false)}>Cancelar</Button>
            <Button onClick={salvar} loading={salvando}>Salvar</Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  )
}
