'use client'

/**
 * Central de Consulta do Produto/Acabado (Ponto 3 do módulo Comercial).
 * Busca única por CÓDIGO DO ACABADO ou NOME do produto; mostra identificação,
 * arte, ficha técnica, histórico de OPs e cálculos; permite editar o cadastro
 * (quando o usuário tem permissão). Mesma tela usada no menu Comercial e PCP.
 * Consome /comercial/central-produto/{busca,detalhe,permissao,produto/:id}.
 */
import { useEffect, useState, useCallback } from 'react'
import {
  Title, Stack, Group, Text, Loader, Center, Paper, Badge, TextInput,
  Button, Image, Table, Divider, Alert, Card, SimpleGrid,
} from '@mantine/core'
import { IconSearch, IconEdit, IconPhotoOff, IconInfoCircle, IconLayoutList, IconFileDescription } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { EditarCadastroModal } from './EditarCadastroModal'
import { FichaMasterModal } from './FichaMaster'

// ── Tipos (espelham o backend) ──
interface GrupoResultado {
  tipo: 'PRODUTO' | 'ACABADO_SEM_PRODUTO'
  chave: string
  produtoId: string | null
  calculoId: string | null
  codigo: string | null
  descricao: string | null
  codigosAcabado: string[]
  semProdutoCadastrado: boolean
}
interface ResultadoBusca {
  resultados: GrupoResultado[]
  semResultado: boolean
  detalheDireto: boolean
  limiteAplicado: boolean
  termoBusca: string
}
export interface FichaAtributos {
  tipoCartaoNome: string | null
  tipoFormatoNome: string | null
  tipoGramaturaNome: string | null
  tipoPolicromiaNome: string | null
  tipoVernizNome: string | null
  tipoCoresNomes: string[]
}
interface FichaEngenharia {
  aproveitamento: number | null
  numCores: number | null
  formatoCorteLarguraMm: number | null
  formatoCorteAlturaMm: number | null
  gramatura: number | null
}
export interface DetalheProduto {
  identificacao: {
    produtoId: string | null
    codigo: string | null
    descricao: string | null
    codigosAcabado: string[]
    clienteNome: string | null
    semProdutoCadastrado: boolean
  }
  arte: { fonte: 'PRODUTO' | 'CALCULO' | 'NENHUMA'; imagemUrl: string | null }
  fichaTecnica: {
    temFicha: boolean
    atributoGrafico: FichaAtributos | null
    engenhariaCalculo: FichaEngenharia | null
  }
  historicoOps: Array<{
    id: string; numero: number; referenciaExterna: string | null
    status: string; quantidade: number | null; criadoEm: string
  }>
  calculos: Array<{
    id: string; numero: number; numeroCalcgraf: number | null
    siglaAcabado: string | null; descricao: string | null
    custoProducao: number | null; criadoEm: string
    itensOrcamento: Array<{ id: string; orcamentoNumero: number | null; precoVenda: number | null }>
  }>
}

interface ProdutoLista {
  id: string; codigo: string; nome: string; status: boolean; temFicha: boolean; situacaoCadastro?: string
}

function brl(n: number | null) {
  if (n == null) return '—'
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function dataBR(s: string) {
  try { return new Date(s).toLocaleDateString('pt-BR') } catch { return s }
}

export default function CentralProdutoPage() {
  useEffect(() => { document.title = 'Central do Produto' }, [])

  const [termo, setTermo] = useState('')
  const [busca, setBusca] = useState<ResultadoBusca | null>(null)
  const [loadingBusca, setLoadingBusca] = useState(false)
  const [detalhe, setDetalhe] = useState<DetalheProduto | null>(null)
  const [loadingDetalhe, setLoadingDetalhe] = useState(false)
  const [podeEditar, setPodeEditar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [modalAberto, setModalAberto] = useState(false)
  // Ficha Master v2
  const [fichaMasterId, setFichaMasterId] = useState<string | null>(null)
  // Modo "Todos os produtos" (carga inicial / localização)
  const [lista, setLista] = useState<{ itens: ProdutoLista[]; total: number; page: number; pageSize: number } | null>(null)
  const [loadingLista, setLoadingLista] = useState(false)

  useEffect(() => {
    api.get('/comercial/central-produto/permissao')
      .then(({ data }) => setPodeEditar(!!data?.podeEditar))
      .catch(() => setPodeEditar(false))
  }, [])

  const carregarDetalhe = useCallback(async (g: GrupoResultado) => {
    setLoadingDetalhe(true)
    setErro(null)
    try {
      const params = g.produtoId ? { produtoId: g.produtoId } : { calculoId: g.calculoId }
      const { data } = await api.get('/comercial/central-produto/detalhe', { params })
      setDetalhe(data)
    } catch {
      setErro('Não foi possível carregar o detalhe.')
      setDetalhe(null)
    } finally {
      setLoadingDetalhe(false)
    }
  }, [])

  const pesquisar = useCallback(async () => {
    const t = termo.trim()
    if (t.length < 2) {
      setErro('Informe ao menos 2 caracteres para pesquisar.')
      return
    }
    setLoadingBusca(true)
    setErro(null)
    setDetalhe(null)
    try {
      const { data } = await api.get<ResultadoBusca>('/comercial/central-produto/busca', {
        params: { termo: t },
      })
      setBusca(data)
      if (data.detalheDireto && data.resultados[0]) {
        await carregarDetalhe(data.resultados[0])
      }
    } catch (e) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message
      setErro(msg || 'Erro na busca.')
      setBusca(null)
    } finally {
      setLoadingBusca(false)
    }
  }, [termo, carregarDetalhe])

  const carregarLista = useCallback(async (page = 1) => {
    setLoadingLista(true)
    setErro(null)
    setBusca(null)
    setDetalhe(null)
    try {
      const { data } = await api.get('/comercial/central-produto/produtos', {
        params: { status: 'TODOS', page, pageSize: 20, texto: termo.trim() || undefined },
      })
      setLista(data)
    } catch {
      setErro('Não foi possível carregar a lista de produtos.')
    } finally {
      setLoadingLista(false)
    }
  }, [termo])

  const abrirFichaMaster = useCallback(async (produtoId: string) => {
    setFichaMasterId(produtoId)
  }, [])

  return (
    <Stack gap="md" p="md">
      <Title order={2}>Central do Produto / Acabado</Title>
      <Text size="sm" c="dimmed">
        Pesquise pelo código do acabado (ex.: 4294) ou pelo nome do produto para ver
        arte, ficha técnica, OPs já abertas e cálculos — e editar o cadastro.
      </Text>

      <Group>
        <TextInput
          flex={1}
          placeholder="Código do acabado ou nome do produto"
          leftSection={<IconSearch size={16} />}
          value={termo}
          onChange={(e) => setTermo(e.currentTarget.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') pesquisar() }}
        />
        <Button onClick={pesquisar} loading={loadingBusca}>Pesquisar</Button>
        <Button variant="light" leftSection={<IconLayoutList size={16} />} onClick={() => carregarLista(1)} loading={loadingLista}>
          Todos os produtos
        </Button>
      </Group>

      {erro && <Alert color="red" icon={<IconInfoCircle size={16} />}>{erro}</Alert>}

      {/* Modo "Todos os produtos" (carga inicial / localização) */}
      {lista && (
        <Paper withBorder p="md">
          <Group justify="space-between" mb="xs">
            <Text fw={600}>Produtos ({lista.total})</Text>
            <Group gap={4}>
              <Button size="xs" variant="subtle" disabled={lista.page <= 1}
                onClick={() => carregarLista(lista.page - 1)}>Anterior</Button>
              <Text size="sm">Página {lista.page}</Text>
              <Button size="xs" variant="subtle" disabled={lista.page * lista.pageSize >= lista.total}
                onClick={() => carregarLista(lista.page + 1)}>Próxima</Button>
            </Group>
          </Group>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Código</Table.Th><Table.Th>Nome</Table.Th>
                <Table.Th>Status</Table.Th><Table.Th>Cadastro</Table.Th><Table.Th>Ficha</Table.Th><Table.Th /></Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {lista.itens.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td>{p.codigo}</Table.Td>
                  <Table.Td>{p.nome}</Table.Td>
                  <Table.Td><Badge color={p.status ? 'green' : 'gray'} variant="light">{p.status ? 'Ativo' : 'Inativo'}</Badge></Table.Td>
                  <Table.Td>
                    {p.situacaoCadastro === 'PROVISORIO'
                      ? <Badge color="orange" variant="light">Provisório</Badge>
                      : <Badge color="blue" variant="light">Definitivo</Badge>}
                  </Table.Td>
                  <Table.Td>{p.temFicha ? <Badge color="teal" variant="light">sim</Badge> : <Text size="xs" c="dimmed">—</Text>}</Table.Td>
                  <Table.Td>
                    <Button size="xs" variant="light" leftSection={<IconFileDescription size={14} />}
                      onClick={() => abrirFichaMaster(p.id)}>Ficha Master</Button>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}

      {busca?.limiteAplicado && (
        <Alert color="yellow" icon={<IconInfoCircle size={16} />}>
          Muitos resultados — refine o termo (mostrando os primeiros 100).
        </Alert>
      )}

      {busca?.semResultado && (
        <Paper withBorder p="lg">
          <Text c="dimmed">
            Nenhum resultado para <b>{busca.termoBusca}</b>.
          </Text>
        </Paper>
      )}

      {/* Lista de resultados quando há mais de um */}
      {busca && !busca.semResultado && !busca.detalheDireto && (
        <Paper withBorder p="md">
          <Text fw={600} mb="xs">Resultados ({busca.resultados.length})</Text>
          <Stack gap={4}>
            {busca.resultados.map((g) => (
              <Group
                key={g.chave}
                justify="space-between"
                p="xs"
                style={{ cursor: 'pointer', borderRadius: 6 }}
                onClick={() => carregarDetalhe(g)}
                className="hover-row"
              >
                <div>
                  <Text fw={500}>{g.descricao || g.codigo || '(sem descrição)'}</Text>
                  <Group gap={6}>
                    {g.codigo && <Badge variant="light">{g.codigo}</Badge>}
                    {g.codigosAcabado.map((c) => (
                      <Badge key={c} variant="outline" color="grape">{c}</Badge>
                    ))}
                    {g.semProdutoCadastrado && <Badge color="orange" variant="light">sem produto</Badge>}
                  </Group>
                </div>
                <Button size="xs" variant="subtle">Abrir</Button>
              </Group>
            ))}
          </Stack>
        </Paper>
      )}

      {loadingDetalhe && <Center p="xl"><Loader /></Center>}

      {detalhe && !loadingDetalhe && (
        <DetalheView
          detalhe={detalhe}
          podeEditar={podeEditar}
          onEditar={() => setModalAberto(true)}
          onFichaMaster={detalhe.identificacao.produtoId ? () => abrirFichaMaster(detalhe.identificacao.produtoId!) : undefined}
        />
      )}

      {detalhe?.identificacao.produtoId && (
        <EditarCadastroModal
          opened={modalAberto}
          onClose={() => setModalAberto(false)}
          produtoId={detalhe.identificacao.produtoId}
          detalheAtual={detalhe}
          onSalvo={(novo) => { setDetalhe(novo); setModalAberto(false) }}
        />
      )}

      {fichaMasterId && (
        <FichaMasterModal
          opened={!!fichaMasterId}
          onClose={() => setFichaMasterId(null)}
          produtoId={fichaMasterId}
          podeEditar={podeEditar}
          onProdutoAlterado={() => { if (lista) carregarLista(lista.page) }}
        />
      )}
    </Stack>
  )
}

function DetalheView({
  detalhe, podeEditar, onEditar, onFichaMaster,
}: { detalhe: DetalheProduto; podeEditar: boolean; onEditar: () => void; onFichaMaster?: () => void }) {
  const id = detalhe.identificacao
  const ficha = detalhe.fichaTecnica
  return (
    <Stack gap="md">
      {/* Identificação + Arte */}
      <Paper withBorder p="md">
        <Group justify="space-between" align="flex-start">
          <Group align="flex-start" gap="lg">
            <div style={{ width: 160 }}>
              {detalhe.arte.fonte !== 'NENHUMA' && detalhe.arte.imagemUrl ? (
                <Image src={detalhe.arte.imagemUrl} alt="Arte" radius="sm" fit="contain" h={160} />
              ) : (
                <Center h={160} style={{ border: '1px dashed var(--mantine-color-default-border)', borderRadius: 8 }}>
                  <Stack align="center" gap={4}>
                    <IconPhotoOff size={28} opacity={0.5} />
                    <Text size="xs" c="dimmed">sem arte cadastrada</Text>
                  </Stack>
                </Center>
              )}
            </div>
            <div>
              <Title order={3}>{id.descricao || '(sem descrição)'}</Title>
              <Group gap={6} mt={6}>
                {id.codigo && <Badge variant="light">Código: {id.codigo}</Badge>}
                {id.codigosAcabado.map((c) => (
                  <Badge key={c} variant="outline" color="grape">Acabado {c}</Badge>
                ))}
                {id.semProdutoCadastrado && <Badge color="orange" variant="light">sem produto cadastrado</Badge>}
              </Group>
              {id.clienteNome && <Text size="sm" mt={6} c="dimmed">Cliente: {id.clienteNome}</Text>}
            </div>
          </Group>
          <Group gap="xs">
            {id.produtoId && onFichaMaster && (
              <Button leftSection={<IconFileDescription size={16} />} variant="light" color="teal" onClick={onFichaMaster}>
                Ficha Master
              </Button>
            )}
            {podeEditar && id.produtoId && (
              <Button leftSection={<IconEdit size={16} />} variant="light" onClick={onEditar}>
                Editar cadastro
              </Button>
            )}
          </Group>
        </Group>
      </Paper>

      {/* Ficha técnica */}
      <Paper withBorder p="md">
        <Text fw={600} mb="xs">Ficha técnica</Text>
        {!ficha.temFicha ? (
          <Text c="dimmed" size="sm">Ficha técnica não cadastrada.</Text>
        ) : (
          <SimpleGrid cols={{ base: 2, sm: 3 }} spacing="xs">
            {ficha.atributoGrafico && (
              <>
                <FichaItem rotulo="Cartão" valor={ficha.atributoGrafico.tipoCartaoNome} />
                <FichaItem rotulo="Formato" valor={ficha.atributoGrafico.tipoFormatoNome} />
                <FichaItem rotulo="Gramatura" valor={ficha.atributoGrafico.tipoGramaturaNome} />
                <FichaItem rotulo="Policromia" valor={ficha.atributoGrafico.tipoPolicromiaNome} />
                <FichaItem rotulo="Verniz" valor={ficha.atributoGrafico.tipoVernizNome} />
                <FichaItem rotulo="Cores" valor={ficha.atributoGrafico.tipoCoresNomes.join(', ') || null} />
              </>
            )}
            {ficha.engenhariaCalculo && (
              <>
                <FichaItem rotulo="Aproveitamento" valor={ficha.engenhariaCalculo.aproveitamento?.toString() ?? null} />
                <FichaItem rotulo="Nº cores" valor={ficha.engenhariaCalculo.numCores?.toString() ?? null} />
                <FichaItem
                  rotulo="Formato de corte"
                  valor={
                    ficha.engenhariaCalculo.formatoCorteLarguraMm && ficha.engenhariaCalculo.formatoCorteAlturaMm
                      ? `${ficha.engenhariaCalculo.formatoCorteLarguraMm} × ${ficha.engenhariaCalculo.formatoCorteAlturaMm} mm`
                      : null
                  }
                />
                <FichaItem rotulo="Gramatura (cálc.)" valor={ficha.engenhariaCalculo.gramatura?.toString() ?? null} />
              </>
            )}
          </SimpleGrid>
        )}
      </Paper>

      {/* Histórico de OPs */}
      <Paper withBorder p="md">
        <Text fw={600} mb="xs">Ordens de Produção ({detalhe.historicoOps.length})</Text>
        {detalhe.historicoOps.length === 0 ? (
          <Text c="dimmed" size="sm">Nenhuma OP registrada.</Text>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>OP</Table.Th>
                <Table.Th>Referência</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Qtd</Table.Th>
                <Table.Th>Criada</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {detalhe.historicoOps.map((op) => (
                <Table.Tr key={op.id}>
                  <Table.Td>{op.numero}</Table.Td>
                  <Table.Td>{op.referenciaExterna || '—'}</Table.Td>
                  <Table.Td><Badge variant="light">{op.status}</Badge></Table.Td>
                  <Table.Td>{op.quantidade ?? '—'}</Table.Td>
                  <Table.Td>{dataBR(op.criadoEm)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      {/* Cálculos / Orçamentos */}
      <Paper withBorder p="md">
        <Text fw={600} mb="xs">Cálculos e orçamentos ({detalhe.calculos.length})</Text>
        {detalhe.calculos.length === 0 ? (
          <Text c="dimmed" size="sm">Sem cálculos registrados.</Text>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Cálculo</Table.Th>
                <Table.Th>Acabado</Table.Th>
                <Table.Th>Descrição</Table.Th>
                <Table.Th>Custo prod.</Table.Th>
                <Table.Th>Orçamentos</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {detalhe.calculos.map((c) => (
                <Table.Tr key={c.id}>
                  <Table.Td>{c.numeroCalcgraf ?? c.numero}</Table.Td>
                  <Table.Td>{c.siglaAcabado || '—'}</Table.Td>
                  <Table.Td>{c.descricao || '—'}</Table.Td>
                  <Table.Td>{brl(c.custoProducao)}</Table.Td>
                  <Table.Td>
                    {c.itensOrcamento.length === 0
                      ? '—'
                      : c.itensOrcamento.map((i) => `#${i.orcamentoNumero ?? '?'} (${brl(i.precoVenda)})`).join(', ')}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </Stack>
  )
}

function FichaItem({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  return (
    <Card withBorder padding="xs" radius="sm">
      <Text size="xs" c="dimmed">{rotulo}</Text>
      <Text size="sm" fw={500}>{valor || '—'}</Text>
    </Card>
  )
}
