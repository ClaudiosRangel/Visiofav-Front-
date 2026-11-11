'use client'

import { useEffect, useState } from 'react'
import {
  Title, Stack, Table, Group, Button, Badge, Text, Loader, Center,
  Modal, TextInput, Switch, ActionIcon, ScrollArea,
} from '@mantine/core'
import { IconPlus, IconEdit } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

// ============================================================================
// Materiais Microondulado — cadastro simples (código, nome, ativo).
// Endpoint base: /orcamento-grafico/materiais-microondulado
// ============================================================================

interface MaterialMicroondulado {
  id: string
  codigo: string
  nome: string
  ativo: boolean
}

interface FormData {
  codigo: string
  nome: string
  ativo: boolean
}

const FORM_INICIAL: FormData = {
  codigo: '',
  nome: '',
  ativo: true,
}

export default function MateriaisMicroonduladoPage() {
  useEffect(() => { document.title = 'Orçamento Gráfico - Materiais Microondulado' }, [])

  const [data, setData] = useState<MaterialMicroondulado[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<MaterialMicroondulado | null>(null)
  const [form, setForm] = useState<FormData>(FORM_INICIAL)
  const [salvando, setSalvando] = useState(false)

  async function carregar() {
    setLoading(true)
    try {
      const res = await api.get('/orcamento-grafico/materiais-microondulado', {
        params: {
          situacao: mostrarInativos ? 'todas' : 'ativa',
          busca: busca || undefined,
        },
      })
      setData(res.data.data || res.data || [])
    } catch (err: any) {
      notifications.show({ title: 'Erro ao carregar', message: err?.response?.data?.message || 'Falha ao buscar materiais microondulado', color: 'red' })
    } finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [busca, mostrarInativos]) // eslint-disable-line react-hooks/exhaustive-deps

  function abrirNovo() {
    setEditando(null)
    setForm(FORM_INICIAL)
    setModalAberto(true)
  }

  function abrirEdicao(item: MaterialMicroondulado) {
    setEditando(item)
    setForm({ codigo: item.codigo, nome: item.nome, ativo: item.ativo })
    setModalAberto(true)
  }

  async function salvar() {
    if (!form.codigo.trim()) { notifications.show({ title: 'Erro', message: 'Código obrigatório', color: 'red' }); return }
    if (!form.nome.trim()) { notifications.show({ title: 'Erro', message: 'Nome obrigatório', color: 'red' }); return }

    setSalvando(true)
    try {
      const payload = {
        codigo: form.codigo.trim(),
        nome: form.nome.trim(),
        ativo: form.ativo,
      }
      if (editando) {
        await api.put(`/orcamento-grafico/materiais-microondulado/${editando.id}`, payload)
      } else {
        await api.post('/orcamento-grafico/materiais-microondulado', payload)
      }
      notifications.show({ title: 'Salvo', message: `Material microondulado ${editando ? 'atualizado' : 'criado'} com sucesso`, color: 'green' })
      setModalAberto(false)
      carregar()
    } catch (err: any) {
      // 409 (código duplicado) e demais erros exibem a mensagem do backend.
      const msg = err?.response?.status === 409
        ? (err?.response?.data?.message || 'Já existe um material microondulado com este código')
        : (err?.response?.data?.message || 'Falha ao salvar')
      notifications.show({ title: 'Erro ao salvar', message: msg, color: 'red' })
    } finally { setSalvando(false) }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Materiais Microondulado</Title>
          <Text size="sm" c="dimmed">Cadastro de materiais microondulado do orçamento gráfico</Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>Novo</Button>
      </Group>

      <Group justify="space-between">
        <TextInput
          placeholder="Buscar por código ou nome..."
          value={busca}
          onChange={(e) => setBusca(e.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <Switch
          label="Mostrar inativos"
          checked={mostrarInativos}
          onChange={(e) => setMostrarInativos(e.currentTarget.checked)}
        />
      </Group>

      {loading ? <Center py="xl"><Loader /></Center> : (
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Código</Table.Th>
                <Table.Th>Nome</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td fw={500}>{item.codigo}</Table.Td>
                  <Table.Td>{item.nome}</Table.Td>
                  <Table.Td>
                    <Badge color={item.ativo ? 'green' : 'red'}>{item.ativo ? 'Ativo' : 'Inativo'}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon variant="subtle" onClick={() => abrirEdicao(item)}>
                      <IconEdit size={16} />
                    </ActionIcon>
                  </Table.Td>
                </Table.Tr>
              ))}
              {data.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={4}>
                    <Text ta="center" c="dimmed" py="md">Nenhum material microondulado encontrado</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}

      <Modal
        opened={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editando ? 'Editar Material Microondulado' : 'Novo Material Microondulado'}
        centered
      >
        <Stack gap="md">
          <TextInput
            label="Código"
            value={form.codigo}
            onChange={(e) => setForm({ ...form, codigo: e.currentTarget.value })}
            required
            maxLength={30}
            placeholder="Ex: MM-001"
          />
          <TextInput
            label="Nome"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.currentTarget.value })}
            required
            maxLength={200}
            placeholder="Ex: Onda B 125g"
          />
          <Switch
            label="Ativo"
            checked={form.ativo}
            onChange={(e) => setForm({ ...form, ativo: e.currentTarget.checked })}
          />
          <Button onClick={salvar} fullWidth loading={salvando}>
            {editando ? 'Salvar Alterações' : 'Criar'}
          </Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
