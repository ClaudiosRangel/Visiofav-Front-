'use client'

import { useEffect, useState } from 'react'
import { Title, Stack, Card, Group, Button, Select, Table, Text, Badge, ActionIcon, NumberInput, TextInput, Loader, Center, Alert, Modal } from '@mantine/core'
import { IconPlus, IconTrash, IconSitemap, IconCopy } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

export default function EstruturasProdutoPage() {
  useEffect(() => { document.title = 'PCP - Estruturas (BOM)' }, [])

  const [produtos, setProdutos] = useState<any[]>([])
  const [produtoId, setProdutoId] = useState<string | null>(null)
  const [estruturas, setEstruturas] = useState<any[]>([])
  const [estruturaSelecionada, setEstruturaSelecionada] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  // Modal novo item
  const [modalAberto, setModalAberto] = useState(false)
  const [componentes, setComponentes] = useState<any[]>([])
  const [novoItem, setNovoItem] = useState<any>({ produtoComponenteId: '', quantidade: 1, unidadeMedida: 'UN', percentualPerda: 0, sequencia: 1, tipoComponente: '', aproveitamento: null, perdaFixaAcerto: null, coberturaPercent: null })

  // Modal nova estrutura
  const [modalNovaAberto, setModalNovaAberto] = useState(false)

  useEffect(() => {
    api.get('/produtos', { params: { limit: 200, status: 'true' } }).then((res) => {
      const lista = (res.data.data || res.data).map((p: any) => ({ value: p.id, label: `${p.codigo} - ${p.nome}` }))
      setProdutos(lista)
      setComponentes(lista)
    }).catch(() => {})
  }, [])

  async function carregarEstruturas(pid: string) {
    setLoading(true)
    try {
      const res = await api.get('/estruturas-produto', { params: { produtoId: pid } })
      setEstruturas(res.data.data || [])
      if (res.data.data?.length > 0) {
        setEstruturaSelecionada(res.data.data[0])
      } else {
        setEstruturaSelecionada(null)
      }
    } catch { setEstruturas([]) }
    finally { setLoading(false) }
  }

  useEffect(() => { if (produtoId) carregarEstruturas(produtoId) }, [produtoId])

  async function criarEstrutura() {
    if (!produtoId) return
    try {
      const res = await api.post('/estruturas-produto', { produtoId, status: 'ATIVA' })
      notifications.show({ title: 'Estrutura criada', message: `Versão ${res.data.versao}`, color: 'green' })
      carregarEstruturas(produtoId)
      setModalNovaAberto(false)
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' })
    }
  }

  async function adicionarItem() {
    if (!estruturaSelecionada || !novoItem.produtoComponenteId) return
    try {
      await api.post(`/estruturas-produto/${estruturaSelecionada.id}/itens`, novoItem)
      notifications.show({ title: 'Item adicionado', message: '', color: 'green' })
      carregarEstruturas(produtoId!)
      setModalAberto(false)
      setNovoItem({ produtoComponenteId: '', quantidade: 1, unidadeMedida: 'UN', percentualPerda: 0, sequencia: (estruturaSelecionada.itens?.length || 0) + 1 })
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' })
    }
  }

  async function removerItem(itemId: string) {
    if (!estruturaSelecionada) return
    try {
      await api.delete(`/estruturas-produto/${estruturaSelecionada.id}/itens/${itemId}`)
      carregarEstruturas(produtoId!)
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' })
    }
  }

  async function duplicarEstrutura() {
    if (!estruturaSelecionada) return
    try {
      await api.post(`/estruturas-produto/${estruturaSelecionada.id}/duplicar`)
      notifications.show({ title: 'Estrutura duplicada', message: 'Nova versão criada', color: 'green' })
      carregarEstruturas(produtoId!)
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' })
    }
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Title order={3}>Estruturas de Produto (BOM)</Title>
      </Group>

      <Card withBorder>
        <Group>
          <Select
            label="Selecione o Produto"
            placeholder="Buscar produto..."
            data={produtos}
            value={produtoId}
            onChange={setProdutoId}
            searchable
            w={400}
          />
          {produtoId && (
            <Button mt={24} leftSection={<IconPlus size={16} />} onClick={() => setModalNovaAberto(true)}>
              Nova Estrutura
            </Button>
          )}
        </Group>
      </Card>

      {loading && <Center py="xl"><Loader /></Center>}

      {!loading && produtoId && estruturas.length === 0 && (
        <Alert color="yellow">
          Este produto não possui estrutura (BOM) cadastrada. Clique em "Nova Estrutura" para criar.
        </Alert>
      )}

      {estruturaSelecionada && (
        <Card withBorder>
          <Stack gap="md">
            <Group justify="space-between">
              <Group>
                <IconSitemap size={20} />
                <Text fw={600}>Versão {estruturaSelecionada.versao}</Text>
                <Badge color={estruturaSelecionada.status === 'ATIVA' ? 'green' : 'gray'}>{estruturaSelecionada.status}</Badge>
                <Text size="sm" c="dimmed">Rendimento: {Number(estruturaSelecionada.rendimento)}</Text>
              </Group>
              <Group>
                <Button size="xs" variant="light" leftSection={<IconCopy size={14} />} onClick={duplicarEstrutura}>Duplicar</Button>
                <Button size="xs" leftSection={<IconPlus size={14} />} onClick={() => setModalAberto(true)}>Adicionar Componente</Button>
              </Group>
            </Group>

            {estruturaSelecionada.itens?.length > 0 ? (
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Seq</Table.Th>
                    <Table.Th>Componente</Table.Th>
                    <Table.Th>Quantidade</Table.Th>
                    <Table.Th>Unidade</Table.Th>
                    <Table.Th>% Perda</Table.Th>
                    <Table.Th>Qtd Líquida</Table.Th>
                    <Table.Th></Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {estruturaSelecionada.itens.map((item: any) => (
                    <Table.Tr key={item.id}>
                      <Table.Td>{item.sequencia}</Table.Td>
                      <Table.Td>{componentes.find((c) => c.value === item.produtoComponenteId)?.label || item.produtoComponenteId.substring(0, 8)}</Table.Td>
                      <Table.Td>{Number(item.quantidade)}</Table.Td>
                      <Table.Td>{item.unidadeMedida}</Table.Td>
                      <Table.Td>{Number(item.percentualPerda)}%</Table.Td>
                      <Table.Td fw={600}>{Number(item.quantidadeLiquida)}</Table.Td>
                      <Table.Td>
                        <ActionIcon color="red" variant="subtle" onClick={() => removerItem(item.id)}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            ) : (
              <Text c="dimmed" ta="center" py="md">Nenhum componente adicionado. Clique em "Adicionar Componente".</Text>
            )}
          </Stack>
        </Card>
      )}

      {/* Modal: Adicionar Componente */}
      <Modal opened={modalAberto} onClose={() => setModalAberto(false)} title="Adicionar Componente à BOM" centered size="lg">
        <Stack gap="md">
          <Group grow>
            <Select
              label="Classificação do Componente"
              placeholder="Selecione"
              data={[
                { value: 'MATERIA_PRIMA', label: 'Matéria-Prima (transformada no processo)' },
                { value: 'COMPONENTE', label: 'Componente / Semiacabado' },
                { value: 'INSUMO', label: 'Insumo / Consumível' },
                { value: 'EMBALAGEM', label: 'Embalagem' },
              ]}
              value={novoItem.tipoComponente}
              onChange={(v) => setNovoItem({ ...novoItem, tipoComponente: v || '' })}
              clearable
            />
          </Group>

          <Select
            label="Componente"
            placeholder="Buscar produto..."
            data={componentes}
            value={novoItem.produtoComponenteId}
            onChange={(v) => setNovoItem({ ...novoItem, produtoComponenteId: v || '' })}
            searchable
            required
          />

          <Group grow>
            <NumberInput
              label="Quantidade"
              description="Por unidade de produto final"
              value={novoItem.quantidade}
              onChange={(v) => setNovoItem({ ...novoItem, quantidade: typeof v === 'number' ? v : 1 })}
              min={0.0001}
              decimalScale={4}
            />
            <Select
              label="Unidade de Consumo"
              data={['UN', 'KG', 'G', 'M', 'M2', 'ML', 'LT', 'FL', 'RSM', 'CX', 'PCT', 'PC', 'TON']}
              value={novoItem.unidadeMedida}
              onChange={(v) => setNovoItem({ ...novoItem, unidadeMedida: v || 'UN' })}
              searchable
            />
          </Group>

          <Group grow>
            <NumberInput
              label="% Perda Variável"
              description="Refugo proporcional à tiragem"
              value={novoItem.percentualPerda}
              onChange={(v) => setNovoItem({ ...novoItem, percentualPerda: typeof v === 'number' ? v : 0 })}
              min={0}
              max={100}
              suffix="%"
            />
            <NumberInput
              label="Perda Fixa de Setup"
              description="Unidades fixas gastas no acerto (independe da tiragem)"
              value={novoItem.perdaFixaAcerto || ''}
              onChange={(v) => setNovoItem({ ...novoItem, perdaFixaAcerto: typeof v === 'number' ? v : null })}
              min={0}
            />
          </Group>

          <Group grow>
            <NumberInput
              label="Aproveitamento (peças por unidade de MP)"
              description="Ex: 8 itens por folha, 4 peças por barra"
              value={novoItem.aproveitamento || ''}
              onChange={(v) => setNovoItem({ ...novoItem, aproveitamento: typeof v === 'number' ? v : null })}
              min={1}
            />
            <NumberInput
              label="% Cobertura / Aplicação"
              description="Para tintas, vernizes ou revestimentos"
              value={novoItem.coberturaPercent || ''}
              onChange={(v) => setNovoItem({ ...novoItem, coberturaPercent: typeof v === 'number' ? v : null })}
              min={0}
              max={100}
              suffix="%"
            />
          </Group>

          <NumberInput
            label="Sequência"
            value={novoItem.sequencia}
            onChange={(v) => setNovoItem({ ...novoItem, sequencia: typeof v === 'number' ? v : 1 })}
            min={1}
            w={100}
          />

          <Button onClick={adicionarItem} fullWidth>Adicionar Componente</Button>
        </Stack>
      </Modal>

      {/* Modal: Nova Estrutura */}
      <Modal opened={modalNovaAberto} onClose={() => setModalNovaAberto(false)} title="Criar Nova Estrutura (BOM)" centered>
        <Stack gap="md">
          <Text size="sm">Será criada uma nova estrutura para o produto selecionado com status ATIVA.</Text>
          <Button onClick={criarEstrutura} fullWidth>Criar Estrutura</Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
