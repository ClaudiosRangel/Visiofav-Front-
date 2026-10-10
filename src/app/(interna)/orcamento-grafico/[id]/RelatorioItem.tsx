'use client'

/**
 * RelatorioItem — Relatório fiel de UM item do orçamento gráfico (Task 30).
 *
 * Consome o JSON de `GET /orcamento-grafico/:id/itens/:itemId/relatorio`
 * (objeto `RelatorioOrcamento` montado pela Task 28) e renderiza o pré-cálculo
 * fiel ao Calcgraf: cabeçalho comercial, um bloco por plano (badge de troca de
 * suporte, descritivos, e as 6 seções Suporte/Matriz/Tinta/MatAcab/Impressão/
 * Acabamento em tabelas compactas), Custo de Produção, CEV, Prazos, Comissões,
 * Condições de Pagamento, a tabela de Margens (3 pontos, com 1º mil / mil
 * seguinte) e o rodapé incluído/alterado por.
 *
 * O botão "Baixar PDF" chama `GET .../relatorio.pdf` (responseType blob) e abre
 * em nova aba — mesmo padrão do `handleRelatorio` da página de detalhe.
 */

import { useCallback, useEffect, useState } from 'react'
import {
  Stack, Group, Text, Paper, Table, Badge, Loader, Center, Alert, Button,
  SimpleGrid, Divider, ScrollArea,
} from '@mantine/core'
import { IconAlertCircle, IconDownload, IconStack2 } from '@tabler/icons-react'
import { api } from '@/lib/api'
import { notifications } from '@mantine/notifications'

// ============================================================================
// Tipos (espelham o RelatorioOrcamento do backend — Task 28)
// ============================================================================

interface RelatorioSecaoLinha {
  item: string
  unidade?: string | null
  fixo?: number | null
  variavel?: number | null
  unitario?: number | null
  subtotal: number
}

interface RelatorioPlano {
  nome: string
  sequencia?: number
  ocorrencias?: number | null
  cores?: string | null
  formato?: string | null
  repeticao?: string | null
  tr?: number | null
  corte?: string | null
  aprovacao?: string | null
  tiragem?: number | null
  impressao?: string | null
  producaoHora?: number | null
  quebraPerc?: number | null
  aparaPerc?: number | null
  trocaSuporte?: string | null
  custoSuporte?: number | null
  custoImpressao?: number | null
  custoAcabamento?: number | null
  suporte?: RelatorioSecaoLinha[] | null
  matrizImpressao?: RelatorioSecaoLinha[] | null
  tinta?: RelatorioSecaoLinha[] | null
  matAcabamento?: RelatorioSecaoLinha[] | null
  impressao?: RelatorioSecaoLinha[] | null
  acabamento?: RelatorioSecaoLinha[] | null
}

interface RelatorioMargem {
  markupPerc?: number | null
  margemValor?: number | null
  cmPerc?: number | null
  cmValor?: number | null
  precoUnitario?: number | null
  precoTotal?: number | null
  primeiroMil?: { precoUnitario?: number | null; precoTotal?: number | null } | null
  milSeguinte?: { precoUnitario?: number | null; precoTotal?: number | null } | null
}

interface RelatorioOrcamento {
  cabecalho: {
    empresa?: string | null
    cliente?: string | null
    contato?: string | null
    telefone?: string | null
    formatoFinal?: string | null
    produto?: string | null
    descricao?: string | null
    codigoAcabado?: string | null
    quantidade: number
    excedente?: number | null
    programacaoEntrega?: Array<{ codigoPedido?: string | null; quantidade: number; data: string }> | null
    numeroOpVinculada?: string | number | null
    data?: string | null
    numero?: string | number | null
    serie?: string | null
  }
  planos: RelatorioPlano[]
  // Seções no nível raiz (orçamento sem planos = plano implícito)
  suporte?: RelatorioSecaoLinha[] | null
  matrizImpressao?: RelatorioSecaoLinha[] | null
  tinta?: RelatorioSecaoLinha[] | null
  matAcabamento?: RelatorioSecaoLinha[] | null
  impressao?: RelatorioSecaoLinha[] | null
  acabamento?: RelatorioSecaoLinha[] | null
  custoProducao: {
    materialDireto?: number | null
    custoTransformacao?: number | null
    servicoExterno?: number | null
    custoProducao?: number | null
    creditoIcms?: number | null
    creditoIpi?: number | null
    creditoPisCofins?: number | null
    taxasProducao?: number | null
    encargoFinanceiro?: number | null
    encargoFinanceiroPerc?: number | null
    total?: number | null
  }
  cev: {
    icms?: number | null
    juros?: number | null
    pisCofins?: number | null
    comissoes?: number | null
    impostoIpi?: number | null
    totalPerc?: number | null
  }
  prazos?: {
    producaoDias?: number | null
    armazenagemDias?: number | null
    pagamentoDias?: number | null
    financiamentoDias?: number | null
    totalDias?: number | null
  } | null
  comissoes?: Array<{ vendedor: string; percentual: number }> | null
  condicoesPagamento?: string | null
  margens: RelatorioMargem[]
  incluidoPor?: string | null
  alteradoPor?: string | null
}

// ============================================================================
// Formatadores (pt-BR)
// ============================================================================

function fmtMoeda(val: number | string | null | undefined): string {
  if (val == null) return '—'
  const num = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(num)) return '—'
  return `R$ ${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtPerc(val: number | string | null | undefined): string {
  if (val == null) return '—'
  const num = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(num)) return '—'
  return `${num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
}

function fmtNum(val: number | string | null | undefined): string {
  if (val == null) return '—'
  const num = typeof val === 'string' ? parseFloat(val) : val
  if (isNaN(num)) return '—'
  return num.toLocaleString('pt-BR')
}

// ============================================================================
// Seção de linhas (Item / Un / Fixo / Variável / Unitário / Subtotal)
// ============================================================================

const SECOES: Array<{ chave: keyof RelatorioPlano; titulo: string }> = [
  { chave: 'suporte', titulo: 'Suporte' },
  { chave: 'matrizImpressao', titulo: 'Matriz de Impressão' },
  { chave: 'tinta', titulo: 'Tinta' },
  { chave: 'matAcabamento', titulo: 'Material de Acabamento' },
  { chave: 'impressao', titulo: 'Impressão' },
  { chave: 'acabamento', titulo: 'Acabamento' },
]

function SecaoLinhas({ titulo, linhas }: { titulo: string; linhas?: RelatorioSecaoLinha[] | null }) {
  if (!linhas || linhas.length === 0) return null
  return (
    <Stack gap={4}>
      <Text size="xs" fw={600} tt="uppercase" c="dimmed">{titulo}</Text>
      <Table withTableBorder withColumnBorders fz="xs" verticalSpacing={2} horizontalSpacing="xs">
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Item</Table.Th>
            <Table.Th w={50}>Un</Table.Th>
            <Table.Th ta="right" w={90}>Fixo</Table.Th>
            <Table.Th ta="right" w={90}>Variável</Table.Th>
            <Table.Th ta="right" w={90}>Unitário</Table.Th>
            <Table.Th ta="right" w={100}>Subtotal</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {linhas.map((l, i) => (
            <Table.Tr key={i}>
              <Table.Td>{l.item}</Table.Td>
              <Table.Td>{l.unidade || '—'}</Table.Td>
              <Table.Td ta="right">{l.fixo != null ? fmtMoeda(l.fixo) : '—'}</Table.Td>
              <Table.Td ta="right">{l.variavel != null ? fmtMoeda(l.variavel) : '—'}</Table.Td>
              <Table.Td ta="right">{l.unitario != null ? fmtMoeda(l.unitario) : '—'}</Table.Td>
              <Table.Td ta="right" fw={600}>{fmtMoeda(l.subtotal)}</Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </Stack>
  )
}

// ============================================================================
// Bloco de um plano
// ============================================================================

function BlocoPlano({ plano, indice }: { plano: RelatorioPlano; indice: number }) {
  const descritivos: Array<[string, string | number | null | undefined]> = [
    ['Ocorrências', plano.ocorrencias],
    ['Cores', plano.cores],
    ['Formato', plano.formato],
    ['Repetição', plano.repeticao],
    ['TR', plano.tr],
    ['Corte', plano.corte],
    ['Aprovação', plano.aprovacao],
    ['Tiragem', plano.tiragem != null ? fmtNum(plano.tiragem) : null],
    ['Impressão', plano.impressao],
    ['Produção/h', plano.producaoHora != null ? fmtNum(plano.producaoHora) : null],
    ['Quebra', plano.quebraPerc != null ? fmtPerc(plano.quebraPerc) : null],
    ['Apara', plano.aparaPerc != null ? fmtPerc(plano.aparaPerc) : null],
  ]
  const descritivosVisiveis = descritivos.filter(([, v]) => v != null && v !== '')

  return (
    <Paper p="md" withBorder>
      <Group gap={6} mb="xs">
        <IconStack2 size={16} />
        <Text fw={600}>
          Plano {plano.sequencia ?? indice + 1} — {plano.nome}
        </Text>
        {plano.trocaSuporte && (
          <Badge color="orange" variant="light">{plano.trocaSuporte}</Badge>
        )}
      </Group>

      {descritivosVisiveis.length > 0 && (
        <Group gap="md" mb="sm">
          {descritivosVisiveis.map(([rotulo, valor]) => (
            <Text key={rotulo} size="xs" c="dimmed">
              <strong>{rotulo}:</strong> {valor}
            </Text>
          ))}
        </Group>
      )}

      <Stack gap="sm">
        {SECOES.map((s) => (
          <SecaoLinhas
            key={s.chave}
            titulo={s.titulo}
            linhas={plano[s.chave] as RelatorioSecaoLinha[] | null | undefined}
          />
        ))}
      </Stack>
    </Paper>
  )
}

// ============================================================================
// Componente principal
// ============================================================================

export default function RelatorioItem({
  orcamentoId,
  itemId,
}: {
  orcamentoId: string
  itemId: string
}) {
  const [relatorio, setRelatorio] = useState<RelatorioOrcamento | null>(null)
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [baixando, setBaixando] = useState(false)

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      const { data } = await api.get(`/orcamento-grafico/${orcamentoId}/itens/${itemId}/relatorio`)
      setRelatorio(data)
    } catch (err: any) {
      const status = err?.response?.status
      const msg = err?.response?.data?.message || 'Falha ao carregar o relatório do item.'
      // 400 "sem resultado de cálculo" → mensagem amigável
      if (status === 400) {
        setErro(msg || 'Este item ainda não tem resultado de cálculo para gerar o relatório.')
      } else {
        setErro(msg)
      }
    } finally {
      setLoading(false)
    }
  }, [orcamentoId, itemId])

  useEffect(() => { carregar() }, [carregar])

  // Baixar PDF (mesmo padrão do handleRelatorio da página de detalhe)
  const baixarPdf = async () => {
    setBaixando(true)
    try {
      const { data } = await api.get(
        `/orcamento-grafico/${orcamentoId}/itens/${itemId}/relatorio.pdf`,
        { responseType: 'blob' },
      )
      const url = URL.createObjectURL(new Blob([data], { type: 'application/pdf' }))
      window.open(url, '_blank')
      setTimeout(() => URL.revokeObjectURL(url), 60000)
    } catch (err: any) {
      const status = err?.response?.status
      const msg = err?.response?.data?.message || 'Falha ao gerar o PDF do relatório.'
      notifications.show({
        title: status === 400 ? 'Sem resultado de cálculo' : 'Erro',
        message: status === 400
          ? (msg || 'Este item ainda não tem resultado de cálculo para gerar o PDF.')
          : msg,
        color: status === 400 ? 'orange' : 'red',
      })
    } finally {
      setBaixando(false)
    }
  }

  if (loading) {
    return <Center py="xl"><Loader size="lg" /></Center>
  }

  if (erro) {
    return (
      <Stack gap="md">
        <Alert icon={<IconAlertCircle size={16} />} color="orange" title="Relatório indisponível">
          {erro}
        </Alert>
        <Group justify="flex-end">
          <Button variant="light" onClick={carregar}>Tentar novamente</Button>
        </Group>
      </Stack>
    )
  }

  if (!relatorio) return null

  const c = relatorio.cabecalho
  const cp = relatorio.custoProducao
  const cev = relatorio.cev
  const prazos = relatorio.prazos
  // Seções no nível raiz (orçamento sem planos) → plano implícito único
  const temPlanos = Array.isArray(relatorio.planos) && relatorio.planos.length > 0
  const planoRaiz: RelatorioPlano | null = !temPlanos ? {
    nome: c.produto || c.descricao || 'Item',
    suporte: relatorio.suporte,
    matrizImpressao: relatorio.matrizImpressao,
    tinta: relatorio.tinta,
    matAcabamento: relatorio.matAcabamento,
    impressao: relatorio.impressao,
    acabamento: relatorio.acabamento,
  } : null

  return (
    <Stack gap="md">
      {/* Barra de ação: baixar PDF */}
      <Group justify="space-between" align="center">
        <Text fw={600}>Pré-cálculo do item</Text>
        <Button
          leftSection={<IconDownload size={16} />}
          onClick={baixarPdf}
          loading={baixando}
        >
          Baixar PDF
        </Button>
      </Group>

      {/* Cabeçalho comercial */}
      <Paper p="md" withBorder>
        <Group justify="space-between" mb="xs">
          <Text fw={600} size="sm">
            {c.empresa || 'Pré-Cálculo'}
            {c.numero != null && <> · Nº {c.numero}</>}
            {c.serie && <> · Série {c.serie}</>}
          </Text>
          {c.numeroOpVinculada != null && (
            <Badge variant="light" color="blue">OP: {c.numeroOpVinculada}</Badge>
          )}
        </Group>
        <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="xs">
          <Text size="sm"><strong>Cliente:</strong> {c.cliente || '—'}</Text>
          <Text size="sm"><strong>Contato:</strong> {c.contato || '—'}</Text>
          <Text size="sm"><strong>Telefone:</strong> {c.telefone || '—'}</Text>
          <Text size="sm"><strong>Produto:</strong> {c.produto || '—'}</Text>
          <Text size="sm"><strong>Descrição:</strong> {c.descricao || '—'}</Text>
          <Text size="sm"><strong>Cód. Acabado:</strong> {c.codigoAcabado || '—'}</Text>
          <Text size="sm"><strong>Formato final:</strong> {c.formatoFinal || '—'}</Text>
          <Text size="sm"><strong>Quantidade:</strong> {fmtNum(c.quantidade)}</Text>
          <Text size="sm"><strong>Excedente:</strong> {c.excedente != null ? fmtNum(c.excedente) : '—'}</Text>
          <Text size="sm"><strong>Data:</strong> {c.data || '—'}</Text>
        </SimpleGrid>

        {c.programacaoEntrega && c.programacaoEntrega.length > 0 && (
          <>
            <Divider my="sm" label="Programação de Entrega" labelPosition="left" />
            <Table fz="xs" withTableBorder withColumnBorders verticalSpacing={2} horizontalSpacing="xs">
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Pedido</Table.Th>
                  <Table.Th ta="right">Quantidade</Table.Th>
                  <Table.Th>Data</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {c.programacaoEntrega.map((pe, i) => (
                  <Table.Tr key={i}>
                    <Table.Td>{pe.codigoPedido || '—'}</Table.Td>
                    <Table.Td ta="right">{fmtNum(pe.quantidade)}</Table.Td>
                    <Table.Td>{pe.data}</Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </>
        )}
      </Paper>

      {/* Blocos por plano */}
      {temPlanos
        ? relatorio.planos.map((p, i) => <BlocoPlano key={i} plano={p} indice={i} />)
        : planoRaiz && <BlocoPlano plano={planoRaiz} indice={0} />}

      {/* Custo de Produção */}
      <Paper p="md" withBorder>
        <Text fw={600} size="sm" mb="sm">Custo de Produção</Text>
        <Table fz="sm">
          <Table.Tbody>
            <Table.Tr>
              <Table.Td>Material Direto (MD)</Table.Td>
              <Table.Td ta="right">{fmtMoeda(cp.materialDireto)}</Table.Td>
            </Table.Tr>
            <Table.Tr>
              <Table.Td>Custo de Transformação (CT)</Table.Td>
              <Table.Td ta="right">{fmtMoeda(cp.custoTransformacao)}</Table.Td>
            </Table.Tr>
            {(cp.servicoExterno ?? 0) > 0 && (
              <Table.Tr>
                <Table.Td>Serviço Externo (SE)</Table.Td>
                <Table.Td ta="right">{fmtMoeda(cp.servicoExterno)}</Table.Td>
              </Table.Tr>
            )}
            <Table.Tr>
              <Table.Td fw={600}>Custo de Produção</Table.Td>
              <Table.Td ta="right" fw={600}>{fmtMoeda(cp.custoProducao)}</Table.Td>
            </Table.Tr>
            {cp.creditoIcms != null && (
              <Table.Tr>
                <Table.Td c="teal">Crédito ICMS</Table.Td>
                <Table.Td ta="right" c="teal">{fmtMoeda(cp.creditoIcms)}</Table.Td>
              </Table.Tr>
            )}
            {cp.creditoIpi != null && (
              <Table.Tr>
                <Table.Td c="teal">Crédito IPI</Table.Td>
                <Table.Td ta="right" c="teal">{fmtMoeda(cp.creditoIpi)}</Table.Td>
              </Table.Tr>
            )}
            {cp.creditoPisCofins != null && (
              <Table.Tr>
                <Table.Td c="teal">Crédito PIS/COFINS</Table.Td>
                <Table.Td ta="right" c="teal">{fmtMoeda(cp.creditoPisCofins)}</Table.Td>
              </Table.Tr>
            )}
            {cp.taxasProducao != null && (
              <Table.Tr>
                <Table.Td>Taxas de Produção</Table.Td>
                <Table.Td ta="right">{fmtMoeda(cp.taxasProducao)}</Table.Td>
              </Table.Tr>
            )}
            {(cp.encargoFinanceiro != null || cp.encargoFinanceiroPerc != null) && (
              <Table.Tr>
                <Table.Td>Encargo Financeiro</Table.Td>
                <Table.Td ta="right">
                  {cp.encargoFinanceiroPerc != null && <>{fmtPerc(cp.encargoFinanceiroPerc)} </>}
                  {cp.encargoFinanceiro != null && <>= {fmtMoeda(cp.encargoFinanceiro)}</>}
                </Table.Td>
              </Table.Tr>
            )}
            <Table.Tr>
              <Table.Td fw={700}>Total</Table.Td>
              <Table.Td ta="right" fw={700} c="red">{fmtMoeda(cp.total)}</Table.Td>
            </Table.Tr>
          </Table.Tbody>
        </Table>
      </Paper>

      {/* CEV + Prazos + Comissões + Condições de pagamento */}
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
        <Paper p="md" withBorder>
          <Text fw={600} size="sm" mb="sm">CEV (Custos e Encargos de Venda)</Text>
          <Table fz="sm">
            <Table.Tbody>
              {cev.icms != null && (
                <Table.Tr><Table.Td>ICMS</Table.Td><Table.Td ta="right">{fmtPerc(cev.icms)}</Table.Td></Table.Tr>
              )}
              {cev.impostoIpi != null && (
                <Table.Tr><Table.Td>IPI</Table.Td><Table.Td ta="right">{fmtPerc(cev.impostoIpi)}</Table.Td></Table.Tr>
              )}
              {cev.pisCofins != null && (
                <Table.Tr><Table.Td>PIS/COFINS</Table.Td><Table.Td ta="right">{fmtPerc(cev.pisCofins)}</Table.Td></Table.Tr>
              )}
              {cev.juros != null && (
                <Table.Tr><Table.Td>Juros</Table.Td><Table.Td ta="right">{fmtPerc(cev.juros)}</Table.Td></Table.Tr>
              )}
              {cev.comissoes != null && (
                <Table.Tr><Table.Td>Comissões</Table.Td><Table.Td ta="right">{fmtPerc(cev.comissoes)}</Table.Td></Table.Tr>
              )}
              <Table.Tr>
                <Table.Td fw={600}>Total CEV</Table.Td>
                <Table.Td ta="right" fw={600}>{fmtPerc(cev.totalPerc)}</Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Paper>

        <Stack gap="md">
          {prazos && (
            <Paper p="md" withBorder>
              <Text fw={600} size="sm" mb="sm">Prazos (dias)</Text>
              <SimpleGrid cols={2} spacing="xs">
                {prazos.producaoDias != null && (
                  <Text size="sm"><strong>Produção:</strong> {fmtNum(prazos.producaoDias)}</Text>
                )}
                {prazos.armazenagemDias != null && (
                  <Text size="sm"><strong>Armazenagem:</strong> {fmtNum(prazos.armazenagemDias)}</Text>
                )}
                {prazos.pagamentoDias != null && (
                  <Text size="sm"><strong>Pagamento:</strong> {fmtNum(prazos.pagamentoDias)}</Text>
                )}
                {prazos.financiamentoDias != null && (
                  <Text size="sm"><strong>Financiamento:</strong> {fmtNum(prazos.financiamentoDias)}</Text>
                )}
                {prazos.totalDias != null && (
                  <Text size="sm"><strong>Total:</strong> {fmtNum(prazos.totalDias)}</Text>
                )}
              </SimpleGrid>
            </Paper>
          )}

          {relatorio.comissoes && relatorio.comissoes.length > 0 && (
            <Paper p="md" withBorder>
              <Text fw={600} size="sm" mb="sm">Comissões</Text>
              <Table fz="sm">
                <Table.Tbody>
                  {relatorio.comissoes.map((com, i) => (
                    <Table.Tr key={i}>
                      <Table.Td>{com.vendedor}</Table.Td>
                      <Table.Td ta="right">{fmtPerc(com.percentual)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Paper>
          )}

          {relatorio.condicoesPagamento && (
            <Paper p="md" withBorder>
              <Text fw={600} size="sm" mb="xs">Condições de Pagamento</Text>
              <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>{relatorio.condicoesPagamento}</Text>
            </Paper>
          )}
        </Stack>
      </SimpleGrid>

      {/* Margens (3 pontos) */}
      {relatorio.margens && relatorio.margens.length > 0 && (
        <Paper p="md" withBorder>
          <Text fw={600} size="sm" mb="sm">Margens e Preços</Text>
          <ScrollArea>
            <Table fz="sm" withTableBorder withColumnBorders striped>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th ta="right">Markup</Table.Th>
                  <Table.Th ta="right">Margem (R$)</Table.Th>
                  <Table.Th ta="right">CM %</Table.Th>
                  <Table.Th ta="right">CM (R$)</Table.Th>
                  <Table.Th ta="right">Preço Unit.</Table.Th>
                  <Table.Th ta="right">Preço Total</Table.Th>
                  <Table.Th ta="right">1º Mil (unit.)</Table.Th>
                  <Table.Th ta="right">Mil Seg. (unit.)</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {relatorio.margens.map((m, i) => {
                  const primeiroMilUnit = m.primeiroMil?.precoUnitario ?? null
                  const milSeguinteUnit = m.milSeguinte?.precoUnitario ?? null
                  return (
                    <Table.Tr key={i}>
                      <Table.Td ta="right">{fmtPerc(m.markupPerc)}</Table.Td>
                      <Table.Td ta="right">{fmtMoeda(m.margemValor)}</Table.Td>
                      <Table.Td ta="right">{fmtPerc(m.cmPerc)}</Table.Td>
                      <Table.Td ta="right">{fmtMoeda(m.cmValor)}</Table.Td>
                      <Table.Td ta="right" fw={600}>{fmtMoeda(m.precoUnitario)}</Table.Td>
                      <Table.Td ta="right" fw={600} c="green">{fmtMoeda(m.precoTotal)}</Table.Td>
                      <Table.Td ta="right">{primeiroMilUnit != null ? fmtMoeda(primeiroMilUnit) : '—'}</Table.Td>
                      <Table.Td ta="right">{milSeguinteUnit != null ? fmtMoeda(milSeguinteUnit) : '—'}</Table.Td>
                    </Table.Tr>
                  )
                })}
              </Table.Tbody>
            </Table>
          </ScrollArea>
        </Paper>
      )}

      {/* Rodapé incluído/alterado por */}
      {(relatorio.incluidoPor || relatorio.alteradoPor) && (
        <Group justify="space-between">
          <Text size="xs" c="dimmed">
            {relatorio.incluidoPor && <>Incluído por: {relatorio.incluidoPor}</>}
          </Text>
          <Text size="xs" c="dimmed">
            {relatorio.alteradoPor && <>Alterado por: {relatorio.alteradoPor}</>}
          </Text>
        </Group>
      )}
    </Stack>
  )
}
