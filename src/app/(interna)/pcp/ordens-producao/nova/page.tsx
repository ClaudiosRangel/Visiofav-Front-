'use client'

import { useEffect, useState, useMemo } from 'react'
import { Title, Stack, Card, Group, Button, TextInput, NumberInput, Select, Textarea, Text, Alert, Divider, Badge, Table, Loader, Center } from '@mantine/core'
import { DateInput } from '@mantine/dates'
import { IconArrowLeft, IconCheck, IconAlertTriangle, IconPackage } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

// Validação de Pantone: "PMS 200 C", "PMS 812 U", etc.
const PANTONE_REGEX = /^PMS\s?\d{1,4}\s?[CU]?$/i
// Validação CMYK: "C100-M0-Y0-K0" ou "C100 M0 Y0 K0"
const CMYK_REGEX = /^C\d{1,3}[-\s]?M\d{1,3}[-\s]?Y\d{1,3}[-\s]?K\d{1,3}$/i

function validarCor(sistema: string | null, codigo: string): string | null {
  if (!codigo) return null // campo opcional
  if (sistema === 'PANTONE' && !PANTONE_REGEX.test(codigo.trim())) {
    return 'Formato Pantone inválido. Use: PMS 200 C'
  }
  if (sistema === 'CMYK' && !CMYK_REGEX.test(codigo.trim())) {
    return 'Formato CMYK inválido. Use: C100-M0-Y0-K0'
  }
  return null
}

// Tipos de insumo principal para controlar visibilidade dos campos de consumo
type TipoInsumo = 'bobina' | 'plano' | 'outro'

function detectarTipoInsumo(produtoSelecionado: any): TipoInsumo {
  if (!produtoSelecionado) return 'outro'
  const nome = (produtoSelecionado.label || '').toLowerCase()
  if (nome.includes('bobina') || nome.includes('rotativ') || nome.includes('rolo')) return 'bobina'
  if (nome.includes('folha') || nome.includes('resma') || nome.includes('plano') || nome.includes('offset')) return 'plano'
  return 'outro'
}

export default function NovaOrdemProducaoPage() {
  useEffect(() => { document.title = 'PCP - Nova Ordem de Produção' }, [])
  const router = useRouter()

  const [produtos, setProdutos] = useState<any[]>([])
  const [clientes, setClientes] = useState<any[]>([])
  const [centros, setCentros] = useState<any[]>([])
  const [unidades, setUnidades] = useState<string[]>(['UN', 'KG', 'M2', 'ML', 'CX', 'PC', 'FLS', 'RSM', 'MIL', 'PCT', 'ROL', 'BOB'])
  const [loading, setLoading] = useState(false)
  const [verificando, setVerificando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [erroCor, setErroCor] = useState<string | null>(null)
  const [verificacaoMateriais, setVerificacaoMateriais] = useState<any>(null)

  // Form state
  const [produtoId, setProdutoId] = useState<string | null>(null)
  const [quantidade, setQuantidade] = useState<number | ''>(1)
  const [unidadeMedida, setUnidadeMedida] = useState('UN')
  const [dataEntrega, setDataEntrega] = useState<Date | null>(null)
  const [prioridade, setPrioridade] = useState<string | null>('NORMAL')
  const [clienteId, setClienteId] = useState<string | null>(null)
  const [centroProducaoId, setCentroProducaoId] = useState<string | null>(null)
  const [lote, setLote] = useState('')
  const [codigoPantone, setCodigoPantone] = useState('')
  const [sistemaCores, setSistemaCores] = useState<string | null>('CMYK')
  const [qtdMetrosLineares, setQtdMetrosLineares] = useState<number | ''>(0)
  const [qtdFolhas, setQtdFolhas] = useState<number | ''>(0)
  const [observacoes, setObservacoes] = useState('')

  // Carrega dados auxiliares
  useEffect(() => {
    api.get('/produtos', { params: { limit: 200, status: 'true' } })
      .then((res) => {
        const lista = (res.data.data || res.data)
          .filter((p: any) => !p.classificacaoPcp || ['PRODUTO_ACABADO', 'INTERMEDIARIO'].includes(p.classificacaoPcp))
          .map((p: any) => ({
            value: p.id,
            label: `${p.codigo} - ${p.nome}`,
            unidade: p.unidade,
            classificacaoPcp: p.classificacaoPcp,
          }))
        setProdutos(lista)
      }).catch(() => {})

    api.get('/clientes', { params: { limit: 200 } })
      .then((res) => {
        const lista = (res.data.data || res.data).map((c: any) => ({
          value: c.id,
          label: c.nomeFantasia || c.razaoSocial,
        }))
        setClientes(lista)
      }).catch(() => {})

    api.get('/centros-producao', { params: { limit: 50, status: 'true' } })
      .then((res) => {
        const lista = (res.data.data || res.data).map((c: any) => ({
          value: c.id,
          label: `${c.codigo} - ${c.descricao} (${c.tipo})`,
        }))
        setCentros(lista)
      }).catch(() => {})
  }, [])

  // Atualiza unidade ao selecionar produto
  useEffect(() => {
    if (produtoId) {
      const prod = produtos.find((p) => p.value === produtoId)
      if (prod?.unidade) setUnidadeMedida(prod.unidade)
    }
  }, [produtoId])

  // Detecta tipo de insumo para controlar campos de consumo
  const produtoSelecionado = useMemo(() => produtos.find((p) => p.value === produtoId), [produtoId, produtos])
  const tipoInsumo = useMemo(() => detectarTipoInsumo(produtoSelecionado), [produtoSelecionado])

  // Valida cor em tempo real
  useEffect(() => {
    if (codigoPantone) {
      setErroCor(validarCor(sistemaCores, codigoPantone))
    } else {
      setErroCor(null)
    }
  }, [codigoPantone, sistemaCores])

  async function handleSubmit() {
    setErro(null)
    setVerificacaoMateriais(null)

    if (!produtoId) { setErro('Selecione um produto'); return }
    if (!quantidade || quantidade <= 0) { setErro('Quantidade deve ser maior que zero'); return }
    if (!dataEntrega) { setErro('Informe a data de entrega prevista'); return }
    if (!centroProducaoId) { setErro('Selecione a máquina/centro de produção destino'); return }

    // Valida cor se informada
    if (codigoPantone) {
      const erroValidacao = validarCor(sistemaCores, codigoPantone)
      if (erroValidacao) { setErro(erroValidacao); return }
    }

    setLoading(true)
    try {
      // 1. Cria a OP com explosão de BOM e geração de etapas
      const res = await api.post('/ordens-producao', {
        produtoId,
        quantidade: Number(quantidade),
        unidadeMedida,
        dataEntregaPrevista: dataEntrega.toISOString(),
        prioridade: prioridade || 'NORMAL',
        clienteId: clienteId || undefined,
        lote: lote || undefined,
        cor: codigoPantone ? `${sistemaCores || 'PANTONE'}: ${codigoPantone}` : undefined,
        observacoes: buildObservacoes(),
        explodirBom: true,
        gerarEtapas: true,
      })

      const opId = res.data.id
      const opNumero = res.data.numero

      // 2. Verifica disponibilidade de materiais no WMS (reserva lógica)
      setVerificando(true)
      try {
        const verificacao = await api.get(`/ordens-producao/${opId}/verificar-materiais`)
        setVerificacaoMateriais(verificacao.data)

        if (verificacao.data.podeLiberar) {
          notifications.show({
            title: 'OP Criada — Materiais Disponíveis ✓',
            message: `OP #${opNumero} criada. Todos os ${verificacao.data.totalItens} materiais estão disponíveis no WMS.`,
            color: 'green',
            position: 'top-right',
            autoClose: 5000,
          })
          router.push('/pcp/ordens-producao')
        } else {
          // Materiais insuficientes — mostra alerta mas não bloqueia
          notifications.show({
            title: 'OP Criada — Atenção: Materiais Insuficientes',
            message: `OP #${opNumero} criada. ${verificacao.data.itensInsuficientes + verificacao.data.itensSemEstoque} materiais com saldo insuficiente no WMS.`,
            color: 'orange',
            position: 'top-right',
            autoClose: 8000,
          })
        }
      } catch {
        // Se falhar a verificação, OP já foi criada — segue
        notifications.show({
          title: 'OP Criada',
          message: `OP #${opNumero} criada com ${res.data.itensGerados} materiais. Verifique disponibilidade manualmente.`,
          color: 'blue',
          position: 'top-right',
        })
        router.push('/pcp/ordens-producao')
      } finally {
        setVerificando(false)
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Erro ao criar OP'
      setErro(msg)
    } finally {
      setLoading(false)
    }
  }

  function buildObservacoes(): string {
    const parts: string[] = []
    if (observacoes) parts.push(observacoes)
    if (centroProducaoId) {
      const centro = centros.find((c) => c.value === centroProducaoId)
      if (centro) parts.push(`Máquina destino: ${centro.label}`)
    }
    if (qtdMetrosLineares && Number(qtdMetrosLineares) > 0) parts.push(`Consumo previsto: ${qtdMetrosLineares} metros lineares`)
    if (qtdFolhas && Number(qtdFolhas) > 0) parts.push(`Consumo previsto: ${qtdFolhas} folhas`)
    if (sistemaCores && codigoPantone) parts.push(`Cor: ${sistemaCores} ${codigoPantone}`)
    return parts.join(' | ')
  }

  return (
    <Stack gap="md">
      <Group>
        <Button variant="subtle" leftSection={<IconArrowLeft size={16} />} onClick={() => router.back()}>
          Voltar
        </Button>
        <Title order={3}>Nova Ordem de Produção</Title>
      </Group>

      {erro && <Alert color="red" onClose={() => setErro(null)} withCloseButton>{erro}</Alert>}

      <Card withBorder>
        <Stack gap="md">
          <Text size="sm" fw={600} c="dimmed">Dados Principais</Text>

          <Group grow>
            <Select
              label="Produto a Fabricar *"
              placeholder="Selecione o produto acabado"
              data={produtos}
              value={produtoId}
              onChange={setProdutoId}
              searchable
              required
            />
            <Select
              label="Cliente (proprietário do estoque)"
              placeholder="Selecione o cliente"
              data={clientes}
              value={clienteId}
              onChange={setClienteId}
              searchable
              clearable
            />
          </Group>

          <Group grow>
            <NumberInput
              label="Quantidade *"
              value={quantidade}
              onChange={setQuantidade}
              min={1}
              decimalScale={4}
              required
            />
            <Select
              label="Unidade"
              data={unidades}
              value={unidadeMedida}
              onChange={(v) => setUnidadeMedida(v || 'UN')}
              searchable
              description="Unidade do produto final"
            />
            <Select
              label="Prioridade *"
              data={['BAIXA', 'NORMAL', 'ALTA', 'URGENTE']}
              value={prioridade}
              onChange={setPrioridade}
            />
          </Group>

          <Group grow>
            <DateInput
              label="Data de Entrega Prevista *"
              placeholder="Selecione a data"
              value={dataEntrega}
              onChange={setDataEntrega}
              required
            />
            <Select
              label="Máquina / Centro Produtivo Destino *"
              placeholder="Onde será produzido"
              data={centros}
              value={centroProducaoId}
              onChange={setCentroProducaoId}
              searchable
              required
            />
          </Group>

          <Divider label="Especificação Gráfica" labelPosition="left" />

          <Group grow>
            <Select
              label="Sistema de Cores"
              data={['CMYK', 'PANTONE', 'RGB', 'ESCALA']}
              value={sistemaCores}
              onChange={setSistemaCores}
              clearable
            />
            <TextInput
              label="Código da Cor / Pantone"
              placeholder={sistemaCores === 'PANTONE' ? 'Ex: PMS 812 C' : sistemaCores === 'CMYK' ? 'Ex: C100-M0-Y0-K0' : 'Código da cor'}
              value={codigoPantone}
              onChange={(e) => setCodigoPantone(e.currentTarget.value)}
              error={erroCor}
              description={sistemaCores === 'PANTONE' ? 'Formato: PMS [número] [C/U]' : sistemaCores === 'CMYK' ? 'Formato: C##-M##-Y##-K##' : undefined}
            />
            <TextInput
              label="Lote de Produção"
              placeholder="Identificação do lote"
              value={lote}
              onChange={(e) => setLote(e.currentTarget.value)}
            />
          </Group>

          <Divider label="Consumo Teórico (Unidades Gráficas)" labelPosition="left" />

          <Group grow>
            {(tipoInsumo === 'bobina' || tipoInsumo === 'outro') && (
              <NumberInput
                label="Metros Lineares (consumo previsto)"
                placeholder="Calculado pela BOM ou informar manual"
                value={qtdMetrosLineares}
                onChange={setQtdMetrosLineares}
                min={0}
                decimalScale={2}
                description={tipoInsumo === 'bobina' ? '⚡ Insumo principal: bobina — foco em metros' : undefined}
              />
            )}
            {(tipoInsumo === 'plano' || tipoInsumo === 'outro') && (
              <NumberInput
                label="Folhas Físicas (consumo previsto)"
                placeholder="Calculado pela BOM ou informar manual"
                value={qtdFolhas}
                onChange={setQtdFolhas}
                min={0}
                description={tipoInsumo === 'plano' ? '⚡ Insumo principal: papel plano — foco em folhas' : undefined}
              />
            )}
          </Group>

          {tipoInsumo !== 'outro' && (
            <Text size="xs" c="teal">
              💡 Tipo de insumo detectado: <strong>{tipoInsumo === 'bobina' ? 'Papel em Bobina' : 'Papel Plano/Folha'}</strong> — campos ajustados automaticamente.
            </Text>
          )}

          <Textarea
            label="Observações"
            placeholder="Informações adicionais para produção"
            value={observacoes}
            onChange={(e) => setObservacoes(e.currentTarget.value)}
            rows={3}
          />

          <Alert color="blue" variant="light" icon={<IconPackage size={18} />}>
            <Text size="xs">
              Ao criar a OP, o sistema irá: (1) Explodir a BOM para calcular materiais necessários,
              (2) Gerar etapas do roteiro de produção, (3) Verificar disponibilidade no WMS e alertar sobre faltas.
            </Text>
          </Alert>

          <Group justify="flex-end">
            <Button variant="default" onClick={() => router.back()}>Cancelar</Button>
            <Button
              leftSection={<IconCheck size={16} />}
              onClick={handleSubmit}
              loading={loading || verificando}
            >
              Criar Ordem de Produção
            </Button>
          </Group>
        </Stack>
      </Card>

      {/* Resultado da verificação de materiais */}
      {verificacaoMateriais && !verificacaoMateriais.podeLiberar && (
        <Card withBorder>
          <Stack gap="sm">
            <Group>
              <IconAlertTriangle size={20} color="orange" />
              <Text fw={600} c="orange">Materiais com Saldo Insuficiente no WMS</Text>
            </Group>
            <Text size="sm" c="dimmed">
              A OP foi criada, mas os seguintes materiais não possuem estoque suficiente para liberação imediata:
            </Text>
            <Table striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Material</Table.Th>
                  <Table.Th>Necessário</Table.Th>
                  <Table.Th>Disponível</Table.Th>
                  <Table.Th>Falta</Table.Th>
                  <Table.Th>Situação</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {verificacaoMateriais.itens
                  .filter((i: any) => i.situacao !== 'SUFICIENTE')
                  .map((item: any) => (
                    <Table.Tr key={item.produtoComponenteId}>
                      <Table.Td>{item.descricao}</Table.Td>
                      <Table.Td>{item.quantidadeNecessaria} {item.unidade}</Table.Td>
                      <Table.Td>{item.saldoLivre}</Table.Td>
                      <Table.Td fw={600} c="red">{item.quantidadeAComprar}</Table.Td>
                      <Table.Td>
                        <Badge color={item.situacao === 'SEM_ESTOQUE' ? 'red' : 'orange'} size="sm">
                          {item.situacao}
                        </Badge>
                      </Table.Td>
                    </Table.Tr>
                  ))}
              </Table.Tbody>
            </Table>
            <Group justify="flex-end">
              <Button variant="light" color="orange" onClick={() => router.push('/pcp/ordens-producao')}>
                Ir para Ordens de Produção
              </Button>
              <Button variant="light" color="blue" onClick={() => router.push('/compras/pedidos')}>
                Gerar Pedido de Compra
              </Button>
            </Group>
          </Stack>
        </Card>
      )}
    </Stack>
  )
}
