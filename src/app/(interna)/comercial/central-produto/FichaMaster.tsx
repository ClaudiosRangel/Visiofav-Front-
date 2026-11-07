'use client'

/**
 * Ficha Master (Central do Produto v2) — Item Master versionado.
 * Seções: ficha gráfica editável, matriz (derivada das OPs + manual), imagem da
 * faca, arte versionada (galeria da aprovada + criar/aprovar/reprovar),
 * dimensões, totalizadores de venda, e ações de produto (inativar/excluir).
 * Consome /comercial/central-produto/ficha-master/* e /produtos/:id.
 */
import { useEffect, useState, useCallback } from 'react'
import {
  Modal, Stack, Group, Text, Title, Loader, Center, Paper, Badge, TextInput,
  NumberInput, Textarea, Button, Image, Table, Alert, SimpleGrid, Card,
  Select, FileButton, ActionIcon, Tooltip, Divider,
} from '@mantine/core'
import {
  IconInfoCircle, IconPhotoOff, IconTrash, IconPlus, IconUpload,
  IconCheck, IconX, IconPower,
} from '@tabler/icons-react'
import { api } from '@/lib/api'

type EstadoArte = 'RASCUNHO' | 'EM_APROVACAO' | 'APROVADA' | 'REPROVADA' | 'OBSOLETA'

interface FichaGrafica {
  cartao: string | null; gramatura: string | null; numCores: number | null
  coresDescricao: string | null; acabamentos: string | null; matrizManual: string | null
  imagemFaca: string | null; modeloFacaId: string | null; modeloFacaCodigo: string | null
  observacoes: string | null
}
interface ArteResumo {
  id: string; numero: number; estado: EstadoArte; descricao: string | null
  qtdImagens: number; aprovadaEm: string | null; comentario: string | null
}
interface Dimensao {
  id: string; tipo: string; larguraMm: number | null; alturaMm: number | null
  profundidadeMm: number | null; observacao: string | null
}
interface FichaMasterData {
  produtoId: string; codigo: string; nome: string; descricao: string | null
  status: boolean; situacaoCadastro?: string; clienteNome: string | null
  ficha: FichaGrafica | null
  matrizDerivada: string | null; matrizExibida: string | null
  artes: ArteResumo[]; arteAprovadaId: string | null
  dimensoes: Dimensao[]
  estruturaAtiva: { id: string; versao: number; status: string } | null
  podeExcluir: boolean; motivoBloqueioExclusao: string | null
}
interface Totais {
  quantidadeTotal: number; valorTotal: number; periodoMeses: number
  topClientes: Array<{ clienteNome: string; quantidade: number; valor: number }>
  temVendas: boolean
}

function brl(n: number) {
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
const ESTADO_COR: Record<EstadoArte, string> = {
  RASCUNHO: 'gray', EM_APROVACAO: 'blue', APROVADA: 'green', REPROVADA: 'red', OBSOLETA: 'dark',
}

async function arquivoParaDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = reject
    r.readAsDataURL(file)
  })
}

export function FichaMasterModal({
  opened, onClose, produtoId, podeEditar, onProdutoAlterado,
}: {
  opened: boolean; onClose: () => void; produtoId: string
  podeEditar: boolean; onProdutoAlterado?: () => void
}) {
  const [data, setData] = useState<FichaMasterData | null>(null)
  const [loading, setLoading] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [totais, setTotais] = useState<Totais | null>(null)
  const [imgAmpliada, setImgAmpliada] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true); setErro(null)
    try {
      const { data: d } = await api.get(`/comercial/central-produto/ficha-master/${produtoId}`)
      setData(d)
      const { data: t } = await api.get(`/comercial/central-produto/ficha-master/${produtoId}/vendas`)
      setTotais(t)
    } catch {
      setErro('Não foi possível carregar a Ficha Master.')
    } finally {
      setLoading(false)
    }
  }, [produtoId])

  useEffect(() => { if (opened) carregar() }, [opened, carregar])

  return (
    <Modal opened={opened} onClose={onClose} size="90%" title="Ficha Master do Produto"
      styles={{ body: { paddingTop: 0 } }}>
      {loading && <Center p="xl"><Loader /></Center>}
      {erro && <Alert color="red" icon={<IconInfoCircle size={16} />}>{erro}</Alert>}
      {data && !loading && (
        <Stack gap="md" pb="md">
          <Group justify="space-between">
            <div>
              <Title order={4}>{data.descricao || data.nome}</Title>
              <Group gap={6} mt={4}>
                <Badge variant="light">Código: {data.codigo}</Badge>
                <Badge color={data.status ? 'green' : 'gray'} variant="light">
                  {data.status ? 'Ativo' : 'Inativo'}
                </Badge>
                {data.situacaoCadastro === 'PROVISORIO' && (
                  <Badge color="orange" variant="light">Provisório (aguarda aprovação da arte)</Badge>
                )}
                {data.clienteNome && <Badge variant="outline">{data.clienteNome}</Badge>}
                {data.estruturaAtiva && (
                  <Badge color="teal" variant="light">Estrutura v{data.estruturaAtiva.versao}</Badge>
                )}
              </Group>
            </div>
            {podeEditar && (
              <AcoesProduto
                data={data}
                onAlterado={() => { carregar(); onProdutoAlterado?.() }}
                onExcluido={() => { onClose(); onProdutoAlterado?.() }}
              />
            )}
          </Group>

          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <FichaGraficaCard
              produtoId={produtoId} ficha={data.ficha} matriz={data}
              podeEditar={podeEditar} onSalvo={carregar} onAmpliar={setImgAmpliada}
            />
            <ArteCard
              produtoId={produtoId} artes={data.artes} arteAprovadaId={data.arteAprovadaId}
              podeEditar={podeEditar} onMudou={carregar} onAmpliar={setImgAmpliada}
            />
          </SimpleGrid>

          <DimensoesCard
            produtoId={produtoId} dimensoes={data.dimensoes}
            podeEditar={podeEditar} onMudou={carregar}
          />

          <VendasCard totais={totais} />
        </Stack>
      )}

      <Modal opened={!!imgAmpliada} onClose={() => setImgAmpliada(null)} size="xl" withCloseButton>
        {imgAmpliada && <Image src={imgAmpliada} alt="Imagem" fit="contain" />}
      </Modal>
    </Modal>
  )
}

// ── Ficha gráfica + matriz + imagem da faca ──────────────────────────────────
function FichaGraficaCard({
  produtoId, ficha, matriz, podeEditar, onSalvo, onAmpliar,
}: {
  produtoId: string; ficha: FichaGrafica | null; matriz: FichaMasterData
  podeEditar: boolean; onSalvo: () => void; onAmpliar: (s: string) => void
}) {
  const [form, setForm] = useState<FichaGrafica>(ficha ?? {
    cartao: null, gramatura: null, numCores: null, coresDescricao: null,
    acabamentos: null, matrizManual: null, imagemFaca: null, modeloFacaId: null,
    modeloFacaCodigo: null, observacoes: null,
  })
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (ficha) setForm(ficha)
  }, [ficha])

  const salvar = async () => {
    setSalvando(true)
    try {
      await api.put(`/comercial/central-produto/ficha-master/${produtoId}/ficha`, {
        cartao: form.cartao, gramatura: form.gramatura, numCores: form.numCores,
        coresDescricao: form.coresDescricao, acabamentos: form.acabamentos,
        matrizManual: form.matrizManual, imagemFaca: form.imagemFaca,
        modeloFacaId: form.modeloFacaId, observacoes: form.observacoes,
      })
      onSalvo()
    } finally {
      setSalvando(false)
    }
  }

  const setImagemFaca = async (file: File | null) => {
    if (!file) { setForm({ ...form, imagemFaca: null }); return }
    const url = await arquivoParaDataUrl(file)
    setForm({ ...form, imagemFaca: url })
  }

  return (
    <Paper withBorder p="md">
      <Text fw={600} mb="xs">Ficha gráfica</Text>
      <Stack gap="xs">
        <Group grow>
          <TextInput label="Cartão" value={form.cartao ?? ''} readOnly={!podeEditar}
            onChange={(e) => setForm({ ...form, cartao: e.currentTarget.value || null })} />
          <TextInput label="Gramatura" value={form.gramatura ?? ''} readOnly={!podeEditar}
            onChange={(e) => setForm({ ...form, gramatura: e.currentTarget.value || null })} />
        </Group>
        <Group grow>
          <NumberInput label="Nº de cores" value={form.numCores ?? undefined} readOnly={!podeEditar} min={0} max={20}
            onChange={(v) => setForm({ ...form, numCores: typeof v === 'number' ? v : null })} />
          <TextInput label="Cores (descrição)" value={form.coresDescricao ?? ''} readOnly={!podeEditar}
            onChange={(e) => setForm({ ...form, coresDescricao: e.currentTarget.value || null })} />
        </Group>
        <Textarea label="Acabamentos" autosize minRows={2} value={form.acabamentos ?? ''} readOnly={!podeEditar}
          onChange={(e) => setForm({ ...form, acabamentos: e.currentTarget.value || null })} />

        <Divider label="Matriz / Faca" labelPosition="left" />
        {matriz.matrizDerivada && (
          <Alert color="gray" variant="light" icon={<IconInfoCircle size={16} />} p="xs">
            Matriz das OPs: <b>{matriz.matrizDerivada}</b>
            {podeEditar && ' (o campo abaixo sobrepõe quando preenchido)'}
          </Alert>
        )}
        <TextInput label="Matriz (manual)" value={form.matrizManual ?? ''} readOnly={!podeEditar}
          placeholder={matriz.matrizDerivada ?? 'ex.: 2529B'}
          onChange={(e) => setForm({ ...form, matrizManual: e.currentTarget.value || null })} />

        <Group align="flex-end" gap="sm">
          {form.imagemFaca ? (
            <Image src={form.imagemFaca} alt="Faca" h={80} w={80} fit="contain" radius="sm"
              style={{ cursor: 'zoom-in', border: '1px solid var(--mantine-color-default-border)' }}
              onClick={() => onAmpliar(form.imagemFaca!)} />
          ) : (
            <Center h={80} w={80} style={{ border: '1px dashed var(--mantine-color-default-border)', borderRadius: 8 }}>
              <IconPhotoOff size={22} opacity={0.5} />
            </Center>
          )}
          {podeEditar && (
            <Group gap={6}>
              <FileButton accept="image/*" onChange={setImagemFaca}>
                {(props) => <Button {...props} size="xs" variant="light" leftSection={<IconUpload size={14} />}>
                  {form.imagemFaca ? 'Trocar faca' : 'Imagem da faca'}
                </Button>}
              </FileButton>
              {form.imagemFaca && (
                <Button size="xs" variant="subtle" color="red" onClick={() => setImagemFaca(null)}>Remover</Button>
              )}
            </Group>
          )}
        </Group>

        <Textarea label="Observações técnicas" autosize minRows={2} value={form.observacoes ?? ''} readOnly={!podeEditar}
          onChange={(e) => setForm({ ...form, observacoes: e.currentTarget.value || null })} />

        {podeEditar && (
          <Group justify="flex-end">
            <Button size="xs" onClick={salvar} loading={salvando}>Salvar ficha</Button>
          </Group>
        )}
      </Stack>
    </Paper>
  )
}

// ── Arte versionada ──────────────────────────────────────────────────────────
function ArteCard({
  produtoId, artes, arteAprovadaId, podeEditar, onMudou, onAmpliar,
}: {
  produtoId: string; artes: ArteResumo[]; arteAprovadaId: string | null
  podeEditar: boolean; onMudou: () => void; onAmpliar: (s: string) => void
}) {
  const [imgsAprovada, setImgsAprovada] = useState<string[]>([])
  const [novaImgs, setNovaImgs] = useState<string[]>([])
  const [descricao, setDescricao] = useState('')
  const [criando, setCriando] = useState(false)
  const [erroCriar, setErroCriar] = useState<string | null>(null)

  useEffect(() => {
    if (arteAprovadaId) {
      api.get(`/comercial/central-produto/artes/${arteAprovadaId}`)
        .then(({ data }) => setImgsAprovada(data.imagens ?? []))
        .catch(() => setImgsAprovada([]))
    } else {
      setImgsAprovada([])
    }
  }, [arteAprovadaId])

  const addImagens = async (files: File[]) => {
    const restantes = 4 - novaImgs.length
    const url = await Promise.all(files.slice(0, restantes).map(arquivoParaDataUrl))
    setNovaImgs((prev) => [...prev, ...url].slice(0, 4))
  }

  const criar = async () => {
    setErroCriar(null)
    if (novaImgs.length < 1) { setErroCriar('Inclua ao menos 1 imagem.'); return }
    setCriando(true)
    try {
      await api.post(`/comercial/central-produto/ficha-master/${produtoId}/artes`, {
        imagens: novaImgs, descricao: descricao || null,
      })
      setNovaImgs([]); setDescricao('')
      onMudou()
    } catch (e) {
      setErroCriar((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao criar revisão.')
    } finally {
      setCriando(false)
    }
  }

  const transicionar = async (revisaoId: string, novoEstado: EstadoArte) => {
    await api.patch(`/comercial/central-produto/artes/${revisaoId}/estado`, { novoEstado })
    onMudou()
  }

  return (
    <Paper withBorder p="md">
      <Text fw={600} mb="xs">Arte (versionada)</Text>

      {/* Galeria da aprovada vigente */}
      {imgsAprovada.length > 0 ? (
        <Group gap="xs" mb="sm">
          {imgsAprovada.map((img, i) => (
            <Image key={i} src={img} alt={`Arte aprovada ${i + 1}`} h={90} w={90} fit="contain" radius="sm"
              style={{ cursor: 'zoom-in', border: '2px solid var(--mantine-color-green-6)' }}
              onClick={() => onAmpliar(img)} />
          ))}
          <Badge color="green" variant="light">Aprovada vigente</Badge>
        </Group>
      ) : (
        <Text size="sm" c="dimmed" mb="sm">Nenhuma arte aprovada vigente.</Text>
      )}

      {/* Revisões */}
      {artes.length > 0 && (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Rev.</Table.Th><Table.Th>Estado</Table.Th>
              <Table.Th>Imgs</Table.Th><Table.Th>Ações</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {artes.map((a) => (
              <Table.Tr key={a.id}>
                <Table.Td>#{a.numero}</Table.Td>
                <Table.Td><Badge color={ESTADO_COR[a.estado]} variant="light">{a.estado}</Badge></Table.Td>
                <Table.Td>{a.qtdImagens}</Table.Td>
                <Table.Td>
                  {podeEditar && (
                    <Group gap={4}>
                      {a.estado === 'RASCUNHO' && (
                        <Button size="xs" variant="light" onClick={() => transicionar(a.id, 'EM_APROVACAO')}>
                          Enviar p/ aprovação
                        </Button>
                      )}
                      {a.estado === 'EM_APROVACAO' && (
                        <>
                          <Tooltip label="Aprovar"><ActionIcon color="green" variant="light"
                            onClick={() => transicionar(a.id, 'APROVADA')}><IconCheck size={16} /></ActionIcon></Tooltip>
                          <Tooltip label="Reprovar"><ActionIcon color="red" variant="light"
                            onClick={() => transicionar(a.id, 'REPROVADA')}><IconX size={16} /></ActionIcon></Tooltip>
                        </>
                      )}
                      {a.estado === 'REPROVADA' && (
                        <Button size="xs" variant="subtle" onClick={() => transicionar(a.id, 'RASCUNHO')}>Retomar</Button>
                      )}
                    </Group>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}

      {/* Criar revisão */}
      {podeEditar && (
        <Stack gap="xs" mt="sm">
          <Divider label="Nova revisão" labelPosition="left" />
          <Group gap="xs">
            {novaImgs.map((img, i) => (
              <div key={i} style={{ position: 'relative' }}>
                <Image src={img} alt={`nova ${i}`} h={60} w={60} fit="contain" radius="sm"
                  style={{ border: '1px solid var(--mantine-color-default-border)' }} />
                <ActionIcon size="xs" color="red" variant="filled" style={{ position: 'absolute', top: -6, right: -6 }}
                  onClick={() => setNovaImgs(novaImgs.filter((_, j) => j !== i))}><IconX size={12} /></ActionIcon>
              </div>
            ))}
            {novaImgs.length < 4 && (
              <FileButton accept="image/*" multiple onChange={addImagens}>
                {(props) => <Button {...props} size="xs" variant="light" leftSection={<IconPlus size={14} />}>
                  Imagem ({novaImgs.length}/4)
                </Button>}
              </FileButton>
            )}
          </Group>
          <TextInput placeholder="Descrição (opcional)" size="xs" value={descricao}
            onChange={(e) => setDescricao(e.currentTarget.value)} />
          {erroCriar && <Text size="xs" c="red">{erroCriar}</Text>}
          <Group justify="flex-end">
            <Button size="xs" onClick={criar} loading={criando} disabled={novaImgs.length < 1}>
              Criar revisão
            </Button>
          </Group>
        </Stack>
      )}
    </Paper>
  )
}

// ── Dimensões ────────────────────────────────────────────────────────────────
const TIPOS_DIM = [
  { value: 'PRODUTO_FINAL', label: 'Produto final' },
  { value: 'PLANIFICADO', label: 'Planificado' },
  { value: 'FOLHA', label: 'Folha' },
]
function DimensoesCard({
  produtoId, dimensoes, podeEditar, onMudou,
}: {
  produtoId: string; dimensoes: Dimensao[]; podeEditar: boolean; onMudou: () => void
}) {
  const [tipo, setTipo] = useState<string | null>('PRODUTO_FINAL')
  const [larg, setLarg] = useState<number | ''>('')
  const [alt, setAlt] = useState<number | ''>('')
  const [prof, setProf] = useState<number | ''>('')
  const [salvando, setSalvando] = useState(false)

  const add = async () => {
    if (!tipo) return
    setSalvando(true)
    try {
      await api.post(`/comercial/central-produto/ficha-master/${produtoId}/dimensoes`, {
        tipo, larguraMm: larg === '' ? null : larg, alturaMm: alt === '' ? null : alt,
        profundidadeMm: prof === '' ? null : prof,
      })
      setLarg(''); setAlt(''); setProf('')
      onMudou()
    } finally {
      setSalvando(false)
    }
  }
  const remover = async (id: string) => {
    await api.delete(`/comercial/central-produto/ficha-master/${produtoId}/dimensoes/${id}`)
    onMudou()
  }

  return (
    <Paper withBorder p="md">
      <Text fw={600} mb="xs">Dimensões</Text>
      {dimensoes.length === 0 ? (
        <Text size="sm" c="dimmed">Nenhuma dimensão cadastrada.</Text>
      ) : (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Tipo</Table.Th><Table.Th>Larg (mm)</Table.Th>
              <Table.Th>Alt (mm)</Table.Th><Table.Th>Prof (mm)</Table.Th><Table.Th /></Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {dimensoes.map((d) => (
              <Table.Tr key={d.id}>
                <Table.Td>{TIPOS_DIM.find((t) => t.value === d.tipo)?.label ?? d.tipo}</Table.Td>
                <Table.Td>{d.larguraMm ?? '—'}</Table.Td>
                <Table.Td>{d.alturaMm ?? '—'}</Table.Td>
                <Table.Td>{d.profundidadeMm ?? '—'}</Table.Td>
                <Table.Td>
                  {podeEditar && (
                    <ActionIcon color="red" variant="subtle" onClick={() => remover(d.id)}>
                      <IconTrash size={16} />
                    </ActionIcon>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      )}
      {podeEditar && (
        <Group mt="sm" align="flex-end" gap="xs">
          <Select label="Tipo" data={TIPOS_DIM} value={tipo} onChange={setTipo} w={150} />
          <NumberInput label="Largura" value={larg} onChange={(v) => setLarg(typeof v === 'number' ? v : '')} w={100} />
          <NumberInput label="Altura" value={alt} onChange={(v) => setAlt(typeof v === 'number' ? v : '')} w={100} />
          <NumberInput label="Profund." value={prof} onChange={(v) => setProf(typeof v === 'number' ? v : '')} w={100} />
          <Button size="sm" onClick={add} loading={salvando} leftSection={<IconPlus size={14} />}>Adicionar</Button>
        </Group>
      )}
    </Paper>
  )
}

// ── Vendas ───────────────────────────────────────────────────────────────────
function VendasCard({ totais }: { totais: Totais | null }) {
  return (
    <Paper withBorder p="md">
      <Text fw={600} mb="xs">Vendas {totais ? `(últimos ${totais.periodoMeses} meses)` : ''}</Text>
      {!totais || !totais.temVendas ? (
        <Text size="sm" c="dimmed">Sem vendas registradas.</Text>
      ) : (
        <Stack gap="xs">
          <SimpleGrid cols={{ base: 1, sm: 2 }}>
            <Card withBorder padding="xs"><Text size="xs" c="dimmed">Quantidade total</Text>
              <Text fw={600}>{totais.quantidadeTotal.toLocaleString('pt-BR')}</Text></Card>
            <Card withBorder padding="xs"><Text size="xs" c="dimmed">Valor total</Text>
              <Text fw={600}>{brl(totais.valorTotal)}</Text></Card>
          </SimpleGrid>
          {totais.topClientes.length > 0 && (
            <Table>
              <Table.Thead><Table.Tr>
                <Table.Th>Cliente</Table.Th><Table.Th>Qtd</Table.Th><Table.Th>Valor</Table.Th>
              </Table.Tr></Table.Thead>
              <Table.Tbody>
                {totais.topClientes.map((c, i) => (
                  <Table.Tr key={i}>
                    <Table.Td>{c.clienteNome}</Table.Td>
                    <Table.Td>{c.quantidade.toLocaleString('pt-BR')}</Table.Td>
                    <Table.Td>{brl(c.valor)}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Stack>
      )}
    </Paper>
  )
}

// ── Ações do produto (inativar / excluir) ────────────────────────────────────
function AcoesProduto({
  data, onAlterado, onExcluido,
}: { data: FichaMasterData; onAlterado: () => void; onExcluido: () => void }) {
  const [busy, setBusy] = useState(false)

  const alternarStatus = async () => {
    setBusy(true)
    try {
      await api.patch(`/comercial/central-produto/produtos/${data.produtoId}/status`, { ativo: !data.status })
      onAlterado()
    } finally {
      setBusy(false)
    }
  }
  const excluir = async () => {
    if (!confirm('Excluir este produto definitivamente? Esta ação é irreversível.')) return
    setBusy(true)
    try {
      await api.delete(`/comercial/central-produto/produtos/${data.produtoId}`)
      onExcluido()
    } catch (e) {
      alert((e as { response?: { data?: { message?: string } } })?.response?.data?.message || 'Erro ao excluir.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Group gap="xs">
      <Button size="xs" variant="light" color={data.status ? 'orange' : 'green'} loading={busy}
        leftSection={<IconPower size={14} />} onClick={alternarStatus}>
        {data.status ? 'Inativar' : 'Reativar'}
      </Button>
      <Tooltip label={data.podeExcluir ? 'Excluir produto' : (data.motivoBloqueioExclusao ?? 'Tem movimentação')}>
        <Button size="xs" variant="light" color="red" loading={busy} disabled={!data.podeExcluir}
          leftSection={<IconTrash size={14} />} onClick={excluir}>
          Excluir
        </Button>
      </Tooltip>
    </Group>
  )
}
