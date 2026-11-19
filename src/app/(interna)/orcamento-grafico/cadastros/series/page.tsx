'use client'

import { useEffect, useState } from 'react'
import {
  Title, Stack, Table, Group, Button, Badge, Text, Loader, Center,
  Modal, TextInput, NumberInput, Switch, ActionIcon, ScrollArea, Tooltip,
} from '@mantine/core'
import { IconPlus, IconEdit, IconStar, IconPlayerPause, IconPlayerPlay } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'
import { SERIES_ENDPOINT as BASE, nomeSerieExibicao, type SerieDocumento } from '../_shared/series'

// ============================================================================
// Séries de numeração do orçamento. O Nº do orçamento é sequencial POR SÉRIE.
// Endpoint base: /orcamento-grafico/cadastros/series (origem ORCAMENTO)
// ============================================================================

interface FormData {
  nome: string
  descricao: string
  proximoNumero: number
  ativo: boolean
  padrao: boolean
}

const FORM_INICIAL: FormData = { nome: '', descricao: '', proximoNumero: 1, ativo: true, padrao: false }

export default function SeriesPage() {
  useEffect(() => { document.title = 'Orçamento Gráfico - Séries' }, [])

  const [data, setData] = useState<SerieDocumento[]>([])
  const [loading, setLoading] = useState(true)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<SerieDocumento | null>(null)
  const [form, setForm] = useState<FormData>(FORM_INICIAL)
  const [salvando, setSalvando] = useState(false)
  const [acaoEmCurso, setAcaoEmCurso] = useState<string | null>(null)

  function erro(titulo: string, err: any, padrao: string) {
    notifications.show({ title: titulo, message: err?.response?.data?.message || padrao, color: 'red' })
  }

  async function carregar() {
    setLoading(true)
    try {
      const res = await api.get(BASE, { params: { origem: 'ORCAMENTO', situacao: 'todas' } })
      setData(res.data || [])
    } catch (err: any) {
      erro('Erro ao carregar', err, 'Falha ao buscar séries')
    } finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [])

  function abrirNovo() {
    setEditando(null)
    setForm(FORM_INICIAL)
    setModalAberto(true)
  }

  function abrirEdicao(item: SerieDocumento) {
    setEditando(item)
    setForm({
      nome: item.nome,
      descricao: item.descricao ?? '',
      proximoNumero: item.proximoNumero,
      ativo: item.ativo,
      padrao: item.padrao,
    })
    setModalAberto(true)
  }

  async function salvar() {
    if (!form.proximoNumero || form.proximoNumero < 1) {
      notifications.show({ title: 'Erro', message: 'Próximo número deve ser maior ou igual a 1', color: 'red' })
      return
    }
    setSalvando(true)
    try {
      if (editando) {
        await api.put(`${BASE}/${editando.id}`, {
          nome: form.nome.trim(),
          descricao: form.descricao.trim() || null,
          proximoNumero: form.proximoNumero,
        })
      } else {
        await api.post(BASE, {
          origem: 'ORCAMENTO',
          nome: form.nome.trim(),
          descricao: form.descricao.trim() || null,
          proximoNumero: form.proximoNumero,
          ativo: form.ativo,
          padrao: form.padrao,
        })
      }
      notifications.show({ title: 'Salvo', message: `Série ${editando ? 'atualizada' : 'criada'} com sucesso`, color: 'green' })
      setModalAberto(false)
      carregar()
    } catch (err: any) {
      erro('Erro ao salvar', err, 'Falha ao salvar')
    } finally { setSalvando(false) }
  }

  async function executar(item: SerieDocumento, acao: 'ativar' | 'inativar' | 'padrao') {
    setAcaoEmCurso(`${item.id}:${acao}`)
    try {
      await api.patch(`${BASE}/${item.id}/${acao}`)
      const msg = acao === 'padrao' ? 'Série definida como padrão' : acao === 'ativar' ? 'Série ativada' : 'Série inativada'
      notifications.show({ title: 'Pronto', message: msg, color: 'green' })
      carregar()
    } catch (err: any) {
      erro('Erro', err, 'Falha ao executar a ação')
    } finally { setAcaoEmCurso(null) }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Séries</Title>
          <Text size="sm" c="dimmed">
            Séries de numeração do orçamento. Cada série tem sua própria sequência de números.
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>Nova série</Button>
      </Group>

      {loading ? <Center py="xl"><Loader /></Center> : (
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Nome</Table.Th>
                <Table.Th>Descrição</Table.Th>
                <Table.Th ta="right">Próximo número</Table.Th>
                <Table.Th>Padrão</Table.Th>
                <Table.Th>Ativo</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td fw={500}>
                    {item.nome.trim() ? item.nome : <Text span c="dimmed" fs="italic">{nomeSerieExibicao(item.nome)}</Text>}
                  </Table.Td>
                  <Table.Td>{item.descricao || '—'}</Table.Td>
                  <Table.Td ta="right">{item.proximoNumero.toLocaleString('pt-BR')}</Table.Td>
                  <Table.Td>{item.padrao ? <Badge color="blue">Padrão</Badge> : '—'}</Table.Td>
                  <Table.Td>
                    <Badge color={item.ativo ? 'green' : 'red'}>{item.ativo ? 'Ativo' : 'Inativo'}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap" justify="flex-end">
                      <Tooltip label="Editar">
                        <ActionIcon variant="subtle" onClick={() => abrirEdicao(item)} aria-label="Editar">
                          <IconEdit size={16} />
                        </ActionIcon>
                      </Tooltip>
                      {!item.padrao && item.ativo && (
                        <Tooltip label="Definir como padrão">
                          <ActionIcon
                            variant="subtle"
                            loading={acaoEmCurso === `${item.id}:padrao`}
                            onClick={() => executar(item, 'padrao')}
                            aria-label="Definir como padrão"
                          >
                            <IconStar size={16} />
                          </ActionIcon>
                        </Tooltip>
                      )}
                      {!item.padrao && (
                        <Tooltip label={item.ativo ? 'Inativar' : 'Ativar'}>
                          <ActionIcon
                            variant="subtle"
                            color={item.ativo ? 'red' : 'green'}
                            loading={acaoEmCurso === `${item.id}:${item.ativo ? 'inativar' : 'ativar'}`}
                            onClick={() => executar(item, item.ativo ? 'inativar' : 'ativar')}
                            aria-label={item.ativo ? 'Inativar' : 'Ativar'}
                          >
                            {item.ativo ? <IconPlayerPause size={16} /> : <IconPlayerPlay size={16} />}
                          </ActionIcon>
                        </Tooltip>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {data.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text ta="center" c="dimmed" py="md">Nenhuma série cadastrada</Text>
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
        title={editando ? 'Editar série' : 'Nova série'}
        centered
      >
        <Stack gap="md">
          <TextInput
            label="Nome"
            description="Até 10 caracteres. Deixe vazio para a série sem nome."
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.currentTarget.value })}
            maxLength={10}
          />
          <TextInput
            label="Descrição"
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.currentTarget.value })}
            maxLength={100}
          />
          <NumberInput
            label="Próximo número"
            description="Nunca é usado um número já existente na série."
            value={form.proximoNumero}
            onChange={(v) => setForm({ ...form, proximoNumero: typeof v === 'number' ? v : Number(v) || 1 })}
            min={1}
            allowDecimal={false}
            thousandSeparator="."
            decimalSeparator=","
          />
          {!editando && (
            <>
              <Switch
                label="Ativo"
                checked={form.ativo}
                onChange={(e) => setForm({ ...form, ativo: e.currentTarget.checked, padrao: e.currentTarget.checked && form.padrao })}
              />
              <Switch
                label="Série padrão"
                checked={form.padrao}
                disabled={!form.ativo}
                onChange={(e) => setForm({ ...form, padrao: e.currentTarget.checked })}
              />
            </>
          )}
          <Button onClick={salvar} fullWidth loading={salvando}>
            {editando ? 'Salvar alterações' : 'Criar'}
          </Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
