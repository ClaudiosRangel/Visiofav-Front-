'use client'

/**
 * Fechamento do Orçamento (B9 — P17), FASE 1: 4 abas em modo SOMENTE LEITURA,
 * reproduzindo a tela de Fechamento do Calcgraf. Lê o `resultadoCalculo` já
 * salvo (não recalcula, não toca o motor). A edição com recálculo é a Fase 2.
 *
 * Abas:
 *  - Preço de Venda: qtd / valor unitário / total / margem% / CM% / CM$
 *  - Taxas de Produção: MD / CT / SE / créditos / custo financeiro / C.Produção
 *  - Custos Diretos de Venda: ICMS / PIS-COFINS / Comissões / Juros (CEV)
 *  - Diversos: margem de lucro, custo total, totais
 */
import { Tabs, Table, Text, Group, Stack, Badge, Paper } from '@mantine/core'
import { IconCurrencyReal, IconReceipt2, IconReceiptTax, IconDotsCircleHorizontal } from '@tabler/icons-react'

interface Cev { icms?: number; juros?: number; pisCofins?: number; comissoes?: number }
interface MargemCfg { impostos?: number; comissao?: number; despAdm?: number; markup?: number }
interface Resultado {
  custoTotal?: number
  precoVenda?: number
  precoUnitario?: number
  margemReal?: number
  materialDireto?: number
  custoTransformacao?: number
  servicoExterno?: number
  custoProducao?: number
  cevPerc?: number
  cevValor?: number
  contribuicaoMarginalValor?: number
  contribuicaoMarginalPerc?: number
  cev?: Cev
  margem?: MargemCfg
  creditosFiscais?: number
  encargoFinanceiroPerc?: number
}

interface Props {
  resultado: Resultado | null | undefined
  quantidade: number
  // Fallbacks do cabeçalho (multi-item usa consolidado)
  precoVendaConsolidado?: number | null
  custoProducaoConsolidado?: number | null
}

function brl(n?: number | null) {
  if (n == null) return '—'
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}
function pct(n?: number | null) {
  if (n == null) return '—'
  return `${Number(n).toFixed(2)}%`
}
function num(n?: number | null) {
  if (n == null) return '—'
  return Number(n).toLocaleString('pt-BR')
}

export default function FechamentoOrcamento({ resultado, quantidade, precoVendaConsolidado, custoProducaoConsolidado }: Props) {
  const r = resultado || {}
  const precoVenda = r.precoVenda ?? precoVendaConsolidado ?? null
  const precoUnitario = r.precoUnitario ?? (precoVenda != null && quantidade > 0 ? precoVenda / quantidade : null)
  const custoProducao = r.custoProducao ?? custoProducaoConsolidado ?? null

  // CEV detalhado: linha por componente (alíquota × base = valor). Base = preço.
  const base = precoVenda ?? 0
  const cev = r.cev || {}
  const linhasCev = [
    { rotulo: 'ICMS', aliq: cev.icms },
    { rotulo: 'PIS/COFINS', aliq: cev.pisCofins },
    { rotulo: 'Comissões', aliq: cev.comissoes },
    { rotulo: 'Juros', aliq: cev.juros },
  ].filter((l) => l.aliq != null)

  return (
    <Tabs defaultValue="preco" keepMounted={false}>
      <Tabs.List>
        <Tabs.Tab value="preco" leftSection={<IconCurrencyReal size={16} />}>Preço de Venda</Tabs.Tab>
        <Tabs.Tab value="producao" leftSection={<IconReceipt2 size={16} />}>Taxas de Produção</Tabs.Tab>
        <Tabs.Tab value="venda" leftSection={<IconReceiptTax size={16} />}>Custos Diretos de Venda</Tabs.Tab>
        <Tabs.Tab value="diversos" leftSection={<IconDotsCircleHorizontal size={16} />}>Diversos</Tabs.Tab>
      </Tabs.List>

      {/* ── Preço de Venda ── */}
      <Tabs.Panel value="preco" pt="md">
        <Table withTableBorder>
          <Table.Tbody>
            <Table.Tr><Table.Td>Quantidade</Table.Td><Table.Td ta="right">{num(quantidade)}</Table.Td></Table.Tr>
            <Table.Tr><Table.Td>Valor Unitário</Table.Td><Table.Td ta="right">{brl(precoUnitario)}</Table.Td></Table.Tr>
            <Table.Tr><Table.Td fw={600}>Valor Total</Table.Td><Table.Td ta="right" fw={700} c="green">{brl(precoVenda)}</Table.Td></Table.Tr>
            <Table.Tr><Table.Td>Margem</Table.Td><Table.Td ta="right">{pct(r.margemReal ?? r.margem?.markup)}</Table.Td></Table.Tr>
            <Table.Tr><Table.Td>Contribuição Marginal (%)</Table.Td><Table.Td ta="right">{pct(r.contribuicaoMarginalPerc)}</Table.Td></Table.Tr>
            <Table.Tr><Table.Td>Contribuição Marginal (R$)</Table.Td><Table.Td ta="right">{brl(r.contribuicaoMarginalValor)}</Table.Td></Table.Tr>
          </Table.Tbody>
        </Table>
      </Tabs.Panel>

      {/* ── Taxas de Produção ── */}
      <Tabs.Panel value="producao" pt="md">
        <Table withTableBorder>
          <Table.Tbody>
            <Table.Tr><Table.Td>Materiais Diretos (MD)</Table.Td><Table.Td ta="right">{brl(r.materialDireto)}</Table.Td></Table.Tr>
            <Table.Tr><Table.Td>Transformação (CT)</Table.Td><Table.Td ta="right">{brl(r.custoTransformacao)}</Table.Td></Table.Tr>
            {r.servicoExterno != null && r.servicoExterno > 0 && (
              <Table.Tr><Table.Td>Serviços Externos (SE)</Table.Td><Table.Td ta="right">{brl(r.servicoExterno)}</Table.Td></Table.Tr>
            )}
            {r.creditosFiscais != null && r.creditosFiscais > 0 && (
              <Table.Tr><Table.Td>(−) Créditos fiscais</Table.Td><Table.Td ta="right" c="teal">− {brl(r.creditosFiscais)}</Table.Td></Table.Tr>
            )}
            {r.encargoFinanceiroPerc != null && r.encargoFinanceiroPerc > 0 && (
              <Table.Tr><Table.Td>Custo Financeiro</Table.Td><Table.Td ta="right">{pct(r.encargoFinanceiroPerc)}</Table.Td></Table.Tr>
            )}
            <Table.Tr><Table.Td fw={600}>Custo de Produção</Table.Td><Table.Td ta="right" fw={700} c="red">{brl(custoProducao)}</Table.Td></Table.Tr>
          </Table.Tbody>
        </Table>
      </Tabs.Panel>

      {/* ── Custos Diretos de Venda (CEV) ── */}
      <Tabs.Panel value="venda" pt="md">
        {linhasCev.length > 0 ? (
          <Table withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Taxa</Table.Th>
                <Table.Th ta="right">Alíquota</Table.Th>
                <Table.Th ta="right">Base</Table.Th>
                <Table.Th ta="right">Valor</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {linhasCev.map((l) => (
                <Table.Tr key={l.rotulo}>
                  <Table.Td>{l.rotulo}</Table.Td>
                  <Table.Td ta="right">{pct(l.aliq)}</Table.Td>
                  <Table.Td ta="right">{brl(base)}</Table.Td>
                  <Table.Td ta="right">{brl(base * (Number(l.aliq) / 100))}</Table.Td>
                </Table.Tr>
              ))}
              <Table.Tr>
                <Table.Td fw={600}>Total CEV</Table.Td>
                <Table.Td ta="right" fw={600}>{pct(r.cevPerc)}</Table.Td>
                <Table.Td />
                <Table.Td ta="right" fw={700}>{brl(r.cevValor)}</Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        ) : (
          <Stack gap="xs">
            <Text size="sm" c="dimmed">Este orçamento não tem o CEV decomposto gravado. Total dos custos de venda:</Text>
            <Group justify="space-between">
              <Text>Total CEV ({pct(r.cevPerc)})</Text>
              <Text fw={700}>{brl(r.cevValor)}</Text>
            </Group>
          </Stack>
        )}
      </Tabs.Panel>

      {/* ── Diversos ── */}
      <Tabs.Panel value="diversos" pt="md">
        <Table withTableBorder>
          <Table.Tbody>
            <Table.Tr><Table.Td>Margem de lucro (markup)</Table.Td><Table.Td ta="right">{pct(r.margem?.markup ?? r.margemReal)}</Table.Td></Table.Tr>
            {r.margem?.comissao != null && (
              <Table.Tr><Table.Td>Comissão (margem)</Table.Td><Table.Td ta="right">{pct(r.margem.comissao)}</Table.Td></Table.Tr>
            )}
            {r.margem?.impostos != null && (
              <Table.Tr><Table.Td>Impostos (margem)</Table.Td><Table.Td ta="right">{pct(r.margem.impostos)}</Table.Td></Table.Tr>
            )}
            {r.margem?.despAdm != null && (
              <Table.Tr><Table.Td>Despesas administrativas</Table.Td><Table.Td ta="right">{pct(r.margem.despAdm)}</Table.Td></Table.Tr>
            )}
            <Table.Tr><Table.Td fw={600}>Custo Total (base do preço)</Table.Td><Table.Td ta="right" fw={600}>{brl(r.custoTotal ?? custoProducao)}</Table.Td></Table.Tr>
            <Table.Tr><Table.Td fw={600}>Valor de Venda</Table.Td><Table.Td ta="right" fw={700} c="green">{brl(precoVenda)}</Table.Td></Table.Tr>
          </Table.Tbody>
        </Table>
        <Paper mt="sm" p="xs" withBorder bg="var(--mantine-color-default)">
          <Group gap="xs">
            <Badge variant="light" color="gray">Somente leitura</Badge>
            <Text size="xs" c="dimmed">
              A edição das taxas com recálculo do preço (Fase 2) será liberada em seguida.
            </Text>
          </Group>
        </Paper>
      </Tabs.Panel>
    </Tabs>
  )
}
