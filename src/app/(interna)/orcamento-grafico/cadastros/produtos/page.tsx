'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Title, Stack, Table, Group, Button, Badge, Text, Loader, Center, TextInput, Select,
  ActionIcon, ScrollArea, Alert,
} from '@mantine/core'
import { IconPlus, IconEdit, IconTrash, IconAlertCircle, IconSearch } from '@tabler/icons-react'
import { notifications } from '@mantine/notifications'
import { produtosApi, mensagemErroApi } from '../_shared/cadastros-graficos.api'
import type { ProdutoGrafico, SituacaoFiltro } from '../_shared/cadastros-graficos.types'
import AvisoSemInfluencia from '../_shared/AvisoSemInfluencia'
import ProdutoModal from './ProdutoModal'

// ============================================================================
// Produtos do Orçamento Gráfico — lista + formulário com abas
// (Dados, Tributação, Defaults por plano, Relações).
// ============================================================================

const SITUACOES = [
  { value: 'ativo', label: 'Ativos' },
  { value: 'inativo', label: 'Inativos' },
  { value: 'todos', label: 'Todos' },
]

export default function ProdutosGraficosPage() {
  useEffect(() => { document.title = 'Orçamento Gráfico - Produtos' }, [])

  const [produtos, setProdutos] = useState<ProdutoGrafico[]>([])
  const [busca, setBusca] = useState('')
  const [situacao, setSituacao] = useState<SituacaoFiltro>('ativo')
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)

  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<ProdutoGrafico | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const lista = await produtosApi.listar({ situacao, busca: busca.trim() || undefined })
      setProdutos(lista ?? [])
    } catch (err) {
      setErro(mensagemErroApi(err, 'Falha ao carregar produtos'))
    } finally {
      setLoading(false)
    }
  }, [situacao, busca])

  useEffect(() => {
    const t = setTimeout(carregar, 250)
    return () => clearTimeout(t)
  }, [carregar])

  function abrirNovo() {
    setEditando(null)
    setModalAberto(true)
  }

  function abrirEdicao(p: ProdutoGrafico) {
    setEditando(p)
    setModalAberto(true)
  }

  async function inativar(p: ProdutoGrafico) {
    if (!confirm(`Deseja inativar "${p.nome}"?`)) return
    try {
      await produtosApi.inativar(p.id)
      notifications.show({ title: 'Inativado', message: `"${p.nome}" foi inativado`, color: 'yellow' })
      carregar()
    } catch (err) {
      notifications.show({ title: 'Erro', message: mensagemErroApi(err, 'Falha ao inativar'), color: 'red' })
    }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <div>
          <Title order={3}>Produtos</Title>
          <Text size="sm" c="dimmed">
            {produtos.length} {produtos.length === 1 ? 'produto' : 'produtos'} listados
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>Novo Produto</Button>
      </Group>

      <AvisoSemInfluencia>
        Os padrões por plano e as relações do produto ficam registrados para uso nas próximas etapas;
        ainda não alteram o cálculo do orçamento nem o PCP.
      </AvisoSemInfluencia>

      <Group grow align="flex-end">
        <TextInput
          placeholder="Buscar por código ou nome..."
          leftSection={<IconSearch size={16} />}
          value={busca}
          onChange={(e) => setBusca(e.currentTarget.value)}
        />
        <Select
          allowDeselect={false}
          data={SITUACOES}
          value={situacao}
          onChange={(v) => setSituacao((v as SituacaoFiltro) || 'ativo')}
        />
      </Group>

      {erro && (
        <Alert color="red" icon={<IconAlertCircle size={16} />} title="Erro ao carregar">
          <Group justify="space-between">
            <Text size="sm">{erro}</Text>
            <Button size="xs" variant="light" onClick={carregar}>Tentar novamente</Button>
          </Group>
        </Alert>
      )}

      {loading ? (
        <Center py="xl"><Loader /></Center>
      ) : (
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Código</Table.Th>
                <Table.Th>Nome</Table.Th>
                <Table.Th>Prazo (dias)</Table.Th>
                <Table.Th>Sem impressão</Table.Th>
                <Table.Th>Situação</Table.Th>
                <Table.Th w={90}></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {produtos.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td c="dimmed">{p.codigo}</Table.Td>
                  <Table.Td fw={500}>{p.nome}</Table.Td>
                  <Table.Td>{p.prazoProducaoDias}</Table.Td>
                  <Table.Td>{p.semImpressao ? 'Sim' : 'Não'}</Table.Td>
                  <Table.Td>
                    <Badge color={p.status ? 'green' : 'gray'}>{p.status ? 'Ativo' : 'Inativo'}</Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap">
                      <ActionIcon variant="subtle" aria-label="Editar" onClick={() => abrirEdicao(p)}>
                        <IconEdit size={16} />
                      </ActionIcon>
                      {p.status && (
                        <ActionIcon variant="subtle" color="red" aria-label="Inativar" onClick={() => inativar(p)}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {produtos.length === 0 && !erro && (
                <Table.Tr>
                  <Table.Td colSpan={6}>
                    <Text ta="center" c="dimmed" py="md">Nenhum produto encontrado</Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}

      {modalAberto && (
        <ProdutoModal
          produto={editando}
          onClose={() => setModalAberto(false)}
          onSalvo={carregar}
        />
      )}
    </Stack>
  )
}
