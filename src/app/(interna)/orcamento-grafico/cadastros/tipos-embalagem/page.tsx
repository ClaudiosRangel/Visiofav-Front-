'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Title, Stack, Table, Group, Button, Badge, Text, Loader, Center,
  Modal, TextInput, Textarea, NumberInput, ActionIcon, MultiSelect,
  JsonInput, Paper, SimpleGrid, Divider, ScrollArea, Alert,
} from '@mantine/core'
import { IconPlus, IconEdit, IconTrash, IconCalculator, IconAlertCircle } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

// ============================================================================
// Tipos
// ============================================================================

interface Parametro {
  nome: string
  label: string
  unidade: string
  obrigatorio: boolean
  default?: number
}

interface TipoEmbalagem {
  id: string
  codigo: string
  descricao: string
  formulaLargura: string
  formulaAltura: string
  parametros: Parametro[]
  processosObrigatorios: string[]
  abaColagemMm: number
  sangriaMm: number
  pincaMm: number
  imagemUrl?: string | null
  status: boolean
  criadoEm: string
  atualizadoEm: string
}

interface FormData {
  codigo: string
  descricao: string
  formulaLargura: string
  formulaAltura: string
  parametros: Parametro[]
  processosObrigatorios: string[]
  abaColagemMm: number
  sangriaMm: number
  pincaMm: number
  imagemUrl: string
}

const FORM_INICIAL: FormData = {
  codigo: '',
  descricao: '',
  formulaLargura: '',
  formulaAltura: '',
  parametros: [],
  processosObrigatorios: [],
  abaColagemMm: 15,
  sangriaMm: 3,
  pincaMm: 10,
  imagemUrl: '',
}

const PROCESSOS_DISPONIVEIS = [
  'IMPRESSAO',
  'CORTE_VINCO',
  'COLAGEM',
  'VERNIZ',
  'LAMINACAO',
  'HOT_STAMPING',
  'ACABAMENTO',
]

// ============================================================================
// Avaliador de fórmulas (mesmo algoritmo do backend — sem eval)
// ============================================================================

function avaliarFormula(formula: string, variaveis: Record<string, number>): number {
  if (!formula || formula.trim().length === 0) throw new Error('Fórmula vazia')

  // Normalizar variáveis para uppercase
  const vars: Record<string, number> = {}
  for (const [k, v] of Object.entries(variaveis)) vars[k.toUpperCase()] = v

  type TType = 'NUMBER' | 'VARIABLE' | 'OPERATOR' | 'LPAREN' | 'RPAREN'
  interface Tok { type: TType; value: string }

  const tokens: Tok[] = []
  let i = 0
  const expr = formula.trim()
  while (i < expr.length) {
    const ch = expr[i]
    if (ch === ' ' || ch === '\t') { i++; continue }
    if (ch >= '0' && ch <= '9') {
      let num = ''
      while (i < expr.length && ((expr[i] >= '0' && expr[i] <= '9') || expr[i] === '.')) { num += expr[i]; i++ }
      tokens.push({ type: 'NUMBER', value: num }); continue
    }
    if ((ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || ch === '_') {
      let name = ''
      while (i < expr.length && ((expr[i] >= 'a' && expr[i] <= 'z') || (expr[i] >= 'A' && expr[i] <= 'Z') || (expr[i] >= '0' && expr[i] <= '9') || expr[i] === '_')) { name += expr[i]; i++ }
      tokens.push({ type: 'VARIABLE', value: name }); continue
    }
    if ('+-*/'.includes(ch)) { tokens.push({ type: 'OPERATOR', value: ch }); i++; continue }
    if (ch === '(') { tokens.push({ type: 'LPAREN', value: '(' }); i++; continue }
    if (ch === ')') { tokens.push({ type: 'RPAREN', value: ')' }); i++; continue }
    throw new Error(`Caractere inválido: '${ch}'`)
  }

  let pos = 0
  function peek(): Tok | null { return pos < tokens.length ? tokens[pos] : null }
  function consume(): Tok { return tokens[pos++] }

  function parseExpr(): number {
    let left = parseTerm()
    while (peek()?.type === 'OPERATOR' && (peek()!.value === '+' || peek()!.value === '-')) {
      const op = consume().value; const right = parseTerm()
      left = op === '+' ? left + right : left - right
    }
    return left
  }

  function parseTerm(): number {
    let left = parseUnary()
    while (peek()?.type === 'OPERATOR' && (peek()!.value === '*' || peek()!.value === '/')) {
      const op = consume().value; const right = parseUnary()
      if (op === '*') left *= right
      else { if (right === 0) throw new Error('Divisão por zero'); left /= right }
    }
    return left
  }

  function parseUnary(): number {
    if (peek()?.type === 'OPERATOR' && peek()!.value === '-') { consume(); return -parsePrimary() }
    if (peek()?.type === 'OPERATOR' && peek()!.value === '+') { consume(); return parsePrimary() }
    return parsePrimary()
  }

  function parsePrimary(): number {
    const token = peek()
    if (!token) throw new Error('Fim inesperado')
    if (token.type === 'NUMBER') { consume(); return parseFloat(token.value) }
    if (token.type === 'VARIABLE') {
      consume()
      const vn = token.value.toUpperCase()
      if (!(vn in vars)) throw new Error(`Variável '${token.value}' não definida`)
      return vars[vn]
    }
    if (token.type === 'LPAREN') {
      consume()
      const result = parseExpr()
      if (!peek() || peek()!.type !== 'RPAREN') throw new Error('Parêntese não fechado')
      consume()
      return result
    }
    throw new Error(`Token inesperado: '${token.value}'`)
  }

  const result = parseExpr()
  if (pos < tokens.length) throw new Error(`Token extra: '${tokens[pos].value}'`)
  return result
}

// ============================================================================
// Componente de Preview de Fórmula
// ============================================================================

function FormulaPreview({ formulaLargura, formulaAltura, parametros }: {
  formulaLargura: string
  formulaAltura: string
  parametros: Parametro[]
}) {
  const [valores, setValores] = useState<Record<string, number>>({})
  const [resultLargura, setResultLargura] = useState<string>('')
  const [resultAltura, setResultAltura] = useState<string>('')
  const [erro, setErro] = useState<string>('')

  // Valores internos sempre disponíveis
  const variaveisCompletas = useCallback(() => {
    const v: Record<string, number> = { ...valores }
    // Variáveis fixas padrão (podem ser sobrescritas pelos parâmetros)
    if (!('ABA' in v)) v.ABA = 15
    if (!('SANGRIA' in v)) v.SANGRIA = 3
    if (!('PINCA' in v)) v.PINCA = 10
    return v
  }, [valores])

  function calcular() {
    setErro('')
    setResultLargura('')
    setResultAltura('')

    const vars = variaveisCompletas()

    try {
      if (formulaLargura.trim()) {
        const r = avaliarFormula(formulaLargura, vars)
        setResultLargura(`${r.toFixed(2)} mm`)
      }
    } catch (e: any) {
      setErro(`Largura: ${e.message}`)
      return
    }

    try {
      if (formulaAltura.trim()) {
        const r = avaliarFormula(formulaAltura, vars)
        setResultAltura(`${r.toFixed(2)} mm`)
      }
    } catch (e: any) {
      setErro(`Altura: ${e.message}`)
    }
  }

  return (
    <Paper withBorder p="sm" mt="xs" bg="gray.0">
      <Group gap={4} mb="xs">
        <IconCalculator size={16} />
        <Text size="sm" fw={600}>Preview da Fórmula</Text>
      </Group>

      {parametros.length === 0 && (
        <Text size="xs" c="dimmed">Cadastre parâmetros para testar as fórmulas</Text>
      )}

      <SimpleGrid cols={3} spacing="xs">
        {parametros.map((p) => (
          <NumberInput
            key={p.nome}
            label={`${p.label || p.nome} (${p.unidade || 'mm'})`}
            size="xs"
            value={valores[p.nome.toUpperCase()] ?? (p.default || 0)}
            onChange={(v) => setValores({ ...valores, [p.nome.toUpperCase()]: typeof v === 'number' ? v : 0 })}
            min={0}
            decimalScale={2}
          />
        ))}
      </SimpleGrid>

      <Button size="xs" mt="xs" variant="light" leftSection={<IconCalculator size={14} />} onClick={calcular}>
        Calcular
      </Button>

      {(resultLargura || resultAltura) && (
        <Group mt="xs" gap="lg">
          {resultLargura && <Text size="sm"><strong>Largura:</strong> {resultLargura}</Text>}
          {resultAltura && <Text size="sm"><strong>Altura:</strong> {resultAltura}</Text>}
        </Group>
      )}

      {erro && (
        <Alert color="red" variant="light" mt="xs" icon={<IconAlertCircle size={14} />} p="xs">
          <Text size="xs">{erro}</Text>
        </Alert>
      )}
    </Paper>
  )
}

// ============================================================================
// Página Principal
// ============================================================================

export default function TiposEmbalagemPage() {
  useEffect(() => { document.title = 'Orçamento Gráfico - Tipos de Embalagem' }, [])

  const [data, setData] = useState<TipoEmbalagem[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState<string>('true')
  const [modalAberto, setModalAberto] = useState(false)
  const [editando, setEditando] = useState<TipoEmbalagem | null>(null)
  const [form, setForm] = useState<FormData>(FORM_INICIAL)
  const [salvando, setSalvando] = useState(false)
  const [parametrosJson, setParametrosJson] = useState('[]')

  async function carregar() {
    setLoading(true)
    try {
      const res = await api.get('/orcamento-grafico/tipos-embalagem', {
        params: { page: 1, limit: 50, busca: busca || undefined, status: filtroStatus },
      })
      setData(res.data.data || [])
    } catch (err: any) {
      notifications.show({ title: 'Erro ao carregar', message: err?.response?.data?.message || 'Falha ao buscar tipos de embalagem', color: 'red' })
    } finally { setLoading(false) }
  }

  useEffect(() => { carregar() }, [busca, filtroStatus])

  function abrirNovo() {
    setEditando(null)
    setForm(FORM_INICIAL)
    setParametrosJson('[]')
    setModalAberto(true)
  }

  function abrirEdicao(item: TipoEmbalagem) {
    setEditando(item)
    setForm({
      codigo: item.codigo,
      descricao: item.descricao,
      formulaLargura: item.formulaLargura,
      formulaAltura: item.formulaAltura,
      parametros: item.parametros || [],
      processosObrigatorios: item.processosObrigatorios || [],
      abaColagemMm: Number(item.abaColagemMm) || 15,
      sangriaMm: Number(item.sangriaMm) || 3,
      pincaMm: Number(item.pincaMm) || 10,
      imagemUrl: item.imagemUrl || '',
    })
    setParametrosJson(JSON.stringify(item.parametros || [], null, 2))
    setModalAberto(true)
  }

  async function salvar() {
    // Validações básicas
    if (!form.codigo.trim()) { notifications.show({ title: 'Erro', message: 'Código obrigatório', color: 'red' }); return }
    if (!form.descricao.trim()) { notifications.show({ title: 'Erro', message: 'Descrição obrigatória', color: 'red' }); return }
    if (!form.formulaLargura.trim()) { notifications.show({ title: 'Erro', message: 'Fórmula de largura obrigatória', color: 'red' }); return }
    if (!form.formulaAltura.trim()) { notifications.show({ title: 'Erro', message: 'Fórmula de altura obrigatória', color: 'red' }); return }

    // Parse parâmetros do JSON
    let parametrosParsed: Parametro[]
    try {
      parametrosParsed = JSON.parse(parametrosJson)
      if (!Array.isArray(parametrosParsed)) throw new Error('Deve ser um array')
    } catch {
      notifications.show({ title: 'Erro', message: 'JSON de parâmetros inválido — deve ser um array', color: 'red' })
      return
    }

    setSalvando(true)
    try {
      const payload = {
        codigo: form.codigo.toUpperCase().trim(),
        descricao: form.descricao.trim(),
        formulaLargura: form.formulaLargura.trim(),
        formulaAltura: form.formulaAltura.trim(),
        parametros: parametrosParsed,
        processosObrigatorios: form.processosObrigatorios,
        abaColagemMm: form.abaColagemMm,
        sangriaMm: form.sangriaMm,
        pincaMm: form.pincaMm,
        imagemUrl: form.imagemUrl || undefined,
      }

      if (editando) {
        await api.put(`/orcamento-grafico/tipos-embalagem/${editando.id}`, payload)
      } else {
        await api.post('/orcamento-grafico/tipos-embalagem', payload)
      }
      notifications.show({ title: 'Salvo', message: `Tipo de embalagem ${editando ? 'atualizado' : 'criado'} com sucesso`, color: 'green' })
      setModalAberto(false)
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro ao salvar', message: err?.response?.data?.message || 'Falha ao salvar', color: 'red' })
    } finally { setSalvando(false) }
  }

  async function excluir(item: TipoEmbalagem) {
    if (!confirm(`Deseja inativar "${item.descricao}"?`)) return
    try {
      await api.delete(`/orcamento-grafico/tipos-embalagem/${item.id}`)
      notifications.show({ title: 'Inativado', message: `"${item.descricao}" foi inativado`, color: 'yellow' })
      carregar()
    } catch (err: any) {
      notifications.show({ title: 'Erro', message: err?.response?.data?.message || 'Falha ao inativar', color: 'red' })
    }
  }

  // Parse parâmetros para o preview
  let parametrosParsed: Parametro[] = []
  try { parametrosParsed = JSON.parse(parametrosJson) } catch {}

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Title order={3}>Tipos de Embalagem</Title>
          <Text size="sm" c="dimmed">
            Especialistas de cálculo — definem fórmulas de planificação para cada tipo de produto gráfico
          </Text>
        </div>
        <Button leftSection={<IconPlus size={16} />} onClick={abrirNovo}>Novo Tipo</Button>
      </Group>

      <Group>
        <TextInput
          placeholder="Buscar por código ou descrição..."
          value={busca}
          onChange={(e) => setBusca(e.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <Button
          variant={filtroStatus === 'true' ? 'filled' : 'light'}
          color={filtroStatus === 'true' ? 'blue' : 'gray'}
          size="sm"
          onClick={() => setFiltroStatus(filtroStatus === 'true' ? 'false' : 'true')}
        >
          {filtroStatus === 'true' ? 'Ativos' : 'Inativos'}
        </Button>
      </Group>

      {loading ? <Center py="xl"><Loader /></Center> : (
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Código</Table.Th>
                <Table.Th>Descrição</Table.Th>
                <Table.Th>Processos Obrigatórios</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {data.map((item) => (
                <Table.Tr key={item.id}>
                  <Table.Td fw={600}>{item.codigo}</Table.Td>
                  <Table.Td>{item.descricao}</Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      {(item.processosObrigatorios || []).map((p) => (
                        <Badge key={p} variant="light" size="xs">{p}</Badge>
                      ))}
                      {(!item.processosObrigatorios || item.processosObrigatorios.length === 0) && (
                        <Text size="xs" c="dimmed">—</Text>
                      )}
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Badge color={item.status ? 'green' : 'red'}>
                      {item.status ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <ActionIcon variant="subtle" onClick={() => abrirEdicao(item)}>
                        <IconEdit size={16} />
                      </ActionIcon>
                      {item.status && (
                        <ActionIcon variant="subtle" color="red" onClick={() => excluir(item)}>
                          <IconTrash size={16} />
                        </ActionIcon>
                      )}
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
              {data.length === 0 && (
                <Table.Tr>
                  <Table.Td colSpan={5}>
                    <Text ta="center" c="dimmed" py="md">
                      Nenhum tipo de embalagem encontrado
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}

      {/* Modal de criação/edição */}
      <Modal
        opened={modalAberto}
        onClose={() => setModalAberto(false)}
        title={editando ? 'Editar Tipo de Embalagem' : 'Novo Tipo de Embalagem'}
        centered
        size="xl"
      >
        <ScrollArea.Autosize mah="75vh">
          <Stack gap="md" p="xs">
            <SimpleGrid cols={2}>
              <TextInput
                label="Código"
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.currentTarget.value.toUpperCase() })}
                required
                maxLength={30}
                placeholder="Ex: CARTUCHO_SIMPLES"
              />
              <TextInput
                label="Descrição"
                value={form.descricao}
                onChange={(e) => setForm({ ...form, descricao: e.currentTarget.value })}
                required
                maxLength={200}
                placeholder="Ex: Cartucho simples com aba"
              />
            </SimpleGrid>

            <Divider label="Fórmulas de Planificação" labelPosition="left" />

            <Textarea
              label="Fórmula Largura (planificada)"
              description="Expressão matemática. Variáveis: nomes dos parâmetros (L, A, P, ABA, SANGRIA, PINCA)"
              value={form.formulaLargura}
              onChange={(e) => setForm({ ...form, formulaLargura: e.currentTarget.value })}
              required
              placeholder="Ex: 2*L + 2*P + ABA + 2*SANGRIA"
              autosize
              minRows={1}
              maxRows={3}
            />

            <Textarea
              label="Fórmula Altura (planificada)"
              description="Expressão matemática com as mesmas variáveis disponíveis"
              value={form.formulaAltura}
              onChange={(e) => setForm({ ...form, formulaAltura: e.currentTarget.value })}
              required
              placeholder="Ex: A + 2*P + 2*SANGRIA + PINCA"
              autosize
              minRows={1}
              maxRows={3}
            />

            {/* Preview de fórmulas */}
            <FormulaPreview
              formulaLargura={form.formulaLargura}
              formulaAltura={form.formulaAltura}
              parametros={parametrosParsed}
            />

            <Divider label="Parâmetros" labelPosition="left" />

            <JsonInput
              label="Parâmetros (JSON)"
              description='Array de objetos: [{"nome": "L", "label": "Largura", "unidade": "mm", "obrigatorio": true, "default": 0}]'
              value={parametrosJson}
              onChange={setParametrosJson}
              autosize
              minRows={3}
              maxRows={10}
              validationError="JSON inválido"
              formatOnBlur
              placeholder={`[
  {"nome": "L", "label": "Largura", "unidade": "mm", "obrigatorio": true},
  {"nome": "A", "label": "Altura", "unidade": "mm", "obrigatorio": true},
  {"nome": "P", "label": "Profundidade", "unidade": "mm", "obrigatorio": true}
]`}
            />

            <Divider label="Processos e Defaults" labelPosition="left" />

            <MultiSelect
              label="Processos Obrigatórios"
              data={PROCESSOS_DISPONIVEIS}
              value={form.processosObrigatorios}
              onChange={(v) => setForm({ ...form, processosObrigatorios: v })}
              placeholder="Selecione os processos"
              clearable
              searchable
            />

            <SimpleGrid cols={3}>
              <NumberInput
                label="Aba Colagem (mm)"
                value={form.abaColagemMm}
                onChange={(v) => setForm({ ...form, abaColagemMm: typeof v === 'number' ? v : 15 })}
                min={0}
                decimalScale={2}
              />
              <NumberInput
                label="Sangria (mm)"
                value={form.sangriaMm}
                onChange={(v) => setForm({ ...form, sangriaMm: typeof v === 'number' ? v : 3 })}
                min={0}
                decimalScale={2}
              />
              <NumberInput
                label="Pinça (mm)"
                value={form.pincaMm}
                onChange={(v) => setForm({ ...form, pincaMm: typeof v === 'number' ? v : 10 })}
                min={0}
                decimalScale={2}
              />
            </SimpleGrid>

            <TextInput
              label="URL da Imagem (opcional)"
              value={form.imagemUrl}
              onChange={(e) => setForm({ ...form, imagemUrl: e.currentTarget.value })}
              placeholder="https://..."
            />

            <Button onClick={salvar} fullWidth loading={salvando} mt="md">
              {editando ? 'Salvar Alterações' : 'Criar Tipo de Embalagem'}
            </Button>
          </Stack>
        </ScrollArea.Autosize>
      </Modal>
    </Stack>
  )
}
