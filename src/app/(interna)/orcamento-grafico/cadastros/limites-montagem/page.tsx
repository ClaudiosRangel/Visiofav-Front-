'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Title, Stack, Table, Group, Button, Text, Loader, Center,
  Modal, NumberInput, ActionIcon, ScrollArea, Pagination, SimpleGrid, Alert,
} from '@mantine/core'
import { IconPlus, IconEdit, IconTrash, IconAlertCircle } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { AvisoSemInfluencia } from '../_shared/AvisoSemInfluencia'
import { limitesMontagemApi, mensagemErroApi } from '../_shared/cadastros-graficos.api'
import type { LimiteMontagem } from '../_shared/cadastros-graficos.types'

// ============================================================================
// Limites de Montagem: faixa (mínimo/máximo) por formato final (largura × altura).
// Exclusão física. Cadastro informativo por enquanto.
// ============================================================================

interface FormData {
  largura: number | ''
  altura: number | ''
  minimo: number | ''
  maximo: number | ''
}

const FORM_INICIAL: FormData = { largura: '', altura: '', minimo: '', maximo: '' }
const LIMITE = 50

export default function LimitesMontagemPage() {
  useEffect(() => { document.title = 'Orçamento Gráfico - Limites de Montagem' }, [])

  const [itens, setItens] = useState<LimiteMontagem[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [pagina, setPagina] = useState(1)
  const [total, setTotal] = useState(0)
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<LimiteMontagem | null>(null)
  const [form, setForm] = useState<FormData>(FORM_INICIAL)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const res = await limitesMontagemApi.listar({ pagina, limite: LIMITE })
      setItens(res.itens)
      setTotal(res.total)
    } catch (err) {
      setErro(mensagemErroApi(err, 'Falha ao buscar limites de montagem'))
    } finally {
      setLoading(false)
    }
  }, [pagina])

  useEffect(() => { carregar() }, [carregar])

  function abrirNovo() {
    setEditando(null)
    setForm(FORM_INICIAL)
    setModalAberto(true)
  }

  function abrirEdicao(item: LimiteMontagem) {
    setEditando(item)
    setForm({
      largura: Number(item.formatoFinalLargura),
      altura: Number(item.formatoFinalAltura),
      minimo: item.minimo,
      maximo: item.maximo,
    })
    setModalAberto(true)
  }

  const maximoInvalido =
    form.minimo !== '' && form.maximo !== '' && Number(form.maximo) < Number(form.minimo)

  async function salvar() {
    if (form.largura === '' || form.altura === '' || form.minimo === '' || form.maximo === '') {
      notifications.show({ title: 'Erro', message: 'Preencha largura, altura, mínimo e máximo', color: 'red' })
      return
    }
    if (maximoInvalido) {
      notifications.show({ title: 'Erro', message: 'O máximo deve ser maior ou igual ao mínimo', color: 'red' })
      return
    }
    setSalvando(true)
    try {
      const payload = {
        formatoFinalLargura: Number(form.largura),
        formatoFinalAltura: Number(form.altura),
        minimo: Number(form.minimo),
        maximo: Number(form.maximo),
      }
      if (editando) await limitesMontagemApi.atualizar(editando.id, payload)
      else await limitesMontagemApi.criar(payload)
      notifications.show({ title: 'Salvo', message: `Limite ${editando ? 'atualizado' : 'criado'} com sucesso`, color: 'green' })
      setModalAberto(false)
      carregar()
    } catch (err) {
      notifications.show({ title: 'Erro ao salvar', message: mensagemErroApi(err, 'Falha ao salvar'), color: 'red' })
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(item: LimiteMontagem) {
    if (!confirm(`Excluir o limite ${Number(item.formatoFinalLargura)} × ${Number(item.formatoFinalAltura)} mm?`)) return
    try {
      await limitesMontagemApi.excluir(item.id)
      notifications.show({ title: 'Excluído', message: 'Limite removido', color: 'yellow' })
      if (itens.length === 1 && pagina > 1) setPagina(pagina - 1)
      else carregar()
    } catch (err) {
      notifications.show({ title: 'Erro ao excluir', message: mensagemErroApi(err, 'Falha ao excluir'), color: 'red' })
    }
  }

  const totalPaginas = Math.max(1, Math.ceil(total / LIMITE))

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Limites de Montagem</Title>
          <Text size="sm" c="dimmed">
            {total} {total === 1 ? 'limite cadastrado' : 'limites cadastrados'} por formato final.
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>Novo Limite</Button>
      </Group>

      <AvisoSemInfluencia />

      {erro && (
        <Alert color="red" variant="light" icon={<IconAlertCircle size={16} />} title="Erro ao carregar">
          <Group justify="space-between">
            <Text size="sm">{erro}</Text>
            <Button size="xs" variant="light" color="red" onClick={carregar}>Tentar novamente</Button>
          </Group>
        </Alert>
      )}

      {loading ? <Center py="xl"><Loader /></Center> : (
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Largura (mm)</Table.Th>
                <Table.Th>Altura (mm)</Table.Th>
                <Table.Th>Mínimo</Table.Th>
                <Table.Th>Máximo</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {itens.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td fw={500}>{Number(item.formatoFinalLargura)}</Table.Td>
                  <Table.Td fw={500}>{Number(item.formatoFinalAltura)}</Table.Td>
                  <Table.Td>{item.minimo}</Table.Td>
                  <Table.Td>{item.maximo}</Table.Td>
                  <Table.Td>
                    <Group gap={4} justify="flex-end">
                      <ActionIcon variant="subtle" onClick={() => abrirEdicao(item)} aria-label="Editar">
                        <IconEdit size={16} />
                      </ActionIcon>
                      <ActionIcon variant="subtle" color="red" onClick={() => excluir(item)} aria-label="Excluir">
                        <IconTrash size={16} />
                      </ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {itens.length === 0 && !erro && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text ta="center" c="dimmed" py="md">Nenhum limite de montagem cadastrado.</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}

      {totalPaginas > 1 && (
        <Group justify="center">
          <Pagination total={totalPaginas} value={pagina} onChange={setPagina} />
        </Group>
      )}

      <Modal
        opened={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editando ? 'Editar Limite de Montagem' : 'Novo Limite de Montagem'}
        centered
      >
        <Stack gap="md">
          <Text size="sm" fw={500}>Formato final</Text>
          <SimpleGrid cols={2}>
            <NumberInput
              label="Largura (mm)"
              value={form.largura}
              onChange={(v) => setForm({ ...form, largura: typeof v === 'number' ? v : '' })}
              min={0}
              decimalScale={2}
              required
            />
            <NumberInput
              label="Altura (mm)"
              value={form.altura}
              onChange={(v) => setForm({ ...form, altura: typeof v === 'number' ? v : '' })}
              min={0}
              decimalScale={2}
              required
            />
          </SimpleGrid>
          <SimpleGrid cols={2}>
            <NumberInput
              label="Mínimo"
              value={form.minimo}
              onChange={(v) => setForm({ ...form, minimo: typeof v === 'number' ? v : '' })}
              min={0}
              allowDecimal={false}
              required
            />
            <NumberInput
              label="Máximo"
              value={form.maximo}
              onChange={(v) => setForm({ ...form, maximo: typeof v === 'number' ? v : '' })}
              min={0}
              allowDecimal={false}
              required
              error={maximoInvalido ? 'Deve ser maior ou igual ao mínimo' : undefined}
            />
          </SimpleGrid>
          <Button onClick={salvar} fullWidth loading={salvando} disabled={maximoInvalido}>
            {editando ? 'Salvar Alterações' : 'Criar Limite'}
          </Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
