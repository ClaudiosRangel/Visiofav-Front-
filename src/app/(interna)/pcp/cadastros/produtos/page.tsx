'use client'

import { useEffect, useState } from 'react'
import { Title, Stack, Table, Group, Select, Badge, Button, Text, Loader, Center, Modal, Pagination } from '@mantine/core'
import { IconEdit } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

const CLASSIFICACOES = [
  { value: 'MATERIA_PRIMA', label: 'Matéria-Prima' },
  { value: 'INTERMEDIARIO', label: 'Intermediário' },
  { value: 'PRODUTO_ACABADO', label: 'Produto Acabado' },
  { value: 'EMBALAGEM', label: 'Embalagem' },
  { value: 'INSUMO', label: 'Insumo' },
]

const TIPOS_FISICOS = [
  { value: 'UNIDADE_PADRAO', label: 'Unidade Padrão (peças, caixas)' },
  { value: 'FISICO_LINEAR', label: 'Físico Linear (bobinas, barras, metros)' },
  { value: 'FISICO_SUPERFICIAL', label: 'Físico Superficial (folhas, chapas, m²)' },
  { value: 'LIQUIDO', label: 'Líquido (tintas, vernizes, litros)' },
  { value: 'PESO', label: 'Peso (granel, kg)' },
]

const CLASSIF_COLORS: Record<string, string> = {
  MATERIA_PRIMA: 'orange', INTERMEDIARIO: 'blue', PRODUTO_ACABADO: 'green', EMBALAGEM: 'gray', INSUMO: 'cyan',
}

export default function ProdutosPcpPage() {
  useEffect(() => { document.title = 'PCP - Configuração de Produtos' }, [])

  const [produtos, setProdutos] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)

  // Modal edição
  const [modalAberto, setModalAberto] = useState(false)
  const [produtoEditando, setProdutoEditando] = useState<any>(null)
  const [classificacao, setClassificacao] = useState<string | null>(null)
  const [tipoFisico, setTipoFisico] = useState<string | null>(null)

  async function carregar() {
    setLoading(true)
    try {
      const res = await api.get('/produtos', { params: { page, limit: 30, status: 'true' } })
      setProdutos(res.data.data || res.data)
      setTotal(res.data.total || 0)
    } catch { }
    finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [page])

  function abrirEdicao(produto: any) {
    setProdutoEditando(produto)
    setClassificacao(produto.classificacaoPcp || null)
    setTipoFisico(produto.tipoFisico || null)
    setModalAberto(true)
  }

  async function salvar() {
    if (!produtoEditando) return
    try {
      await api.put(`/produtos/${produtoEditando.id}`, {
        codigo: produtoEditando.codigo,
        nome: produtoEditando.nome,
        unidade: produtoEditando.unidade,
        classificacaoPcp: classificacao || null,
        tipoFisico: tipoFisico || null,
      })
      notifications.show({ title: 'Salvo', message: `${produtoEditando.codigo} atualizado`, color: 'green' })
      setModalAberto(false)
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha', color: 'red' })
    }
  }

  return (
    <Stack gap="md">
      <Title order={3}>Configuração de Produtos para Produção</Title>
      <Text size="sm" c="dimmed">
        Defina a classificação PCP e o tipo físico de cada produto. Isso controla quais produtos aparecem na OP e qual algoritmo de cálculo de consumo o sistema usa.
      </Text>

      {loading ? <Center py="xl"><Loader /></Center> : (
        <>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Código</Table.Th>
                <Table.Th>Nome</Table.Th>
                <Table.Th>Unidade</Table.Th>
                <Table.Th>Classificação PCP</Table.Th>
                <Table.Th>Tipo Físico</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {produtos.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td fw={600}>{p.codigo}</Table.Td>
                  <Table.Td>{p.nome}</Table.Td>
                  <Table.Td>{p.unidade}</Table.Td>
                  <Table.Td>
                    {p.classificacaoPcp ? (
                      <Badge color={CLASSIF_COLORS[p.classificacaoPcp] || 'gray'} size="sm">{p.classificacaoPcp}</Badge>
                    ) : <Text size="xs" c="dimmed">—</Text>}
                  </Table.Td>
                  <Table.Td>
                    {p.tipoFisico ? (
                      <Badge variant="light" size="sm">{p.tipoFisico}</Badge>
                    ) : <Text size="xs" c="dimmed">—</Text>}
                  </Table.Td>
                  <Table.Td>
                    <Button size="xs" variant="subtle" leftSection={<IconEdit size={14} />} onClick={() => abrirEdicao(p)}>
                      Configurar
                    </Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
          <Group justify="center">
            <Pagination total={Math.ceil(total / 30)} value={page} onChange={setPage} />
          </Group>
        </>
      )}

      <Modal opened={modalAberto} onClose={() => setModalAberto(false)} title={`Configurar: ${produtoEditando?.codigo} - ${produtoEditando?.nome}`} centered>
        <Stack gap="md">
          <Select
            label="Classificação PCP"
            description="Define se o produto é fabricado ou comprado"
            data={CLASSIFICACOES}
            value={classificacao}
            onChange={setClassificacao}
            clearable
          />
          <Select
            label="Tipo Físico (Movimentação)"
            description="Define o algoritmo de cálculo de consumo na produção"
            data={TIPOS_FISICOS}
            value={tipoFisico}
            onChange={setTipoFisico}
            clearable
          />
          <Button onClick={salvar} fullWidth>Salvar</Button>
        </Stack>
      </Modal>
    </Stack>
  )
}
